/**
 * Agent System Types
 *
 * Core interfaces for the Agent Framework (Phase 2 - Hive Mind)
 */

import type { UserRole } from '../../types/auth.js';

// ============================================
// JSON Schema (subset for tool parameters)
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

export interface AgentUserContext {
  userId: string;
  userRole: UserRole;
  tenantId?: string;
  department?: string;
  /** Document IDs the user is allowed to access (from RLS) */
  allowedDocumentIds?: string[];
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: JSONSchema;
  execute: (args: Record<string, unknown>, context: AgentUserContext) => Promise<ToolResult>;
  /** Roles that can use this tool. If empty/undefined, all roles can use it. */
  requiredRoles?: UserRole[];
}

// ============================================
// Anthropic tool_use format
// ============================================

export interface AnthropicToolDefinition {
  name: string;
  description: string;
  input_schema: JSONSchema;
}

// ============================================
// OpenAI/Ollama tool format
// ============================================

export interface OllamaToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: JSONSchema;
  };
}

// ============================================
// Tool Call (from LLM response)
// ============================================

export interface ToolCall {
  id?: string;           // Anthropic tool_use_id
  name: string;
  arguments: Record<string, unknown>;
}

// ============================================
// Agent Task & Step (DB models)
// ============================================

export type AgentTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

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
  thought?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: string;
  tokensUsed: number;
  durationMs: number;
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
  maxIterations: parseInt(process.env.MAX_AGENT_ITERATIONS || '10', 10),
  defaultModel: process.env.AGENT_DEFAULT_MODEL || 'anthropic:claude-sonnet-4-6',
  timeoutMs: parseInt(process.env.AGENT_TIMEOUT_MS || '300000', 10),
  maxToolOutputLength: 10000,
};
