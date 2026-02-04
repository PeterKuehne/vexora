/**
 * ContextualRetrieval Service
 * Based on Anthropic's Contextual Retrieval technique (September 2024)
 *
 * Generates LLM-based context for each chunk to improve retrieval quality.
 * The context situates the chunk within the overall document, reducing
 * retrieval failures by 49-67%.
 *
 * Reference: https://www.anthropic.com/news/contextual-retrieval
 */

import type { Chunk } from '../../types/chunking.js';
import { ollamaService } from '../OllamaService.js';

// ============================================
// Types
// ============================================

export interface ContextualChunk extends Chunk {
  /** LLM-generated context for this chunk */
  contextualContext?: string;
  /** Content with context prepended (for embedding) */
  contextualContent?: string;
}

export interface ContextualRetrievalConfig {
  /** Enable contextual retrieval (expensive, uses LLM calls) */
  enabled: boolean;
  /** Model to use for context generation */
  model: string;
  /** Maximum context length in characters */
  maxContextLength: number;
  /** Whether to cache generated contexts */
  cacheContexts: boolean;
  /** Batch size for parallel context generation */
  batchSize: number;
  /** Skip chunks smaller than this (they have enough context) */
  minChunkSizeForContext: number;
}

export const DEFAULT_CONTEXTUAL_CONFIG: ContextualRetrievalConfig = {
  enabled: process.env.CONTEXTUAL_RETRIEVAL_ENABLED === 'true',
  model: process.env.CONTEXTUAL_RETRIEVAL_MODEL || 'qwen3:14b',
  maxContextLength: 200,
  cacheContexts: true,
  batchSize: 5, // Process 5 chunks in parallel
  minChunkSizeForContext: 50,
};

// ============================================
// Context Generation Prompt
// ============================================

const CONTEXT_GENERATION_PROMPT = `<document>
{DOCUMENT_CONTENT}
</document>

Here is the chunk we want to situate within the whole document:
<chunk>
{CHUNK_CONTENT}
</chunk>

Please give a short succinct context (2-3 sentences, max 200 characters) to situate this chunk within the overall document for improving search retrieval. The context should help a search system understand what this chunk is about without reading the whole document.

Focus on:
- What section/topic this chunk belongs to
- Key entities or concepts mentioned
- How this relates to the document's main subject

Respond ONLY with the context, nothing else. Write in the same language as the document (German if the document is German).`;

// ============================================
// ContextualRetrieval Class
// ============================================

export class ContextualRetrieval {
  private config: ContextualRetrievalConfig;
  private contextCache: Map<string, string> = new Map();

  constructor(config?: Partial<ContextualRetrievalConfig>) {
    this.config = { ...DEFAULT_CONTEXTUAL_CONFIG, ...config };
  }

  /**
   * Add contextual information to chunks
   * This is the main entry point for the service
   */
  async enrichChunksWithContext(
    chunks: Chunk[],
    fullDocumentText: string,
    documentTitle?: string
  ): Promise<ContextualChunk[]> {
    if (!this.config.enabled) {
      console.log('📝 Contextual Retrieval: Disabled, returning chunks unchanged');
      return chunks as ContextualChunk[];
    }

    console.log(`📝 Contextual Retrieval: Generating context for ${chunks.length} chunks...`);
    const startTime = Date.now();

    // Filter chunks that need context (skip very small chunks)
    const chunksNeedingContext = chunks.filter(
      c => c.charCount >= this.config.minChunkSizeForContext && c.level === 2
    );
    const chunksSkipped = chunks.length - chunksNeedingContext.length;

    if (chunksSkipped > 0) {
      console.log(`   Skipping ${chunksSkipped} chunks (too small or not level 2)`);
    }

    // Truncate document if too long (keep first 8000 chars for context)
    const truncatedDoc = fullDocumentText.length > 8000
      ? fullDocumentText.substring(0, 8000) + '\n\n[Document truncated for context generation...]'
      : fullDocumentText;

    // Add document title if available
    const docWithTitle = documentTitle
      ? `Title: ${documentTitle}\n\n${truncatedDoc}`
      : truncatedDoc;

    // Process chunks in batches
    const results: ContextualChunk[] = [];

    for (let i = 0; i < chunks.length; i += this.config.batchSize) {
      const batch = chunks.slice(i, i + this.config.batchSize);
      const batchResults = await Promise.all(
        batch.map(chunk => this.enrichSingleChunk(chunk, docWithTitle))
      );
      results.push(...batchResults);

      // Progress logging
      const progress = Math.min(i + this.config.batchSize, chunks.length);
      console.log(`   Progress: ${progress}/${chunks.length} chunks`);
    }

    const duration = Date.now() - startTime;
    const contextGenerated = results.filter(c => c.contextualContext).length;
    console.log(`✅ Contextual Retrieval: Generated ${contextGenerated} contexts in ${duration}ms`);

    return results;
  }

