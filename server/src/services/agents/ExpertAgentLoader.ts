/**
 * ExpertAgentLoader - Loads Expert Agent harness definitions and creates tools
 *
 * Expert Agents are the "inner organs" of the Hive Mind. Each Expert Agent
 * is defined as a Markdown+Frontmatter file and gets registered as a tool
 * that the Hive Mind can call via ToolLoopAgent.
 *
 * Reads from:
 * - server/expert-agents/           (built-in, from branch templates)
 * - server/expert-agents/{tenantId}/ (custom, per-tenant)
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';
import { z } from 'zod';
import { ToolLoopAgent, stepCountIs, tool as aiTool } from 'ai';
import type { Tool } from 'ai';
import { resolveModel, getProviderOptions } from './ai-provider.js';
import { toolRegistry } from './ToolRegistry.js';
import type {
  ExpertAgentHarness,
  Guardrail,
  PanelData,
  AgentUserContext,
  AgentSSEEvent,
} from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..', '..');
const BUILTIN_EXPERTS_DIR = join(PROJECT_ROOT, 'server', 'expert-agents');
const CUSTOM_EXPERTS_DIR = join(PROJECT_ROOT, 'server', 'expert-agents');

export type SSEEmitter = (event: AgentSSEEvent) => void;

// ============================================
// Parsing
// ============================================

/**
 * Parse guardrails from frontmatter YAML.
 *
 * Supports two formats:
 *   - { role_check: ['Admin', 'Manager'] }
 *   - { prompt: "Text" }
 *   - Plain string → treated as prompt guardrail
 */
function parseGuardrails(raw: unknown): Guardrail[] {
  if (!Array.isArray(raw)) return [];

  return raw.map(item => {
    if (typeof item === 'string') {
      return { type: 'prompt' as const, value: item };
    }
    if (typeof item === 'object' && item !== null) {
      if ('role_check' in item) {
        const roles = (item as Record<string, unknown>).role_check;
        return {
          type: 'role_check' as const,
          value: Array.isArray(roles) ? roles.map(String) : [String(roles)],
        };
      }
      if ('prompt' in item) {
        return { type: 'prompt' as const, value: String((item as Record<string, unknown>).prompt) };
      }
    }
    return { type: 'prompt' as const, value: String(item) };
  });
}

/**
 * Parse a single Expert Agent harness file (Markdown + YAML frontmatter).
 */
function parseHarnessFile(filePath: string, source: 'builtin' | 'custom'): ExpertAgentHarness | null {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const { data, content } = matter(raw);

    const name = data.name as string;
    if (!name) {
      console.warn(`[ExpertAgentLoader] Skipping ${filePath}: missing 'name' in frontmatter`);
      return null;
    }

    // Tools: accept both YAML array and comma-separated string
    let tools: string[] = [];
    if (Array.isArray(data.tools)) {
      tools = data.tools.map(String);
    } else if (typeof data.tools === 'string') {
      tools = data.tools.split(',').map((t: string) => t.trim()).filter(Boolean);
    }

    return {
      name,
      description: (data.description as string) || '',
      tools,
      model: (data.model as string) || 'gpt-oss-120b',
      maxSteps: (data.maxSteps as number) || 15,
      guardrails: parseGuardrails(data.guardrails),
      instructions: content.trim(),
      filePath,
      source,
    };
  } catch (error) {
    console.warn(`[ExpertAgentLoader] Failed to parse ${filePath}:`, error);
    return null;
  }
}

/**
 * Scan a directory for .md harness files.
 */
function scanDirectory(dirPath: string, source: 'builtin' | 'custom'): ExpertAgentHarness[] {
  if (!existsSync(dirPath)) return [];

  const results: ExpertAgentHarness[] = [];
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        const harness = parseHarnessFile(join(dirPath, entry.name), source);
        if (harness) results.push(harness);
      }
    }
  } catch (error) {
    console.warn(`[ExpertAgentLoader] Failed to scan ${dirPath}:`, error);
  }
  return results;
}

// ============================================
// Cache
// ============================================

let cachedBuiltinHarnesses: ExpertAgentHarness[] | null = null;

