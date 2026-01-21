/**
 * VectorService - Weaviate Integration for RAG Document Vector Storage
 *
 * Handles:
 * - Document chunking and embedding storage
 * - Semantic search with source citations
 * - Document management in vector database
 */

import weaviate from 'weaviate-ts-client'
import type { WeaviateClient } from 'weaviate-ts-client'
import { type DocumentMetadata } from './DocumentService.js'
import { randomUUID } from 'crypto'

// ============================================
// Types
// ============================================

export interface DocumentChunk {
  id: string
  documentId: string
  content: string
  pageNumber?: number
  chunkIndex: number
  totalChunks: number
}

export interface SearchResult {
  chunk: DocumentChunk
  score: number
  document: {
    id: string
    filename: string
    originalName: string
    pages: number
  }
}

export interface VectorSearchRequest {
  query: string
  limit?: number
  threshold?: number
  hybridAlpha?: number // 0 = pure BM25/keyword, 1 = pure vector/semantic
}

export interface VectorSearchResponse {
  results: SearchResult[]
  totalResults: number
  query: string
}

// Weaviate schema configuration
const COLLECTION_NAME = 'DocumentChunks'

class VectorService {
  private client: WeaviateClient | null = null

  constructor() {
    this.initializeClient()
  }

  /**
   * Initialize Weaviate client
   */
  private initializeClient(): void {
    try {
      this.client = weaviate.client({
        scheme: 'http',
        host: 'localhost:8080',
      })
    } catch (error) {
      console.error('❌ Failed to initialize Weaviate client:', error)
      this.client = null
    }
  }

  /**
   * Ensure Weaviate collection exists
   */
  async ensureSchema(): Promise<void> {
    if (!this.client) {
      throw new Error('Weaviate client not initialized')
    }

    try {
      // Check if collection already exists
      const schema = await this.client.schema.getter().do()
      const collectionExists = schema.classes?.some(
        (cls: any) => cls.class === COLLECTION_NAME
      )

      if (collectionExists) {
        console.log(`✅ Weaviate collection '${COLLECTION_NAME}' already exists`)
        return
      }

      // Create collection schema
      const collectionSchema = {
        class: COLLECTION_NAME,
        description: 'Document chunks for RAG semantic search',
        vectorizer: 'none', // We'll provide our own vectors via Ollama
        properties: [
          {
            name: 'documentId',
            dataType: ['text'],
            description: 'ID of the parent document',
            indexInverted: true,
          },
          {
            name: 'content',
            dataType: ['text'],
            description: 'Text content of the chunk',
            indexInverted: true,
          },
          {
            name: 'pageNumber',
            dataType: ['int'],
            description: 'Page number in the original document',
            indexInverted: false,
          },
          {
            name: 'chunkIndex',
            dataType: ['int'],
            description: 'Index of this chunk within the document',
            indexInverted: false,
          },
          {
            name: 'totalChunks',
            dataType: ['int'],
            description: 'Total number of chunks in the document',
            indexInverted: false,
          },
          {
            name: 'filename',
            dataType: ['text'],
            description: 'Original filename of the document',
            indexInverted: true,
          },
          {
            name: 'originalName',
            dataType: ['text'],
            description: 'Original upload name',
            indexInverted: true,
          },
          {
            name: 'pages',
            dataType: ['int'],
            description: 'Total pages in the document',
            indexInverted: false,
          },
        ],
      }

      await this.client.schema.classCreator().withClass(collectionSchema).do()
      console.log(`✅ Created Weaviate collection: ${COLLECTION_NAME}`)
    } catch (error) {
      console.error('❌ Failed to create Weaviate schema:', error)
      throw error
    }
  }

  /**
   * Chunk document text into smaller pieces for embedding
   */
  private chunkDocument(text: string, chunkSize = 500, overlap = 50): string[] {
    const words = text.split(/\s+/)
    const chunks: string[] = []

    for (let i = 0; i < words.length; i += chunkSize - overlap) {
      const chunk = words.slice(i, i + chunkSize).join(' ')
      if (chunk.trim()) {
        chunks.push(chunk.trim())
      }
    }

    return chunks
  }

