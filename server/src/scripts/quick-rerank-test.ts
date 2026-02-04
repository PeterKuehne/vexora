/**
 * Quick test to debug reranking in RAG
 */

import { ragService } from '../services/RAGService.js';
import { rerankerService } from '../services/rag/RerankerService.js';
import { databaseService } from '../services/DatabaseService.js';

async function test() {
  console.log('Initializing...');
  await databaseService.initialize();

  // Manually initialize reranker with correct config
  console.log('\nReranker config before:', rerankerService.getConfig());

  // Force reinitialize
  await rerankerService.initialize();
  console.log('Reranker available:', rerankerService.isAvailable());

  console.log('\nTesting RAG with reranking...');

  const response = await ragService.generateResponse({
    messages: [],
    model: 'qwen3:8b',
    query: 'Was sind die wichtigsten KI Prüfkriterien?',
    searchLimit: 20,
    searchThreshold: 0.0, // Lower threshold to get more results
    hybridAlpha: 0.5,
    rerank: true,
    rerankTopK: 5,
  });

  console.log('\nRAG Response:');
  console.log('  Has sources:', response.hasRelevantSources);
  console.log('  Sources count:', response.sources.length);
  console.log('  Search results count:', response.searchResults.results.length);

  if (response.sources.length > 0) {
    console.log('\nTop sources:');
    response.sources.slice(0, 3).forEach((s, i) => {
      console.log(`  ${i + 1}. ${s.documentName} (score: ${s.score.toFixed(4)})`);
    });
  }

  await databaseService.close();
}

test().catch(console.error);
