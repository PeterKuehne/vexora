# Hybrid RAG System Spezifikation

## Version
- **Version:** 1.0
- **Datum:** 2026-01-19
- **Status:** Draft

## 1. Systemübersicht

### 1.1 Zweck
Das System erweitert den bestehenden Qwen Chat um Retrieval-Augmented Generation (RAG) Funktionalität, um Antworten basierend auf unternehmensinternen Dokumenten und strukturierten Daten zu generieren.

### 1.2 Scope
- PDF-Dokumente indizieren und durchsuchbar machen
- Strukturierte Daten aus PostgreSQL-Datenbanken abfragen
- Hybrid Search (semantisch + keyword-basiert)
- Reranking zur Verbesserung der Retrieval-Qualität
- Integration in bestehende Chat-Oberfläche
- Vollständig lokale Ausführung (keine Cloud-Services)

### 1.3 Ausgeschlossen (Out of Scope)
- Web Scraping oder externe APIs
- Echtzeit-Kollaboration zwischen mehreren Nutzern
- Audio/Video-Verarbeitung
- Automatisches Crawling von Dateisystemen

## 2. Systemarchitektur

### 2.1 Komponenten

#### 2.1.1 Vector Database (Weaviate)
- Speichert Dokument-Chunks als Embeddings
- Führt semantische Suche (Vector Search) aus
- Führt Keyword-Suche (BM25) aus
- Kombiniert beide Suchmethoden (Hybrid Search)
- Speichert Metadata zu jedem Chunk
- Unterstützt Filterung nach Metadata

#### 2.1.2 Structured Data Store (PostgreSQL mit pgvector)
- Speichert strukturierte Unternehmensdaten
- Unterstützt relationale Queries
- Bietet Vector Search für strukturierte Daten (pgvector Extension)
- Speichert Document Metadata und Processing Status

#### 2.1.3 Embedding Service
- Generiert Embeddings für Texte
- Nutzt Ollama mit nomic-embed-text Modell
- Dimensionalität: 768
- Batch-Processing für große Dokumente

#### 2.1.4 Reranking Service
- Bewertet Relevanz zwischen Query und Retrieved Chunks
- Nutzt Cross-Encoder Modell (jina-reranker-v2-base-multilingual)
- Läuft über Ollama
- Sortiert Top-K Ergebnisse nach tatsächlicher Relevanz

#### 2.1.5 Document Processing Pipeline
- Extrahiert Text aus PDF-Dokumenten
- Chunking: Text in überlappende Segmente aufteilen
- Metadata-Extraktion (Dateiname, Datum, Kategorie, Seitenzahlen)
- Embedding-Generierung
- Indexierung in Vector Database
- Status-Tracking (pending, processing, completed, failed)

#### 2.1.6 Query Processing Pipeline
- Query Expansion: Mehrere Query-Varianten generieren
- Hybrid Search: Parallel Vector + Keyword Suche
- Reciprocal Rank Fusion (RRF): Ergebnisse kombinieren
- Reranking: Top-K Kandidaten neu bewerten
- Context Building: Relevante Chunks für LLM formatieren

#### 2.1.7 RAG Orchestrator
- Koordiniert Retrieval und Generation
- Entscheidet welche Datenquelle(n) zu nutzen sind
- Baut Context für LLM
- Verwaltet Citations/Quellenangaben
- Fehlerbehandlung und Fallbacks

#### 2.1.8 Cache Layer (Redis)
- Cached Embeddings für häufige Queries
- Cached Retrieval-Ergebnisse
- Session-Management
- Job Queue für asynchrone Document Processing

#### 2.1.9 API Layer
- RESTful Endpoints für alle RAG-Operationen
- Integriert in bestehendes Express Backend
- Streaming Support für LLM-Antworten
- WebSocket Support für Status-Updates

