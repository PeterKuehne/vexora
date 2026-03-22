/**
 * AgentExecutor - Generalized ReAct loop for multi-step agent tasks
 *
 * Based on the existing AgenticRAG.ts prototype, generalized to support
 * arbitrary tools via ToolRegistry and multiple LLM providers.
 *
 * Flow:
 * 1. Build system prompt with available tool descriptions
 * 2. Call LLM via llmRouter.chatWithTools()
 * 3. Extract thought, emit SSE event
 * 4. Execute tool calls, inject results into context
 * 5. Persist step to DB
 * 6. Repeat until finish or max iterations
 * 7. Support cancellation via AbortSignal
 */

import { EventEmitter } from 'events';
import { llmRouter } from '../llm/index.js';
import type { ChatMessage } from '../llm/LLMProvider.js';
import { toolRegistry } from './ToolRegistry.js';
import { agentPersistence } from './AgentPersistence.js';
import type {
  AgentUserContext,
  AgentSSEEvent,
  AgentConfig,
  AgentTask,
} from './types.js';
import { DEFAULT_AGENT_CONFIG as defaultConfig } from './types.js';

export class AgentExecutor extends EventEmitter {
  private config: AgentConfig;
  private activeControllers: Map<string, AbortController> = new Map();

  constructor(config?: Partial<AgentConfig>) {
    super();
    this.config = { ...defaultConfig, ...config };
  }

  /**
   * Execute an agent task with the ReAct loop
   */
  async execute(
    query: string,
    context: AgentUserContext,
    options?: {
      model?: string;
      conversationId?: string;
      signal?: AbortSignal;
      systemPrompt?: string;      // Override default buildSystemPrompt()
      allowedTools?: string[];     // Whitelist tools for this execution
    }
  ): Promise<AgentTask> {
    const model = options?.model || this.config.defaultModel;
    const abortController = new AbortController();
    const signal = options?.signal || abortController.signal;

    console.log(`[AgentExecutor] Starting task: model=${model}, query="${query.substring(0, 80)}..."`);

    // Create task in DB
    const task = await agentPersistence.createTask(context, query, model, options?.conversationId);
    this.activeControllers.set(task.id, abortController);

    console.log(`[AgentExecutor] Task created: ${task.id}`);

    // Emit task start
    this.emitSSE({
      event: 'task:start',
      data: { taskId: task.id },
    });

    try {
      await agentPersistence.updateTaskStatus(task.id, 'running');

      // Build available tools for this user (optionally filtered by allowedTools whitelist)
      let availableTools = toolRegistry.getAvailableTools(context);
      if (options?.allowedTools) {
        const allowed = new Set(options.allowedTools);
        availableTools = availableTools.filter(t => allowed.has(t.name));
      }
      const { provider } = llmRouter.parseModel(model);
      const isAnthropic = provider === 'anthropic';

      // Build tool options based on provider (using filtered tools)
      const anthropicTools = isAnthropic
        ? availableTools.map(t => ({ name: t.name, description: t.description, input_schema: t.parameters }))
        : undefined;
      const ollamaTools = !isAnthropic
        ? availableTools.map(t => ({ type: 'function' as const, function: { name: t.name, description: t.description, parameters: t.parameters } }))
        : undefined;

      // Build system prompt (use override if provided)
      const systemPrompt = options?.systemPrompt || await this.buildSystemPrompt(availableTools.map(t => t.name), context);

      // Initialize message history
      const messages: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query },
      ];

      let stepNumber = 0;
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let finalAnswer = '';

