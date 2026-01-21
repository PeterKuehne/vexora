#!/usr/bin/env tsx
/**
 * Migration script: Migrate from Weaviate v2 to v3 with Embeddings
 *
 * This script:
 * 1. Drops old DocumentChunks collection (v2 schema, no vectors)
 * 2. Creates new DocumentChunks collection (v3 schema, with vectors)
 * 3. Re-indexes all documents from PostgreSQL with embeddings
 * 4. Uses Ollama nomic-embed-text for vector generation
 *
 * Usage:
 *   npx tsx server/src/scripts/migrate-to-weaviate-v3.ts
 */

import weaviate from 'weaviate-client';
import { Pool } from 'pg';
import fs from 'fs/promises';
import path from 'path';
import { embeddingService } from '../services/EmbeddingService.js';

const WEAVIATE_URL = process.env.WEAVIATE_URL || 'http://localhost:8080';
const POSTGRES_CONFIG = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'vexora',
  user: process.env.POSTGRES_USER || 'vexora',
  password: process.env.POSTGRES_PASSWORD || 'vexora_dev_password',
};
const UPLOADS_DIR = './uploads';
const COLLECTION_NAME = 'DocumentChunks';
const EMBEDDING_MODEL = 'nomic-embed-text';

interface DocumentRecord {
  id: string;
  filename: string;
  file_size: number;
  upload_date: string;
  chunk_count: number;
  category: string;
  tags: string[];
}

/**
 * Chunk document text
 */
function chunkDocument(text: string, chunkSize = 500, overlap = 50): string[] {
  const words = text.split(/\s+/);
  const chunks: string[] = [];

  for (let i = 0; i < words.length; i += chunkSize - overlap) {
    const chunk = words.slice(i, i + chunkSize).join(' ');
    if (chunk.trim()) {
      chunks.push(chunk.trim());
    }
  }

  return chunks;
}

/**
 * Extract text from PDF (simple implementation for migration)
 */
async function extractTextFromPDF(filePath: string): Promise<{ text: string; pages: number }> {
  try {
    // Dynamic import for unpdf
    const { extractText } = await import('unpdf');
    const data = await fs.readFile(filePath);
    const uint8Data = new Uint8Array(data);
    const { text, totalPages } = await extractText(uint8Data, { mergePages: true });

    return {
      text: text.trim(),
      pages: totalPages,
    };
  } catch (error) {
    console.error(`Failed to extract text from ${filePath}:`, error);
    return { text: '', pages: 0 };
  }
}

