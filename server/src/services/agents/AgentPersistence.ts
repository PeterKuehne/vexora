/**
 * AgentPersistence - CRUD for agent_tasks and agent_steps with RLS
 */

import { databaseService } from '../DatabaseService.js';
import type { AgentTask, AgentStep, AgentTaskStatus, AgentUserContext } from './types.js';

function mapTask(row: any): AgentTask {
  return {
    id: row.id,
    userId: row.user_id,
    tenantId: row.tenant_id,
    conversationId: row.conversation_id,
    status: row.status,
    query: row.query,
    model: row.model,
    result: row.result,
    error: row.error,
    totalSteps: row.total_steps,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

function mapStep(row: any): AgentStep {
  return {
    id: row.id,
    taskId: row.task_id,
    stepNumber: row.step_number,
    thought: row.thought,
    toolName: row.tool_name,
    toolInput: row.tool_input,
    toolOutput: row.tool_output,
    tokensUsed: row.tokens_used,
    durationMs: row.duration_ms,
    createdAt: row.created_at,
  };
}

export class AgentPersistence {
  private async setUserContext(userId: string, role: string): Promise<void> {
    await databaseService.query(
      `SELECT set_config('app.user_id', $1, true), set_config('app.user_role', $2, true)`,
      [userId, role]
    );
  }

  /**
   * Create a new agent task
   */
  async createTask(context: AgentUserContext, query: string, model: string, conversationId?: string): Promise<AgentTask> {
    const result = await databaseService.query(
      `INSERT INTO agent_tasks (user_id, tenant_id, conversation_id, query, model, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [context.userId, context.tenantId || null, conversationId || null, query, model]
    );
    return mapTask(result.rows[0]);
  }

  /**
   * Update task status
   */
  async updateTaskStatus(taskId: string, status: AgentTaskStatus, extra?: {
    result?: any;
    error?: string;
    totalSteps?: number;
    inputTokens?: number;
    outputTokens?: number;
  }): Promise<void> {
    const sets: string[] = ['status = $2', 'updated_at = NOW()'];
    const values: any[] = [taskId, status];
    let paramIdx = 3;

    if (status === 'running') {
      sets.push('started_at = NOW()');
    }
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      sets.push('completed_at = NOW()');
    }

    if (extra?.result !== undefined) {
      sets.push(`result = $${paramIdx}`);
      values.push(JSON.stringify(extra.result));
      paramIdx++;
    }
    if (extra?.error !== undefined) {
      sets.push(`error = $${paramIdx}`);
      values.push(extra.error);
      paramIdx++;
    }
    if (extra?.totalSteps !== undefined) {
      sets.push(`total_steps = $${paramIdx}`);
      values.push(extra.totalSteps);
      paramIdx++;
    }
    if (extra?.inputTokens !== undefined) {
      sets.push(`input_tokens = $${paramIdx}`);
      values.push(extra.inputTokens);
      paramIdx++;
    }
    if (extra?.outputTokens !== undefined) {
      sets.push(`output_tokens = $${paramIdx}`);
      values.push(extra.outputTokens);
      paramIdx++;
    }

    await databaseService.query(
      `UPDATE agent_tasks SET ${sets.join(', ')} WHERE id = $1`,
      values
    );
  }

  /**
   * Create an agent step
   */
  async createStep(step: Omit<AgentStep, 'id' | 'createdAt'>): Promise<AgentStep> {
    const result = await databaseService.query(
      `INSERT INTO agent_steps (task_id, step_number, thought, tool_name, tool_input, tool_output, tokens_used, duration_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        step.taskId,
        step.stepNumber,
        step.thought || null,
        step.toolName || null,
        step.toolInput ? JSON.stringify(step.toolInput) : null,
        step.toolOutput || null,
        step.tokensUsed,
        step.durationMs,
      ]
    );
    return mapStep(result.rows[0]);
  }

  /**
   * Get tasks for user (with RLS)
   */
  async getTasks(
    context: AgentUserContext,
    options?: { status?: AgentTaskStatus; limit?: number; offset?: number }
  ): Promise<{ tasks: AgentTask[]; total: number }> {
    await this.setUserContext(context.userId, context.userRole);
    try {
      const conditions: string[] = [];
      const values: any[] = [];
      let paramIdx = 1;

      if (options?.status) {
        conditions.push(`status = $${paramIdx}`);
        values.push(options.status);
        paramIdx++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limit = options?.limit || 20;
      const offset = options?.offset || 0;

      const [tasksResult, countResult] = await Promise.all([
        databaseService.query(
          `SELECT * FROM agent_tasks ${whereClause} ORDER BY created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
          [...values, limit, offset]
        ),
        databaseService.query(
          `SELECT COUNT(*)::int as total FROM agent_tasks ${whereClause}`,
          values
        ),
      ]);

      return {
        tasks: tasksResult.rows.map(mapTask),
        total: countResult.rows[0]?.total || 0,
      };
    } finally {
      // Context is transaction-local, no explicit clear needed
    }
  }

  /**
   * Get a single task with all steps (with RLS)
   */
  async getTaskWithSteps(context: AgentUserContext, taskId: string): Promise<{ task: AgentTask; steps: AgentStep[] } | null> {
    await this.setUserContext(context.userId, context.userRole);
    try {
      const taskResult = await databaseService.query(
        'SELECT * FROM agent_tasks WHERE id = $1',
        [taskId]
      );

      if (taskResult.rows.length === 0) return null;

      const stepsResult = await databaseService.query(
        'SELECT * FROM agent_steps WHERE task_id = $1 ORDER BY step_number ASC',
        [taskId]
      );

      return {
        task: mapTask(taskResult.rows[0]),
        steps: stepsResult.rows.map(mapStep),
      };
    } finally {
      // Context is transaction-local, no explicit clear needed
    }
  }
}

export const agentPersistence = new AgentPersistence();
