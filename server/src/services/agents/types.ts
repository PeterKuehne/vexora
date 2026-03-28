/**
 * Agent System Types
 *
 * Core interfaces for the Agent Framework (Phase 2 - Hive Mind)
 */

import type { UserRole } from '../../types/auth.js';
import type { ZodType } from 'zod';

// ============================================
// JSON Schema (kept for legacy Anthropic/Ollama tool formats)
// ============================================

export interface JSONSchemaProperty {
  type: string;
  description: string;
  enum?: string[];
  items?: JSONSchemaProperty;
  default?: unknown;
}

export interface JSONSchema {
  type: 'object';
  required?: string[];
  properties: Record<string, JSONSchemaProperty>;
}

// ============================================
// Tool Definitions
// ============================================

export interface ToolResult {
  output: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

// ============================================
// Hybrid Pipeline Types
// ============================================

export interface ClassificationResult {
  complexity: 'simple' | 'complex';
  /** Skip pre-search for queries that obviously don't need RAG (translations, math) */
  skipPreSearch: boolean;
  reason: string;
}

export type AgentStrategy = 'hybrid' | 'cloud-only' | 'local-only';

// ============================================
// User Context
// ============================================

export interface AgentUserContext {
  userId: string;
  userRole: UserRole;
  tenantId?: string;
  department?: string;
  /** Document IDs the user is allowed to access (from RLS) */
  allowedDocumentIds?: string[];
  /** Current task ID — set by AgentExecutor during execution */
  taskId?: string;
}

export interface ToolExecutionOptions {
  abortSignal?: AbortSignal;
}

export interface AgentTool {
  name: string;
  description: string;
  /** Zod schema for tool input validation (preferred) */
  inputSchema: ZodType;
  /** @deprecated Legacy JSON Schema — only used by Anthropic/Ollama format converters */
  parameters?: JSONSchema;
  execute: (args: Record<string, unknown>, context: AgentUserContext, options?: ToolExecutionOptions) => Promise<ToolResult>;
  /** Roles that can use this tool. If empty/undefined, all roles can use it. */
  requiredRoles?: UserRole[];
  /**
   * Skill-gated tool: only available after the named skill has been loaded
   * via load_skill. Follows Anthropic's allowed-tools pattern.
   * Example: 'skill-creator' → tool only available after load_skill("skill-creator")
   */
  skillGated?: string;
}

// ============================================
// Tool Call (from LLM response)
// ============================================

export interface ToolCall {
  id?: string;
  name: string;
  arguments: Record<string, unknown>;
}

// ============================================
// Agent Task & Step (DB models)
// ============================================

export type AgentTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'awaiting_input';

export interface AgentTask {
  id: string;
  userId: string;
  tenantId?: string;
  conversationId?: string;
  status: AgentTaskStatus;
  query: string;
  model: string;
  result?: {
    answer: string;
    sources?: unknown[];
  };
  error?: string;
  totalSteps: number;
  inputTokens: number;
  outputTokens: number;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface AgentStep {
  id: string;
  taskId: string;
  stepNumber: number;
  turnNumber: number;
  thought?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: string;
  tokensUsed: number;
  durationMs: number;
  createdAt: Date;
}

export interface AgentMessage {
  id: string;
  taskId: string;
  turnNumber: number;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  /** Structured content (assistant tool_use blocks, tool results) — takes precedence over content */
  contentJson?: unknown;
  /** Tool call ID for tool-result messages */
  toolCallId?: string;
  createdAt: Date;
}

// ============================================
// SSE Events
// ============================================

export type AgentSSEEventType =
  | 'task:start'
  | 'step:start'
  | 'step:thinking'
  | 'step:tool_start'
  | 'step:tool_complete'
  | 'step:complete'
  | 'task:complete'
  | 'task:error'
  | 'task:cancelled'
  | 'keepalive';

export interface AgentSSEEvent {
  event: AgentSSEEventType;
  data: {
    taskId: string;
    stepNumber?: number;
    thought?: string;
    toolName?: string;
    toolInput?: Record<string, unknown>;
    toolOutput?: string;
    duration?: number;
    result?: string;
    totalSteps?: number;
    error?: string;
    inputTokens?: number;
    outputTokens?: number;
    /** For task:complete — tells frontend if agent awaits more input */
    nextStatus?: 'awaiting_input' | 'completed';
    turnNumber?: number;
    /** Model used for this turn (e.g. "qwen3:14b", "mistral:mistral-large-latest") */
    model?: string;
    /** Where the model ran: 'local' (Ollama) or 'cloud' (EU-Cloud API) */
    modelLocation?: 'local' | 'cloud';
    /** Estimated cost in EUR (only for cloud models) */
    estimatedCost?: number;
    /** What the query router decided: 'direct' | 'rag' | 'rag-complex' */
    routingDecision?: string;
    /** Hybrid pipeline strategy used for this turn */
    strategy?: AgentStrategy;
  };
}

// ============================================
// Agent Config
// ============================================

export interface AgentConfig {
  maxIterations: number;
  defaultModel: string;
  timeoutMs: number;
  maxToolOutputLength: number;
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  maxIterations: parseInt(process.env.MAX_AGENT_ITERATIONS || '25', 10),
  defaultModel: process.env.AGENT_DEFAULT_MODEL || 'ovh:gpt-oss-120b',
  timeoutMs: parseInt(process.env.AGENT_TIMEOUT_MS || '300000', 10),
  maxToolOutputLength: 10000,
};
