/**
 * VectorServiceV2 - Weaviate V2 Collection with Hierarchical Schema
 * RAG V2 Phase 2
 *
 * New schema supports:
 * - Hierarchical chunks (level, parentChunkId, path)
 * - Chunking metadata (chunkingMethod, pageStart, pageEnd, tokenCount)
 * - Backward compatible with V1 queries
 */

import weaviate, { WeaviateClient, vectorizer, dataType, Filters } from 'weaviate-client';
import { type DocumentMetadata } from './DocumentService.js';
import { embeddingService } from './EmbeddingService.js';
import { randomUUID } from 'crypto';
import { env } from '../config/env.js';
import type { Chunk, ChunkLevel } from '../types/chunking.js';

// ============================================
// Types
// ============================================

/**
 * V2 Document Chunk with hierarchical metadata
 */
export interface DocumentChunkV2 {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  totalChunks: number;
  // Hierarchical fields (NEW)
  level: ChunkLevel;
  parentChunkId: string | null;
  path: string;
  // Chunking metadata (NEW)
  chunkingMethod: string;
  pageStart: number;
  pageEnd: number;
  tokenCount: number;
  // Document metadata
  filename: string;
  originalName: string;
  pageCount: number;
}

export interface SearchResultV2 {
  chunk: DocumentChunkV2;
  score: number;
  document: {
    id: string;
    filename: string;
    originalName: string;
    pages: number;
  };
}

export interface VectorSearchRequestV2 {
  query: string;
  limit?: number;
  threshold?: number;
  hybridAlpha?: number;
  allowedDocumentIds?: string[];
  // V2 specific options
  levelFilter?: ChunkLevel[];
  includeParentContext?: boolean;
}

export interface VectorSearchResponseV2 {
  results: SearchResultV2[];
  totalResults: number;
  query: string;
  version: 'v2';
}

// TypeScript Generic for Collection Schema
interface DocumentChunkV2Properties {
  documentId: string;
  content: string;
  chunkIndex: number;
  totalChunks: number;
  level: number;
  parentChunkId: string;
  path: string;
  chunkingMethod: string;
  pageStart: number;
  pageEnd: number;
  tokenCount: number;
  filename: string;
  originalName: string;
  pageCount: number;
}

// Collection name constant
const COLLECTION_NAME_V2 = 'DocumentChunksV2';
const EMBEDDING_MODEL = 'nomic-embed-text-v2-moe';

// ============================================
// VectorServiceV2 Class
// ============================================

class VectorServiceV2 {
  private client: WeaviateClient | null = null;
  private initialized: boolean = false;
  private embeddingDimensions: number = 768;

