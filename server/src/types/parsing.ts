/**
 * Document Parsing Types for RAG V2 Phase 2
 *
 * Defines types for multi-format document parsing using the
 * Docling-based parser microservice.
 */

// ============================================
// Supported Formats
// ============================================

/**
 * Supported file formats for document parsing
 */
export type SupportedFormat = 'pdf' | 'docx' | 'pptx' | 'xlsx' | 'html' | 'md' | 'txt';

/**
 * MIME type mapping for supported formats
 */
export const MIME_TYPE_MAP: Record<string, SupportedFormat> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/html': 'html',
  'text/markdown': 'md',
  'text/plain': 'txt',
};

/**
 * File extension mapping
 */
export const EXTENSION_MAP: Record<string, SupportedFormat> = {
  '.pdf': 'pdf',
  '.docx': 'docx',
  '.pptx': 'pptx',
  '.xlsx': 'xlsx',
  '.html': 'html',
  '.htm': 'html',
  '.md': 'md',
  '.markdown': 'md',
  '.txt': 'txt',
};

/**
 * Get supported format from MIME type or extension
 */
export function getSupportedFormat(mimeType?: string, filename?: string): SupportedFormat | null {
  // Try MIME type first
  if (mimeType && MIME_TYPE_MAP[mimeType]) {
    return MIME_TYPE_MAP[mimeType];
  }

  // Try file extension
  if (filename) {
    const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0];
    if (ext && EXTENSION_MAP[ext]) {
      return EXTENSION_MAP[ext];
    }
  }

  return null;
}

// ============================================
// Content Block Types
// ============================================

/**
 * Type of content block in a parsed document
 */
export type ContentBlockType =
  | 'paragraph'
  | 'heading'
  | 'table'
  | 'list'
  | 'code'
  | 'image'
  | 'caption'
  | 'footer'
  | 'header';

/**
 * Heading level (1-6)
 */
export type HeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * List type
 */
export type ListType = 'ordered' | 'unordered';

/**
 * Table cell structure
 */
export interface TableCell {
  content: string;
  row: number;
  col: number;
  rowSpan?: number;
  colSpan?: number;
  isHeader?: boolean;
}

/**
 * Table structure for parsed tables
 */
export interface TableStructure {
  rows: number;
  cols: number;
  headers: string[];
  cells: TableCell[];
  /** Markdown representation of the table */
  markdown: string;
  /** Whether table has a header row */
  hasHeader: boolean;
}

/**
 * Image metadata
 */
export interface ImageMetadata {
  /** Image source path or reference */
  src?: string;
  /** Alt text or caption */
  alt?: string;
  /** Image dimensions */
  width?: number;
  height?: number;
  /** Base64 encoded image data (for inline images) */
  data?: string;
}

/**
 * Content block in a parsed document
 */
export interface ContentBlock {
  /** Block type */
  type: ContentBlockType;
  /** Text content (for text-based blocks) */
  content: string;
  /** Page number (1-indexed) */
  pageNumber?: number;
  /** Position in the document (0-indexed) */
  position: number;
  /** Heading level (for heading blocks) */
  headingLevel?: HeadingLevel;
  /** List type (for list blocks) */
  listType?: ListType;
  /** List items (for list blocks) */
  listItems?: string[];
  /** Table structure (for table blocks) */
  table?: TableStructure;
  /** Code language (for code blocks) */
  codeLanguage?: string;
  /** Image metadata (for image blocks) */
  image?: ImageMetadata;
  /** Bounding box for visual positioning */
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Confidence score from parser (0-1) */
  confidence?: number;
}

// ============================================
// Parsed Document
// ============================================

/**
 * Document metadata from parsing
 */
export interface DocumentParseMetadata {
  /** Original filename */
  filename: string;
  /** Detected format */
  format: SupportedFormat;
  /** File size in bytes */
  fileSize: number;
  /** Total pages (for paginated documents) */
  pageCount: number;
  /** Document title (if detected) */
  title?: string;
  /** Document author (if detected) */
  author?: string;
  /** Creation date (if detected) */
  createdDate?: string;
  /** Modification date (if detected) */
  modifiedDate?: string;
  /** Parsing duration in milliseconds */
  parsingDurationMs: number;
  /** Parser used (e.g., 'docling') */
  parser: string;
  /** Parser version */
  parserVersion?: string;
}

/**
 * Parsing warning or error
 */
export interface ParsingWarning {
  /** Warning code for categorization */
  code: string;
  /** Human-readable message */
  message: string;
  /** Page number where issue occurred */
  pageNumber?: number;
  /** Position in document */
  position?: number;
  /** Severity level */
  severity: 'warning' | 'error';
}

/**
 * Complete parsed document
 */
export interface ParsedDocument {
  /** Unique document ID */
  documentId: string;
  /** Document metadata */
  metadata: DocumentParseMetadata;
  /** Content blocks in order */
  blocks: ContentBlock[];
  /** Full text extracted (for fallback/search) */
  fullText: string;
  /** Document structure/outline */
  outline: DocumentOutlineItem[];
  /** Parsing warnings */
  warnings: ParsingWarning[];
  /** Whether parsing completed successfully */
  success: boolean;
}

/**
 * Document outline item (table of contents)
 */
export interface DocumentOutlineItem {
  /** Heading text */
  title: string;
  /** Heading level */
  level: HeadingLevel;
  /** Page number */
  pageNumber?: number;
  /** Position in document */
  position: number;
  /** Nested children */
  children: DocumentOutlineItem[];
}

// ============================================
// Parser Service API Types
// ============================================

/**
 * Request to parse a document
 */
export interface ParseRequest {
  /** Base64 encoded file content */
  fileContent: string;
  /** Original filename (for format detection) */
  filename: string;
  /** MIME type (optional, for format detection) */
  mimeType?: string;
  /** Options for parsing */
  options?: ParseOptions;
}

/**
 * Parsing options
 */
export interface ParseOptions {
  /** Extract tables */
  extractTables?: boolean;
  /** Extract images */
  extractImages?: boolean;
  /** OCR for scanned PDFs */
  enableOCR?: boolean;
  /** Maximum pages to parse (0 = all) */
  maxPages?: number;
  /** Target language for OCR */
  language?: string;
}

/**
 * Response from parser service
 */
export interface ParseResponse {
  /** Whether parsing succeeded */
  success: boolean;
  /** Parsed document (if successful) */
  document?: ParsedDocument;
  /** Error message (if failed) */
  error?: string;
  /** Processing time in ms */
  processingTimeMs: number;
}

/**
 * Parser service health check response
 */
export interface ParserHealthResponse {
  status: 'ok' | 'loading' | 'error';
  parser: string;
  version: string;
  supportedFormats: SupportedFormat[];
  ready: boolean;
}
