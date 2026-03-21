/**
 * Graph Query Tool - Queries the Neo4j knowledge graph for entity relationships
 */

import type { AgentTool, ToolResult } from '../types.js';

export const graphQueryTool: AgentTool = {
  name: 'graph_query',
  description: 'Query the knowledge graph to find entities and their relationships extracted from documents. Use this to discover connections between people, organizations, concepts, and topics.',
  parameters: {
    type: 'object',
    required: ['query'],
    properties: {
      query: {
        type: 'string',
        description: 'Entity name or concept to search for in the knowledge graph',
      },
    },
  },

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    try {
      // Graph service is optional and may not be initialized
      const { ragService } = await import('../../index.js');
      const graphService = (ragService as any).graphService;

      if (!graphService) {
        return { output: 'Wissensgraph ist nicht aktiviert (GRAPH_ENABLED=false).' };
      }

      const query = args.query as string;
      const entities = await graphService.findEntities([query]);

      if (entities.length === 0) {
        return { output: `Keine Entitäten für "${query}" im Wissensgraphen gefunden.` };
      }

      let output = `Gefundene Entitäten (${entities.length}):\n\n`;
      for (const entity of entities) {
        output += `- ${entity.name} (${entity.type})\n`;
        if ((entity as any).properties) {
          output += `  Eigenschaften: ${JSON.stringify((entity as any).properties)}\n`;
        }
      }

      return {
        output,
        metadata: { entityCount: entities.length },
      };
    } catch (error) {
      return {
        output: `Wissensgraph nicht verfügbar: ${error instanceof Error ? error.message : String(error)}`,
        error: String(error),
      };
    }
  },
};
