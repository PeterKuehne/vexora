# Spec 2: Document Processing - Multi-Format & Chunking

## RAG V2 Implementation - Part 2 of 3

**Version:** 1.0
**Phases:** 2-3
**Duration:** Weeks 3-7
**Prerequisites:** Spec 1 completed (Evaluation + Reranking)
**Depends on:** Spec 1
**Blocks:** Spec 3

---

## 1. Overview

This specification covers document ingestion improvements:

1. **Hybrid Parser** - Docling + LlamaParse fallback
2. **Multi-Format Support** - PDF, DOCX, PPTX, XLSX, HTML, Markdown
3. **Semantic Chunking** - Meaning-based text splitting
4. **Late Chunking** - Better handling of long documents
5. **Table Chunking** - Structured table processing
6. **Hierarchical Indexer** - Parent-child chunk relationships

### Why This Comes Second

- Spec 1 provides evaluation infrastructure to measure improvements
- Better documents → better chunks → better retrieval
- Foundation for Graph RAG in Spec 3

### Success Criteria

| Metric | Target |
|--------|--------|
| Format Support | 6+ formats |
| Table Extraction Accuracy | ≥95% |
| Recall@20 Improvement | ≥10% vs Spec 1 |
| Parser Fallback Working | Yes |
| Existing Documents Migrated | Yes |

---

## 2. Phase 2: Multi-Format Parsing (Weeks 3-5)

### 2.1 Hybrid Parser Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    HYBRID PARSER SERVICE                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Input File                                                   │
│      │                                                        │
│      ▼                                                        │
│  ┌─────────────┐                                             │
│  │  Analyzer   │ ─── Detect: format, tables, layout          │
│  └──────┬──────┘                                             │
│         │                                                     │
│         ▼                                                     │
│  ┌─────────────────────────────────────────┐                 │
│  │           Router Decision               │                 │
│  │  ┌─────────────────────────────────┐   │                 │
│  │  │ tableRatio > 0.5 → LlamaParse   │   │                 │
│  │  │ isMultiColumn → LlamaParse      │   │                 │
│  │  │ else → Docling                  │   │                 │
│  │  └─────────────────────────────────┘   │                 │
│  └──────┬───────────────────┬─────────────┘                 │
│         │                   │                                 │
│    ┌────▼────┐        ┌────▼────┐                            │
│    │ Docling │        │LlamaParse│                            │
│    └────┬────┘        └────┬────┘                            │
│         │                   │                                 │
│         └─────────┬─────────┘                                 │
│                   │                                           │
│              ┌────▼────┐                                      │
│              │Validator│ ─── Cross-check tables if needed    │
│              └────┬────┘                                      │
│                   │                                           │
│                   ▼                                           │
│           ParsedDocument                                      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Package Dependencies

```json
// Add to server/package.json
{
  "dependencies": {
    "docling": "^0.5.0",
    "llamaindex": "^0.8.0",
    "@llamaindex/cloud": "^0.2.0"
  }
}
```

### 2.3 TypeScript Types

```typescript
// File: server/src/types/parsing.ts

export type SupportedFormat = 'pdf' | 'docx' | 'pptx' | 'xlsx' | 'html' | 'md' | 'txt';

export interface ParsedDocument {
  id: string;
  metadata: DocumentMetadata;
  structure: DocumentStructure;
  content: ContentBlock[];
  parserUsed: 'docling' | 'llamaparse' | 'native';
  parsingConfidence: number;
  warnings: ParsingWarning[];
}

export interface DocumentMetadata {
  filename: string;
  originalName: string;
  fileType: SupportedFormat;
  fileSize: number;
  pageCount?: number;
  wordCount: number;
  tableCount: number;
  imageCount: number;
  language?: string;
}

export interface DocumentStructure {
  title?: string;
  sections: Section[];
  tableOfContents: TOCEntry[];
}

export interface Section {
  id: string;
  title: string;
  level: number;
  pageNumber?: number;
  children: Section[];
}

export interface TOCEntry {
  title: string;
  level: number;
  pageNumber?: number;
}

export interface ContentBlock {
  id: string;
  type: ContentBlockType;
  content: string;
  level?: number;
  parentSectionId?: string;
  pageNumber?: number;
  boundingBox?: BoundingBox;
  confidence: number;

  // For tables
  tableData?: TableStructure;

  // For lists
  listItems?: string[];
  listType?: 'ordered' | 'unordered';

  // For images
  imagePath?: string;
  imageCaption?: string;
}

export type ContentBlockType =
  | 'paragraph'
  | 'heading'
  | 'table'
  | 'list'
  | 'image'
  | 'code'
  | 'blockquote';

export interface TableStructure {
  headers: string[];
  rows: string[][];
  caption?: string;
  hasHeaderRow: boolean;
  rowCount: number;
  columnCount: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  pageNumber: number;
}

export interface ParsingWarning {
  type: 'low_confidence' | 'fallback_used' | 'validation_mismatch' | 'ocr_used';
  blockId?: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

export interface ParserConfig {
  // Docling settings
  docling: {
    ocrEnabled: boolean;
    ocrLanguages: string[];
    tableExtractionMode: 'fast' | 'accurate';
    imageExtraction: boolean;
  };

  // LlamaParse settings
  llamaparse: {
    apiKey: string;
    parsingInstructions?: string;
    resultType: 'markdown' | 'text';
  };

  // Routing
  routing: {
    tableThreshold: number;  // Ratio of table content to trigger LlamaParse
    complexLayoutDetection: boolean;
    validateTables: boolean;
  };
}

export interface DocumentAnalysis {
  fileType: SupportedFormat;
  pageCount: number;
  estimatedWordCount: number;
  tableRatio: number;
  isMultiColumn: boolean;
  hasComplexLayout: boolean;
  hasHandwriting: boolean;
  suggestedParser: 'docling' | 'llamaparse';
}
```

### 2.4 Document Analyzer