      // ReAct loop
      while (stepNumber < this.config.maxIterations) {
        // Check for cancellation
        if (signal.aborted) {
          await agentPersistence.updateTaskStatus(task.id, 'cancelled', {
            totalSteps: stepNumber,
            inputTokens: totalInputTokens,
            outputTokens: totalOutputTokens,
          });
          this.emitSSE({ event: 'task:cancelled', data: { taskId: task.id } });
          this.activeControllers.delete(task.id);
          return { ...task, status: 'cancelled' };
        }

        stepNumber++;
        const stepStart = Date.now();

        // 1) Emit: "Agent denkt nach..."
        this.emitSSE({
          event: 'step:start',
          data: { taskId: task.id, stepNumber },
        });

        console.log(`[AgentExecutor] Step ${stepNumber}: calling LLM (${model})`);

        // 2) Call LLM with tools
        // Note: think=false is critical for Qwen3 - tool calling doesn't work in thinking mode
        const chatOptions: import('../llm/LLMProvider.js').ChatOptions = {
          temperature: 0.1,
          maxTokens: 4096,
          think: false,
          ...(anthropicTools && { anthropicTools: anthropicTools as any }),
          ...(ollamaTools && { tools: ollamaTools as any }),
        };

        const response = await llmRouter.chatWithTools(
          messages,
          model,
          chatOptions,
          context.userId,
          options?.conversationId,
        );

        totalInputTokens += response.inputTokens || 0;
        totalOutputTokens += response.outputTokens || 0;

        // Extract thought
        const thought = response.thinkingContent || '';
        // Content that isn't thinking (may contain the answer text for non-tool responses)
        const contentText = response.content || '';

        // 3) Emit thought if present
        if (thought) {
          this.emitSSE({
            event: 'step:thinking',
            data: { taskId: task.id, stepNumber, thought },
          });
        }

        console.log(`[AgentExecutor] Step ${stepNumber}: LLM responded, stopReason=${response.stopReason}, toolCalls=${response.toolCalls?.length || 0}, content=${contentText.substring(0, 100) || '(empty)'}`);

        // Check if model made tool calls
        if (response.toolCalls && response.toolCalls.length > 0) {
          // Build assistant message with tool calls for context
          messages.push({
            role: 'assistant',
            content: contentText,
            toolCalls: response.toolCalls,
          });

          for (const toolCall of response.toolCalls) {
            if (signal.aborted) break;

            const tool = toolRegistry.getTool(toolCall.name);
            if (!tool) {
              const errorOutput = `Unbekanntes Tool: ${toolCall.name}`;
              if (isAnthropic) {
                messages.push({ role: 'tool', content: errorOutput, toolUseId: toolCall.id });
              } else {
                messages.push({ role: 'user', content: `Tool-Fehler: ${errorOutput}` });
              }
              continue;
            }

            // 4) Emit: tool is starting
            this.emitSSE({
              event: 'step:tool_start',
              data: {
                taskId: task.id,
                stepNumber,
                toolName: toolCall.name,
                toolInput: toolCall.arguments,
              },
            });

            // 5) Execute tool
            const toolStart = Date.now();
            const toolResult = await tool.execute(toolCall.arguments, context);
            const toolDuration = Date.now() - toolStart;

            const truncatedOutput = toolResult.output.length > this.config.maxToolOutputLength
              ? toolResult.output.substring(0, this.config.maxToolOutputLength) + '\n\n(Ausgabe gekürzt...)'
              : toolResult.output;

            // Add tool result to messages
            if (isAnthropic) {
              messages.push({ role: 'tool', content: truncatedOutput, toolUseId: toolCall.id });
            } else {
              messages.push({ role: 'user', content: `Ergebnis von ${toolCall.name}:\n${truncatedOutput}` });
            }

            // Persist step
            await agentPersistence.createStep({
              taskId: task.id,
              stepNumber,
              thought: thought || contentText || undefined,
              toolName: toolCall.name,
              toolInput: toolCall.arguments,
              toolOutput: truncatedOutput,
              tokensUsed: (response.inputTokens || 0) + (response.outputTokens || 0),
              durationMs: Date.now() - stepStart,
            });

            // 6) Emit: tool completed with result
            this.emitSSE({
              event: 'step:tool_complete',
              data: {
                taskId: task.id,
                stepNumber,
                toolName: toolCall.name,
                toolInput: toolCall.arguments,
                toolOutput: truncatedOutput.substring(0, 500),
                duration: toolDuration,
              },
            });
          }

          // Emit step complete
          this.emitSSE({
            event: 'step:complete',
            data: { taskId: task.id, stepNumber, thought: thought || contentText, duration: Date.now() - stepStart },
          });
        } else if (stepNumber === 1) {
          // First step without tool calls - nudge model to use tools
          console.log(`[AgentExecutor] Step 1: no tool calls, nudging model to use rag_search`);
          messages.push({ role: 'assistant', content: contentText });
          messages.push({
            role: 'user',
            content: 'You did not use any tools. You MUST call the rag_search tool now to search the document database. Do not respond with text - use the tool calling mechanism.',
          });
          this.emitSSE({
            event: 'step:complete',
            data: { taskId: task.id, stepNumber, thought: contentText || 'Erneuter Versuch mit Tool-Nutzung...', duration: Date.now() - stepStart },
          });
          continue;
        } else {
          // No tool calls - model is done, treat as final answer
          finalAnswer = contentText;

          await agentPersistence.createStep({
            taskId: task.id,
            stepNumber,
            thought: thought || undefined,
            toolName: undefined,
            toolInput: undefined,
            toolOutput: finalAnswer.substring(0, 1000),
            tokensUsed: (response.inputTokens || 0) + (response.outputTokens || 0),
            durationMs: Date.now() - stepStart,
          });

          this.emitSSE({
            event: 'step:complete',
            data: {
              taskId: task.id,
              stepNumber,
              thought,
              duration: Date.now() - stepStart,
            },
          });

          break;
        }
      }

      // If no final answer after max iterations, generate one
      if (!finalAnswer && stepNumber >= this.config.maxIterations) {
        finalAnswer = 'Maximale Anzahl an Schritten erreicht. Bitte versuche die Frage konkreter zu formulieren.';
      }

      // Complete task
      await agentPersistence.updateTaskStatus(task.id, 'completed', {
        result: { answer: finalAnswer },
        totalSteps: stepNumber,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      });

      this.emitSSE({
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
      console.error(`[AgentExecutor] Task ${task.id} failed:`, errorMessage);

      await agentPersistence.updateTaskStatus(task.id, 'failed', {
        error: errorMessage,
      });

      this.emitSSE({
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

  /**
   * Emit an SSE event
   */
  private emitSSE(event: AgentSSEEvent): void {
    this.emit('sse', event);
  }
}

// Singleton
export const agentExecutor = new AgentExecutor();