  /**
   * Initialize Weaviate client with V2 collection
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

      console.log('✅ Weaviate V2 client initialized');

      // Ensure V2 collection exists
      await this.ensureCollectionV2();

      // Get embedding dimensions
      const isAvailable = await embeddingService.isModelAvailable(EMBEDDING_MODEL);
      if (isAvailable) {
        this.embeddingDimensions = await embeddingService.getModelDimensions(EMBEDDING_MODEL);
        console.log(`✅ Embedding model: ${EMBEDDING_MODEL} (${this.embeddingDimensions} dimensions)`);
      }

      this.initialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize VectorServiceV2:', error);
      this.client = null;
      this.initialized = false;
      throw error;
    }
  }

  /**
   * Ensure V2 collection exists with new schema
   */
  private async ensureCollectionV2(): Promise<void> {
    if (!this.client) {
      throw new Error('Weaviate client not initialized');
    }

    try {
      const exists = await this.client.collections.exists(COLLECTION_NAME_V2);

      if (exists) {
        console.log(`✅ Collection '${COLLECTION_NAME_V2}' already exists`);
        return;
      }

      // Create V2 collection with hierarchical schema
      await this.client.collections.create({
        name: COLLECTION_NAME_V2,
        description: 'Document chunks V2 with hierarchical indexing for RAG',
        vectorizers: vectorizer.none(),
        properties: [
          // Document reference
          {
            name: 'documentId',
            dataType: dataType.TEXT,
            description: 'ID of the parent document',
            indexFilterable: true,
            indexSearchable: true,
          },
          // Content
          {
            name: 'content',
            dataType: dataType.TEXT,
            description: 'Text content of the chunk',
            indexFilterable: false,
            indexSearchable: true, // BM25
          },
          // Chunk positioning
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
          // Hierarchical fields (NEW)
          {
            name: 'level',
            dataType: dataType.INT,
            description: 'Hierarchy level: 0=doc, 1=section, 2=paragraph',
            indexFilterable: true,
            indexSearchable: false,
          },
          {
            name: 'parentChunkId',
            dataType: dataType.TEXT,
            description: 'ID of the parent chunk',
            indexFilterable: true,
            indexSearchable: false,
          },
          {
            name: 'path',
            dataType: dataType.TEXT,
            description: 'Path in hierarchy (e.g., doc/section-2/para-3)',
            indexFilterable: true,
            indexSearchable: true,
          },
          // Chunking metadata (NEW)
          {
            name: 'chunkingMethod',
            dataType: dataType.TEXT,
            description: 'Method used: semantic, table, fixed, hybrid',
            indexFilterable: true,
            indexSearchable: false,
          },
          {
            name: 'pageStart',
            dataType: dataType.INT,
            description: 'Start page number',
            indexFilterable: true,
            indexSearchable: false,
          },
          {
            name: 'pageEnd',
            dataType: dataType.INT,
            description: 'End page number',
            indexFilterable: true,
            indexSearchable: false,
          },
          {
            name: 'tokenCount',
            dataType: dataType.INT,
            description: 'Estimated token count',
            indexFilterable: false,
            indexSearchable: false,
          },
          // Document metadata
          {
            name: 'filename',
            dataType: dataType.TEXT,
            description: 'Document filename',
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
            name: 'pageCount',
            dataType: dataType.INT,
            description: 'Total pages in document',
            indexFilterable: false,
            indexSearchable: false,
          },
        ],
      });

      console.log(`✅ Created V2 collection: ${COLLECTION_NAME_V2}`);
    } catch (error) {
      console.error('❌ Failed to ensure V2 collection:', error);
      throw error;
    }
  }

  /**
   * Store chunks in V2 collection
   */
  async storeChunks(
    chunks: Chunk[],
    documentMetadata: {
      documentId: string; // Required: The PostgreSQL document ID
      filename: string;
      originalName: string;
      pageCount: number;
    }
  ): Promise<void> {
    await this.initialize();

    if (!this.client) {
      throw new Error('Weaviate client not initialized');
    }

    if (chunks.length === 0) {
      console.log('⚠️  No chunks to store');
      return;
    }

    try {
      const collection = this.client.collections.get<DocumentChunkV2Properties>(COLLECTION_NAME_V2);

      // Generate embeddings for all chunks
      const texts = chunks.map((c) => c.content);
      console.log(`📊 Generating embeddings for ${texts.length} V2 chunks...`);
      const embeddings = await embeddingService.generateEmbeddings(texts, EMBEDDING_MODEL);

      // Prepare objects for batch insert
      // IMPORTANT: Use documentMetadata.documentId (from PostgreSQL) instead of chunk.documentId (from parser)
      // This ensures consistency between PostgreSQL and Weaviate for permission filtering
      const objects = chunks.map((chunk, i) => ({
        properties: {
          documentId: documentMetadata.documentId,
          content: chunk.content,
          chunkIndex: chunk.chunkIndex,
          totalChunks: chunk.totalChunks,
          level: chunk.level,
          parentChunkId: chunk.parentChunkId || '',
          path: chunk.path,
          chunkingMethod: chunk.chunkingMethod,
          pageStart: chunk.pageStart,
          pageEnd: chunk.pageEnd,
          tokenCount: chunk.tokenCount,
          filename: documentMetadata.filename,
          originalName: documentMetadata.originalName,
          pageCount: documentMetadata.pageCount,
        },
        vector: embeddings[i].embedding,
      }));

      // Insert all chunks in batch
      const result = await collection.data.insertMany(objects);

      const successCount = result.uuids.length;
      const failCount = result.errors ? Object.keys(result.errors).length : 0;

      if (failCount > 0) {
        console.warn(`⚠️  Stored ${successCount} V2 chunks with ${failCount} errors`);
      } else {
        console.log(`✅ Stored ${successCount} V2 chunks for: ${documentMetadata.originalName}`);
      }
    } catch (error) {
      console.error('❌ Failed to store V2 chunks:', error);
      throw error;
    }
  }

