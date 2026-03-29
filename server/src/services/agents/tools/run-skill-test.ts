/**
 * Compare Skill Tool — Parallel A/B Testing
 *
 * Spawns two ToolLoopAgent subagents simultaneously:
 * - Subagent A: WITH skill instructions
 * - Subagent B: WITHOUT skill (baseline)
 *
 * Returns a structured comparison as Markdown.
 * Replaces the old run_skill_test (single-run) tool.
 */

import { z } from 'zod';
import { ToolLoopAgent, stepCountIs } from 'ai';
import { resolveModel, getProviderOptions } from '../ai-provider.js';
import { toolRegistry } from '../ToolRegistry.js';
import { skillRegistry } from '../../skills/SkillRegistry.js';
import type { AgentTool, AgentUserContext, ToolResult, ToolExecutionOptions } from '../types.js';

interface SubagentResult {
  text: string;
  steps: number;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  toolsUsed: string[];
}

const BASE_SYSTEM_PROMPT = `Du bist ein KI-Assistent der Aufgaben mit Hilfe von Tools erledigt.

REGELN:
- Nutze rag_search um die Wissensdatenbank zu durchsuchen
- Antworte NUR basierend auf Tool-Ergebnissen
- Wenn keine Ergebnisse gefunden werden, sage das ehrlich
- Antworte auf Deutsch
- Zitiere Quellen (Dokumentname, Seitenzahl)

WICHTIG: Du MUSST am Ende eine ausfuehrliche Antwort als Text schreiben.
Deine letzte Antwort muss IMMER Text sein — KEIN Tool-Aufruf.`;

async function runSubagent(
  prompt: string,
  systemPrompt: string,
  tools: Record<string, any>,
  maxSteps: number,
): Promise<SubagentResult> {
  const startTime = Date.now();

  const subagent = new ToolLoopAgent({
    model: resolveModel('ovh:gpt-oss-120b'),
    instructions: systemPrompt,
    tools,
    stopWhen: stepCountIs(maxSteps),
    temperature: 0.1,
    maxOutputTokens: 4096,
    providerOptions: getProviderOptions('ovh:gpt-oss-120b'),
  });

  const result = await subagent.generate({ prompt });

  const durationMs = Date.now() - startTime;
  const toolsUsed: string[] = [];
  for (const step of result.steps || []) {
    for (const tc of step.toolCalls || []) {
      if (!toolsUsed.includes(tc.toolName)) {
        toolsUsed.push(tc.toolName);
      }
    }
  }

  // Extract text, with fallback to last tool results
  let text = result.text || '';
  if (!text && result.steps && result.steps.length > 0) {
    const lastResults = result.steps
      .flatMap(s => s.toolResults || [])
      .filter((r: any) => r.result && typeof r.result === 'string' && r.result.length > 50)
      .map((r: any) => r.result as string);
    if (lastResults.length > 0) {
      text = lastResults.slice(-2).join('\n\n---\n\n');
    }
  }

  return {
    text: text || '(Keine Antwort generiert)',
    steps: result.steps?.length || 0,
    inputTokens: result.usage?.inputTokens || 0,
    outputTokens: result.usage?.outputTokens || 0,
    durationMs,
    toolsUsed,
  };
}

function formatComparison(
  prompt: string,
  skillName: string,
  skillSlug: string,
  withSkill: SubagentResult,
  baseline: SubagentResult,
): string {
  const stepsDelta = withSkill.steps - baseline.steps;
  const durationDelta = withSkill.durationMs - baseline.durationMs;
  const totalTokensA = withSkill.inputTokens + withSkill.outputTokens;
  const totalTokensB = baseline.inputTokens + baseline.outputTokens;
  const tokensDelta = totalTokensA - totalTokensB;

  const formatDelta = (d: number, unit: string) => {
    if (d === 0) return '±0';
    return d > 0 ? `+${d}${unit}` : `${d}${unit}`;
  };

  const formatTokens = (t: number) => t >= 1000 ? `${(t / 1000).toFixed(1)}K` : String(t);

  // Auto-assessment
  const assessments: string[] = [];
  if (withSkill.toolsUsed.length > baseline.toolsUsed.length) {
    assessments.push(`Skill nutzt mehr Tools (${withSkill.toolsUsed.join(', ')} vs. ${baseline.toolsUsed.join(', ')})`);
  }
  if (withSkill.text.length > baseline.text.length * 1.3) {
    assessments.push('Skill liefert ausfuehrlichere Antwort');
  }
  if (totalTokensA > totalTokensB * 1.5) {
    assessments.push(`Skill verbraucht ${Math.round((totalTokensA / totalTokensB - 1) * 100)}% mehr Tokens`);
  }
  if (withSkill.text.includes('Quelle') || withSkill.text.includes('Dokument:') || withSkill.text.includes('Seite')) {
    if (!baseline.text.includes('Quelle') && !baseline.text.includes('Dokument:')) {
      assessments.push('Skill zitiert Quellen, Baseline nicht');
    }
  }
  if (withSkill.text === '(Keine Antwort generiert)') {
    assessments.push('PROBLEM: Skill hat keine Antwort generiert');
  }
  if (baseline.text.length > withSkill.text.length * 1.5 && withSkill.text !== '(Keine Antwort generiert)') {
    assessments.push('Baseline liefert ausfuehrlichere Antwort — Skill-Instruktionen pruefen');
  }

  const assessmentText = assessments.length > 0
    ? assessments.map(a => `- ${a}`).join('\n')
    : '- Keine signifikanten Unterschiede erkannt';

  return `## A/B Vergleich: "${skillName}" (${skillSlug})

**Test-Prompt:** "${prompt}"

| Metrik | MIT Skill | Baseline (ohne) | Delta |
|--------|-----------|-----------------|-------|
| Steps | ${withSkill.steps} | ${baseline.steps} | ${formatDelta(stepsDelta, '')} |
| Dauer | ${(withSkill.durationMs / 1000).toFixed(1)}s | ${(baseline.durationMs / 1000).toFixed(1)}s | ${formatDelta(Math.round(durationDelta / 1000), 's')} |
| Tokens | ${formatTokens(totalTokensA)} | ${formatTokens(totalTokensB)} | ${formatDelta(tokensDelta, '')} |
| Tools | ${withSkill.toolsUsed.join(', ') || '(keine)'} | ${baseline.toolsUsed.join(', ') || '(keine)'} | |

### Antwort MIT Skill:
${withSkill.text.substring(0, 2000)}${withSkill.text.length > 2000 ? '\n\n(gekuerzt...)' : ''}

### Antwort OHNE Skill (Baseline):
${baseline.text.substring(0, 2000)}${baseline.text.length > 2000 ? '\n\n(gekuerzt...)' : ''}

### Auto-Bewertung:
${assessmentText}`;
}

