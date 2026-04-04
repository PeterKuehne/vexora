# Spec 1: Foundation - Evaluation & Reranking

## RAG V2 Implementation - Part 1 of 3

**Version:** 1.0
**Phases:** 0-1
**Duration:** Weeks 0-2
**Prerequisites:** Existing RAG V1 system running
**Depends on:** None
**Blocks:** Spec 2, Spec 3

---

## 1. Overview

This specification covers the foundational improvements needed before any architectural changes:

1. **Evaluation Framework** - Measure before you optimize
2. **Golden Dataset** - Curated test queries for benchmarking
3. **Embedding Benchmark** - Select optimal embedding model
4. **Reranking Service** - First major quality improvement

### Why This Comes First

Without evaluation infrastructure, we cannot:
- Measure current V1 performance (baseline)
- Validate that changes improve quality
- Compare different configurations objectively
- Detect regressions

### Success Criteria

| Metric | Target |
|--------|--------|
| Golden Dataset Size | ≥85 queries |
| V1 Baseline Documented | Yes |
| Embedding Model Selected | Data-driven |
| Precision@5 Improvement | ≥15% (with reranking) |
| Reranker Latency | <200ms |

---

## 2. Phase 0: Evaluation Baseline (Week 0-1)

### 2.1 Golden Dataset

**Purpose:** Curated query-answer pairs for objective measurement.

#### 2.1.1 Database Schema

```sql
-- File: server/src/migrations/005_golden_dataset.sql

-- Golden dataset queries
CREATE TABLE golden_dataset (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,
  expected_answer TEXT NOT NULL,
  relevant_document_ids UUID[] NOT NULL,
  relevant_chunk_ids TEXT[],

  -- Categorization
  category VARCHAR(50) NOT NULL,
  difficulty VARCHAR(20) NOT NULL DEFAULT 'medium',

  -- For evaluation
  key_facts TEXT[] NOT NULL DEFAULT '{}',
  forbidden_content TEXT[] NOT NULL DEFAULT '{}',

  -- Metadata
  created_by UUID REFERENCES users(id),
  verified_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Last evaluation results
  last_evaluated_at TIMESTAMP,
  last_precision_at_5 DECIMAL(4,3),
  last_recall_at_20 DECIMAL(4,3),
  last_groundedness DECIMAL(4,3),

  CONSTRAINT valid_category CHECK (
    category IN ('factual', 'comparative', 'procedural', 'relational', 'aggregative', 'multi_hop')
  ),
  CONSTRAINT valid_difficulty CHECK (
    difficulty IN ('easy', 'medium', 'hard')
  )
);

-- Evaluation runs
CREATE TABLE evaluation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version VARCHAR(50) NOT NULL,

  -- Configuration snapshot
  config JSONB NOT NULL,

  -- Aggregate metrics
  avg_precision_at_5 DECIMAL(4,3),
  avg_recall_at_20 DECIMAL(4,3),
  avg_groundedness DECIMAL(4,3),
  avg_latency_ms INTEGER,

  -- By category breakdown
  metrics_by_category JSONB,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_message TEXT,

  created_at TIMESTAMP DEFAULT NOW(),

  CONSTRAINT valid_status CHECK (
    status IN ('pending', 'running', 'completed', 'failed')
  )
);

-- Individual query results within a run
CREATE TABLE evaluation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES evaluation_runs(id) ON DELETE CASCADE,
  query_id UUID REFERENCES golden_dataset(id),

  -- Retrieval metrics
  precision_at_1 DECIMAL(4,3),
  precision_at_3 DECIMAL(4,3),
  precision_at_5 DECIMAL(4,3),
  precision_at_10 DECIMAL(4,3),
  precision_at_20 DECIMAL(4,3),
  recall_at_5 DECIMAL(4,3),
  recall_at_20 DECIMAL(4,3),
  mrr DECIMAL(4,3),

  -- Generation metrics
  groundedness DECIMAL(4,3),
  answer_relevance DECIMAL(4,3),
  key_facts_covered DECIMAL(4,3),
  hallucination_detected BOOLEAN DEFAULT FALSE,

  -- Latency
  latency_retrieval_ms INTEGER,
  latency_rerank_ms INTEGER,
  latency_generation_ms INTEGER,
  latency_total_ms INTEGER,

  -- Debug info
  retrieved_chunk_ids TEXT[],
  response_preview TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_golden_dataset_category ON golden_dataset(category);
CREATE INDEX idx_evaluation_runs_version ON evaluation_runs(version);
CREATE INDEX idx_evaluation_results_run_id ON evaluation_results(run_id);
```

#### 2.1.2 TypeScript Types