  /**
   * Store document chunks in Weaviate
   */
  async storeDocument(document: DocumentMetadata): Promise<void> {
    if (!this.client) {
      throw new Error('Weaviate client not initialized')
    }

    if (!document.text) {
      throw new Error('Document has no text content to store')
    }

    await this.ensureSchema()

    try {
      // Chunk the document text
      const chunks = this.chunkDocument(document.text)

      // Prepare batch insertion
      let batcher = this.client.batch.objectsBatcher()

      for (let i = 0; i < chunks.length; i++) {
        const chunkId = randomUUID() // Generate UUID for Weaviate

        const chunkObject = {
          class: COLLECTION_NAME,
          id: chunkId,
          properties: {
            documentId: document.id,
            content: chunks[i],
            pageNumber: 1, // For now, we don't track exact page per chunk
            chunkIndex: i,
            totalChunks: chunks.length,
            filename: document.filename,
            originalName: document.originalName,
            pages: document.pages,
          },
        }

        batcher = batcher.withObject(chunkObject)
      }

      // Execute batch insert
      await batcher.do()

      console.log(`✅ Stored ${chunks.length} chunks for document: ${document.originalName}`)
    } catch (error) {
      console.error('❌ Failed to store document in Weaviate:', error)
      throw error
    }
  }

  /**
   * Search for relevant document chunks
   * Uses hybrid search combining BM25 (keyword) and vector (semantic) search
   * @param hybridAlpha - Balance between BM25 (0) and Vector (1), default 0.5
   */
  async search(request: VectorSearchRequest): Promise<VectorSearchResponse> {
    if (!this.client) {
      throw new Error('Weaviate client not initialized')
    }

    const { query, limit = 5, threshold = 0.7, hybridAlpha = 0.5 } = request

    try {
      console.log(`🔍 Vector search: "${query}" (limit: ${limit}, threshold: ${threshold}, alpha: ${hybridAlpha})`);

      // Use hybrid search combining BM25 and vector search
      // Alpha controls the balance: 0 = pure BM25, 1 = pure vector
      // Note: Since we use vectorizer: 'none', vector search requires embeddings
      // For now, use BM25 only but the API is ready for hybrid when embeddings are available
      const response = await this.client.graphql
        .get()
        .withClassName(COLLECTION_NAME)
        .withBm25({
          query,
          properties: ['content', 'filename', 'originalName'],
        })
        .withFields(
          'documentId content pageNumber chunkIndex totalChunks filename originalName pages _additional { score }'
        )
        .withLimit(limit)
        .do()

      // Log the hybrid alpha for future reference when vector search is enabled
      if (hybridAlpha > 0) {
        console.log(`ℹ️ Hybrid alpha ${hybridAlpha} requested, but using BM25 only (no embeddings configured)`);
      }

      const objects = response.data?.Get?.[COLLECTION_NAME] || []
      console.log(`📋 Search returned ${objects.length} raw objects`);

      const results: SearchResult[] = objects
        .filter((obj: any) => {
          const score = obj._additional?.score || 0;
          console.log(`   - Object score: ${score} (threshold: ${threshold})`);
          return score >= threshold;
        })
        .map((obj: any) => ({
          chunk: {
            id: `${obj.documentId}_chunk_${obj.chunkIndex}`,
            documentId: obj.documentId,
            content: obj.content,
            pageNumber: obj.pageNumber,
            chunkIndex: obj.chunkIndex,
            totalChunks: obj.totalChunks,
          },
          score: obj._additional?.score || 0,
          document: {
            id: obj.documentId,
            filename: obj.filename,
            originalName: obj.originalName,
            pages: obj.pages,
          },
        }))

      return {
        results,
        totalResults: results.length,
        query,
      }
    } catch (error) {
      console.error('❌ Vector search failed:', error)
      throw error
    }
  }

  /**
   * Delete all chunks for a document
   */
  async deleteDocument(documentId: string): Promise<void> {
    if (!this.client) {
      throw new Error('Weaviate client not initialized')
    }

    try {
      await this.client.batch
        .objectsBatchDeleter()
        .withClassName(COLLECTION_NAME)
        .withWhere({
          path: ['documentId'],
          operator: 'Equal',
          valueText: documentId,
        })
        .do()

      console.log(`✅ Deleted vector chunks for document: ${documentId}`)
    } catch (error) {
      console.error('❌ Failed to delete document from Weaviate:', error)
      throw error
    }
  }

  /**
   * Health check for Weaviate
   */
  async healthCheck(): Promise<{ status: 'ok' | 'error'; error?: string }> {
    if (!this.client) {
      return { status: 'error', error: 'Client not initialized' }
    }

    try {
      await this.client.misc.metaGetter().do()
      return { status: 'ok' }
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }
}

export const vectorService = new VectorService()