  /**
   * Hybrid search in V2 collection
   */
  async search(request: VectorSearchRequestV2): Promise<VectorSearchResponseV2> {
    await this.initialize();

    if (!this.client) {
      throw new Error('Weaviate client not initialized');
    }

    const {
      query,
      limit = 10,
      threshold = 0.1,
      hybridAlpha = 0.3, // 0.3 optimized for German texts (70% keyword, 30% semantic)
      allowedDocumentIds,
      levelFilter,
      includeParentContext = false,
    } = request;

    try {
      const collection = this.client.collections.get<DocumentChunkV2Properties>(COLLECTION_NAME_V2);

      // Generate query embedding
      const queryEmbedding = await embeddingService.generateEmbedding(query, EMBEDDING_MODEL);

      // Build query options
      const queryOptions: any = {
        limit: includeParentContext ? limit * 2 : limit,
        alpha: hybridAlpha,
        fusionType: 'relativeScoreFusion',
        vector: queryEmbedding.embedding,
        returnMetadata: ['score'],
      };

      // Build filters
      const filters: any[] = [];

      // Permission filter
      if (allowedDocumentIds && allowedDocumentIds.length > 0) {
        filters.push(collection.filter.byProperty('documentId').containsAny(allowedDocumentIds));
      }

      // Level filter (e.g., only search paragraph-level chunks)
      if (levelFilter && levelFilter.length > 0) {
        filters.push(collection.filter.byProperty('level').containsAny(levelFilter));
      }

      // Combine filters
      if (filters.length === 1) {
        queryOptions.where = filters[0];
      } else if (filters.length > 1) {
        queryOptions.where = Filters.and(...filters);
      }

      // Execute search
      const result = await collection.query.hybrid(query, queryOptions);

      console.log(`🔍 V2 Hybrid search: "${query}" (alpha: ${hybridAlpha}, results: ${result.objects.length})`);

      // DEBUG: Log all scores before filtering
      const allScores = result.objects.map((obj) => ({
        score: obj.metadata?.score || 0,
        content: obj.properties.content.substring(0, 50) + '...',
      }));
      console.log(`🔍 V2 Scores before filter (threshold=${threshold}):`, allScores.map(s => s.score.toFixed(3)).join(', '));

      // Map results
      let results: SearchResultV2[] = result.objects
        .filter((obj) => {
          const score = obj.metadata?.score || 0;
          return score >= threshold;
        })
        .map((obj) => ({
          chunk: {
            id: obj.uuid,
            documentId: obj.properties.documentId,
            content: obj.properties.content,
            chunkIndex: obj.properties.chunkIndex,
            totalChunks: obj.properties.totalChunks,
            level: obj.properties.level as ChunkLevel,
            parentChunkId: obj.properties.parentChunkId || null,
            path: obj.properties.path,
            chunkingMethod: obj.properties.chunkingMethod,
            pageStart: obj.properties.pageStart,
            pageEnd: obj.properties.pageEnd,
            tokenCount: obj.properties.tokenCount,
            filename: obj.properties.filename,
            originalName: obj.properties.originalName,
            pageCount: obj.properties.pageCount,
          },
          score: obj.metadata?.score || 0,
          document: {
            id: obj.properties.documentId,
            filename: obj.properties.filename,
            originalName: obj.properties.originalName,
            pages: obj.properties.pageCount,
          },
        }));

      // If includeParentContext, fetch parent chunks
      if (includeParentContext && results.length > 0) {
        results = await this.enrichWithParentContext(results, collection);
      }

      // Limit results
      results = results.slice(0, limit);

      return {
        results,
        totalResults: results.length,
        query,
        version: 'v2',
      };
    } catch (error) {
      console.error('❌ V2 search failed:', error);
      throw error;
    }
  }

