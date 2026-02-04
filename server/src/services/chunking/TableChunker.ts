/**
 * TableChunker - Table-Aware Chunking
 * RAG V2 Phase 2
 *
 * Handles chunking of tables to preserve structure:
 * - Keeps tables intact when possible
 * - Splits large tables by rows if needed
 * - Includes surrounding context (captions, preceding text)
 */

import type { ContentBlock, TableStructure } from '../../types/parsing.js';
import type {
  Chunk,
  TableChunk,
  TableChunkerConfig,
} from '../../types/chunking.js';

// ============================================
// Default Configuration
// ============================================

export const DEFAULT_TABLE_CONFIG: TableChunkerConfig = {
  maxTableSize: 2000, // Characters
  includeMarkdown: true,
  includeContext: true,
  contextWindowSize: 2, // Sentences before/after
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
 * Extract last N sentences from text
 */
function getLastSentences(text: string, n: number): string {
  const sentences = text.match(/[^.!?]*[.!?]+(?:\s|$)|[^.!?]+$/g) || [];
  return sentences.slice(-n).join(' ').trim();
}

/**
 * Extract first N sentences from text
 */
function getFirstSentences(text: string, n: number): string {
  const sentences = text.match(/[^.!?]*[.!?]+(?:\s|$)|[^.!?]+$/g) || [];
  return sentences.slice(0, n).join(' ').trim();
}

// ============================================
// TableChunker Class
// ============================================

export class TableChunker {
  private config: TableChunkerConfig;

  constructor(config?: Partial<TableChunkerConfig>) {
    this.config = { ...DEFAULT_TABLE_CONFIG, ...config };
  }

  /**
   * Extract and chunk tables from content blocks
   */
  chunkTables(
    documentId: string,
    blocks: ContentBlock[],
    parentChunkId: string | null = null,
    basePath: string = 'doc'
  ): TableChunk[] {
    const tableChunks: TableChunk[] = [];
    let tableIndex = 0;

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];

      if (block.type === 'table' && block.table) {
        // Get surrounding context if enabled
        let contextBefore = '';
        let contextAfter = '';

        if (this.config.includeContext) {
          // Look for preceding text (especially captions)
          for (let j = i - 1; j >= 0 && j >= i - 3; j--) {
            const prevBlock = blocks[j];
            if (prevBlock.type === 'caption') {
              contextBefore = prevBlock.content;
              break;
            } else if (prevBlock.type === 'paragraph') {
              contextBefore = getLastSentences(prevBlock.content, this.config.contextWindowSize);
              break;
            }
          }

          // Look for following text
          for (let j = i + 1; j < blocks.length && j <= i + 2; j++) {
            const nextBlock = blocks[j];
            if (nextBlock.type === 'caption') {
              contextAfter = nextBlock.content;
              break;
            } else if (nextBlock.type === 'paragraph') {
              contextAfter = getFirstSentences(nextBlock.content, this.config.contextWindowSize);
              break;
            }
          }
        }

        // Check if table needs to be split
        const tableContent = block.table.markdown;
        if (tableContent.length > this.config.maxTableSize) {
          // Split large table
          const splitChunks = this.splitLargeTable(
            documentId,
            block.table,
            tableIndex,
            parentChunkId,
            basePath,
            contextBefore,
            block.pageNumber || 1
          );
          tableChunks.push(...splitChunks);
          tableIndex += splitChunks.length;
        } else {
          // Create single chunk for table
          const chunk = this.createTableChunk(
            documentId,
            block.table,
            tableIndex,
            parentChunkId,
            basePath,
            contextBefore,
            contextAfter,
            block.pageNumber || 1
          );
          tableChunks.push(chunk);
          tableIndex++;
        }
      }
    }

    // Update total chunks
    for (const chunk of tableChunks) {
      chunk.totalChunks = tableChunks.length;
    }

    return tableChunks;
  }

  /**
   * Create a table chunk
   */
  private createTableChunk(
    documentId: string,
    table: TableStructure,
    tableIndex: number,
    parentChunkId: string | null,
    basePath: string,
    contextBefore: string,
    contextAfter: string,
    pageNumber: number
  ): TableChunk {
    // Build chunk content
    let content = '';

    if (contextBefore) {
      content += `Context: ${contextBefore}\n\n`;
    }

    if (this.config.includeMarkdown) {
      content += `Table:\n${table.markdown}`;
    } else {
      // Plain text representation
      const rows: string[] = [];
      if (table.headers.length > 0) {
        rows.push(`Headers: ${table.headers.join(', ')}`);
      }
      for (let r = 0; r < table.rows; r++) {
        const rowCells = table.cells.filter(c => c.row === r).map(c => c.content);
        rows.push(`Row ${r + 1}: ${rowCells.join(' | ')}`);
      }
      content += `Table (${table.rows} rows x ${table.cols} cols):\n${rows.join('\n')}`;
    }

    if (contextAfter) {
      content += `\n\nFollowing: ${contextAfter}`;
    }

    return {
      id: generateChunkId(),
      documentId,
      content,
      chunkIndex: tableIndex,
      totalChunks: 0, // Updated later
      level: 2,
      parentChunkId,
      path: `${basePath}/table-${tableIndex}`,
      chunkingMethod: 'table',
      pageStart: pageNumber,
      pageEnd: pageNumber,
      tokenCount: estimateTokens(content),
      charCount: content.length,
      metadata: {
        hasTable: true,
      },
      table,
      caption: contextBefore || undefined,
      tableIndex,
    };
  }

  /**
   * Split a large table into multiple chunks
   */
  private splitLargeTable(
    documentId: string,
    table: TableStructure,
    startTableIndex: number,
    parentChunkId: string | null,
    basePath: string,
    contextBefore: string,
    pageNumber: number
  ): TableChunk[] {
    const chunks: TableChunk[] = [];

    // Calculate rows per chunk
    const headerRow = table.headers.join(' | ');
    const headerSize = headerRow.length + 50; // Buffer for markdown formatting
    const avgRowSize = (table.markdown.length - headerSize) / table.rows;
    const rowsPerChunk = Math.max(
      1,
      Math.floor((this.config.maxTableSize - headerSize) / avgRowSize)
    );

    // Split by rows
    let currentIndex = startTableIndex;
    for (let startRow = 0; startRow < table.rows; startRow += rowsPerChunk) {
      const endRow = Math.min(startRow + rowsPerChunk, table.rows);

      // Create subset table
      const subsetCells = table.cells.filter(
        (c) => c.row >= startRow && c.row < endRow
      ).map((c) => ({
        ...c,
        row: c.row - startRow, // Renumber rows
      }));

      // Regenerate markdown for subset
      const subsetMarkdown = this.generateTableMarkdown(
        table.headers,
        subsetCells,
        endRow - startRow,
        table.cols
      );

      const subsetTable: TableStructure = {
        rows: endRow - startRow,
        cols: table.cols,
        headers: table.headers,
        cells: subsetCells,
        markdown: subsetMarkdown,
        hasHeader: table.hasHeader,
      };

      // Build content
      let content = '';

      if (currentIndex === startTableIndex && contextBefore) {
        content += `Context: ${contextBefore}\n\n`;
      }

      content += `Table (Part ${currentIndex - startTableIndex + 1}, rows ${startRow + 1}-${endRow}):\n`;
      content += subsetMarkdown;

      const chunk: TableChunk = {
        id: generateChunkId(),
        documentId,
        content,
        chunkIndex: currentIndex,
        totalChunks: 0,
        level: 2,
        parentChunkId,
        path: `${basePath}/table-${startTableIndex}-part-${currentIndex - startTableIndex}`,
        chunkingMethod: 'table',
        pageStart: pageNumber,
        pageEnd: pageNumber,
        tokenCount: estimateTokens(content),
        charCount: content.length,
        metadata: {
          hasTable: true,
        },
        table: subsetTable,
        caption: currentIndex === startTableIndex ? contextBefore || undefined : undefined,
        tableIndex: startTableIndex,
      };

      chunks.push(chunk);
      currentIndex++;
    }

    return chunks;
  }

  /**
   * Generate markdown for a table
   */
  private generateTableMarkdown(
    headers: string[],
    cells: { content: string; row: number; col: number }[],
    rows: number,
    cols: number
  ): string {
    const lines: string[] = [];

    // Header row
    if (headers.length > 0) {
      lines.push('| ' + headers.join(' | ') + ' |');
      lines.push('| ' + headers.map(() => '---').join(' | ') + ' |');
    }

    // Data rows
    for (let r = 0; r < rows; r++) {
      const rowCells: string[] = [];
      for (let c = 0; c < cols; c++) {
        const cell = cells.find((cell) => cell.row === r && cell.col === c);
        rowCells.push(cell?.content || '');
      }
      lines.push('| ' + rowCells.join(' | ') + ' |');
    }

    return lines.join('\n');
  }

  /**
   * Check if a block is a table
   */
  isTableBlock(block: ContentBlock): boolean {
    return block.type === 'table' && block.table !== undefined;
  }

  /**
   * Get configuration
   */
  getConfig(): TableChunkerConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<TableChunkerConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

// Singleton instance
export const tableChunker = new TableChunker();
export default tableChunker;
