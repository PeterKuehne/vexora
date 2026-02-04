import { extractText } from 'unpdf';
import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { vectorService } from './VectorService.js';
import { vectorServiceV2 } from './VectorServiceV2.js';
import { databaseService } from './DatabaseService.js';
import { LoggerService } from './LoggerService.js';
import { parserClientService } from './parsing/ParserClientService.js';
import { chunkingPipeline } from './chunking/ChunkingPipeline.js';
import { getSupportedFormat, type SupportedFormat } from '../types/parsing.js';
import { createGraphServiceFromEnv } from './graph/index.js';

// Graph Service instance for entity extraction (Phase 4)
const graphService = createGraphServiceFromEnv(databaseService);

/**
 * DocumentService - Handles multi-format document processing with V2 chunking
 * RAG V2 Phase 2 - Supports PDF, DOCX, PPTX, XLSX, HTML, MD, TXT
 */

/**
 * Available document categories
 */
export const DOCUMENT_CATEGORIES = [
  'Allgemein',
  'Vertrag',
  'Rechnung',
  'Bericht',
  'Handbuch',
  'Präsentation',
  'Sonstiges',
] as const;

export type DocumentCategory = typeof DOCUMENT_CATEGORIES[number];

/**
 * Supported document types (V2)
 */
export type DocumentType = 'pdf' | 'docx' | 'pptx' | 'xlsx' | 'html' | 'md' | 'txt';

export interface DocumentMetadata {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  type: DocumentType;
  uploadedAt: string;
  updatedAt?: string;
  pages: number;
  text?: string;
  category: DocumentCategory;
  tags: string[];
  // V2 fields
  chunkingVersion?: 'v1' | 'v2';
  parserUsed?: string;
  totalTokens?: number;
  // Permission metadata (nested for frontend compatibility)
  metadata?: {
    classification?: string;
    visibility?: string;
    specificUsers?: string[];
    owner_id?: string;
    department?: string;
    allowed_roles?: string[];
    allowed_users?: string[];
  };
}

export interface ProcessingResult {
  success: boolean;
  document?: DocumentMetadata;
  error?: string;
}

// Supported MIME types for V2
export const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/html',
  'text/markdown',
  'text/plain',
] as const;

// Validation schema for document processing (V2 - multi-format)
export const documentUploadSchema = z.object({
  filename: z.string().min(1),
  originalName: z.string().min(1),
  size: z.number().positive().max(150 * 1024 * 1024), // 150MB max
  type: z.enum(['pdf', 'docx', 'pptx', 'xlsx', 'html', 'md', 'txt']).optional().default('pdf'),
  category: z.enum(DOCUMENT_CATEGORIES).optional().default('Allgemein'),
  tags: z.array(z.string().max(50)).max(10).optional().default([]),
});

export type DocumentUploadRequest = z.infer<typeof documentUploadSchema>;

// Environment config for chunking version
const CHUNKING_VERSION = (process.env.CHUNKING_VERSION || 'v2') as 'v1' | 'v2';

