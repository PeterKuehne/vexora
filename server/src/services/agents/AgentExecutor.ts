/**
 * AgentExecutor - Multi-turn agent conversations using Vercel AI SDK 6
 *
 * Supports multi-turn conversations: execute() starts a new task,
 * continueTask() handles follow-up messages with full conversation history.
 * Each turn runs generateText() with tools and persists messages + steps to DB.
 */

import { generateText, stepCountIs, type StepResult } from 'ai';
import { resolveModel, getProviderOptions } from './ai-provider.js';
import { toolRegistry } from './ToolRegistry.js';
import { agentPersistence } from './AgentPersistence.js';
import type {
  AgentUserContext,
  AgentSSEEvent,
  AgentConfig,
  AgentTask,
} from './types.js';
import { DEFAULT_AGENT_CONFIG as defaultConfig } from './types.js';

/**
 * Callback type for SSE event emission.
 */
export type SSEEmitter = (event: AgentSSEEvent) => void;

export class AgentExecutor {
  private config: AgentConfig;
  private activeControllers: Map<string, AbortController> = new Map();

  constructor(config?: Partial<AgentConfig>) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Start a new agent task (first turn)
   */
  async execute(
    query: string,
    context: AgentUserContext,
    options?: {
      model?: string;
      conversationId?: string;
      signal?: AbortSignal;
      systemPrompt?: string;
      allowedTools?: string[];
      emitSSE?: SSEEmitter;
    }
  ): Promise<AgentTask> {
    const model = options?.model || this.config.defaultModel;
    const abortController = new AbortController();
    const signal = options?.signal || abortController.signal;
    const emitSSE = options?.emitSSE || (() => {});

    console.log(`[AgentExecutor] Starting task: model=${model}, query="${query.substring(0, 80)}..."`);

    // Create task in DB
    const task = await agentPersistence.createTask(context, query, model, options?.conversationId);
    this.activeControllers.set(task.id, abortController);

    console.log(`[AgentExecutor] Task created: ${task.id}`);

    emitSSE({
      event: 'task:start',
      data: { taskId: task.id },
    });

    // Save first user message
    await agentPersistence.createMessage(task.id, 1, 'user', query);

    // Run the turn
    return this.runTurn(task, model, 1, emitSSE, signal, context, options);
  }

