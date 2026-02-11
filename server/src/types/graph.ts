/**
 * Graph Types for Knowledge Graph RAG
 * Part of RAG V2 Phase 4: Intelligence & Production
 *
 * Neo4j 5.26 LTS + neo4j-driver 6.x
 */

// ============================================
// Entity Types
// ============================================

export type EntityType =
  | 'PERSON'
  | 'ORGANIZATION'
  | 'PROJECT'
  | 'PRODUCT'
  | 'DOCUMENT'
  | 'TOPIC'
  | 'LOCATION'
  | 'DATE'
  | 'REGULATION';

export type RelationType =
  | 'WORKS_FOR'
  | 'MANAGES'
  | 'CREATED'
  | 'MENTIONS'
  | 'REFERENCES'
  | 'ABOUT'
  | 'PART_OF'
  | 'REPORTS_TO'
  | 'COLLABORATES_WITH'
  | 'APPROVED_BY';

// ============================================
// Entity & Occurrence
// ============================================

export interface Entity {
  id: string;
  type: EntityType;
  text: string;
  canonicalForm: string;
  aliases: string[];
  confidence: number;
  occurrences: EntityOccurrence[];
  metadata: Record<string, unknown>;
}

export interface EntityOccurrence {
  documentId: string;
  chunkId: string;
  position: number;
  context: string;
}

// ============================================
// Relationships
// ============================================

export interface Relationship {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: RelationType;
  confidence: number;
  evidence: string;
  documentId: string;
  extractionMethod: 'pattern' | 'spacy' | 'llm';
}

// ============================================
// Graph Nodes & Edges
// ============================================

export interface GraphNode {
  id: string;
  labels: string[];
  properties: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  type: string;
  sourceId: string;
  targetId: string;
  properties: Record<string, unknown>;
}

// ============================================
// Graph Traversal
// ============================================

export type TraversalStrategy = 'neighborhood' | 'shortest_path' | 'community';

export interface GraphTraversalRequest {
  startEntities: string[];
  strategy: TraversalStrategy;
  maxDepth: number;
  maxNodes: number;
  relationshipTypes?: RelationType[];
}

export interface GraphTraversalResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  chunkIds: string[];
  naturalLanguageSummary: string;
}

// ============================================
// Entity Resolution Configuration
// ============================================

export interface EntityResolutionConfig {
  similarityThreshold: number;
  useFuzzyMatch: boolean;
  useSemanticSimilarity: boolean;
  useLLMResolution: boolean;
  llmModel: string;
  embeddingModel: string;
  batchSize: number;
  blockingEnabled: boolean;
  blockingKeyFields: string[];
}

export const DEFAULT_ENTITY_RESOLUTION_CONFIG: EntityResolutionConfig = {
  similarityThreshold: 0.85,
  useFuzzyMatch: true,
  useSemanticSimilarity: true,
  useLLMResolution: false,
  llmModel: 'qwen2.5:14b',
  embeddingModel: 'nomic-embed-text-v2-moe',
  batchSize: 50,
  blockingEnabled: true,
  blockingKeyFields: ['canonicalForm'],
};

// ============================================
// Community Detection (GraphRAG Enhancement)
// ============================================

export interface CommunityConfig {
  enabled: boolean;
  algorithm: 'louvain' | 'leiden';
  minCommunitySize: number;
  maxHierarchyLevels: number;
  generateSummaries: boolean;
}

export const DEFAULT_COMMUNITY_CONFIG: CommunityConfig = {
  enabled: false,
  algorithm: 'louvain',
  minCommunitySize: 3,
  maxHierarchyLevels: 3,
  generateSummaries: false,
};

export interface Community {
  id: string;
  level: number;
  parentId?: string;
  entityIds: string[];
  summary?: string;
  keywords: string[];
}

// ============================================
// Extraction Configuration
// ============================================

export interface ExtractionConfig {
  useLLM: boolean;
  llmModel: string;
  confidenceThreshold: number;
  extractRelationships: boolean;
  maxEntitiesPerChunk: number;
}

export const DEFAULT_EXTRACTION_CONFIG: ExtractionConfig = {
  useLLM: false,
  llmModel: 'qwen2.5:14b',
  confidenceThreshold: 0.7,
  extractRelationships: true,
  maxEntitiesPerChunk: 50,
};

// ============================================
// Graph Service Configuration
// ============================================

export interface Neo4jConfig {
  uri: string;
  username: string;
  password: string;
  database: string;
  maxConnectionPoolSize: number;
  connectionAcquisitionTimeout: number;
}

export const DEFAULT_NEO4J_CONFIG: Partial<Neo4jConfig> = {
  database: 'neo4j',
  maxConnectionPoolSize: 50,
  connectionAcquisitionTimeout: 30000,
};

// ============================================
// Graph Refinement
// ============================================

export interface RefinementRequest {
  query: string;
  queryEntities: string[];
  topChunks: Array<{ id: string; content: string; score: number }>;
  maxDepth: number;
  maxNodes: number;
}

export interface RefinedResult {
  additionalChunkIds: string[];
  graphContext: GraphTraversalResult;
  shouldUseGraph: boolean;
}

// ============================================
// Extraction Results
// ============================================

export interface ExtractionResult {
  entities: Entity[];
  relationships: Relationship[];
  stats: {
    entitiesExtracted: number;
    relationshipsExtracted: number;
    processingTimeMs: number;
    methodUsed: 'pattern' | 'llm' | 'hybrid';
  };
}

// ============================================
// Database DTOs (for PostgreSQL sync)
// ============================================

export interface EntityDTO {
  id: string;
  type: EntityType;
  text: string;
  canonical_form: string;
  aliases: string[];
  confidence: number;
  metadata: Record<string, unknown>;
  neo4j_synced: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface EntityOccurrenceDTO {
  id: number;
  entity_id: string;
  document_id: string;
  chunk_id: string;
  position: number;
  context: string;
}

export interface RelationshipDTO {
  id: string;
  source_entity_id: string;
  target_entity_id: string;
  type: RelationType;
  confidence: number;
  evidence: string;
  document_id: string;
  extraction_method: 'pattern' | 'spacy' | 'llm';
  neo4j_synced: boolean;
  created_at: Date;
}
