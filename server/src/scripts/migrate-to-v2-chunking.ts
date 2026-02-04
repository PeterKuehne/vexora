/**
 * Migration Script: V1 to V2 Chunking
 * RAG V2 Phase 2
 *
 * Re-processes existing documents with V2 semantic chunking:
 * 1. Reads documents from PostgreSQL
 * 2. Fetches text from V1 Weaviate
 * 3. Re-chunks using semantic chunker
 * 4. Stores in V2 Weaviate collection
 * 5. Updates PostgreSQL metadata
 *
 * Usage: npx tsx server/src/scripts/migrate-to-v2-chunking.ts [--dry-run] [--doc-id=xxx]
 */

import { databaseService } from '../services/DatabaseService.js';
import { vectorService } from '../services/VectorService.js';
import { vectorServiceV2 } from '../services/VectorServiceV2.js';
import { chunkingPipeline } from '../services/chunking/ChunkingPipeline.js';
import type { ContentBlock } from '../types/parsing.js';

// ============================================
// Configuration
// ============================================

interface MigrationConfig {
  dryRun: boolean;
  specificDocId?: string;
  batchSize: number;
  skipAlreadyMigrated: boolean;
}

function parseArgs(): MigrationConfig {
  const args = process.argv.slice(2);

  return {
    dryRun: args.includes('--dry-run'),
    specificDocId: args.find((a) => a.startsWith('--doc-id='))?.split('=')[1],
    batchSize: parseInt(args.find((a) => a.startsWith('--batch-size='))?.split('=')[1] || '10'),
    skipAlreadyMigrated: !args.includes('--force'),
  };
}

// ============================================
// Migration Logic
// ============================================

interface DocumentToMigrate {
  id: string;
  filename: string;
  fileType: string;
  chunkCount: number;
  chunkingVersion: string;
}

async function getDocumentsToMigrate(config: MigrationConfig): Promise<DocumentToMigrate[]> {
  let query = `
    SELECT id, filename, file_type, chunk_count, COALESCE(chunking_version, 'v1') as chunking_version
    FROM documents
    WHERE status = 'completed'
  `;

  const params: string[] = [];

  if (config.specificDocId) {
    query += ` AND id = $1`;
    params.push(config.specificDocId);
  } else if (config.skipAlreadyMigrated) {
    query += ` AND (chunking_version IS NULL OR chunking_version = 'v1')`;
  }

  query += ` ORDER BY upload_date DESC`;

  const result = await databaseService.query(query, params);

  return result.rows.map((row) => ({
    id: row.id,
    filename: row.filename,
    fileType: row.file_type,
    chunkCount: row.chunk_count,
    chunkingVersion: row.chunking_version,
  }));
}

