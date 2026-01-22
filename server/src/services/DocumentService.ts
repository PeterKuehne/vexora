import { extractText } from 'unpdf';
import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { vectorService } from './VectorService.js';
import { databaseService } from './DatabaseService.js';

/**
 * DocumentService - Handles PDF processing and document management with PostgreSQL persistence
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

export interface DocumentMetadata {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  type: 'pdf';
  uploadedAt: string;
  pages: number;
  text?: string;
  category: DocumentCategory;
  tags: string[];
}

export interface ProcessingResult {
  success: boolean;
  document?: DocumentMetadata;
  error?: string;
}

// Validation schema for document processing
export const documentUploadSchema = z.object({
  filename: z.string().min(1),
  originalName: z.string().min(1),
  size: z.number().positive().max(50 * 1024 * 1024), // 50MB max
  type: z.literal('pdf'),
  category: z.enum(DOCUMENT_CATEGORIES).optional().default('Allgemein'),
  tags: z.array(z.string().max(50)).max(10).optional().default([]),
});

export type DocumentUploadRequest = z.infer<typeof documentUploadSchema>;

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
   * Process uploaded PDF file
   */
  async processPDF(filePath: string, metadata: DocumentUploadRequest): Promise<ProcessingResult> {
    await this.initialize();

    try {
      // Validate metadata
      const validatedMetadata = documentUploadSchema.parse(metadata);

      // Extract text from PDF using unpdf
      const data = await fs.readFile(filePath);
      // Convert Buffer to Uint8Array for unpdf
      const uint8Data = new Uint8Array(data);
      const { text, totalPages } = await extractText(uint8Data, { mergePages: true });

      // Generate unique ID
      const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const document: DocumentMetadata = {
        id: documentId,
        filename: validatedMetadata.filename,
        originalName: validatedMetadata.originalName,
        size: validatedMetadata.size,
        type: 'pdf',
        uploadedAt: new Date().toISOString(),
        pages: totalPages,
        text: text.trim(),
        category: validatedMetadata.category ?? 'Allgemein',
        tags: validatedMetadata.tags ?? [],
      };

      // Store in PostgreSQL with chunk count tracking
      let chunkCount = 0;
      try {
        // Store document chunks in vector database for RAG
        await vectorService.storeDocument(document);

        // Get chunk count from vector service
        const chunks = Math.ceil(text.length / 512); // Approximate chunk count
        chunkCount = chunks;
      } catch (vectorError) {
        console.warn(`⚠️  Failed to store in vector database: ${vectorError}`);
        // Continue with PostgreSQL storage even if vector storage fails
      }

      // Insert into PostgreSQL
      await databaseService.query(
        `INSERT INTO documents (
          id, filename, file_type, file_size, upload_date,
          processed_date, status, chunk_count, category, tags
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          documentId,
          validatedMetadata.originalName, // Store originalName in filename column
          'pdf',
          validatedMetadata.size,
          new Date(),
          new Date(), // processed_date
          'completed',
          chunkCount,
          validatedMetadata.category ?? 'Allgemein',
          validatedMetadata.tags ?? [],
        ]
      );

      return {
        success: true,
        document,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during PDF processing',
      };
    }
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
        upload_date, chunk_count, category, tags
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
      pages: Math.ceil(row.chunk_count / 2),
      category: (row.category || 'Allgemein') as DocumentCategory,
      tags: row.tags || [],
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

    // Remove from vector database
    try {
      await vectorService.deleteDocument(id);
    } catch (vectorError) {
      console.warn(`⚠️  Failed to remove from vector database: ${vectorError}`);
      // Continue with deletion
    }

    // Clean up file (attempt, but don't fail if it doesn't exist)
    try {
      // Find file by ID pattern in uploads directory
      const files = await fs.readdir(this.uploadDir);
      const filePattern = new RegExp(`^${id.replace('doc_', '')}.*\\.pdf$`);
      const matchingFile = files.find(f => {
        const timestamp = id.split('_')[1];
        return f.startsWith(timestamp);
      });

      if (matchingFile) {
        await fs.unlink(path.join(this.uploadDir, matchingFile));
      }
    } catch {
      // File might already be deleted or moved
    }

    return true;
  }

  /**
   * Validate file size and type
   */
  validateFile(file: Express.Multer.File): { valid: boolean; error?: string } {
    // Check file type
    if (file.mimetype !== 'application/pdf') {
      return { valid: false, error: 'Nur PDF-Dateien sind erlaubt' };
    }

    // Check file size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      return { valid: false, error: 'Datei zu groß (Maximum: 50MB)' };
    }

    return { valid: true };
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
        upload_date, chunk_count, category, tags,
        owner_id, department, classification
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
      pages: Math.ceil(row.chunk_count / 2),
      category: (row.category || 'Allgemein') as DocumentCategory,
      tags: row.tags || [],
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
