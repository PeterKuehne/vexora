/**
 * EvaluationService - RAG Evaluation Framework
 * Runs evaluation benchmarks against the golden dataset
 * Part of: Spec 1 - Foundation (Phase 0)
 */

import { databaseService } from '../DatabaseService.js';
import { ragService } from '../RAGService.js';
import { goldenDatasetService } from './GoldenDatasetService.js';
import {
  EvaluationConfig,
  EvaluationRun,
  EvaluationStatus,
  GoldenQuery,
  QueryEvaluationResult,
  RetrievalMetrics,
  GenerationMetrics,
  QueryCategory,
  CategoryMetrics,
} from '../../types/evaluation.js';

export class EvaluationService {
  /**
   * Start a new evaluation run
   */
  async startEvaluation(config: EvaluationConfig, createdBy?: string): Promise<string> {
    // Create evaluation run record
    const result = await databaseService.query(
      `INSERT INTO evaluation_runs (version, config, status, created_by)
       VALUES ($1, $2, 'pending', $3)
       RETURNING id`,
      [
        config.ragConfig.rerankerEnabled ? 'v1+rerank' : 'v1',
        JSON.stringify(config),
        createdBy || null,
      ]
    );

    const runId = result.rows[0].id;

    // Start evaluation in background
    this.runEvaluation(runId, config).catch((error) => {
      console.error(`Evaluation ${runId} failed:`, error);
      this.markRunFailed(runId, error.message);
    });

    return runId;
  }

  /**
   * Get evaluation run status
   */
  async getRunStatus(runId: string): Promise<EvaluationRun | null> {
    const result = await databaseService.query(
      'SELECT * FROM evaluation_runs WHERE id = $1',
      [runId]
    );

    if (result.rows.length === 0) return null;
    return this.mapToEvaluationRun(result.rows[0]);
  }

  /**
   * Get evaluation run history
   */
  async getRunHistory(limit: number = 20): Promise<EvaluationRun[]> {
    const result = await databaseService.query(
      'SELECT * FROM evaluation_runs ORDER BY created_at DESC LIMIT $1',
      [limit]
    );

    return result.rows.map(this.mapToEvaluationRun);
  }

  /**
   * Get detailed results for a run
   */
  async getRunResults(runId: string): Promise<QueryEvaluationResult[]> {
    const result = await databaseService.query(
      `SELECT er.*, gd.query as query_text
       FROM evaluation_results er
       JOIN golden_dataset gd ON er.query_id = gd.id
       WHERE er.run_id = $1
       ORDER BY er.created_at`,
      [runId]
    );

    return result.rows.map((row) => ({
      queryId: row.query_id,
      retrievalMetrics: {
        precisionAtK: {
          1: parseFloat(row.precision_at_1) || 0,
          3: parseFloat(row.precision_at_3) || 0,
          5: parseFloat(row.precision_at_5) || 0,
          10: parseFloat(row.precision_at_10) || 0,
          20: parseFloat(row.precision_at_20) || 0,
        },
        recallAtK: {
          5: parseFloat(row.recall_at_5) || 0,
          20: parseFloat(row.recall_at_20) || 0,
        },
        mrr: parseFloat(row.mrr) || 0,
      },
      generationMetrics: row.groundedness
        ? {
            groundedness: parseFloat(row.groundedness) || 0,
            answerRelevance: parseFloat(row.answer_relevance) || 0,
            keyFactsCovered: parseFloat(row.key_facts_covered) || 0,
            hallucinationDetected: row.hallucination_detected || false,
          }
        : undefined,
      latency: {
        retrieval: row.latency_retrieval_ms || 0,
        rerank: row.latency_rerank_ms,
        generation: row.latency_generation_ms || 0,
        total: row.latency_total_ms || 0,
      },
      retrievedChunkIds: row.retrieved_chunk_ids || [],
      responsePreview: row.response_preview || '',
    }));
  }

  /**
   * Compare two evaluation runs
   */
  async compareRuns(
    runId1: string,
    runId2: string
  ): Promise<{
    run1: EvaluationRun;
    run2: EvaluationRun;
    improvement: {
      precisionAt5: number;
      recallAt20: number;
      groundedness: number;
      latency: number;
    };
  }> {
    const [run1, run2] = await Promise.all([
      this.getRunStatus(runId1),
      this.getRunStatus(runId2),
    ]);

    if (!run1 || !run2) {
      throw new Error('One or both runs not found');
    }

    return {
      run1,
      run2,
      improvement: {
        precisionAt5: run2.avgPrecisionAt5 - run1.avgPrecisionAt5,
        recallAt20: run2.avgRecallAt20 - run1.avgRecallAt20,
        groundedness: run2.avgGroundedness - run1.avgGroundedness,
        latency: run1.avgLatencyMs - run2.avgLatencyMs, // Lower is better
      },
    };
  }

