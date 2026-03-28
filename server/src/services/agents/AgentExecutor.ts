/**
 * AgentExecutor - Multi-turn agent conversations using Vercel AI SDK 6
 *
 * Uses ToolLoopAgent for structured agent execution with:
 * - prepareStep for dynamic model/tool selection per step
 * - Lifecycle callbacks for SSE streaming and persistence
 * - Multi-turn support via execute() and continueTask()
 */

import { ToolLoopAgent, stepCountIs, pruneMessages } from 'ai';
import type { ModelMessage } from '@ai-sdk/provider-utils';
import { resolveModel, getProviderOptions, isCloudModel, estimateCost } from './ai-provider.js';
import { toolRegistry } from './ToolRegistry.js';
import { agentPersistence } from './AgentPersistence.js';
import type {
  AgentUserContext,
  AgentSSEEvent,
  AgentConfig,
  AgentTask,
  ClassificationResult,
  AgentStrategy,
} from './types.js';
import { DEFAULT_AGENT_CONFIG as defaultConfig } from './types.js';
import { vectorServiceV2 } from '../VectorServiceV2.js';
import { env } from '../../config/env.js';

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
   * Hybrid pipeline entry point — routes simple queries through search-first
   * local path, complex queries through cloud model with tool autonomy.
   */
  async executeHybrid(
    query: string,
    context: AgentUserContext,
    classification: ClassificationResult,
    options?: {
      conversationId?: string;
      signal?: AbortSignal;
      emitSSE?: SSEEmitter;
      skillSlug?: string;
    }
  ): Promise<AgentTask> {
    const strategy: AgentStrategy = 'hybrid';

    if (classification.complexity === 'complex') {
      // Complex → cloud model with full tool autonomy
      const cloudModel = env.CLOUD_MODEL;
      console.log(`[AgentExecutor] Hybrid → complex → ${cloudModel}`);

      return this.execute(query, context, {
        ...options,
        model: cloudModel,
        routingDecision: 'rag-complex',
        strategy,
      });
    }

    // Simple path → pre-search + local model
    const localModel = env.LOCAL_MODEL;
    let preSearchPrompt: string | undefined;

    if (!classification.skipPreSearch) {
      const startMs = Date.now();

      // Check if the user mentions a specific document by filename
      // If so, narrow the search to that document for better results
      let searchDocIds = context.allowedDocumentIds;
      const mentionedDoc = await this.findMentionedDocument(query, context.allowedDocumentIds);
      if (mentionedDoc) {
        searchDocIds = [mentionedDoc];
        console.log(`[AgentExecutor] Pre-search: document name detected, narrowing to ${mentionedDoc}`);
      }

      console.log(`[AgentExecutor] Pre-search: allowedDocumentIds=${JSON.stringify(searchDocIds?.length)} for user=${context.userId}`);
      try {
        const results = await vectorServiceV2.search({
          query,
          limit: 5,
          threshold: 0.1,
          hybridAlpha: 0.3,
          allowedDocumentIds: searchDocIds,
          levelFilter: [1, 2],
        });

        const preSearchMs = Date.now() - startMs;

        if (results.results.length > 0) {
          preSearchPrompt = this.formatPreSearchResults(results.results);
          console.log(`[AgentExecutor] Hybrid → simple + pre-search: ${results.results.length} results (${preSearchMs}ms)`);
        } else {
          console.log(`[AgentExecutor] Hybrid → simple + pre-search: no results (${preSearchMs}ms)`);
        }
      } catch (error) {
        console.error('[AgentExecutor] Pre-search failed:', error instanceof Error ? error.message : error);
        // Continue without pre-search — model answers from training data
      }
    } else {
      console.log(`[AgentExecutor] Hybrid → simple + skipPreSearch: "${classification.reason}"`);
    }

    return this.execute(query, context, {
      ...options,
      model: localModel,
      routingDecision: 'direct',
      strategy,
      preSearchContext: preSearchPrompt,
    });
  }

  /**
   * Check if the query mentions a specific document by filename.
   * Queries the documents table and matches filenames against the query text.
   */
  private async findMentionedDocument(query: string, allowedDocumentIds?: string[]): Promise<string | null> {
    if (!allowedDocumentIds || allowedDocumentIds.length === 0) return null;

    try {
      const { databaseService } = await import('../DatabaseService.js');
      const result = await databaseService.query(
        `SELECT id, filename FROM documents WHERE id = ANY($1) AND status = 'completed'`,
        [allowedDocumentIds]
      );

      const lowerQuery = query.toLowerCase();
      for (const doc of result.rows) {
        const filename = (doc.filename as string).toLowerCase();
        // Match "AMA" in query against "AMA.pdf", or "Kernbotschaften" against "Samaritano_Kernbotschaften_Final 2.pdf"
        const nameWithoutExt = filename.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
        const nameParts = nameWithoutExt.split(/\s+/).filter(p => p.length >= 3);

        for (const part of nameParts) {
          if (lowerQuery.includes(part)) {
            console.log(`[AgentExecutor] Filename match: "${part}" in query → document ${doc.id} (${doc.filename})`);
            return doc.id as string;
          }
        }
      }
    } catch (error) {
      console.warn('[AgentExecutor] findMentionedDocument failed:', error);
    }

    return null;
  }

  /**
   * Format pre-search results as context block for system prompt injection.
   */
  private formatPreSearchResults(results: Array<{ chunk: { content: string; documentId: string; chunkIndex: number; pageStart?: number }; score: number; document: { originalName: string } }>): string {
    let output = '';
    for (const result of results) {
      output += `Dokument: ${result.document.originalName}`;
      if (result.chunk.pageStart) output += ` | Seite: ${result.chunk.pageStart}`;
      output += ` | Score: ${result.score.toFixed(2)}\n`;
      output += `Inhalt: ${result.chunk.content.substring(0, 600)}${result.chunk.content.length > 600 ? '...' : ''}\n---\n`;
    }
    return output;
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
      routingDecision?: string;
      skillSlug?: string;
      strategy?: AgentStrategy;
      /** Pre-fetched RAG context to inject into system prompt (search-first pipeline) */
      preSearchContext?: string;
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

    // Verify task exists, is awaiting input, and belongs to user (RLS)
    const taskWithSteps = await agentPersistence.getTaskWithSteps(context, taskId);
    if (!taskWithSteps) {
      throw new Error(`Task ${taskId} nicht gefunden`);
    }
    const task = taskWithSteps.task;
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
   *
   * Creates a ToolLoopAgent per turn with lifecycle callbacks for SSE + persistence.
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
      routingDecision?: string;
      skillSlug?: string;
      strategy?: AgentStrategy;
      preSearchContext?: string;
    }
  ): Promise<AgentTask> {
    let stepNumber = task.totalSteps; // Continue step numbering across turns

    try {
      await agentPersistence.updateTaskStatus(task.id, 'running');

      // Enrich context with taskId so tools can reference it
      const toolContext = { ...context, taskId: task.id };

      // Determine which skills have been loaded in previous turns
      // by scanning step history for load_skill calls.
      // Skill-gated tools (e.g. create_skill) become available only
      // after their parent skill was loaded (Anthropic allowed-tools pattern).
      const loadedSkills = new Set<string>();

      // If slash-command invoked a skill, treat it as loaded
      if (options?.skillSlug) {
        loadedSkills.add(options.skillSlug);
      }

      // Scan previous steps for load_skill calls
      if (turnNumber > 1) {
        const { databaseService } = await import('../DatabaseService.js');
        const stepsResult = await databaseService.query(
          `SELECT tool_input FROM agent_steps WHERE task_id = $1 AND tool_name = 'load_skill'`,
          [task.id]
        );
        for (const row of stepsResult.rows) {
          const slug = row.tool_input?.slug as string;
          if (slug) loadedSkills.add(slug);
        }
      }

      if (loadedSkills.size > 0) {
        console.log(`[AgentExecutor] Loaded skills for tool-gating: ${[...loadedSkills].join(', ')}`);
      }

      // Build tools (skill-gated tools only available when their skill is loaded)
      const tools = toolRegistry.getAISDKTools(toolContext, options?.allowedTools, loadedSkills);
      const toolNames = Object.keys(tools);

      // Build system prompt (with optional skill injection from slash-command)
      const instructions = options?.systemPrompt || await this.buildSystemPrompt(toolNames, toolContext, options?.skillSlug, options?.preSearchContext);

      // Build message history from all previous messages (including tool context)
      const allMessages = await agentPersistence.getMessages(task.id);
      const messages: ModelMessage[] = allMessages.map(m => {
        // Structured content (tool-call blocks, tool-result arrays) takes precedence
        if (m.contentJson) {
          if (m.role === 'tool') {
            return { role: 'tool' as const, content: m.contentJson as any };
          }
          return { role: 'assistant' as const, content: m.contentJson as any };
        }
        // Legacy plain text messages
        if (m.role === 'tool') {
          // Should not happen for legacy, but handle gracefully
          return { role: 'tool' as const, content: [{ type: 'tool-result' as const, toolCallId: m.toolCallId || '', toolName: '', result: m.content }] };
        }
        return { role: m.role as 'user' | 'assistant', content: m.content };
      });

      // Prune older tool results to stay within context limits
      const prunedMessages = pruneMessages({
        messages,
        toolCalls: 'before-last-3-messages',
        reasoning: 'before-last-message',
        emptyMessages: 'remove',
      });

      const stepStartTimes: Map<number, number> = new Map();
      // Map toolCallId → stepNumber to correctly correlate parallel tool calls
      const toolCallStepMap: Map<string, number> = new Map();

      // Determine if we should force tool use on the first step.
      // RAG-routed queries MUST search before answering — prevents hallucination.
      // Direct queries (translations, calculations, general knowledge) can skip.
      // Follow-up turns (turnNumber > 1) don't force — user may just ask a clarification.
      const routingDecision = options?.routingDecision;
      const forceToolUseOnFirstStep = turnNumber === 1 && routingDecision !== 'direct';

      // Create a ToolLoopAgent for this turn
      const agent = new ToolLoopAgent({
        model: resolveModel(model),
        instructions,
        tools,
        stopWhen: stepCountIs(this.config.maxIterations),
        temperature: 0.1,
        maxOutputTokens: 4096,
        providerOptions: getProviderOptions(model),

        // Dynamic per-step tool control — force search on step 0 for RAG queries
        prepareStep: ({ stepNumber }) => {
          if (stepNumber === 0 && forceToolUseOnFirstStep) {
            console.log(`[AgentExecutor] Step 0: toolChoice=required (routing=${routingDecision})`);
            return { toolChoice: 'required' as const };
          }
          return { toolChoice: 'auto' as const };
        },

        // SSE + persistence via lifecycle callbacks
        experimental_onToolCallStart: ({ toolCall }) => {
          stepNumber++;
          const myStep = stepNumber;
          stepStartTimes.set(myStep, Date.now());
          toolCallStepMap.set(toolCall.toolCallId, myStep);

          emitSSE({
            event: 'step:start',
            data: { taskId: task.id, stepNumber: myStep, turnNumber },
          });
          emitSSE({
            event: 'step:tool_start',
            data: {
              taskId: task.id,
              stepNumber: myStep,
              turnNumber,
              toolName: toolCall.toolName,
              toolInput: toolCall.input as Record<string, unknown>,
            },
          });
        },

        experimental_onToolCallFinish: async ({ toolCall, durationMs, ...result }) => {
          // Look up the correct stepNumber for this specific tool call
          const myStep = toolCallStepMap.get(toolCall.toolCallId) ?? stepNumber;
          toolCallStepMap.delete(toolCall.toolCallId);

          const toolOutput = 'output' in result
            ? (typeof result.output === 'string' ? result.output : JSON.stringify(result.output || ''))
            : ('error' in result ? String(result.error) : '');

          const truncatedOutput = toolOutput.length > this.config.maxToolOutputLength
            ? toolOutput.substring(0, this.config.maxToolOutputLength) + '\n\n(Ausgabe gekürzt...)'
            : toolOutput;

          console.log(`[AgentExecutor] Turn ${turnNumber}, Step ${myStep}: ${toolCall.toolName} (${durationMs}ms)`);

          try {
            await agentPersistence.createStep({
              taskId: task.id,
              stepNumber: myStep,
              turnNumber,
              toolName: toolCall.toolName,
              toolInput: toolCall.input as Record<string, unknown>,
              toolOutput: truncatedOutput,
              tokensUsed: 0,
              durationMs: Math.round(durationMs ?? 0),
            });
          } catch (persistError) {
            console.error(`[AgentExecutor] Failed to persist step ${myStep}:`, persistError instanceof Error ? persistError.message : persistError);
          }

          emitSSE({
            event: 'step:tool_complete',
            data: {
              taskId: task.id,
              stepNumber: myStep,
              turnNumber,
              toolName: toolCall.toolName,
              toolInput: toolCall.input as Record<string, unknown>,
              toolOutput: truncatedOutput.substring(0, 500),
              duration: durationMs,
            },
          });
        },

        onStepFinish: async (stepResult) => {
          const { toolCalls, text, usage } = stepResult;
          const hasToolCalls = toolCalls && toolCalls.length > 0;

          // Extract reasoning from StepResult (AI SDK 6 provides it directly)
          const reasoningArray = (stepResult as any).reasoning as Array<{ type: string; text: string }> | undefined;
          const reasoning = reasoningArray && reasoningArray.length > 0
            ? reasoningArray.filter(p => p.type === 'reasoning' && p.text).map(p => p.text).join('\n')
            : ((stepResult as any).reasoningText as string | undefined);

          if (reasoning) {
            emitSSE({
              event: 'step:thinking',
              data: {
                taskId: task.id,
                stepNumber,
                turnNumber,
                thought: reasoning,
              },
            });
          }

          if (hasToolCalls) {
            emitSSE({
              event: 'step:complete',
              data: {
                taskId: task.id,
                stepNumber,
                turnNumber,
                thought: text || undefined,
                duration: Date.now() - (stepStartTimes.get(stepNumber) || Date.now()),
              },
            });
          } else if (text) {
            // Final answer step — don't emit as step, it comes via task:complete
            console.log(`[AgentExecutor] Turn ${turnNumber}, Final answer: ${text.substring(0, 100)}...`);
          }
        },
      });

      // Run the agent
      const result = await agent.generate({
        messages: prunedMessages,
        abortSignal: signal,
      });

      // Persist the full tool conversation from this turn (response.messages)
      const responseMessages = result.response?.messages || [];
      if (responseMessages.length > 0) {
        try {
          await agentPersistence.createStructuredMessages(task.id, turnNumber, responseMessages as any);
          console.log(`[AgentExecutor] Persisted ${responseMessages.length} structured messages for turn ${turnNumber}`);
        } catch (persistError) {
          console.error(`[AgentExecutor] Failed to persist structured messages:`, persistError instanceof Error ? persistError.message : persistError);
        }
      }

      const finalAnswer = result.text || (
        stepNumber === task.totalSteps
          ? 'Das Modell hat keine Antwort generiert. Bitte versuche es erneut oder formuliere die Frage anders.'
          : ''
      );
      const turnInputTokens = result.usage?.inputTokens || 0;
      const turnOutputTokens = result.usage?.outputTokens || 0;

      if (!result.text && stepNumber === task.totalSteps) {
        console.warn(`[AgentExecutor] Task ${task.id}: Model returned empty response (no text, no tool calls)`);
      }

      // Save assistant message
      await agentPersistence.createMessage(task.id, turnNumber, 'assistant', finalAnswer);

      // Set status to awaiting_input (conversation continues)
      await agentPersistence.updateTaskStatus(task.id, 'awaiting_input', {
        result: { answer: finalAnswer },
        totalSteps: stepNumber,
        inputTokens: turnInputTokens,
        outputTokens: turnOutputTokens,
      });

      const cloud = isCloudModel(model);
      const cost = cloud ? estimateCost(model, turnInputTokens, turnOutputTokens) : null;

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
          model,
          modelLocation: cloud ? 'cloud' : 'local',
          estimatedCost: cost ?? undefined,
          routingDecision: options?.routingDecision,
          strategy: options?.strategy,
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
  private async buildSystemPrompt(toolNames: string[], context: AgentUserContext, skillSlug?: string, preSearchContext?: string): Promise<string> {
    const hasSkills = toolNames.includes('load_skill');

    // If pre-search context was provided (search-first pipeline), build a context-aware prompt
    if (preSearchContext) {
      let prompt = `Du bist ein hilfreicher Assistent. Dies ist eine Multi-Turn-Konversation.

Die folgenden Suchergebnisse stammen aus der Wissensdatenbank. Sie sind das EINZIGE Wissen, das dir zur Verfügung steht:

<search_results>
${preSearchContext}
</search_results>

WICHTIGSTE REGEL:
Wenn das gefragte Thema in den Suchergebnissen NICHT vorkommt, antworte: "Zu diesem Thema habe ich keine Dokumente in der Wissensdatenbank gefunden." Versuche NIEMALS, eine Antwort zu erfinden oder Suchergebnisse einem anderen Thema zuzuordnen.

WEITERE REGELN:
- Antworte auf Deutsch
- Nutze AUSSCHLIESSLICH Informationen aus den <search_results> oben
- Zitiere Quellen (Dokumentname, Seitenzahl) wenn du Dokumente nutzt
- Erfinde KEINE Informationen, die nicht in den Suchergebnissen stehen
- Wenn die Suchergebnisse ein anderes Thema behandeln als die Frage, sind sie NICHT relevant

FORMATIERUNG:
- Strukturiere Antworten mit Überschriften (##), Aufzählungen und **Fettdruck** für Schlüsselbegriffe
- Bei Zusammenfassungen: Nummerierte Abschnitte mit klaren Überschriften
- Längere Antworten immer in Abschnitte gliedern`;
      return prompt;
    }

    let prompt = `Du bist ein hilfreicher Assistent mit Zugriff auf Tools. Dies ist eine Multi-Turn-Konversation.

Verfügbare Tools: ${toolNames.join(', ')}

REGELN:
- Antworte auf Deutsch
- Wenn die Frage Unternehmenswissen betrifft (Dokumente, Verträge, Mitarbeiter, interne Prozesse), nutze rag_search
- Bei allgemeinem Wissen (Definitionen, öffentliche Fakten, Erklärungen) kannst du direkt antworten
- Im Zweifel: Nutze rag_search — lieber einmal zu viel suchen als falsch antworten
- Zitiere Quellen (Dokumentname, Seitenzahl) wenn du Dokumente nutzt
- Wenn du keine relevanten Dokumente findest, sage das ehrlich
- Nutze NUR Informationen aus den Tool-Ergebnissen, erfinde nichts dazu

FORMATIERUNG:
- Strukturiere Antworten mit Überschriften (##), Aufzählungen und **Fettdruck** für Schlüsselbegriffe
- Bei Zusammenfassungen: Nummerierte Abschnitte mit klaren Überschriften
- Bei Listen: Bullet Points mit kurzen Erklärungen
- Längere Antworten immer in Abschnitte gliedern`;

    if (hasSkills) {
      let skillSummary = '';
      try {
        const { skillRegistry } = await import('../skills/SkillRegistry.js');
        const { skills } = await skillRegistry.getSkills(
          { userId: context.userId, userRole: context.userRole, department: context.department },
          { limit: 20 }
        );
        const autoSkills = skills.filter(s => !s.disableAutoInvocation);
        if (autoSkills.length > 0) {
          // Truncate descriptions to keep prompt compact for smaller models
          skillSummary = autoSkills
            .map(s => {
              const desc = (s.description || '').split('.')[0] || '(keine Beschreibung)';
              return `- ${s.name} [${s.slug}]: ${desc}`;
            })
            .join('\n');
        }
      } catch {
        // Skills not available yet
      }

      prompt += `

<available_skills>
${skillSummary || '(keine)'}
</available_skills>

Wenn eine Aufgabe zu einem Skill passt: ZUERST load_skill(slug) aufrufen um die vollständigen Instruktionen zu laden, DANN den Instruktionen folgen. Ohne load_skill hast du nur die Kurzbeschreibung — die reicht nicht für gute Ergebnisse.`;
    }

    // If a skill was explicitly invoked via slash-command, inject its instructions directly
    if (skillSlug) {
      try {
        const { skillRegistry } = await import('../skills/SkillRegistry.js');
        const skill = await skillRegistry.getSkillBySlug(
          { userId: context.userId, userRole: context.userRole, department: context.department },
          skillSlug
        );
        if (skill) {
          const content = await skillRegistry.getSkillContent(skill);
          const toolList = content.tools.length > 0
            ? `Empfohlene Tools: ${content.tools.join(', ')}`
            : '';
          prompt += `

AKTIVER SKILL: ${skill.name}
${toolList}

Folge diesen Instruktionen Schritt für Schritt:

${content.body}`;
          console.log(`[AgentExecutor] Skill "${skillSlug}" direkt injiziert (Slash-Command)`);
          return prompt;
        }
      } catch {
        // Skill not found, continue with normal workflow
      }
    }

    prompt += `

WORKFLOW:
1. Passt ein Skill? → load_skill(slug) aufrufen und Instruktionen folgen
2. Unternehmenswissen nötig? → rag_search
3. Allgemeinwissen? → Direkt antworten
4. Quellen zitieren wenn Dokumente genutzt`;

    return prompt;
  }
}

// Singleton
export const agentExecutor = new AgentExecutor();