```typescript
// File: server/src/services/parsing/DocumentAnalyzer.ts

import { readFile } from 'fs/promises';
import { DocumentAnalysis, SupportedFormat } from '../../types/parsing';

export class DocumentAnalyzer {
  async analyze(filePath: string, fileType: SupportedFormat): Promise<DocumentAnalysis> {
    const fileBuffer = await readFile(filePath);

    switch (fileType) {
      case 'pdf':
        return this.analyzePDF(fileBuffer);
      case 'docx':
        return this.analyzeDOCX(fileBuffer);
      case 'xlsx':
        return this.analyzeXLSX(fileBuffer);
      case 'pptx':
        return this.analyzePPTX(fileBuffer);
      case 'html':
        return this.analyzeHTML(fileBuffer);
      case 'md':
      case 'txt':
        return this.analyzeText(fileBuffer, fileType);
      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }
  }

  private async analyzePDF(buffer: Buffer): Promise<DocumentAnalysis> {
    // Use pdf-parse for quick analysis
    const pdfParse = await import('pdf-parse');
    const data = await pdfParse.default(buffer);

    const text = data.text;
    const wordCount = text.split(/\s+/).length;

    // Estimate table content by looking for patterns
    const tableIndicators = (text.match(/\t|\|.*\|/g) || []).length;
    const tableRatio = Math.min(1, tableIndicators / (wordCount / 100));

    // Check for multi-column layout (heuristic)
    const lines = text.split('\n');
    const shortLines = lines.filter(l => l.length > 10 && l.length < 50).length;
    const isMultiColumn = shortLines / lines.length > 0.3;

    return {
      fileType: 'pdf',
      pageCount: data.numpages,
      estimatedWordCount: wordCount,
      tableRatio,
      isMultiColumn,
      hasComplexLayout: isMultiColumn || tableRatio > 0.3,
      hasHandwriting: false, // Would need OCR analysis
      suggestedParser: tableRatio > 0.5 || isMultiColumn ? 'llamaparse' : 'docling',
    };
  }

  private async analyzeDOCX(buffer: Buffer): Promise<DocumentAnalysis> {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer });

    const text = result.value;
    const wordCount = text.split(/\s+/).length;

    // Check for tables by looking at raw content patterns
    const tableCount = (text.match(/\t{2,}/g) || []).length;
    const tableRatio = Math.min(1, tableCount / (wordCount / 200));

    return {
      fileType: 'docx',
      pageCount: Math.ceil(wordCount / 500), // Estimate
      estimatedWordCount: wordCount,
      tableRatio,
      isMultiColumn: false,
      hasComplexLayout: tableRatio > 0.3,
      hasHandwriting: false,
      suggestedParser: 'docling',
    };
  }

  private async analyzeXLSX(buffer: Buffer): Promise<DocumentAnalysis> {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer);

    let totalCells = 0;
    let totalSheets = workbook.SheetNames.length;

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
      totalCells += (range.e.r - range.s.r + 1) * (range.e.c - range.s.c + 1);
    }

    return {
      fileType: 'xlsx',
      pageCount: totalSheets,
      estimatedWordCount: totalCells, // Rough estimate
      tableRatio: 1.0, // It's all tables
      isMultiColumn: false,
      hasComplexLayout: true,
      hasHandwriting: false,
      suggestedParser: 'docling', // Docling handles xlsx well
    };
  }

  private async analyzePPTX(buffer: Buffer): Promise<DocumentAnalysis> {
    // Use pptx-parser or similar
    // Simplified analysis
    return {
      fileType: 'pptx',
      pageCount: 0, // Would need to count slides
      estimatedWordCount: 0,
      tableRatio: 0.1,
      isMultiColumn: false,
      hasComplexLayout: true,
      hasHandwriting: false,
      suggestedParser: 'docling',
    };
  }

  private async analyzeHTML(buffer: Buffer): Promise<DocumentAnalysis> {
    const html = buffer.toString('utf-8');
    const text = html.replace(/<[^>]*>/g, ' ');
    const wordCount = text.split(/\s+/).length;

    const tableCount = (html.match(/<table/gi) || []).length;
    const tableRatio = Math.min(1, tableCount / 10);

    return {
      fileType: 'html',
      pageCount: 1,
      estimatedWordCount: wordCount,
      tableRatio,
      isMultiColumn: false,
      hasComplexLayout: tableRatio > 0.3,
      hasHandwriting: false,
      suggestedParser: 'docling',
    };
  }

  private async analyzeText(buffer: Buffer, fileType: SupportedFormat): Promise<DocumentAnalysis> {
    const text = buffer.toString('utf-8');
    const wordCount = text.split(/\s+/).length;

    return {
      fileType,
      pageCount: 1,
      estimatedWordCount: wordCount,
      tableRatio: 0,
      isMultiColumn: false,
      hasComplexLayout: false,
      hasHandwriting: false,
      suggestedParser: 'docling',
    };
  }
}
```

### 2.5 Docling Parser

```typescript
// File: server/src/services/parsing/DoclingParser.ts

import { spawn } from 'child_process';
import { readFile, writeFile, unlink } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  ParsedDocument,
  ContentBlock,
  DocumentStructure,
  TableStructure,
  ParsingWarning,
  SupportedFormat
} from '../../types/parsing';

interface DoclingConfig {
  ocrEnabled: boolean;
  ocrLanguages: string[];
  tableExtractionMode: 'fast' | 'accurate';
  imageExtraction: boolean;
  timeout: number;
}

export class DoclingParser {
  private config: DoclingConfig;
  private tempDir: string;

  constructor(config?: Partial<DoclingConfig>) {
    this.config = {
      ocrEnabled: config?.ocrEnabled ?? true,
      ocrLanguages: config?.ocrLanguages ?? ['de', 'en'],
      tableExtractionMode: config?.tableExtractionMode ?? 'accurate',
      imageExtraction: config?.imageExtraction ?? false,
      timeout: config?.timeout ?? 300000, // 5 minutes
    };
    this.tempDir = process.env.TEMP_DIR || '/tmp/docling';
  }

  async parse(filePath: string, fileType: SupportedFormat): Promise<ParsedDocument> {
    const documentId = uuidv4();
    const outputPath = join(this.tempDir, `${documentId}.json`);

    try {
      // Run docling CLI or Python subprocess
      const result = await this.runDocling(filePath, outputPath);

      // Read and parse result
      const outputContent = await readFile(outputPath, 'utf-8');
      const doclingOutput = JSON.parse(outputContent);

      // Convert to our format
      return this.convertDoclingOutput(documentId, doclingOutput, filePath, fileType);

    } finally {
      // Cleanup temp file
      try {
        await unlink(outputPath);
      } catch { /* ignore */ }
    }
  }

  private async runDocling(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        '-m', 'docling',
        '--input', inputPath,
        '--output', outputPath,
        '--format', 'json',
      ];

      if (this.config.ocrEnabled) {
        args.push('--ocr');
        args.push('--ocr-lang', this.config.ocrLanguages.join(','));
      }

      if (this.config.tableExtractionMode === 'accurate') {
        args.push('--table-mode', 'accurate');
      }

      const process = spawn('python3', args, {
        timeout: this.config.timeout,
      });

      let stderr = '';

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Docling failed with code ${code}: ${stderr}`));
        }
      });

      process.on('error', (err) => {
        reject(err);
      });
    });
  }

  private convertDoclingOutput(
    documentId: string,
    output: any,
    filePath: string,
    fileType: SupportedFormat
  ): ParsedDocument {
    const warnings: ParsingWarning[] = [];
    const contentBlocks: ContentBlock[] = [];
    let blockIndex = 0;

    // Extract structure
    const structure: DocumentStructure = {
      title: output.title || undefined,
      sections: this.extractSections(output),
      tableOfContents: output.toc || [],
    };

    // Convert content blocks
    for (const block of output.blocks || []) {
      const converted = this.convertBlock(block, blockIndex++);
      if (converted) {
        contentBlocks.push(converted);

        // Add warnings for low confidence
        if (converted.confidence < 0.8) {
          warnings.push({
            type: 'low_confidence',
            blockId: converted.id,
            message: `Block has low extraction confidence: ${converted.confidence}`,
            severity: 'warning',
          });
        }
      }
    }

    return {
      id: documentId,
      metadata: {
        filename: filePath.split('/').pop() || '',
        originalName: output.metadata?.filename || '',
        fileType,
        fileSize: output.metadata?.fileSize || 0,
        pageCount: output.metadata?.pageCount,
        wordCount: this.countWords(contentBlocks),
        tableCount: contentBlocks.filter(b => b.type === 'table').length,
        imageCount: contentBlocks.filter(b => b.type === 'image').length,
        language: output.metadata?.language,
      },
      structure,
      content: contentBlocks,
      parserUsed: 'docling',
      parsingConfidence: this.calculateOverallConfidence(contentBlocks),
      warnings,
    };
  }

  private extractSections(output: any): any[] {
    // Extract hierarchical sections from docling output
    const sections: any[] = [];

    for (const block of output.blocks || []) {
      if (block.type === 'heading') {
        sections.push({
          id: block.id,
          title: block.text,
          level: block.level || 1,
          pageNumber: block.page,
          children: [],
        });
      }
    }

    return this.nestSections(sections);
  }

  private nestSections(sections: any[]): any[] {
    const nested: any[] = [];
    const stack: any[] = [];

    for (const section of sections) {
      while (stack.length > 0 && stack[stack.length - 1].level >= section.level) {
        stack.pop();
      }

      if (stack.length === 0) {
        nested.push(section);
      } else {
        stack[stack.length - 1].children.push(section);
      }

      stack.push(section);
    }

    return nested;
  }

  private convertBlock(block: any, index: number): ContentBlock | null {
    const baseBlock = {
      id: block.id || `block-${index}`,
      confidence: block.confidence || 1.0,
      pageNumber: block.page,
      boundingBox: block.bbox ? {
        x: block.bbox.x,
        y: block.bbox.y,
        width: block.bbox.width,
        height: block.bbox.height,
        pageNumber: block.page,
      } : undefined,
    };

    switch (block.type) {
      case 'paragraph':
      case 'text':
        return {
          ...baseBlock,
          type: 'paragraph',
          content: block.text || '',
        };

      case 'heading':
        return {
          ...baseBlock,
          type: 'heading',
          content: block.text || '',
          level: block.level || 1,
        };

      case 'table':
        return {
          ...baseBlock,
          type: 'table',
          content: this.tableToMarkdown(block.table),
          tableData: this.extractTableData(block.table),
        };

      case 'list':
        return {
          ...baseBlock,
          type: 'list',
          content: block.items?.join('\n') || '',
          listItems: block.items || [],
          listType: block.ordered ? 'ordered' : 'unordered',
        };

      case 'code':
        return {
          ...baseBlock,
          type: 'code',
          content: block.text || '',
        };

      case 'image':
        return {
          ...baseBlock,
          type: 'image',
          content: block.caption || '',
          imagePath: block.path,
          imageCaption: block.caption,
        };

      default:
        return null;
    }
  }

  private extractTableData(table: any): TableStructure {
    const headers = table.headers || table.rows?.[0] || [];
    const rows = table.rows?.slice(table.hasHeader ? 1 : 0) || [];

    return {
      headers,
      rows,
      caption: table.caption,
      hasHeaderRow: table.hasHeader ?? true,
      rowCount: rows.length,
      columnCount: headers.length,
    };
  }

  private tableToMarkdown(table: any): string {
    const { headers, rows, hasHeaderRow } = this.extractTableData(table);

    if (headers.length === 0) return '';

    let md = '| ' + headers.join(' | ') + ' |\n';
    md += '| ' + headers.map(() => '---').join(' | ') + ' |\n';

    for (const row of rows) {
      md += '| ' + row.join(' | ') + ' |\n';
    }

    return md;
  }

  private countWords(blocks: ContentBlock[]): number {
    return blocks.reduce((sum, block) => {
      return sum + (block.content?.split(/\s+/).length || 0);
    }, 0);
  }

  private calculateOverallConfidence(blocks: ContentBlock[]): number {
    if (blocks.length === 0) return 1.0;

    const sum = blocks.reduce((s, b) => s + b.confidence, 0);
    return sum / blocks.length;
  }
}
```

### 2.6 LlamaParse Parser (Fallback)

```typescript
// File: server/src/services/parsing/LlamaParseParser.ts

