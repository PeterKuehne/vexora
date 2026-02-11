/**
 * Run V1+Rerank Evaluation
 * Phase 1 - Compare baseline vs reranking
 *
 * Usage: npx tsx src/scripts/run-rerank-evaluation.ts
 */

import { evaluationService, goldenDatasetService } from '../services/evaluation/index.js';
import { databaseService } from '../services/DatabaseService.js';
import { rerankerService } from '../services/rag/RerankerService.js';

async function runRerankEvaluation() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  RAG V1+RERANK EVALUATION');
  console.log('  Phase 1 - Reranking Comparison');
  console.log('═══════════════════════════════════════════════════════════════\n');

  try {
    // Initialize database
    console.log('🔌 Initializing database connection...');
    await databaseService.initialize();

    // Check golden dataset
    console.log('\n📊 Checking Golden Dataset...');
    const dataset = await goldenDatasetService.getDataset();
    console.log(`   Total queries: ${dataset.queries.length}`);

    // Check and initialize reranker service
    console.log('\n🔄 Initializing Reranker Service...');
    try {
      await rerankerService.initialize();
      const healthResponse = await fetch('http://192.168.178.23:8001/health');
      const health = await healthResponse.json();
      console.log(`   Status: ${health.status}`);
      console.log(`   Model: ${health.model}`);
      console.log(`   Ready: ${health.ready}`);
      console.log(`   Service Available: ${rerankerService.isAvailable()}`);

      if (!health.ready || !rerankerService.isAvailable()) {
        throw new Error('Reranker not ready');
      }
    } catch (error) {
      console.error('❌ Reranker service not available!');
      console.error('   Make sure it is running at http://192.168.178.23:8001');
      console.error('   Error:', error);
      process.exit(1);
    }

    // Run V1+Rerank Evaluation
    console.log('\n' + '─'.repeat(60));
    console.log('📈 STARTING V1+RERANK EVALUATION');
    console.log('─'.repeat(60));

    const v1RerankConfig = {
      ragConfig: {
        embeddingModel: 'nomic-embed-text-v2-moe',
        rerankerEnabled: true,
        rerankerModel: 'BAAI/bge-reranker-v2-m3',
        searchLimit: 20,  // Fetch more, then rerank
        searchThreshold: 0.1,  // Lower threshold to get more results for reranking
        hybridAlpha: 0.5,
      },
      evaluateGeneration: true,
    };

    console.log('\n📋 Configuration:');
    console.log(`   Embedding Model: ${v1RerankConfig.ragConfig.embeddingModel}`);
    console.log(`   Reranker: ENABLED ✅`);
    console.log(`   Reranker Model: ${v1RerankConfig.ragConfig.rerankerModel}`);
    console.log(`   Search Limit: ${v1RerankConfig.ragConfig.searchLimit}`);
    console.log(`   Search Threshold: ${v1RerankConfig.ragConfig.searchThreshold}`);
    console.log(`   Hybrid Alpha: ${v1RerankConfig.ragConfig.hybridAlpha}`);

    const runId = await evaluationService.startEvaluation(v1RerankConfig, undefined);
    console.log(`\n✅ Evaluation started with ID: ${runId}`);

    // Poll for completion
    console.log('\n⏳ Waiting for evaluation to complete...');
    console.log('   (This may take 30-60 minutes for 85 queries)\n');

    let status = await evaluationService.getRunStatus(runId);
    let lastProgress = 0;
    let dots = 0;

    while (status && status.status === 'running') {
      await new Promise(resolve => setTimeout(resolve, 5000));
      status = await evaluationService.getRunStatus(runId);

      // Show progress
      dots = (dots + 1) % 4;
      process.stdout.write(`\r   Processing${'.'.repeat(dots)}${' '.repeat(3-dots)}   `);
    }
    console.log('\n');

    if (!status) {
      throw new Error('Failed to get evaluation status');
    }

    if (status.status === 'failed') {
      throw new Error(`Evaluation failed: ${status.errorMessage}`);
    }

    // Get baseline metrics for comparison
    console.log('─'.repeat(60));
    console.log('📊 FETCHING BASELINE METRICS FOR COMPARISON');
    console.log('─'.repeat(60));

    const baselineResult = await databaseService.query(
      `SELECT avg_precision_at_5, avg_recall_at_20, avg_groundedness, avg_latency_ms
       FROM evaluation_runs
       WHERE config->'ragConfig'->>'rerankerEnabled' = 'false'
         OR config->'ragConfig'->>'rerankerEnabled' IS NULL
         OR config->'ragConfig'->'rerankerEnabled' = 'false'::jsonb
       ORDER BY started_at DESC
       LIMIT 1`
    );

    let baseline = {
      precision: 0.118,  // Default from our earlier run
      recall: 0.482,
      groundedness: 0.269,
      latency: 64533
    };

    if (baselineResult.rows.length > 0) {
      const row = baselineResult.rows[0];
      baseline = {
        precision: parseFloat(row.avg_precision_at_5) || 0.118,
        recall: parseFloat(row.avg_recall_at_20) || 0.482,
        groundedness: parseFloat(row.avg_groundedness) || 0.269,
        latency: parseFloat(row.avg_latency_ms) || 64533
      };
    }

    // Display comparison
    console.log('\n' + '─'.repeat(60));
    console.log('📊 V1 vs V1+RERANK COMPARISON');
    console.log('─'.repeat(60));

    const rerankMetrics = {
      precision: status.avgPrecisionAt5 || 0,
      recall: status.avgRecallAt20 || 0,
      groundedness: status.avgGroundedness || 0,
      latency: status.avgLatencyMs || 0
    };

    const precisionImprovement = ((rerankMetrics.precision - baseline.precision) / baseline.precision * 100);
    const recallImprovement = ((rerankMetrics.recall - baseline.recall) / baseline.recall * 100);
    const groundednessImprovement = ((rerankMetrics.groundedness - baseline.groundedness) / baseline.groundedness * 100);
    const latencyIncrease = rerankMetrics.latency - baseline.latency;

    console.log('\n┌─────────────────────┬───────────┬───────────┬────────────┐');
    console.log('│ Metric              │ V1 Base   │ V1+Rerank │ Change     │');
    console.log('├─────────────────────┼───────────┼───────────┼────────────┤');
    console.log(`│ Precision@5         │ ${(baseline.precision * 100).toFixed(1).padStart(6)}%   │ ${(rerankMetrics.precision * 100).toFixed(1).padStart(6)}%   │ ${precisionImprovement >= 0 ? '+' : ''}${precisionImprovement.toFixed(1).padStart(5)}%    │`);
    console.log(`│ Recall@20           │ ${(baseline.recall * 100).toFixed(1).padStart(6)}%   │ ${(rerankMetrics.recall * 100).toFixed(1).padStart(6)}%   │ ${recallImprovement >= 0 ? '+' : ''}${recallImprovement.toFixed(1).padStart(5)}%    │`);
    console.log(`│ Groundedness        │ ${(baseline.groundedness * 100).toFixed(1).padStart(6)}%   │ ${(rerankMetrics.groundedness * 100).toFixed(1).padStart(6)}%   │ ${groundednessImprovement >= 0 ? '+' : ''}${groundednessImprovement.toFixed(1).padStart(5)}%    │`);
    console.log(`│ Latency (ms)        │ ${baseline.latency.toFixed(0).padStart(7)}   │ ${rerankMetrics.latency.toFixed(0).padStart(7)}   │ ${latencyIncrease >= 0 ? '+' : ''}${latencyIncrease.toFixed(0).padStart(5)}ms   │`);
    console.log('└─────────────────────┴───────────┴───────────┴────────────┘');

    // Summary
    console.log('\n' + '═'.repeat(60));
    if (precisionImprovement >= 15) {
      console.log('  ✅ SUCCESS: Precision@5 improved by ≥15% (Target met!)');
    } else if (precisionImprovement > 0) {
      console.log(`  ⚠️  Precision@5 improved by ${precisionImprovement.toFixed(1)}% (Target: ≥15%)`);
    } else {
      console.log('  ❌ Precision@5 did not improve');
    }

    if (latencyIncrease <= 500) {
      console.log('  ✅ Latency increase within acceptable range (<500ms)');
    } else {
      console.log(`  ⚠️  Latency increased by ${latencyIncrease.toFixed(0)}ms (Target: <500ms)`);
    }
    console.log('═'.repeat(60));

    console.log('\n📄 Full results saved to evaluation_runs table');
    console.log(`   Run ID: ${runId}`);

  } catch (error) {
    console.error('\n❌ Evaluation failed:', error);
    process.exit(1);
  } finally {
    try {
      await databaseService.close();
    } catch {
      // Ignore cleanup errors
    }
    process.exit(0);
  }
}

// Run the evaluation
runRerankEvaluation();
