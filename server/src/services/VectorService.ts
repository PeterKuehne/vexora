/**
 * VectorService - Weaviate v3 Integration for RAG Document Vector Storage
 *
 * Handles:
 * - Document chunking and embedding storage
 * - Hybrid search (BM25 + Vector semantic search)
 * - Document management in vector database
 * - Connection lifecycle management
 *
 * Uses Weaviate Client v3 with gRPC for 60-80% faster performance
 */

import weaviate, { WeaviateClient, vectorizer, dataType } from 'weaviate-client';
import { type DocumentMetadata } from './DocumentService.js';
import { embeddingService } from './EmbeddingService.js';
import { randomUUID } from 'crypto';
import { env } from '../config/env.js';

// ============================================
// Types
// ============================================

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  pageNumber?: number;
  chunkIndex: number;
  totalChunks: number;
}

export interface SearchResult {
  chunk: DocumentChunk;
  score: number;
  document: {
    id: string;
    filename: string;
    originalName: string;
    pages: number;
  };
}

export interface VectorSearchRequest {
  query: string;
  limit?: number;
  threshold?: number;
  hybridAlpha?: number; // 0 = pure BM25/keyword, 1 = pure vector/semantic
}

export interface VectorSearchResponse {
  results: SearchResult[];
  totalResults: number;
  query: string;
}

// TypeScript Generic for Collection Schema
interface DocumentChunkProperties {
  documentId: string;
  content: string;
  pageNumber: number;
  chunkIndex: number;
  totalChunks: number;
  filename: string;
  originalName: string;
  pages: number;
}

// Collection name constant
const COLLECTION_NAME = 'DocumentChunks';
const EMBEDDING_MODEL = 'nomic-embed-text';

class VectorService {
  private client: WeaviateClient | null = null;
  private initialized: boolean = false;
  private embeddingDimensions: number = 768; // Default for nomic-embed-text

  /**
   * Initialize Weaviate client with v3 API
   */
  async initialize(): Promise<void> {
    if (this.initialized && this.client) {
      return;
    }

    try {
      const weaviateUrl = env.WEAVIATE_URL || 'http://localhost:8080';
      const [host, port] = weaviateUrl.replace('http://', '').replace('https://', '').split(':');

      this.client = await weaviate.connectToCustom({
        httpHost: host,
        httpPort: parseInt(port) || 8080,
        httpSecure: false,
        grpcHost: host,
        grpcPort: 50051,
        grpcSecure: false,
        headers: {},
      }, {
        timeout: {
          init: 2,
          query: 60,
          insert: 120,
        },
      });

      console.log('✅ Weaviate v3 client initialized with gRPC');

      // Ensure collection exists
      await this.ensureCollection();

      // Get embedding dimensions
      const isAvailable = await embeddingService.isModelAvailable(EMBEDDING_MODEL);
      if (isAvailable) {
        this.embeddingDimensions = await embeddingService.getModelDimensions(EMBEDDING_MODEL);
        console.log(`✅ Embedding model: ${EMBEDDING_MODEL} (${this.embeddingDimensions} dimensions)`);
      } else {
        console.warn(`⚠️  Embedding model ${EMBEDDING_MODEL} not found. Vector search will be limited.`);
      }

      this.initialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize Weaviate client:', error);
      this.client = null;
      this.initialized = false;
      throw error;
    }
  }

  /**
   * Ensure collection exists using v3 Collections API
   */
  private async ensureCollection(): Promise<void> {
    if (!this.client) {
      throw new Error('Weaviate client not initialized');
    }

    try {
      // Check if collection exists
      const exists = await this.client.collections.exists(COLLECTION_NAME);

      if (exists) {
        console.log(`✅ Collection '${COLLECTION_NAME}' already exists`);
        return;
      }

      // Create collection with v3 API
      await this.client.collections.create({
        name: COLLECTION_NAME,
        description: 'Document chunks for RAG hybrid search',
        vectorizers: vectorizer.none(), // We provide our own vectors via Ollama
        properties: [
          {
            name: 'documentId',
            dataType: dataType.TEXT,
            description: 'ID of the parent document',
            indexFilterable: true,
            indexSearchable: true,
          },
          {
            name: 'content',
            dataType: dataType.TEXT,
            description: 'Text content of the chunk',
            indexFilterable: false,
            indexSearchable: true, // Enable BM25 search
          },
          {
            name: 'pageNumber',
            dataType: dataType.INT,
            description: 'Page number in the original document',
            indexFilterable: true,
            indexSearchable: false,
          },
          {
            name: 'chunkIndex',
            dataType: dataType.INT,
            description: 'Index of this chunk within the document',
            indexFilterable: true,
            indexSearchable: false,
          },
          {
            name: 'totalChunks',
            dataType: dataType.INT,
            description: 'Total number of chunks in the document',
            indexFilterable: false,
            indexSearchable: false,
          },
          {
            name: 'filename',
            dataType: dataType.TEXT,
            description: 'Original filename of the document',
            indexFilterable: true,
            indexSearchable: true,
          },
          {
            name: 'originalName',
            dataType: dataType.TEXT,
            description: 'Original upload name',
            indexFilterable: true,
            indexSearchable: true,
          },
          {
            name: 'pages',
            dataType: dataType.INT,
            description: 'Total pages in the document',
            indexFilterable: false,
            indexSearchable: false,
          },
        ],
      });

      console.log(`✅ Created collection: ${COLLECTION_NAME}`);
    } catch (error) {
      console.error('❌ Failed to ensure collection:', error);
      throw error;
    }
  }

