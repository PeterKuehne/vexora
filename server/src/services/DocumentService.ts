import { extractText } from 'unpdf';
import fs from 'fs/promises';
import path from 'path';
import { z } from 'zod';
import { vectorService } from './VectorService.js';

/**
 * DocumentService - Handles PDF processing and document management
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
  private readonly documentsStorage = new Map<string, DocumentMetadata>();

  constructor() {
    this.ensureUploadDir();
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

      // Store document metadata (in production, this would go to PostgreSQL)
      this.documentsStorage.set(documentId, document);

      // Store document chunks in vector database for RAG
      try {
        await vectorService.storeDocument(document);
        console.log(`✅ Document stored in vector database: ${document.originalName}`);
      } catch (vectorError) {
        console.warn(`⚠️  Failed to store in vector database: ${vectorError}`);
        // Continue without vector storage - document is still usable
      }

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
    return Array.from(this.documentsStorage.values())
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  }

  /**
   * Get document by ID
   */
  async getDocument(id: string): Promise<DocumentMetadata | null> {
    return this.documentsStorage.get(id) || null;
  }

  /**
   * Update document metadata (category, tags)
   */
  async updateDocument(id: string, updates: { category?: DocumentCategory; tags?: string[] }): Promise<DocumentMetadata | null> {
    const document = this.documentsStorage.get(id);
    if (!document) return null;

    const updatedDocument: DocumentMetadata = {
      ...document,
      ...(updates.category !== undefined && { category: updates.category }),
      ...(updates.tags !== undefined && { tags: updates.tags }),
    };

    this.documentsStorage.set(id, updatedDocument);
    return updatedDocument;
  }

  /**
   * Get all unique tags across all documents
   */
  async getAllTags(): Promise<string[]> {
    const tagSet = new Set<string>();
    for (const doc of this.documentsStorage.values()) {
      doc.tags.forEach(tag => tagSet.add(tag));
    }
    return Array.from(tagSet).sort();
  }

  /**
   * Delete document
   */
  async deleteDocument(id: string): Promise<boolean> {
    const document = this.documentsStorage.get(id);
    if (!document) return false;

    // Remove from storage
    this.documentsStorage.delete(id);

    // Remove from vector database
    try {
      await vectorService.deleteDocument(id);
      console.log(`✅ Document removed from vector database: ${id}`);
    } catch (vectorError) {
      console.warn(`⚠️  Failed to remove from vector database: ${vectorError}`);
      // Continue with deletion
    }

    // Clean up file (attempt, but don't fail if it doesn't exist)
    try {
      await fs.unlink(path.join(this.uploadDir, document.filename));
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
}

export const documentService = new DocumentService();