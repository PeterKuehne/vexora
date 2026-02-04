/**
 * V2 Evaluation Script - RAG V2 Phase 2
 *
 * Tests semantic chunking performance against the golden dataset.
 * Measures Recall@K for V1 vs V2 chunking.
 *
 * Usage: npx tsx server/src/scripts/run-v2-evaluation.ts
 */

import { databaseService } from '../services/DatabaseService.js';
import { vectorService } from '../services/VectorService.js';
import { vectorServiceV2 } from '../services/VectorServiceV2.js';
import { rerankerService } from '../services/rag/RerankerService.js';

// ============================================
// Types
// ============================================

interface GoldenDatasetEntry {
  id: string;
  query: string;
  relevantDocumentIds: string[];
  relevantChunkContent?: string[];
}

interface EvaluationResult {
  query: string;
  relevantDocs: number;
  v1Results: {
    foundDocs: number;
    recallAt5: number;
    recallAt10: number;
    recallAt20: number;
  };
  v2Results: {
    foundDocs: number;
    recallAt5: number;
    recallAt10: number;
    recallAt20: number;
  };
  v2WithRerank?: {
    foundDocs: number;
    recallAt5: number;
    recallAt10: number;
    recallAt20: number;
  };
}

// ============================================
// Golden Dataset (Example - replace with actual dataset)
// ============================================

async function loadGoldenDataset(): Promise<GoldenDatasetEntry[]> {
  try {
    const result = await databaseService.query(`
      SELECT id, query, relevant_document_ids, key_facts
      FROM golden_dataset
      ORDER BY id
    `);

    if (result.rows.length === 0) {
      throw new Error('No queries in golden dataset');
    }

    return result.rows.map((row) => ({
      id: row.id,
      query: row.query,
      relevantDocumentIds: row.relevant_document_ids || [],
      relevantChunkContent: row.key_facts || [],
    }));
  } catch (error) {
    console.log('⚠️  Golden dataset table not found, using example data');

    // Example golden dataset for testing
    return [
      {
        id: '1',
        query: 'Was sind die Hauptziele des Projekts?',
        relevantDocumentIds: [],
        relevantChunkContent: ['Projekt', 'Ziel', 'Hauptziel'],
      },
      {
        id: '2',
        query: 'Wie funktioniert die Authentifizierung?',
        relevantDocumentIds: [],
        relevantChunkContent: ['Authentifizierung', 'Login', 'Benutzer'],
      },
      {
        id: '3',
        query: 'Welche Sicherheitsmaßnahmen gibt es?',
        relevantDocumentIds: [],
        relevantChunkContent: ['Sicherheit', 'Verschlüsselung', 'Schutz'],
      },
    ];
  }
}

// ============================================
// Evaluation Logic
// ============================================

function calculateRecall(
  foundDocIds: string[],
  relevantDocIds: string[],
  k: number
): number {
  if (relevantDocIds.length === 0) {
    return 1.0; // No relevant docs means perfect recall
  }

  const topKFound = new Set(foundDocIds.slice(0, k));
  const relevantFound = relevantDocIds.filter((id) => topKFound.has(id));

  return relevantFound.length / relevantDocIds.length;
}

function calculateContentRecall(
  foundContent: string[],
  relevantKeywords: string[],
  k: number
): number {
  if (relevantKeywords.length === 0) {
    return 1.0;
  }

  const topKContent = foundContent.slice(0, k).join(' ').toLowerCase();
  const keywordsFound = relevantKeywords.filter((kw) =>
    topKContent.includes(kw.toLowerCase())
  );

  return keywordsFound.length / relevantKeywords.length;
}

