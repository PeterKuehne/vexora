/**
 * Chunking Types for RAG V2 Phase 2
 *
 * Defines types for semantic chunking, table chunking,
 * and hierarchical indexing.
 */

import type { ContentBlock, TableStructure } from './parsing.js';

// ============================================
// Chunking Strategy
// ============================================

/**
 * Available chunking strategies
 */
export type ChunkingStrategy = 'semantic' | 'table' | 'fixed' | 'hybrid';

/**
 * Hierarchy level for chunks
 * 0 = Document level (summary)
 * 1 = Section level
 * 2 = Paragraph level
 */
export type ChunkLevel = 0 | 1 | 2;

// ============================================
// Chunk Types
// ============================================

/**
 * Base chunk interface
 */
export interface Chunk {
  /** Unique chunk ID */
  id: string;
  /** Parent document ID */
  documentId: string;
  /** Text content of the chunk */
  content: string;
  /** Index within the document */
  chunkIndex: number;
  /** Total chunks in document */
  totalChunks: number;
  /** Hierarchy level (0=doc, 1=section, 2=para) */
  level: ChunkLevel;
  /** Parent chunk ID (null for level 0) */
  parentChunkId: string | null;
  /** Path in hierarchy (e.g., "doc/section-2/para-3") */
  path: string;
  /** Strategy used to create this chunk */
  chunkingMethod: ChunkingStrategy;
  /** Start page number */
  pageStart: number;
  /** End page number */
  pageEnd: number;
  /** Token count (approximate) */
  tokenCount: number;
  /** Character count */
  charCount: number;
  /** Metadata for the chunk */
  metadata: ChunkMetadata;
}

/**
 * Chunk metadata
 */
export interface ChunkMetadata {
  /** Section title (for section/para chunks) */
  sectionTitle?: string;
  /** Heading level of the section */
  headingLevel?: number;
  /** Whether chunk contains a table */
  hasTable?: boolean;
  /** Whether chunk contains code */
  hasCode?: boolean;
  /** Whether chunk contains images */
  hasImages?: boolean;
  /** Source content block positions */
  sourceBlockPositions?: number[];
  /** Semantic similarity score (for semantic chunks) */
  semanticBreakpointScore?: number;
  /** Overlap content from previous chunk (prefix) for context preservation */
  overlapPrefix?: string;
  /** Overlap content for next chunk (suffix) */
  overlapSuffix?: string;
  /** Size of overlap in characters */
  overlapSize?: number;
  /** Whether chunk has contextual retrieval context added */
  hasContextualContext?: boolean;
  /** Original content before contextual context was prepended */
  originalContent?: string;
  /** Whether summary was generated using LLM (abstractive) vs extractive */
  isAbstractiveSummary?: boolean;
}

/**
 * Table-specific chunk
 */
export interface TableChunk extends Chunk {
  chunkingMethod: 'table';
  /** Table structure */
  table: TableStructure;
  /** Table caption if available */
  caption?: string;
  /** Table index within document */
  tableIndex: number;
}

/**
 * Check if a chunk is a table chunk
 */
export function isTableChunk(chunk: Chunk): chunk is TableChunk {
  return chunk.chunkingMethod === 'table' && 'table' in chunk;
}

// ============================================
// Chunker Configuration
// ============================================

/**
 * Configuration for semantic chunker
 */
export interface SemanticChunkerConfig {
  /** Embedding model to use */
  embeddingModel: string;
  /** Similarity threshold for breakpoints (lower = more breaks) */
  breakpointThreshold: number;
  /** Percentile for breakpoint detection (e.g., 0.2 = bottom 20%) */
  breakpointPercentile: number;
  /** Minimum chunk size in characters */
  minChunkSize: number;
  /** Maximum chunk size in characters */
  maxChunkSize: number;
  /** Overlap size in characters for context preservation */
  overlapSize: number;
  /** Buffer sentences for context */
  bufferSentences: number;
}

/**
 * Configuration for table chunker
 */
export interface TableChunkerConfig {
  /** Maximum table size before splitting */
  maxTableSize: number;
  /** Include table as markdown in chunk */
  includeMarkdown: boolean;
  /** Include surrounding context */
  includeContext: boolean;
  /** Context window size (sentences) */
  contextWindowSize: number;
}

/**
 * Configuration for fixed-size chunker
 */
export interface FixedChunkerConfig {
  /** Chunk size in words */
  chunkSizeWords: number;
  /** Overlap in words */
  overlapWords: number;
  /** Chunk size in characters (alternative) */
  chunkSizeChars?: number;
  /** Overlap in characters (alternative) */
  overlapChars?: number;
}

