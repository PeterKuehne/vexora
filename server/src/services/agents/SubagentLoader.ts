/**
 * SubagentLoader - Loads subagent definitions from Markdown files
 *
 * Reads YAML frontmatter + Markdown body from:
 * - server/agents/         (built-in subagents)
 * - server/user-agents/    (custom, per-tenant subagents)
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..', '..');
const BUILTIN_AGENTS_DIR = join(PROJECT_ROOT, 'server', 'agents');
const USER_AGENTS_DIR = join(PROJECT_ROOT, 'server', 'user-agents');

export interface SubagentDefinition {
  name: string;
  description: string;
  tools: string[];
  maxSteps: number;
  instructions: string;
  filePath: string;
  source: 'builtin' | 'custom';
}

/**
 * Parse a single agent Markdown file into a SubagentDefinition.
 */
function parseAgentFile(filePath: string, source: 'builtin' | 'custom'): SubagentDefinition | null {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const { data, content } = matter(raw);

    const name = data.name as string;
    if (!name) {
      console.warn(`[SubagentLoader] Skipping ${filePath}: missing 'name' in frontmatter`);
      return null;
    }

    const toolsRaw = (data.tools as string) || '';
    const tools = toolsRaw.split(',').map(t => t.trim()).filter(Boolean);

    return {
      name,
      description: (data.description as string) || '',
      tools,
      maxSteps: (data.maxSteps as number) || 10,
      instructions: content.trim(),
      filePath,
      source,
    };
  } catch (error) {
    console.warn(`[SubagentLoader] Failed to parse ${filePath}:`, error);
    return null;
  }
}

/**
 * Scan a directory for .md agent files.
 */
function scanDirectory(dirPath: string, source: 'builtin' | 'custom'): SubagentDefinition[] {
  if (!existsSync(dirPath)) return [];

  const results: SubagentDefinition[] = [];
  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.md')) {
        const def = parseAgentFile(join(dirPath, entry.name), source);
        if (def) results.push(def);
      }
    }
  } catch (error) {
    console.warn(`[SubagentLoader] Failed to scan ${dirPath}:`, error);
  }
  return results;
}

// Cache
let cachedDefinitions: SubagentDefinition[] | null = null;

/**
 * Load all subagent definitions (built-in + custom for tenant).
 */
export function loadSubagentDefinitions(tenantId?: string): SubagentDefinition[] {
  // Built-in agents (cached)
  if (!cachedDefinitions) {
    cachedDefinitions = scanDirectory(BUILTIN_AGENTS_DIR, 'builtin');
    console.log(`[SubagentLoader] Loaded ${cachedDefinitions.length} built-in agent(s)`);
  }

  // Custom agents for tenant
  const tenant = tenantId || 'default';
  const customDir = join(USER_AGENTS_DIR, tenant);
  const customAgents = scanDirectory(customDir, 'custom');

  // Merge: custom overrides built-in if same name
  const merged = new Map<string, SubagentDefinition>();
  for (const def of cachedDefinitions) merged.set(def.name, def);
  for (const def of customAgents) merged.set(def.name, def);

  return Array.from(merged.values());
}

/**
 * Get a specific subagent by name.
 */
export function getSubagent(name: string, tenantId?: string): SubagentDefinition | undefined {
  return loadSubagentDefinitions(tenantId).find(d => d.name === name);
}

/**
 * List all available subagents.
 */
export function listSubagents(tenantId?: string): SubagentDefinition[] {
  return loadSubagentDefinitions(tenantId);
}

/**
 * Clear cache (e.g. after creating a new agent).
 */
export function clearSubagentCache(): void {
  cachedDefinitions = null;
}
