/**
 * AgenticRAG Service (A-RAG)
 * Based on arXiv:2602.03442 - Hierarchical Retrieval Interfaces
 *
 * Instead of retrieval as preprocessing, the LLM has direct access to
 * retrieval tools and decides when and how to search.
 *
 * Recommended Model: Qwen3 8B+ (best tool calling accuracy for local models)
 *
 * Tools:
 * 1. keyword_search - BM25 lexical search for explicit terms
 * 2. semantic_search - Vector-based search for concepts
 * 3. read_chunk - Fine-grained reading with context expansion
 */

import { ollamaService } from '../OllamaService.js';
import { vectorServiceV2, type SearchResultV2 } from '../VectorServiceV2.js';
import type { ChatMessage } from '../../validation/index.js';

// ============================================
// Types
// ============================================

export interface AgenticRAGConfig {
  /** Model for agentic reasoning (must support tool calling) */
  model: string;
  /** Maximum iterations before stopping */
  maxIterations: number;
  /** Temperature for tool selection (lower = more deterministic) */
  temperature: number;
  /** Whether to include thinking process in response */
  includeThinking: boolean;
  /** Search limit for retrieval tools */
  searchLimit: number;
  /** Minimum score threshold */
  searchThreshold: number;
}

export const DEFAULT_AGENTIC_CONFIG: AgenticRAGConfig = {
  model: process.env.AGENTIC_RAG_MODEL || 'qwen3:8b',
  maxIterations: 5,
  temperature: 0.1,
  includeThinking: false,
  searchLimit: 10,
  searchThreshold: 0.1,
};

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      required: string[];
      properties: Record<string, {
        type: string;
        description: string;
        enum?: string[];
      }>;
    };
  };
}