  /**
   * Run the actual evaluation (called in background)
   */
  private async runEvaluation(runId: string, config: EvaluationConfig): Promise<void> {
    // Mark as running
    await databaseService.query(
      `UPDATE evaluation_runs SET status = 'running', started_at = NOW() WHERE id = $1`,
      [runId]
    );

    const dataset = await goldenDatasetService.getDataset();
    const results: QueryEvaluationResult[] = [];

    console.log(`📊 Starting evaluation run ${runId} with ${dataset.queries.length} queries`);

    for (const query of dataset.queries) {
      try {
        const result = await this.evaluateQuery(query, config);
        results.push(result);

        // Save individual result
        await this.saveQueryResult(runId, query.id, result);

        // Update query's cached evaluation results
        await goldenDatasetService.updateEvaluationResults(
          query.id,
          result.retrievalMetrics.precisionAtK[5] || 0,
          result.retrievalMetrics.recallAtK[20] || 0,
          result.generationMetrics?.groundedness || 0
        );

        console.log(
          `  ✓ Query "${query.query.substring(0, 40)}..." - P@5: ${(
            (result.retrievalMetrics.precisionAtK[5] || 0) * 100
          ).toFixed(1)}%`
        );
      } catch (error) {
        console.error(`  ✗ Failed to evaluate query ${query.id}:`, error);
      }
    }

    // Calculate aggregates
    const aggregates = this.calculateAggregates(results, dataset.queries);

    // Update run with results
    await databaseService.query(
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

    console.log(`✅ Evaluation run ${runId} completed:`);
    console.log(`   Avg Precision@5: ${(aggregates.avgPrecisionAt5 * 100).toFixed(1)}%`);
    console.log(`   Avg Recall@20: ${(aggregates.avgRecallAt20 * 100).toFixed(1)}%`);
    console.log(`   Avg Groundedness: ${(aggregates.avgGroundedness * 100).toFixed(1)}%`);
    console.log(`   Avg Latency: ${aggregates.avgLatencyMs}ms`);
  }

  /**
   * Evaluate a single query
   */
  private async evaluateQuery(
    query: GoldenQuery,
    config: EvaluationConfig
  ): Promise<QueryEvaluationResult> {
    const startTime = Date.now();

    // Run RAG query (with optional reranking)
    const ragResponse = await ragService.generateResponse({
      messages: [],
      model: 'qwen3:8b',
      query: query.query,
      searchLimit: config.ragConfig.searchLimit,
      searchThreshold: config.ragConfig.searchThreshold,
      hybridAlpha: config.ragConfig.hybridAlpha,
      rerank: config.ragConfig.rerankerEnabled,
      rerankTopK: 5,
    });

    const totalLatency = Date.now() - startTime;

    // Extract chunk IDs from results
    const retrievedChunkIds = ragResponse.searchResults.results.map(
      (r) => `${r.chunk.documentId}:${r.chunk.chunkIndex}`
    );

    // Extract unique document IDs from retrieved chunks
    const retrievedDocIds = [...new Set(
      ragResponse.searchResults.results.map((r) => r.chunk.documentId)
    )];

    // Calculate retrieval metrics
    // Use document-level comparison if no chunk IDs provided in golden dataset
    const useDocumentLevel = !query.relevantChunkIds || query.relevantChunkIds.length === 0;
    const retrievalMetrics = useDocumentLevel
      ? this.calculateRetrievalMetrics(retrievedDocIds, query.relevantDocumentIds)
      : this.calculateRetrievalMetrics(retrievedChunkIds, query.relevantChunkIds);

    // Calculate generation metrics if enabled
    let generationMetrics: GenerationMetrics | undefined;
    if (config.evaluateGeneration) {
      generationMetrics = this.calculateGenerationMetrics(
        ragResponse.message,
        query,
        ragResponse.searchResults.results.map((r) => r.chunk.content)
      );
    }

    return {
      queryId: query.id,
      retrievalMetrics,
      generationMetrics,
      latency: {
        retrieval: Math.round(totalLatency * 0.3), // Estimate
        rerank: 0,
        generation: Math.round(totalLatency * 0.7), // Estimate
        total: totalLatency,
      },
      retrievedChunkIds,
      responsePreview: ragResponse.message.substring(0, 500),
    };
  }

  /**
   * Calculate retrieval metrics (Precision@K, Recall@K, MRR)
   */
  private calculateRetrievalMetrics(
    retrievedIds: string[],
    relevantIds: string[]
  ): RetrievalMetrics {
    const relevantSet = new Set(relevantIds);

    const precisionAtK: Record<number, number> = {};
    const recallAtK: Record<number, number> = {};

    for (const k of [1, 3, 5, 10, 20]) {
      const topK = retrievedIds.slice(0, k);
      const relevantInTopK = topK.filter((id) => relevantSet.has(id)).length;

      precisionAtK[k] = topK.length > 0 ? relevantInTopK / k : 0;
      recallAtK[k] = relevantSet.size > 0 ? relevantInTopK / relevantSet.size : 0;
    }

    // Mean Reciprocal Rank
    const firstRelevantIndex = retrievedIds.findIndex((id) => relevantSet.has(id));
    const mrr = firstRelevantIndex >= 0 ? 1 / (firstRelevantIndex + 1) : 0;

    return { precisionAtK, recallAtK, mrr };
  }

  /**
   * Calculate generation metrics (Groundedness, Key Facts, Hallucination)
   */
  private calculateGenerationMetrics(
    response: string,
    query: GoldenQuery,
    contextChunks: string[]
  ): GenerationMetrics {
    const responseLower = response.toLowerCase();

    // Check key facts coverage
    const keyFactsCovered =
      query.keyFacts.length > 0
        ? query.keyFacts.filter((fact) => responseLower.includes(fact.toLowerCase()))
            .length / query.keyFacts.length
        : 1;

    // Check forbidden content (hallucination indicator)
    const hallucinationDetected = query.forbiddenContent.some((content) =>
      responseLower.includes(content.toLowerCase())
    );

    // Simple groundedness check
    const contextText = contextChunks.join(' ').toLowerCase();
    const responseSentences = response
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 20);
    const groundedSentences = responseSentences.filter((sentence) =>
      this.isGroundedInContext(sentence, contextText)
    );
    const groundedness =
      responseSentences.length > 0
        ? groundedSentences.length / responseSentences.length
        : 1;

    // Answer relevance: keyword overlap with query
    const queryWords = new Set(
      query.query
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3)
    );
    const responseWords = response.toLowerCase().split(/\s+/);
    const overlap = responseWords.filter((w) => queryWords.has(w)).length;
    const answerRelevance = Math.min(1, overlap / Math.max(queryWords.size, 1));

