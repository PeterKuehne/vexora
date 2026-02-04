/**
 * SemanticChunker - Embedding-based Semantic Chunking
 * RAG V2 Phase 2
 *
 * Algorithm:
 * 1. Extract sentences from content blocks
 * 2. Generate embeddings for all sentences (nomic-embed-text)
 * 3. Calculate cosine similarity between adjacent sentences
 * 4. Identify breakpoints where similarity < threshold (bottom percentile)
 * 5. Group sentences between breakpoints into chunks
 * 6. Apply min/max size constraints
 */

import type { ContentBlock } from '../../types/parsing.js';
import type {
  Chunk,
  ChunkLevel,
  SemanticChunkerConfig,
  SentenceWithEmbedding,
  SemanticBreakpoint,
  SemanticChunkGroup,
} from '../../types/chunking.js';
import { embeddingService } from '../EmbeddingService.js';

// ============================================
// Default Configuration
// ============================================

export const DEFAULT_SEMANTIC_CONFIG: SemanticChunkerConfig = {
  embeddingModel: 'nomic-embed-text',
  breakpointThreshold: 0.5,
  breakpointPercentile: 0.2, // Bottom 20% of similarities
  minChunkSize: 100,
  maxChunkSize: 1000,
  overlapSize: 50,
  bufferSentences: 1,
};

// ============================================
// Utility Functions
// ============================================

/**
 * Split text into sentences using regex
 */
function splitIntoSentences(text: string): string[] {
  // Match sentence endings (., !, ?) followed by space or end
  // Handle abbreviations, numbers, etc.
  const sentenceRegex = /[^.!?]*[.!?]+(?:\s|$)|[^.!?]+$/g;
  const matches = text.match(sentenceRegex) || [];

  return matches
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Calculate percentile value from array
 */
function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const index = Math.floor(p * (sorted.length - 1));
  return sorted[index];
}

/**
 * Estimate token count (rough approximation: 4 chars = 1 token)
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Generate unique chunk ID
 */
