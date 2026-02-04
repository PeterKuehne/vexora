/**
 * Test Script for Phase 6 Services
 * Part of RAG V2 Phase 6: Production Hardening
 *
 * Usage: npx tsx server/src/scripts/test-phase6-services.ts
 */

import 'dotenv/config';
import { RedisCache, createRedisCacheFromEnv } from '../services/cache/index.js';

async function testRedisCache() {
  console.log('\n=== Test 1: Redis Cache ===\n');

  const cache = createRedisCacheFromEnv();

  console.log('Initializing Redis connection...');
  await cache.initialize();

  if (!cache.isAvailable()) {
    console.log('❌ Redis not available - skipping cache tests');
    console.log('   Make sure Redis is running on the Ubuntu server:');
    console.log('   ssh peter@192.168.178.23');
    console.log('   cd ubuntu-infra && docker compose up -d redis');
    return false;
  }

  console.log('✓ Redis connected\n');

  // Test embedding cache
  console.log('Testing embedding cache:');
  const testEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
  const testText = 'Dies ist ein Testtext für Embeddings';
  const testModel = 'nomic-embed-text';

  // Set embedding
  await cache.setEmbedding(testText, testModel, testEmbedding);
  console.log('  Set embedding for test text');

  // Get embedding
  const cachedEmbedding = await cache.getEmbedding(testText, testModel);
  const embeddingMatch = JSON.stringify(cachedEmbedding) === JSON.stringify(testEmbedding);
  console.log(`  Get embedding: ${embeddingMatch ? '✓ Match' : '✗ Mismatch'}`);

  // Test batch operations
  console.log('\nTesting batch operations:');
  const batchItems = [
    { text: 'Text 1', embedding: [0.1, 0.2] },
    { text: 'Text 2', embedding: [0.3, 0.4] },
    { text: 'Text 3', embedding: [0.5, 0.6] },
  ];

  await cache.setEmbeddingsBatch(batchItems, testModel);
  console.log(`  Set ${batchItems.length} embeddings in batch`);

  const batchResults = await cache.getEmbeddingsBatch(
    batchItems.map(i => i.text),
    testModel
  );
  const allCached = batchResults.every(r => r !== null);
  console.log(`  Get batch: ${allCached ? '✓ All cached' : '✗ Some missing'}`);

  // Test search results cache
  console.log('\nTesting search results cache:');
  const searchQuery = 'Was ist das Projekt Alpha?';
  const searchParams = { limit: 5, threshold: 0.5 };
  const searchResults = { results: [{ id: '1', score: 0.9 }], total: 1 };

  await cache.setSearchResults(searchQuery, searchParams, searchResults);
  console.log('  Set search results');

  const cachedResults = await cache.getSearchResults(searchQuery, searchParams);
  const searchMatch = JSON.stringify(cachedResults) === JSON.stringify(searchResults);
  console.log(`  Get search results: ${searchMatch ? '✓ Match' : '✗ Mismatch'}`);

  // Test entity cache
  console.log('\nTesting entity cache:');
  const entityTexts = ['Müller GmbH', 'Hans Müller'];
  const entities = [{ id: '1', text: 'Müller GmbH', type: 'ORGANIZATION' }];

  await cache.setEntities(entityTexts, entities);
  console.log('  Set entity cache');

  const cachedEntities = await cache.getEntities(entityTexts);
  const entityMatch = JSON.stringify(cachedEntities) === JSON.stringify(entities);
  console.log(`  Get entities: ${entityMatch ? '✓ Match' : '✗ Mismatch'}`);

  // Test reranker cache
  console.log('\nTesting reranker cache:');
  const rerankQuery = 'Test query';
  const chunkIds = ['chunk1', 'chunk2', 'chunk3'];
  const rerankResults = { scores: [0.9, 0.8, 0.7], order: [0, 1, 2] };

  await cache.setRerankerResults(rerankQuery, chunkIds, rerankResults);
  console.log('  Set reranker results');

  const cachedRerank = await cache.getRerankerResults(rerankQuery, chunkIds);
  const rerankMatch = JSON.stringify(cachedRerank) === JSON.stringify(rerankResults);
  console.log(`  Get reranker results: ${rerankMatch ? '✓ Match' : '✗ Mismatch'}`);

  // Get statistics
  console.log('\nCache Statistics:');
  const stats = await cache.getStats();
  console.log(`  Connected: ${stats.connected}`);
  console.log(`  Keys: ${stats.keys}`);
  console.log(`  Memory Used: ${stats.usedMemoryMB.toFixed(2)} MB`);
  console.log(`  Hit Rate: ${(stats.hitRate * 100).toFixed(1)}%`);

  // Health check
  const health = await cache.healthCheck();
  console.log(`\nHealth Check:`);
  console.log(`  Healthy: ${health.healthy}`);
  console.log(`  Latency: ${health.latencyMs}ms`);

  // Cleanup
  console.log('\nCleaning up test data...');
  await cache.flush();
  console.log('  Cache flushed');

  await cache.close();
  console.log('  Connection closed');

  return true;
}