#### 2.1.10 Frontend Extensions
- Document Upload Interface
- Document Management Dashboard
- Source Citation Display in Chat
- RAG Settings/Configuration UI

## 3. Datenmodelle

### 3.1 Document
```
Document:
  - id: string (UUID)
  - filename: string
  - originalPath: string
  - fileType: string (pdf, txt, etc.)
  - fileSize: number (bytes)
  - uploadDate: datetime
  - processedDate: datetime | null
  - status: enum (pending, processing, completed, failed)
  - errorMessage: string | null
  - metadata:
      - category: string | null
      - tags: string[]
      - author: string | null
      - customFields: object
  - chunkCount: number
  - totalTokens: number | null
```

### 3.2 Chunk
```
Chunk:
  - id: string (UUID)
  - documentId: string (FK -> Document)
  - content: string (actual text content)
  - embedding: number[] (768-dim vector)
  - chunkIndex: number (position in document)
  - startPage: number | null
  - endPage: number | null
  - tokenCount: number
  - metadata:
      - inherits from Document.metadata
      - position: object { start: number, end: number }
```

### 3.3 SearchResult
```
SearchResult:
  - chunkId: string
  - documentId: string
  - content: string
  - score: number (0-1, relevance score)
  - source: object
      - filename: string
      - page: number | null
      - category: string | null
  - metadata: object
  - rerankScore: number | null (if reranking applied)
```

### 3.4 RAGQuery
```
RAGQuery:
  - id: string (UUID)
  - query: string (user's question)
  - conversationId: string (FK -> Conversation)
  - timestamp: datetime
  - config:
      - alpha: number (0-1, hybrid search weight)
      - topK: number (number of chunks to retrieve)
      - useReranking: boolean
      - filters: object (metadata filters)
      - sources: string[] (which data sources to query)
  - retrievalResults: SearchResult[]
  - generatedResponse: string | null
  - responseTime: number (ms)
  - tokensUsed: number
```

### 3.5 ProcessingJob
```
ProcessingJob:
  - id: string (UUID)
  - documentId: string (FK -> Document)
  - status: enum (queued, processing, completed, failed)
  - priority: number (1-10)
  - createdAt: datetime
  - startedAt: datetime | null
  - completedAt: datetime | null
  - progress: number (0-100)
  - errorMessage: string | null
  - retryCount: number
```

## 4. API Spezifikation

### 4.1 Document Management

#### POST /api/rag/documents
Upload neues Dokument zur Indexierung

**Request:**
- Content-Type: multipart/form-data
- Body:
  - file: File (PDF)
  - category: string (optional)
  - tags: string[] (optional)
  - customMetadata: object (optional)

**Response:**
```json
{
  "success": boolean,
  "documentId": string,
  "filename": string,
  "status": string,
  "jobId": string
}
```

#### GET /api/rag/documents
Liste aller Dokumente

**Query Parameters:**
- page: number (default: 1)
- limit: number (default: 20)
- status: string (filter by status)
- category: string (filter by category)
- search: string (search in filename)

**Response:**
```json
{
  "documents": Document[],
  "total": number,
  "page": number,
  "totalPages": number
}
```

#### GET /api/rag/documents/:id
Details eines Dokuments

**Response:**
```json
{
  "document": Document,
  "chunks": Chunk[] (optional, wenn include=chunks)
}
```

#### DELETE /api/rag/documents/:id
Dokument und alle Chunks löschen

**Response:**
```json
{
  "success": boolean,
  "deletedChunks": number
}
```

#### GET /api/rag/documents/:id/status
Processing Status eines Dokuments

**Response:**
```json
{
  "documentId": string,
  "status": string,
  "progress": number,
  "chunksProcessed": number,
  "totalChunks": number,
  "error": string | null
}
```

### 4.2 Search & Retrieval

#### POST /api/rag/search
Suche in indexierten Dokumenten

