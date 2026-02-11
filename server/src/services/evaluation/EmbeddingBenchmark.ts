/**
 * EmbeddingBenchmark - Compare embedding models for RAG
 * Benchmarks different embedding models on the golden dataset
 * Part of: Spec 1 - Foundation (Phase 0)
 */

import { embeddingService } from '../EmbeddingService.js';
import { vectorService } from '../VectorService.js';
import { goldenDatasetService } from './GoldenDatasetService.js';
import { databaseService } from '../DatabaseService.js';
import type { GoldenQuery } from '../../types/evaluation.js';

export interface EmbeddingBenchmarkResult {
  modelName: string;

  // Quality metrics
  avgPrecisionAt5: number;
  avgRecallAt20: number;
  avgMRR: number;

  // Performance metrics
  avgEmbeddingLatencyMs: number;
  totalEmbeddingTimeMs: number;

  // Model info
  dimensions: number;

  // Details
  queryCount: number;
  timestamp: Date;
}

export interface BenchmarkProgress {
  model: string;
  currentQuery: number;
  totalQueries: number;
  phase: 'embedding' | 'search' | 'complete';
}

interface SearchResultItem {
  chunk: {
    documentId: string;
    chunkIndex: number;
  };
  score: number;
}

export class EmbeddingBenchmark {
  // Candidate models to benchmark (must be available in Ollama)
  private candidateModels = [
    'nomic-embed-text-v2-moe', // 768 dims, multilingual MoE, state-of-the-art
    'mxbai-embed-large',     // 1024 dims, high quality
    'all-minilm',            // 384 dims, fast
  ];

  private progressCallback?: (progress: BenchmarkProgress) => void;

  /**
   * Set progress callback for real-time updates
   */
  onProgress(callback: (progress: BenchmarkProgress) => void): void {
    this.progressCallback = callback;
  }

  /**
   * Run benchmark on all candidate models
   */
  async runBenchmark(models?: string[]): Promise<EmbeddingBenchmarkResult[]> {
    const modelsToTest = models || this.candidateModels;
    const results: EmbeddingBenchmarkResult[] = [];

    // Get golden dataset
    const dataset = await goldenDatasetService.getDataset();

    if (dataset.queries.length === 0) {
      throw new Error('Golden dataset is empty. Please add queries before running benchmark.');
    }

    console.log(`📊 Starting embedding benchmark with ${dataset.queries.length} queries`);
    console.log(`   Models to test: ${modelsToTest.join(', ')}`);

    for (const model of modelsToTest) {
      console.log(`\n🔄 Benchmarking model: ${model}`);

      try {
        // Check if model is available
        const isAvailable = await this.checkModelAvailable(model);
        if (!isAvailable) {
          console.log(`   ⚠️ Model ${model} not available, skipping`);
          continue;
        }

        const result = await this.benchmarkModel(model, dataset.queries);
        results.push(result);

        console.log(`   ✓ P@5: ${(result.avgPrecisionAt5 * 100).toFixed(1)}%`);
        console.log(`   ✓ R@20: ${(result.avgRecallAt20 * 100).toFixed(1)}%`);
        console.log(`   ✓ MRR: ${result.avgMRR.toFixed(3)}`);
        console.log(`   ✓ Avg latency: ${result.avgEmbeddingLatencyMs.toFixed(0)}ms`);
      } catch (error) {
        console.error(`   ✗ Failed to benchmark ${model}:`, error);
      }
    }

    // Sort by precision (best first)
    results.sort((a, b) => b.avgPrecisionAt5 - a.avgPrecisionAt5);

    // Save results to database
    await this.saveBenchmarkResults(results);

    return results;
  }