    return {
      groundedness,
      answerRelevance,
      keyFactsCovered,
      hallucinationDetected,
    };
  }

  /**
   * Check if a sentence is grounded in the context
   */
  private isGroundedInContext(sentence: string, context: string): boolean {
    const words = sentence
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 4);
    if (words.length === 0) return true;

    const matchCount = words.filter((w) => context.includes(w)).length;
    return matchCount >= words.length * 0.5;
  }

  /**
   * Calculate aggregate metrics
   */
  private calculateAggregates(
    results: QueryEvaluationResult[],
    queries: GoldenQuery[]
  ): {
    avgPrecisionAt5: number;
    avgRecallAt20: number;
    avgGroundedness: number;
    avgLatencyMs: number;
    byCategory: Record<QueryCategory, CategoryMetrics>;
  } {
    const queryMap = new Map(queries.map((q) => [q.id, q]));

    let totalP5 = 0,
      totalR20 = 0,
      totalG = 0,
      totalL = 0;

    const byCategory: Record<
      QueryCategory,
      { count: number; p5: number; r20: number; g: number; l: number }
    > = {
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
    const byCategoryAvg: Record<QueryCategory, CategoryMetrics> = {} as Record<
      QueryCategory,
      CategoryMetrics
    >;
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

  /**
   * Save individual query result
   */
  private async saveQueryResult(
    runId: string,
    queryId: string,
    result: QueryEvaluationResult
  ): Promise<void> {
    await databaseService.query(
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

  /**
   * Mark run as failed
   */
  private async markRunFailed(runId: string, error: string): Promise<void> {
    await databaseService.query(
      `UPDATE evaluation_runs SET status = 'failed', error_message = $2 WHERE id = $1`,
      [runId, error]
    );
  }

  /**
   * Map database row to EvaluationRun
   */
  private mapToEvaluationRun(row: Record<string, unknown>): EvaluationRun {
    return {
      id: row.id as string,
      version: row.version as string,
      config: row.config as EvaluationConfig,
      avgPrecisionAt5: parseFloat(row.avg_precision_at_5 as string) || 0,
      avgRecallAt20: parseFloat(row.avg_recall_at_20 as string) || 0,
      avgGroundedness: parseFloat(row.avg_groundedness as string) || 0,
      avgLatencyMs: (row.avg_latency_ms as number) || 0,
      metricsByCategory:
        (row.metrics_by_category as Record<QueryCategory, CategoryMetrics>) || {},
      status: row.status as EvaluationStatus,
      startedAt: row.started_at ? new Date(row.started_at as string) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at as string) : undefined,
      errorMessage: row.error_message as string | undefined,
      createdBy: row.created_by as string | undefined,
      createdAt: new Date(row.created_at as string),
    };
  }
}

// Export singleton instance
export const evaluationService = new EvaluationService();
export default evaluationService;