  /**
   * Continue an existing task with a follow-up message
   */
  async continueTask(
    taskId: string,
    userMessage: string,
    context: AgentUserContext,
    options?: {
      emitSSE?: SSEEmitter;
    }
  ): Promise<AgentTask> {
    const emitSSE = options?.emitSSE || (() => {});

    // Verify task exists and is awaiting input
    const task = await agentPersistence.getTaskById(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} nicht gefunden`);
    }
    if (task.status !== 'awaiting_input') {
      throw new Error(`Task ${taskId} erwartet keine Eingabe (Status: ${task.status})`);
    }
    if (this.activeControllers.has(taskId)) {
      throw new Error(`Task ${taskId} läuft bereits`);
    }

    const abortController = new AbortController();
    this.activeControllers.set(taskId, abortController);

    // Determine next turn
    const currentTurn = await agentPersistence.getMaxTurnNumber(taskId);
    const nextTurn = currentTurn + 1;

    console.log(`[AgentExecutor] Continuing task ${taskId}, turn ${nextTurn}: "${userMessage.substring(0, 80)}..."`);

    // Save user message
    await agentPersistence.createMessage(taskId, nextTurn, 'user', userMessage);

    emitSSE({
      event: 'task:start',
      data: { taskId },
    });

    // Run the turn
    return this.runTurn(task, task.model, nextTurn, emitSSE, abortController.signal, context);
  }

  /**
   * Core turn execution — shared by execute() and continueTask()
   */
  private async runTurn(
    task: AgentTask,
    model: string,
    turnNumber: number,
    emitSSE: SSEEmitter,
    signal: AbortSignal,
    context: AgentUserContext,
    options?: {
      systemPrompt?: string;
      allowedTools?: string[];
    }
  ): Promise<AgentTask> {
    let stepNumber = task.totalSteps; // Continue step numbering across turns

    try {
      await agentPersistence.updateTaskStatus(task.id, 'running');

      // Build tools
      const tools = toolRegistry.getAISDKTools(context, options?.allowedTools);
      const toolNames = Object.keys(tools);

      // Build system prompt
      const systemPrompt = options?.systemPrompt || await this.buildSystemPrompt(toolNames, context);

      // Build message history from all previous messages
      const allMessages = await agentPersistence.getMessages(task.id);
      const messages = allMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      const stepStartTimes: Map<number, number> = new Map();

      const result = await generateText({
        model: resolveModel(model),
        system: systemPrompt,
        messages,
        tools,
        stopWhen: stepCountIs(this.config.maxIterations),
        abortSignal: signal,
        temperature: 0.1,
        maxOutputTokens: 4096,
        providerOptions: getProviderOptions(model),

        onStepFinish: async (step: StepResult<typeof tools>) => {
          stepNumber++;
          const stepStart = stepStartTimes.get(stepNumber) || Date.now();
          const durationMs = Date.now() - stepStart;

          console.log(`[AgentExecutor] Turn ${turnNumber}, Step ${stepNumber}: toolCalls=${step.toolCalls?.length || 0}, text=${(step.text || '').substring(0, 100) || '(empty)'}`);

          emitSSE({
            event: 'step:start',
            data: { taskId: task.id, stepNumber },
          });

          if (step.toolCalls && step.toolCalls.length > 0) {
            for (let i = 0; i < step.toolCalls.length; i++) {
              const tc = step.toolCalls[i]!;
              const tr = step.toolResults?.[i];

              emitSSE({
                event: 'step:tool_start',
                data: {
                  taskId: task.id,
                  stepNumber,
                  toolName: tc.toolName,
                  toolInput: tc.input as Record<string, unknown>,
                },
              });

              const toolOutput = typeof tr?.output === 'string'
                ? tr.output
                : JSON.stringify(tr?.output || '');

              const truncatedOutput = toolOutput.length > this.config.maxToolOutputLength
                ? toolOutput.substring(0, this.config.maxToolOutputLength) + '\n\n(Ausgabe gekürzt...)'
                : toolOutput;

              await agentPersistence.createStep({
                taskId: task.id,
                stepNumber,
                turnNumber,
                thought: step.text || undefined,
                toolName: tc.toolName,
                toolInput: tc.input as Record<string, unknown>,
                toolOutput: truncatedOutput,
                tokensUsed: (step.usage?.inputTokens || 0) + (step.usage?.outputTokens || 0),
                durationMs,
              });

              emitSSE({
                event: 'step:tool_complete',
                data: {
                  taskId: task.id,
                  stepNumber,
                  toolName: tc.toolName,
                  toolInput: tc.input as Record<string, unknown>,
                  toolOutput: truncatedOutput.substring(0, 500),
                  duration: durationMs,
                },
              });
            }
          }

          emitSSE({
            event: 'step:complete',
            data: {
              taskId: task.id,
              stepNumber,
              thought: step.text || undefined,
              duration: durationMs,
            },
          });

          stepStartTimes.set(stepNumber + 1, Date.now());
        },
      });

      const finalAnswer = result.text || '';
      const turnInputTokens = result.usage?.inputTokens || 0;
      const turnOutputTokens = result.usage?.outputTokens || 0;

      // Save assistant message
      await agentPersistence.createMessage(task.id, turnNumber, 'assistant', finalAnswer);

      // Set status to awaiting_input (conversation continues)
      await agentPersistence.updateTaskStatus(task.id, 'awaiting_input', {
        result: { answer: finalAnswer },
        totalSteps: stepNumber,
        inputTokens: turnInputTokens,
        outputTokens: turnOutputTokens,
      });

      emitSSE({
        event: 'task:complete',
        data: {
          taskId: task.id,
          result: finalAnswer,
          totalSteps: stepNumber,
          inputTokens: turnInputTokens,
          outputTokens: turnOutputTokens,
          nextStatus: 'awaiting_input',
          turnNumber,
        },
      });

      this.activeControllers.delete(task.id);
      return {
        ...task,
        status: 'awaiting_input',
        result: { answer: finalAnswer },
        totalSteps: stepNumber,
        inputTokens: task.inputTokens + turnInputTokens,
        outputTokens: task.outputTokens + turnOutputTokens,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      if (signal.aborted) {
        await agentPersistence.updateTaskStatus(task.id, 'cancelled', {
          totalSteps: stepNumber,
        });
        emitSSE({ event: 'task:cancelled', data: { taskId: task.id } });
        this.activeControllers.delete(task.id);
        return { ...task, status: 'cancelled' };
      }

      console.error(`[AgentExecutor] Task ${task.id} failed:`, errorMessage);

      await agentPersistence.updateTaskStatus(task.id, 'failed', {
        error: errorMessage,
      });

      emitSSE({
        event: 'task:error',
        data: { taskId: task.id, error: errorMessage },
      });

      this.activeControllers.delete(task.id);
      return { ...task, status: 'failed', error: errorMessage };
    }
  }

  /**
   * Complete a task (end the conversation)
   */
  async completeTask(taskId: string): Promise<void> {
    await agentPersistence.updateTaskStatus(taskId, 'completed');
  }

  /**
   * Cancel a running task
   */
  cancel(taskId: string): boolean {
    const controller = this.activeControllers.get(taskId);
    if (controller) {
      controller.abort();
      this.activeControllers.delete(taskId);
      return true;
    }
    return false;
  }

  /**
   * Check if a task is currently running
   */
  isRunning(taskId: string): boolean {
    return this.activeControllers.has(taskId);
  }

  /**
   * Get active task count
   */
  get activeTaskCount(): number {
    return this.activeControllers.size;
  }

  /**
   * Build the system prompt with available tools and skill descriptions
   */
  private async buildSystemPrompt(toolNames: string[], context: AgentUserContext): Promise<string> {
    const hasSkills = toolNames.includes('load_skill');

    let prompt = `You are an agent with access to tools. You MUST use the tools to answer questions.
This is a multi-turn conversation. The user can send follow-up messages after you respond.

Available tools: ${toolNames.join(', ')}

CRITICAL RULES:
- You MUST call rag_search tool for EVERY question to search the document database
- NEVER answer from your own knowledge - ONLY use information returned by tools
- If the tools return no results, respond with: "Ich habe keine Informationen zu dieser Anfrage in der Wissensdatenbank gefunden."
- Do NOT invent, guess, or hallucinate information that was not returned by the tools
- Cite sources (document name, page number) in your answer
- Answer in German (Deutsch)`;

    if (hasSkills) {
      let skillSummary = '';
      try {
        const { skillRegistry } = await import('../skills/SkillRegistry.js');
        const { skills } = await skillRegistry.getSkills(
          { userId: context.userId, userRole: context.userRole, department: context.department },
          { limit: 20 }
        );
        if (skills.length > 0) {
          skillSummary = skills
            .map(s => `- ${s.name} [${s.slug}]: ${s.description || '(keine Beschreibung)'}`)
            .join('\n');
        }
      } catch {
        // Skills not available yet
      }

      prompt += `

SKILLS (pre-built workflows):
${skillSummary || '(keine Skills verfügbar)'}

When a skill matches the user's request:
1. Call load_skill with the skill's slug to get the full instructions
2. Follow the instructions step by step using the recommended tools
3. The skill instructions will tell you exactly what to do

IMPORTANT: Tools like create_skill, update_skill, and run_skill_test are meant to be used
WITHIN a skill workflow (e.g. the Skill Creator skill), not directly. If the user wants to
create, improve, or test a skill, ALWAYS load the appropriate skill first via load_skill.

If no skill matches, use the tools directly (rag_search, read_chunk, etc.)`;
    }

    prompt += `

WORKFLOW:
1. Check if a skill from the list above matches the user's request
2. If yes: call load_skill(slug) and follow the returned instructions
3. If no: call rag_search with relevant keywords from the user's question
4. If needed, use read_chunk for more details on a specific result
5. Formulate your answer ONLY based on actual tool results
6. If no relevant documents were found, say so - do not make up an answer`;

    return prompt;
  }
}

// Singleton
export const agentExecutor = new AgentExecutor();