**Request:**
```json
{
  "query": string,
  "topK": number (default: 5),
  "alpha": number (0-1, default: 0.5),
  "useReranking": boolean (default: true),
  "filters": {
    "category": string | null,
    "tags": string[] | null,
    "documentIds": string[] | null,
    "dateRange": {
      "from": datetime | null,
      "to": datetime | null
    }
  }
}
```

**Response:**
```json
{
  "results": SearchResult[],
  "retrievalTime": number,
  "totalResults": number
}
```

### 4.3 RAG Chat

#### POST /api/rag/chat
Chat mit RAG-enhanced Context

**Request:**
```json
{
  "messages": Message[],
  "model": string (optional),
  "ragConfig": {
    "enabled": boolean,
    "alpha": number,
    "topK": number,
    "useReranking": boolean,
    "filters": object,
    "sources": ["documents", "database"] (which sources to query)
  },
  "stream": boolean (default: true)
}
```

**Response (Stream):**
Server-Sent Events (SSE) Format:
```
data: {"type": "retrieval_start"}
data: {"type": "retrieval_complete", "chunksFound": 5}
data: {"type": "token", "content": "Based "}
data: {"type": "token", "content": "on "}
...
data: {"type": "complete", "sources": [...]}
data: [DONE]
```

**Response (Non-Stream):**
```json
{
  "response": string,
  "sources": SearchResult[],
  "usage": {
    "promptTokens": number,
    "completionTokens": number,
    "totalTokens": number
  },
  "retrievalTime": number,
  "generationTime": number
}
```

### 4.4 Configuration

#### GET /api/rag/config
Aktuelle RAG-Konfiguration abrufen

**Response:**
```json
{
  "embeddingModel": string,
  "rerankingModel": string,
  "chunkSize": number,
  "chunkOverlap": number,
  "defaultAlpha": number,
  "defaultTopK": number,
  "maxFileSize": number,
  "supportedFileTypes": string[]
}
```

#### PUT /api/rag/config
RAG-Konfiguration aktualisieren

**Request:**
```json
{
  "defaultAlpha": number,
  "defaultTopK": number,
  "chunkSize": number,
  "chunkOverlap": number
}
```

### 4.5 Analytics

#### GET /api/rag/analytics/queries
Query-Statistiken

**Query Parameters:**
- from: datetime
- to: datetime
- limit: number

**Response:**
```json
{
  "totalQueries": number,
  "avgRetrievalTime": number,
  "avgResponseTime": number,
  "topQueries": [
    {
      "query": string,
      "count": number,
      "avgScore": number
    }
  ],
  "retrievalAccuracy": {
    "avgTopKScore": number,
    "avgRerankImprovement": number
  }
}
```

#### GET /api/rag/analytics/documents
Dokument-Statistiken

**Response:**
```json
{
  "totalDocuments": number,
  "totalChunks": number,
  "statusBreakdown": {
    "completed": number,
    "processing": number,
    "failed": number
  },
  "storageUsed": number,
  "mostQueriedDocuments": [
    {
      "documentId": string,
      "filename": string,
      "queryCount": number
    }
  ]
}
```

## 5. Datenflüsse

### 5.1 Document Upload & Processing Flow
```
User uploads PDF
  ↓
API validates file (type, size)
  ↓
Store file metadata in PostgreSQL (status: pending)
  ↓
Create ProcessingJob in Redis Queue
  ↓
Background Worker picks up job
  ↓
Extract text from PDF
  ↓
Split into chunks (size: 512 tokens, overlap: 50 tokens)
  ↓
For each chunk:
  - Generate embedding via Ollama
  - Store chunk + embedding in Weaviate
  - Update progress in ProcessingJob
  ↓
Update Document status to 'completed'
  ↓
Notify Frontend via WebSocket (optional)
```