export interface ToolCall {
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

export interface AgenticRAGResult {
  answer: string;
  sources: SearchResultV2[];
  toolCalls: Array<{
    tool: string;
    args: Record<string, unknown>;
    result: string;
  }>;
  iterations: number;
  thinking?: string;
}

// ============================================
// Tool Definitions
// ============================================

const RETRIEVAL_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'keyword_search',
      description: 'Search for documents using exact keyword matching (BM25). Use this when looking for specific terms, names, dates, or technical terminology.',
      parameters: {
        type: 'object',
        required: ['query'],
        properties: {
          query: {
            type: 'string',
            description: 'The search query with specific keywords to find',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default: 5)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'semantic_search',
      description: 'Search for documents using semantic similarity. Use this when looking for concepts, topics, or when the exact wording is unknown.',
      parameters: {
        type: 'object',
        required: ['query'],
        properties: {
          query: {
            type: 'string',
            description: 'The search query describing the concept or topic to find',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default: 5)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_chunk',
      description: 'Read a specific chunk by ID with optional context expansion. Use this to get more details about a previously found result.',
      parameters: {
        type: 'object',
        required: ['chunkId'],
        properties: {
          chunkId: {
            type: 'string',
            description: 'The ID of the chunk to read (from previous search results)',
          },
          expandContext: {
            type: 'boolean',
            description: 'Whether to include surrounding chunks for more context (default: true)',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'answer_question',
      description: 'Provide the final answer to the user question. Use this when you have gathered enough information to answer comprehensively.',
      parameters: {
        type: 'object',
        required: ['answer'],
        properties: {
          answer: {
            type: 'string',
            description: 'The complete answer to the user question, citing relevant sources',
          },
        },
      },
    },
  },
];

// ============================================
// System Prompt
// ============================================

const SYSTEM_PROMPT = `Du bist ein intelligenter Assistent mit Zugriff auf eine Dokumentendatenbank. Du kannst verschiedene Such-Tools verwenden, um Informationen zu finden.

WICHTIGE REGELN:
1. Analysiere die Frage zuerst - überlege welche Art von Suche am besten passt
2. Verwende keyword_search für exakte Begriffe, Namen, Daten
3. Verwende semantic_search für Konzepte und Themen
4. Du kannst mehrere Suchen durchführen, wenn die erste nicht ausreichend ist
5. Verwende read_chunk um mehr Details zu einem Ergebnis zu bekommen
6. Wenn du genug Informationen hast, nutze answer_question mit einer vollständigen Antwort
7. Zitiere immer die Quellen in deiner Antwort

ABLAUF:
1. Verstehe die Frage
2. Wähle das passende Such-Tool
3. Analysiere die Ergebnisse
4. Entscheide: Mehr suchen oder antworten?
5. Wenn bereit: Beantworte mit answer_question

Antworte auf Deutsch.`;

// ============================================
// AgenticRAG Class
// ============================================

export class AgenticRAG {
  private config: AgenticRAGConfig;
  private collectedSources: Map<string, SearchResultV2> = new Map();

  constructor(config?: Partial<AgenticRAGConfig>) {
    this.config = { ...DEFAULT_AGENTIC_CONFIG, ...config };
  }

  /**
   * Process a query using agentic RAG with tool calling
   */
  async query(
    userQuery: string,
    allowedDocumentIds?: string[]
  ): Promise<AgenticRAGResult> {
    console.log(`🤖 A-RAG: Processing query with ${this.config.model}`);

    // Reset state
    this.collectedSources.clear();

    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userQuery },
    ];

    const toolCallHistory: AgenticRAGResult['toolCalls'] = [];
    let thinkingLog = '';
    let iterations = 0;
    let finalAnswer = '';

    while (iterations < this.config.maxIterations) {
      iterations++;
      console.log(`   Iteration ${iterations}/${this.config.maxIterations}`);

      try {
        // Call LLM with tools
        const response = await this.callWithTools(messages);

        // Check for thinking content
        if (response.thinking) {
          thinkingLog += `[Iteration ${iterations}] ${response.thinking}\n`;
        }

        // Check if model wants to call a tool
        if (response.toolCalls && response.toolCalls.length > 0) {
          for (const toolCall of response.toolCalls) {
            const toolName = toolCall.function.name;
            const toolArgs = toolCall.function.arguments;

            console.log(`   🔧 Tool: ${toolName}`, toolArgs);

            // Check if this is the final answer
            if (toolName === 'answer_question') {
              finalAnswer = toolArgs.answer as string;
              console.log(`   ✅ Final answer received`);
              break;
            }

            // Execute the tool
            const toolResult = await this.executeTool(
              toolName,
              toolArgs,
              allowedDocumentIds
            );

            // Record the tool call
            toolCallHistory.push({
              tool: toolName,
              args: toolArgs,
              result: toolResult.substring(0, 500) + (toolResult.length > 500 ? '...' : ''),
            });

            // Add tool result to messages
            messages.push({
              role: 'assistant',
              content: `Using tool: ${toolName}`,
            });
            messages.push({
              role: 'user',
              content: `Tool result for ${toolName}:\n${toolResult}`,
            });
          }

          // If we have a final answer, stop
          if (finalAnswer) {
            break;
          }
        } else if (response.content) {
          // Model responded without tool call - treat as answer
          finalAnswer = response.content;
          break;
        }
      } catch (error) {
        console.error(`   ❌ Error in iteration ${iterations}:`, error);
        break;
      }
    }

    // If no answer was generated, create a fallback
    if (!finalAnswer) {
      finalAnswer = 'Entschuldigung, ich konnte keine ausreichenden Informationen finden, um die Frage zu beantworten.';
    }

    console.log(`🤖 A-RAG: Completed in ${iterations} iterations with ${this.collectedSources.size} sources`);

    return {
      answer: finalAnswer,
      sources: Array.from(this.collectedSources.values()),
      toolCalls: toolCallHistory,
      iterations,
      thinking: this.config.includeThinking ? thinkingLog : undefined,
    };
  }

  /**
   * Call LLM with tool definitions
   */
  private async callWithTools(messages: ChatMessage[]): Promise<{
    content?: string;
    thinking?: string;
    toolCalls?: ToolCall[];
  }> {
    // Use Ollama's native tool calling
    const response = await ollamaService.chat({
      model: this.config.model,
      messages,
      options: {
        temperature: this.config.temperature,
      },
      // Pass tools in the format Ollama expects
      tools: RETRIEVAL_TOOLS as any,
    });

    // Parse response
    const result: {
      content?: string;
      thinking?: string;
      toolCalls?: ToolCall[];
    } = {};

    if (response.message.content) {
      // Check for thinking tags (Qwen3 style)
      const thinkMatch = response.message.content.match(/<think>([\s\S]*?)<\/think>/);
      if (thinkMatch) {
        result.thinking = thinkMatch[1].trim();
        result.content = response.message.content.replace(/<think>[\s\S]*?<\/think>/, '').trim();
      } else {
        result.content = response.message.content;
      }
    }

    // Check for tool calls in the response
    if ((response.message as any).tool_calls) {
      result.toolCalls = (response.message as any).tool_calls.map((tc: any) => ({
        function: {
          name: tc.function.name,
          arguments: typeof tc.function.arguments === 'string'
            ? JSON.parse(tc.function.arguments)
            : tc.function.arguments,
        },
      }));
    }

    return result;
  }

  /**
   * Execute a retrieval tool
   */
  private async executeTool(
    toolName: string,
    args: Record<string, unknown>,
    allowedDocumentIds?: string[]
  ): Promise<string> {
    switch (toolName) {
      case 'keyword_search':
        return this.executeKeywordSearch(
          args.query as string,
          (args.limit as number) || 5,
          allowedDocumentIds
        );

      case 'semantic_search':
        return this.executeSemanticSearch(
          args.query as string,
          (args.limit as number) || 5,
          allowedDocumentIds
        );

      case 'read_chunk':
        return this.executeReadChunk(
          args.chunkId as string,
          (args.expandContext as boolean) ?? true
        );

      default:
        return `Unknown tool: ${toolName}`;
    }
  }

  /**
   * Execute keyword search (BM25-focused)
   */
  private async executeKeywordSearch(
    query: string,
    limit: number,
    allowedDocumentIds?: string[]
  ): Promise<string> {
    try {
      const results = await vectorServiceV2.search({
        query,
        limit: Math.min(limit, this.config.searchLimit),
        threshold: this.config.searchThreshold,
        hybridAlpha: 0.2, // 80% BM25, 20% semantic
        allowedDocumentIds,
        levelFilter: [1, 2], // Sections and paragraphs
      });

      if (results.results.length === 0) {
        return 'Keine Ergebnisse gefunden.';
      }

      // Store sources
      for (const result of results.results) {
        const key = `${result.chunk.documentId}:${result.chunk.chunkIndex}`;
        this.collectedSources.set(key, result);
      }

      // Format results for LLM
      return this.formatSearchResults(results.results, 'keyword');
    } catch (error) {
      return `Fehler bei der Keyword-Suche: ${error}`;
    }
  }

  /**
   * Execute semantic search (vector-focused)
   */
  private async executeSemanticSearch(
    query: string,
    limit: number,
    allowedDocumentIds?: string[]
  ): Promise<string> {
    try {
      const results = await vectorServiceV2.search({
        query,
        limit: Math.min(limit, this.config.searchLimit),
        threshold: this.config.searchThreshold,
        hybridAlpha: 0.8, // 20% BM25, 80% semantic
        allowedDocumentIds,
        levelFilter: [1, 2],
      });

      if (results.results.length === 0) {
        return 'Keine Ergebnisse gefunden.';
      }

      // Store sources
      for (const result of results.results) {
        const key = `${result.chunk.documentId}:${result.chunk.chunkIndex}`;
        this.collectedSources.set(key, result);
      }

      return this.formatSearchResults(results.results, 'semantic');
    } catch (error) {
      return `Fehler bei der semantischen Suche: ${error}`;
    }
  }

  /**
   * Execute read chunk with context
   */
  private async executeReadChunk(
    chunkId: string,
    expandContext: boolean
  ): Promise<string> {
    try {
      // Find chunk in collected sources
      const source = this.collectedSources.get(chunkId);

      if (source) {
        let content = `**Dokument:** ${source.document.originalName}\n`;
        content += `**Seite:** ${source.chunk.pageStart}\n\n`;
        content += source.chunk.content;

        if (expandContext) {
          // Try to get surrounding chunks
          const docId = source.chunk.documentId;
          const chunkIndex = source.chunk.chunkIndex;

          // Get adjacent chunks
          const adjacentResults = await vectorServiceV2.search({
            query: source.chunk.content.substring(0, 100),
            limit: 5,
            threshold: 0,
            hybridAlpha: 0.5,
            allowedDocumentIds: [docId],
            levelFilter: [2],
          });

          const adjacentChunks = adjacentResults.results
            .filter(r =>
              r.chunk.documentId === docId &&
              Math.abs(r.chunk.chunkIndex - chunkIndex) <= 2 &&
              r.chunk.chunkIndex !== chunkIndex
            )
            .sort((a, b) => a.chunk.chunkIndex - b.chunk.chunkIndex);

          if (adjacentChunks.length > 0) {
            content += '\n\n**Zusätzlicher Kontext:**\n';
            for (const adj of adjacentChunks) {
              content += `\n[Chunk ${adj.chunk.chunkIndex}]: ${adj.chunk.content.substring(0, 300)}...`;
            }
          }
        }

        return content;
      }

      return `Chunk mit ID "${chunkId}" nicht gefunden. Verfügbare IDs: ${Array.from(this.collectedSources.keys()).join(', ')}`;
    } catch (error) {
      return `Fehler beim Lesen des Chunks: ${error}`;
    }
  }

  /**
   * Format search results for LLM consumption
   */
  private formatSearchResults(
    results: SearchResultV2[],
    searchType: string
  ): string {
    let output = `**${searchType === 'keyword' ? 'Keyword' : 'Semantic'} Suchergebnisse (${results.length}):**\n\n`;

    for (const result of results) {
      const chunkKey = `${result.chunk.documentId}:${result.chunk.chunkIndex}`;
      output += `---\n`;
      output += `**ID:** ${chunkKey}\n`;
      output += `**Dokument:** ${result.document.originalName}\n`;
      output += `**Score:** ${result.score.toFixed(3)}\n`;
      output += `**Seite:** ${result.chunk.pageStart}\n`;
      output += `**Inhalt:** ${result.chunk.content.substring(0, 400)}${result.chunk.content.length > 400 ? '...' : ''}\n\n`;
    }

    return output;
  }

  /**
   * Get current configuration
   */
  getConfig(): AgenticRAGConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<AgenticRAGConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Singleton instance
export const agenticRAG = new AgenticRAG();
export default agenticRAG;