async function evaluateQuery(
  entry: GoldenDatasetEntry
): Promise<EvaluationResult> {
  // V1 Search
  const v1Results = await vectorService.search({
    query: entry.query,
    limit: 20,
    threshold: 0,
    hybridAlpha: 0.5,
  });

  const v1DocIds = v1Results.results.map((r) => r.document.id);
  const v1Content = v1Results.results.map((r) => r.chunk.content);

  // V2 Search
  let v2DocIds: string[] = [];
  let v2Content: string[] = [];

  try {
    const v2Results = await vectorServiceV2.search({
      query: entry.query,
      limit: 20,
      threshold: 0,
      hybridAlpha: 0.5,
      levelFilter: [2], // Paragraph level
    });

    v2DocIds = v2Results.results.map((r) => r.document.id);
    v2Content = v2Results.results.map((r) => r.chunk.content);
  } catch (error) {
    console.log(`  ⚠️  V2 search failed for: ${entry.query}`);
  }

  // Calculate metrics
  const useContentRecall = entry.relevantDocumentIds.length === 0;
  const relevantDocIds = entry.relevantDocumentIds;
  const relevantKeywords = entry.relevantChunkContent || [];

  const result: EvaluationResult = {
    query: entry.query,
    relevantDocs: relevantDocIds.length || relevantKeywords.length,
    v1Results: {
      foundDocs: v1DocIds.length,
      recallAt5: useContentRecall
        ? calculateContentRecall(v1Content, relevantKeywords, 5)
        : calculateRecall(v1DocIds, relevantDocIds, 5),
      recallAt10: useContentRecall
        ? calculateContentRecall(v1Content, relevantKeywords, 10)
        : calculateRecall(v1DocIds, relevantDocIds, 10),
      recallAt20: useContentRecall
        ? calculateContentRecall(v1Content, relevantKeywords, 20)
        : calculateRecall(v1DocIds, relevantDocIds, 20),
    },
    v2Results: {
      foundDocs: v2DocIds.length,
      recallAt5: useContentRecall
        ? calculateContentRecall(v2Content, relevantKeywords, 5)
        : calculateRecall(v2DocIds, relevantDocIds, 5),
      recallAt10: useContentRecall
        ? calculateContentRecall(v2Content, relevantKeywords, 10)
        : calculateRecall(v2DocIds, relevantDocIds, 10),
      recallAt20: useContentRecall
        ? calculateContentRecall(v2Content, relevantKeywords, 20)
        : calculateRecall(v2DocIds, relevantDocIds, 20),
    },
  };

  // V2 + Reranking (if available)
  if (rerankerService.isAvailable() && v2Content.length > 0) {
    try {
      const chunks = v2Content.slice(0, 20).map((content, i) => ({
        id: `chunk-${i}`,
        content,
        score: 1 - i * 0.05,
        documentId: v2DocIds[i],
        chunkIndex: i,
      }));

      const reranked = await rerankerService.rerank(entry.query, chunks, 20);
      const rerankedDocIds = reranked.chunks.map((c) => c.documentId);
      const rerankedContent = reranked.chunks.map((c) => c.content);

      result.v2WithRerank = {
        foundDocs: rerankedDocIds.length,
        recallAt5: useContentRecall
          ? calculateContentRecall(rerankedContent, relevantKeywords, 5)
          : calculateRecall(rerankedDocIds, relevantDocIds, 5),
        recallAt10: useContentRecall
          ? calculateContentRecall(rerankedContent, relevantKeywords, 10)
          : calculateRecall(rerankedDocIds, relevantDocIds, 10),
        recallAt20: useContentRecall
          ? calculateContentRecall(rerankedContent, relevantKeywords, 20)
          : calculateRecall(rerankedDocIds, relevantDocIds, 20),
      };
    } catch (error) {
      console.log(`  ⚠️  Reranking failed for: ${entry.query}`);
    }
  }

  return result;
}

// ============================================
// Main
// ============================================