### 5.2 RAG Query Flow
```
User sends message in chat
  ↓
Check if RAG is enabled for conversation
  ↓
IF RAG enabled:
  ↓
  Query Processing:
    - Query Expansion (optional)
    - Generate query embedding
  ↓
  Retrieval:
    - Hybrid Search (Vector + BM25) in Weaviate
    - Apply metadata filters
    - Reciprocal Rank Fusion
    - Retrieve Top-K candidates (e.g., 20)
  ↓
  Reranking (if enabled):
    - Cross-encoder scoring for each candidate
    - Re-sort by rerank score
    - Select final Top-K (e.g., 3-5)
  ↓
  Context Building:
    - Format chunks for LLM prompt
    - Include source metadata
    - Add instructions for citation
  ↓
Generation:
  - Build messages array with RAG context
  - Call Ollama with Qwen model
  - Stream response to user
  - Include source citations in response
  ↓
Store query metadata for analytics
```

### 5.3 Hybrid Search Flow (Internal)
```
Query arrives
  ↓
Parallel Execution:
  ├─ Dense Search:
  │    - Convert query to embedding
  │    - Vector similarity search (cosine/dot product)
  │    - Return Top-100 with scores
  │
  └─ Sparse Search:
       - Tokenize query
       - BM25 scoring
       - Return Top-100 with scores
  ↓
Reciprocal Rank Fusion:
  - Combine rankings: score = 1/(k + rank_dense) + 1/(k + rank_sparse)
  - Re-sort by fused score
  - Return Top-20 candidates
```

## 6. Funktionale Anforderungen

### 6.1 Document Management
- **FR-1.1:** System MUSS PDF-Dokumente hochladen können
- **FR-1.2:** System MUSS Dokumente in durchsuchbare Chunks aufteilen können
- **FR-1.3:** System MUSS Metadata (Kategorie, Tags, Datum) zu Dokumenten speichern können
- **FR-1.4:** System MUSS Processing Status verfolgen können (pending, processing, completed, failed)
- **FR-1.5:** System MUSS Dokumente und zugehörige Chunks löschen können
- **FR-1.6:** System MUSS Liste aller Dokumente mit Filterung bereitstellen

### 6.2 Search & Retrieval
- **FR-2.1:** System MUSS semantische Suche (Vector Search) durchführen können
- **FR-2.2:** System MUSS Keyword-basierte Suche (BM25) durchführen können
- **FR-2.3:** System MUSS Hybrid Search (kombiniert Vector + BM25) durchführen können
- **FR-2.4:** System MUSS Reciprocal Rank Fusion implementieren
- **FR-2.5:** System MUSS Cross-Encoder Reranking unterstützen
- **FR-2.6:** System MUSS nach Metadata filtern können (Kategorie, Tags, Datum)
- **FR-2.7:** System MUSS konfigurierbaren alpha-Parameter für Hybrid Search unterstützen (0.0 = pure BM25, 1.0 = pure Vector)
- **FR-2.8:** System MUSS Top-K Parameter konfigurierbar machen

### 6.3 RAG Integration
- **FR-3.1:** System MUSS RAG-Context in bestehende Chat-Funktionalität integrieren
- **FR-3.2:** System MUSS relevante Chunks basierend auf User Query retrievieren
- **FR-3.3:** System MUSS Quellenangaben (Citations) in Antworten einbetten
- **FR-3.4:** System MUSS RAG per Conversation oder per Message aktivieren/deaktivieren können
- **FR-3.5:** System MUSS Streaming von RAG-enhanced Antworten unterstützen
- **FR-3.6:** System MUSS Retrieval-Ergebnisse an Frontend zurückgeben (welche Chunks verwendet wurden)

### 6.4 Configuration
- **FR-4.1:** System MUSS Chunk-Größe konfigurierbar machen
- **FR-4.2:** System MUSS Chunk-Overlap konfigurierbar machen
- **FR-4.3:** System MUSS Default-Werte für alpha und topK definieren können
- **FR-4.4:** System MUSS unterstützte Dateitypen definieren können
- **FR-4.5:** System MUSS maximale Dateigröße limitieren können