async function testCachePerformance() {
  console.log('\n=== Test 2: Cache Performance ===\n');

  const cache = createRedisCacheFromEnv();
  await cache.initialize();

  if (!cache.isAvailable()) {
    console.log('❌ Redis not available - skipping performance tests');
    return;
  }

  const iterations = 100;
  const embeddingSize = 768; // Typical embedding size

  // Generate test data
  const testEmbedding = new Array(embeddingSize).fill(0).map(() => Math.random());
  const testTexts = new Array(iterations).fill(0).map((_, i) => `Performance test text ${i}`);

  // Test write performance
  console.log(`Testing write performance (${iterations} embeddings):`);
  const writeStart = Date.now();
  for (let i = 0; i < iterations; i++) {
    await cache.setEmbedding(testTexts[i], 'test-model', testEmbedding);
  }
  const writeTime = Date.now() - writeStart;
  console.log(`  Total time: ${writeTime}ms`);
  console.log(`  Per operation: ${(writeTime / iterations).toFixed(2)}ms`);
  console.log(`  Operations/sec: ${(iterations / (writeTime / 1000)).toFixed(0)}`);

  // Test read performance
  console.log(`\nTesting read performance (${iterations} embeddings):`);
  const readStart = Date.now();
  for (let i = 0; i < iterations; i++) {
    await cache.getEmbedding(testTexts[i], 'test-model');
  }
  const readTime = Date.now() - readStart;
  console.log(`  Total time: ${readTime}ms`);
  console.log(`  Per operation: ${(readTime / iterations).toFixed(2)}ms`);
  console.log(`  Operations/sec: ${(iterations / (readTime / 1000)).toFixed(0)}`);

  // Test batch performance
  const batchSize = 50;
  console.log(`\nTesting batch read performance (${batchSize} embeddings):`);
  const batchStart = Date.now();
  await cache.getEmbeddingsBatch(testTexts.slice(0, batchSize), 'test-model');
  const batchTime = Date.now() - batchStart;
  console.log(`  Total time: ${batchTime}ms`);
  console.log(`  Per embedding: ${(batchTime / batchSize).toFixed(2)}ms`);

  // Calculate memory usage
  const stats = await cache.getStats();
  const memoryPerEmbedding = (stats.usedMemoryMB * 1024 * 1024) / iterations;
  console.log(`\nMemory Usage:`);
  console.log(`  Total: ${stats.usedMemoryMB.toFixed(2)} MB`);
  console.log(`  Per embedding (${embeddingSize}d): ~${(memoryPerEmbedding / 1024).toFixed(2)} KB`);

  // Cleanup
  await cache.flush();
  await cache.close();
}

async function main() {
  console.log('='.repeat(60));
  console.log('Phase 6 Services Test Suite');
  console.log('Production Hardening');
  console.log('='.repeat(60));

  const redisOk = await testRedisCache();

  if (redisOk) {
    await testCachePerformance();
  }

  console.log('\n' + '='.repeat(60));
  console.log('Test Suite Complete');
  console.log('='.repeat(60));
}

main().catch(console.error);