```typescript
// File: server/src/types/evaluation.ts

export interface GoldenQuery {
  id: string;
  query: string;
  expectedAnswer: string;
  relevantDocumentIds: string[];
  relevantChunkIds: string[];

  category: QueryCategory;
  difficulty: 'easy' | 'medium' | 'hard';

  keyFacts: string[];
  forbiddenContent: string[];

  createdBy?: string;
  verifiedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type QueryCategory =
  | 'factual'
  | 'comparative'
  | 'procedural'
  | 'relational'
  | 'aggregative'
  | 'multi_hop';

export interface GoldenDataset {
  version: string;
  queries: GoldenQuery[];
  statistics: DatasetStatistics;
}

export interface DatasetStatistics {
  totalQueries: number;
  byCategory: Record<QueryCategory, number>;
  byDifficulty: Record<string, number>;
  avgRelevantDocs: number;
  avgRelevantChunks: number;
}

export interface EvaluationConfig {
  datasetId?: string;

  // RAG configuration to test
  ragConfig: {
    embeddingModel: string;
    rerankerEnabled: boolean;
    rerankerModel?: string;
    searchLimit: number;
    hybridAlpha: number;
  };

  // Evaluation options
  evaluateGeneration: boolean;
  groundednessModel?: string;
}

export interface EvaluationRun {
  id: string;
  version: string;
  config: EvaluationConfig;

  // Aggregate metrics
  avgPrecisionAt5: number;
  avgRecallAt20: number;
  avgGroundedness: number;
  avgLatencyMs: number;

  // By category
  metricsByCategory: Record<QueryCategory, CategoryMetrics>;

  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
}

export interface CategoryMetrics {
  count: number;
  avgPrecisionAt5: number;
  avgRecallAt20: number;
  avgGroundedness: number;
  avgLatencyMs: number;
}

export interface RetrievalMetrics {
  precisionAtK: Record<number, number>;
  recallAtK: Record<number, number>;
  mrr: number;
}

export interface GenerationMetrics {
  groundedness: number;
  answerRelevance: number;
  keyFactsCovered: number;
  hallucinationDetected: boolean;
}

export interface QueryEvaluationResult {
  queryId: string;
  retrievalMetrics: RetrievalMetrics;
  generationMetrics?: GenerationMetrics;
  latency: {
    retrieval: number;
    rerank?: number;
    generation: number;
    total: number;
  };
  retrievedChunkIds: string[];
  responsePreview: string;
}
```

#### 2.1.3 Golden Dataset Service

