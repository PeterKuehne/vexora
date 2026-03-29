/**
 * Built-in Tools - Registration for the Agent Framework
 */

import { toolRegistry } from '../ToolRegistry.js';
import { ragSearchTool } from './rag-search.js';
import { graphQueryTool } from './graph-query.js';
import { readChunkTool } from './read-chunk.js';
import { sqlQueryTool } from './sql-query.js';
import { createDocumentTool } from './create-document.js';
import { sendNotificationTool } from './send-notification.js';
import { listSkillsTool } from './list-skills.js';
import { loadSkillTool } from './load-skill.js';
import { createSkillTool } from './create-skill.js';
import { updateSkillTool } from './update-skill.js';
import { runSkillTestTool } from './run-skill-test.js';
import { agentTool } from './agent.js';
import { listAgentsTool } from './list-agents.js';
import { createAgentTool } from './create-agent.js';

/**
 * Register all built-in tools with the ToolRegistry
 */
export function registerBuiltinTools(): void {
  // Core tools
  toolRegistry.register(ragSearchTool);
  toolRegistry.register(graphQueryTool);
  toolRegistry.register(readChunkTool);
  toolRegistry.register(sqlQueryTool);
  toolRegistry.register(createDocumentTool);
  toolRegistry.register(sendNotificationTool);

  // Skill tools
  toolRegistry.register(listSkillsTool);
  toolRegistry.register(loadSkillTool);
  toolRegistry.register(createSkillTool);
  toolRegistry.register(updateSkillTool);
  toolRegistry.register(runSkillTestTool);

  // Subagent tools
  toolRegistry.register(agentTool);
  toolRegistry.register(listAgentsTool);
  toolRegistry.register(createAgentTool);

  console.log(`[AgentSystem] ${toolRegistry.size} built-in tools registered`);
}