// ============================================
// Public API: Loading
// ============================================

/**
 * Load all Expert Agent harness definitions (built-in + custom for tenant).
 */
export function loadExpertAgents(tenantId?: string): ExpertAgentHarness[] {
  // Built-in (cached)
  if (!cachedBuiltinHarnesses) {
    cachedBuiltinHarnesses = scanDirectory(BUILTIN_EXPERTS_DIR, 'builtin');
    console.log(`[ExpertAgentLoader] Loaded ${cachedBuiltinHarnesses.length} built-in expert agent(s)`);
  }

  // Custom for tenant (fresh each time)
  const tenant = tenantId || 'default';
  const customDir = join(CUSTOM_EXPERTS_DIR, tenant);
  const customHarnesses = scanDirectory(customDir, 'custom');

  // Merge: custom overrides built-in by name
  const merged = new Map<string, ExpertAgentHarness>();
  for (const h of cachedBuiltinHarnesses) merged.set(h.name, h);
  for (const h of customHarnesses) merged.set(h.name, h);

  return Array.from(merged.values());
}

/**
 * Get a specific Expert Agent by name.
 */
export function getExpertAgent(name: string, tenantId?: string): ExpertAgentHarness | undefined {
  return loadExpertAgents(tenantId).find(h => h.name === name);
}

/**
 * List all available Expert Agents (name + description for prompts).
 */
export function listExpertAgents(tenantId?: string): Array<{ name: string; description: string }> {
  return loadExpertAgents(tenantId).map(h => ({ name: h.name, description: h.description }));
}

/**
 * Clear cache (e.g. after creating a new Expert Agent at runtime).
 */
export function clearExpertAgentCache(): void {
  cachedBuiltinHarnesses = null;
}

// ============================================
// Tool Factory
// ============================================

/**
 * Build the Expert Agent's system prompt from harness + guardrails.
 */
function buildExpertInstructions(harness: ExpertAgentHarness): string {
  const promptGuardrails = harness.guardrails
    .filter(g => g.type === 'prompt')
    .map(g => `- ${g.value}`)
    .join('\n');

  let instructions = harness.instructions;

  if (promptGuardrails) {
    instructions += `\n\n## Guardrails\n${promptGuardrails}`;
  }

  // Panel data + tool usage instruction
  instructions += `\n\n## Antwortformat
- Wenn du eine Rueckfrage hast, beginne mit "RUECKFRAGE:"
- Liefere strukturierte Daten als JSON in einem \`\`\`panels Code-Block wenn sinnvoll

## Tool-Nutzung
- Nutze rag_search NUR fuer Dokumente und Unternehmenswissen (Vertraege, Richtlinien, Handbuecher)
- Nutze rag_search NICHT fuer Mitarbeiter, Kunden, Einsaetze oder andere Stammdaten — dafuer gibt es die sama_* Tools
- Suche NIEMALS nach UUIDs oder IDs in rag_search`;

  return instructions;
}

/**
 * Check role_check guardrails against user context.
 * Returns error message if access denied, null if allowed.
 */
function checkRoleGuardrails(harness: ExpertAgentHarness, context: AgentUserContext): string | null {
  const roleChecks = harness.guardrails.filter(g => g.type === 'role_check');
  if (roleChecks.length === 0) return null;

  for (const check of roleChecks) {
    const allowedRoles = check.value as string[];
    if (!allowedRoles.includes(context.userRole)) {
      return `Zugriff verweigert: ${harness.name} erfordert Rolle ${allowedRoles.join(' oder ')}. Aktuelle Rolle: ${context.userRole}`;
    }
  }
  return null;
}

/**
 * Extract panel data from the agent's text response.
 * Looks for ```panels ... ``` code blocks with JSON content.
 */
function extractPanels(text: string): { cleanText: string; panels: PanelData[] } {
  const panels: PanelData[] = [];
  const cleanText = text.replace(/```panels\s*\n([\s\S]*?)```/g, (_match, json) => {
    try {
      const parsed = JSON.parse(json.trim());
      if (Array.isArray(parsed)) {
        panels.push(...parsed);
      } else {
        panels.push(parsed);
      }
    } catch {
      // Not valid JSON — leave as text
      return _match;
    }
    return '';
  }).trim();

  return { cleanText, panels };
}

