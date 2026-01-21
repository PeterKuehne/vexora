#!/usr/bin/env tsx
/**
 * Migration script: Reconstruct documents from Weaviate chunks and populate PostgreSQL
 *
 * This script:
 * 1. Fetches all DocumentChunks from Weaviate
 * 2. Groups chunks by documentId
 * 3. Reconstructs document metadata
 * 4. Inserts into PostgreSQL documents table
 *
 * Usage:
 *   npx tsx server/src/scripts/migrate-documents.ts
 */

import weaviate, { WeaviateClient, ApiKey } from 'weaviate-ts-client';
import { Pool } from 'pg';
import fs from 'fs/promises';
import path from 'path';

const WEAVIATE_URL = process.env.WEAVIATE_URL || 'http://localhost:8080';
const POSTGRES_CONFIG = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'vexora',
  user: process.env.POSTGRES_USER || 'vexora',
  password: process.env.POSTGRES_PASSWORD || 'vexora_dev_password',
};
const UPLOADS_DIR = './uploads';

interface DocumentChunkData {
  documentId: string;
  content: string;
  pageNumber: number;
  chunkIndex: number;
  totalChunks: number;
  filename: string;
  originalName: string;
  pages: number;
}

interface ReconstructedDocument {
  id: string;
  originalName: string;
  filename: string;
  pages: number;
  chunkCount: number;
  size: number;
  uploadDate: Date;
}

async function main() {
  console.log('📦 Starting document migration from Weaviate to PostgreSQL...\n');

  // Initialize Weaviate client
  const weaviateClient: WeaviateClient = weaviate.client({
    scheme: 'http',
    host: WEAVIATE_URL.replace('http://', '').replace('https://', ''),
  });

  // Initialize PostgreSQL pool
  const pool = new Pool(POSTGRES_CONFIG);

  try {
    // Test connections
    console.log('🔌 Testing database connections...');
    await pool.query('SELECT 1');
    console.log('✅ PostgreSQL connected');

    await weaviateClient.schema.getter().do();
    console.log('✅ Weaviate connected\n');

    // Fetch all DocumentChunks from Weaviate
    console.log('📥 Fetching document chunks from Weaviate...');
    const response = await weaviateClient.graphql
      .get()
      .withClassName('DocumentChunks')
      .withFields('documentId content pageNumber chunkIndex totalChunks filename originalName pages')
      .withLimit(1000) // Adjust if you have more chunks
      .do();

    const chunks = response.data?.Get?.DocumentChunks || [];
    console.log(`   Found ${chunks.length} chunks`);

    if (chunks.length === 0) {
      console.log('ℹ️  No chunks found in Weaviate. Nothing to migrate.');
      await pool.end();
      return;
    }

    // Group chunks by documentId
    const documentMap = new Map<string, DocumentChunkData[]>();
    for (const chunk of chunks) {
      const docId = chunk.documentId;
      if (!documentMap.has(docId)) {
        documentMap.set(docId, []);
      }
      documentMap.get(docId)!.push(chunk as DocumentChunkData);
    }

    console.log(`   Grouped into ${documentMap.size} unique documents\n`);

    // Reconstruct documents
    const documents: ReconstructedDocument[] = [];
    for (const [docId, docChunks] of documentMap) {
      // Sort chunks by chunkIndex
      docChunks.sort((a, b) => a.chunkIndex - b.chunkIndex);

      const firstChunk = docChunks[0];

      // Try to find the actual file size
      let fileSize = 0;
      try {
        const files = await fs.readdir(UPLOADS_DIR);
        const timestamp = docId.split('_')[1];
        const matchingFile = files.find(f => f.startsWith(timestamp));

        if (matchingFile) {
          const stats = await fs.stat(path.join(UPLOADS_DIR, matchingFile));
          fileSize = stats.size;
        } else {
          // Estimate size from content
          const totalContent = docChunks.map(c => c.content).join('');
          fileSize = Buffer.byteLength(totalContent, 'utf8');
        }
      } catch (error) {
        // Use estimated size
        const totalContent = docChunks.map(c => c.content).join('');
        fileSize = Buffer.byteLength(totalContent, 'utf8');
      }

      documents.push({
        id: docId,
        originalName: firstChunk.originalName || firstChunk.filename,
        filename: firstChunk.filename,
        pages: firstChunk.pages || Math.max(...docChunks.map(c => c.pageNumber)),
        chunkCount: docChunks.length,
        size: fileSize,
        uploadDate: new Date(parseInt(docId.split('_')[1])), // Extract timestamp from ID
      });
    }

    console.log('💾 Inserting documents into PostgreSQL...');
    let insertedCount = 0;
    let skippedCount = 0;

    for (const doc of documents) {
      try {
        // Check if document already exists
        const existingResult = await pool.query(
          'SELECT id FROM documents WHERE id = $1',
          [doc.id]
        );

        if (existingResult.rows.length > 0) {
          console.log(`   ⏭️  Skipped ${doc.originalName} (already exists)`);
          skippedCount++;
          continue;
        }

        // Insert document
        await pool.query(
          `INSERT INTO documents (
            id, filename, file_type, file_size, upload_date,
            processed_date, status, chunk_count, category, tags
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            doc.id,
            doc.originalName,
            'pdf',
            doc.size,
            doc.uploadDate,
            doc.uploadDate,
            'completed',
            doc.chunkCount,
            'Allgemein',
            []
          ]
        );

        console.log(`   ✅ Inserted ${doc.originalName} (${doc.chunkCount} chunks, ${Math.round(doc.size / 1024)}KB)`);
        insertedCount++;
      } catch (error) {
        console.error(`   ❌ Failed to insert ${doc.originalName}:`, error);
      }
    }

    console.log(`\n📊 Migration Summary:`);
    console.log(`   Total documents found: ${documents.length}`);
    console.log(`   Inserted: ${insertedCount}`);
    console.log(`   Skipped: ${skippedCount}`);
    console.log(`\n✅ Migration completed successfully!`);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