import { LlamaParseReader } from 'llamaindex';
import { v4 as uuidv4 } from 'uuid';
import {
  ParsedDocument,
  ContentBlock,
  DocumentStructure,
  ParsingWarning,
  SupportedFormat
} from '../../types/parsing';

interface LlamaParseConfig {
  apiKey: string;
  parsingInstructions?: string;
  resultType: 'markdown' | 'text';
  timeout: number;
}

export class LlamaParseParser {
  private config: LlamaParseConfig;
  private reader: LlamaParseReader;

  constructor(config: LlamaParseConfig) {
    this.config = config;
    this.reader = new LlamaParseReader({
      apiKey: config.apiKey,
      resultType: config.resultType,
    });
  }

  async parse(filePath: string, fileType: SupportedFormat): Promise<ParsedDocument> {
    const documentId = uuidv4();
    const warnings: ParsingWarning[] = [];

    try {
      // Parse with LlamaParse
      const documents = await this.reader.loadData(filePath);

      if (documents.length === 0) {
        throw new Error('No content extracted from document');
      }

      // Combine all document parts
      const fullContent = documents.map(d => d.text).join('\n\n');

      // Parse markdown structure
      const { structure, blocks } = this.parseMarkdown(fullContent, documentId);

      return {
        id: documentId,
        metadata: {
          filename: filePath.split('/').pop() || '',
          originalName: filePath.split('/').pop() || '',
          fileType,
          fileSize: 0,
          pageCount: documents.length,
          wordCount: fullContent.split(/\s+/).length,
          tableCount: blocks.filter(b => b.type === 'table').length,
          imageCount: 0,
          language: undefined,
        },
        structure,
        content: blocks,
        parserUsed: 'llamaparse',
        parsingConfidence: 0.9, // LlamaParse is generally reliable
        warnings,
      };

    } catch (error) {
      warnings.push({
        type: 'fallback_used',
        message: `LlamaParse error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'error',
      });
      throw error;
    }
  }

  private parseMarkdown(
    content: string,
    documentId: string
  ): { structure: DocumentStructure; blocks: ContentBlock[] } {
    const lines = content.split('\n');
    const blocks: ContentBlock[] = [];
    const sections: any[] = [];
    let blockIndex = 0;
    let currentParagraph = '';

    const flushParagraph = () => {
      if (currentParagraph.trim()) {
        blocks.push({
          id: `${documentId}-block-${blockIndex++}`,
          type: 'paragraph',
          content: currentParagraph.trim(),
          confidence: 0.9,
        });
        currentParagraph = '';
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Heading
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        flushParagraph();
        const level = headingMatch[1].length;
        const title = headingMatch[2];

        blocks.push({
          id: `${documentId}-block-${blockIndex++}`,
          type: 'heading',
          content: title,
          level,
          confidence: 0.95,
        });

        sections.push({ id: blocks[blocks.length - 1].id, title, level, children: [] });
        continue;
      }

      // Table
      if (line.includes('|') && lines[i + 1]?.match(/^\|[\s\-|]+\|$/)) {
        flushParagraph();
        const tableLines = [line];

        // Collect all table lines
        let j = i + 1;
        while (j < lines.length && lines[j].includes('|')) {
          tableLines.push(lines[j]);
          j++;
        }

        const tableData = this.parseMarkdownTable(tableLines);
        blocks.push({
          id: `${documentId}-block-${blockIndex++}`,
          type: 'table',
          content: tableLines.join('\n'),
          tableData,
          confidence: 0.85,
        });

        i = j - 1;
        continue;
      }

      // Code block
      if (line.startsWith('```')) {
        flushParagraph();
        const codeLines = [];
        let j = i + 1;
        while (j < lines.length && !lines[j].startsWith('```')) {
          codeLines.push(lines[j]);
          j++;
        }

        blocks.push({
          id: `${documentId}-block-${blockIndex++}`,
          type: 'code',
          content: codeLines.join('\n'),
          confidence: 0.95,
        });

        i = j;
        continue;
      }

      // List
      if (line.match(/^[\s]*[-*+]\s/) || line.match(/^[\s]*\d+\.\s/)) {
        flushParagraph();
        const listItems = [line.replace(/^[\s]*[-*+\d.]+\s/, '')];
        const isOrdered = /^\d+\./.test(line.trim());
        let j = i + 1;

        while (j < lines.length && (lines[j].match(/^[\s]*[-*+]\s/) || lines[j].match(/^[\s]*\d+\.\s/))) {
          listItems.push(lines[j].replace(/^[\s]*[-*+\d.]+\s/, ''));
          j++;
        }

        blocks.push({
          id: `${documentId}-block-${blockIndex++}`,
          type: 'list',
          content: listItems.join('\n'),
          listItems,
          listType: isOrdered ? 'ordered' : 'unordered',
          confidence: 0.9,
        });

        i = j - 1;
        continue;
      }

      // Empty line (paragraph break)
      if (!line.trim()) {
        flushParagraph();
        continue;
      }

      // Regular text
      currentParagraph += (currentParagraph ? ' ' : '') + line;
    }

    flushParagraph();

    return {
      structure: {
        sections: this.nestSections(sections),
        tableOfContents: sections.map(s => ({ title: s.title, level: s.level })),
      },
      blocks,
    };
  }

  private parseMarkdownTable(lines: string[]): any {
    const headers = lines[0]
      .split('|')
      .filter(c => c.trim())
      .map(c => c.trim());

    const rows = lines.slice(2).map(line =>
      line.split('|').filter(c => c.trim()).map(c => c.trim())
    );

    return {
      headers,
      rows,
      hasHeaderRow: true,
      rowCount: rows.length,
      columnCount: headers.length,
    };
  }

  private nestSections(sections: any[]): any[] {
    const nested: any[] = [];
    const stack: any[] = [];

    for (const section of sections) {
      while (stack.length > 0 && stack[stack.length - 1].level >= section.level) {
        stack.pop();
      }

      if (stack.length === 0) {
        nested.push(section);
      } else {
        stack[stack.length - 1].children.push(section);
      }

      stack.push(section);
    }

    return nested;
  }
}
```

### 2.7 Hybrid Parser Service

```typescript
// File: server/src/services/parsing/HybridParserService.ts

import { DocumentAnalyzer } from './DocumentAnalyzer';
import { DoclingParser } from './DoclingParser';
import { LlamaParseParser } from './LlamaParseParser';
import { ParsedDocument, ParserConfig, SupportedFormat, ParsingWarning } from '../../types/parsing';

export class HybridParserService {
  private analyzer: DocumentAnalyzer;
  private doclingParser: DoclingParser;
  private llamaParseParser: LlamaParseParser | null;
  private config: ParserConfig;