  /**
   * Benchmark a single model
   */
  private async benchmarkModel(
    modelName: string,
    queries: GoldenQuery[]
  ): Promise<EmbeddingBenchmarkResult> {
    const embeddingLatencies: number[] = [];
    let totalP5 = 0;
    let totalR20 = 0;
    let totalMRR = 0;
    let dimensions = 0;

    const totalStartTime = Date.now();

    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      if (!query) continue;

      // Report progress
      this.reportProgress({
        model: modelName,
        currentQuery: i + 1,
        totalQueries: queries.length,
        phase: 'embedding',
      });

      // Generate embedding and measure latency
      const embeddingStart = Date.now();
      const embeddingResponse = await embeddingService.generateEmbedding(query.query, modelName);
      const embeddingLatency = Date.now() - embeddingStart;

      embeddingLatencies.push(embeddingLatency);
      dimensions = embeddingResponse.dimensions;

      // Report search phase
      this.reportProgress({
        model: modelName,
        currentQuery: i + 1,
        totalQueries: queries.length,
        phase: 'search',
      });

      // Search using the standard search method
      // Note: This will regenerate the embedding with the default model,
      // but we're measuring embedding latency separately
      const searchResponse = await vectorService.search({
        query: query.query,
        limit: 20,
        threshold: 0.0, // Get all results for metrics calculation
        hybridAlpha: 0.5,
      });

      const searchResults: SearchResultItem[] = searchResponse.results;
      const relevantSet = new Set(query.relevantChunkIds || []);

      // Precision@5
      const top5 = searchResults.slice(0, 5);
      const relevantIn5 = top5.filter((r: SearchResultItem) =>
        relevantSet.has(`${r.chunk.documentId}:${r.chunk.chunkIndex}`)
      ).length;
      totalP5 += top5.length > 0 ? relevantIn5 / 5 : 0;

      // Recall@20
      const relevantIn20 = searchResults.filter((r: SearchResultItem) =>
        relevantSet.has(`${r.chunk.documentId}:${r.chunk.chunkIndex}`)
      ).length;
      totalR20 += relevantSet.size > 0 ? relevantIn20 / relevantSet.size : 0;

      // MRR (Mean Reciprocal Rank)
      const firstRelevantIndex = searchResults.findIndex((r: SearchResultItem) =>
        relevantSet.has(`${r.chunk.documentId}:${r.chunk.chunkIndex}`)
      );
      totalMRR += firstRelevantIndex >= 0 ? 1 / (firstRelevantIndex + 1) : 0;
    }

    const totalTime = Date.now() - totalStartTime;
    const n = queries.length;

    // Report complete
    this.reportProgress({
      model: modelName,
      currentQuery: n,
      totalQueries: n,
      phase: 'complete',
    });

