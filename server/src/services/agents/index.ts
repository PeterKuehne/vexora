/**
 * Agent System - Barrel export and initialization
 */

export { toolRegistry } from './ToolRegistry.js';
export { agentPersistence } from './AgentPersistence.js';
export { agentExecutor } from './AgentExecutor.js';
export type { SSEEmitter } from './AgentExecutor.js';
export { resolveModel, parseModelString, hasProvider, isCloudModel, getProviderOptions, getCloudModels } from './ai-provider.js';
export { setPIIGuard, createGuardedModel, ensurePIIGuardAvailable, maskMessages, unmaskContent } from './ai-middleware.js';
export type {
  AgentTool,
  AgentTask,
  AgentStep,
  AgentSSEEvent,
  AgentUserContext,
  AgentConfig,
  AgentTaskStatus,
  ToolResult,
  ToolCall,
} from './types.js';

import { registerBuiltinTools } from './tools/index.js';

/**
 * Initialize the agent system - register built-in tools
 */
export function initializeAgentSystem(): void {
  registerBuiltinTools();
  console.log('[AgentSystem] Agent system initialized');
}
