/**
 * ToolRegistry - Central registry for agent tools
 *
 * Singleton that manages tool registration and provides tool definitions
 * in both Anthropic and OpenAI/Ollama formats.
 */

import { tool as aiTool, jsonSchema } from 'ai';
import type { Tool } from 'ai';
import type {
  AgentTool,
  AgentUserContext,
  AnthropicToolDefinition,
  OllamaToolDefinition,
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
   * Skill-gated tools are excluded unless their parent skill slug
   * is in the loadedSkills set.
   */
  getAvailableTools(context: AgentUserContext, loadedSkills?: Set<string>): AgentTool[] {
    return Array.from(this.tools.values()).filter(tool => {
      // Role check
      if (tool.requiredRoles && tool.requiredRoles.length > 0) {
        if (!tool.requiredRoles.includes(context.userRole)) return false;
      }
      // Skill-gating check: exclude unless the required skill was loaded
      if (tool.skillGated) {
        if (!loadedSkills || !loadedSkills.has(tool.skillGated)) return false;
      }
      return true;
    });
  }

  /**
   * Get tool definitions in Anthropic format (for Claude API)
   */
  getAnthropicTools(context: AgentUserContext, loadedSkills?: Set<string>): AnthropicToolDefinition[] {
    return this.getAvailableTools(context, loadedSkills).map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters,
    }));
  }

  /**
   * Get tool definitions in OpenAI/Ollama format
   */
  getOllamaTools(context: AgentUserContext, loadedSkills?: Set<string>): OllamaToolDefinition[] {
    return this.getAvailableTools(context, loadedSkills).map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  /**
   * Get tools in Vercel AI SDK format (Tool) for use with generateText/streamText.
   * loadedSkills: set of skill slugs that have been loaded via load_skill — their
   * gated tools become available (Anthropic allowed-tools pattern).
   */
  getAISDKTools(context: AgentUserContext, allowedTools?: string[], loadedSkills?: Set<string>): Record<string, Tool> {
    let tools = this.getAvailableTools(context, loadedSkills);
    if (allowedTools) {
      const allowed = new Set(allowedTools);
      tools = tools.filter(t => allowed.has(t.name));
    }

    const result: Record<string, Tool> = {};
    for (const agentTool of tools) {
      result[agentTool.name] = aiTool({
        description: agentTool.description,
        inputSchema: jsonSchema(agentTool.parameters as any),
        execute: async (args) => {
          const toolResult = await agentTool.execute(args as Record<string, unknown>, context);
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
