/**
 * ExpertAgentService — CRUD + Seeding for Expert Agents (DB-backed)
 *
 * Single Source of Truth: PostgreSQL `expert_agents` table.
 * Built-in templates (Markdown files) are seeded at startup.
 * The AgentExecutor uses loadActiveHarnesses() to get agents for the Hive Mind.
 */

import { databaseService } from '../DatabaseService.js';
import { toolRegistry } from './ToolRegistry.js';
import { loadExpertAgents as loadExpertAgentsFromFiles } from './ExpertAgentLoader.js';
import type { ExpertAgentHarness } from './types.js';

// ============================================
// Types
// ============================================

export interface ExpertAgentRecord {
  id: string;
  tenantId: string | null;
  name: string;
  description: string;
  avatarUrl: string | null;
  isActive: boolean;
  model: string;
  maxSteps: number;
  roles: string[];
  rules: string[];
  tools: string[];
  instructions: string;
  source: 'builtin' | 'custom';
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateExpertAgentInput {
  name: string;
  description: string;
  avatarUrl?: string;
  model?: string;
  maxSteps?: number;
  roles?: string[];
  rules?: string[];
  tools: string[];
  instructions: string;
}

export interface UpdateExpertAgentInput {
  name?: string;
  description?: string;
  avatarUrl?: string | null;
  isActive?: boolean;
  model?: string;
  maxSteps?: number;
  roles?: string[];
  rules?: string[];
  tools?: string[];
  instructions?: string;
}

export interface ToolInfo {
  name: string;
  description: string;
  source: string;
  category: string;
}

// ============================================
// Helpers
// ============================================

function mapRow(row: any): ExpertAgentRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    description: row.description,
    avatarUrl: row.avatar_url,
    isActive: row.is_active,
    model: row.model,
    maxSteps: row.max_steps,
    roles: row.roles || [],
    rules: row.rules || [],
    tools: row.tools || [],
    instructions: row.instructions,
    source: row.source,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function categorizeToolName(name: string): string {
  if (name.startsWith('sama_')) return 'SamaWorkforce MCP';
  if (['rag_search', 'read_chunk', 'graph_query'].includes(name)) return 'Suche & Wissen';
  if (['list_skills', 'load_skill', 'create_skill', 'update_skill', 'compare_skill'].includes(name)) return 'Skills';
  if (name === 'send_notification') return 'Kommunikation';
  if (name === 'sql_query') return 'Datenbank';
  if (name === 'run_script') return 'Scripting';
  if (['agent', 'list_agents', 'create_agent'].includes(name)) return 'Subagents';
  if (name === 'create_document') return 'Dokumente';
  return 'Sonstige';
}

// ============================================
// Service
// ============================================

class ExpertAgentServiceImpl {

  // ─── Read ──────────────────────────────────

  async getAll(tenantId?: string): Promise<ExpertAgentRecord[]> {
    const result = await databaseService.query(
      `SELECT * FROM expert_agents
       WHERE tenant_id IS NOT DISTINCT FROM $1
       ORDER BY source DESC, name ASC`,
      [tenantId || null]
    );
    return result.rows.map(mapRow);
  }

  async getById(id: string): Promise<ExpertAgentRecord | null> {
    const result = await databaseService.query(
      `SELECT * FROM expert_agents WHERE id = $1`,
      [id]
    );
    return result.rows.length > 0 ? mapRow(result.rows[0]) : null;
  }

  // ─── Create ────────────────────────────────

  async create(data: CreateExpertAgentInput, userId: string, tenantId?: string): Promise<ExpertAgentRecord> {
    const result = await databaseService.query(
      `INSERT INTO expert_agents
        (tenant_id, name, description, avatar_url, model, max_steps, roles, rules, tools, instructions, source, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'custom', $11)
       RETURNING *`,
      [
        tenantId || null,
        data.name,
        data.description,
        data.avatarUrl || null,
        data.model || 'gpt-oss-120b',
        data.maxSteps || 15,
        data.roles || [],
        data.rules || [],
        data.tools,
        data.instructions,
        userId,
      ]
    );
    console.log(`[ExpertAgentService] Created agent: ${data.name}`);
    return mapRow(result.rows[0]);
  }

  // ─── Update ────────────────────────────────