async function main() {
  console.log('🔄 Starting Weaviate v2 -> v3 migration with embeddings...\n');

  // Initialize Weaviate v3 client
  const [host, port] = WEAVIATE_URL.replace('http://', '').replace('https://', '').split(':');

  const weaviateClient = await weaviate.connectToCustom({
    httpHost: host,
    httpPort: parseInt(port) || 8080,
    httpSecure: false,
    grpcHost: host,
    grpcPort: 50051,
    grpcSecure: false,
  }, {
    timeout: {
      init: 5,
      query: 60,
      insert: 180, // Longer timeout for embedding generation
    },
  });

  // Initialize PostgreSQL
  const pool = new Pool(POSTGRES_CONFIG);

  try {
    console.log('🔌 Testing connections...');
    await pool.query('SELECT 1');
    console.log('✅ PostgreSQL connected');

    const isReady = await weaviateClient.isReady();
    if (!isReady) {
      throw new Error('Weaviate is not ready');
    }
    console.log('✅ Weaviate v3 connected\n');

    // Step 1: Check if old collection exists and drop it
    console.log('🗑️  Checking for old collection...');
    const oldCollectionExists = await weaviateClient.collections.exists(COLLECTION_NAME);

    if (oldCollectionExists) {
      console.log(`   Dropping old collection: ${COLLECTION_NAME}`);
      await weaviateClient.collections.delete(COLLECTION_NAME);
      console.log('   ✅ Old collection dropped\n');
    } else {
      console.log('   No old collection found\n');
    }

    // Step 2: Create new collection with v3 schema (handled by VectorService)
    console.log('📦 New collection will be created by VectorService on first use\n');

    // Step 3: Get all documents from PostgreSQL
    console.log('📥 Fetching documents from PostgreSQL...');
    const result = await pool.query<DocumentRecord>(
      `SELECT id, filename, file_size, upload_date, chunk_count, category, tags
       FROM documents
       WHERE status = 'completed'
       ORDER BY upload_date ASC`
    );

    const documents = result.rows;
    console.log(`   Found ${documents.length} documents\n`);

    if (documents.length === 0) {
      console.log('ℹ️  No documents to migrate.');
      await weaviateClient.close();
      await pool.end();
      return;
    }

    // Step 4: Re-index each document with embeddings
    console.log('🔄 Re-indexing documents with embeddings...\n');

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (const doc of documents) {
      try {
        console.log(`📄 Processing: ${doc.filename}`);

        // Find PDF file
        const files = await fs.readdir(UPLOADS_DIR);
        const timestamp = doc.id.split('_')[1];
        const matchingFile = files.find(f => f.startsWith(timestamp));

        if (!matchingFile) {
          console.log(`   ⚠️  File not found, skipping`);
          skipCount++;
          continue;
        }

        const filePath = path.join(UPLOADS_DIR, matchingFile);

        // Extract text
        const { text, pages } = await extractTextFromPDF(filePath);

        if (!text) {
          console.log(`   ⚠️  No text content, skipping`);
          skipCount++;
          continue;
        }

        // Chunk text
        const textChunks = chunkDocument(text);
        console.log(`   Chunks: ${textChunks.length}`);

        // Generate embeddings
        console.log(`   Generating embeddings...`);
        const embeddings = await embeddingService.generateEmbeddings(textChunks, EMBEDDING_MODEL);

        // Store in Weaviate v3 using insertMany
        console.log(`   Storing in Weaviate...`);

        // Get or create collection
        let collection;
        const collectionExists = await weaviateClient.collections.exists(COLLECTION_NAME);

        if (!collectionExists) {
          // Import vectorizer and dataType for collection creation
          const { vectorizer, dataType } = await import('weaviate-client');

          await weaviateClient.collections.create({
            name: COLLECTION_NAME,
            description: 'Document chunks for RAG hybrid search',
            vectorizers: vectorizer.none(),
            properties: [
              { name: 'documentId', dataType: dataType.TEXT, indexFilterable: true, indexSearchable: true },
              { name: 'content', dataType: dataType.TEXT, indexFilterable: false, indexSearchable: true },
              { name: 'pageNumber', dataType: dataType.INT, indexFilterable: true, indexSearchable: false },
              { name: 'chunkIndex', dataType: dataType.INT, indexFilterable: true, indexSearchable: false },
              { name: 'totalChunks', dataType: dataType.INT, indexFilterable: false, indexSearchable: false },
              { name: 'filename', dataType: dataType.TEXT, indexFilterable: true, indexSearchable: true },
              { name: 'originalName', dataType: dataType.TEXT, indexFilterable: true, indexSearchable: true },
              { name: 'pages', dataType: dataType.INT, indexFilterable: false, indexSearchable: false },
            ],
          });
          console.log(`   ✅ Created collection: ${COLLECTION_NAME}`);
        }

        collection = weaviateClient.collections.get(COLLECTION_NAME);

        const objects = textChunks.map((content, i) => ({
          properties: {
            documentId: doc.id,
            content,
            pageNumber: 1,
            chunkIndex: i,
            totalChunks: textChunks.length,
            filename: matchingFile,
            originalName: doc.filename,
            pages,
          },
          vector: embeddings[i].embedding,
        }));

        const insertResult = await collection.data.insertMany(objects);

        console.log(`   ✅ Stored ${insertResult.uuids.length} chunks`);
        successCount++;
      } catch (error) {
        console.error(`   ❌ Failed to process ${doc.filename}:`, error);
        errorCount++;
      }

      console.log(''); // Empty line for readability
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   Total documents: ${documents.length}`);
    console.log(`   Successfully migrated: ${successCount}`);
    console.log(`   Skipped: ${skipCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log('\n✅ Migration completed!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await weaviateClient.close();
    await pool.end();
  }
}

main().catch(console.error);
