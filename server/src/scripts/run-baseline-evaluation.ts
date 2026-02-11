/**
 * Run V1 Baseline Evaluation
 * Phase 0 - Foundation Spec
 *
 * This script runs the baseline evaluation to establish V1 metrics
 * before implementing RAG V2 improvements.
 *
 * Usage: npx tsx src/scripts/run-baseline-evaluation.ts
 */

import { evaluationService, embeddingBenchmark, goldenDatasetService } from '../services/evaluation/index.js';
import { databaseService } from '../services/DatabaseService.js';

async function runBaselineEvaluation() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  RAG V1 BASELINE EVALUATION');
  console.log('  Phase 0 - Foundation Spec');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    // Initialize database
    console.log('🔌 Initializing database connection...');
    await databaseService.initialize();

    // Check golden dataset
    console.log('\n📊 Checking Golden Dataset...');
    const dataset = await goldenDatasetService.getDataset();
    console.log(`   Total queries: ${dataset.total}`);
    console.log('   By category:');
    Object.entries(dataset.statistics.byCategory).forEach(([cat, count]) => {
      console.log(`     - ${cat}: ${count}`);
    });
    console.log(`   By language:`, dataset.statistics.byLanguage);

    if (dataset.total < 50) {
      console.warn('\n⚠️  Warning: Golden dataset has fewer than 50 queries.');
      console.warn('   Recommended: 85+ queries for reliable baseline metrics.\n');
    }

    // Run V1 Baseline Evaluation
    console.log('\n' + '─'.repeat(60));
    console.log('📈 STARTING V1 BASELINE EVALUATION');
    console.log('─'.repeat(60));

    const v1Config = {
      ragConfig: {
        embeddingModel: 'nomic-embed-text-v2-moe',
        rerankerEnabled: false,
        searchLimit: 20,
        searchThreshold: 0.1,  // Lower threshold to get more results
        hybridAlpha: 0.5,
      },
      evaluateGeneration: true,
    };

    console.log('\n📋 Configuration:');
    console.log(`   Embedding Model: ${v1Config.ragConfig.embeddingModel}`);
    console.log(`   Reranker: ${v1Config.ragConfig.rerankerEnabled ? 'Enabled' : 'Disabled'}`);
    console.log(`   Search Limit: ${v1Config.ragConfig.searchLimit}`);
    console.log(`   Search Threshold: ${v1Config.ragConfig.searchThreshold}`);
    console.log(`   Hybrid Alpha: ${v1Config.ragConfig.hybridAlpha}`);
    console.log(`   Generation Eval: ${v1Config.evaluateGeneration}\n`);

    const runId = await evaluationService.startEvaluation(v1Config, undefined);
    console.log(`✅ Evaluation started with ID: ${runId}`);

    // Poll for completion
    console.log('\n⏳ Waiting for evaluation to complete...');
    let status = await evaluationService.getRunStatus(runId);
    let lastProgress = 0;

    while (status && status.status === 'running') {
      await new Promise(resolve => setTimeout(resolve, 2000));
      status = await evaluationService.getRunStatus(runId);
      if (status && status.progress !== lastProgress) {
        lastProgress = status.progress;
        process.stdout.write(`\r   Progress: ${status.progress}%`);
      }
    }
    console.log('\n');

    if (!status) {
      throw new Error('Failed to get evaluation status');
    }

    if (status.status === 'failed') {
      throw new Error(`Evaluation failed: ${status.errorMessage}`);
    }

    // Display results
    console.log('─'.repeat(60));
    console.log('📊 V1 BASELINE RESULTS');
    console.log('─'.repeat(60));

    if (status.retrievalMetrics) {
      console.log('\n🔍 Retrieval Metrics:');
      console.log(`   Precision@5:  ${(status.retrievalMetrics.precisionAt5 * 100).toFixed(2)}%`);
      console.log(`   Precision@10: ${(status.retrievalMetrics.precisionAt10 * 100).toFixed(2)}%`);
      console.log(`   Recall@5:     ${(status.retrievalMetrics.recallAt5 * 100).toFixed(2)}%`);
      console.log(`   Recall@10:    ${(status.retrievalMetrics.recallAt10 * 100).toFixed(2)}%`);
      console.log(`   MRR:          ${status.retrievalMetrics.mrr.toFixed(4)}`);
      console.log(`   Latency Avg:  ${status.retrievalMetrics.latencyP50.toFixed(0)}ms`);
      console.log(`   Latency P95:  ${status.retrievalMetrics.latencyP95.toFixed(0)}ms`);
    }

    if (status.generationMetrics) {
      console.log('\n📝 Generation Metrics:');
      console.log(`   Groundedness:  ${(status.generationMetrics.groundedness * 100).toFixed(2)}%`);
      console.log(`   Relevance:     ${(status.generationMetrics.relevance * 100).toFixed(2)}%`);
      console.log(`   Completeness:  ${(status.generationMetrics.completeness * 100).toFixed(2)}%`);
      console.log(`   Latency Avg:   ${status.generationMetrics.latencyAvg.toFixed(0)}ms`);
    }

    // Run Embedding Benchmark
    console.log('\n' + '─'.repeat(60));
    console.log('🧪 RUNNING EMBEDDING BENCHMARK');
    console.log('─'.repeat(60));

    const benchmarkModels = ['nomic-embed-text-v2-moe', 'mxbai-embed-large', 'all-minilm'];
    console.log(`\n📋 Testing models: ${benchmarkModels.join(', ')}`);
    console.log('   This may take a few minutes...\n');

    try {
      const benchmarkResults = await embeddingBenchmark.runBenchmark(benchmarkModels);

      console.log('📊 Benchmark Results:\n');
      console.log('┌─────────────────────────┬────────────┬────────────┬────────────┐');
      console.log('│ Model                   │ Precision  │ Recall     │ Latency    │');
      console.log('├─────────────────────────┼────────────┼────────────┼────────────┤');

      for (const result of benchmarkResults.results) {
        const name = result.modelName.padEnd(23);
        const precision = `${(result.averagePrecision * 100).toFixed(1)}%`.padStart(10);
        const recall = `${(result.averageRecall * 100).toFixed(1)}%`.padStart(10);
        const latency = `${result.avgLatencyMs.toFixed(0)}ms`.padStart(10);
        console.log(`│ ${name} │${precision} │${recall} │${latency} │`);
      }
      console.log('└─────────────────────────┴────────────┴────────────┴────────────┘');

      // Get recommendation
      const history = await embeddingBenchmark.getBenchmarkHistory();
      const recommendation = embeddingBenchmark.getRecommendation(history);

      if (recommendation) {
        console.log(`\n💡 Recommendation: ${recommendation.recommendedModel}`);
        console.log(`   Reason: ${recommendation.reason}`);
      }
    } catch (benchmarkError) {
      console.error('⚠️  Embedding benchmark failed:', benchmarkError);
      console.log('   Skipping benchmark - continuing with baseline documentation.\n');
    }

    // Save baseline summary
    console.log('\n' + '─'.repeat(60));
    console.log('📝 BASELINE SUMMARY');
    console.log('─'.repeat(60));

    const baselineSummary = {
      timestamp: new Date().toISOString(),
      evaluationRunId: runId,
      ragVersion: 'V1',
      config: v1Config,
      metrics: {
        retrieval: status.retrievalMetrics,
        generation: status.generationMetrics,
      },
      goldenDatasetSize: dataset.total,
    };

    console.log('\n📄 Baseline Summary (save this for comparison):');
    console.log(JSON.stringify(baselineSummary, null, 2));

    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('  ✅ V1 BASELINE EVALUATION COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('\n  Next Steps:');
    console.log('  1. Document these baseline metrics');
    console.log('  2. Proceed to Phase 1: Reranking Implementation');
    console.log('  3. After Phase 1, run evaluation again to measure improvement\n');

  } catch (error) {
    console.error('\n❌ Evaluation failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    try {
      await databaseService.close();
    } catch {
      // Ignore cleanup errors
    }
    process.exit(0);
  }
}

// Run the evaluation
runBaselineEvaluation();