  async update(id: string, data: UpdateExpertAgentInput): Promise<ExpertAgentRecord | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    const addField = (column: string, value: unknown) => {
      if (value !== undefined) {
        fields.push(`${column} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    };

    addField('name', data.name);
    addField('description', data.description);
    addField('avatar_url', data.avatarUrl);
    addField('is_active', data.isActive);
    addField('model', data.model);
    addField('max_steps', data.maxSteps);
    addField('roles', data.roles);
    addField('rules', data.rules);
    addField('tools', data.tools);
    addField('instructions', data.instructions);

    if (fields.length === 0) return this.getById(id);

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await databaseService.query(
      `UPDATE expert_agents SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) return null;
    console.log(`[ExpertAgentService] Updated agent: ${result.rows[0].name}`);
    return mapRow(result.rows[0]);
  }

  // ─── Toggle Active ─────────────────────────

  async toggleActive(id: string): Promise<ExpertAgentRecord | null> {
    const result = await databaseService.query(
      `UPDATE expert_agents SET is_active = NOT is_active, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) return null;
    const agent = mapRow(result.rows[0]);
    console.log(`[ExpertAgentService] ${agent.name} → ${agent.isActive ? 'activated' : 'deactivated'}`);
    return agent;
  }

  // ─── Delete ────────────────────────────────

  async delete(id: string): Promise<boolean> {
    const result = await databaseService.query(
      `DELETE FROM expert_agents WHERE id = $1 RETURNING name, source`,
      [id]
    );
    if (result.rows.length === 0) return false;
    console.log(`[ExpertAgentService] Deleted agent: ${result.rows[0].name}`);
    return true;
  }

  // ─── Available Tools ───────────────────────

  getAvailableTools(): ToolInfo[] {
    const toolNames = toolRegistry.getToolNames();
    const tools: ToolInfo[] = [];

    for (const name of toolNames) {
      const tool = toolRegistry.getTool(name);
      if (!tool) continue;
      tools.push({
        name: tool.name,
        description: tool.description,
        source: name.startsWith('sama_') ? 'mcp' : 'builtin',
        category: categorizeToolName(name),
      });
    }

    return tools.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  }

  // ─── Seeding ───────────────────────────────

  async seedBuiltinAgents(): Promise<void> {
    const templates = loadExpertAgentsFromFiles();
    if (templates.length === 0) {
      console.log('[ExpertAgentService] No built-in agent templates found');
      return;
    }

    for (const agent of templates) {
      // Parse guardrails from the old format into flat roles/rules
      const roles = agent.guardrails
        .filter(g => g.type === 'role_check')
        .flatMap(g => Array.isArray(g.value) ? g.value : [g.value]);

      const rules = agent.guardrails
        .filter(g => g.type === 'prompt')
        .map(g => String(g.value));

      await databaseService.query(
        `INSERT INTO expert_agents
          (tenant_id, name, description, model, max_steps, roles, rules, tools, instructions, source)
         VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8, 'builtin')
         ON CONFLICT (tenant_id, name) DO UPDATE SET
           description = EXCLUDED.description,
           model = EXCLUDED.model,
           max_steps = EXCLUDED.max_steps,
           roles = EXCLUDED.roles,
           rules = EXCLUDED.rules,
           tools = EXCLUDED.tools,
           instructions = EXCLUDED.instructions,
           updated_at = NOW()
         WHERE expert_agents.source = 'builtin'`,
        [
          agent.name,
          agent.description,
          agent.model,
          agent.maxSteps,
          roles,
          rules,
          agent.tools,
          agent.instructions,
        ]
      );
    }

    console.log(`[ExpertAgentService] Seeded ${templates.length} built-in expert agent(s)`);
  }

  // ─── For AgentExecutor ─────────────────────

  /**
   * Load all active Expert Agents as ExpertAgentHarness objects.
   * This is the interface the AgentExecutor uses to create tools.
   */
  async loadActiveHarnesses(tenantId?: string): Promise<ExpertAgentHarness[]> {
    const result = await databaseService.query(
      `SELECT * FROM expert_agents
       WHERE is_active = true AND tenant_id IS NOT DISTINCT FROM $1
       ORDER BY name ASC`,
      [tenantId || null]
    );

    return result.rows.map((row: any): ExpertAgentHarness => ({
      name: row.name,
      description: row.description,
      tools: row.tools || [],
      model: row.model,
      maxSteps: row.max_steps,
      guardrails: [
        ...(row.roles?.length > 0
          ? [{ type: 'role_check' as const, value: row.roles }]
          : []),
        ...(row.rules || []).map((rule: string) => ({
          type: 'prompt' as const,
          value: rule,
        })),
      ],
      instructions: row.instructions,
      filePath: `db:${row.id}`,
      source: row.source,
    }));
  }
}

export const expertAgentService = new ExpertAgentServiceImpl();
