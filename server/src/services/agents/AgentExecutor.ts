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
import { loadExpertAgents, createExpertAgentTool } from './ExpertAgentLoader.js';
import { memoryService } from '../memory/index.js';
import type {
  AgentUserContext,
  AgentSSEEvent,
  AgentConfig,
  AgentTask,
  ExpertAgentHarness,
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
      routingDecision?: string;
      skillSlug?: string;
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
      // Enable strict mode for cloud providers (ensures valid tool-call parameters)
      const useStrictTools = isCloudModel(model);
      const tools = toolRegistry.getAISDKTools(toolContext, options?.allowedTools, loadedSkills, { strict: useStrictTools });

      // Load Expert Agent harnesses and create dynamic tools for the Hive Mind
      const expertAgents = loadExpertAgents(context.tenantId);
      const expertAgentNames: string[] = [];
      for (const harness of expertAgents) {
        tools[harness.name] = createExpertAgentTool(harness, toolContext, emitSSE);
        expertAgentNames.push(harness.name);
      }

      // Remove domain-specific tools from Hive Mind when Expert Agents exist.
      // These tools are only accessible through Expert Agents now.
      // Hive Mind keeps: rag_search, send_notification, list_skills, load_skill, agent
      // (plus skill-gated tools like create_skill which are unlocked via load_skill)
      if (expertAgentNames.length > 0) {
        const expertOnlyTools = new Set(['graph_query', 'read_chunk', 'sql_query']);
        const removedTools: string[] = [];
        for (const name of Object.keys(tools)) {
          if (name.startsWith('sama_') || expertOnlyTools.has(name)) {
            delete tools[name];
            removedTools.push(name);
          }
        }
        console.log(`[AgentExecutor] Expert Agents registered: ${expertAgentNames.join(', ')}`);
        if (removedTools.length > 0) {
          console.log(`[AgentExecutor] ${removedTools.length} tools moved to Expert Agents (removed from Hive Mind)`);
        }
      }

      const toolNames = Object.keys(tools);

      // Build system prompt with memory context (with optional skill injection from slash-command)
      const instructions = options?.systemPrompt || await this.buildSystemPrompt(toolNames, toolContext, task.query, options?.skillSlug, expertAgents);

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

      // Create a ToolLoopAgent for this turn
      const agent = new ToolLoopAgent({
        model: resolveModel(model),
        instructions,
        tools,
        stopWhen: stepCountIs(this.config.maxIterations),
        temperature: 0.1,
        maxOutputTokens: 4096,
        providerOptions: getProviderOptions(model),

        // Step 0 on first turn: force Expert Agent delegation before anything else.
        // When Expert Agents exist, only they + load_skill are available on step 0
        // (rag_search becomes available from step 1 onwards for follow-up questions).
        // Follow-up turns and later steps: model decides freely.
        prepareStep: ({ stepNumber }) => {
          if (stepNumber === 0 && turnNumber === 1) {
            const firstStepTools = expertAgentNames.length > 0
              ? [...expertAgentNames, 'load_skill', 'list_skills']
              : ['rag_search', 'load_skill', 'list_skills', 'agent'];
            return {
              toolChoice: 'required' as const,
              activeTools: firstStepTools,
            };
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

      // Non-blocking memory writes (Hindsight)
      if (memoryService.isAvailable) {
        const conversationText = `User: ${task.query}\nAssistant: ${finalAnswer}`;
        memoryService.retainUserMemory(context.userId, conversationText, task.conversationId);
      }

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
          strategy: 'cloud-only',
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
   * Build the Hive Mind system prompt.
   *
   * The Hive Mind is the central intelligence — it delegates to Expert Agents
   * for domain-specific tasks and synthesizes results into a unified answer.
   *
   * Memory injection via Hindsight: User Memory + Hive Mind Memory recalled per query.
   */
  private async buildSystemPrompt(toolNames: string[], context: AgentUserContext, query: string, skillSlug?: string, expertAgents?: ExpertAgentHarness[]): Promise<string> {
    const hasSkills = toolNames.includes('load_skill');
    const hasExpertAgents = expertAgents && expertAgents.length > 0;

    // --- Core Identity ---
    let prompt = `Du bist der Hive Mind — das zentrale Nervensystem des Unternehmens.
KI-Agents und menschliche Mitarbeiter bilden ein gemeinsames Bewusstsein. Du koordinierst alles.

## Deine Rolle
- Verstehe was der User braucht
- Delegiere an die richtigen Expert Agents fuer domain-spezifische Aufgaben
- Fuehre Ergebnisse zu einer ganzheitlichen Antwort zusammen
- Erkenne Zusammenhaenge zwischen verschiedenen Domains
- Wenn ein Expert Agent eine Rueckfrage hat, stelle sie dem User
- Antworte immer auf Deutsch`;

    // --- Expert Agents ---
    if (hasExpertAgents) {
      const expertSummary = expertAgents
        .map(a => `- **${a.name}**: ${a.description}`)
        .join('\n');

      prompt += `

## Verfuegbare Expert Agents
${expertSummary}

### Delegations-Regeln
- IMMER Expert Agents nutzen wenn die Frage Mitarbeiter, Kunden, Einsaetze, Rechnungen, Zahlungen oder andere Unternehmensdaten betrifft
- "Wie ist die Lage bei [Kunde]?" → hr-expert UND accounting-expert parallel aufrufen
- "Zeige mir [Mitarbeiter/Einsaetze/Kunden]" → hr-expert aufrufen
- "Zeige mir [Rechnungen/Zahlungen/Umsatz]" → accounting-expert aufrufen
- Domain-uebergreifende Fragen → mehrere Expert Agents parallel aufrufen
- Formuliere EINE zusammenhaengende Antwort, keine Einzelergebnisse
- Erkenne Zusammenhaenge (z.B. offene Rechnungen + geplante Einsaetze = Risiko)
- Wenn ein Expert Agent "RUECKFRAGE:" zurueckgibt → stelle diese Frage an den User
- rag_search nur fuer Fragen zu Dokumenten, Vertraegen, Richtlinien — NICHT fuer operative Daten`;
    }

    // --- Skills ---
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

## Verfuegbare Skills
${skillSummary || '(keine)'}

Wenn eine Aufgabe zu einem Skill passt: ZUERST load_skill(slug) aufrufen, DANN den Instruktionen folgen.`;
    }

    // --- Slash-command skill injection (early return) ---
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

## AKTIVER SKILL: ${skill.name}
${toolList}

Folge diesen Instruktionen Schritt fuer Schritt:

${content.body}`;
          console.log(`[AgentExecutor] Skill "${skillSlug}" direkt injiziert (Slash-Command)`);
          return prompt;
        }
      } catch {
        // Skill not found, continue with normal workflow
      }
    }

    // --- Legacy Subagents (for kb-explorer, skill-*) ---
    if (toolNames.includes('agent')) {
      let agentSummary = '';
      try {
        const { listSubagents } = await import('./SubagentLoader.js');
        const agents = listSubagents(context.tenantId);
        if (agents.length > 0) {
          agentSummary = agents
            .map(a => `- ${a.name}: ${a.description.split('.')[0] || '(keine Beschreibung)'}`)
            .join('\n');
        }
      } catch {
        // Subagents not available
      }

      if (agentSummary) {
        prompt += `

## Verfuegbare Subagents (fuer Recherche)
${agentSummary}

Nutze agent(agentType="kb-explorer") fuer tiefgehende Recherchen die viele Suchdurchlaeufe erfordern.`;
      }
    }

    // --- Memory (Hindsight) ---
    if (memoryService.isAvailable) {
      try {
        const { userMemory, hiveMindMemory } = await memoryService.loadHiveMindContext(
          query, context.userId, context.tenantId
        );

        if (userMemory) {
          prompt += `\n\n## Ueber den User\nBekannte Praeferenzen und Feedback:\n${userMemory}`;
        }
        if (hiveMindMemory) {
          prompt += `\n\n## Gelerntes Unternehmenswissen\n${hiveMindMemory}`;
        }
      } catch (error) {
        // Memory recall failure is non-critical
        console.warn(`[AgentExecutor] Memory recall failed (non-critical): ${error}`);
      }
    }

    // --- Workflow ---
    prompt += `

## Regeln
- Nutze NUR Informationen aus den Tool-Ergebnissen, erfinde nichts dazu
- Zitiere Quellen (Dokumentname, Seitenzahl) wenn du Dokumente nutzt
- Wenn du keine relevanten Informationen findest, sage das ehrlich
- Strukturiere Antworten mit Ueberschriften (##), Aufzaehlungen und **Fettdruck**

## Workflow (in dieser Reihenfolge pruefen)
1. Betrifft die Frage Mitarbeiter, Kunden, Einsaetze, Rechnungen oder andere operative Daten? → Expert Agent aufrufen${hasExpertAgents ? ' (' + expertAgents.map(a => a.name).join(', ') + ')' : ''}. Bei mehreren Domains: mehrere Expert Agents PARALLEL aufrufen.
2. Betrifft die Frage Dokumente, Vertraege oder Richtlinien? → rag_search direkt
3. Passt ein Skill? → load_skill(slug) aufrufen
4. Allgemeinwissen? → Direkt antworten`;

    return prompt;
  }
}

// Singleton
export const agentExecutor = new AgentExecutor();
