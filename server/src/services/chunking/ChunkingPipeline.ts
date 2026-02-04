/**
 * ChunkingPipeline - Orchestrates All Chunkers
 * RAG V2 Phase 2
 *
 * Combines:
 * - SemanticChunker (embedding-based breakpoints)
 * - TableChunker (table-aware chunking)
 * - HierarchicalIndexer (parent-child relationships)
 *
 * Produces chunks ready for Weaviate V2 storage.
 */

import type { ContentBlock, ParsedDocument } from '../../types/parsing.js';
import type {
  Chunk,
  TableChunk,
  ChunkingInput,
  ChunkingOutput,
  ChunkingStats,
  ChunkerConfig,
  ChunkLevel,
  ChunkHierarchyNode,
} from '../../types/chunking.js';
import { DEFAULT_CHUNKER_CONFIG } from '../../types/chunking.js';
import { SemanticChunker, DEFAULT_SEMANTIC_CONFIG } from './SemanticChunker.js';
import { TableChunker, DEFAULT_TABLE_CONFIG } from './TableChunker.js';
import { HierarchicalIndexer, DEFAULT_HIERARCHICAL_CONFIG } from './HierarchicalIndexer.js';
import { contextualRetrieval, type ContextualChunk } from '../rag/ContextualRetrieval.js';

// ============================================
// Pipeline Class
// ============================================

export class ChunkingPipeline {
  private config: ChunkerConfig;
  private semanticChunker: SemanticChunker;
  private tableChunker: TableChunker;
  private hierarchicalIndexer: HierarchicalIndexer;

  constructor(config?: Partial<ChunkerConfig>) {
    this.config = { ...DEFAULT_CHUNKER_CONFIG, ...config };

    // Initialize chunkers with config
    this.semanticChunker = new SemanticChunker(this.config.semantic);
    this.tableChunker = new TableChunker(this.config.table);
    this.hierarchicalIndexer = new HierarchicalIndexer(this.config.hierarchical);
  }

  /**
   * Process a parsed document into chunks
   */
  async processDocument(input: ChunkingInput): Promise<ChunkingOutput> {
    const startTime = Date.now();
    const { documentId, blocks, fullText, metadata } = input;

    console.log(`📦 ChunkingPipeline: Processing document ${documentId}`);
    console.log(`   Blocks: ${blocks.length}, Strategy: ${this.config.strategy}`);

    let allChunks: Chunk[] = [];
    let tableChunks: TableChunk[] = [];

    // Step 1: Extract and chunk tables
    if (this.hasTableBlocks(blocks)) {
      console.log('📊 Processing tables...');
      tableChunks = this.tableChunker.chunkTables(
        documentId,
        blocks,
        null,
        'doc'
      );
      console.log(`   Created ${tableChunks.length} table chunks`);
    }

    // Step 2: Chunk non-table content based on strategy
    const nonTableBlocks = blocks.filter((b) => b.type !== 'table');

    if (nonTableBlocks.length > 0) {
      switch (this.config.strategy) {
        case 'semantic':
          console.log('📝 Applying semantic chunking...');
          allChunks = await this.semanticChunker.chunkBlocks(
            documentId,
            nonTableBlocks,
            null,
            'doc'
          );
          break;

        case 'fixed':
          console.log('📏 Applying fixed-size chunking...');
          allChunks = this.applyFixedChunking(documentId, nonTableBlocks);
          break;

        case 'hybrid':
        default:
          console.log('🔄 Applying hybrid chunking (semantic + fixed fallback)...');
          try {
            allChunks = await this.semanticChunker.chunkBlocks(
              documentId,
              nonTableBlocks,
              null,
              'doc'
            );
          } catch (error) {
            console.warn('Semantic chunking failed, using fixed fallback:', error);
            allChunks = this.applyFixedChunking(documentId, nonTableBlocks);
          }
          break;
      }
      console.log(`   Created ${allChunks.length} text chunks`);
    }

    // Step 3: Merge table chunks into all chunks
    allChunks = [...allChunks, ...tableChunks];

    // Step 4: Apply hierarchical indexing (now async for abstractive summaries)
    console.log('🏗️  Building hierarchy...');
    const { docChunk, sectionChunks, hierarchy, updatedChunks } =
      await this.hierarchicalIndexer.createHierarchy(
        documentId,
        blocks,
        allChunks,
        metadata.title
      );

    // Merge hierarchical chunks
    const finalChunks: Chunk[] = [];

    if (docChunk) {
      finalChunks.push(docChunk);
    }

    finalChunks.push(...sectionChunks);
    finalChunks.push(...updatedChunks);

    // Update chunk indices
    for (let i = 0; i < finalChunks.length; i++) {
      finalChunks[i].chunkIndex = i;
      finalChunks[i].totalChunks = finalChunks.length;
    }

    // Step 5: Apply Contextual Retrieval (if enabled)
    // This adds LLM-generated context to improve retrieval quality
    let enrichedChunks: Chunk[] = finalChunks;
    if (contextualRetrieval.getConfig().enabled) {
      console.log('🧠 Applying Contextual Retrieval...');
      const contextualChunks = await contextualRetrieval.enrichChunksWithContext(
        finalChunks,
        fullText,
        metadata.title
      );
      // Use contextualContent for chunks that have it
      enrichedChunks = contextualChunks.map(chunk => {
        const contextual = chunk as ContextualChunk;
        if (contextual.contextualContent) {
          return {
            ...chunk,
            content: contextual.contextualContent,
            metadata: {
              ...chunk.metadata,
              hasContextualContext: true,
              originalContent: chunk.content, // Store original for display
            },
          };
        }
        return chunk;
      });
    }

    // Step 6: Calculate statistics
    const processingTimeMs = Date.now() - startTime;
    const stats = this.calculateStats(enrichedChunks, tableChunks, processingTimeMs);

    console.log(`✅ ChunkingPipeline complete:`);
    console.log(`   Total chunks: ${stats.totalChunks}`);
    console.log(`   Avg chunk size: ${stats.avgChunkSize} chars`);
    console.log(`   Processing time: ${stats.processingTimeMs}ms`);
    if (contextualRetrieval.getConfig().enabled) {
      console.log(`   Contextual contexts: ${enrichedChunks.filter(c => c.metadata.hasContextualContext).length}`);
    }

    return {
      documentId,
      chunks: enrichedChunks,
      tableChunks,
      hierarchy,
      stats,
    };
  }

