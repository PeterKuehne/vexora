/**
 * MCP Tool Adapter
 * Converts MCP tools (from tools/list) into Cor7ex AgentTool format
 * and registers them with the ToolRegistry
 */

import { z } from 'zod';
import type { AgentTool, AgentUserContext, ToolResult } from '../agents/types.js';
import type { McpClientManager } from './McpClientManager.js';

interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, {
      type?: string;
      description?: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

/**
 * Convert an MCP tool definition to a Cor7ex AgentTool
 */
export function mcpToolToAgentTool(
  mcpTool: McpToolDefinition,
  prefix: string,
  manager: McpClientManager,
): AgentTool {
  const toolName = `${prefix}_${mcpTool.name}`;

  // Build Zod schema from MCP JSON Schema
  const zodSchema = buildZodSchema(mcpTool.inputSchema);

  return {
    name: toolName,
    description: mcpTool.description || `MCP tool: ${mcpTool.name}`,
    inputSchema: zodSchema,

    async execute(
      args: Record<string, unknown>,
      context: AgentUserContext,
    ): Promise<ToolResult> {
      try {
        const result = await manager.callTool(mcpTool.name, args);
        const output = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
        return { output: output || '(empty result)' };
      } catch (error) {
        const errorMsg = `MCP tool ${mcpTool.name} failed: ${error instanceof Error ? error.message : String(error)}`;
        console.error(`[MCP Tool] ${errorMsg}`);
        return { output: errorMsg, error: errorMsg };
      }
    },
  };
}

/**
 * Build a Zod schema from MCP JSON Schema properties
 */
function buildZodSchema(schema?: McpToolDefinition['inputSchema']): z.ZodType {
  if (!schema?.properties) {
    return z.object({}).passthrough();
  }

  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, prop] of Object.entries(schema.properties)) {
    let zodField: z.ZodTypeAny;

    switch (prop.type) {
      case 'string':
        zodField = prop.enum
          ? z.enum(prop.enum as [string, ...string[]])
          : z.string();
        break;
      case 'number':
      case 'integer':
        zodField = z.number();
        break;
      case 'boolean':
        zodField = z.boolean();
        break;
      default:
        zodField = z.unknown();
    }

    if (prop.description) {
      zodField = zodField.describe(prop.description);
    }

    // Make optional if not in required list
    if (!schema.required?.includes(key)) {
      zodField = zodField.optional();
    }

    shape[key] = zodField;
  }

  return z.object(shape);
}