function generateChunkId(): string {
  return `chunk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================
// SemanticChunker Class
// ============================================

export class SemanticChunker {
  private config: SemanticChunkerConfig;

  constructor(config?: Partial<SemanticChunkerConfig>) {
    this.config = { ...DEFAULT_SEMANTIC_CONFIG, ...config };
  }

  /**
   * Process content blocks into semantic chunks
   */
  async chunkBlocks(
    documentId: string,
    blocks: ContentBlock[],
    parentChunkId: string | null = null,
    basePath: string = 'doc'
  ): Promise<Chunk[]> {
    // Step 1: Extract sentences from blocks
    const sentences = this.extractSentences(blocks);

    if (sentences.length === 0) {
      return [];
    }

    // For very small documents, return single chunk
    if (sentences.length <= 3) {
      return [this.createChunkFromSentences(
        documentId,
        sentences,
        0,
        1,
        parentChunkId,
        `${basePath}/chunk-0`,
        2 // paragraph level
      )];
    }

    // Step 2: Generate embeddings for all sentences
    console.log(`📝 Generating embeddings for ${sentences.length} sentences...`);
    const sentencesWithEmbeddings = await this.generateSentenceEmbeddings(sentences);

    // Step 3: Calculate similarities and find breakpoints
    const breakpoints = this.findBreakpoints(sentencesWithEmbeddings);
    console.log(`🔍 Found ${breakpoints.filter(b => b.isBreakpoint).length} semantic breakpoints`);

    // Step 4: Group sentences into chunks
    const groups = this.groupSentences(sentencesWithEmbeddings, breakpoints);

    // Step 5: Apply size constraints and create chunks
    const chunks = this.createChunksFromGroups(
      documentId,
      groups,
      parentChunkId,
      basePath
    );

    return chunks;
  }

  /**
   * Extract sentences from content blocks
   */
  private extractSentences(blocks: ContentBlock[]): SentenceWithEmbedding[] {
    const sentences: SentenceWithEmbedding[] = [];
    let sentenceIndex = 0;

    for (const block of blocks) {
      // Skip tables, images, code (handled separately)
      if (block.type === 'table' || block.type === 'image' || block.type === 'code') {
        continue;
      }

      const blockSentences = splitIntoSentences(block.content);

      for (const text of blockSentences) {
        if (text.length > 10) { // Skip very short "sentences"
          sentences.push({
            text,
            index: sentenceIndex,
            blockPosition: block.position,
            pageNumber: block.pageNumber,
          });
          sentenceIndex++;
        }
      }
    }

    return sentences;
  }

  /**
   * Generate embeddings for all sentences
   */
  private async generateSentenceEmbeddings(
    sentences: SentenceWithEmbedding[]
  ): Promise<SentenceWithEmbedding[]> {
    const texts = sentences.map((s) => s.text);

    try {
      const embeddings = await embeddingService.generateEmbeddings(
        texts,
        this.config.embeddingModel
      );

      return sentences.map((sentence, i) => ({
        ...sentence,
        embedding: embeddings[i].embedding,
      }));
    } catch (error) {
      console.error('Failed to generate sentence embeddings:', error);
      // Return sentences without embeddings (will use fallback)
      return sentences;
    }
  }

  /**
   * Find semantic breakpoints based on similarity drops
   */
  private findBreakpoints(
    sentences: SentenceWithEmbedding[]
  ): SemanticBreakpoint[] {
    const breakpoints: SemanticBreakpoint[] = [];

    // Calculate similarities between adjacent sentences
    const similarities: number[] = [];

    for (let i = 0; i < sentences.length - 1; i++) {
      const current = sentences[i];
      const next = sentences[i + 1];

      let similarity = 0.5; // Default if no embeddings

      if (current.embedding && next.embedding) {
        similarity = cosineSimilarity(current.embedding, next.embedding);
      }

      similarities.push(similarity);
    }

    if (similarities.length === 0) {
      return breakpoints;
    }

    // Calculate threshold based on percentile
    const threshold = percentile(similarities, this.config.breakpointPercentile);
    console.log(`📊 Similarity threshold (${this.config.breakpointPercentile * 100}th percentile): ${threshold.toFixed(3)}`);

    // Mark breakpoints where similarity is below threshold
    for (let i = 0; i < similarities.length; i++) {
      const isBreakpoint = similarities[i] < threshold;

      breakpoints.push({
        afterSentenceIndex: i,
        similarity: similarities[i],
        isBreakpoint,
      });
    }

    return breakpoints;
  }

  /**
   * Group sentences between breakpoints
   */
  private groupSentences(
    sentences: SentenceWithEmbedding[],
    breakpoints: SemanticBreakpoint[]
  ): SemanticChunkGroup[] {
    const groups: SemanticChunkGroup[] = [];
    let startIndex = 0;

    for (let i = 0; i < breakpoints.length; i++) {
      if (breakpoints[i].isBreakpoint) {
        // Create group from startIndex to current breakpoint position
        const endIndex = breakpoints[i].afterSentenceIndex;
        const groupSentences = sentences.slice(startIndex, endIndex + 1);

        if (groupSentences.length > 0) {
          const text = groupSentences.map((s) => s.text).join(' ');
          groups.push({
            startIndex,
            endIndex,
            sentences: groupSentences,
            text,
            charCount: text.length,
          });
        }

        startIndex = endIndex + 1;
      }
    }

    // Add remaining sentences as final group
    if (startIndex < sentences.length) {
      const groupSentences = sentences.slice(startIndex);
      const text = groupSentences.map((s) => s.text).join(' ');
      groups.push({
        startIndex,
        endIndex: sentences.length - 1,
        sentences: groupSentences,
        text,
        charCount: text.length,
      });
    }

    return groups;
  }

  /**
   * Create chunks from sentence groups, applying size constraints and overlap
   */
  private createChunksFromGroups(
    documentId: string,
    groups: SemanticChunkGroup[],
    parentChunkId: string | null,
    basePath: string
  ): Chunk[] {
    const chunks: Chunk[] = [];
    let chunkIndex = 0;

    for (const group of groups) {
      // Check if group is too large
      if (group.charCount > this.config.maxChunkSize) {
        // Split large group
        const subChunks = this.splitLargeGroup(
          documentId,
          group,
          chunkIndex,
          parentChunkId,
          basePath
        );
        chunks.push(...subChunks);
        chunkIndex += subChunks.length;
      }
      // Check if group is too small (merge with previous if possible)
      else if (group.charCount < this.config.minChunkSize && chunks.length > 0) {
        // Merge with previous chunk if it won't exceed max size
        const prevChunk = chunks[chunks.length - 1];
        const combinedSize = prevChunk.charCount + group.charCount;

        if (combinedSize <= this.config.maxChunkSize) {
          // Merge
          prevChunk.content += ' ' + group.text;
          prevChunk.charCount = combinedSize;
          prevChunk.tokenCount = estimateTokens(prevChunk.content);
          prevChunk.pageEnd = group.sentences[group.sentences.length - 1]?.pageNumber || prevChunk.pageEnd;
        } else {
          // Create new chunk anyway
          chunks.push(this.createChunkFromGroup(
            documentId,
            group,
            chunkIndex,
            parentChunkId,
            basePath
          ));
          chunkIndex++;
        }
      }
      // Normal size - create chunk
      else {
        chunks.push(this.createChunkFromGroup(
          documentId,
          group,
          chunkIndex,
          parentChunkId,
          basePath
        ));
        chunkIndex++;
      }
    }

    // Apply overlap between chunks for context preservation
    this.applyOverlapToChunks(chunks);

    // Update totalChunks for all chunks
    for (const chunk of chunks) {
      chunk.totalChunks = chunks.length;
    }

    return chunks;
  }

  /**
   * Apply overlap between adjacent chunks for context preservation
   * Stores overlap content in metadata without duplicating in main content
   */
  private applyOverlapToChunks(chunks: Chunk[]): void {
    if (this.config.overlapSize <= 0 || chunks.length < 2) {
      return;
    }

    for (let i = 1; i < chunks.length; i++) {
      const prevChunk = chunks[i - 1]!;
      const currentChunk = chunks[i]!;

      // Extract overlap from end of previous chunk
      const overlapText = this.extractOverlapText(prevChunk.content, this.config.overlapSize);

      if (overlapText.length > 0) {
        // Store overlap in metadata (not duplicated in content for embedding efficiency)
        currentChunk.metadata.overlapPrefix = overlapText;
        currentChunk.metadata.overlapSize = overlapText.length;

        // Also store what becomes the suffix for the previous chunk
        prevChunk.metadata.overlapSuffix = overlapText;
      }
    }

    console.log(`🔗 Applied ${this.config.overlapSize} char overlap to ${chunks.length - 1} chunk boundaries`);
  }

  /**
   * Extract overlap text from the end of content, respecting word boundaries
   */
  private extractOverlapText(content: string, targetSize: number): string {
    if (content.length <= targetSize) {
      return content;
    }

    // Start from targetSize characters before the end
    let startPos = content.length - targetSize;

    // Find the next word boundary (space) to avoid cutting words
    const spacePos = content.indexOf(' ', startPos);
    if (spacePos !== -1 && spacePos < content.length - 10) {
      startPos = spacePos + 1; // Start after the space
    }

    return content.slice(startPos).trim();
  }

  /**
   * Create a chunk from a sentence group
   */
  private createChunkFromGroup(
    documentId: string,
    group: SemanticChunkGroup,
    chunkIndex: number,
    parentChunkId: string | null,
    basePath: string
  ): Chunk {
    const pageNumbers = group.sentences
      .map((s) => s.pageNumber)
      .filter((p): p is number => p !== undefined);

    return {
      id: generateChunkId(),
      documentId,
      content: group.text,
      chunkIndex,
      totalChunks: 0, // Will be updated later
      level: 2, // Paragraph level
      parentChunkId,
      path: `${basePath}/chunk-${chunkIndex}`,
      chunkingMethod: 'semantic',
      pageStart: Math.min(...pageNumbers, 1),
      pageEnd: Math.max(...pageNumbers, 1),
      tokenCount: estimateTokens(group.text),
      charCount: group.charCount,
      metadata: {
        sourceBlockPositions: [...new Set(group.sentences.map((s) => s.blockPosition))],
      },
    };
  }

  /**
   * Create chunk from raw sentences (for small documents)
   */
  private createChunkFromSentences(
    documentId: string,
    sentences: SentenceWithEmbedding[],
    chunkIndex: number,
    totalChunks: number,
    parentChunkId: string | null,
    path: string,
    level: ChunkLevel
  ): Chunk {
    const text = sentences.map((s) => s.text).join(' ');
    const pageNumbers = sentences
      .map((s) => s.pageNumber)
      .filter((p): p is number => p !== undefined);

    return {
      id: generateChunkId(),
      documentId,
      content: text,
      chunkIndex,
      totalChunks,
      level,
      parentChunkId,
      path,
      chunkingMethod: 'semantic',
      pageStart: Math.min(...pageNumbers, 1),
      pageEnd: Math.max(...pageNumbers, 1),
      tokenCount: estimateTokens(text),
      charCount: text.length,
      metadata: {
        sourceBlockPositions: [...new Set(sentences.map((s) => s.blockPosition))],
      },
    };
  }

  /**
   * Split a large group into smaller chunks
   */
  private splitLargeGroup(
    documentId: string,
    group: SemanticChunkGroup,
    startChunkIndex: number,
    parentChunkId: string | null,
    basePath: string
  ): Chunk[] {
    const chunks: Chunk[] = [];
    let currentText = '';
    let currentSentences: SentenceWithEmbedding[] = [];
    let chunkIndex = startChunkIndex;

    for (const sentence of group.sentences) {
      const wouldBeSize = currentText.length + sentence.text.length + 1;

      if (wouldBeSize > this.config.maxChunkSize && currentText.length > 0) {
        // Create chunk from current content
        chunks.push({
          id: generateChunkId(),
          documentId,
          content: currentText,
          chunkIndex,
          totalChunks: 0,
          level: 2,
          parentChunkId,
          path: `${basePath}/chunk-${chunkIndex}`,
          chunkingMethod: 'semantic',
          pageStart: currentSentences[0]?.pageNumber || 1,
          pageEnd: currentSentences[currentSentences.length - 1]?.pageNumber || 1,
          tokenCount: estimateTokens(currentText),
          charCount: currentText.length,
          metadata: {
            sourceBlockPositions: [...new Set(currentSentences.map((s) => s.blockPosition))],
          },
        });

        chunkIndex++;
        currentText = sentence.text;
        currentSentences = [sentence];
      } else {
        currentText += (currentText ? ' ' : '') + sentence.text;
        currentSentences.push(sentence);
      }
    }

    // Add remaining content
    if (currentText.length > 0) {
      chunks.push({
        id: generateChunkId(),
        documentId,
        content: currentText,
        chunkIndex,
        totalChunks: 0,
        level: 2,
        parentChunkId,
        path: `${basePath}/chunk-${chunkIndex}`,
        chunkingMethod: 'semantic',
        pageStart: currentSentences[0]?.pageNumber || 1,
        pageEnd: currentSentences[currentSentences.length - 1]?.pageNumber || 1,
        tokenCount: estimateTokens(currentText),
        charCount: currentText.length,
        metadata: {
          sourceBlockPositions: [...new Set(currentSentences.map((s) => s.blockPosition))],
        },
      });
    }

    return chunks;
  }

  /**
   * Get current configuration
   */
  getConfig(): SemanticChunkerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<SemanticChunkerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Singleton instance
export const semanticChunker = new SemanticChunker();
export default semanticChunker;