  constructor(config: ParserConfig) {
    this.config = config;
    this.analyzer = new DocumentAnalyzer();
    this.doclingParser = new DoclingParser(config.docling);

    // LlamaParse is optional (requires API key)
    if (config.llamaparse.apiKey) {
      this.llamaParseParser = new LlamaParseParser({
        ...config.llamaparse,
        timeout: 120000,
      });
    } else {
      this.llamaParseParser = null;
      console.warn('LlamaParse API key not configured, fallback disabled');
    }
  }

  async parse(filePath: string, fileType: SupportedFormat): Promise<ParsedDocument> {
    // Analyze document
    const analysis = await this.analyzer.analyze(filePath, fileType);
    const warnings: ParsingWarning[] = [];

    // Determine parser
    let useParser: 'docling' | 'llamaparse' = 'docling';

    if (this.llamaParseParser) {
      if (analysis.tableRatio > this.config.routing.tableThreshold) {
        useParser = 'llamaparse';
        warnings.push({
          type: 'fallback_used',
          message: `Using LlamaParse due to high table ratio (${analysis.tableRatio.toFixed(2)})`,
          severity: 'info',
        });
      } else if (analysis.isMultiColumn && this.config.routing.complexLayoutDetection) {
        useParser = 'llamaparse';
        warnings.push({
          type: 'fallback_used',
          message: 'Using LlamaParse due to complex multi-column layout',
          severity: 'info',
        });
      }
    }

    // Try primary parser
    try {
      const result = await this.runParser(useParser, filePath, fileType);
      result.warnings.push(...warnings);
      return result;

    } catch (error) {
      // Fallback to other parser
      const fallbackParser = useParser === 'docling' ? 'llamaparse' : 'docling';

      warnings.push({
        type: 'fallback_used',
        message: `${useParser} failed, falling back to ${fallbackParser}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: 'warning',
      });

      if (fallbackParser === 'llamaparse' && !this.llamaParseParser) {
        throw new Error(`Primary parser (${useParser}) failed and no fallback available`);
      }

      const result = await this.runParser(fallbackParser, filePath, fileType);
      result.warnings.push(...warnings);
      return result;
    }
  }

  private async runParser(
    parser: 'docling' | 'llamaparse',
    filePath: string,
    fileType: SupportedFormat
  ): Promise<ParsedDocument> {
    if (parser === 'docling') {
      return this.doclingParser.parse(filePath, fileType);
    } else {
      if (!this.llamaParseParser) {
        throw new Error('LlamaParse not configured');
      }
      return this.llamaParseParser.parse(filePath, fileType);
    }
  }

  async healthCheck(): Promise<{
    docling: boolean;
    llamaparse: boolean;
  }> {
    return {
      docling: true, // Would need to test
      llamaparse: this.llamaParseParser !== null,
    };
  }
}
```

### 2.8 Updated Document Service

```typescript
// File: server/src/services/DocumentService.ts (updates)

// Add to existing DocumentService:

import { HybridParserService } from './parsing/HybridParserService';
import { ParsedDocument, SupportedFormat } from '../types/parsing';

// Update supported formats
const SUPPORTED_FORMATS: SupportedFormat[] = ['pdf', 'docx', 'pptx', 'xlsx', 'html', 'md', 'txt'];

const MIME_TO_FORMAT: Record<string, SupportedFormat> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/html': 'html',
  'text/markdown': 'md',
  'text/plain': 'txt',
};

export class DocumentService {
  private hybridParser: HybridParserService;

  constructor(
    db: DatabaseService,
    vectorService: VectorService,
    config: any
  ) {
    // ... existing constructor ...

    this.hybridParser = new HybridParserService({
      docling: {
        ocrEnabled: config.DOCLING_OCR_ENABLED === 'true',
        ocrLanguages: (config.DOCLING_OCR_LANGUAGES || 'de,en').split(','),
        tableExtractionMode: config.DOCLING_TABLE_MODE || 'accurate',
        imageExtraction: false,
      },
      llamaparse: {
        apiKey: config.LLAMAPARSE_API_KEY || '',
        resultType: 'markdown',
      },
      routing: {
        tableThreshold: 0.5,
        complexLayoutDetection: true,
        validateTables: true,
      },
    });
  }

  async processDocument(
    filePath: string,
    mimeType: string,
    metadata: DocumentUploadMetadata
  ): Promise<ProcessedDocument> {
    const fileType = MIME_TO_FORMAT[mimeType];

    if (!fileType) {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }

    // Parse with hybrid parser
    const parsed = await this.hybridParser.parse(filePath, fileType);

    // Store in database
    const documentRecord = await this.storeDocumentRecord(parsed, metadata);

    // Chunk and index (see Phase 3)
    await this.chunkAndIndex(parsed, documentRecord.id);

    return {
      documentId: documentRecord.id,
      metadata: parsed.metadata,
      parserUsed: parsed.parserUsed,
      warnings: parsed.warnings,
    };
  }

  private async storeDocumentRecord(
    parsed: ParsedDocument,
    metadata: DocumentUploadMetadata
  ): Promise<any> {
    const result = await this.db.query(
      `INSERT INTO documents
       (filename, original_name, file_type, file_size, page_count,
        word_count, table_count, document_type, language, parser_used,
        parser_confidence, owner_id, classification, visibility, department)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        parsed.metadata.filename,
        parsed.metadata.originalName,
        parsed.metadata.fileType,
        parsed.metadata.fileSize,
        parsed.metadata.pageCount,
        parsed.metadata.wordCount,
        parsed.metadata.tableCount,
        metadata.category,
        parsed.metadata.language,
        parsed.parserUsed,
        parsed.parsingConfidence,
        metadata.ownerId,
        metadata.classification,
        metadata.visibility,
        metadata.department,
      ]
    );

    return result.rows[0];
  }
}
```

---

## 3. Phase 3: Advanced Chunking (Weeks 6-7)

### 3.1 Chunking Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CHUNKING PIPELINE                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ParsedDocument                                               │
│      │                                                        │
│      ▼                                                        │
│  ┌─────────────┐                                             │
│  │  Strategy   │ ─── Select based on document type           │
│  │  Selector   │                                             │
│  └──────┬──────┘                                             │
│         │                                                     │
│    ┌────┴────┬────────────┬────────────┐                     │
│    ▼         ▼            ▼            ▼                     │
│ ┌──────┐ ┌──────┐   ┌──────────┐  ┌────────┐                │
│ │Semantic│ │ Late │   │  Table   │  │ Fixed  │                │
│ │Chunker │ │Chunker│   │ Chunker  │  │(Legacy)│                │
│ └───┬───┘ └───┬───┘   └────┬─────┘  └───┬────┘                │
│     │         │            │            │                     │
│     └─────────┴────────────┴────────────┘                     │
│                       │                                       │
│                       ▼                                       │
│              ┌─────────────────┐                             │
│              │   Hierarchical  │                             │
│              │    Indexer      │                             │
│              └────────┬────────┘                             │
│                       │                                       │
│                       ▼                                       │
│              Chunks + Parent-Child Relations                  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Chunking Types

```typescript
// File: server/src/types/chunking.ts

export type ChunkingStrategy = 'semantic' | 'late' | 'table' | 'fixed';

export interface Chunk {
  id: string;
  documentId: string;
  content: string;
  tokenCount: number;

