/**
 * Read Chunk Tool - Reads a specific document chunk with context expansion
 */

import type { AgentTool, ToolResult } from '../types.js';
import { vectorServiceV2 } from '../../VectorServiceV2.js';

export const readChunkTool: AgentTool = {
  name: 'read_chunk',
  description: 'Read a specific document chunk by its ID (from a previous rag_search result) with optional context expansion. Use this to get more details about a search result.',
  parameters: {
    type: 'object',
    required: ['chunkId'],
    properties: {
      chunkId: {
        type: 'string',
        description: 'The chunk ID in format "documentId:chunkIndex" from a previous search result',
      },
      expandContext: {
        type: 'boolean',
        description: 'Whether to include surrounding chunks for more context (default: true)',
      },
    },
  },

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    try {
      const chunkId = args.chunkId as string;
      const expandContext = (args.expandContext as boolean) ?? true;

      const parts = chunkId.split(':');
      if (parts.length < 2) {
        return { output: `Ungültiges Chunk-ID Format. Erwartet: "documentId:chunkIndex"`, error: 'invalid_chunk_id' };
      }

      const documentId = parts.slice(0, -1).join(':');
      const chunkIndex = parseInt(parts[parts.length - 1]!, 10);

      // Search for the specific chunk
      const results = await vectorServiceV2.search({
        query: '', // We'll find by document
        limit: expandContext ? 10 : 1,
        threshold: 0,
        hybridAlpha: 0.5,
        allowedDocumentIds: [documentId],
        levelFilter: [1, 2],
      });

      const targetChunk = results.results.find(
        r => r.chunk.documentId === documentId && r.chunk.chunkIndex === chunkIndex
      );

      if (!targetChunk) {
        return { output: `Chunk "${chunkId}" nicht gefunden.` };
      }

      let output = `Dokument: ${targetChunk.document.originalName}\n`;
      output += `Seite: ${targetChunk.chunk.pageStart || 'N/A'}\n\n`;
      output += targetChunk.chunk.content;

      if (expandContext) {
        const adjacentChunks = results.results
          .filter(r =>
            r.chunk.documentId === documentId &&
            Math.abs(r.chunk.chunkIndex - chunkIndex) <= 2 &&
            r.chunk.chunkIndex !== chunkIndex
          )
          .sort((a, b) => a.chunk.chunkIndex - b.chunk.chunkIndex);

        if (adjacentChunks.length > 0) {
          output += '\n\nZusätzlicher Kontext:\n';
          for (const adj of adjacentChunks) {
            output += `\n[Chunk ${adj.chunk.chunkIndex}]: ${adj.chunk.content.substring(0, 400)}...\n`;
          }
        }
      }

      return { output };
    } catch (error) {
      return {
        output: `Fehler beim Lesen: ${error instanceof Error ? error.message : String(error)}`,
        error: String(error),
      };
    }
  },
};