class DocumentService {
  private readonly uploadDir = './uploads';
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Don't call async initialize() in constructor - causes blocking issues
    // Instead, lazy initialize on first use
  }

  /**
   * Initialize service - call this before any operation
   * Uses promise caching to ensure initialization only happens once
   */
  private async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      await this.ensureUploadDir();
      await databaseService.initialize();
    })();

    return this.initPromise;
  }

  /**
   * Ensure upload directory exists
   */
  private async ensureUploadDir(): Promise<void> {
    try {
      await fs.access(this.uploadDir);
    } catch {
      await fs.mkdir(this.uploadDir, { recursive: true });
    }
  }

  /**
   * Process uploaded document (V2 multi-format support)
   * Uses parser service + semantic chunking when available
   */
  async processDocument(filePath: string, metadata: DocumentUploadRequest, permissionMetadata?: {
    ownerId?: string;
    department?: string;
    classification?: string;
    allowedRoles?: string[];
    allowedUsers?: string[];
  }): Promise<ProcessingResult> {
    await this.initialize();

    try {
      const validatedMetadata = documentUploadSchema.parse(metadata);
      const fileBuffer = await fs.readFile(filePath);

      // Detect format
      const format = getSupportedFormat(undefined, validatedMetadata.originalName);
      if (!format) {
        return {
          success: false,
          error: `Nicht unterstütztes Dateiformat: ${validatedMetadata.originalName}`,
        };
      }

      const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Try V2 processing with parser service
      if (CHUNKING_VERSION === 'v2') {
        const v2Result = await this.processDocumentV2(
          documentId,
          fileBuffer,
          validatedMetadata,
          format,
          permissionMetadata
        );
        if (v2Result.success) {
          return v2Result;
        }
        // Fall back to V1 for PDF if V2 fails
        console.log('⚠️  V2 processing failed, falling back to V1');
      }

      // V1 fallback (PDF only)
      if (format !== 'pdf') {
        return {
          success: false,
          error: `Format ${format} erfordert V2 Verarbeitung, aber Parser-Service nicht verfügbar`,
        };
      }

      return this.processPDFv1(documentId, fileBuffer, validatedMetadata, permissionMetadata);
    } catch (error) {
      LoggerService.logError(error instanceof Error ? error : new Error('Document processing failed'), {
        fileName: metadata.originalName,
        fileSize: metadata.size,
        department: permissionMetadata?.department
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during document processing',
      };
    }
  }

  /**
   * V2 Processing: Parser Service + Semantic Chunking
   */
  private async processDocumentV2(
    documentId: string,
    fileBuffer: Buffer,
    metadata: DocumentUploadRequest,
    format: SupportedFormat,
    permissionMetadata?: {
      ownerId?: string;
      department?: string;
      classification?: string;
      allowedRoles?: string[];
      allowedUsers?: string[];
    }
  ): Promise<ProcessingResult> {
    console.log(`📄 Processing document V2: ${metadata.originalName} (${format})`);

    // Step 1: Parse document
    const parseResult = await parserClientService.parseBuffer(
      fileBuffer,
      metadata.originalName
    );

    if (!parseResult.success || !parseResult.document) {
      console.warn(`⚠️  Parser failed: ${parseResult.error}`);
      return {
        success: false,
        error: parseResult.error || 'Parsing failed',
      };
    }

    const parsedDoc = parseResult.document;
    console.log(`✅ Parsed: ${parsedDoc.blocks.length} blocks, ${parsedDoc.metadata.pageCount} pages`);

    // Step 2: Chunk document
    const chunkingResult = await chunkingPipeline.processFromParsed(parsedDoc);
    console.log(`✅ Chunked: ${chunkingResult.stats.totalChunks} chunks`);

    // Step 3: Store in V2 Weaviate collection
    try {
      await vectorServiceV2.storeChunks(chunkingResult.chunks, {
        filename: metadata.filename,
        originalName: metadata.originalName,
        pageCount: parsedDoc.metadata.pageCount,
      });
    } catch (vectorError) {
      console.warn(`⚠️  Failed to store in V2 vector database: ${vectorError}`);
      // Continue - will also store in V1 for compatibility
    }

    // Step 4: Also store in V1 for backward compatibility (parallel operation)
    try {
      const legacyDoc: DocumentMetadata = {
        id: documentId,
        filename: metadata.filename,
        originalName: metadata.originalName,
        size: metadata.size,
        type: format as DocumentType,
        uploadedAt: new Date().toISOString(),
        pages: parsedDoc.metadata.pageCount,
        text: parsedDoc.fullText,
        category: metadata.category ?? 'Allgemein',
        tags: metadata.tags ?? [],
      };
      await vectorService.storeDocument(legacyDoc);
    } catch (v1Error) {
      console.warn(`⚠️  Failed to store in V1 vector database: ${v1Error}`);
    }

    // Step 5: Store in PostgreSQL
    const totalTokens = chunkingResult.chunks.reduce((sum, c) => sum + c.tokenCount, 0);

    await databaseService.query(
      `INSERT INTO documents (
        id, filename, file_type, file_size, upload_date,
        processed_date, status, chunk_count, category, tags,
        owner_id, department, classification, allowed_roles, allowed_users,
        file_format, parser_used, parsing_duration_ms, chunking_version,
        total_tokens, page_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
      [
        documentId,
        metadata.originalName,
        format,
        metadata.size,
        new Date(),
        new Date(),
        'completed',
        chunkingResult.stats.totalChunks,
        metadata.category ?? 'Allgemein',
        metadata.tags ?? [],
        permissionMetadata?.ownerId || null,
        permissionMetadata?.department || null,
        permissionMetadata?.classification || 'internal',
        permissionMetadata?.allowedRoles || null,
        permissionMetadata?.allowedUsers || null,
        format,
        parsedDoc.metadata.parser,
        Math.round(parsedDoc.metadata.parsingDurationMs),
        'v2',
        totalTokens,
        parsedDoc.metadata.pageCount,
      ]
    );

    // Step 6: Store chunk metadata
    for (const chunk of chunkingResult.chunks) {
      await databaseService.query(
        `INSERT INTO chunk_metadata (
          document_id, chunk_id, chunk_index, level, parent_chunk_id,
          path, chunking_method, page_start, page_end, token_count, char_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (document_id, chunk_id) DO NOTHING`,
        [
          documentId,
          chunk.id,
          chunk.chunkIndex,
          chunk.level,
          chunk.parentChunkId,
          chunk.path,
          chunk.chunkingMethod,
          chunk.pageStart,
          chunk.pageEnd,
          chunk.tokenCount,
          chunk.charCount,
        ]
      );
    }

    // Step 7: Extract entities for Knowledge Graph (Phase 4)
    try {
      await graphService.initialize();
      if (graphService.isReady()) {
        console.log(`🔗 Extracting entities for document ${documentId}...`);
        const graphResult = await graphService.processDocument(documentId, parsedDoc.blocks);
        console.log(`✅ Graph: ${graphResult.stats.entitiesExtracted} entities, ${graphResult.stats.relationshipsExtracted} relationships`);
      }
    } catch (graphError) {
      // Don't fail document processing if graph extraction fails
      console.warn(`⚠️  Entity extraction failed (non-critical): ${graphError}`);
    }

    LoggerService.logDocument('upload', {
      documentId,
      userId: permissionMetadata?.ownerId,
      fileName: metadata.originalName,
      fileSize: metadata.size,
      department: permissionMetadata?.department,
      classification: permissionMetadata?.classification || 'internal'
    });

    const document: DocumentMetadata = {
      id: documentId,
      filename: metadata.filename,
      originalName: metadata.originalName,
      size: metadata.size,
      type: format as DocumentType,
      uploadedAt: new Date().toISOString(),
      pages: parsedDoc.metadata.pageCount,
      text: parsedDoc.fullText,
      category: metadata.category ?? 'Allgemein',
      tags: metadata.tags ?? [],
      chunkingVersion: 'v2',
      parserUsed: parsedDoc.metadata.parser,
      totalTokens,
    };

    return { success: true, document };
  }

  /**
   * V1 Processing: Legacy PDF-only with unpdf
   */
  private async processPDFv1(
    documentId: string,
    fileBuffer: Buffer,
    metadata: DocumentUploadRequest,
    permissionMetadata?: {
      ownerId?: string;
      department?: string;
      classification?: string;
      allowedRoles?: string[];
      allowedUsers?: string[];
    }
  ): Promise<ProcessingResult> {
    console.log(`📄 Processing document V1 (legacy): ${metadata.originalName}`);

    const uint8Data = new Uint8Array(fileBuffer);
    const { text, totalPages } = await extractText(uint8Data, { mergePages: true });

    const document: DocumentMetadata = {
      id: documentId,
      filename: metadata.filename,
      originalName: metadata.originalName,
      size: metadata.size,
      type: 'pdf',
      uploadedAt: new Date().toISOString(),
      pages: totalPages,
      text: text.trim(),
      category: metadata.category ?? 'Allgemein',
      tags: metadata.tags ?? [],
      chunkingVersion: 'v1',
    };

    let chunkCount = 0;
    try {
      await vectorService.storeDocument(document);
      chunkCount = Math.ceil(text.length / 512);
    } catch (vectorError) {
      console.warn(`⚠️  Failed to store in vector database: ${vectorError}`);
    }

    await databaseService.query(
      `INSERT INTO documents (
        id, filename, file_type, file_size, upload_date,
        processed_date, status, chunk_count, category, tags,
        owner_id, department, classification, allowed_roles, allowed_users,
        chunking_version
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        documentId,
        metadata.originalName,
        'pdf',
        metadata.size,
        new Date(),
        new Date(),
        'completed',
        chunkCount,
        metadata.category ?? 'Allgemein',
        metadata.tags ?? [],
        permissionMetadata?.ownerId || null,
        permissionMetadata?.department || null,
        permissionMetadata?.classification || 'internal',
        permissionMetadata?.allowedRoles || null,
        permissionMetadata?.allowedUsers || null,
        'v1',
      ]
    );

    // Extract entities for Knowledge Graph (Phase 4) - V1 processing
    try {
      await graphService.initialize();
      if (graphService.isReady()) {
        console.log(`🔗 Extracting entities for document ${documentId} (V1)...`);
        // Convert V1 text to block format for entity extraction
        const textBlocks = [{ id: `${documentId}_full`, content: text }];
        const graphResult = await graphService.processDocument(documentId, textBlocks);
        console.log(`✅ Graph: ${graphResult.stats.entitiesExtracted} entities, ${graphResult.stats.relationshipsExtracted} relationships`);
      }
    } catch (graphError) {
      console.warn(`⚠️  Entity extraction failed (non-critical): ${graphError}`);
    }

    LoggerService.logDocument('upload', {
      documentId,
      userId: permissionMetadata?.ownerId,
      fileName: metadata.originalName,
      fileSize: metadata.size,
      department: permissionMetadata?.department,
      classification: permissionMetadata?.classification || 'internal'
    });

    return { success: true, document };
  }

  /**
   * Process uploaded PDF file (backward compatible alias)
   */
  async processPDF(filePath: string, metadata: DocumentUploadRequest, permissionMetadata?: {
    ownerId?: string;
    department?: string;
    classification?: string;
    allowedRoles?: string[];
    allowedUsers?: string[];
  }): Promise<ProcessingResult> {
    return this.processDocument(filePath, metadata, permissionMetadata);
  }

  /**
   * Get all documents
   */
  async getDocuments(): Promise<DocumentMetadata[]> {
    await this.initialize();

    const result = await databaseService.query(
      `SELECT
        id, filename, file_type, file_size,
        upload_date, chunk_count, category, tags
       FROM documents
       WHERE status = 'completed'
       ORDER BY upload_date DESC`
    );

    return result.rows.map(row => ({
      id: row.id,
      filename: row.id, // For compatibility with file storage
      originalName: row.filename,
      size: parseInt(row.file_size),
      type: 'pdf' as const,
      uploadedAt: row.upload_date,
      pages: Math.ceil(row.chunk_count / 2), // Approximate pages from chunks
      category: (row.category || 'Allgemein') as DocumentCategory,
      tags: row.tags || [],
    }));
  }

  /**
   * Get document by ID
   */
  async getDocument(id: string): Promise<DocumentMetadata | null> {
    await this.initialize();

    const result = await databaseService.query(
      `SELECT
        id, filename, file_type, file_size,
        upload_date, updated_at, chunk_count, category, tags,
        owner_id, department, classification, visibility, allowed_roles, allowed_users
       FROM documents
       WHERE id = $1 AND status = 'completed'`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0];
    return {
      id: row.id,
      filename: row.id,
      originalName: row.filename,
      size: parseInt(row.file_size),
      type: 'pdf',
      uploadedAt: row.upload_date,
      updatedAt: row.updated_at,
      pages: Math.ceil(row.chunk_count / 2),
      category: (row.category || 'Allgemein') as DocumentCategory,
      tags: row.tags || [],
      // Permission metadata
      metadata: {
        classification: row.classification || 'internal',
        visibility: row.visibility || 'department',
        specificUsers: row.allowed_users || [],
        owner_id: row.owner_id,
        department: row.department,
        allowed_roles: row.allowed_roles || [],
        allowed_users: row.allowed_users || [],
      },
    };
  }

  /**
   * Update document metadata (category, tags)
   */
  async updateDocument(id: string, updates: { category?: DocumentCategory; tags?: string[] }): Promise<DocumentMetadata | null> {
    await this.initialize();

    // Build dynamic UPDATE query
    const updateFields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.category !== undefined) {
      updateFields.push(`category = $${paramIndex}`);
      values.push(updates.category);
      paramIndex++;
    }

    if (updates.tags !== undefined) {
      updateFields.push(`tags = $${paramIndex}`);
      values.push(updates.tags);
      paramIndex++;
    }

    if (updateFields.length === 0) {
      return this.getDocument(id);
    }

    values.push(id); // For WHERE clause

    await databaseService.query(
      `UPDATE documents
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex}`,
      values
    );

    return this.getDocument(id);
  }

  /**
   * Update document permissions (classification, visibility, specific users)
   */
  async updateDocumentPermissions(
    id: string,
    permissions: {
      classification: string;
      visibility: string;
      specificUsers: string[]
    }
  ): Promise<DocumentMetadata | null> {
    await this.initialize();

    try {
      // Update permissions in individual columns
      const updateQuery = `
        UPDATE documents
        SET
          classification = $1,
          visibility = $2,
          allowed_users = $3,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
        RETURNING id
      `;

      const result = await databaseService.query(updateQuery, [
        permissions.classification,
        permissions.visibility,
        permissions.specificUsers || [],
        id
      ]);

      if (result.rowCount === 0) {
        return null;
      }

      // Return the updated document
      return this.getDocument(id);

    } catch (error) {
      console.error('Error updating document permissions:', error);
      throw new Error('Failed to update document permissions');
    }
  }

  /**
   * Get all unique tags across all documents
   */
  async getAllTags(): Promise<string[]> {
    await this.initialize();

    const result = await databaseService.query(
      `SELECT DISTINCT unnest(tags) as tag
       FROM documents
       WHERE status = 'completed'
       ORDER BY tag`
    );

    return result.rows.map(row => row.tag);
  }

  /**
   * Delete document
   */
  async deleteDocument(id: string): Promise<boolean> {
    await this.initialize();

    // Get document info before deletion
    const doc = await this.getDocument(id);
    if (!doc) return false;

    // Delete from PostgreSQL (cascades to related tables)
    const result = await databaseService.query(
      `DELETE FROM documents WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      return false;
    }

    // Remove from vector databases (V1 and V2)
    try {
      await vectorService.deleteDocument(id);
    } catch (vectorError) {
      console.warn(`⚠️  Failed to remove from V1 vector database: ${vectorError}`);
    }

    try {
      await vectorServiceV2.deleteDocument(id);
    } catch (vectorError) {
      console.warn(`⚠️  Failed to remove from V2 vector database: ${vectorError}`);
    }

    // Remove entities from Neo4j Knowledge Graph (Phase 4)
    try {
      if (graphService.isReady()) {
        const deletedCount = await graphService.deleteDocumentEntities(id);
        console.log(`🗑️  Removed ${deletedCount} entities from Neo4j for document ${id}`);
      }
    } catch (graphError) {
      console.warn(`⚠️  Failed to remove entities from Neo4j: ${graphError}`);
    }

    // Clean up file (attempt, but don't fail if it doesn't exist)
    try {
      // Find file by ID pattern in uploads directory
      const files = await fs.readdir(this.uploadDir);
      const timestamp = id.split('_')[1] || '';
      const matchingFile = files.find(f => {
        return timestamp && f.startsWith(timestamp);
      });

      if (matchingFile) {
        await fs.unlink(path.join(this.uploadDir, matchingFile));
      }
    } catch {
      // File might already be deleted or moved
    }

    // Log successful document deletion
    LoggerService.logDocument('delete', {
      documentId: id,
      fileName: doc.originalName,
      fileSize: doc.size,
      department: doc.metadata?.department
    });

    return true;
  }

  /**
   * Validate file size and type (V2 - multi-format support)
   */
  validateFile(file: Express.Multer.File): { valid: boolean; error?: string; format?: SupportedFormat } {
    // Check file size (150MB max)
    if (file.size > 150 * 1024 * 1024) {
      return { valid: false, error: 'Datei zu groß (Maximum: 150MB)' };
    }

    // Check if format is supported
    const format = getSupportedFormat(file.mimetype, file.originalname);

    if (!format) {
      return {
        valid: false,
        error: 'Nicht unterstütztes Dateiformat. Erlaubt: PDF, DOCX, PPTX, XLSX, HTML, MD, TXT'
      };
    }

    return { valid: true, format };
  }

  /**
   * Get supported file formats
   */
  getSupportedFormats(): string[] {
    return ['pdf', 'docx', 'pptx', 'xlsx', 'html', 'md', 'txt'];
  }

  /**
   * Check if V2 chunking is enabled
   */
  isV2Enabled(): boolean {
    return CHUNKING_VERSION === 'v2';
  }

  /**
   * Set user context for Row Level Security (RLS)
   * Must be called before any document access queries that require permissions
   */
  async setUserContext(userId: string, userRole: string, userDepartment?: string): Promise<void> {
    await this.initialize();

    await databaseService.query(
      'SELECT set_user_context($1, $2, $3)',
      [userId, userRole, userDepartment || '']
    );

    console.log(`🔐 Set user context: ${userRole} (${userDepartment}) for RLS`);
  }

  /**
   * Get accessible document IDs for the current user context
   * Uses PostgreSQL RLS policies to filter documents based on:
   * - Role hierarchy (Admin > Manager > Employee)
   * - Department access
   * - Owner permissions
   * - Explicit allowed roles/users
   * - Classification level access
   */
  async getAccessibleDocumentIds(): Promise<string[]> {
    await this.initialize();

    // Query uses RLS - will automatically filter based on current user context
    const result = await databaseService.query(
      `SELECT id FROM documents WHERE status = 'completed'`
    );

    const documentIds = result.rows.map(row => row.id);

    console.log(`🔍 Found ${documentIds.length} accessible documents for current user context`);

    return documentIds;
  }

  /**
   * Get full accessible documents with metadata for the current user context
   */
  async getAccessibleDocuments(): Promise<DocumentMetadata[]> {
    await this.initialize();

    const result = await databaseService.query(
      `SELECT
        id, filename, file_type, file_size,
        upload_date, updated_at, chunk_count, category, tags,
        owner_id, department, classification, visibility, allowed_roles, allowed_users
       FROM documents
       WHERE status = 'completed'
       ORDER BY upload_date DESC`
    );

    return result.rows.map(row => ({
      id: row.id,
      filename: row.id,
      originalName: row.filename,
      size: parseInt(row.file_size),
      type: 'pdf',
      uploadedAt: row.upload_date,
      updatedAt: row.updated_at,
      pages: Math.ceil(row.chunk_count / 2),
      category: (row.category || 'Allgemein') as DocumentCategory,
      tags: row.tags || [],
      // Permission metadata (nested for frontend compatibility)
      metadata: {
        classification: row.classification || 'internal',
        visibility: row.visibility || 'department',
        specificUsers: row.allowed_users || [],
        owner_id: row.owner_id,
        department: row.department,
        allowed_roles: row.allowed_roles || [],
        allowed_users: row.allowed_users || [],
      },
    }));
  }

  /**
   * Clear user context (for cleanup)
   */
  async clearUserContext(): Promise<void> {
    await this.initialize();

    await databaseService.query(
      `SELECT set_config('app.user_id', NULL, true),
              set_config('app.user_role', NULL, true),
              set_config('app.user_department', NULL, true)`
    );
  }
}

export const documentService = new DocumentService();