  // Chunking metadata
  chunkingMethod: ChunkingStrategy;
  level: 0 | 1 | 2;  // 0=document, 1=section, 2=paragraph

  // Hierarchy
  parentChunkId?: string;
  childChunkIds: string[];
  siblingChunkIds: string[];
  path: string;  // e.g., "doc/section-2/para-3"

  // Position
  pageStart?: number;
  pageEnd?: number;
  blockIds: string[];  // Original ContentBlock IDs

  // For retrieval
  includeParentInContext: boolean;

  // Embedding
  embedding?: number[];
}

export interface TableChunk extends Chunk {
  chunkType: 'table';
  tableData: {
    headers: string[];
    rows: string[][];
    caption?: string;
    rowRange?: [number, number];
  };
}

export interface ChunkerConfig {
  // Semantic chunking
  semantic: {
    embeddingModel: string;
    breakpointThreshold: number;
    minChunkSize: number;
    maxChunkSize: number;
  };

  // Late chunking
  late: {
    enabled: boolean;
    documentTypes: string[];
    minDocumentTokens: number;
    windowSize: number;
    overlap: number;
  };

  // Table chunking
  table: {
    maxRowsPerChunk: number;
    includeHeadersInEachChunk: boolean;
    generateSummary: boolean;
  };

  // Fixed (legacy)
  fixed: {
    chunkSize: number;
    overlap: number;
  };
}

export const DEFAULT_CHUNKER_CONFIG: ChunkerConfig = {
  semantic: {
    embeddingModel: 'nomic-embed-text',
    breakpointThreshold: 0.5,
    minChunkSize: 100,
    maxChunkSize: 1000,
  },
  late: {
    enabled: true,
    documentTypes: ['manual', 'policy', 'contract'],
    minDocumentTokens: 5000,
    windowSize: 8192,
    overlap: 512,
  },
  table: {
    maxRowsPerChunk: 20,
    includeHeadersInEachChunk: true,
    generateSummary: true,
  },
  fixed: {
    chunkSize: 500,
    overlap: 50,
  },
};
```

### 3.3 Semantic Chunker

```typescript
// File: server/src/services/chunking/SemanticChunker.ts

import { EmbeddingService } from '../EmbeddingService';
import { ContentBlock } from '../../types/parsing';
import { Chunk, ChunkerConfig } from '../../types/chunking';
import { v4 as uuidv4 } from 'uuid';

export class SemanticChunker {
  constructor(
    private embeddingService: EmbeddingService,
    private config: ChunkerConfig['semantic']
  ) {}

  async chunk(
    documentId: string,
    blocks: ContentBlock[]
  ): Promise<Chunk[]> {
    // Extract sentences from all blocks
    const sentences = this.extractSentences(blocks);

    if (sentences.length === 0) {
      return [];
    }

    // Generate embeddings for all sentences
    const embeddings = await this.embeddingService.generateEmbeddings(
      sentences.map(s => s.text),
      this.config.embeddingModel
    );

    // Calculate similarity between consecutive sentences
    const similarities = this.calculateSimilarities(embeddings);

    // Find breakpoints where similarity drops
    const breakpoints = this.findBreakpoints(similarities);

    // Group sentences into chunks
    const chunks = this.createChunks(documentId, sentences, breakpoints);

    return chunks;
  }

  private extractSentences(blocks: ContentBlock[]): Array<{
    text: string;
    blockId: string;
    pageNumber?: number;
  }> {
    const sentences: Array<{ text: string; blockId: string; pageNumber?: number }> = [];

    for (const block of blocks) {
      if (block.type === 'paragraph' || block.type === 'heading') {
        // Split by sentence boundaries
        const blockSentences = block.content.match(/[^.!?]+[.!?]+/g) || [block.content];

        for (const sentence of blockSentences) {
          const trimmed = sentence.trim();
          if (trimmed.length > 10) {
            sentences.push({
              text: trimmed,
              blockId: block.id,
              pageNumber: block.pageNumber,
            });
          }
        }
      }
    }

    return sentences;
  }

