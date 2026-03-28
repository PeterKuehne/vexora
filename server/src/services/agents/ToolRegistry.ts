/**
 * ToolRegistry - Central registry for agent tools
 *
 * Singleton that manages tool registration and provides tool definitions
 * in Vercel AI SDK format for use with ToolLoopAgent.
 */

import { tool as aiTool } from 'ai';
import type { Tool } from 'ai';
import type {
  AgentTool,
  AgentUserContext,
} from './types.js';

class ToolRegistryImpl {
  private tools: Map<string, AgentTool> = new Map();

  /**
   * Register a tool
   */
  register(tool: AgentTool): void {
    if (this.tools.has(tool.name)) {
      console.warn(`[ToolRegistry] Overwriting existing tool: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
    console.log(`[ToolRegistry] Registered tool: ${tool.name}`);
  }

  /**
   * Unregister a tool
   */
  unregister(name: string): boolean {
    const removed = this.tools.delete(name);
    if (removed) {
      console.log(`[ToolRegistry] Unregistered tool: ${name}`);
    }
    return removed;
  }

  /**
   * Get a specific tool by name
   */
  getTool(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all tools available for a given user context.
   * Respects requiredRoles and skill-gating (allowed-tools pattern).
   */
  getAvailableTools(context: AgentUserContext, loadedSkills?: Set<string>): AgentTool[] {
    return Array.from(this.tools.values()).filter(tool => {
      if (tool.requiredRoles && tool.requiredRoles.length > 0) {
        if (!tool.requiredRoles.includes(context.userRole)) return false;
      }
      if (tool.skillGated) {
        if (!loadedSkills || !loadedSkills.has(tool.skillGated)) return false;
      }
      return true;
    });
  }

  /**
   * Get tools in Vercel AI SDK format (Tool) for use with generateText/streamText.
   */
  getAISDKTools(context: AgentUserContext, allowedTools?: string[], loadedSkills?: Set<string>, options?: { strict?: boolean }): Record<string, Tool> {
    let tools = this.getAvailableTools(context, loadedSkills);
    if (allowedTools) {
      const allowed = new Set(allowedTools);
      tools = tools.filter(t => allowed.has(t.name));
    }

    const useStrict = options?.strict ?? false;

    const result: Record<string, Tool> = {};
    for (const agentTool of tools) {
      result[agentTool.name] = aiTool({
        description: agentTool.description,
        inputSchema: agentTool.inputSchema,
        ...(useStrict ? { strict: true } : {}),
        execute: async (args, { abortSignal }) => {
          const toolResult = await agentTool.execute(
            args as Record<string, unknown>,
            context,
            { abortSignal },
          );
          return toolResult.output;
        },
      });
    }
    return result;
  }

  /**
   * Get all registered tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Get tool count
   */
  get size(): number {
    return this.tools.size;
  }
}

// Singleton
export const toolRegistry = new ToolRegistryImpl();
