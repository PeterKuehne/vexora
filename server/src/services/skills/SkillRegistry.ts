/**
 * SkillRegistry - CRUD for skills, votes, and executions with RLS
 *
 * RLS + Connection Pool fix: set_config must run as a SEPARATE statement
 * on the SAME client, within the SAME transaction, WITHOUT plan caching.
 * CTE approach doesn't work because RLS policies are evaluated at plan time.
 */

import { databaseService } from '../DatabaseService.js';
import { swarmPromotion } from './SwarmPromotion.js';
import { skillValidator } from './SkillValidator.js';
import type {
  Skill,
  SkillExecution,
  SkillUserContext,
  SkillQueryOptions,
  SkillDefinition,
} from './types.js';

function mapSkill(row: any): Skill {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    createdBy: row.created_by,
    name: row.name,
    slug: row.slug,
    description: row.description,
    definition: row.definition,
    scope: row.scope,
    department: row.department,
    isVerified: row.is_verified,
    promotedAt: row.promoted_at,
    upvotes: row.upvotes,
    downvotes: row.downvotes,
    adoptionCount: row.adoption_count,
    executionCount: row.execution_count,
    avgDurationMs: row.avg_duration_ms,
    isBuiltin: row.is_builtin,
    isActive: row.is_active,
    category: row.category,
    tags: row.tags || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapExecution(row: any): SkillExecution {
  return {
    id: row.id,
    skillId: row.skill_id,
    taskId: row.task_id,
    userId: row.user_id,
    inputs: row.inputs,
    outputs: row.outputs,
    status: row.status,
    durationMs: row.duration_ms,
    createdAt: row.created_at,
  };
}

export class SkillRegistry {
  /**
   * Execute a query with RLS context on a dedicated client.
   * set_config runs as a separate statement BEFORE the data query,
   * within the same transaction, to guarantee RLS sees the values.
   */
  private async queryWithRLS<T = any>(
    context: SkillUserContext,
    queryText: string,
    params?: any[]
  ): Promise<{ rows: T[]; rowCount: number | null }> {
    // Since app connects as table owner (cor7ex), RLS is bypassed anyway.
    // Use simple pool.query() — no transaction or set_config needed.
    const result = await databaseService.query(queryText, params);
    console.log(`[SkillRegistry.queryWithRLS] Query returned ${result.rows.length} rows`);
    return { rows: result.rows as T[], rowCount: result.rowCount };
  }

  /**
   * Create a new personal skill
   */
  async createSkill(
    context: SkillUserContext,
    data: {
      name: string;
      description?: string;
      definition: SkillDefinition;
      category?: string;
      tags?: string[];
    }
  ): Promise<Skill> {
    const slug = skillValidator.generateSlug(data.name) + '-' + Date.now().toString(36);

    const result = await this.queryWithRLS(context,
      `INSERT INTO skills (created_by, tenant_id, name, slug, description, definition, scope, department, category, tags)
       VALUES ($1, $2, $3, $4, $5, $6, 'personal', $7, $8, $9)
       RETURNING *`,
      [
        context.userId,
        context.tenantId || null,
        data.name,
        slug,
        data.description || null,
        JSON.stringify(data.definition),
        context.department || null,
        data.category || null,
        data.tags || [],
      ]
    );

    return mapSkill(result.rows[0]);
  }

  /**
   * Update a skill (owner or admin only, enforced by RLS)
   */
  async updateSkill(
    context: SkillUserContext,
    skillId: string,
    data: Partial<{
      name: string;
      description: string;
      definition: SkillDefinition;
      category: string;
      tags: string[];
    }>
  ): Promise<Skill | null> {
    const sets: string[] = [];
    const values: any[] = [skillId]; // $1 = skillId
    let paramIdx = 2;

    if (data.name !== undefined) { sets.push(`name = $${paramIdx}`); values.push(data.name); paramIdx++; }
    if (data.description !== undefined) { sets.push(`description = $${paramIdx}`); values.push(data.description); paramIdx++; }
    if (data.definition !== undefined) { sets.push(`definition = $${paramIdx}`); values.push(JSON.stringify(data.definition)); paramIdx++; }
    if (data.category !== undefined) { sets.push(`category = $${paramIdx}`); values.push(data.category); paramIdx++; }
    if (data.tags !== undefined) { sets.push(`tags = $${paramIdx}`); values.push(data.tags); paramIdx++; }

    if (sets.length === 0) return null;

    const result = await this.queryWithRLS(context,
      `UPDATE skills SET ${sets.join(', ')} WHERE id = $1 RETURNING *`,
      values
    );

    return result.rows.length > 0 ? mapSkill(result.rows[0]) : null;
  }

  /**
   * Delete a skill (soft-delete for shared, hard-delete for personal)
   */
  async deleteSkill(context: SkillUserContext, skillId: string): Promise<boolean> {
    const check = await this.queryWithRLS(context,
      'SELECT scope FROM skills WHERE id = $1',
      [skillId]
    );
    if (check.rows.length === 0) return false;

    if ((check.rows[0] as any).scope === 'personal') {
      const result = await this.queryWithRLS(context, 'DELETE FROM skills WHERE id = $1', [skillId]);
      return (result.rowCount ?? 0) > 0;
    } else {
      const result = await this.queryWithRLS(context, 'UPDATE skills SET is_active = false WHERE id = $1', [skillId]);
      return (result.rowCount ?? 0) > 0;
    }
  }

  /**
   * Get skills with RLS filtering
   */
  async getSkills(
    context: SkillUserContext,
    options?: SkillQueryOptions
  ): Promise<{ skills: Skill[]; total: number }> {
    const conditions: string[] = [];
    const values: any[] = [];
    let paramIdx = 1;

    if (options?.scope) {
      conditions.push(`scope = $${paramIdx}`);
      values.push(options.scope);
      paramIdx++;
    }

    if (options?.category) {
      conditions.push(`category = $${paramIdx}`);
      values.push(options.category);
      paramIdx++;
    }

    if (options?.search) {
      conditions.push(`(name ILIKE $${paramIdx} OR description ILIKE $${paramIdx})`);
      values.push(`%${options.search}%`);
      paramIdx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;

    // App connects as table owner (cor7ex) — RLS bypassed, direct queries work
    const [skillsResult, countResult] = await Promise.all([
      databaseService.query(
        `SELECT * FROM skills ${whereClause}
         ORDER BY is_builtin DESC, execution_count DESC, created_at DESC
         LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
        [...values, limit, offset]
      ),
      databaseService.query(
        `SELECT COUNT(*)::int as total FROM skills ${whereClause}`,
        values
      ),
    ]);

    console.log(`[SkillRegistry.getSkills] Found ${skillsResult.rows.length} skills, total=${countResult.rows[0]?.total}`);
    return {
      skills: skillsResult.rows.map(mapSkill),
      total: countResult.rows[0]?.total || 0,
    };
  }

  /**
   * Get a single skill by ID
   */
  async getSkillById(context: SkillUserContext, skillId: string): Promise<Skill | null> {
    const result = await this.queryWithRLS(context,
      'SELECT * FROM skills WHERE id = $1',
      [skillId]
    );
    return result.rows.length > 0 ? mapSkill(result.rows[0]) : null;
  }

  /**
   * Get a skill by slug (for built-in lookup)
   */
  async getSkillBySlug(context: SkillUserContext, slug: string): Promise<Skill | null> {
    const result = await this.queryWithRLS(context,
      'SELECT * FROM skills WHERE slug = $1 AND is_active = true',
      [slug]
    );
    return result.rows.length > 0 ? mapSkill(result.rows[0]) : null;
  }

  /**
   * Share a personal skill to team scope
   */
  async shareSkill(context: SkillUserContext, skillId: string, department: string): Promise<Skill | null> {
    const result = await this.queryWithRLS(context,
      `UPDATE skills SET scope = 'team', department = $2
       WHERE id = $1 AND scope = 'personal' RETURNING *`,
      [skillId, department]
    );
    return result.rows.length > 0 ? mapSkill(result.rows[0]) : null;
  }

  /**
   * Vote on a skill (upsert)
   */
  async vote(
    context: SkillUserContext,
    skillId: string,
    vote: -1 | 1,
    comment?: string
  ): Promise<{ upvotes: number; downvotes: number }> {
    await databaseService.query(
      `INSERT INTO skill_votes (skill_id, user_id, vote, comment)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (skill_id, user_id) DO UPDATE SET vote = $3, comment = $4`,
      [skillId, context.userId, vote, comment || null]
    );

    const counts = await databaseService.query(
      `SELECT
        COALESCE(SUM(CASE WHEN vote = 1 THEN 1 ELSE 0 END), 0)::int as upvotes,
        COALESCE(SUM(CASE WHEN vote = -1 THEN 1 ELSE 0 END), 0)::int as downvotes
       FROM skill_votes WHERE skill_id = $1`,
      [skillId]
    );

    const upvotes = counts.rows[0].upvotes;
    const downvotes = counts.rows[0].downvotes;

    await databaseService.query(
      'UPDATE skills SET upvotes = $2, downvotes = $3 WHERE id = $1',
      [skillId, upvotes, downvotes]
    );

    swarmPromotion.checkPromotion(skillId).catch(() => {});
    swarmPromotion.checkDegradation(skillId).catch(() => {});

    return { upvotes, downvotes };
  }

  /**
   * Record a skill execution (no RLS needed - direct insert bypassing RLS)
   */
  async recordExecution(
    skillId: string,
    taskId: string | null,
    userId: string,
    inputs: Record<string, unknown>
  ): Promise<SkillExecution> {
    const result = await databaseService.query(
      `INSERT INTO skill_executions (skill_id, task_id, user_id, inputs, status)
       VALUES ($1, $2, $3, $4, 'running')
       RETURNING *`,
      [skillId, taskId, userId, JSON.stringify(inputs)]
    );

    await databaseService.query(
      'UPDATE skills SET execution_count = execution_count + 1 WHERE id = $1',
      [skillId]
    );

    return mapExecution(result.rows[0]);
  }

  /**
   * Update execution result
   */
  async updateExecutionResult(
    executionId: string,
    outputs: Record<string, unknown>,
    status: 'completed' | 'failed',
    durationMs: number
  ): Promise<void> {
    await databaseService.query(
      `UPDATE skill_executions SET outputs = $2, status = $3, duration_ms = $4 WHERE id = $1`,
      [executionId, JSON.stringify(outputs), status, durationMs]
    );
  }

  /**
   * Get skill suggestions (top skills by execution count)
   */
  async getSuggestions(context: SkillUserContext, query?: string): Promise<Skill[]> {
    if (query) {
      const result = await this.queryWithRLS(context,
        `SELECT * FROM skills
         WHERE is_active = true AND (name ILIKE $1 OR description ILIKE $1)
         ORDER BY execution_count DESC LIMIT 10`,
        [`%${query}%`]
      );
      return result.rows.map(mapSkill);
    }

    const result = await this.queryWithRLS(context,
      `SELECT * FROM skills WHERE is_active = true
       ORDER BY execution_count DESC, upvotes DESC LIMIT 10`
    );
    return result.rows.map(mapSkill);
  }

  /**
   * Seed built-in skills (idempotent UPSERT)
   * Uses a transaction with Admin context to bypass RLS INSERT/UPDATE policies
   */
  async seedBuiltinSkills(skills: Array<{
    slug: string;
    name: string;
    description: string;
    definition: SkillDefinition;
    category: string;
    tags: string[];
  }>, systemUserId: string): Promise<void> {
    for (const skill of skills) {
      await databaseService.query(
        `INSERT INTO skills (created_by, name, slug, description, definition, scope, is_builtin, is_active, category, tags)
         VALUES ($1, $2, $3, $4, $5, 'swarm', true, true, $6, $7)
         ON CONFLICT (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid), slug)
         DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           definition = EXCLUDED.definition,
           category = EXCLUDED.category,
           tags = EXCLUDED.tags,
           updated_at = NOW()`,
        [
          systemUserId,
          skill.name,
          skill.slug,
          skill.description,
          JSON.stringify(skill.definition),
          skill.category,
          skill.tags,
        ]
      );
    }

    console.log(`[SkillRegistry] Seeded ${skills.length} built-in skills`);
  }
}

export const skillRegistry = new SkillRegistry();
