# Phase 2: Document Processing Implementation

## Ziel
**Recall@20 von 70% (Phase 1) auf ≥77% verbessern** durch:
- Semantic Chunking (Embedding-basierte Breakpoints)
- Hierarchical Indexing (Parent-Child Chunk-Beziehungen)
- Multi-Format Support (PDF, DOCX, PPTX, XLSX, HTML, MD)

## Aufgaben

- [x] Types erstellen (`parsing.ts`, `chunking.ts`)
- [x] Parser Microservice erstellen (FastAPI + Docling)
- [x] Parser Service auf Ubuntu deployen (192.168.178.23:8002)
- [x] SemanticChunker implementieren (Embedding-basierte Breakpoints)
- [x] TableChunker implementieren (Tabellen-aware Chunking)
- [x] HierarchicalIndexer implementieren (Parent-Child Beziehungen)
- [x] ChunkingPipeline orchestrieren
- [x] VectorServiceV2 mit neuem Weaviate-Schema
- [x] Datenbank-Migration durchführen
- [x] Bestehende Dokumente migrieren (V1 → V2)
- [x] Evaluation V1 vs V2 ausführen
- [x] Ergebnisse dokumentieren → siehe V2_SEMANTIC_CHUNKING_RESULTS.md

## Architektur

```
Mac (Dev)                      Ubuntu Server (192.168.178.23)
─────────                      ──────────────────────────────
Node.js Backend ──HTTP──→ Parser Service (Port 8002)
                         Reranker Service (Port 8001)
                         PostgreSQL (Port 5432)
                         Weaviate (Port 8080)
                           ├── DocumentChunks (V1)
                           └── DocumentChunksV2 (V2 - Hierarchisch)
```

## Semantic Chunking Algorithmus

1. Sätze aus Content-Blocks extrahieren
2. Embeddings für alle Sätze generieren (nomic-embed-text)
3. Cosine-Similarity zwischen aufeinanderfolgenden Sätzen berechnen
4. Breakpoints wo Similarity < Threshold (untere 20%)
5. Sätze zwischen Breakpoints zu Chunks gruppieren
6. Min/Max Size Constraints anwenden (100-1000 Zeichen)

## Weaviate V2 Schema

```typescript
DocumentChunksV2: {
  // Bestehende Felder
  documentId, content, chunkIndex,

  // Neue hierarchische Felder
  level: 0|1|2,           // 0=doc, 1=section, 2=para
  parentChunkId: string,
  path: string,           // "doc/section-2/para-3"

  // Neue Metadata
  chunkingMethod: string, // semantic, table, fixed
  pageStart: number,
  pageEnd: number,
  tokenCount: number
}
```

## Ergebnisse

| Metrik | V1 | V2 | V2+Rerank | Änderung |
|--------|----|----|-----------|----------|
| Recall@5 | 67.1% | 72.4% | 73.5% | **+7.9%** |
| Recall@10 | 77.6% | 80.0% | 79.4% | **+3.1%** |
| Recall@20 | 82.4% | 82.9% | 82.9% | **+0.6%** |

**Status: Phase 2 abgeschlossen - Ziel erreicht (82.9% ≥ 77%)**

Siehe [V2_SEMANTIC_CHUNKING_RESULTS.md](./V2_SEMANTIC_CHUNKING_RESULTS.md)

## Dateien

### Types
- `server/src/types/parsing.ts` - SupportedFormat, ParsedDocument, ContentBlock
- `server/src/types/chunking.ts` - Chunk, TableChunk, ChunkerConfig

### Parser Service (Python)
- `server/src/services/parsing/parser_service.py` - FastAPI + Docling
- `server/src/services/parsing/requirements.txt` - Python Dependencies
- `server/src/services/parsing/ParserClientService.ts` - Node.js HTTP Client
- `server/src/services/parsing/deploy-ubuntu.sh` - Deployment Script
- `server/src/services/parsing/parser.service` - systemd Unit

### Chunking Pipeline (TypeScript)
- `server/src/services/chunking/SemanticChunker.ts` - Embedding-basiert
- `server/src/services/chunking/TableChunker.ts` - Tabellen-aware
- `server/src/services/chunking/HierarchicalIndexer.ts` - Parent-Child
- `server/src/services/chunking/ChunkingPipeline.ts` - Orchestrierung

### Services
- `server/src/services/VectorServiceV2.ts` - Neues Weaviate Schema
- `server/src/services/DocumentService.ts` - Multi-Format Support

### Migrations & Scripts
- `server/src/migrations/006_document_processing_v2.sql` - DB Schema
- `server/src/scripts/migrate-to-v2-chunking.ts` - V1→V2 Migration
- `server/src/scripts/run-v2-evaluation.ts` - Evaluation Script

## Deployment (Ubuntu Server)

```bash
# Parser Service (Port 8002)
ssh peter@192.168.178.23
cd /opt/vexora/parser
sudo systemctl start parser
sudo systemctl status parser

# Health Check
curl http://192.168.178.23:8002/health
```

## Environment Variables

```bash
# Parser Service
PARSER_SERVICE_URL=http://192.168.178.23:8002
PARSER_TIMEOUT=300000

# Chunking
CHUNKING_VERSION=v2
RAG_VERSION=v2
SEMANTIC_BREAKPOINT_THRESHOLD=0.5
MIN_CHUNK_SIZE=100
MAX_CHUNK_SIZE=1000
```

## Migration durchführen

```bash
# Dry-Run (nur anzeigen)
npx tsx server/src/scripts/migrate-to-v2-chunking.ts --dry-run

# Echte Migration
npx tsx server/src/scripts/migrate-to-v2-chunking.ts

# Evaluation
npx tsx server/src/scripts/run-v2-evaluation.ts
```