### 6.5 User Interface
- **FR-5.1:** System MUSS Document Upload UI bereitstellen
- **FR-5.2:** System MUSS Document Management Dashboard bereitstellen (Liste, Status, Löschen)
- **FR-5.3:** System MUSS Quellenangaben in Chat-Nachrichten anzeigen können
- **FR-5.4:** System MUSS Upload-Progress anzeigen können
- **FR-5.5:** System MUSS RAG-Einstellungen in Settings UI integrieren (alpha, topK, reranking on/off)
- **FR-5.6:** System MUSS visuell unterscheiden zwischen RAG-enhanced und normalen Antworten

### 6.6 Analytics & Monitoring
- **FR-6.1:** System MUSS Query-Statistiken tracken (Anzahl, Durchschnittszeiten)
- **FR-6.2:** System MUSS Retrieval-Qualität messen (durchschnittliche Scores)
- **FR-6.3:** System MUSS Dokument-Statistiken bereitstellen (Anzahl, Storage, meist-genutzt)
- **FR-6.4:** System MUSS Fehler bei Document Processing loggen

## 7. Nicht-Funktionale Anforderungen

### 7.1 Performance
- **NFR-1.1:** Retrieval-Latenz MUSS < 200ms sein (ohne Reranking)
- **NFR-1.2:** Retrieval-Latenz MUSS < 300ms sein (mit Reranking)
- **NFR-1.3:** Document Processing MUSS mindestens 10 Seiten/Sekunde verarbeiten können
- **NFR-1.4:** System MUSS mindestens 1000 Dokumente indexieren können
- **NFR-1.5:** System MUSS mindestens 10 gleichzeitige Queries handhaben können

### 7.2 Reliability
- **NFR-2.1:** System MUSS automatisch Retry bei fehlgeschlagenen Processing Jobs durchführen (max 3 Versuche)
- **NFR-2.2:** System MUSS graceful degradation bieten (Falls RAG fehlschlägt, normale Chat-Antwort)
- **NFR-2.3:** System MUSS Uptime von 99% erreichen
- **NFR-2.4:** System MUSS bei Datenbank-Ausfall Error Handling bieten

### 7.3 Scalability
- **NFR-3.1:** System MUSS horizontal skalierbar sein (mehrere Worker für Processing)
- **NFR-3.2:** System MUSS bis zu 10.000 Dokumente unterstützen
- **NFR-3.3:** System MUSS bis zu 100.000 Chunks indexieren können
- **NFR-3.4:** Vector Database MUSS auf separate Hardware ausgelagert werden können

### 7.4 Security
- **NFR-4.1:** System MUSS alle Daten lokal speichern (keine Cloud-Services)
- **NFR-4.2:** System MUSS File Upload auf erlaubte MIME-Types beschränken
- **NFR-4.3:** System MUSS File Upload Größe limitieren (z.B. max 50MB)
- **NFR-4.4:** System MUSS malicious PDFs erkennen und ablehnen können (PDF-Validation)
- **NFR-4.5:** System MUSS API-Endpoints gegen Injection-Attacks schützen

### 7.5 Maintainability
- **NFR-5.1:** System MUSS modulare Architektur haben (Services entkoppelt)
- **NFR-5.2:** System MUSS typsicher sein (TypeScript mit Zod Validation)
- **NFR-5.3:** System MUSS ausführliches Logging bereitstellen (Debug, Info, Error Levels)
- **NFR-5.4:** System MUSS Konfiguration über Environment Variables ermöglichen
- **NFR-5.5:** System MUSS Docker-basiert sein für einfaches Deployment

### 7.6 Usability
- **NFR-6.1:** Document Upload MUSS Drag-and-Drop unterstützen
- **NFR-6.2:** UI MUSS Progress-Indicator für lange Operationen zeigen
- **NFR-6.3:** Fehler MÜSSEN nutzerfreundlich dargestellt werden
- **NFR-6.4:** Quellenangaben MÜSSEN klickbar sein (Link zu Original-Dokument/Seite)