async function getDocumentText(documentId: string): Promise<string | null> {
  try {
    // Use Weaviate REST API to fetch all chunks for this document
    const weaviateUrl = process.env.WEAVIATE_URL || 'http://localhost:8080';
    const response = await fetch(
      `${weaviateUrl}/v1/objects?class=DocumentChunks&limit=500&where=${encodeURIComponent(
        JSON.stringify({
          path: ['documentId'],
          operator: 'Equal',
          valueText: documentId,
        })
      )}`
    );

    if (!response.ok) {
      console.log(`  ⚠️  Failed to fetch chunks: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const objects = data.objects || [];

    if (objects.length === 0) {
      console.log(`  ⚠️  No V1 chunks found for document ${documentId}`);
      return null;
    }

    // Filter to ensure we only get chunks for THIS document
    // (Weaviate may return all chunks if filter fails)
    const matchingChunks = objects.filter(
      (obj: any) => obj.properties.documentId === documentId
    );

    if (matchingChunks.length === 0) {
      console.log(`  ⚠️  No matching chunks found for document ${documentId} (filter returned ${objects.length} unrelated chunks)`);
      return null;
    }

    if (matchingChunks.length !== objects.length) {
      console.log(`  ⚠️  Filtered ${objects.length} chunks down to ${matchingChunks.length} for document ${documentId}`);
    }

    // Sort by chunk index and concatenate
    const sortedChunks = matchingChunks.sort(
      (a: any, b: any) => (a.properties.chunkIndex || 0) - (b.properties.chunkIndex || 0)
    );

    return sortedChunks.map((obj: any) => obj.properties.content).join('\n\n');
  } catch (error) {
    console.error(`  ❌ Failed to retrieve V1 text for ${documentId}:`, error);
    return null;
  }
}

async function migrateDocument(
  doc: DocumentToMigrate,
  config: MigrationConfig
): Promise<boolean> {
  console.log(`\n📄 Processing: ${doc.filename} (${doc.id})`);
  console.log(`   Current version: ${doc.chunkingVersion}, chunks: ${doc.chunkCount}`);

  // Step 1: Get document text from V1
  const text = await getDocumentText(doc.id);

  if (!text) {
    console.log(`   ⏭️  Skipping - no text available`);
    return false;
  }

  console.log(`   📝 Retrieved ${text.length} characters`);

  // Step 2: Create content blocks from text (simple paragraph split)
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim());
  const blocks: ContentBlock[] = paragraphs.map((content, index) => ({
    type: 'paragraph',
    content: content.trim(),
    position: index,
    pageNumber: 1,
  }));

  console.log(`   📦 Created ${blocks.length} content blocks`);

  // Step 3: Process with chunking pipeline
  const chunkingResult = await chunkingPipeline.processDocument({
    documentId: doc.id,
    blocks,
    fullText: text,
    metadata: {
      filename: doc.filename,
      pageCount: 1,
    },
  });

  console.log(`   🔧 Chunked into ${chunkingResult.stats.totalChunks} V2 chunks`);
  console.log(`      Levels: L0=${chunkingResult.stats.chunksPerLevel[0]}, L1=${chunkingResult.stats.chunksPerLevel[1]}, L2=${chunkingResult.stats.chunksPerLevel[2]}`);

  if (config.dryRun) {
    console.log(`   🔍 DRY RUN - would store ${chunkingResult.chunks.length} chunks`);
    return true;
  }

  // Step 4: Store in V2 Weaviate
  try {
    await vectorServiceV2.storeChunks(chunkingResult.chunks, {
      filename: doc.id,
      originalName: doc.filename,
      pageCount: 1,
    });
    console.log(`   ✅ Stored in V2 collection`);
  } catch (error) {
    console.error(`   ❌ Failed to store in V2:`, error);
    return false;
  }

  // Step 5: Update PostgreSQL metadata
  try {
    await databaseService.query(
      `UPDATE documents
       SET chunking_version = 'v2',
           chunk_count = $1,
           total_tokens = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [
        chunkingResult.stats.totalChunks,
        chunkingResult.chunks.reduce((sum, c) => sum + c.tokenCount, 0),
        doc.id,
      ]
    );

    // Store chunk metadata
    for (const chunk of chunkingResult.chunks) {
      await databaseService.query(
        `INSERT INTO chunk_metadata (
          document_id, chunk_id, chunk_index, level, parent_chunk_id,
          path, chunking_method, page_start, page_end, token_count, char_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (document_id, chunk_id) DO UPDATE SET
          level = EXCLUDED.level,
          parent_chunk_id = EXCLUDED.parent_chunk_id,
          path = EXCLUDED.path,
          chunking_method = EXCLUDED.chunking_method,
          token_count = EXCLUDED.token_count,
          char_count = EXCLUDED.char_count`,
        [
          doc.id,
          chunk.id,
          chunk.chunkIndex,
          chunk.level,
          chunk.parentChunkId,
          chunk.path,
          chunk.chunkingMethod,
          chunk.pageStart,
          chunk.pageEnd,
          chunk.tokenCount,
          chunk.charCount,
        ]
      );
    }

    console.log(`   ✅ Updated PostgreSQL metadata`);
  } catch (error) {
    console.error(`   ❌ Failed to update PostgreSQL:`, error);
    return false;
  }

  return true;
}

// ============================================
// Main
// ============================================

async function main() {
  const config = parseArgs();

  console.log('╔════════════════════════════════════════════╗');
  console.log('║  RAG V2 Phase 2 - Chunking Migration       ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log('');
  console.log('Configuration:');
  console.log(`  Dry run: ${config.dryRun}`);
  console.log(`  Specific doc: ${config.specificDocId || 'all'}`);
  console.log(`  Batch size: ${config.batchSize}`);
  console.log(`  Skip migrated: ${config.skipAlreadyMigrated}`);
  console.log('');

  try {
    // Initialize services
    console.log('🔧 Initializing services...');
    await databaseService.initialize();
    await vectorService.initialize();
    await vectorServiceV2.initialize();
    console.log('✅ Services initialized');

    // Get documents to migrate
    const documents = await getDocumentsToMigrate(config);
    console.log(`\n📊 Found ${documents.length} documents to migrate`);

    if (documents.length === 0) {
      console.log('\n✅ No documents to migrate. All done!');
      return;
    }

    // Process documents
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i];
      console.log(`\n[${i + 1}/${documents.length}]`);

      const success = await migrateDocument(doc, config);

      if (success) {
        successCount++;
      } else {
        failCount++;
      }

      // Small delay between documents
      if (i < documents.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    // Summary
    console.log('\n');
    console.log('╔════════════════════════════════════════════╗');
    console.log('║  Migration Complete                        ║');
    console.log('╚════════════════════════════════════════════╝');
    console.log('');
    console.log(`  Total documents: ${documents.length}`);
    console.log(`  Successful: ${successCount}`);
    console.log(`  Failed: ${failCount}`);
    console.log(`  Mode: ${config.dryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log('');

    if (config.dryRun) {
      console.log('💡 Run without --dry-run to apply changes');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await vectorService.close();
    await vectorServiceV2.close();
    process.exit(0);
  }
}

main();
