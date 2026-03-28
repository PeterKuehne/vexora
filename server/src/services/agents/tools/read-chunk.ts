/**
 * Read Chunk Tool - Reads a specific document chunk with context expansion
 *
 * Uses getChunksByDocumentIds to directly fetch chunks from Weaviate,
 * then finds the target chunk and surrounding chunks for context.
 */

import type { AgentTool, AgentUserContext, ToolResult } from '../types.js';
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

  async execute(args: Record<string, unknown>, context: AgentUserContext): Promise<ToolResult> {
    try {
      const chunkId = args.chunkId as string;
      const expandContext = (args.expandContext as boolean) ?? true;

      const parts = chunkId.split(':');
      if (parts.length < 2) {
        return { output: 'Ungültiges Chunk-ID Format. Erwartet: "documentId:chunkIndex"', error: 'invalid_chunk_id' };
      }

      const documentId = parts.slice(0, -1).join(':');
      const chunkIndex = parseInt(parts[parts.length - 1]!, 10);

      // Permission check: verify user has access to this document
      if (context.allowedDocumentIds && !context.allowedDocumentIds.includes(documentId)) {
        return {
          output: 'ZUGRIFF VERWEIGERT: Der Benutzer hat keine Berechtigung, dieses Dokument zu lesen. Teile dem Benutzer mit, dass er keinen Zugriff auf dieses Dokument hat und sich ggf. an einen Administrator wenden soll.',
          error: 'access_denied',
        };
      }

      if (isNaN(chunkIndex)) {
        return { output: 'Ungültiger chunkIndex. Muss eine Zahl sein.', error: 'invalid_chunk_index' };
      }

      // Fetch chunks directly from Weaviate by documentId
      const allChunks = await vectorServiceV2.getChunksByDocumentIds([documentId], {
        maxChunksPerDocument: expandContext ? 50 : 5,
        levelFilter: [1, 2],
      });

      if (allChunks.length === 0) {
        return { output: `Keine Chunks für Dokument "${documentId}" gefunden. Möglicherweise ist die Document-ID ungültig.` };
      }

      // Find the target chunk
      const targetChunk = allChunks.find(r => r.chunk.chunkIndex === chunkIndex);

      if (!targetChunk) {
        // Show available chunk indices as hint
        const availableIndices = allChunks.map(r => r.chunk.chunkIndex).sort((a, b) => a - b);
        return {
          output: `Chunk-Index ${chunkIndex} nicht gefunden in Dokument "${targetChunk || allChunks[0]?.document.originalName}". Verfügbare Indices: ${availableIndices.join(', ')}`,
        };
      }

      let output = `Dokument: ${targetChunk.document.originalName}\n`;
      output += `Chunk: ${chunkIndex}/${targetChunk.chunk.totalChunks}\n`;
      if (targetChunk.chunk.pageStart) {
        output += `Seite: ${targetChunk.chunk.pageStart}${targetChunk.chunk.pageEnd && targetChunk.chunk.pageEnd !== targetChunk.chunk.pageStart ? `-${targetChunk.chunk.pageEnd}` : ''}\n`;
      }
      output += `\n${targetChunk.chunk.content}`;

      if (expandContext) {
        const adjacentChunks = allChunks
          .filter(r =>
            Math.abs(r.chunk.chunkIndex - chunkIndex) <= 2 &&
            r.chunk.chunkIndex !== chunkIndex
          )
          .sort((a, b) => a.chunk.chunkIndex - b.chunk.chunkIndex);

        if (adjacentChunks.length > 0) {
          output += '\n\n--- Zusätzlicher Kontext ---\n';
          for (const adj of adjacentChunks) {
            output += `\n[Chunk ${adj.chunk.chunkIndex}]: ${adj.chunk.content.substring(0, 500)}${adj.chunk.content.length > 500 ? '...' : ''}\n`;
          }
        }
      }

      return {
        output,
        metadata: {
          documentId,
          chunkIndex,
          documentName: targetChunk.document.originalName,
          totalChunks: targetChunk.chunk.totalChunks,
        },
      };
    } catch (error) {
      return {
        output: `Fehler beim Lesen: ${error instanceof Error ? error.message : String(error)}`,
        error: String(error),
      };
    }
  },
};