## 8. Technologie-Stack

### 8.1 Vector Database
- **Primär:** Weaviate 1.24+
- **Grund:** Native Hybrid Search, BM25 built-in, lokales Deployment, GraphQL API

### 8.2 Structured Data
- **Datenbank:** PostgreSQL 16+ mit pgvector Extension
- **Grund:** Relational + Vector Support, bewährte Enterprise-DB

### 8.3 Cache & Queue
- **System:** Redis 7+
- **Verwendung:** Query Cache, Embedding Cache, Job Queue (BullMQ)

### 8.4 Embedding Model
- **Model:** nomic-embed-text
- **Provider:** Ollama (lokal)
- **Dimensionalität:** 768
- **Grund:** Kompakt, schnell, läuft lokal, mehrsprachig

### 8.5 Reranking Model
- **Model:** jina-reranker-v2-base-multilingual
- **Provider:** Ollama (lokal)
- **Grund:** Multilingual, Balance zwischen Qualität und Speed, läuft lokal

### 8.6 LLM
- **Model:** Qwen 2.5+ (existing)
- **Provider:** Ollama (lokal)

### 8.7 Backend Framework
- **Framework:** Express.js 5+ (existing)
- **Language:** TypeScript 5+
- **Validation:** Zod

### 8.8 Frontend Framework
- **Framework:** React 19 (existing)
- **Language:** TypeScript 5+
- **Build Tool:** Vite 7+

### 8.9 PDF Processing
- **Library:** pdf-parse oder PyMuPDF (über Python Microservice)
- **Alternative:** pdfjs-dist

### 8.10 Text Processing
- **Chunking:** LangChain TextSplitter oder custom implementation
- **Tokenization:** tiktoken oder LlamaIndex

### 8.11 Orchestration Framework
- **Option A:** LlamaIndex (empfohlen: schnellste Query-Zeit, niedrigster Token-Verbrauch)
- **Option B:** LangChain (mehr Flexibilität, größeres Ecosystem)
- **Entscheidung:** LlamaIndex für Retrieval, Optional LangChain für spätere Agent-Features

## 9. Integration Points

### 9.1 Bestehende Systeme

#### 9.1.1 Chat Backend (Express)
- **Integration:** RAG-Endpoints als neue Routes unter `/api/rag/*`
- **Abhängigkeiten:** Nutzt bestehenden OllamaService für LLM-Calls
- **Erweiterungen:** Neuer RAGService koordiniert Retrieval + Generation

#### 9.1.2 Chat Frontend (React)
- **Integration:** Neue Components für Document Management
- **Abhängigkeiten:** Nutzt bestehendes ChatContext für Nachrichten
- **Erweiterungen:** Neuer RAGContext für Document/Search State

#### 9.1.3 Settings System
- **Integration:** RAG-Konfiguration in bestehenden Settings
- **Storage:** LocalStorage + Backend Persistence (neu)

#### 9.1.4 Message System
- **Erweiterungen:** Message-Type erweitern um `sources: SearchResult[]` Feld
- **UI:** Citation-Display in MessageList Component

### 9.2 Externe Services

#### 9.2.1 Ollama API
- **Endpoints:**
  - `/api/embeddings` - Embedding Generation
  - `/api/generate` - LLM Generation (existing)
  - Reranking über Custom Model

#### 9.2.2 Weaviate
- **Protocol:** HTTP/GraphQL
- **Port:** 8080 (default)
- **API:** GraphQL für Queries, REST für Admin

#### 9.2.3 PostgreSQL
- **Connection:** pg library (Node.js)
- **Port:** 5432 (default)

#### 9.2.4 Redis
- **Connection:** ioredis library
- **Port:** 6379 (default)

