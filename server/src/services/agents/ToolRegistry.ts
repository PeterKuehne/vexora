/**
 * ToolRegistry - Central registry for agent tools
 *
 * Singleton that manages tool registration and provides tool definitions
 * in both Anthropic and OpenAI/Ollama formats.
 */

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
   * Get all tools available for a given user context (respects requiredRoles)
   */
  getAvailableTools(context: AgentUserContext): AgentTool[] {
    return Array.from(this.tools.values()).filter(tool => {
      if (!tool.requiredRoles || tool.requiredRoles.length === 0) return true;
      return tool.requiredRoles.includes(context.userRole);
    });
  }

  /**
   * Get tool definitions in Anthropic format (for Claude API)
   */
  getAnthropicTools(context: AgentUserContext): AnthropicToolDefinition[] {
    return this.getAvailableTools(context).map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters,
    }));
  }

  /**
   * Get tool definitions in OpenAI/Ollama format
   */
  getOllamaTools(context: AgentUserContext): OllamaToolDefinition[] {
    return this.getAvailableTools(context).map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
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