async function main() {
  console.log('╔════════════════════════════════════════════╗');
  console.log('║  RAG V2 Phase 2 - Evaluation               ║');
  console.log('║  Comparing V1 vs V2 Chunking               ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log('');

  try {
    // Initialize services
    console.log('🔧 Initializing services...');
    await databaseService.initialize();
    await vectorService.initialize();
    await vectorServiceV2.initialize();
    await rerankerService.initialize();
    console.log('✅ Services initialized');
    console.log(`   Reranker available: ${rerankerService.isAvailable()}`);

    // Load golden dataset
    console.log('\n📊 Loading golden dataset...');
    const goldenDataset = await loadGoldenDataset();
    console.log(`   Found ${goldenDataset.length} queries`);

    // Run evaluation
    console.log('\n🔍 Running evaluation...\n');
    const results: EvaluationResult[] = [];

    for (let i = 0; i < goldenDataset.length; i++) {
      const entry = goldenDataset[i];
      console.log(`[${i + 1}/${goldenDataset.length}] "${entry.query.substring(0, 50)}..."`);

      const result = await evaluateQuery(entry);
      results.push(result);

      console.log(`   V1 Recall@20: ${(result.v1Results.recallAt20 * 100).toFixed(1)}%`);
      console.log(`   V2 Recall@20: ${(result.v2Results.recallAt20 * 100).toFixed(1)}%`);
      if (result.v2WithRerank) {
        console.log(`   V2+Rerank Recall@20: ${(result.v2WithRerank.recallAt20 * 100).toFixed(1)}%`);
      }
    }

    // Calculate aggregates
    const avgV1Recall5 = results.reduce((sum, r) => sum + r.v1Results.recallAt5, 0) / results.length;
    const avgV1Recall10 = results.reduce((sum, r) => sum + r.v1Results.recallAt10, 0) / results.length;
    const avgV1Recall20 = results.reduce((sum, r) => sum + r.v1Results.recallAt20, 0) / results.length;

    const avgV2Recall5 = results.reduce((sum, r) => sum + r.v2Results.recallAt5, 0) / results.length;
    const avgV2Recall10 = results.reduce((sum, r) => sum + r.v2Results.recallAt10, 0) / results.length;
    const avgV2Recall20 = results.reduce((sum, r) => sum + r.v2Results.recallAt20, 0) / results.length;

    const hasRerank = results.some((r) => r.v2WithRerank);
    let avgV2RerankRecall5 = 0;
    let avgV2RerankRecall10 = 0;
    let avgV2RerankRecall20 = 0;

    if (hasRerank) {
      const rerankResults = results.filter((r) => r.v2WithRerank);
      avgV2RerankRecall5 = rerankResults.reduce((sum, r) => sum + r.v2WithRerank!.recallAt5, 0) / rerankResults.length;
      avgV2RerankRecall10 = rerankResults.reduce((sum, r) => sum + r.v2WithRerank!.recallAt10, 0) / rerankResults.length;
      avgV2RerankRecall20 = rerankResults.reduce((sum, r) => sum + r.v2WithRerank!.recallAt20, 0) / rerankResults.length;
    }

    // Print results
    console.log('\n');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                    EVALUATION RESULTS                      ║');
    console.log('╠════════════════════════════════════════════════════════════╣');
    console.log('║                                                            ║');
    console.log(`║  Total Queries: ${goldenDataset.length.toString().padStart(4)}                                      ║`);
    console.log('║                                                            ║');
    console.log('║  ┌────────────────┬──────────┬──────────┬──────────┐      ║');
    console.log('║  │ Metric         │ V1       │ V2       │ V2+Rerank│      ║');
    console.log('║  ├────────────────┼──────────┼──────────┼──────────┤      ║');
    console.log(`║  │ Recall@5       │ ${(avgV1Recall5 * 100).toFixed(1).padStart(6)}%  │ ${(avgV2Recall5 * 100).toFixed(1).padStart(6)}%  │ ${hasRerank ? (avgV2RerankRecall5 * 100).toFixed(1).padStart(6) + '%' : '  N/A   '}  │      ║`);
    console.log(`║  │ Recall@10      │ ${(avgV1Recall10 * 100).toFixed(1).padStart(6)}%  │ ${(avgV2Recall10 * 100).toFixed(1).padStart(6)}%  │ ${hasRerank ? (avgV2RerankRecall10 * 100).toFixed(1).padStart(6) + '%' : '  N/A   '}  │      ║`);
    console.log(`║  │ Recall@20      │ ${(avgV1Recall20 * 100).toFixed(1).padStart(6)}%  │ ${(avgV2Recall20 * 100).toFixed(1).padStart(6)}%  │ ${hasRerank ? (avgV2RerankRecall20 * 100).toFixed(1).padStart(6) + '%' : '  N/A   '}  │      ║`);
    console.log('║  └────────────────┴──────────┴──────────┴──────────┘      ║');
    console.log('║                                                            ║');

    // Calculate improvement
    const improvement = ((avgV2Recall20 - avgV1Recall20) / avgV1Recall20) * 100;
    const improvementWithRerank = hasRerank
      ? ((avgV2RerankRecall20 - avgV1Recall20) / avgV1Recall20) * 100
      : 0;

    console.log(`║  Improvement (V2 vs V1):        ${improvement >= 0 ? '+' : ''}${improvement.toFixed(1)}%                    ║`);
    if (hasRerank) {
      console.log(`║  Improvement (V2+Rerank vs V1): ${improvementWithRerank >= 0 ? '+' : ''}${improvementWithRerank.toFixed(1)}%                    ║`);
    }
    console.log('║                                                            ║');

    // Target check
    const targetRecall = 0.77; // 77% target
    const meetsTarget = avgV2Recall20 >= targetRecall || (hasRerank && avgV2RerankRecall20 >= targetRecall);

    if (meetsTarget) {
      console.log('║  ✅ TARGET MET: Recall@20 ≥ 77%                            ║');
    } else {
      console.log(`║  ⚠️  TARGET NOT MET: Need ${(targetRecall * 100).toFixed(0)}%, got ${(Math.max(avgV2Recall20, avgV2RerankRecall20) * 100).toFixed(1)}%               ║`);
    }
    console.log('║                                                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝');

  } catch (error) {
    console.error('\n❌ Evaluation failed:', error);
    process.exit(1);
  } finally {
    await vectorService.close();
    await vectorServiceV2.close();
    process.exit(0);
  }
}

main();