  /**
   * Enrich a single chunk with context
   */
  private async enrichSingleChunk(
    chunk: Chunk,
    documentContent: string
  ): Promise<ContextualChunk> {
    // Skip small chunks or non-paragraph level
    if (chunk.charCount < this.config.minChunkSizeForContext || chunk.level !== 2) {
      return chunk as ContextualChunk;
    }

    // Check cache
    const cacheKey = this.getCacheKey(chunk);
    if (this.config.cacheContexts && this.contextCache.has(cacheKey)) {
      const cachedContext = this.contextCache.get(cacheKey)!;
      return {
        ...chunk,
        contextualContext: cachedContext,
        contextualContent: `${cachedContext}\n\n${chunk.content}`,
      };
    }

    try {
      // Generate context using LLM
      const context = await this.generateContext(chunk.content, documentContent);

      // Cache the result
      if (this.config.cacheContexts) {
        this.contextCache.set(cacheKey, context);
      }

      return {
        ...chunk,
        contextualContext: context,
        contextualContent: context ? `${context}\n\n${chunk.content}` : chunk.content,
      };
    } catch (error) {
      console.warn(`⚠️ Failed to generate context for chunk ${chunk.id}:`, error);
      return chunk as ContextualChunk;
    }
  }

  /**
   * Generate context for a chunk using LLM
   */
  private async generateContext(
    chunkContent: string,
    documentContent: string
  ): Promise<string> {
    const prompt = CONTEXT_GENERATION_PROMPT
      .replace('{DOCUMENT_CONTENT}', documentContent)
      .replace('{CHUNK_CONTENT}', chunkContent);

    const response = await ollamaService.chat({
      model: this.config.model,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Extract and clean the context
    let context = response.message.content.trim();

    // Truncate if too long
    if (context.length > this.config.maxContextLength) {
      context = context.substring(0, this.config.maxContextLength).trim();
      // Don't cut mid-sentence
      const lastPeriod = context.lastIndexOf('.');
      if (lastPeriod > this.config.maxContextLength * 0.5) {
        context = context.substring(0, lastPeriod + 1);
      }
    }

    return context;
  }

  /**
   * Generate cache key for a chunk
   */
  private getCacheKey(chunk: Chunk): string {
    // Use content hash as cache key
    const contentHash = this.simpleHash(chunk.content);
    return `${chunk.documentId}:${contentHash}`;
  }

  /**
   * Simple string hash for caching
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  /**
   * Clear the context cache
   */
  clearCache(): void {
    this.contextCache.clear();
    console.log('🧹 Contextual Retrieval cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; enabled: boolean } {
    return {
      size: this.contextCache.size,
      enabled: this.config.cacheContexts,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): ContextualRetrievalConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<ContextualRetrievalConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Singleton instance
export const contextualRetrieval = new ContextualRetrieval();
export default contextualRetrieval;
