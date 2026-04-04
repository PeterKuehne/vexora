/**
 * HeartbeatEngine — Proactive background checks via cron scheduling
 *
 * Runs Data Heartbeats (MCP Tool Calls) on cron schedules.
 * Results are stored in PostgreSQL and delivered as briefings
 * when the user opens Cor7ex.
 *
 * Phase 1: Data Heartbeats only (no Agent Heartbeats).
 */

import cron from 'node-cron';
import { databaseService } from '../DatabaseService.js';
import type { McpClientManager } from '../mcp/McpClientManager.js';
import type { Server as SocketServer } from 'socket.io';

// ============================================
// Types
// ============================================

export interface HeartbeatDefinition {
  id: string;
  tenantId: string | null;
  userId: string | null;
  name: string;
  description: string | null;
  cron: string;
  type: 'data' | 'agent';
  level: 'company' | 'user' | 'learned';
  config: DataQueryConfig | AgentTaskConfig;
  roles: string[];
  icon: string;
  priority: 'critical' | 'warning' | 'info';
  enabled: boolean;
  source: 'builtin' | 'custom';
  lastRunAt: Date | null;
  lastResultSummary: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DataQueryConfig {
  tool: string;
  args?: Record<string, unknown>;
  selections?: string;
  threshold?: {
    field: string;
    operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne';
    value: number;
  };
}

export interface AgentTaskConfig {
  agent: string;
  task: string;
}

export interface HeartbeatResult {
  id: string;
  heartbeatId: string;
  tenantId: string | null;
  userId: string | null;
  data: unknown;
  summary: string | null;
  priority: string;
  deliveredAt: Date | null;
  createdAt: Date;
  // Joined from definition
  name?: string;
  description?: string;
  icon?: string;
}

export interface CreateHeartbeatInput {
  name: string;
  description?: string;
  cron: string;
  type?: 'data' | 'agent';
  level?: 'company' | 'user' | 'learned';
  config: DataQueryConfig | AgentTaskConfig;
  roles?: string[];
  icon?: string;
  priority?: 'critical' | 'warning' | 'info';
}

// ============================================
// Helpers
// ============================================

function mapDefinition(row: any): HeartbeatDefinition {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    name: row.name,
    description: row.description,
    cron: row.cron,
    type: row.type,
    level: row.level,
    config: row.config,
    roles: row.roles || [],
    icon: row.icon || '📋',
    priority: row.priority || 'info',
    enabled: row.enabled,
    source: row.source,
    lastRunAt: row.last_run_at,
    lastResultSummary: row.last_result_summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapResult(row: any): HeartbeatResult {
  return {
    id: row.id,
    heartbeatId: row.heartbeat_id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    data: row.data,
    summary: row.summary,
    priority: row.priority,
    deliveredAt: row.delivered_at,
    createdAt: row.created_at,
    name: row.name,
    description: row.hb_description,
    icon: row.icon,
  };
}

// ============================================
// Engine
// ============================================

class HeartbeatEngineImpl {
  private jobs = new Map<string, cron.ScheduledTask>();
  private mcpClient: McpClientManager | null = null;
  private io: SocketServer | null = null;

  /**
   * Initialize: load definitions, register cron jobs
   */
  async initialize(mcpClient: McpClientManager, io: SocketServer): Promise<void> {
    this.mcpClient = mcpClient;
    this.io = io;

    // Seed built-in heartbeats
    await this.seedBuiltinHeartbeats();

    // Load and schedule
    const definitions = await this.getAllDefinitions();
    const enabled = definitions.filter(d => d.enabled);

    for (const def of enabled) {
      this.scheduleJob(def);
    }

    console.log(`[Heartbeat] ${this.jobs.size} jobs registered`);
  }

  /**
   * Schedule a single heartbeat as a cron job
   */
  private scheduleJob(def: HeartbeatDefinition): void {
    if (!cron.validate(def.cron)) {
      console.warn(`[Heartbeat] Invalid cron expression for ${def.name}: ${def.cron}`);
      return;
    }

    const job = cron.schedule(def.cron, async () => {
      await this.executeHeartbeat(def);
    });

    this.jobs.set(def.id, job);
  }

  /**
   * Execute a single heartbeat check
   */
  async executeHeartbeat(def: HeartbeatDefinition): Promise<HeartbeatResult | null> {
    console.log(`[Heartbeat] Executing: ${def.name}`);

    try {
      if (def.type !== 'data' || !this.mcpClient) return null;

      const config = def.config as DataQueryConfig;
      if (!config.tool) return null;

      // Strip sama_ prefix for MCP call
      const toolName = config.tool.replace(/^sama_/, '');

      const toolResult = await this.mcpClient.callTool(toolName, {
        args: config.args ? JSON.stringify(config.args) : undefined,
        selections: config.selections,
      });

      const data = typeof toolResult === 'string' ? JSON.parse(toolResult) : toolResult;

      // Check threshold
      if (config.threshold && !this.checkThreshold(data, config.threshold)) {
        // Update last_run but don't save result (below threshold)
        await databaseService.query(
          `UPDATE heartbeat_definitions SET last_run_at = NOW(), last_result_summary = 'Below threshold' WHERE id = $1`,
          [def.id]
        );
        console.log(`[Heartbeat] ${def.name}: below threshold, skipped`);
        return null;
      }

      // Save result
      const result = await this.saveResult(def, data);

      // Update definition
      const summary = Array.isArray(data) ? `${data.length} Ergebnisse` : 'Ergebnis vorhanden';
      await databaseService.query(
        `UPDATE heartbeat_definitions SET last_run_at = NOW(), last_result_summary = $2 WHERE id = $1`,
        [def.id, summary]
      );

      // Notify via Socket.io
      if (this.io) {
        this.io.emit('heartbeat:new-results', {
          heartbeatId: def.id,
          name: def.name,
          icon: def.icon,
          priority: def.priority,
        });
      }

      console.log(`[Heartbeat] ${def.name}: ${summary}`);
      return result;
    } catch (error) {
      console.error(`[Heartbeat] ${def.name} failed:`, error);
      await databaseService.query(
        `UPDATE heartbeat_definitions SET last_run_at = NOW(), last_result_summary = $2 WHERE id = $1`,
        [def.id, `Error: ${error}`]
      );
      return null;
    }
  }

  // ─── Threshold Check ───────────────────────

  private checkThreshold(data: unknown, threshold: DataQueryConfig['threshold']): boolean {
    if (!threshold) return true;

    let value: number;
    if (threshold.field === 'length' && Array.isArray(data)) {
      value = data.length;
    } else if (typeof data === 'object' && data !== null) {
      value = (data as Record<string, number>)[threshold.field] ?? 0;
    } else {
      return true;
    }

    switch (threshold.operator) {
      case 'gt': return value > threshold.value;
      case 'gte': return value >= threshold.value;
      case 'lt': return value < threshold.value;
      case 'lte': return value <= threshold.value;
      case 'eq': return value === threshold.value;
      case 'ne': return value !== threshold.value;
    }
  }

  // ─── CRUD ──────────────────────────────────

  async getAllDefinitions(tenantId?: string): Promise<HeartbeatDefinition[]> {
    const result = await databaseService.query(
      `SELECT * FROM heartbeat_definitions WHERE tenant_id IS NOT DISTINCT FROM $1 ORDER BY priority DESC, name ASC`,
      [tenantId || null]
    );
    return result.rows.map(mapDefinition);
  }

  async getDefinition(id: string): Promise<HeartbeatDefinition | null> {
    const result = await databaseService.query(
      `SELECT * FROM heartbeat_definitions WHERE id = $1`, [id]
    );
    return result.rows.length > 0 ? mapDefinition(result.rows[0]) : null;
  }

  async createDefinition(data: CreateHeartbeatInput, tenantId?: string): Promise<HeartbeatDefinition> {
    const result = await databaseService.query(
      `INSERT INTO heartbeat_definitions (tenant_id, name, description, cron, type, level, config, roles, icon, priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [
        tenantId || null, data.name, data.description || null, data.cron,
        data.type || 'data', data.level || 'company', JSON.stringify(data.config),
        data.roles || [], data.icon || '📋', data.priority || 'info',
      ]
    );
    const def = mapDefinition(result.rows[0]);
    this.scheduleJob(def);
    console.log(`[Heartbeat] Created: ${def.name} (${def.cron})`);
    return def;
  }

  async updateDefinition(id: string, data: Partial<CreateHeartbeatInput> & { enabled?: boolean }): Promise<HeartbeatDefinition | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    const add = (col: string, val: unknown) => {
      if (val !== undefined) { fields.push(`${col} = $${idx}`); values.push(val); idx++; }
    };

    add('name', data.name);
    add('description', data.description);
    add('cron', data.cron);
    add('type', data.type);
    add('level', data.level);
    if (data.config !== undefined) { add('config', JSON.stringify(data.config)); }
    add('roles', data.roles);
    add('icon', data.icon);
    add('priority', data.priority);
    add('enabled', data.enabled);

    if (fields.length === 0) return this.getDefinition(id);

    fields.push('updated_at = NOW()');
    values.push(id);

    const result = await databaseService.query(
      `UPDATE heartbeat_definitions SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    if (result.rows.length === 0) return null;
    const def = mapDefinition(result.rows[0]);

    // Re-schedule
    this.jobs.get(id)?.stop();
    this.jobs.delete(id);
    if (def.enabled) this.scheduleJob(def);

    return def;
  }

  async toggleDefinition(id: string): Promise<HeartbeatDefinition | null> {
    const result = await databaseService.query(
      `UPDATE heartbeat_definitions SET enabled = NOT enabled, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) return null;
    const def = mapDefinition(result.rows[0]);

    // Toggle cron job
    if (def.enabled) {
      this.scheduleJob(def);
    } else {
      this.jobs.get(id)?.stop();
      this.jobs.delete(id);
    }

    console.log(`[Heartbeat] ${def.name} → ${def.enabled ? 'enabled' : 'disabled'}`);
    return def;
  }

  async deleteDefinition(id: string): Promise<boolean> {
    this.jobs.get(id)?.stop();
    this.jobs.delete(id);
    const result = await databaseService.query(
      `DELETE FROM heartbeat_definitions WHERE id = $1 RETURNING name`, [id]
    );
    return result.rows.length > 0;
  }

  // ─── Results ───────────────────────────────

  private async saveResult(def: HeartbeatDefinition, data: unknown): Promise<HeartbeatResult> {
    const result = await databaseService.query(
      `INSERT INTO heartbeat_results (heartbeat_id, tenant_id, user_id, data, priority)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [def.id, def.tenantId, def.userId, JSON.stringify(data), def.priority]
    );
    return mapResult(result.rows[0]);
  }

  async getUndeliveredResults(userId: string, userRole: string, tenantId?: string): Promise<HeartbeatResult[]> {
    const result = await databaseService.query(
      `SELECT hr.*, hd.name, hd.description AS hb_description, hd.icon
       FROM heartbeat_results hr
       JOIN heartbeat_definitions hd ON hr.heartbeat_id = hd.id
       WHERE hr.tenant_id IS NOT DISTINCT FROM $1
         AND hr.delivered_at IS NULL
         AND (hr.user_id IS NULL OR hr.user_id = $2::uuid)
         AND (hd.roles = '{}' OR $3 = ANY(hd.roles))
       ORDER BY
         CASE hd.priority WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
         hr.created_at DESC
       LIMIT 20`,
      [tenantId || null, userId, userRole]
    );
    return result.rows.map(mapResult);
  }

  async getAllResults(tenantId?: string, limit = 50): Promise<HeartbeatResult[]> {
    const result = await databaseService.query(
      `SELECT hr.*, hd.name, hd.description AS hb_description, hd.icon
       FROM heartbeat_results hr
       JOIN heartbeat_definitions hd ON hr.heartbeat_id = hd.id
       WHERE hr.tenant_id IS NOT DISTINCT FROM $1
       ORDER BY hr.created_at DESC
       LIMIT $2`,
      [tenantId || null, limit]
    );
    return result.rows.map(mapResult);
  }

  async markDelivered(resultIds: string[]): Promise<void> {
    if (resultIds.length === 0) return;
    await databaseService.query(
      `UPDATE heartbeat_results SET delivered_at = NOW() WHERE id = ANY($1)`,
      [resultIds]
    );
  }

  // ─── Seeding ───────────────────────────────

  private async seedBuiltinHeartbeats(): Promise<void> {
    const builtins: Array<{ name: string; description: string; cron: string; config: DataQueryConfig; icon: string; priority: string; roles: string[] }> = [
      {
        name: 'AUeG-Fristen',
        description: 'Einsaetze die bald die 18-Monats-Grenze erreichen',
        cron: '0 7 * * 1-5',
        config: {
          tool: 'sama_assignmentsNearLimit',
          threshold: { field: 'length', operator: 'gt', value: 0 },
        },
        icon: '⚠️',
        priority: 'warning',
        roles: ['Admin', 'Manager'],
      },
      {
        name: 'Offene Rechnungen',
        description: 'Gebuchte Rechnungen die noch nicht bezahlt sind',
        cron: '0 8 * * 1-5',
        config: {
          tool: 'sama_accountMoves',
          args: { filter: { state: 'POSTED' } },
          selections: '{ id moveNumber totalGross dueDate paymentState customer { name } }',
          threshold: { field: 'length', operator: 'gt', value: 0 },
        },
        icon: '💰',
        priority: 'warning',
        roles: ['Admin', 'Manager'],
      },
      {
        name: 'Abgelaufene Zertifizierungen',
        description: 'Mitarbeiter-Zertifizierungen die bereits abgelaufen sind',
        cron: '30 7 * * 1-5',
        config: {
          tool: 'sama_expiredCertifications',
          threshold: { field: 'length', operator: 'gt', value: 0 },
        },
        icon: '📋',
        priority: 'info',
        roles: ['Admin', 'Manager'],
      },
    ];

    for (const hb of builtins) {
      await databaseService.query(
        `INSERT INTO heartbeat_definitions (tenant_id, name, description, cron, type, level, config, roles, icon, priority, source)
         VALUES (NULL, $1, $2, $3, 'data', 'company', $4, $5, $6, $7, 'builtin')
         ON CONFLICT (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), name) DO UPDATE SET
           description = EXCLUDED.description,
           cron = EXCLUDED.cron,
           config = EXCLUDED.config,
           roles = EXCLUDED.roles,
           icon = EXCLUDED.icon,
           priority = EXCLUDED.priority,
           updated_at = NOW()
         WHERE heartbeat_definitions.source = 'builtin'`,
        [hb.name, hb.description, hb.cron, JSON.stringify(hb.config), hb.roles, hb.icon, hb.priority]
      );
    }

    console.log(`[Heartbeat] Seeded ${builtins.length} built-in heartbeat(s)`);
  }

  // ─── Cleanup ───────────────────────────────

  shutdown(): void {
    for (const [id, job] of this.jobs) {
      job.stop();
    }
    this.jobs.clear();
    console.log('[Heartbeat] All jobs stopped');
  }
}

export const heartbeatEngine = new HeartbeatEngineImpl();