## 10. Deployment Architektur

### 10.1 Container Services
```
Docker Compose Setup:
- weaviate (Vector DB)
- postgres (Structured Data + pgvector)
- redis (Cache + Queue)
- qwen-chat-backend (Express API)
- qwen-chat-frontend (Vite Dev Server / Nginx für Production)
- ollama (existing, external oder Container)
```

### 10.2 Volumes
- `weaviate_data`: Persistente Vector Storage
- `postgres_data`: Persistente DB Storage
- `redis_data`: Optional (für Persistence)
- `uploads`: PDF Files (vor Processing)

### 10.3 Networks
- `qwen-chat-network`: Internal network für alle Services

### 10.4 Environment Variables
```
# Weaviate
WEAVIATE_URL=http://weaviate:8080

# PostgreSQL
DB_HOST=postgres
DB_PORT=5432
DB_NAME=qwen_rag
DB_USER=qwen
DB_PASSWORD=${DB_PASSWORD}

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# Ollama
OLLAMA_API_URL=http://localhost:11434

# RAG Config
EMBEDDING_MODEL=nomic-embed-text
RERANKER_MODEL=jina-reranker-v2-base-multilingual
DEFAULT_CHUNK_SIZE=512
DEFAULT_CHUNK_OVERLAP=50
DEFAULT_ALPHA=0.5
DEFAULT_TOP_K=5
MAX_FILE_SIZE_MB=50

# Processing
MAX_CONCURRENT_JOBS=3
JOB_RETRY_ATTEMPTS=3
```

## 11. Success Metrics

### 11.1 Retrieval Quality
- **Target:** Retrieval Precision @ 5 ≥ 85%
- **Measurement:** User Feedback oder Ground Truth Evaluation
- **Target:** Mean Reciprocal Rank (MRR) ≥ 0.48

### 11.2 Performance
- **Target:** Retrieval Latenz p95 < 300ms
- **Target:** End-to-End Response Time p95 < 2s (inkl. LLM)
- **Target:** Document Processing Rate ≥ 10 pages/sec

### 11.3 System Reliability
- **Target:** System Uptime ≥ 99%
- **Target:** Processing Success Rate ≥ 95%
- **Target:** Zero Data Loss bei Restarts

### 11.4 User Satisfaction
- **Target:** 80% der RAG-Antworten werden als "hilfreich" bewertet
- **Target:** Durchschnittliche User Engagement Zeit erhöht sich um 30%

## 12. Risiken & Mitigations

### 12.1 Performance Risiken
- **Risiko:** Langsame Queries bei vielen Dokumenten
- **Mitigation:**
  - Indexing Optimization in Weaviate
  - Query Caching mit Redis
  - Pagination für große Result Sets

### 12.2 Accuracy Risiken
- **Risiko:** Irrelevante Chunks werden retrieved
- **Mitigation:**
  - Reranking aktivieren
  - Alpha-Parameter Tuning
  - Query Expansion für besseren Recall
  - User Feedback Loop

### 12.3 Scalability Risiken
- **Risiko:** System wird langsam bei 1000+ Dokumenten
- **Mitigation:**
  - Horizontale Skalierung von Workers
  - Vector DB auf separate Hardware
  - Sharding Strategy

### 12.4 Data Quality Risiken
- **Risiko:** Schlechte PDF-Extraktion (Tabellen, Bilder, Layouts)
- **Mitigation:**
  - Multiple Parser (Fallback-Strategie)
  - Manual Review für kritische Docs
  - Pre-Processing Quality Checks

### 12.5 Integration Risiken
- **Risiko:** Breaking Changes in bestehendem System
- **Mitigation:**
  - Feature Flags für RAG-Funktionalität
  - Backward-kompatible API Changes
  - Comprehensive Testing

## 13. Phasen & Milestones

