/**
 * List Agents Tool - Shows available subagents
 */

import { z } from 'zod';
import { listSubagents } from '../SubagentLoader.js';
import type { AgentTool, AgentUserContext, ToolResult } from '../types.js';

export const listAgentsTool: AgentTool = {
  name: 'list_agents',
  description: 'Zeigt verfuegbare Subagents mit Beschreibungen und erlaubten Tools.',
  inputSchema: z.object({}),
  parameters: {
    type: 'object',
    required: [],
    properties: {},
  },

  async execute(_args: Record<string, unknown>, context: AgentUserContext): Promise<ToolResult> {
    const agents = listSubagents(context.tenantId);

    if (agents.length === 0) {
      return { output: 'Keine Subagents verfuegbar.', metadata: { count: 0 } };
    }

    const formatted = agents.map(a =>
      `- **${a.name}** (${a.source}): ${a.description}\n  Tools: ${a.tools.join(', ')} | Max Steps: ${a.maxSteps}`
    ).join('\n\n');

    return {
      output: `${agents.length} Subagent(s) verfuegbar:\n\n${formatted}\n\nNutze das agent-Tool mit agentType um einen Subagent zu starten.`,
      metadata: { count: agents.length },
    };
  },
};