  private calculateSimilarities(embeddings: number[][]): number[] {
    const similarities: number[] = [];

    for (let i = 0; i < embeddings.length - 1; i++) {
      const similarity = this.cosineSimilarity(embeddings[i], embeddings[i + 1]);
      similarities.push(similarity);
    }

    return similarities;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private findBreakpoints(similarities: number[]): number[] {
    if (similarities.length === 0) return [];

    // Calculate threshold based on percentile
    const sorted = [...similarities].sort((a, b) => a - b);
    const thresholdIndex = Math.floor(sorted.length * (1 - this.config.breakpointThreshold));
    const threshold = sorted[Math.max(0, thresholdIndex)];

    // Find indices where similarity is below threshold
    const breakpoints: number[] = [];

    for (let i = 0; i < similarities.length; i++) {
      if (similarities[i] < threshold) {
        breakpoints.push(i + 1); // Breakpoint is AFTER the sentence
      }
    }

    return breakpoints;
  }

  private createChunks(
    documentId: string,
    sentences: Array<{ text: string; blockId: string; pageNumber?: number }>,
    breakpoints: number[]
  ): Chunk[] {
    const chunks: Chunk[] = [];
    let chunkIndex = 0;
    let startIdx = 0;

    const allBreakpoints = [...breakpoints, sentences.length];

    for (const endIdx of allBreakpoints) {
      const chunkSentences = sentences.slice(startIdx, endIdx);

      if (chunkSentences.length === 0) continue;

      const content = chunkSentences.map(s => s.text).join(' ');
      const tokenCount = content.split(/\s+/).length;

      // Check size constraints
      if (tokenCount < this.config.minChunkSize && chunks.length > 0) {
        // Merge with previous chunk
        const prevChunk = chunks[chunks.length - 1];
        prevChunk.content += ' ' + content;
        prevChunk.tokenCount += tokenCount;
        prevChunk.blockIds.push(...chunkSentences.map(s => s.blockId));
      } else if (tokenCount > this.config.maxChunkSize) {
        // Split into smaller chunks
        const subChunks = this.splitLargeChunk(documentId, chunkSentences, chunkIndex);
        chunks.push(...subChunks);
        chunkIndex += subChunks.length;
      } else {
        chunks.push({
          id: `${documentId}-chunk-${chunkIndex++}`,
          documentId,
          content,
          tokenCount,
          chunkingMethod: 'semantic',
          level: 2,
          childChunkIds: [],
          siblingChunkIds: [],
          path: `${documentId}/chunk-${chunkIndex}`,
          pageStart: chunkSentences[0].pageNumber,
          pageEnd: chunkSentences[chunkSentences.length - 1].pageNumber,
          blockIds: chunkSentences.map(s => s.blockId),
          includeParentInContext: true,
        });
      }

      startIdx = endIdx;
    }

    // Set sibling relationships
    for (let i = 0; i < chunks.length; i++) {
      if (i > 0) chunks[i].siblingChunkIds.push(chunks[i - 1].id);
      if (i < chunks.length - 1) chunks[i].siblingChunkIds.push(chunks[i + 1].id);
    }

    return chunks;
  }

  private splitLargeChunk(
    documentId: string,
    sentences: Array<{ text: string; blockId: string; pageNumber?: number }>,
    startIndex: number
  ): Chunk[] {
    const chunks: Chunk[] = [];
    let currentContent = '';
    let currentTokens = 0;
    let currentBlockIds: string[] = [];
    let chunkIndex = startIndex;

    for (const sentence of sentences) {
      const sentenceTokens = sentence.text.split(/\s+/).length;

      if (currentTokens + sentenceTokens > this.config.maxChunkSize && currentContent) {
        chunks.push({
          id: `${documentId}-chunk-${chunkIndex++}`,
          documentId,
          content: currentContent.trim(),
          tokenCount: currentTokens,
          chunkingMethod: 'semantic',
          level: 2,
          childChunkIds: [],
          siblingChunkIds: [],
          path: `${documentId}/chunk-${chunkIndex}`,
          pageStart: sentence.pageNumber,
          pageEnd: sentence.pageNumber,
          blockIds: [...currentBlockIds],
          includeParentInContext: true,
        });

        currentContent = '';
        currentTokens = 0;
        currentBlockIds = [];
      }

      currentContent += ' ' + sentence.text;
      currentTokens += sentenceTokens;
      currentBlockIds.push(sentence.blockId);
    }

    if (currentContent.trim()) {
      chunks.push({
        id: `${documentId}-chunk-${chunkIndex++}`,
        documentId,
        content: currentContent.trim(),
        tokenCount: currentTokens,
        chunkingMethod: 'semantic',
        level: 2,
        childChunkIds: [],
        siblingChunkIds: [],
        path: `${documentId}/chunk-${chunkIndex}`,
        blockIds: currentBlockIds,
        includeParentInContext: true,
      });
    }

    return chunks;
  }
}
```

### 3.4 Table Chunker

```typescript
// File: server/src/services/chunking/TableChunker.ts

import { ContentBlock, TableStructure } from '../../types/parsing';
import { Chunk, TableChunk, ChunkerConfig } from '../../types/chunking';
import { v4 as uuidv4 } from 'uuid';

export class TableChunker {
  constructor(private config: ChunkerConfig['table']) {}

  chunk(documentId: string, blocks: ContentBlock[]): (Chunk | TableChunk)[] {
    const chunks: (Chunk | TableChunk)[] = [];
    let chunkIndex = 0;

    for (const block of blocks) {
      if (block.type === 'table' && block.tableData) {
        const tableChunks = this.chunkTable(
          documentId,
          block,
          chunkIndex
        );
        chunks.push(...tableChunks);
        chunkIndex += tableChunks.length;
      }
    }

    return chunks;
  }

  private chunkTable(
    documentId: string,
    block: ContentBlock,
    startIndex: number
  ): TableChunk[] {
    const table = block.tableData!;
    const chunks: TableChunk[] = [];

    if (table.rowCount <= this.config.maxRowsPerChunk) {
      // Small table: keep as single chunk
      chunks.push(this.createTableChunk(
        documentId,
        startIndex,
        table,
        block,
        0,
        table.rowCount
      ));
    } else {
      // Large table: split by rows
      for (let start = 0; start < table.rowCount; start += this.config.maxRowsPerChunk) {
        const end = Math.min(start + this.config.maxRowsPerChunk, table.rowCount);
        chunks.push(this.createTableChunk(
          documentId,
          startIndex + chunks.length,
          table,
          block,
          start,
          end
        ));
      }
    }

    // Generate table summary if configured
    if (this.config.generateSummary) {
      const summary = this.generateTableSummary(table, block);
      chunks.push({
        id: `${documentId}-table-summary-${startIndex}`,
        documentId,
        content: summary,
        tokenCount: summary.split(/\s+/).length,
        chunkingMethod: 'table',
        level: 2,
        childChunkIds: [],
        siblingChunkIds: chunks.map(c => c.id),
        path: `${documentId}/table-summary-${startIndex}`,
        pageStart: block.pageNumber,
        pageEnd: block.pageNumber,
        blockIds: [block.id],
        includeParentInContext: false,
        chunkType: 'table',
        tableData: {
          headers: table.headers,
          rows: [],
          caption: `Summary of table with ${table.rowCount} rows`,
        },
      });
    }

    return chunks;
  }

  private createTableChunk(
    documentId: string,
    index: number,
    table: TableStructure,
    block: ContentBlock,
    rowStart: number,
    rowEnd: number
  ): TableChunk {
    const rows = table.rows.slice(rowStart, rowEnd);
    const content = this.tableToMarkdown(table.headers, rows, table.caption);

    return {
      id: `${documentId}-table-${index}`,
      documentId,
      content,
      tokenCount: content.split(/\s+/).length,
      chunkingMethod: 'table',
      level: 2,
      childChunkIds: [],
      siblingChunkIds: [],
      path: `${documentId}/table-${index}`,
      pageStart: block.pageNumber,
      pageEnd: block.pageNumber,
      blockIds: [block.id],
      includeParentInContext: true,
      chunkType: 'table',
      tableData: {
        headers: table.headers,
        rows,
        caption: table.caption,
        rowRange: [rowStart, rowEnd],
      },
    };
  }

  private tableToMarkdown(headers: string[], rows: string[][], caption?: string): string {
    let md = '';

    if (caption) {
      md += `**${caption}**\n\n`;
    }

    md += '| ' + headers.join(' | ') + ' |\n';
    md += '| ' + headers.map(() => '---').join(' | ') + ' |\n';

    for (const row of rows) {
      md += '| ' + row.join(' | ') + ' |\n';
    }

    return md;
  }