```typescript
// File: server/src/services/evaluation/GoldenDatasetService.ts

import { DatabaseService } from '../DatabaseService';
import { GoldenQuery, GoldenDataset, DatasetStatistics, QueryCategory } from '../../types/evaluation';

export class GoldenDatasetService {
  constructor(private db: DatabaseService) {}

  async createQuery(query: Omit<GoldenQuery, 'id' | 'createdAt' | 'updatedAt'>): Promise<GoldenQuery> {
    const result = await this.db.query(
      `INSERT INTO golden_dataset
       (query, expected_answer, relevant_document_ids, relevant_chunk_ids,
        category, difficulty, key_facts, forbidden_content, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        query.query,
        query.expectedAnswer,
        query.relevantDocumentIds,
        query.relevantChunkIds,
        query.category,
        query.difficulty,
        query.keyFacts,
        query.forbiddenContent,
        query.createdBy,
      ]
    );
    return this.mapToGoldenQuery(result.rows[0]);
  }

  async getAll(): Promise<GoldenQuery[]> {
    const result = await this.db.query(
      'SELECT * FROM golden_dataset ORDER BY category, created_at'
    );
    return result.rows.map(this.mapToGoldenQuery);
  }

  async getByCategory(category: QueryCategory): Promise<GoldenQuery[]> {
    const result = await this.db.query(
      'SELECT * FROM golden_dataset WHERE category = $1 ORDER BY created_at',
      [category]
    );
    return result.rows.map(this.mapToGoldenQuery);
  }

  async getDataset(): Promise<GoldenDataset> {
    const queries = await this.getAll();
    const statistics = this.calculateStatistics(queries);

    return {
      version: '1.0',
      queries,
      statistics,
    };
  }

  async updateQuery(id: string, updates: Partial<GoldenQuery>): Promise<GoldenQuery> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    const allowedFields = [
      'query', 'expected_answer', 'relevant_document_ids', 'relevant_chunk_ids',
      'category', 'difficulty', 'key_facts', 'forbidden_content', 'verified_by'
    ];

    for (const [key, value] of Object.entries(updates)) {
      const dbKey = this.camelToSnake(key);
      if (allowedFields.includes(dbKey)) {
        setClauses.push(`${dbKey} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      throw new Error('No valid fields to update');
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    const result = await this.db.query(
      `UPDATE golden_dataset SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('Query not found');
    }

    return this.mapToGoldenQuery(result.rows[0]);
  }

  async deleteQuery(id: string): Promise<void> {
    await this.db.query('DELETE FROM golden_dataset WHERE id = $1', [id]);
  }

  async updateEvaluationResults(
    queryId: string,
    precisionAt5: number,
    recallAt20: number,
    groundedness: number
  ): Promise<void> {
    await this.db.query(
      `UPDATE golden_dataset
       SET last_evaluated_at = NOW(),
           last_precision_at_5 = $2,
           last_recall_at_20 = $3,
           last_groundedness = $4
       WHERE id = $1`,
      [queryId, precisionAt5, recallAt20, groundedness]
    );
  }

  private calculateStatistics(queries: GoldenQuery[]): DatasetStatistics {
    const byCategory: Record<QueryCategory, number> = {
      factual: 0,
      comparative: 0,
      procedural: 0,
      relational: 0,
      aggregative: 0,
      multi_hop: 0,
    };

    const byDifficulty: Record<string, number> = {
      easy: 0,
      medium: 0,
      hard: 0,
    };

    let totalDocs = 0;
    let totalChunks = 0;

    for (const query of queries) {
      byCategory[query.category]++;
      byDifficulty[query.difficulty]++;
      totalDocs += query.relevantDocumentIds.length;
      totalChunks += query.relevantChunkIds.length;
    }

    return {
      totalQueries: queries.length,
      byCategory,
      byDifficulty,
      avgRelevantDocs: queries.length > 0 ? totalDocs / queries.length : 0,
      avgRelevantChunks: queries.length > 0 ? totalChunks / queries.length : 0,
    };
  }

  private mapToGoldenQuery(row: any): GoldenQuery {
    return {
      id: row.id,
      query: row.query,
      expectedAnswer: row.expected_answer,
      relevantDocumentIds: row.relevant_document_ids || [],
      relevantChunkIds: row.relevant_chunk_ids || [],
      category: row.category,
      difficulty: row.difficulty,
      keyFacts: row.key_facts || [],
      forbiddenContent: row.forbidden_content || [],
      createdBy: row.created_by,
      verifiedBy: row.verified_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}
```

#### 2.1.4 Evaluation Service

```typescript
// File: server/src/services/evaluation/EvaluationService.ts

import { DatabaseService } from '../DatabaseService';
import { RAGService } from '../RAGService';
import { GoldenDatasetService } from './GoldenDatasetService';
import {
  EvaluationConfig,
  EvaluationRun,
  GoldenQuery,
  QueryEvaluationResult,
  RetrievalMetrics,
  GenerationMetrics,
  QueryCategory
} from '../../types/evaluation';

export class EvaluationService {
  constructor(
    private db: DatabaseService,
    private ragService: RAGService,
    private goldenDatasetService: GoldenDatasetService
  ) {}

  async startEvaluation(config: EvaluationConfig): Promise<string> {
    // Create evaluation run
    const result = await this.db.query(
      `INSERT INTO evaluation_runs (version, config, status)
       VALUES ($1, $2, 'pending')
       RETURNING id`,
      [config.ragConfig.rerankerEnabled ? 'v1+rerank' : 'v1', JSON.stringify(config)]
    );

    const runId = result.rows[0].id;

    // Start evaluation in background
    this.runEvaluation(runId, config).catch(error => {
      console.error(`Evaluation ${runId} failed:`, error);
      this.markRunFailed(runId, error.message);
    });

    return runId;
  }

  async getRunStatus(runId: string): Promise<EvaluationRun | null> {
    const result = await this.db.query(
      'SELECT * FROM evaluation_runs WHERE id = $1',
      [runId]
    );

    if (result.rows.length === 0) return null;

    return this.mapToEvaluationRun(result.rows[0]);
  }

  async getRunHistory(limit: number = 20): Promise<EvaluationRun[]> {
    const result = await this.db.query(
      'SELECT * FROM evaluation_runs ORDER BY created_at DESC LIMIT $1',
      [limit]
    );

    return result.rows.map(this.mapToEvaluationRun);
  }

  private async runEvaluation(runId: string, config: EvaluationConfig): Promise<void> {
    // Mark as running
    await this.db.query(
      `UPDATE evaluation_runs SET status = 'running', started_at = NOW() WHERE id = $1`,
      [runId]
    );

    const dataset = await this.goldenDatasetService.getDataset();
    const results: QueryEvaluationResult[] = [];

    for (const query of dataset.queries) {
      try {
        const result = await this.evaluateQuery(query, config);
        results.push(result);

        // Save individual result
        await this.saveQueryResult(runId, query.id, result);

        // Update query's last evaluation
        await this.goldenDatasetService.updateEvaluationResults(
          query.id,
          result.retrievalMetrics.precisionAtK[5] || 0,
          result.retrievalMetrics.recallAtK[20] || 0,
          result.generationMetrics?.groundedness || 0
        );
      } catch (error) {
        console.error(`Failed to evaluate query ${query.id}:`, error);
      }
    }

    // Calculate aggregates
    const aggregates = this.calculateAggregates(results, dataset.queries);

    // Update run with results
    await this.db.query(
      `UPDATE evaluation_runs
       SET status = 'completed',
           completed_at = NOW(),
           avg_precision_at_5 = $2,
           avg_recall_at_20 = $3,
           avg_groundedness = $4,
           avg_latency_ms = $5,
           metrics_by_category = $6
       WHERE id = $1`,
      [
        runId,
        aggregates.avgPrecisionAt5,
        aggregates.avgRecallAt20,
        aggregates.avgGroundedness,
        aggregates.avgLatencyMs,
        JSON.stringify(aggregates.byCategory),
      ]
    );
  }

  private async evaluateQuery(
    query: GoldenQuery,
    config: EvaluationConfig
  ): Promise<QueryEvaluationResult> {
    const startTime = Date.now();

    // Run RAG query
    const ragResponse = await this.ragService.generateResponse({
      messages: [],
      model: 'qwen3:8b',
      query: query.query,
      searchLimit: config.ragConfig.searchLimit,
      hybridAlpha: config.ragConfig.hybridAlpha,
    });

    const totalLatency = Date.now() - startTime;

    // Calculate retrieval metrics
    const retrievalMetrics = this.calculateRetrievalMetrics(
      ragResponse.searchResults?.results || [],
      query.relevantChunkIds
    );

    // Calculate generation metrics if enabled
    let generationMetrics: GenerationMetrics | undefined;
    if (config.evaluateGeneration) {
      generationMetrics = await this.calculateGenerationMetrics(
        ragResponse.response,
        query,
        ragResponse.searchResults?.results || []
      );
    }

    return {
      queryId: query.id,
      retrievalMetrics,
      generationMetrics,
      latency: {
        retrieval: ragResponse.searchResults?.searchTime || 0,
        rerank: 0, // Will be set when reranker is added
        generation: totalLatency - (ragResponse.searchResults?.searchTime || 0),
        total: totalLatency,
      },
      retrievedChunkIds: ragResponse.searchResults?.results.map(r => r.chunkId) || [],
      responsePreview: ragResponse.response.substring(0, 500),
    };
  }

  private calculateRetrievalMetrics(
    results: Array<{ chunkId: string; score: number }>,
    relevantChunkIds: string[]
  ): RetrievalMetrics {
    const relevantSet = new Set(relevantChunkIds);

    const precisionAtK: Record<number, number> = {};
    const recallAtK: Record<number, number> = {};

    for (const k of [1, 3, 5, 10, 20]) {
      const topK = results.slice(0, k);
      const relevantInTopK = topK.filter(r => relevantSet.has(r.chunkId)).length;

      precisionAtK[k] = topK.length > 0 ? relevantInTopK / k : 0;
      recallAtK[k] = relevantSet.size > 0 ? relevantInTopK / relevantSet.size : 0;
    }

    // MRR
    const firstRelevantIndex = results.findIndex(r => relevantSet.has(r.chunkId));
    const mrr = firstRelevantIndex >= 0 ? 1 / (firstRelevantIndex + 1) : 0;

    return { precisionAtK, recallAtK, mrr };
  }

  private async calculateGenerationMetrics(
    response: string,
    query: GoldenQuery,
    context: Array<{ content: string }>
  ): Promise<GenerationMetrics> {
    // Check key facts
    const keyFactsCovered = query.keyFacts.filter(
      fact => response.toLowerCase().includes(fact.toLowerCase())
    ).length / Math.max(query.keyFacts.length, 1);

    // Check forbidden content (hallucination indicator)
    const hallucinationDetected = query.forbiddenContent.some(
      content => response.toLowerCase().includes(content.toLowerCase())
    );

    // Simple groundedness check: count claims that appear in context
    // In production, use LLM-based evaluation
    const contextText = context.map(c => c.content).join(' ').toLowerCase();
    const responseSentences = response.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const groundedSentences = responseSentences.filter(
      sentence => this.isGroundedInContext(sentence, contextText)
    );
    const groundedness = responseSentences.length > 0
      ? groundedSentences.length / responseSentences.length
      : 1;

    // Answer relevance: simple keyword overlap with query
    const queryWords = new Set(query.query.toLowerCase().split(/\s+/));
    const responseWords = response.toLowerCase().split(/\s+/);
    const overlap = responseWords.filter(w => queryWords.has(w)).length;
    const answerRelevance = Math.min(1, overlap / queryWords.size);

    return {
      groundedness,
      answerRelevance,
      keyFactsCovered,
      hallucinationDetected,
    };
  }

  private isGroundedInContext(sentence: string, context: string): boolean {
    // Simple heuristic: check if key noun phrases appear in context
    const words = sentence.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    const matchCount = words.filter(w => context.includes(w)).length;
    return matchCount >= words.length * 0.5;
  }

  private calculateAggregates(
    results: QueryEvaluationResult[],
    queries: GoldenQuery[]
  ): {
    avgPrecisionAt5: number;
    avgRecallAt20: number;
    avgGroundedness: number;
    avgLatencyMs: number;
    byCategory: Record<QueryCategory, any>;
  } {
    const queryMap = new Map(queries.map(q => [q.id, q]));

    let totalP5 = 0, totalR20 = 0, totalG = 0, totalL = 0;
    const byCategory: Record<QueryCategory, { count: number; p5: number; r20: number; g: number; l: number }> = {
      factual: { count: 0, p5: 0, r20: 0, g: 0, l: 0 },
      comparative: { count: 0, p5: 0, r20: 0, g: 0, l: 0 },
      procedural: { count: 0, p5: 0, r20: 0, g: 0, l: 0 },
      relational: { count: 0, p5: 0, r20: 0, g: 0, l: 0 },
      aggregative: { count: 0, p5: 0, r20: 0, g: 0, l: 0 },
      multi_hop: { count: 0, p5: 0, r20: 0, g: 0, l: 0 },
    };

    for (const result of results) {
      const query = queryMap.get(result.queryId);
      if (!query) continue;

      const p5 = result.retrievalMetrics.precisionAtK[5] || 0;
      const r20 = result.retrievalMetrics.recallAtK[20] || 0;
      const g = result.generationMetrics?.groundedness || 0;
      const l = result.latency.total;

      totalP5 += p5;
      totalR20 += r20;
      totalG += g;
      totalL += l;

      byCategory[query.category].count++;
      byCategory[query.category].p5 += p5;
      byCategory[query.category].r20 += r20;
      byCategory[query.category].g += g;
      byCategory[query.category].l += l;
    }

    const n = results.length;

    // Calculate averages by category
    const byCategoryAvg: Record<QueryCategory, any> = {} as any;
    for (const [cat, data] of Object.entries(byCategory)) {
      if (data.count > 0) {
        byCategoryAvg[cat as QueryCategory] = {
          count: data.count,
          avgPrecisionAt5: data.p5 / data.count,
          avgRecallAt20: data.r20 / data.count,
          avgGroundedness: data.g / data.count,
          avgLatencyMs: Math.round(data.l / data.count),
        };
      }
    }

    return {
      avgPrecisionAt5: n > 0 ? totalP5 / n : 0,
      avgRecallAt20: n > 0 ? totalR20 / n : 0,
      avgGroundedness: n > 0 ? totalG / n : 0,
      avgLatencyMs: n > 0 ? Math.round(totalL / n) : 0,
      byCategory: byCategoryAvg,
    };
  }

  private async saveQueryResult(
    runId: string,
    queryId: string,
    result: QueryEvaluationResult
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO evaluation_results
       (run_id, query_id, precision_at_1, precision_at_3, precision_at_5,
        precision_at_10, precision_at_20, recall_at_5, recall_at_20, mrr,
        groundedness, answer_relevance, key_facts_covered, hallucination_detected,
        latency_retrieval_ms, latency_rerank_ms, latency_generation_ms, latency_total_ms,
        retrieved_chunk_ids, response_preview)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
      [
        runId,
        queryId,
        result.retrievalMetrics.precisionAtK[1],
        result.retrievalMetrics.precisionAtK[3],
        result.retrievalMetrics.precisionAtK[5],
        result.retrievalMetrics.precisionAtK[10],
        result.retrievalMetrics.precisionAtK[20],
        result.retrievalMetrics.recallAtK[5],
        result.retrievalMetrics.recallAtK[20],
        result.retrievalMetrics.mrr,
        result.generationMetrics?.groundedness,
        result.generationMetrics?.answerRelevance,
        result.generationMetrics?.keyFactsCovered,
        result.generationMetrics?.hallucinationDetected,
        result.latency.retrieval,
        result.latency.rerank,
        result.latency.generation,
        result.latency.total,
        result.retrievedChunkIds,
        result.responsePreview,
      ]
    );
  }

  private async markRunFailed(runId: string, error: string): Promise<void> {
    await this.db.query(
      `UPDATE evaluation_runs SET status = 'failed', error_message = $2 WHERE id = $1`,
      [runId, error]
    );
  }

  private mapToEvaluationRun(row: any): EvaluationRun {
    return {
      id: row.id,
      version: row.version,
      config: row.config,
      avgPrecisionAt5: parseFloat(row.avg_precision_at_5) || 0,
      avgRecallAt20: parseFloat(row.avg_recall_at_20) || 0,
      avgGroundedness: parseFloat(row.avg_groundedness) || 0,
      avgLatencyMs: row.avg_latency_ms || 0,
      metricsByCategory: row.metrics_by_category || {},
      status: row.status,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      errorMessage: row.error_message,
    };
  }
}
```

### 2.2 Embedding Benchmark

**Purpose:** Select optimal embedding model before making changes.

```typescript
// File: server/src/services/evaluation/EmbeddingBenchmark.ts

import { EmbeddingService } from '../EmbeddingService';
import { VectorService } from '../VectorService';
import { GoldenDatasetService } from './GoldenDatasetService';

interface EmbeddingBenchmarkResult {
  modelName: string;

  // Quality
  avgPrecisionAt5: number;
  avgRecallAt20: number;
  avgMRR: number;

  // Performance
  avgEmbeddingLatencyMs: number;
  memoryUsageMb: number;

  // Dimensions
  dimensions: number;
}

export class EmbeddingBenchmark {
  private candidateModels = [
    'nomic-embed-text',
    'mxbai-embed-large',
    'all-minilm',
  ];

  constructor(
    private embeddingService: EmbeddingService,
    private vectorService: VectorService,
    private goldenDatasetService: GoldenDatasetService
  ) {}

  async runBenchmark(): Promise<EmbeddingBenchmarkResult[]> {
    const dataset = await this.goldenDatasetService.getDataset();
    const results: EmbeddingBenchmarkResult[] = [];

    for (const model of this.candidateModels) {
      console.log(`Benchmarking model: ${model}`);

      try {
        const result = await this.benchmarkModel(model, dataset.queries);
        results.push(result);
      } catch (error) {
        console.error(`Failed to benchmark ${model}:`, error);
      }
    }

    // Sort by precision
    results.sort((a, b) => b.avgPrecisionAt5 - a.avgPrecisionAt5);

    return results;
  }

  private async benchmarkModel(
    modelName: string,
    queries: Array<{ query: string; relevantChunkIds: string[] }>
  ): Promise<EmbeddingBenchmarkResult> {
    // Measure embedding latency
    const latencies: number[] = [];
    for (const q of queries.slice(0, 10)) {
      const start = Date.now();
      await this.embeddingService.generateEmbedding(q.query, modelName);
      latencies.push(Date.now() - start);
    }

    // Get dimensions
    const testEmbedding = await this.embeddingService.generateEmbedding('test', modelName);
    const dimensions = testEmbedding.length;

    // Measure retrieval quality
    let totalP5 = 0, totalR20 = 0, totalMRR = 0;

    for (const query of queries) {
      const embedding = await this.embeddingService.generateEmbedding(query.query, modelName);
      const results = await this.vectorService.searchWithEmbedding(embedding, 20);

      const relevantSet = new Set(query.relevantChunkIds);

      // Precision@5
      const top5 = results.slice(0, 5);
      const relevantIn5 = top5.filter(r => relevantSet.has(r.chunkId)).length;
      totalP5 += relevantIn5 / 5;

      // Recall@20
      const relevantIn20 = results.filter(r => relevantSet.has(r.chunkId)).length;
      totalR20 += relevantSet.size > 0 ? relevantIn20 / relevantSet.size : 0;

      // MRR
      const firstRelevant = results.findIndex(r => relevantSet.has(r.chunkId));
      totalMRR += firstRelevant >= 0 ? 1 / (firstRelevant + 1) : 0;
    }

    const n = queries.length;

    return {
      modelName,
      avgPrecisionAt5: totalP5 / n,
      avgRecallAt20: totalR20 / n,
      avgMRR: totalMRR / n,
      avgEmbeddingLatencyMs: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      memoryUsageMb: 0, // Would need to measure actual memory
      dimensions,
    };
  }
}
```

### 2.3 API Routes

```typescript
// File: server/src/routes/evaluation.ts

import { Router } from 'express';
import { EvaluationService } from '../services/evaluation/EvaluationService';
import { GoldenDatasetService } from '../services/evaluation/GoldenDatasetService';
import { EmbeddingBenchmark } from '../services/evaluation/EmbeddingBenchmark';
import { authenticateToken, requireAdmin } from '../middleware/auth';

export function createEvaluationRoutes(
  evaluationService: EvaluationService,
  goldenDatasetService: GoldenDatasetService,
  embeddingBenchmark: EmbeddingBenchmark
): Router {
  const router = Router();

  // All evaluation routes require admin
  router.use(authenticateToken, requireAdmin);

  // Golden Dataset CRUD
  router.get('/golden-dataset', async (req, res) => {
    const dataset = await goldenDatasetService.getDataset();
    res.json(dataset);
  });

  router.post('/golden-dataset', async (req, res) => {
    const query = await goldenDatasetService.createQuery({
      ...req.body,
      createdBy: req.user?.id,
    });
    res.status(201).json(query);
  });

  router.put('/golden-dataset/:id', async (req, res) => {
    const query = await goldenDatasetService.updateQuery(req.params.id, req.body);
    res.json(query);
  });

  router.delete('/golden-dataset/:id', async (req, res) => {
    await goldenDatasetService.deleteQuery(req.params.id);
    res.status(204).send();
  });

  // Evaluation runs
  router.post('/run', async (req, res) => {
    const runId = await evaluationService.startEvaluation(req.body);
    res.status(202).json({ runId, status: 'started' });
  });

  router.get('/runs/:id', async (req, res) => {
    const run = await evaluationService.getRunStatus(req.params.id);
    if (!run) {
      return res.status(404).json({ error: 'Run not found' });
    }
    res.json(run);
  });

  router.get('/history', async (req, res) => {
    const limit = parseInt(req.query.limit as string) || 20;
    const runs = await evaluationService.getRunHistory(limit);
    res.json(runs);
  });

  // Embedding benchmark
  router.post('/embedding-benchmark', async (req, res) => {
    res.status(202).json({ status: 'started' });

    // Run in background
    embeddingBenchmark.runBenchmark()
      .then(results => {
        console.log('Embedding benchmark results:', results);
      })
      .catch(error => {
        console.error('Embedding benchmark failed:', error);
      });
  });

  return router;
}
```

---

## 3. Phase 1: Reranking (Week 1-2)

### 3.1 Reranker Service

```typescript
// File: server/src/services/rag/RerankerService.ts

import { pipeline, env } from '@xenova/transformers';

// Configure transformers.js
env.allowLocalModels = true;
env.useBrowserCache = false;

interface RerankerConfig {
  model: string;
  topK: number;
  batchSize: number;
  scoreThreshold?: number;
}

interface ScoredChunk {
  id: string;
  documentId: string;
  content: string;
  score: number;
  vectorScore?: number;
  bm25Score?: number;
  metadata?: any;
}

interface RerankedChunk extends ScoredChunk {
  rerankerScore: number;
  finalScore: number;
  rank: number;
}

interface RerankerResult {
  rerankedChunks: RerankedChunk[];
  processingTime: number;
}

export class RerankerService {
  private reranker: any = null;
  private config: RerankerConfig;
  private initialized = false;

  constructor(config?: Partial<RerankerConfig>) {
    this.config = {
      model: config?.model || 'Xenova/bge-reranker-base',
      topK: config?.topK || 5,
      batchSize: config?.batchSize || 10,
      scoreThreshold: config?.scoreThreshold,
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log(`Initializing reranker with model: ${this.config.model}`);

    try {
      this.reranker = await pipeline(
        'text-classification',
        this.config.model,
        { quantized: true }
      );
      this.initialized = true;
      console.log('Reranker initialized successfully');
    } catch (error) {
      console.error('Failed to initialize reranker:', error);
      throw error;
    }
  }

  async rerank(
    query: string,
    candidates: ScoredChunk[],
    options?: Partial<RerankerConfig>
  ): Promise<RerankerResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    const config = { ...this.config, ...options };

    // Create query-document pairs
    const pairs = candidates.map(chunk => ({
      text: query,
      text_pair: chunk.content.substring(0, 512), // Limit content length
    }));

    // Score in batches
    const scores: number[] = [];

    for (let i = 0; i < pairs.length; i += config.batchSize) {
      const batch = pairs.slice(i, i + config.batchSize);
      const batchResults = await Promise.all(
        batch.map(pair => this.reranker(pair.text, { text_pair: pair.text_pair }))
      );

      // Extract scores (the model returns relevance score)
      for (const result of batchResults) {
        // BGE reranker returns array with score
        const score = Array.isArray(result) ? result[0]?.score || 0 : result?.score || 0;
        scores.push(score);
      }
    }

    // Combine scores and sort
    const reranked = candidates
      .map((chunk, idx) => ({
        ...chunk,
        rerankerScore: scores[idx],
        finalScore: this.combinedScore(chunk.score, scores[idx]),
      }))
      .filter(c => !config.scoreThreshold || c.finalScore >= config.scoreThreshold)
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, config.topK)
      .map((chunk, idx) => ({
        ...chunk,
        rank: idx + 1,
      }));

    return {
      rerankedChunks: reranked,
      processingTime: Date.now() - startTime,
    };
  }

  private combinedScore(hybridScore: number, rerankerScore: number): number {
    // Weight: 30% hybrid, 70% reranker
    const normalizedReranker = this.normalizeScore(rerankerScore);
    return 0.3 * hybridScore + 0.7 * normalizedReranker;
  }

  private normalizeScore(score: number): number {
    // Sigmoid normalization to [0, 1]
    return 1 / (1 + Math.exp(-score));
  }

  async healthCheck(): Promise<{ status: string; model: string }> {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // Test with a simple query
      await this.reranker('test query', { text_pair: 'test document' });

      return {
        status: 'ok',
        model: this.config.model,
      };
    } catch (error) {
      return {
        status: 'error',
        model: this.config.model,
      };
    }
  }
}
```

### 3.2 Updated RAG Service with Reranking

```typescript
// File: server/src/services/RAGService.ts (updates)

