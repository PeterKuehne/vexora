/**
 * RAG Search Tool - Searches the document vector store
 */

import type { AgentTool, AgentUserContext, ToolResult } from '../types.js';
import { vectorServiceV2 } from '../../VectorServiceV2.js';

export const ragSearchTool: AgentTool = {
  name: 'rag_search',
  description: 'Search the document knowledge base using hybrid search (keyword + semantic). Returns relevant document chunks with scores. Use this to find information in uploaded documents.',
  parameters: {
    type: 'object',
    required: ['query'],
    properties: {
      query: {
        type: 'string',
        description: 'The search query - be specific with keywords or describe the concept you are looking for',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results (default: 5, max: 15)',
      },
      searchMode: {
        type: 'string',
        description: 'Search mode: "keyword" (BM25-focused), "semantic" (vector-focused), or "hybrid" (balanced). Default: "hybrid"',
        enum: ['keyword', 'semantic', 'hybrid'],
      },
    },
  },

  async execute(args: Record<string, unknown>, context: AgentUserContext): Promise<ToolResult> {
    try {
      const query = args.query as string;
      const limit = Math.min((args.limit as number) || 5, 15);
      const searchMode = (args.searchMode as string) || 'hybrid';

      // Determine hybridAlpha based on search mode
      const hybridAlpha = searchMode === 'keyword' ? 0.2
        : searchMode === 'semantic' ? 0.8
        : 0.3; // hybrid default (German-optimized)

      const results = await vectorServiceV2.search({
        query,
        limit,
        threshold: 0.1,
        hybridAlpha,
        allowedDocumentIds: context.allowedDocumentIds,
        levelFilter: [1, 2],
      });

      if (results.results.length === 0) {
        const hasRestrictions = context.allowedDocumentIds && context.allowedDocumentIds.length > 0;
        const noAccess = context.allowedDocumentIds && context.allowedDocumentIds.length === 0;

        if (noAccess) {
          return { output: 'Keine Ergebnisse: Der Benutzer hat aktuell keinen Zugriff auf Dokumente in der Wissensdatenbank. Teile dem Benutzer mit, dass er keine Berechtigung für Dokumente hat und sich ggf. an einen Administrator wenden soll.' };
        }

        return {
          output: hasRestrictions
            ? 'Keine relevanten Dokumente gefunden. Hinweis: Die Suche wurde auf Dokumente eingeschränkt, für die der Benutzer eine Berechtigung hat. Es könnten weitere Dokumente existieren, auf die der Benutzer keinen Zugriff hat.'
            : 'Keine relevanten Dokumente gefunden.',
        };
      }

      let output = `Gefunden: ${results.results.length} Ergebnisse\n\n`;
      for (const result of results.results) {
        const chunkKey = `${result.chunk.documentId}:${result.chunk.chunkIndex}`;
        output += `---\n`;
        output += `ID: ${chunkKey}\n`;
        output += `Dokument: ${result.document.originalName}\n`;
        output += `Score: ${result.score.toFixed(3)}\n`;
        output += `Seite: ${result.chunk.pageStart || 'N/A'}\n`;
        output += `Inhalt: ${result.chunk.content.substring(0, 500)}${result.chunk.content.length > 500 ? '...' : ''}\n\n`;
      }

      return {
        output,
        metadata: {
          resultCount: results.results.length,
          sources: results.results.map(r => ({
            documentId: r.chunk.documentId,
            documentName: r.document.originalName,
            chunkId: `${r.chunk.documentId}:${r.chunk.chunkIndex}`,
            score: r.score,
          })),
        },
      };
    } catch (error) {
      return {
        output: `Fehler bei der Suche: ${error instanceof Error ? error.message : String(error)}`,
        error: String(error),
      };
    }
  },
};