  private generateTableSummary(table: TableStructure, block: ContentBlock): string {
    const summary = [];

    summary.push(`Tabelle mit ${table.rowCount} Zeilen und ${table.columnCount} Spalten.`);

    if (table.caption) {
      summary.push(`Titel: ${table.caption}`);
    }

    summary.push(`Spalten: ${table.headers.join(', ')}`);

    // Sample some data
    if (table.rows.length > 0) {
      summary.push(`Beispieldaten aus erster Zeile: ${table.rows[0].join(', ')}`);
    }

    return summary.join('\n');
  }
}
```

### 3.5 Hierarchical Indexer

```typescript
// File: server/src/services/chunking/HierarchicalIndexer.ts

import { ParsedDocument, ContentBlock, Section } from '../../types/parsing';
import { Chunk } from '../../types/chunking';
import { v4 as uuidv4 } from 'uuid';

interface HierarchicalChunk extends Chunk {
  sectionTitle?: string;
  sectionPath: string[];
}

export class HierarchicalIndexer {
  /**
   * Creates parent chunks (level 1) from sections
   * and links child chunks (level 2) to their parents
   */
  createHierarchy(
    documentId: string,
    parsed: ParsedDocument,
    childChunks: Chunk[]
  ): {
    parentChunks: Chunk[];
    updatedChildChunks: Chunk[];
  } {
    const parentChunks: Chunk[] = [];
    const updatedChildChunks = [...childChunks];

    // Create document-level chunk (level 0)
    const documentChunk: Chunk = {
      id: `${documentId}-doc`,
      documentId,
      content: parsed.structure.title || parsed.metadata.originalName,
      tokenCount: 10,
      chunkingMethod: 'semantic',
      level: 0,
      childChunkIds: [],
      siblingChunkIds: [],
      path: documentId,
      includeParentInContext: false,
      blockIds: [],
    };

    // Create section-level chunks (level 1)
    const sectionChunks = this.createSectionChunks(
      documentId,
      parsed.structure.sections,
      parsed.content
    );

    // Link children to parents based on page numbers and block IDs
    for (const childChunk of updatedChildChunks) {
      const parentSection = this.findParentSection(
        childChunk,
        sectionChunks,
        parsed.content
      );

      if (parentSection) {
        childChunk.parentChunkId = parentSection.id;
        childChunk.level = 2;
        childChunk.path = `${parentSection.path}/${childChunk.id.split('-').pop()}`;
        parentSection.childChunkIds.push(childChunk.id);
      } else {
        // No section found, link to document
        childChunk.parentChunkId = documentChunk.id;
        documentChunk.childChunkIds.push(childChunk.id);
      }
    }

    // Link sections to document
    for (const section of sectionChunks) {
      section.parentChunkId = documentChunk.id;
      documentChunk.childChunkIds.push(section.id);
    }

    return {
      parentChunks: [documentChunk, ...sectionChunks],
      updatedChildChunks,
    };
  }

  private createSectionChunks(
    documentId: string,
    sections: Section[],
    blocks: ContentBlock[],
    parentPath: string = documentId
  ): Chunk[] {
    const chunks: Chunk[] = [];

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const sectionPath = `${parentPath}/${section.id}`;

      // Get content for this section (up to next section)
      const sectionContent = this.getSectionContent(section, blocks);

      const sectionChunk: Chunk = {
        id: `${documentId}-section-${section.id}`,
        documentId,
        content: `# ${section.title}\n\n${sectionContent}`,
        tokenCount: sectionContent.split(/\s+/).length,
        chunkingMethod: 'semantic',
        level: 1,
        childChunkIds: [],
        siblingChunkIds: [],
        path: sectionPath,
        pageStart: section.pageNumber,
        includeParentInContext: false,
        blockIds: [],
      };

      // Add sibling relationships
      if (i > 0) {
        sectionChunk.siblingChunkIds.push(chunks[chunks.length - 1].id);
        chunks[chunks.length - 1].siblingChunkIds.push(sectionChunk.id);
      }

      chunks.push(sectionChunk);

      // Recursively process children
      if (section.children.length > 0) {
        const childSections = this.createSectionChunks(
          documentId,
          section.children,
          blocks,
          sectionPath
        );

        // Link child sections
        for (const childSection of childSections) {
          childSection.parentChunkId = sectionChunk.id;
          sectionChunk.childChunkIds.push(childSection.id);
        }

        chunks.push(...childSections);
      }
    }

    return chunks;
  }

  private getSectionContent(section: Section, blocks: ContentBlock[]): string {
    // Find blocks that belong to this section
    // This is a simplified approach - in reality, we'd need to track
    // which blocks belong to which sections based on page/position
    const sectionBlocks = blocks.filter(block =>
      block.parentSectionId === section.id ||
      (block.pageNumber === section.pageNumber && block.type === 'paragraph')
    );

    return sectionBlocks
      .slice(0, 5) // Limit to first 5 blocks for parent context
      .map(b => b.content)
      .join('\n\n');
  }

  private findParentSection(
    chunk: Chunk,
    sections: Chunk[],
    blocks: ContentBlock[]
  ): Chunk | null {
    // Find section by matching page numbers
    if (chunk.pageStart !== undefined) {
      const matchingSections = sections.filter(
        s => s.pageStart !== undefined && s.pageStart <= chunk.pageStart!
      );

      if (matchingSections.length > 0) {
        // Return the most specific (last) matching section
        return matchingSections[matchingSections.length - 1];
      }
    }

    // Fallback: find by block IDs
    for (const section of sections) {
      const sectionBlockIds = new Set(section.blockIds);
      const hasOverlap = chunk.blockIds.some(id => sectionBlockIds.has(id));
      if (hasOverlap) {
        return section;
      }
    }

    return null;
  }
}
```

### 3.6 Chunking Pipeline Service

```typescript
// File: server/src/services/chunking/ChunkingPipeline.ts

import { SemanticChunker } from './SemanticChunker';
import { TableChunker } from './TableChunker';
import { HierarchicalIndexer } from './HierarchicalIndexer';
import { EmbeddingService } from '../EmbeddingService';
import { ParsedDocument, ContentBlock } from '../../types/parsing';
import { Chunk, ChunkerConfig, ChunkingStrategy, DEFAULT_CHUNKER_CONFIG } from '../../types/chunking';

export class ChunkingPipeline {
  private semanticChunker: SemanticChunker;
  private tableChunker: TableChunker;
  private hierarchicalIndexer: HierarchicalIndexer;
  private config: ChunkerConfig;

  constructor(
    embeddingService: EmbeddingService,
    config: Partial<ChunkerConfig> = {}
  ) {
    this.config = { ...DEFAULT_CHUNKER_CONFIG, ...config };
    this.semanticChunker = new SemanticChunker(embeddingService, this.config.semantic);
    this.tableChunker = new TableChunker(this.config.table);
    this.hierarchicalIndexer = new HierarchicalIndexer();
  }

  async process(parsed: ParsedDocument): Promise<{
    chunks: Chunk[];
    statistics: ChunkingStatistics;
  }> {
    const documentId = parsed.id;
    const allChunks: Chunk[] = [];

    // Determine strategy based on document type
    const strategy = this.selectStrategy(parsed);

    // Separate content by type
    const textBlocks = parsed.content.filter(b =>
      b.type === 'paragraph' || b.type === 'heading' || b.type === 'list'
    );
    const tableBlocks = parsed.content.filter(b => b.type === 'table');

    // Chunk text content
    const textChunks = await this.chunkText(documentId, textBlocks, strategy);
    allChunks.push(...textChunks);

    // Chunk tables separately
    const tableChunks = this.tableChunker.chunk(documentId, tableBlocks);
    allChunks.push(...tableChunks);

    // Create hierarchy
    const { parentChunks, updatedChildChunks } = this.hierarchicalIndexer.createHierarchy(
      documentId,
      parsed,
      allChunks
    );

    // Combine all chunks
    const finalChunks = [...parentChunks, ...updatedChildChunks];

    return {
      chunks: finalChunks,
      statistics: this.calculateStatistics(finalChunks, strategy),
    };
  }

  private selectStrategy(parsed: ParsedDocument): ChunkingStrategy {
    // Use late chunking for long documents with specific types
    if (
      this.config.late.enabled &&
      parsed.metadata.wordCount > this.config.late.minDocumentTokens &&
      this.config.late.documentTypes.includes(parsed.metadata.fileType)
    ) {
      return 'late';
    }

    // Default to semantic
    return 'semantic';
  }