    return {
      modelName,
      avgPrecisionAt5: n > 0 ? totalP5 / n : 0,
      avgRecallAt20: n > 0 ? totalR20 / n : 0,
      avgMRR: n > 0 ? totalMRR / n : 0,
      avgEmbeddingLatencyMs:
        embeddingLatencies.length > 0
          ? embeddingLatencies.reduce((a, b) => a + b, 0) / embeddingLatencies.length
          : 0,
      totalEmbeddingTimeMs: totalTime,
      dimensions,
      queryCount: n,
      timestamp: new Date(),
    };
  }

  /**
   * Check if a model is available in Ollama
   */
  private async checkModelAvailable(model: string): Promise<boolean> {
    try {
      // Try to generate a test embedding
      await embeddingService.generateEmbedding('test', model);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Save benchmark results to database
   */
  private async saveBenchmarkResults(results: EmbeddingBenchmarkResult[]): Promise<void> {
    for (const result of results) {
      await databaseService.query(
        `INSERT INTO evaluation_runs (version, config, status, completed_at,
         avg_precision_at_5, avg_recall_at_20, avg_latency_ms, metrics_by_category)
         VALUES ($1, $2, 'completed', NOW(), $3, $4, $5, $6)`,
        [
          `embedding-benchmark-${result.modelName}`,
          JSON.stringify({
            type: 'embedding_benchmark',
            model: result.modelName,
            dimensions: result.dimensions,
            queryCount: result.queryCount,
          }),
          result.avgPrecisionAt5,
          result.avgRecallAt20,
          Math.round(result.avgEmbeddingLatencyMs),
          JSON.stringify({
            mrr: result.avgMRR,
            totalTimeMs: result.totalEmbeddingTimeMs,
          }),
        ]
      );
    }
  }

  /**
   * Get benchmark history
   */
  async getBenchmarkHistory(): Promise<EmbeddingBenchmarkResult[]> {
    const result = await databaseService.query(
      `SELECT * FROM evaluation_runs
       WHERE version LIKE 'embedding-benchmark-%'
       ORDER BY completed_at DESC
       LIMIT 50`
    );

    return result.rows.map((row: Record<string, unknown>) => {
      const config = row.config as { model: string; dimensions: number; queryCount: number };
      const metrics = row.metrics_by_category as { mrr: number; totalTimeMs: number } | null;

      return {
        modelName: config.model,
        avgPrecisionAt5: parseFloat(row.avg_precision_at_5 as string) || 0,
        avgRecallAt20: parseFloat(row.avg_recall_at_20 as string) || 0,
        avgMRR: metrics?.mrr || 0,
        avgEmbeddingLatencyMs: (row.avg_latency_ms as number) || 0,
        totalEmbeddingTimeMs: metrics?.totalTimeMs || 0,
        dimensions: config.dimensions,
        queryCount: config.queryCount,
        timestamp: new Date(row.completed_at as string),
      };
    });
  }

  /**
   * Get recommendation based on benchmark results
   */
  getRecommendation(results: EmbeddingBenchmarkResult[]): {
    recommended: string;
    reason: string;
    comparison: string;
  } {
    if (results.length === 0) {
      return {
        recommended: 'nomic-embed-text-v2-moe',
        reason: 'Default model (no benchmark data available)',
        comparison: '',
      };
    }

    // Best by precision
    const bestByPrecision = results[0];
    if (!bestByPrecision) {
      return {
        recommended: 'nomic-embed-text-v2-moe',
        reason: 'Default model (no valid benchmark data)',
        comparison: '',
      };
    }

    // Best by latency (among models with decent precision)
    const decentModels = results.filter(
      r => r.avgPrecisionAt5 >= bestByPrecision.avgPrecisionAt5 * 0.9
    );
    const sortedByLatency = [...decentModels].sort(
      (a, b) => a.avgEmbeddingLatencyMs - b.avgEmbeddingLatencyMs
    );
    const bestByLatency = sortedByLatency[0];

    // Build comparison table
    const comparison = results
      .map(r =>
        `${r.modelName}: P@5=${(r.avgPrecisionAt5 * 100).toFixed(1)}%, ` +
        `MRR=${r.avgMRR.toFixed(3)}, ${r.avgEmbeddingLatencyMs.toFixed(0)}ms`
      )
      .join('\n');

    if (!bestByLatency) {
      return {
        recommended: bestByPrecision.modelName,
        reason: `Best precision (${(bestByPrecision.avgPrecisionAt5 * 100).toFixed(1)}%)`,
        comparison,
      };
    }

    // Recommend based on balance
    if (bestByPrecision.modelName === bestByLatency.modelName) {
      return {
        recommended: bestByPrecision.modelName,
        reason: 'Best precision AND best latency',
        comparison,
      };
    }

    // If latency difference is small, prefer precision
    const latencyDiff = bestByPrecision.avgEmbeddingLatencyMs - bestByLatency.avgEmbeddingLatencyMs;
    if (latencyDiff < 50) {
      return {
        recommended: bestByPrecision.modelName,
        reason: `Best precision (${(bestByPrecision.avgPrecisionAt5 * 100).toFixed(1)}%) with acceptable latency`,
        comparison,
      };
    }

    // Otherwise recommend by precision
    return {
      recommended: bestByPrecision.modelName,
      reason: `Best precision (${(bestByPrecision.avgPrecisionAt5 * 100).toFixed(1)}%), but ${latencyDiff.toFixed(0)}ms slower than ${bestByLatency.modelName}`,
      comparison,
    };
  }

  /**
   * Report progress to callback
   */
  private reportProgress(progress: BenchmarkProgress): void {
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
  }
}

// Export singleton instance
export const embeddingBenchmark = new EmbeddingBenchmark();
export default embeddingBenchmark;
