/**
 * Graph Service - Orchestrating Service
 * Part of RAG V2 Phase 4: Intelligence & Production
 *
 * Provides a unified interface for all graph operations:
 * - Entity extraction
 * - Entity resolution
 * - Graph storage (Neo4j)
 * - Graph refinement for RAG
 */

import { Neo4jService } from './Neo4jService.js';
import { EntityExtractor } from './EntityExtractor.js';
import { EntityResolver, EmbeddingService } from './EntityResolver.js';
import { GraphRefinement, GraphRefinementConfig } from './GraphRefinement.js';
import {
  Entity,
  Relationship,
  ExtractionConfig,
  EntityResolutionConfig,
  ExtractionResult,
  RefinementRequest,
  RefinedResult,
  DEFAULT_EXTRACTION_CONFIG,
  DEFAULT_ENTITY_RESOLUTION_CONFIG,
} from '../../types/graph.js';
import { DatabaseService } from '../DatabaseService.js';

export interface GraphServiceConfig {
  enabled: boolean;
  neo4j: {
    uri: string;
    username: string;
    password: string;
    database?: string;
  };
  extraction: Partial<ExtractionConfig>;
  resolution: Partial<EntityResolutionConfig>;
  refinement: Partial<GraphRefinementConfig>;
}

export class GraphService {
  private neo4jService: Neo4jService | null = null;
  private entityExtractor: EntityExtractor;
  private entityResolver: EntityResolver;
  private graphRefinement: GraphRefinement | null = null;
  private initialized = false;

  constructor(
    private config: GraphServiceConfig,
    private db?: DatabaseService,
    embeddingService?: EmbeddingService
  ) {
    this.entityExtractor = new EntityExtractor({
      ...DEFAULT_EXTRACTION_CONFIG,
      ...config.extraction,
    });

    this.entityResolver = new EntityResolver(
      {
        ...DEFAULT_ENTITY_RESOLUTION_CONFIG,
        ...config.resolution,
      },
      embeddingService
    );
  }

  /**
   * Initialize the graph service (connect to Neo4j)
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      console.log('[GraphService] Disabled by configuration');
      return;
    }

    if (this.initialized) return;

    try {
      // Initialize Neo4j
      this.neo4jService = new Neo4jService({
        uri: this.config.neo4j.uri,
        username: this.config.neo4j.username,
        password: this.config.neo4j.password,
        database: this.config.neo4j.database || 'neo4j',
      });

      await this.neo4jService.initialize();

      // Initialize Graph Refinement
      this.graphRefinement = new GraphRefinement(this.neo4jService, this.config.refinement);

      this.initialized = true;
      console.log('[GraphService] Initialized successfully');
    } catch (error) {
      console.error('[GraphService] Initialization failed:', error);
      // Don't throw - allow app to continue without graph features
      this.config.enabled = false;
    }
  }

  /**
   * Check if the service is ready
   */
  isReady(): boolean {
    return this.config.enabled && this.initialized && this.neo4jService !== null;
  }