  /**
   * Enrich results with parent chunk context
   * FIX: Derive parent paths from child paths instead of using parentChunkId
   * (parentChunkId contains internal IDs that aren't stored as searchable properties)
   */
  private async enrichWithParentContext(
    results: SearchResultV2[],
    collection: any
  ): Promise<SearchResultV2[]> {
    // Derive parent paths from child paths
    // e.g., "doc/section-1/chunk-0" -> "doc/section-1"
    const parentPaths = new Set<string>();

    for (const result of results) {
      if (result.chunk.level === 2 && result.chunk.path) {
        // Level 2 chunks have parents at level 1
        const pathParts = result.chunk.path.split('/');
        if (pathParts.length >= 2) {
          // Remove the last segment (chunk-N) to get parent path
          const parentPath = pathParts.slice(0, -1).join('/');
          if (parentPath && parentPath !== 'doc') {
            parentPaths.add(parentPath);
          }
        }
      }
    }

    if (parentPaths.size === 0) {
      return results;
    }

    // Fetch parent chunks by their paths
    try {
      const parentResults = await collection.query.fetchObjects({
        filters: Filters.or(
          ...[...parentPaths].map(path =>
            collection.filter.byProperty('path').equal(path)
          )
        ),
        limit: parentPaths.size,
      });

      // Create a map of parent path -> content
      const parentMap = new Map<string, string>();
      for (const parent of parentResults.objects) {
        parentMap.set(parent.properties.path, parent.properties.content);
      }

      console.log(`📎 Parent context: Found ${parentMap.size} of ${parentPaths.size} parent chunks`);

      // Enrich results with parent context
      return results.map((result) => {
        if (result.chunk.level === 2 && result.chunk.path) {
          const pathParts = result.chunk.path.split('/');
          const parentPath = pathParts.slice(0, -1).join('/');
          const parentContent = parentMap.get(parentPath);

          if (parentContent) {
            return {
              ...result,
              chunk: {
                ...result.chunk,
                content: `[Section Context: ${parentContent.substring(0, 200)}...]\n\n${result.chunk.content}`,
              },
            };
          }
        }
        return result;
      });
    } catch (error) {
      console.warn('⚠️ Failed to fetch parent context:', error);
      return results;
    }
  }

  /**
   * Delete all chunks for a document
   */
  async deleteDocument(documentId: string): Promise<void> {
    await this.initialize();

    if (!this.client) {
      throw new Error('Weaviate client not initialized');
    }

    try {
      const collection = this.client.collections.get<DocumentChunkV2Properties>(COLLECTION_NAME_V2);

      const result = await collection.data.deleteMany(
        collection.filter.byProperty('documentId').equal(documentId)
      );

      console.log(`✅ Deleted ${result.successful} V2 chunks for document: ${documentId}`);
    } catch (error) {
      console.error('❌ Failed to delete V2 document:', error);
      throw error;
    }
  }

  /**
   * Get chunk count for a document
   */
  async getDocumentChunkCount(documentId: string): Promise<number> {
    await this.initialize();

    if (!this.client) {
      throw new Error('Weaviate client not initialized');
    }

    try {
      const collection = this.client.collections.get<DocumentChunkV2Properties>(COLLECTION_NAME_V2);

      const result = await collection.aggregate.overAll({
        filters: collection.filter.byProperty('documentId').equal(documentId),
      });

      return (result as any).totalCount || 0;
    } catch (error) {
      console.error('❌ Failed to get chunk count:', error);
      return 0;
    }
  }

