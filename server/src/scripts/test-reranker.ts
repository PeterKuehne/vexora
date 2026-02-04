import { RerankerService } from '../services/rag/RerankerService.js';

// Create new instance with correct config
const rerankerService = new RerankerService({
  serviceUrl: 'http://192.168.178.23:8001',
  enabled: true,
  topK: 5,
  timeout: 10000,
});

async function test() {
  console.log('Initializing reranker...');
  await rerankerService.initialize();
  console.log('Available:', rerankerService.isAvailable());
  console.log('Config:', rerankerService.getConfig());

  const chunks = [
    { id: '1', content: 'KI testing criteria and evaluation', score: 0.5, documentId: 'doc1', chunkIndex: 0 },
    { id: '2', content: 'Weather today is sunny', score: 0.4, documentId: 'doc1', chunkIndex: 1 },
    { id: '3', content: 'Machine learning and AI basics', score: 0.3, documentId: 'doc2', chunkIndex: 0 },
    { id: '4', content: 'Berlin is the capital city', score: 0.2, documentId: 'doc2', chunkIndex: 1 },
    { id: '5', content: 'AI ethics and bias in systems', score: 0.1, documentId: 'doc3', chunkIndex: 0 },
  ];

  console.log('\nSending', chunks.length, 'chunks to reranker with topK=5');

  const result = await rerankerService.rerank('Was sind KI Prüfkriterien?', chunks, 5);

  console.log('\nResult:');
  console.log('  Chunks returned:', result.chunks.length);
  console.log('  Processing time:', result.processingTimeMs, 'ms');
  console.log('  Model used:', result.modelUsed);

  console.log('\nReranked order:');
  result.chunks.forEach((c, i) => {
    console.log(`  ${i+1}. [${c.documentId}:${c.chunkIndex}] score=${c.rerankerScore.toFixed(4)} - "${c.content.substring(0, 40)}..."`);
  });
}

test().catch(console.error);
