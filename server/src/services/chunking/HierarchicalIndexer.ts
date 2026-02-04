/**
 * HierarchicalIndexer - Parent-Child Chunk Relationships
 * RAG V2 Phase 2
 *
 * Creates a hierarchical structure of chunks:
 * - Level 0: Document summary
 * - Level 1: Section summaries (based on headings)
 * - Level 2: Paragraph chunks
 *
 * This enables hierarchical retrieval strategies.
 */

import type { ContentBlock } from '../../types/parsing.js';
import type {
  Chunk,
  ChunkLevel,
  ChunkHierarchyNode,
  HierarchicalIndexerConfig,
} from '../../types/chunking.js';

// ============================================
// Default Configuration
// ============================================

export const DEFAULT_HIERARCHICAL_CONFIG: HierarchicalIndexerConfig = {
  generateDocSummary: true,
  generateSectionSummaries: true,
  maxSummaryLength: 500,
  sectionHeadingLevels: [1, 2],
};

// ============================================
// Utility Functions
// ============================================

/**
 * Generate unique chunk ID
 */
function generateChunkId(): string {
  return `chunk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Estimate token count
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Create a simple extractive summary by taking first N characters
 */
function createExtractiveSummary(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  // Try to cut at sentence boundary
  const truncated = text.substring(0, maxLength);
  const lastSentenceEnd = Math.max(
    truncated.lastIndexOf('.'),
    truncated.lastIndexOf('!'),
    truncated.lastIndexOf('?')
  );

  if (lastSentenceEnd > maxLength * 0.5) {
    return truncated.substring(0, lastSentenceEnd + 1);
  }

  // Fall back to word boundary
  const lastSpace = truncated.lastIndexOf(' ');
  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace) + '...';
  }

  return truncated + '...';
}

// ============================================
// Section Detection
// ============================================

interface Section {
  title: string;
  level: number;
  startPosition: number;
  endPosition: number;
  pageStart: number;
  pageEnd: number;
  blocks: ContentBlock[];
}

/**
 * Detect sections from content blocks based on headings
 */
function detectSections(
  blocks: ContentBlock[],
  sectionHeadingLevels: number[]
): Section[] {
  const sections: Section[] = [];
  let currentSection: Section | null = null;

  for (const block of blocks) {
    // Check if this is a section-defining heading
    if (
      block.type === 'heading' &&
      block.headingLevel &&
      sectionHeadingLevels.includes(block.headingLevel)
    ) {
      // Save current section if exists
      if (currentSection) {
        currentSection.endPosition = block.position - 1;
        sections.push(currentSection);
      }

      // Start new section
      currentSection = {
        title: block.content,
        level: block.headingLevel,
        startPosition: block.position,
        endPosition: blocks.length - 1, // Will be updated
        pageStart: block.pageNumber || 1,
        pageEnd: block.pageNumber || 1,
        blocks: [block],
      };
    } else if (currentSection) {
      // Add block to current section
      currentSection.blocks.push(block);
      if (block.pageNumber) {
        currentSection.pageEnd = Math.max(currentSection.pageEnd, block.pageNumber);
      }
    }
  }

  // Save last section
  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
}

// ============================================
// HierarchicalIndexer Class
// ============================================

export class HierarchicalIndexer {
  private config: HierarchicalIndexerConfig;

  constructor(config?: Partial<HierarchicalIndexerConfig>) {
    this.config = { ...DEFAULT_HIERARCHICAL_CONFIG, ...config };
  }

  /**
   * Create hierarchical structure from content blocks
   */
  createHierarchy(
    documentId: string,
    blocks: ContentBlock[],
    existingChunks: Chunk[],
    documentTitle?: string
  ): {
    docChunk: Chunk | null;
    sectionChunks: Chunk[];
    hierarchy: ChunkHierarchyNode;
    updatedChunks: Chunk[];
  } {
    let docChunk: Chunk | null = null;
    const sectionChunks: Chunk[] = [];

    // Create document-level chunk (Level 0)
    if (this.config.generateDocSummary) {
      docChunk = this.createDocumentChunk(documentId, blocks, documentTitle);
    }

    // Detect sections
    const sections = detectSections(blocks, this.config.sectionHeadingLevels);

    // Create section-level chunks (Level 1)
    if (this.config.generateSectionSummaries && sections.length > 0) {
      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        const sectionChunk = this.createSectionChunk(
          documentId,
          section,
          i,
          docChunk?.id || null
        );
        sectionChunks.push(sectionChunk);
      }
    }

    // Update existing chunks with parent relationships
    const updatedChunks = this.assignParents(
      existingChunks,
      sections,
      sectionChunks,
      docChunk
    );

    // Build hierarchy tree
    const hierarchy = this.buildHierarchyTree(
      docChunk,
      sectionChunks,
      updatedChunks
    );

    return {
      docChunk,
      sectionChunks,
      hierarchy,
      updatedChunks,
    };
  }

  /**
   * Create document-level summary chunk
   */
  private createDocumentChunk(
    documentId: string,
    blocks: ContentBlock[],
    title?: string
  ): Chunk {
    // Collect text for summary
    const textBlocks = blocks.filter(
      (b) => b.type === 'paragraph' || b.type === 'heading'
    );
    const fullText = textBlocks.map((b) => b.content).join(' ');

    // Create extractive summary
    const summary = createExtractiveSummary(fullText, this.config.maxSummaryLength);

    // Build content with title if available
    let content = '';
    if (title) {
      content = `Document: ${title}\n\nSummary: ${summary}`;
    } else {
      content = `Document Summary: ${summary}`;
    }

    const pageNumbers = blocks
      .map((b) => b.pageNumber)
      .filter((p): p is number => p !== undefined);

    return {
      id: generateChunkId(),
      documentId,
      content,
      chunkIndex: 0,
      totalChunks: 1,
      level: 0, // Document level
      parentChunkId: null,
      path: 'doc',
      chunkingMethod: 'hybrid',
      pageStart: Math.min(...pageNumbers, 1),
      pageEnd: Math.max(...pageNumbers, 1),
      tokenCount: estimateTokens(content),
      charCount: content.length,
      metadata: {
        sectionTitle: title,
      },
    };
  }

  /**
   * Create section-level summary chunk
   */
  private createSectionChunk(
    documentId: string,
    section: Section,
    sectionIndex: number,
    parentChunkId: string | null
  ): Chunk {
    // Collect text for summary
    const textBlocks = section.blocks.filter(
      (b) => b.type === 'paragraph' || b.type === 'heading'
    );
    const fullText = textBlocks.map((b) => b.content).join(' ');

    // Create extractive summary
    const summary = createExtractiveSummary(fullText, this.config.maxSummaryLength);

    // Build content
    const content = `Section: ${section.title}\n\nSummary: ${summary}`;

    return {
      id: generateChunkId(),
      documentId,
      content,
      chunkIndex: sectionIndex,
      totalChunks: 1, // Will be updated
      level: 1, // Section level
      parentChunkId,
      path: `doc/section-${sectionIndex}`,
      chunkingMethod: 'hybrid',
      pageStart: section.pageStart,
      pageEnd: section.pageEnd,
      tokenCount: estimateTokens(content),
      charCount: content.length,
      metadata: {
        sectionTitle: section.title,
        headingLevel: section.level,
      },
    };
  }

  /**
   * Assign parent chunks to existing paragraph-level chunks
   */
  private assignParents(
    chunks: Chunk[],
    sections: Section[],
    sectionChunks: Chunk[],
    docChunk: Chunk | null
  ): Chunk[] {
    return chunks.map((chunk) => {
      // Find which section this chunk belongs to based on position
      let parentChunkId = docChunk?.id || null;
      let sectionIndex = -1;

      for (let i = 0; i < sections.length; i++) {
        const section = sections[i];
        const sourcePositions = chunk.metadata.sourceBlockPositions || [];

        // Check if any of the chunk's source blocks are in this section
        const inSection = sourcePositions.some(
          (pos) =>
            typeof pos === 'number' &&
            pos >= section.startPosition &&
            pos <= section.endPosition
        );

        if (inSection) {
          sectionIndex = i;
          break;
        }
      }

      if (sectionIndex >= 0 && sectionChunks[sectionIndex]) {
        parentChunkId = sectionChunks[sectionIndex].id;
      }

      // Update path
      let path = chunk.path;
      if (sectionIndex >= 0) {
        path = `doc/section-${sectionIndex}/${chunk.path.split('/').pop() || 'chunk'}`;
      }

      return {
        ...chunk,
        parentChunkId,
        path,
      };
    });
  }

  /**
   * Build hierarchy tree structure
   */
  private buildHierarchyTree(
    docChunk: Chunk | null,
    sectionChunks: Chunk[],
    paraChunks: Chunk[]
  ): ChunkHierarchyNode {
    // Root node (document level)
    const root: ChunkHierarchyNode = {
      chunkId: docChunk?.id || 'root',
      level: 0,
      children: [],
    };

    // Add section nodes
    for (const sectionChunk of sectionChunks) {
      const sectionNode: ChunkHierarchyNode = {
        chunkId: sectionChunk.id,
        level: 1,
        children: [],
      };

      // Add paragraph chunks that belong to this section
      const sectionParas = paraChunks.filter(
        (p) => p.parentChunkId === sectionChunk.id
      );

      for (const para of sectionParas) {
        sectionNode.children.push({
          chunkId: para.id,
          level: 2,
          children: [],
        });
      }

      root.children.push(sectionNode);
    }

    // Add orphan paragraph chunks (not in any section)
    const orphanParas = paraChunks.filter(
      (p) => !sectionChunks.some((s) => s.id === p.parentChunkId)
    );

    for (const para of orphanParas) {
      root.children.push({
        chunkId: para.id,
        level: 2,
        children: [],
      });
    }

    return root;
  }

  /**
   * Get configuration
   */
  getConfig(): HierarchicalIndexerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<HierarchicalIndexerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Singleton instance
export const hierarchicalIndexer = new HierarchicalIndexer();
export default hierarchicalIndexer;