  private async chunkText(
    documentId: string,
    blocks: ContentBlock[],
    strategy: ChunkingStrategy
  ): Promise<Chunk[]> {
    switch (strategy) {
      case 'semantic':
        return this.semanticChunker.chunk(documentId, blocks);

      case 'late':
        // Late chunking: process in larger windows first
        // For now, fallback to semantic with larger chunks
        const originalConfig = this.config.semantic;
        this.config.semantic = {
          ...originalConfig,
          maxChunkSize: this.config.late.windowSize,
        };
        const chunks = await this.semanticChunker.chunk(documentId, blocks);
        this.config.semantic = originalConfig;
        return chunks;

      case 'fixed':
      default:
        return this.fixedChunk(documentId, blocks);
    }
  }

  private fixedChunk(documentId: string, blocks: ContentBlock[]): Chunk[] {
    const chunks: Chunk[] = [];
    const fullText = blocks.map(b => b.content).join('\n\n');
    const words = fullText.split(/\s+/);

    let chunkIndex = 0;
    for (let i = 0; i < words.length; i += this.config.fixed.chunkSize - this.config.fixed.overlap) {
      const chunkWords = words.slice(i, i + this.config.fixed.chunkSize);
      const content = chunkWords.join(' ');

      chunks.push({
        id: `${documentId}-chunk-${chunkIndex++}`,
        documentId,
        content,
        tokenCount: chunkWords.length,
        chunkingMethod: 'fixed',
        level: 2,
        childChunkIds: [],
        siblingChunkIds: [],
        path: `${documentId}/chunk-${chunkIndex}`,
        blockIds: [],
        includeParentInContext: true,
      });
    }

    return chunks;
  }

  private calculateStatistics(chunks: Chunk[], strategy: ChunkingStrategy): ChunkingStatistics {
    const level0 = chunks.filter(c => c.level === 0);
    const level1 = chunks.filter(c => c.level === 1);
    const level2 = chunks.filter(c => c.level === 2);

    const tokenCounts = chunks.map(c => c.tokenCount);

    return {
      totalChunks: chunks.length,
      byLevel: {
        document: level0.length,
        section: level1.length,
        paragraph: level2.length,
      },
      byMethod: {
        semantic: chunks.filter(c => c.chunkingMethod === 'semantic').length,
        table: chunks.filter(c => c.chunkingMethod === 'table').length,
        fixed: chunks.filter(c => c.chunkingMethod === 'fixed').length,
        late: chunks.filter(c => c.chunkingMethod === 'late').length,
      },
      avgTokensPerChunk: tokenCounts.reduce((a, b) => a + b, 0) / chunks.length,
      minTokens: Math.min(...tokenCounts),
      maxTokens: Math.max(...tokenCounts),
      strategy,
    };
  }
}

interface ChunkingStatistics {
  totalChunks: number;
  byLevel: {
    document: number;
    section: number;
    paragraph: number;
  };
  byMethod: {
    semantic: number;
    table: number;
    fixed: number;
    late: number;
  };
  avgTokensPerChunk: number;
  minTokens: number;
  maxTokens: number;
  strategy: ChunkingStrategy;
}
```

### 3.7 Updated Weaviate Schema

```typescript
// File: server/src/services/VectorServiceV2.ts (schema update)

const DocumentChunksV2Schema = {
  class: 'DocumentChunksV2',
  description: 'Document chunks with hierarchical structure',
  vectorizer: 'none', // We provide our own embeddings
  properties: [
    { name: 'documentId', dataType: ['text'], indexFilterable: true, indexSearchable: false },
    { name: 'chunkId', dataType: ['text'], indexFilterable: true, indexSearchable: false },
    { name: 'content', dataType: ['text'], indexFilterable: false, indexSearchable: true },
    { name: 'chunkingMethod', dataType: ['text'], indexFilterable: true, indexSearchable: false },
    { name: 'level', dataType: ['int'], indexFilterable: true },
    { name: 'parentChunkId', dataType: ['text'], indexFilterable: true, indexSearchable: false },
    { name: 'path', dataType: ['text'], indexFilterable: false, indexSearchable: false },
    { name: 'pageStart', dataType: ['int'], indexFilterable: true },
    { name: 'pageEnd', dataType: ['int'], indexFilterable: true },
    { name: 'tokenCount', dataType: ['int'], indexFilterable: false },
    { name: 'documentType', dataType: ['text'], indexFilterable: true, indexSearchable: false },
    { name: 'department', dataType: ['text'], indexFilterable: true, indexSearchable: false },
  ],
};
```

---

## 4. Implementation Checklist

### Phase 2: Multi-Format Parsing

- [ ] Install dependencies: `docling`, `llamaindex`, `mammoth`, `xlsx`
- [ ] Create types: `server/src/types/parsing.ts`
- [ ] Implement `DocumentAnalyzer`
- [ ] Implement `DoclingParser`
- [ ] Implement `LlamaParseParser`
- [ ] Implement `HybridParserService`
- [ ] Update `DocumentService` for multi-format
- [ ] Update upload API to accept new formats
- [ ] Update frontend file input to accept new formats
- [ ] Test each format
- [ ] Run evaluation: Compare parsing quality

### Phase 3: Advanced Chunking

- [ ] Create types: `server/src/types/chunking.ts`
- [ ] Implement `SemanticChunker`
- [ ] Implement `TableChunker`
- [ ] Implement `HierarchicalIndexer`
- [ ] Implement `ChunkingPipeline`
- [ ] Update Weaviate schema to V2
- [ ] Update `VectorService` for parent-child retrieval
- [ ] Migration: Re-chunk existing documents
- [ ] Run evaluation: Compare V1+Rerank vs V2 Chunking

---

## 5. Migration Strategy

### Existing Documents

```typescript
// File: server/src/scripts/migrateToV2Chunking.ts

async function migrateDocuments() {
  // 1. Get all documents
  const documents = await db.query('SELECT * FROM documents');

  for (const doc of documents.rows) {
    console.log(`Migrating: ${doc.original_name}`);

    try {
      // 2. Re-parse with hybrid parser
      const parsed = await hybridParser.parse(doc.file_path, doc.file_type);

      // 3. Re-chunk with new pipeline
      const { chunks } = await chunkingPipeline.process(parsed);

      // 4. Delete old chunks from Weaviate
      await vectorService.deleteDocument(doc.id);

      // 5. Store new chunks
      await vectorService.storeChunks(chunks);

      // 6. Update document metadata
      await db.query(
        `UPDATE documents SET
         parser_used = $2,
         parser_confidence = $3,
         word_count = $4,
         table_count = $5
         WHERE id = $1`,
        [doc.id, parsed.parserUsed, parsed.parsingConfidence,
         parsed.metadata.wordCount, parsed.metadata.tableCount]
      );

      console.log(`  ✓ Migrated ${chunks.length} chunks`);

    } catch (error) {
      console.error(`  ✗ Failed: ${error}`);
    }
  }
}
```

---

## 6. Success Validation

### After Phase 2

```
Expected outputs:
├── 6 formats supported (PDF, DOCX, PPTX, XLSX, HTML, MD)
├── Hybrid parser working
│   ├── Docling as primary
│   └── LlamaParse fallback functional
├── Table extraction accuracy ≥95%
└── Upload UI accepts new formats
```

### After Phase 3

```
Expected outputs:
├── Semantic chunking operational
├── Table-aware chunking working
├── Hierarchical indexer creating parent-child relations
├── Weaviate V2 schema deployed
├── Evaluation report:
│   ├── Recall@20 improvement ≥10% vs Spec 1
│   └── By category breakdown
└── Existing documents migrated
```

---

## 7. Next Steps

After completing Spec 2:

1. Review evaluation results
2. Confirm Recall@20 ≥10% improvement
3. Verify all formats working
4. Proceed to **Spec 3: Intelligence & Production**

---

**Spec Status:** Ready for Implementation
**Estimated Duration:** 5 weeks
**Dependencies:** Spec 1 (Evaluation + Reranking)
**Blocks:** Spec 3
