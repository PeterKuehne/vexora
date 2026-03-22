/**
 * Skill System Types
 *
 * Skills = Markdown instructions with YAML-style metadata.
 * Following Anthropic's Progressive Disclosure pattern:
 * - Level 1: name + description (always in system prompt)
 * - Level 2: full Markdown body (loaded on demand via load_skill tool)
 * - Level 3: referenced tools/documents (used as needed by agent)
 */

// ============================================
// Skill Definition (stored as JSONB in DB)
// ============================================

export interface SkillDefinition {
  /** The full Markdown instruction body (Level 2 content) */
  content: string;
  /** Recommended tools for this skill */
  tools: string[];
  /** Skill version */
  version: string;
}

// ============================================
// Skill Scope & Lifecycle
// ============================================

export type SkillScope = 'personal' | 'team' | 'swarm';

// ============================================
// Skill (DB Model)
// ============================================

export interface Skill {
  id: string;
  tenantId?: string;
  createdBy: string;
  name: string;
  slug: string;
  description?: string;
  definition: SkillDefinition;
  scope: SkillScope;
  department?: string;
  isVerified: boolean;
  promotedAt?: Date;
  upvotes: number;
  downvotes: number;
  adoptionCount: number;
  executionCount: number;
  avgDurationMs: number;
  isBuiltin: boolean;
  isActive: boolean;
  category?: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Skill Execution (tracking only)
// ============================================

export type SkillExecutionStatus = 'running' | 'completed' | 'failed';

export interface SkillExecution {
  id: string;
  skillId: string;
  taskId?: string;
  userId: string;
  inputs?: Record<string, unknown>;
  outputs?: Record<string, unknown>;
  status: SkillExecutionStatus;
  durationMs: number;
  createdAt: Date;
}

// ============================================
// Skill Vote
// ============================================

export interface SkillVote {
  skillId: string;
  userId: string;
  vote: -1 | 1;
  comment?: string;
  createdAt: Date;
}

// ============================================
// Context for skill operations
// ============================================

export interface SkillUserContext {
  userId: string;
  userRole: string;
  department?: string;
  tenantId?: string;
}

// ============================================
// Query options
// ============================================

export interface SkillQueryOptions {
  scope?: SkillScope;
  category?: string;
  search?: string;
  limit?: number;
  offset?: number;
}