  /**
   * Process from ParsedDocument directly
   */
  async processFromParsed(document: ParsedDocument): Promise<ChunkingOutput> {
    return this.processDocument({
      documentId: document.documentId,
      blocks: document.blocks,
      fullText: document.fullText,
      metadata: {
        filename: document.metadata.filename,
        pageCount: document.metadata.pageCount,
        title: document.metadata.title,
      },
    });
  }

  /**
   * Apply fixed-size chunking as fallback
   */
  private applyFixedChunking(
    documentId: string,
    blocks: ContentBlock[]
  ): Chunk[] {
    const chunks: Chunk[] = [];
    const { chunkSizeWords, overlapWords } = this.config.fixed;

    // Combine all text
    const allText = blocks
      .filter((b) => b.type === 'paragraph' || b.type === 'heading' || b.type === 'list')
      .map((b) => b.content)
      .join(' ');

    const words = allText.split(/\s+/);

    if (words.length === 0) {
      return chunks;
    }

    // Chunk by word count
    for (let i = 0; i < words.length; i += chunkSizeWords - overlapWords) {
      const chunkWords = words.slice(i, i + chunkSizeWords);
      const content = chunkWords.join(' ').trim();

      if (content.length > 0) {
        chunks.push({
          id: this.generateChunkId(),
          documentId,
          content,
          chunkIndex: chunks.length,
          totalChunks: 0, // Updated later
          level: 2,
          parentChunkId: null,
          path: `doc/chunk-${chunks.length}`,
          chunkingMethod: 'fixed',
          pageStart: 1,
          pageEnd: 1,
          tokenCount: this.estimateTokens(content),
          charCount: content.length,
          metadata: {},
        });
      }
    }

    // Update total
    for (const chunk of chunks) {
      chunk.totalChunks = chunks.length;
    }

    return chunks;
  }

  /**
   * Check if blocks contain tables
   */
  private hasTableBlocks(blocks: ContentBlock[]): boolean {
    return blocks.some((b) => b.type === 'table' && b.table);
  }

  /**
   * Calculate chunking statistics
   */
  private calculateStats(
    chunks: Chunk[],
    tableChunks: TableChunk[],
    processingTimeMs: number
  ): ChunkingStats {
    const charCounts = chunks.map((c) => c.charCount);

    const chunksPerLevel: Record<ChunkLevel, number> = {
      0: chunks.filter((c) => c.level === 0).length,
      1: chunks.filter((c) => c.level === 1).length,
      2: chunks.filter((c) => c.level === 2).length,
    };

    const chunksPerStrategy: Record<string, number> = {};
    for (const chunk of chunks) {
      chunksPerStrategy[chunk.chunkingMethod] =
        (chunksPerStrategy[chunk.chunkingMethod] || 0) + 1;
    }

    return {
      totalChunks: chunks.length,
      chunksPerLevel,
      chunksPerStrategy: chunksPerStrategy as Record<any, number>,
      avgChunkSize: charCounts.length > 0
        ? Math.round(charCounts.reduce((a, b) => a + b, 0) / charCounts.length)
        : 0,
      minChunkSize: charCounts.length > 0 ? Math.min(...charCounts) : 0,
      maxChunkSize: charCounts.length > 0 ? Math.max(...charCounts) : 0,
      tablesExtracted: tableChunks.length,
      processingTimeMs,
    };
  }

  /**
   * Generate unique chunk ID
   */
  private generateChunkId(): string {
    return `chunk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Estimate token count
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Get configuration
   */
  getConfig(): ChunkerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<ChunkerConfig>): void {
    this.config = { ...this.config, ...config };

    // Update sub-chunkers
    if (config.semantic) {
      this.semanticChunker.setConfig(config.semantic);
    }
    if (config.table) {
      this.tableChunker.setConfig(config.table);
    }
    if (config.hierarchical) {
      this.hierarchicalIndexer.setConfig(config.hierarchical);
    }
  }

  /**
   * Get individual chunkers for advanced usage
   */
  getChunkers() {
    return {
      semantic: this.semanticChunker,
      table: this.tableChunker,
      hierarchical: this.hierarchicalIndexer,
    };
  }
}

// ============================================
// Factory Function
// ============================================

/**
 * Create a chunking pipeline with environment-based configuration
 */
export function createChunkingPipeline(): ChunkingPipeline {
  const config: Partial<ChunkerConfig> = {
    strategy: (process.env.CHUNKING_STRATEGY as any) || 'hybrid',
    semantic: {
      ...DEFAULT_SEMANTIC_CONFIG,
      breakpointThreshold: parseFloat(
        process.env.SEMANTIC_BREAKPOINT_THRESHOLD || '0.5'
      ),
      minChunkSize: parseInt(process.env.MIN_CHUNK_SIZE || '100'),
      maxChunkSize: parseInt(process.env.MAX_CHUNK_SIZE || '1000'),
    },
  };

  return new ChunkingPipeline(config);
}

// Singleton instance
export const chunkingPipeline = createChunkingPipeline();
export default chunkingPipeline;
