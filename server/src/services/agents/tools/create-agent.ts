/**
 * Create Agent Tool - Creates a new subagent definition as MD file
 *
 * Skill-gated: only available after load_skill('agent-creator').
 * Writes a Markdown file with YAML frontmatter to server/user-agents/{tenant}/.
 */

import { z } from 'zod';
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { clearSubagentCache, getSubagent } from '../SubagentLoader.js';
import type { AgentTool, AgentUserContext, ToolResult } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..', '..', '..');
const USER_AGENTS_DIR = join(PROJECT_ROOT, 'server', 'user-agents');

// Tools that subagents are NOT allowed to use (meta-tools, nesting prevention)
const FORBIDDEN_TOOLS = new Set([
  'agent', 'create_agent', 'list_agents',
  'create_skill', 'update_skill', 'load_skill', 'list_skills', 'run_skill_test',
  'send_notification',
]);

export const createAgentTool: AgentTool = {
  name: 'create_agent',
  skillGated: 'agent-creator',
  description: 'Erstellt einen neuen Subagent als Markdown-Datei. Der Agent ist sofort nutzbar.',
  inputSchema: z.object({
    name: z.string().describe('Agent-Name in kebab-case (z.B. "vertrag-prufer")'),
    description: z.string().describe('Beschreibung: Was der Agent tut und WANN er genutzt werden soll'),
    tools: z.string().describe('Komma-getrennte Tool-Liste (z.B. "rag_search, read_chunk")'),
    instructions: z.string().describe('Vollstaendige Markdown-Instruktionen fuer den Agent'),
    maxSteps: z.number().optional().describe('Maximale Schritte (default: 10)'),
  }),
  parameters: {
    type: 'object',
    required: ['name', 'description', 'tools', 'instructions'],
    properties: {
      name: { type: 'string', description: 'Agent-Name in kebab-case' },
      description: { type: 'string', description: 'Beschreibung + Trigger' },
      tools: { type: 'string', description: 'Komma-getrennte Tool-Liste' },
      instructions: { type: 'string', description: 'Markdown-Instruktionen' },
      maxSteps: { type: 'number', description: 'Max Steps (default: 10)' },
    },
  },

  async execute(args: Record<string, unknown>, context: AgentUserContext): Promise<ToolResult> {
    try {
      const name = (args.name as string).trim().toLowerCase().replace(/\s+/g, '-');
      const description = args.description as string;
      const toolsRaw = args.tools as string;
      const instructions = args.instructions as string;
      const maxSteps = (args.maxSteps as number) || 10;

      if (!name || !description || !toolsRaw || !instructions) {
        return { output: 'Fehler: name, description, tools und instructions sind erforderlich.', error: 'missing_fields' };
      }

      // Validate name
      if (!/^[a-z0-9-]+$/.test(name)) {
        return { output: 'Fehler: name darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten.', error: 'invalid_name' };
      }

      // Parse and validate tools
      const tools = toolsRaw.split(',').map(t => t.trim()).filter(Boolean);
      const forbidden = tools.filter(t => FORBIDDEN_TOOLS.has(t));
      if (forbidden.length > 0) {
        return {
          output: `Fehler: Folgende Tools sind fuer Subagenten nicht erlaubt: ${forbidden.join(', ')}. Subagenten duerfen keine Meta-Tools oder andere Subagenten nutzen.`,
          error: 'forbidden_tools',
        };
      }

      // Check for duplicate
      const existing = getSubagent(name, context.tenantId);
      if (existing) {
        return {
          output: `Ein Subagent mit dem Namen "${name}" existiert bereits (${existing.source}). Waehle einen anderen Namen.`,
          error: 'duplicate',
        };
      }

      // Build MD file content
      const mdContent = `---
name: ${name}
description: ${description.replace(/\n/g, ' ')}
tools: ${tools.join(', ')}
maxSteps: ${maxSteps}
---

${instructions}
`;

      // Write to user-agents directory
      const tenant = context.tenantId || 'default';
      const agentDir = join(USER_AGENTS_DIR, tenant);
      if (!existsSync(agentDir)) {
        mkdirSync(agentDir, { recursive: true });
      }

      const filePath = join(agentDir, `${name}.md`);
      writeFileSync(filePath, mdContent, 'utf-8');

      // Clear cache so the new agent is immediately available
      clearSubagentCache();

      console.log(`[CreateAgent] Created subagent "${name}" at ${filePath}`);

      return {
        output: `Subagent "${name}" erfolgreich erstellt!\n\nName: ${name}\nTools: ${tools.join(', ')}\nMax Steps: ${maxSteps}\nDatei: server/user-agents/${tenant}/${name}.md\n\nDer Agent ist sofort nutzbar:\n- Automatisch: Der Hauptagent delegiert wenn die Aufgabe passt\n- Explizit: Sage "@${name} {aufgabe}" im Chat`,
        metadata: { name, tools, maxSteps, filePath: `server/user-agents/${tenant}/${name}.md` },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { output: `Fehler beim Erstellen des Agents: ${message}`, error: message };
    }
  },
};