/**
 * Configuration for hierarchical indexer
 */
export interface HierarchicalIndexerConfig {
  /** Generate document-level summaries */
  generateDocSummary: boolean;
  /** Generate section-level summaries */
  generateSectionSummaries: boolean;
  /** Maximum summary length */
  maxSummaryLength: number;
  /** Heading levels that define sections */
  sectionHeadingLevels: number[];
}

/**
 * Complete chunker configuration
 */
export interface ChunkerConfig {
  /** Strategy to use */
  strategy: ChunkingStrategy;
  /** Semantic chunker config */
  semantic: SemanticChunkerConfig;
  /** Table chunker config */
  table: TableChunkerConfig;
  /** Fixed chunker config (fallback) */
  fixed: FixedChunkerConfig;
  /** Hierarchical indexer config */
  hierarchical: HierarchicalIndexerConfig;
}

/**
 * Default configuration
 */
export const DEFAULT_CHUNKER_CONFIG: ChunkerConfig = {
  strategy: 'hybrid',
  semantic: {
    embeddingModel: 'nomic-embed-text',
    breakpointThreshold: 0.5,
    breakpointPercentile: 0.2,
    minChunkSize: 100,
    maxChunkSize: 1000,
    overlapSize: 50,
    bufferSentences: 1,
  },
  table: {
    maxTableSize: 2000,
    includeMarkdown: true,
    includeContext: true,
    contextWindowSize: 2,
  },
  fixed: {
    chunkSizeWords: 500,
    overlapWords: 50,
  },
  hierarchical: {
    generateDocSummary: true,
    generateSectionSummaries: true,
    maxSummaryLength: 500,
    sectionHeadingLevels: [1, 2],
  },
};

// ============================================
// Chunking Pipeline Types
// ============================================

/**
 * Input to the chunking pipeline
 */
export interface ChunkingInput {
  /** Document ID */
  documentId: string;
  /** Content blocks from parser */
  blocks: ContentBlock[];
  /** Full text fallback */
  fullText: string;
  /** Document metadata */
  metadata: {
    filename: string;
    pageCount: number;
    title?: string;
  };
}

/**
 * Output from the chunking pipeline
 */
export interface ChunkingOutput {
  /** Document ID */
  documentId: string;
  /** All generated chunks */
  chunks: Chunk[];
  /** Table chunks (subset) */
  tableChunks: TableChunk[];
  /** Hierarchy tree (chunk IDs) */
  hierarchy: ChunkHierarchyNode;
  /** Statistics */
  stats: ChunkingStats;
}

/**
 * Node in chunk hierarchy tree
 */
export interface ChunkHierarchyNode {
  /** Chunk ID */
  chunkId: string;
  /** Level in hierarchy */
  level: ChunkLevel;
  /** Child nodes */
  children: ChunkHierarchyNode[];
}

/**
 * Chunking statistics
 */
export interface ChunkingStats {
  /** Total chunks created */
  totalChunks: number;
  /** Chunks per level */
  chunksPerLevel: Record<ChunkLevel, number>;
  /** Chunks per strategy */
  chunksPerStrategy: Record<ChunkingStrategy, number>;
  /** Average chunk size (chars) */
  avgChunkSize: number;
  /** Min chunk size (chars) */
  minChunkSize: number;
  /** Max chunk size (chars) */
  maxChunkSize: number;
  /** Total tables extracted */
  tablesExtracted: number;
  /** Processing time in ms */
  processingTimeMs: number;
}

// ============================================
// Semantic Chunking Types
// ============================================

/**
 * Sentence with embedding for semantic chunking
 */
export interface SentenceWithEmbedding {
  /** Sentence text */
  text: string;
  /** Sentence index */
  index: number;
  /** Source block position */
  blockPosition: number;
  /** Page number */
  pageNumber?: number;
  /** Embedding vector */
  embedding?: number[];
}

/**
 * Semantic breakpoint between sentences
 */
export interface SemanticBreakpoint {
  /** Position after this sentence */
  afterSentenceIndex: number;
  /** Cosine similarity between adjacent sentences */
  similarity: number;
  /** Whether this is a confirmed breakpoint */
  isBreakpoint: boolean;
}

/**
 * Semantic chunk group (sentences between breakpoints)
 */
export interface SemanticChunkGroup {
  /** Start sentence index (inclusive) */
  startIndex: number;
  /** End sentence index (inclusive) */
  endIndex: number;
  /** Sentences in this group */
  sentences: SentenceWithEmbedding[];
  /** Combined text */
  text: string;
  /** Character count */
  charCount: number;
}
