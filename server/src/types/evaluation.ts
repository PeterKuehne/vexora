/**
 * Evaluation Types - RAG V2 Foundation
 * Types for golden dataset and evaluation framework
 */

// ===========================================
// Query Categories
// ===========================================

export type QueryCategory =
  | 'factual'      // Direct fact retrieval
  | 'comparative'  // Compare multiple items
  | 'procedural'   // How-to questions
  | 'relational'   // Relationships between entities
  | 'aggregative'  // Summarize/aggregate info
  | 'multi_hop';   // Requires multiple retrieval steps

export type Difficulty = 'easy' | 'medium' | 'hard';

// ===========================================
// Golden Dataset
// ===========================================

export interface GoldenQuery {
  id: string;
  query: string;
  expectedAnswer: string;
  relevantDocumentIds: string[];
  relevantChunkIds: string[];

  category: QueryCategory;
  difficulty: Difficulty;

  keyFacts: string[];
  forbiddenContent: string[];

  createdBy?: string;
  verifiedBy?: string;
  createdAt: Date;
  updatedAt: Date;

  // Cached last evaluation results
  lastEvaluatedAt?: Date;
  lastPrecisionAt5?: number;
  lastRecallAt20?: number;
  lastGroundedness?: number;
}

export interface GoldenDataset {
  version: string;
  queries: GoldenQuery[];
  statistics: DatasetStatistics;
}

export interface DatasetStatistics {
  totalQueries: number;
  byCategory: Record<QueryCategory, number>;
  byDifficulty: Record<Difficulty, number>;
  avgRelevantDocs: number;
  avgRelevantChunks: number;
}

// ===========================================
// Evaluation Configuration
// ===========================================

export interface EvaluationConfig {
  datasetId?: string;

  // RAG configuration to test
  ragConfig: {
    embeddingModel: string;
    rerankerEnabled: boolean;
    rerankerModel?: string;
    searchLimit: number;
    searchThreshold: number;  // Lower = more results for reranking
    hybridAlpha: number;
  };

  // Evaluation options
  evaluateGeneration: boolean;
  groundednessModel?: string;
}

// ===========================================
// Evaluation Run
// ===========================================

export type EvaluationStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface EvaluationRun {
  id: string;
  version: string;
  config: EvaluationConfig;

  // Aggregate metrics
  avgPrecisionAt5: number;
  avgRecallAt20: number;
  avgGroundedness: number;
  avgLatencyMs: number;

  // By category breakdown
  metricsByCategory: Record<QueryCategory, CategoryMetrics>;

  status: EvaluationStatus;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;

  createdBy?: string;
  createdAt: Date;
}

export interface CategoryMetrics {
  count: number;
  avgPrecisionAt5: number;
  avgRecallAt20: number;
  avgGroundedness: number;
  avgLatencyMs: number;
}

// ===========================================
// Metrics
// ===========================================

export interface RetrievalMetrics {
  precisionAtK: Record<number, number>; // K -> precision value
  recallAtK: Record<number, number>;    // K -> recall value
  mrr: number;                          // Mean Reciprocal Rank
}

export interface GenerationMetrics {
  groundedness: number;        // 0-1: How grounded in context
  answerRelevance: number;     // 0-1: How relevant to query
  keyFactsCovered: number;     // 0-1: Fraction of key facts found
  hallucinationDetected: boolean;
}

export interface LatencyMetrics {
  retrieval: number;   // ms
  rerank?: number;     // ms (optional)
  generation: number;  // ms
  total: number;       // ms
}

// ===========================================
// Query Evaluation Result
// ===========================================

export interface QueryEvaluationResult {
  queryId: string;
  retrievalMetrics: RetrievalMetrics;
  generationMetrics?: GenerationMetrics;
  latency: LatencyMetrics;
  retrievedChunkIds: string[];
  responsePreview: string;
}

// ===========================================
// API Request/Response Types
// ===========================================

export interface CreateGoldenQueryRequest {
  query: string;
  expectedAnswer: string;
  relevantDocumentIds: string[];
  relevantChunkIds?: string[];
  category: QueryCategory;
  difficulty?: Difficulty;
  keyFacts?: string[];
  forbiddenContent?: string[];
}

export interface UpdateGoldenQueryRequest {
  query?: string;
  expectedAnswer?: string;
  relevantDocumentIds?: string[];
  relevantChunkIds?: string[];
  category?: QueryCategory;
  difficulty?: Difficulty;
  keyFacts?: string[];
  forbiddenContent?: string[];
  verifiedBy?: string;
}

export interface StartEvaluationRequest {
  ragConfig: {
    embeddingModel?: string;
    rerankerEnabled?: boolean;
    rerankerModel?: string;
    searchLimit?: number;
    hybridAlpha?: number;
  };
  evaluateGeneration?: boolean;
}

export interface EvaluationRunResponse {
  runId: string;
  status: EvaluationStatus;
  message?: string;
}
