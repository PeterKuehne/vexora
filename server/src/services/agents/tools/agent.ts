/**
 * Agent Tool - Spawns a subagent for specialized tasks
 *
 * Follows the Vercel AI SDK subagent pattern:
 * - ToolLoopAgent with isolated context
 * - abortSignal propagation
 * - Only result.text returned to parent (context isolation)
 * - No nesting (subagents cannot spawn sub-subagents)
 */

import { z } from 'zod';
import { ToolLoopAgent, stepCountIs } from 'ai';
import { resolveModel, getProviderOptions } from '../ai-provider.js';
import { toolRegistry } from '../ToolRegistry.js';
import { getSubagent, listSubagents } from '../SubagentLoader.js';
import type { AgentTool, AgentUserContext, ToolResult, ToolExecutionOptions } from '../types.js';

export const agentTool: AgentTool = {
  name: 'agent',
  description: 'Delegiere eine Aufgabe an einen spezialisierten Subagent. Der Subagent arbeitet in eigenem Kontext und gibt eine Zusammenfassung zurueck. Nutze dies fuer tiefgehende Recherchen, umfangreiche Analysen, oder Aufgaben die viele Tool-Aufrufe erfordern.',
  inputSchema: z.object({
    task: z.string().describe('Detaillierte Beschreibung der Aufgabe fuer den Subagent'),
    agentType: z.string().optional().describe('Name des Subagents (z.B. "kb-explorer"). Standard: "kb-explorer"'),
  }),
  parameters: {
    type: 'object',
    required: ['task'],
    properties: {
      task: {
        type: 'string',
        description: 'Detaillierte Beschreibung der Aufgabe fuer den Subagent',
      },
      agentType: {
        type: 'string',
        description: 'Name des Subagents (z.B. "kb-explorer"). Standard: "kb-explorer"',
      },
    },
  },

  async execute(args: Record<string, unknown>, context: AgentUserContext, options?: ToolExecutionOptions): Promise<ToolResult> {
    const task = args.task as string;
    const agentType = (args.agentType as string) || 'kb-explorer';

    if (!task) {
      return { output: 'Fehler: task ist erforderlich.', error: 'missing_task' };
    }

    // Look up subagent definition
    const definition = getSubagent(agentType, context.tenantId);
    if (!definition) {
      const available = listSubagents(context.tenantId).map(a => a.name).join(', ');
      return {
        output: `Subagent "${agentType}" nicht gefunden. Verfuegbare Subagents: ${available || '(keine)'}`,
        error: 'agent_not_found',
      };
    }

    try {
      const startTime = Date.now();

      // Build tools for subagent — filtered to only allowed tools
      // IMPORTANT: 'agent' tool is NOT included (no nesting)
      const subagentTools = toolRegistry.getAISDKTools(
        context,
        definition.tools,
        undefined,
        { strict: true },
      );

      // Create ToolLoopAgent (AI SDK best practice for subagents)
      const subagent = new ToolLoopAgent({
        model: resolveModel('ovh:gpt-oss-120b'),
        instructions: definition.instructions,
        tools: subagentTools,
        stopWhen: stepCountIs(definition.maxSteps),
        temperature: 0.1,
        providerOptions: getProviderOptions('ovh:gpt-oss-120b'),
      });

      // Execute with context isolation — fresh context, only the task as prompt
      const result = await subagent.generate({
        prompt: task,
        abortSignal: options?.abortSignal,
      });

      const durationMs = Date.now() - startTime;
      const inputTokens = result.usage?.inputTokens || 0;
      const outputTokens = result.usage?.outputTokens || 0;
      const totalSteps = result.steps?.length || 0;

      console.log(`[AgentTool] Subagent "${agentType}" completed: ${totalSteps} steps, ${durationMs}ms, ${inputTokens}+${outputTokens} tokens, text=${result.text?.length || 0} chars`);

      // Return the final text. If the subagent hit maxSteps without a text response,
      // extract the last meaningful tool output as fallback.
      let output = result.text || '';
      if (!output && result.steps && result.steps.length > 0) {
        // Collect tool results from the last step as fallback
        const lastResults = result.steps
          .flatMap(s => s.toolResults || [])
          .filter((r: any) => r.result && typeof r.result === 'string' && r.result.length > 50)
          .map((r: any) => r.result as string);

        if (lastResults.length > 0) {
          output = `Der Subagent hat ${totalSteps} Schritte ausgefuehrt. Hier sind die wichtigsten Ergebnisse:\n\n${lastResults.slice(-3).join('\n\n---\n\n')}`;
          console.log(`[AgentTool] Subagent "${agentType}" had no final text — using ${lastResults.length} tool results as fallback`);
        } else {
          output = `Der Subagent hat ${totalSteps} Schritte ausgefuehrt, konnte aber keine Zusammenfassung erstellen.`;
        }
      }

      return {
        output,
        metadata: {
          agentType,
          steps: totalSteps,
          durationMs,
          inputTokens,
          outputTokens,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (options?.abortSignal?.aborted) {
        return { output: 'Subagent wurde abgebrochen.', error: 'aborted' };
      }

      console.error(`[AgentTool] Subagent "${agentType}" failed:`, message);
      return {
        output: `Fehler beim Subagent "${agentType}": ${message}`,
        error: message,
      };
    }
  },
};