  /**
   * Process a document: extract entities, resolve, and store
   */
  async processDocument(
    documentId: string,
    chunks: Array<{ id?: string; content: string }>
  ): Promise<{
    entities: Entity[];
    relationships: Relationship[];
    stats: ExtractionResult['stats'];
  }> {
    if (!this.isReady()) {
      return { entities: [], relationships: [], stats: { entitiesExtracted: 0, relationshipsExtracted: 0, processingTimeMs: 0, methodUsed: 'pattern' } };
    }

    const startTime = Date.now();

    // 1. Extract entities
    const extractionResult = await this.entityExtractor.extract(documentId, chunks);

    // 2. Resolve (merge similar) entities
    const { resolved: resolvedEntities, mergeStats } = await this.entityResolver.resolve(
      extractionResult.entities
    );

    console.log(
      `[GraphService] Document ${documentId}: Extracted ${extractionResult.entities.length} entities, merged to ${resolvedEntities.length}`
    );

    // 3. Store in Neo4j
    if (this.neo4jService) {
      await this.neo4jService.storeEntities(resolvedEntities);
      await this.neo4jService.storeRelationships(extractionResult.relationships);
    }

    // 4. Store in PostgreSQL for persistence
    if (this.db) {
      await this.persistToPostgres(resolvedEntities, extractionResult.relationships);
    }

    return {
      entities: resolvedEntities,
      relationships: extractionResult.relationships,
      stats: {
        ...extractionResult.stats,
        processingTimeMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Refine RAG results using graph traversal
   */
  async refineRAGResults(request: RefinementRequest): Promise<RefinedResult> {
    if (!this.isReady() || !this.graphRefinement) {
      return {
        additionalChunkIds: [],
        graphContext: { nodes: [], edges: [], chunkIds: [], naturalLanguageSummary: '' },
        shouldUseGraph: false,
      };
    }

    return this.graphRefinement.refine(request);
  }

  /**
   * Build context string from refinement result
   */
  buildGraphContext(result: RefinedResult): string {
    if (!this.graphRefinement || !result.shouldUseGraph) {
      return '';
    }
    return this.graphRefinement.buildGraphContext(result.graphContext);
  }

  /**
   * Find entities by text
   */
  async findEntities(texts: string[]): Promise<Entity[]> {
    if (!this.isReady() || !this.neo4jService) {
      return [];
    }
    return this.neo4jService.findEntitiesByText(texts);
  }

  /**
   * Get entities for a document
   */
  async getDocumentEntities(documentId: string): Promise<Entity[]> {
    if (!this.isReady() || !this.neo4jService) {
      return [];
    }
    return this.neo4jService.findEntitiesByDocument(documentId);
  }

  /**
   * Delete entities when a document is deleted
   */
  async deleteDocumentEntities(documentId: string): Promise<number> {
    if (!this.isReady() || !this.neo4jService) {
      return 0;
    }

    const deleted = await this.neo4jService.deleteDocumentEntities(documentId);

    // Also delete from PostgreSQL
    if (this.db) {
      await this.db.query(
        `DELETE FROM entity_occurrences WHERE document_id = $1`,
        [documentId]
      );
    }

    return deleted;
  }

  /**
   * Get graph statistics
   */
  async getStats(): Promise<{
    entityCount: number;
    relationshipCount: number;
    documentCount: number;
    chunkCount: number;
    entityTypes: Record<string, number>;
  } | null> {
    if (!this.isReady() || !this.neo4jService) {
      return null;
    }
    return this.neo4jService.getStats();
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    enabled: boolean;
    initialized: boolean;
    neo4j: { healthy: boolean; version: string; address: string } | null;
  }> {
    return {
      enabled: this.config.enabled,
      initialized: this.initialized,
      neo4j: this.neo4jService ? await this.neo4jService.healthCheck() : null,
    };
  }

  /**
   * Persist entities and relationships to PostgreSQL
   */
  private async persistToPostgres(
    entities: Entity[],
    relationships: Relationship[]
  ): Promise<void> {
    if (!this.db) return;

    // Store entities
    for (const entity of entities) {
      await this.db.query(
        `INSERT INTO entities (id, type, text, canonical_form, aliases, confidence, metadata, neo4j_synced)
         VALUES ($1, $2, $3, $4, $5, $6, $7, true)
         ON CONFLICT (id) DO UPDATE SET
           text = EXCLUDED.text,
           canonical_form = EXCLUDED.canonical_form,
           aliases = EXCLUDED.aliases,
           confidence = EXCLUDED.confidence,
           metadata = EXCLUDED.metadata,
           neo4j_synced = true,
           updated_at = NOW()`,
        [
          entity.id,
          entity.type,
          entity.text,
          entity.canonicalForm,
          entity.aliases,
          entity.confidence,
          JSON.stringify(entity.metadata),
        ]
      );

      // Store occurrences
      for (const occ of entity.occurrences) {
        await this.db.query(
          `INSERT INTO entity_occurrences (entity_id, document_id, chunk_id, position, context)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT DO NOTHING`,
          [entity.id, occ.documentId, occ.chunkId, occ.position, occ.context]
        );
      }
    }

    // Store relationships
    for (const rel of relationships) {
      await this.db.query(
        `INSERT INTO entity_relationships (id, source_entity_id, target_entity_id, type, confidence, evidence, document_id, extraction_method, neo4j_synced)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
         ON CONFLICT (id) DO UPDATE SET
           confidence = EXCLUDED.confidence,
           evidence = EXCLUDED.evidence,
           neo4j_synced = true`,
        [
          rel.id,
          rel.sourceEntityId,
          rel.targetEntityId,
          rel.type,
          rel.confidence,
          rel.evidence,
          rel.documentId,
          rel.extractionMethod,
        ]
      );
    }
  }

  /**
   * Close connections
   */
  async close(): Promise<void> {
    if (this.neo4jService) {
      await this.neo4jService.close();
      this.neo4jService = null;
    }
    this.initialized = false;
  }
}

/**
 * Create GraphService from environment variables
 */
export function createGraphServiceFromEnv(
  db?: DatabaseService,
  embeddingService?: EmbeddingService
): GraphService {
  const config: GraphServiceConfig = {
    enabled: process.env.GRAPH_ENABLED === 'true',
    neo4j: {
      uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
      username: process.env.NEO4J_USERNAME || 'neo4j',
      password: process.env.NEO4J_PASSWORD || 'changeme',
      database: process.env.NEO4J_DATABASE || 'neo4j',
    },
    extraction: {
      useLLM: process.env.GRAPH_LLM_EXTRACTION === 'true',
      llmModel: process.env.OLLAMA_DEFAULT_MODEL || 'qwen2.5:14b',
    },
    resolution: {
      useSemanticSimilarity: !!embeddingService,
    },
    refinement: {
      enabled: process.env.GRAPH_ENABLED === 'true',
    },
  };

  return new GraphService(config, db, embeddingService);
}