  /**
   * Chunk document text into smaller pieces
   */
  private chunkDocument(text: string, chunkSize = 500, overlap = 50): string[] {
    const words = text.split(/\s+/);
    const chunks: string[] = [];

    for (let i = 0; i < words.length; i += chunkSize - overlap) {
      const chunk = words.slice(i, i + chunkSize).join(' ');
      if (chunk.trim()) {
        chunks.push(chunk.trim());
      }
    }

    return chunks;
  }

  /**
   * Store document chunks in Weaviate using v3 insertMany API
   * 60-80% faster than v2 batch API
   */
  async storeDocument(document: DocumentMetadata): Promise<void> {
    await this.initialize();

    if (!this.client) {
      throw new Error('Weaviate client not initialized');
    }

    if (!document.text) {
      throw new Error('Document has no text content to store');
    }

    try {
      // Chunk the document text
      const textChunks = this.chunkDocument(document.text);

      // Generate embeddings for all chunks
      const embeddings = await embeddingService.generateEmbeddings(textChunks, EMBEDDING_MODEL);

      // Prepare data for insertMany
      const collection = this.client.collections.get<DocumentChunkProperties>(COLLECTION_NAME);

      const objects = textChunks.map((content, i) => ({
        properties: {
          documentId: document.id,
          content,
          pageNumber: 1, // For now, we don't track exact page per chunk
          chunkIndex: i,
          totalChunks: textChunks.length,
          filename: document.filename,
          originalName: document.originalName,
          pages: document.pages,
        },
        vector: embeddings[i].embedding,
      }));

      // Insert all chunks in one batch (gRPC optimization)
      const result = await collection.data.insertMany(objects);

      const successCount = result.uuids.length;
      const failCount = result.errors ? Object.keys(result.errors).length : 0;

      if (failCount > 0) {
        console.warn(`⚠️  Stored ${successCount} chunks with ${failCount} errors for: ${document.originalName}`);
      } else {
        console.log(`✅ Stored ${successCount} chunks for: ${document.originalName}`);
      }
    } catch (error) {
      console.error('❌ Failed to store document in Weaviate:', error);
      throw error;
    }
  }

  /**
   * Hybrid search combining BM25 (keyword) and Vector (semantic) search
   * Uses Weaviate v3 query.hybrid API with proper alpha weighting
   *
   * @param request Search parameters
   * @param request.hybridAlpha - 0 = pure BM25, 1 = pure vector, 0.5 = balanced (default)
   */
  async search(request: VectorSearchRequest): Promise<VectorSearchResponse> {
    await this.initialize();

    if (!this.client) {
      throw new Error('Weaviate client not initialized');
    }

    const { query, limit = 5, threshold = 0.1, hybridAlpha = 0.5 } = request;

    try {
      const collection = this.client.collections.get<DocumentChunkProperties>(COLLECTION_NAME);

      // Generate query embedding for vector search
      const queryEmbedding = await embeddingService.generateEmbedding(query, EMBEDDING_MODEL);

      // Use hybrid search (BM25 + Vector)
      const result = await collection.query.hybrid(query, {
        limit,
        alpha: hybridAlpha, // 0 = BM25, 1 = Vector, 0.5 = balanced
        fusionType: 'relativeScoreFusion' as any, // Default from v1.24
        vector: queryEmbedding.embedding,
        returnMetadata: ['score'],
      });

      console.log(`🔍 Hybrid search: "${query}" (alpha: ${hybridAlpha}, results: ${result.objects.length})`);

      // Filter by threshold and map to SearchResult format
      const results: SearchResult[] = result.objects
        .filter((obj) => {
          const score = obj.metadata?.score || 0;
          return score >= threshold;
        })
        .map((obj) => ({
          chunk: {
            id: obj.uuid,
            documentId: obj.properties.documentId,
            content: obj.properties.content,
            pageNumber: obj.properties.pageNumber,
            chunkIndex: obj.properties.chunkIndex,
            totalChunks: obj.properties.totalChunks,
          },
          score: obj.metadata?.score || 0,
          document: {
            id: obj.properties.documentId,
            filename: obj.properties.filename,
            originalName: obj.properties.originalName,
            pages: obj.properties.pages,
          },
        }));

      return {
        results,
        totalResults: results.length,
        query,
      };
    } catch (error) {
      console.error('❌ Hybrid search failed:', error);
      throw error;
    }
  }

  /**
   * Delete all chunks for a document using v3 API
   */
  async deleteDocument(documentId: string): Promise<void> {
    await this.initialize();

    if (!this.client) {
      throw new Error('Weaviate client not initialized');
    }

    try {
      const collection = this.client.collections.get<DocumentChunkProperties>(COLLECTION_NAME);

      // Delete by filter
      const result = await collection.data.deleteMany(
        collection.filter.byProperty('documentId').equal(documentId)
      );

      console.log(`✅ Deleted ${result.successful} chunks for document: ${documentId}`);
    } catch (error) {
      console.error('❌ Failed to delete document from Weaviate:', error);
      throw error;
    }
  }

  /**
   * Health check for Weaviate
   */
  async healthCheck(): Promise<{ status: 'ok' | 'error'; error?: string }> {
    try {
      await this.initialize();

      if (!this.client) {
        return { status: 'error', error: 'Client not initialized' };
      }

      // Simple health check - check if we can get meta info
      const isReady = await this.client.isReady();

      if (!isReady) {
        return { status: 'error', error: 'Weaviate is not ready' };
      }

      return { status: 'ok' };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Close Weaviate connection
   * Should be called when shutting down the application
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.initialized = false;
      console.log('✅ Weaviate connection closed');
    }
  }
}

export const vectorService = new VectorService();
export default vectorService;