  /**
   * Document Expansion: Get all chunks for given document IDs
   * This is crucial for ensuring complete document context is available to the LLM
   */
  async getChunksByDocumentIds(
    documentIds: string[],
    options?: {
      maxChunksPerDocument?: number;
      levelFilter?: number[];
    }
  ): Promise<SearchResultV2[]> {
    await this.initialize();

    if (!this.client) {
      throw new Error('Weaviate client not initialized');
    }

    if (documentIds.length === 0) {
      return [];
    }

    const maxChunksPerDocument = options?.maxChunksPerDocument || 50;

    try {
      const collection = this.client.collections.get<DocumentChunkV2Properties>(COLLECTION_NAME_V2);

      // Build filter for document IDs
      const filters: any[] = [
        collection.filter.byProperty('documentId').containsAny(documentIds)
      ];

      // Optional level filter
      if (options?.levelFilter && options.levelFilter.length > 0) {
        filters.push(collection.filter.byProperty('level').containsAny(options.levelFilter));
      }

      // Combine filters
      const combinedFilter = filters.length === 1
        ? filters[0]
        : Filters.and(...filters);

      // Fetch all chunks for these documents
      const result = await collection.query.fetchObjects({
        filters: combinedFilter,
        limit: documentIds.length * maxChunksPerDocument,
      });

      // Map to SearchResultV2 format
      const results: SearchResultV2[] = result.objects.map((obj) => ({
        chunk: {
          id: obj.uuid,
          documentId: obj.properties.documentId,
          content: obj.properties.content,
          chunkIndex: obj.properties.chunkIndex,
          totalChunks: obj.properties.totalChunks,
          level: obj.properties.level as ChunkLevel,
          parentChunkId: obj.properties.parentChunkId || null,
          path: obj.properties.path,
          chunkingMethod: obj.properties.chunkingMethod,
          pageStart: obj.properties.pageStart,
          pageEnd: obj.properties.pageEnd,
          tokenCount: obj.properties.tokenCount,
          filename: obj.properties.filename,
          originalName: obj.properties.originalName,
          pageCount: obj.properties.pageCount,
        },
        score: 1.0, // Expansion chunks don't have a search score
        document: {
          id: obj.properties.documentId,
          filename: obj.properties.filename,
          originalName: obj.properties.originalName,
          pages: obj.properties.pageCount,
        },
      }));

      // Sort by documentId, then by chunkIndex for proper ordering
      results.sort((a, b) => {
        if (a.chunk.documentId !== b.chunk.documentId) {
          return a.chunk.documentId.localeCompare(b.chunk.documentId);
        }
        return a.chunk.chunkIndex - b.chunk.chunkIndex;
      });

      console.log(`📄 Document Expansion: Loaded ${results.length} chunks for ${documentIds.length} document(s)`);

      return results;
    } catch (error) {
      console.error('❌ Failed to get chunks by document IDs:', error);
      throw error;
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: 'ok' | 'error'; error?: string }> {
    try {
      await this.initialize();

      if (!this.client) {
        return { status: 'error', error: 'Client not initialized' };
      }

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
   * Close connection
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.initialized = false;
      console.log('✅ VectorServiceV2 connection closed');
    }
  }

  /**
   * Check if V2 collection exists
   */
  async collectionExists(): Promise<boolean> {
    await this.initialize();

    if (!this.client) {
      return false;
    }

    return this.client.collections.exists(COLLECTION_NAME_V2);
  }

  /**
   * Get collection statistics
   */
  async getStats(): Promise<{
    totalChunks: number;
    chunksByLevel: Record<number, number>;
    chunksByMethod: Record<string, number>;
  } | null> {
    await this.initialize();

    if (!this.client) {
      return null;
    }

    try {
      const collection = this.client.collections.get<DocumentChunkV2Properties>(COLLECTION_NAME_V2);

      // Get total count
      const totalResult = await collection.aggregate.overAll();
      const totalChunks = (totalResult as any).totalCount || 0;

      // Note: Detailed aggregation by property would require multiple queries
      // For now, return basic stats
      return {
        totalChunks,
        chunksByLevel: {},
        chunksByMethod: {},
      };
    } catch (error) {
      console.error('Failed to get V2 stats:', error);
      return null;
    }
  }
}

export const vectorServiceV2 = new VectorServiceV2();
export default vectorServiceV2;
