/**
 * Run Skill Test Tool - Subagent-based skill testing
 *
 * Spawns a ToolLoopAgent subagent to test a skill.
 * Can run with or without a skill loaded, enabling A/B comparison.
 */

import { z } from 'zod';
import { ToolLoopAgent, stepCountIs } from 'ai';
import { resolveModel, getProviderOptions } from '../ai-provider.js';
import { toolRegistry } from '../ToolRegistry.js';
import { skillRegistry } from '../../skills/SkillRegistry.js';
import type { AgentTool, AgentUserContext, ToolResult } from '../types.js';

export const runSkillTestTool: AgentTool = {
  name: 'run_skill_test',
  skillGated: 'skill-creator',
  description: 'Testet einen Skill indem ein unabhängiger Sub-Agent gestartet wird der einen Test-Prompt mit (oder ohne) dem Skill ausführt. Nutze dieses Tool um Skills zu evaluieren und zu vergleichen.',
  inputSchema: z.object({
    prompt: z.string().describe('Der Test-Prompt den der Sub-Agent ausführen soll (eine realistische User-Anfrage)'),
    skill_slug: z.string().optional().describe('Slug des Skills der getestet werden soll. Wenn leer, wird der Test OHNE Skill ausgeführt (Baseline).'),
    model: z.string().optional().describe('Model für den Sub-Agent (default: qwen3:8b)'),
    max_steps: z.string().optional().describe('Maximale Schritte für den Sub-Agent (default: 8)'),
  }),
  parameters: {
    type: 'object',
    required: ['prompt'],
    properties: {
      prompt: {
        type: 'string',
        description: 'Der Test-Prompt den der Sub-Agent ausführen soll (eine realistische User-Anfrage)',
      },
      skill_slug: {
        type: 'string',
        description: 'Slug des Skills der getestet werden soll. Wenn leer, wird der Test OHNE Skill ausgeführt (Baseline).',
      },
      model: {
        type: 'string',
        description: 'Model für den Sub-Agent (default: qwen3:8b)',
      },
      max_steps: {
        type: 'string',
        description: 'Maximale Schritte für den Sub-Agent (default: 8)',
      },
    },
  },

  async execute(args: Record<string, unknown>, context: AgentUserContext): Promise<ToolResult> {
    const prompt = args.prompt as string;
    const skillSlug = args.skill_slug as string | undefined;
    const model = (args.model as string) || 'ovh:gpt-oss-120b';
    const maxSteps = parseInt((args.max_steps as string) || '8', 10);

    if (!prompt) {
      return { output: 'Fehler: prompt ist erforderlich.', error: 'missing prompt' };
    }

    try {
      const startTime = Date.now();

      // Build system prompt for the subagent
      let systemPrompt = `Du bist ein KI-Assistent der Aufgaben mit Hilfe von Tools erledigt.

REGELN:
- Nutze rag_search für jede Frage um die Wissensdatenbank zu durchsuchen
- Antworte NUR basierend auf Tool-Ergebnissen
- Wenn keine Ergebnisse gefunden werden, sage das ehrlich
- Antworte auf Deutsch
- Zitiere Quellen (Dokumentname, Seitenzahl)`;

      // If a skill slug is provided, load and inject the skill
      let skillName = '(kein Skill)';
      let skillTools: string[] = [];
      if (skillSlug) {
        const skill = await skillRegistry.getSkillBySlug(
          { userId: context.userId, userRole: context.userRole, department: context.department },
          skillSlug,
        );

        if (!skill) {
          return {
            output: `Skill "${skillSlug}" nicht gefunden.`,
            error: 'skill not found',
          };
        }

        skillName = skill.name;

        // Resolve content from SKILL.md or DB definition
        const content = await skillRegistry.getSkillContent(skill);
        skillTools = content.tools;

        // Inject skill instructions into system prompt
        systemPrompt += `

=== SKILL: ${skill.name} ===
Empfohlene Tools: ${content.tools.join(', ')}

${content.body}
=== ENDE SKILL ===

Befolge die Skill-Instruktionen oben um die Aufgabe zu lösen.`;
      }

      // Get tools for the subagent — only the working tools, not meta tools
      const subagentToolNames = skillTools.length > 0
        ? skillTools
        : ['rag_search', 'read_chunk'];

      // Filter to tools that exist and are available to this user
      const allTools = toolRegistry.getAISDKTools(context, subagentToolNames);

      // Run the subagent (ToolLoopAgent — AI SDK best practice)
      const subagent = new ToolLoopAgent({
        model: resolveModel(model),
        instructions: systemPrompt,
        tools: allTools,
        stopWhen: stepCountIs(maxSteps),
        temperature: 0.1,
        maxOutputTokens: 4096,
        providerOptions: getProviderOptions(model),
      });

      const result = await subagent.generate({ prompt });

      const durationMs = Date.now() - startTime;
      const inputTokens = result.usage?.inputTokens || 0;
      const outputTokens = result.usage?.outputTokens || 0;
      const totalSteps = result.steps?.length || 0;

      // Collect tool usage info
      const toolsUsed: string[] = [];
      for (const step of result.steps || []) {
        for (const tc of step.toolCalls || []) {
          if (!toolsUsed.includes(tc.toolName)) {
            toolsUsed.push(tc.toolName);
          }
        }
      }

      // Format output
      const output = [
        `## Test-Ergebnis: ${skillSlug ? `mit Skill "${skillName}"` : 'OHNE Skill (Baseline)'}`,
        '',
        `**Prompt:** ${prompt}`,
        `**Model:** ${model}`,
        `**Dauer:** ${(durationMs / 1000).toFixed(1)}s`,
        `**Steps:** ${totalSteps}`,
        `**Tokens:** ${inputTokens} input, ${outputTokens} output`,
        `**Tools genutzt:** ${toolsUsed.length > 0 ? toolsUsed.join(', ') : '(keine)'}`,
        '',
        '### Antwort des Sub-Agenten:',
        '',
        result.text || '(keine Antwort generiert)',
      ].join('\n');

      return {
        output,
        metadata: {
          skillSlug: skillSlug || null,
          skillName,
          model,
          durationMs,
          totalSteps,
          inputTokens,
          outputTokens,
          toolsUsed,
          hasAnswer: !!result.text,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        output: `Fehler beim Skill-Test: ${message}`,
        error: message,
      };
    }
  },
};