// Add to existing RAGService class:

import { RerankerService } from './rag/RerankerService';

interface RAGRequest {
  messages: ChatMessage[];
  model: string;
  query: string;
  searchLimit?: number;
  searchThreshold?: number;
  hybridAlpha?: number;
  userContext?: UserContext;

  // New reranking options
  rerank?: boolean;
  rerankConfig?: {
    topK?: number;
    scoreThreshold?: number;
  };
}

export class RAGService {
  private rerankerService: RerankerService;

  constructor(
    vectorService: VectorService,
    ollamaService: OllamaService,
    documentService: DocumentService,
    loggerService: LoggerService
  ) {
    // ... existing constructor code ...

    this.rerankerService = new RerankerService();
  }

  async initialize(): Promise<void> {
    // ... existing initialization ...

    // Initialize reranker
    try {
      await this.rerankerService.initialize();
      console.log('Reranker service initialized');
    } catch (error) {
      console.warn('Reranker initialization failed, will continue without reranking:', error);
    }
  }

  async generateResponse(request: RAGRequest): Promise<RAGResponse> {
    const {
      messages,
      model,
      query,
      searchLimit = request.rerank ? 50 : 5, // Get more candidates if reranking
      searchThreshold = 0.5,
      hybridAlpha = 0.5,
      userContext,
      rerank = false,
      rerankConfig,
    } = request;

    try {
      // Set user context for RLS
      if (userContext) {
        await this.documentService.setUserContext(
          userContext.userId,
          userContext.userRole,
          userContext.userDepartment
        );
      }

      // Get accessible documents
      const accessibleDocIds = await this.documentService.getAccessibleDocumentIds();

      // Vector search with more candidates if reranking
      const searchResults = await this.vectorService.search({
        query,
        limit: searchLimit,
        threshold: searchThreshold,
        hybridAlpha,
        allowedDocumentIds: accessibleDocIds,
      });

      let finalResults = searchResults.results;
      let rerankTime = 0;

      // Apply reranking if enabled and we have results
      if (rerank && finalResults.length > 0) {
        const rerankResult = await this.rerankerService.rerank(
          query,
          finalResults.map(r => ({
            id: r.chunkId,
            documentId: r.documentId,
            content: r.content,
            score: r.score,
            metadata: r.metadata,
          })),
          {
            topK: rerankConfig?.topK || 5,
            scoreThreshold: rerankConfig?.scoreThreshold,
          }
        );

        rerankTime = rerankResult.processingTime;

        // Map back to original format
        finalResults = rerankResult.rerankedChunks.map(chunk => ({
          chunkId: chunk.id,
          documentId: chunk.documentId,
          content: chunk.content,
          score: chunk.finalScore,
          rerankerScore: chunk.rerankerScore,
          rank: chunk.rank,
          metadata: chunk.metadata,
        }));
      }

      // Check if we have relevant sources
      const hasRelevantSources = finalResults.length > 0 && finalResults[0].score >= searchThreshold;

      if (!hasRelevantSources) {
        return {
          response: 'Entschuldigung, ich habe keine relevanten Informationen...',
          sources: [],
          hasRelevantSources: false,
          searchResults: { results: finalResults, totalResults: 0, query },
        };
      }

      // Build context and generate response
      const context = this.buildContext(finalResults);
      const systemPrompt = this.buildSystemPrompt(context);

      const response = await this.ollamaService.chat({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
          { role: 'user', content: query },
        ],
      });

      // Extract sources
      const sources = this.extractSources(finalResults);

      // Log (without sensitive data)
      this.loggerService.logRAG('query', {
        queryLength: query.length,
        resultsCount: finalResults.length,
        reranked: rerank,
        rerankTime,
        hasRelevantSources,
      });

      return {
        response: response.message.content,
        sources,
        hasRelevantSources,
        searchResults: {
          results: finalResults,
          totalResults: searchResults.totalResults,
          query,
          rerankTime,
        },
      };

    } finally {
      // Clean up user context
      if (userContext) {
        await this.documentService.clearUserContext();
      }
    }
  }
}
```

### 3.3 Environment Variables

```env
# Add to .env

