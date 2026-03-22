/**
 * AgentExecutor - Multi-step agent using Vercel AI SDK 6
 *
 * Replaces the manual ReAct loop with AI SDK's native `generateText` + `maxSteps`.
 * Keeps: cancellation, DB persistence, system prompt building, SSE event types.
 * Removes: EventEmitter, manual tool-format switching, nudging logic.
 */

import { generateText, stepCountIs, type StepResult } from 'ai';
import { resolveModel, getProviderOptions, parseModelString } from './ai-provider.js';
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
 * Set by the route handler before calling execute().
 */
export type SSEEmitter = (event: AgentSSEEvent) => void;

export class AgentExecutor {
  private config: AgentConfig;
  private activeControllers: Map<string, AbortController> = new Map();

  constructor(config?: Partial<AgentConfig>) {
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Execute an agent task using AI SDK generateText with maxSteps
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

    let stepNumber = 0;

    try {
      await agentPersistence.updateTaskStatus(task.id, 'running');

      // Build tools in AI SDK format
      const tools = toolRegistry.getAISDKTools(context, options?.allowedTools);
      const toolNames = Object.keys(tools);

      // Build system prompt
      const systemPrompt = options?.systemPrompt || await this.buildSystemPrompt(toolNames, context);

      const stepStartTimes: Map<number, number> = new Map();

      const result = await generateText({
        model: resolveModel(model),
        system: systemPrompt,
        prompt: query,
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

          console.log(`[AgentExecutor] Step ${stepNumber}: toolCalls=${step.toolCalls?.length || 0}, text=${(step.text || '').substring(0, 100) || '(empty)'}`);

          // Emit step:start
          emitSSE({
            event: 'step:start',
            data: { taskId: task.id, stepNumber },
          });

          if (step.toolCalls && step.toolCalls.length > 0) {
            for (let i = 0; i < step.toolCalls.length; i++) {
              const tc = step.toolCalls[i]!;
              const tr = step.toolResults?.[i];

              // Emit tool_start
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

              // Persist step
              await agentPersistence.createStep({
                taskId: task.id,
                stepNumber,
                thought: step.text || undefined,
                toolName: tc.toolName,
                toolInput: tc.input as Record<string, unknown>,
                toolOutput: truncatedOutput,
                tokensUsed: (step.usage?.inputTokens || 0) + (step.usage?.outputTokens || 0),
                durationMs,
              });

              // Emit tool_complete
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
          // Final answer step (no tool calls, only text) is NOT persisted as a
          // separate step — the text is already stored as task.result.answer
          // to avoid duplication in the UI.

          // Emit step:complete
          emitSSE({
            event: 'step:complete',
            data: {
              taskId: task.id,
              stepNumber,
              thought: step.text || undefined,
              duration: durationMs,
            },
          });

          // Track start time for next step
          stepStartTimes.set(stepNumber + 1, Date.now());
        },
      });

      // Calculate totals from result
      const finalAnswer = result.text || 'Maximale Anzahl an Schritten erreicht.';
      const totalInputTokens = result.usage?.inputTokens || 0;
      const totalOutputTokens = result.usage?.outputTokens || 0;

      // Complete task
      await agentPersistence.updateTaskStatus(task.id, 'completed', {
        result: { answer: finalAnswer },
        totalSteps: stepNumber,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      });

      emitSSE({
        event: 'task:complete',
        data: {
          taskId: task.id,
          result: finalAnswer,
          totalSteps: stepNumber,
          inputTokens: totalInputTokens,
          outputTokens: totalOutputTokens,
        },
      });

      this.activeControllers.delete(task.id);
      return {
        ...task,
        status: 'completed',
        result: { answer: finalAnswer },
        totalSteps: stepNumber,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Check if this was a cancellation
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
   *
   * Progressive Disclosure Level 1: Skill names + descriptions are always
   * injected so the agent knows what's available without calling list_skills.
   */
  private async buildSystemPrompt(toolNames: string[], context: AgentUserContext): Promise<string> {
    const hasSkills = toolNames.includes('load_skill');

    let prompt = `You are an agent with access to tools. You MUST use the tools to answer questions.

Available tools: ${toolNames.join(', ')}

CRITICAL RULES:
- You MUST call rag_search tool for EVERY question to search the document database
- NEVER answer from your own knowledge - ONLY use information returned by tools
- If the tools return no results, respond with: "Ich habe keine Informationen zu dieser Anfrage in der Wissensdatenbank gefunden."
- Do NOT invent, guess, or hallucinate information that was not returned by the tools
- Cite sources (document name, page number) in your answer
- Answer in German (Deutsch)`;

    if (hasSkills) {
      // Progressive Disclosure Level 1: inject skill descriptions
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
        // Skills not available yet (e.g., table not created)
      }

      prompt += `

SKILLS (pre-built workflows):
${skillSummary || '(keine Skills verfügbar)'}

When a skill matches the user's request:
1. Call load_skill with the skill's slug to get the full instructions
2. Follow the instructions step by step using the recommended tools
3. The skill instructions will tell you exactly what to do

To create or improve skills:
- create_skill: Save a new skill with name, description, Markdown instructions, and tools
- update_skill: Update an existing skill (content, description, tools, etc.)

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
