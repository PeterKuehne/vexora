/**
 * Test Script for Graph Service
 * Part of RAG V2 Phase 4: Intelligence & Production
 *
 * Usage: npx tsx server/src/scripts/test-graph-service.ts
 */

import 'dotenv/config';
import { GraphService, createGraphServiceFromEnv } from '../services/graph/index.js';
import { EntityExtractor } from '../services/graph/EntityExtractor.js';

// Sample German text for testing
const SAMPLE_CHUNKS = [
  {
    id: 'chunk-001',
    content: `
      Die Firma Müller GmbH wurde 2019 von Dr. Hans Müller gegründet.
      Herr Müller ist Geschäftsführer und leitet das Projekt Alpha.
      Die Zusammenarbeit mit der SAP AG läuft seit Januar 2023.
    `,
  },
  {
    id: 'chunk-002',
    content: `
      Frau Anna Schmidt arbeitet als Projektleiterin bei der Müller GmbH.
      Sie ist verantwortlich für das Projekt Beta und berichtet an Dr. Hans Müller.
      Das Projekt Beta startete am 15.03.2024 und ist Teil der Digitalisierungsstrategie.
    `,
  },
  {
    id: 'chunk-003',
    content: `
      Die DSGVO-Konformität wird durch das Compliance-Team sichergestellt.
      Der Standort München (80331) dient als Hauptsitz der Müller GmbH.
      ISO 27001 Zertifizierung wurde im Dezember 2023 erhalten.
    `,
  },
];

async function testEntityExtraction() {
  console.log('\n=== Test 1: Entity Extraction ===\n');

  const extractor = new EntityExtractor({
    useLLM: false,
    confidenceThreshold: 0.7,
  });

  const result = await extractor.extract('test-doc-001', SAMPLE_CHUNKS);

  console.log('Extracted Entities:');
  console.log('-'.repeat(50));

  // Group by type
  const byType = new Map<string, typeof result.entities>();
  for (const entity of result.entities) {
    const group = byType.get(entity.type) || [];
    group.push(entity);
    byType.set(entity.type, group);
  }

  for (const [type, entities] of byType) {
    console.log(`\n${type}:`);
    for (const e of entities) {
      console.log(`  - ${e.text} (confidence: ${e.confidence}, occurrences: ${e.occurrences.length})`);
    }
  }

  console.log('\n\nExtracted Relationships:');
  console.log('-'.repeat(50));
  for (const rel of result.relationships) {
    const source = result.entities.find(e => e.id === rel.sourceEntityId);
    const target = result.entities.find(e => e.id === rel.targetEntityId);
    if (source && target) {
      console.log(`  ${source.text} --[${rel.type}]--> ${target.text}`);
    }
  }

  console.log('\n\nStats:');
  console.log(`  Entities: ${result.stats.entitiesExtracted}`);
  console.log(`  Relationships: ${result.stats.relationshipsExtracted}`);
  console.log(`  Processing Time: ${result.stats.processingTimeMs}ms`);
  console.log(`  Method: ${result.stats.methodUsed}`);

  return result;
}

async function testNeo4jConnection() {
  console.log('\n=== Test 2: Neo4j Connection ===\n');

  const graphService = createGraphServiceFromEnv();

  try {
    await graphService.initialize();

    const health = await graphService.healthCheck();
    console.log('Health Check:');
    console.log(`  Enabled: ${health.enabled}`);
    console.log(`  Initialized: ${health.initialized}`);
    if (health.neo4j) {
      console.log(`  Neo4j Healthy: ${health.neo4j.healthy}`);
      console.log(`  Neo4j Version: ${health.neo4j.version}`);
      console.log(`  Neo4j Address: ${health.neo4j.address}`);
    }

    if (health.initialized) {
      const stats = await graphService.getStats();
      if (stats) {
        console.log('\nGraph Statistics:');
        console.log(`  Entities: ${stats.entityCount}`);
        console.log(`  Relationships: ${stats.relationshipCount}`);
        console.log(`  Documents: ${stats.documentCount}`);
        console.log(`  Chunks: ${stats.chunkCount}`);
        console.log(`  Entity Types: ${JSON.stringify(stats.entityTypes)}`);
      }
    }

    await graphService.close();
    return true;
  } catch (error) {
    console.error('Neo4j connection failed:', error);
    return false;
  }
}

async function testFullPipeline() {
  console.log('\n=== Test 3: Full Pipeline (Extract → Store → Query) ===\n');

  const graphService = createGraphServiceFromEnv();

  try {
    await graphService.initialize();

    if (!graphService.isReady()) {
      console.log('Graph service not ready - skipping full pipeline test');
      return;
    }

    // Process document
    console.log('Processing document...');
    const result = await graphService.processDocument('test-doc-pipeline', SAMPLE_CHUNKS);

    console.log(`\nStored ${result.entities.length} entities and ${result.relationships.length} relationships`);

    // Query entities
    console.log('\nQuerying for "Müller"...');
    const found = await graphService.findEntities(['müller', 'müller gmbh']);
    console.log(`Found ${found.length} matching entities`);
    for (const e of found) {
      console.log(`  - ${e.text} (${e.type})`);
    }

    // Test refinement
    console.log('\nTesting graph refinement...');
    const refinementResult = await graphService.refineRAGResults({
      query: 'Wer leitet das Projekt Alpha?',
      queryEntities: ['Projekt Alpha', 'Hans Müller'],
      topChunks: [{ id: 'chunk-001', content: SAMPLE_CHUNKS[0].content, score: 0.9 }],
      maxDepth: 2,
      maxNodes: 20,
    });

    console.log(`  Should use graph: ${refinementResult.shouldUseGraph}`);
    console.log(`  Additional chunks found: ${refinementResult.additionalChunkIds.length}`);
    console.log(`  Nodes in graph: ${refinementResult.graphContext.nodes.length}`);
    console.log(`  Edges in graph: ${refinementResult.graphContext.edges.length}`);

    if (refinementResult.shouldUseGraph) {
      const context = graphService.buildGraphContext(refinementResult);
      console.log('\nGraph Context:');
      console.log(context);
    }

    // Cleanup test data
    console.log('\nCleaning up test data...');
    await graphService.deleteDocumentEntities('test-doc-pipeline');

    await graphService.close();
    console.log('\nFull pipeline test completed successfully!');
  } catch (error) {
    console.error('Full pipeline test failed:', error);
    await graphService.close();
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Graph Service Test Suite');
  console.log('='.repeat(60));

  // Test 1: Entity Extraction (no Neo4j needed)
  await testEntityExtraction();

  // Test 2: Neo4j Connection
  const neo4jOk = await testNeo4jConnection();

  // Test 3: Full Pipeline (only if Neo4j is available)
  if (neo4jOk) {
    await testFullPipeline();
  } else {
    console.log('\n=== Skipping Full Pipeline Test (Neo4j not available) ===');
    console.log('Make sure Neo4j is running on the Ubuntu server:');
    console.log('  ssh ubuntu@192.168.178.23');
    console.log('  cd /path/to/ubuntu-infra');
    console.log('  docker compose up -d neo4j');
  }

  console.log('\n' + '='.repeat(60));
  console.log('Test Suite Complete');
  console.log('='.repeat(60));
}

main().catch(console.error);