# Reranker Configuration
RERANKER_ENABLED=true
RERANKER_MODEL=Xenova/bge-reranker-base
RERANKER_TOP_K=5
RERANKER_BATCH_SIZE=10
RERANKER_SCORE_THRESHOLD=0.3

# Search Configuration (when reranking)
RAG_CANDIDATE_LIMIT=50
RAG_FINAL_LIMIT=5
```

### 3.4 Package Dependencies

```json
// Add to server/package.json dependencies
{
  "@xenova/transformers": "^2.17.0"
}
```

---

## 4. Implementation Checklist

### Phase 0: Evaluation Baseline

- [ ] Create migration `005_golden_dataset.sql`
- [ ] Run migration
- [ ] Implement `GoldenDatasetService`
- [ ] Implement `EvaluationService`
- [ ] Implement `EmbeddingBenchmark`
- [ ] Create evaluation API routes
- [ ] **Create Golden Dataset (85+ queries)**
  - [ ] 20+ factual queries
  - [ ] 10+ comparative queries
  - [ ] 15+ procedural queries
  - [ ] 15+ relational queries
  - [ ] 10+ aggregative queries
  - [ ] 15+ multi-hop queries
- [ ] Run V1 baseline evaluation
- [ ] Run embedding benchmark
- [ ] Document baseline metrics

### Phase 1: Reranking

- [ ] Install `@xenova/transformers`
- [ ] Implement `RerankerService`
- [ ] Update `RAGService` with reranking
- [ ] Add environment variables
- [ ] Update API to support `rerank` option
- [ ] Run evaluation: V1 vs V1+Reranking
- [ ] Document improvement metrics

---

## 5. Success Validation

### After Phase 0

```
Expected outputs:
├── Golden dataset with 85+ queries
├── Baseline evaluation report
│   ├── Overall: Precision@5 = X%, Recall@20 = Y%
│   ├── By category breakdown
│   └── Latency metrics
├── Embedding benchmark report
│   └── Recommendation: Model X (best P@5)
└── Baseline documented in evaluation_runs table
```

### After Phase 1

```
Expected outputs:
├── Reranker service operational
├── API supports ?rerank=true
├── Evaluation report: V1+Reranking
│   ├── Precision@5 improvement ≥15%
│   ├── Latency increase <200ms
│   └── By category comparison
└── Decision: Proceed to Spec 2
```

---

## 6. Rollback Plan

If reranking causes issues:

1. Set `RERANKER_ENABLED=false` in environment
2. Remove `rerank: true` from API calls
3. System falls back to pure hybrid search

---

## 7. Next Steps

After completing Spec 1:

1. Review evaluation results
2. Confirm Precision@5 ≥15% improvement
3. Proceed to **Spec 2: Document Processing**

---

**Spec Status:** Ready for Implementation
**Estimated Duration:** 2 weeks
**Dependencies:** None
**Blocks:** Spec 2, Spec 3