export const compareSkillTool: AgentTool = {
  name: 'compare_skill',
  skillGated: 'skill-creator',
  description: 'Testet einen Skill mit A/B-Vergleich: fuehrt parallel zwei Subagents aus (MIT Skill vs. OHNE Skill) und liefert einen strukturierten Vergleich. Nutze dieses Tool nach dem Erstellen oder Aktualisieren eines Skills.',
  inputSchema: z.object({
    prompt: z.string().describe('Realistischer Test-Prompt (was ein echter User sagen wuerde)'),
    skill_slug: z.string().describe('Slug des Skills der getestet wird'),
    max_steps: z.number().optional().describe('Max Steps pro Subagent (default: 8)'),
  }),
  parameters: {
    type: 'object',
    required: ['prompt', 'skill_slug'],
    properties: {
      prompt: { type: 'string', description: 'Realistischer Test-Prompt' },
      skill_slug: { type: 'string', description: 'Slug des Skills' },
      max_steps: { type: 'number', description: 'Max Steps pro Subagent (default: 8)' },
    },
  },

  async execute(args: Record<string, unknown>, context: AgentUserContext, options?: ToolExecutionOptions): Promise<ToolResult> {
    const prompt = args.prompt as string;
    const skillSlug = args.skill_slug as string;
    const maxSteps = (args.max_steps as number) || 8;

    if (!prompt || !skillSlug) {
      return { output: 'Fehler: prompt und skill_slug sind erforderlich.', error: 'missing_fields' };
    }

    // Load skill
    const skill = await skillRegistry.getSkillBySlug(
      { userId: context.userId, userRole: context.userRole, department: context.department },
      skillSlug,
    );

    if (!skill) {
      return { output: `Skill "${skillSlug}" nicht gefunden.`, error: 'skill_not_found' };
    }

    const content = await skillRegistry.getSkillContent(skill);
    const skillTools = content.tools;

    // Build system prompts
    const withSkillPrompt = `${BASE_SYSTEM_PROMPT}

=== SKILL: ${skill.name} ===
Empfohlene Tools: ${content.tools.join(', ')}

${content.body}
=== ENDE SKILL ===

Befolge die Skill-Instruktionen oben um die Aufgabe zu loesen.`;

    const baselinePrompt = BASE_SYSTEM_PROMPT;

    // Build tools for subagents
    const subagentToolNames = skillTools.length > 0
      ? skillTools
      : ['rag_search', 'read_chunk'];
    const subagentTools = toolRegistry.getAISDKTools(context, subagentToolNames, undefined, { strict: true });

    try {
      console.log(`[CompareSkill] Starting A/B test for "${skillSlug}" with prompt: "${prompt.substring(0, 60)}..."`);

      // Run both subagents in parallel
      const [withSkill, baseline] = await Promise.all([
        runSubagent(prompt, withSkillPrompt, subagentTools, maxSteps),
        runSubagent(prompt, baselinePrompt, subagentTools, maxSteps),
      ]);

      console.log(`[CompareSkill] A/B test complete: with-skill=${withSkill.steps} steps/${withSkill.durationMs}ms, baseline=${baseline.steps} steps/${baseline.durationMs}ms`);

      const comparison = formatComparison(prompt, skill.name, skillSlug, withSkill, baseline);

      return {
        output: comparison,
        metadata: {
          skillSlug,
          skillName: skill.name,
          withSkill: {
            steps: withSkill.steps,
            tokens: withSkill.inputTokens + withSkill.outputTokens,
            durationMs: withSkill.durationMs,
            toolsUsed: withSkill.toolsUsed,
            hasAnswer: withSkill.text !== '(Keine Antwort generiert)',
          },
          baseline: {
            steps: baseline.steps,
            tokens: baseline.inputTokens + baseline.outputTokens,
            durationMs: baseline.durationMs,
            toolsUsed: baseline.toolsUsed,
            hasAnswer: baseline.text !== '(Keine Antwort generiert)',
          },
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        output: `Fehler beim A/B-Test: ${message}`,
        error: message,
      };
    }
  },
};