### Phase 1: Foundation (Woche 1)
- **Milestone 1.1:** Docker Setup (Weaviate, PostgreSQL, Redis)
- **Milestone 1.2:** Database Schemas & Migrations
- **Milestone 1.3:** Document Upload API
- **Milestone 1.4:** PDF Processing Pipeline (basic)
- **Milestone 1.5:** Embedding Generation & Indexing

### Phase 2: Retrieval (Woche 2)
- **Milestone 2.1:** Hybrid Search Implementation
- **Milestone 2.2:** Reciprocal Rank Fusion
- **Milestone 2.3:** Cross-Encoder Reranking
- **Milestone 2.4:** Search API Endpoints
- **Milestone 2.5:** Metadata Filtering

### Phase 3: RAG Integration (Woche 2-3)
- **Milestone 3.1:** RAG Chat Endpoint
- **Milestone 3.2:** Context Building für LLM
- **Milestone 3.3:** Citation System
- **Milestone 3.4:** Streaming Support für RAG-Antworten
- **Milestone 3.5:** Integration in bestehendes Chat UI

### Phase 4: UI & UX (Woche 3)
- **Milestone 4.1:** Document Upload UI
- **Milestone 4.2:** Document Management Dashboard
- **Milestone 4.3:** Source Citation Display
- **Milestone 4.4:** RAG Settings UI
- **Milestone 4.5:** Processing Status Indicators

### Phase 5: Production Readiness (Woche 3-4)
- **Milestone 5.1:** Caching Layer Implementation
- **Milestone 5.2:** Error Handling & Retry Logic
- **Milestone 5.3:** Logging & Monitoring
- **Milestone 5.4:** Analytics Dashboard
- **Milestone 5.5:** Testing (Unit + Integration)
- **Milestone 5.6:** Documentation

## 14. Offene Fragen

1. **Nutzer-Authentifizierung:** Sollen Dokumente pro Nutzer isoliert sein oder global verfügbar?
2. **Batch Upload:** Soll System Batch-Upload von mehreren Dokumenten gleichzeitig unterstützen?
3. **Document Versioning:** Sollen Updates zu Dokumenten neue Versionen erstellen oder alte überschreiben?
4. **Export Funktionalität:** Sollen Nutzer Dokumente/Chunks exportieren können?
5. **Advanced Chunking:** Sollen semantische Chunks (basierend auf Absätzen/Sections) unterstützt werden?
6. **Multi-Language:** Welche Sprachen sollen primär unterstützt werden? (DE, EN, ...?)
7. **Graph Enhancement:** Soll später GraphRAG Layer hinzugefügt werden? (Phase 2)

## 15. Glossar

- **Chunk:** Ein Text-Segment aus einem Dokument (typisch 200-1000 Tokens)
- **Embedding:** Numerische Vektor-Repräsentation eines Textes (768-dim)
- **Hybrid Search:** Kombination aus Vector Search (semantisch) und BM25 (keyword)
- **BM25:** Best Matching 25, ein Keyword-basierter Ranking Algorithmus
- **Alpha (α):** Gewichtungs-Parameter zwischen Vector (α=1.0) und BM25 (α=0.0)
- **Reciprocal Rank Fusion (RRF):** Methode zum Kombinieren von Rankings aus verschiedenen Quellen
- **Cross-Encoder:** Neural Network Model für Relevanz-Scoring (Query + Document als Input)
- **Reranking:** Neu-Bewertung von Retrieval-Ergebnissen für bessere Qualität
- **RAG:** Retrieval-Augmented Generation - LLM mit externen Wissensquellen
- **Citation:** Quellenangabe in LLM-Antwort (welches Dokument, welche Seite)
- **Top-K:** Anzahl der relevantesten Ergebnisse (z.B. Top-5 Chunks)
- **MRR:** Mean Reciprocal Rank - Metrik für Ranking-Qualität
- **NDCG:** Normalized Discounted Cumulative Gain - Metrik für Retrieval-Qualität
