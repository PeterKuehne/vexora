/**
 * Agent System - Barrel export and initialization
 */

export { toolRegistry } from './ToolRegistry.js';
export { agentPersistence } from './AgentPersistence.js';
export { agentExecutor } from './AgentExecutor.js';
export type { SSEEmitter } from './AgentExecutor.js';
export { resolveModel, parseModelString, hasProvider, isCloudModel, getProviderOptions, getCloudModels } from './ai-provider.js';
export { loadExpertAgents, getExpertAgent, listExpertAgents, clearExpertAgentCache, createExpertAgentTool } from './ExpertAgentLoader.js';
export { setPIIGuard, createGuardedModel, ensurePIIGuardAvailable, maskMessages, unmaskContent } from './ai-middleware.js';
export type {
  AgentTool,
  AgentTask,
  AgentStep,
  AgentSSEEvent,
  AgentUserContext,
  AgentConfig,
  AgentTaskStatus,
  AgentStrategy,
  ToolResult,
  ToolCall,
  AgentMessage,
  ExpertAgentHarness,
  Guardrail,
  PanelData,
} from './types.js';

import { registerBuiltinTools } from './tools/index.js';
import { agentPersistence } from './AgentPersistence.js';

/**
 * Initialize the agent system - register built-in tools, cleanup stale tasks
 */
export async function initializeAgentSystem(): Promise<void> {
  registerBuiltinTools();

  // Cancel tasks stuck in running/pending from a previous server instance
  try {
    const cleaned = await agentPersistence.cleanupStaleTasks();
    if (cleaned > 0) {
      console.log(`[AgentSystem] ${cleaned} stale task(s) cancelled`);
    }
  } catch (error) {
    console.warn('[AgentSystem] Failed to cleanup stale tasks:', error);
  }

  console.log('[AgentSystem] Agent system initialized');
}