/**
 * Create an AI SDK Tool that wraps an Expert Agent as a ToolLoopAgent.
 *
 * Created dynamically per request because it needs:
 * - emitSSE callback (per-request SSE stream)
 * - context (per-request user context for guardrails + tool filtering)
 *
 * Returns a proper AI SDK Tool (via tool() helper) that can be added
 * directly to the Hive Mind's tool set.
 */
export function createExpertAgentTool(
  harness: ExpertAgentHarness,
  context: AgentUserContext,
  emitSSE: SSEEmitter,
): Tool {
  return aiTool({
    description: harness.description,
    inputSchema: z.object({
      task: z.string().describe('Die Aufgabe fuer diesen Expert Agent'),
    }),

    async execute({ task }, { abortSignal }) {
      // 1. Role-check guardrails
      const accessError = checkRoleGuardrails(harness, context);
      if (accessError) {
        return accessError;
      }

      const startTime = Date.now();

      // SSE: expert:start
      emitSSE({
        event: 'expert:start',
        data: {
          taskId: context.taskId || '',
          expertName: harness.name,
          expertTask: task.substring(0, 200),
        },
      });

      try {
        // 2. Build tools — filtered to harness whitelist
        const expertTools = toolRegistry.getAISDKTools(
          context,
          harness.tools,
          undefined,
          { strict: true },
        );

        // 3. Build instructions from harness + guardrails
        const instructions = buildExpertInstructions(harness);

        // 4. Create ToolLoopAgent (isolated context)
        const agent = new ToolLoopAgent({
          model: resolveModel(harness.model),
          instructions,
          tools: expertTools,
          stopWhen: stepCountIs(harness.maxSteps),
          temperature: 0.1,
          providerOptions: getProviderOptions(harness.model),
        });

        // 5. Execute with context isolation
        const result = await agent.generate({
          prompt: task,
          abortSignal,
        });

        const durationMs = Date.now() - startTime;
        const inputTokens = result.usage?.inputTokens || 0;
        const outputTokens = result.usage?.outputTokens || 0;
        const totalSteps = result.steps?.length || 0;

        console.log(`[ExpertAgent] ${harness.name} completed: ${totalSteps} steps, ${durationMs}ms, ${inputTokens}+${outputTokens} tokens`);

        // 6. Extract text + panels
        let output = result.text || '';
        if (!output && result.steps && result.steps.length > 0) {
          const lastResults = result.steps
            .flatMap(s => s.toolResults || [])
            .filter((r: any) => r.result && typeof r.result === 'string' && r.result.length > 50)
            .map((r: any) => r.result as string);

          output = lastResults.length > 0
            ? `Der Expert Agent hat ${totalSteps} Schritte ausgefuehrt:\n\n${lastResults.slice(-3).join('\n\n---\n\n')}`
            : `Der Expert Agent hat ${totalSteps} Schritte ausgefuehrt, konnte aber keine Zusammenfassung erstellen.`;
        }

        const { cleanText, panels } = extractPanels(output);

        // SSE: expert:complete (with panels)
        emitSSE({
          event: 'expert:complete',
          data: {
            taskId: context.taskId || '',
            expertName: harness.name,
            duration: durationMs,
            panels: panels.length > 0 ? panels : undefined,
            inputTokens,
            outputTokens,
          },
        });

        return cleanText || output;
      } catch (error) {
        const durationMs = Date.now() - startTime;
        const message = error instanceof Error ? error.message : String(error);

        if (abortSignal?.aborted) {
          return `Expert Agent ${harness.name} wurde abgebrochen.`;
        }

        console.error(`[ExpertAgent] ${harness.name} failed:`, message);

        emitSSE({
          event: 'expert:complete',
          data: {
            taskId: context.taskId || '',
            expertName: harness.name,
            duration: durationMs,
          },
        });

        return `Fehler beim Expert Agent "${harness.name}": ${message}`;
      }
    },
  });
}
