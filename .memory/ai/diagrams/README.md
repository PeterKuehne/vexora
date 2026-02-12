# Vexora - Comprehensive Event Flow Diagrams

This directory contains exhaustive event flow diagrams documenting every interaction, data flow, and system process in the Vexora RAG-powered chat application.

## Flow Inventory

### Architecture
1. **[Architecture Overview](./architecture-overview.md)**
   - Complete system architecture
   - Frontend/Backend components
   - Service dependencies
   - Infrastructure layout

### Authentication & Security
2. **[Auth JWT Token Flow](./auth-jwt-token-flow.md)**
   - Microsoft & Google OAuth2 with PKCE (OAuth 2.1)
   - JWT access token (15min) + refresh token rotation (30 days)
   - CSRF protection via oauth_states table
   - RBAC (Employee/Manager/Admin) with RLS on documents
   - Automatic token refresh via frontend httpClient
   - Audit logging for all auth events

### RAG Pipeline
3. **[RAG Pipeline Flow](./rag-pipeline-flow.md)**
   - Query rewriting for follow-up questions (pronoun/reference resolution via LLM)
   - Hybrid search (BM25 + vector, alpha=0.3)
   - Reranking with BGE-reranker-v2-m3
   - LLM generation with streaming
   - Input/output guardrails
   - End-to-end tracing

### Document Processing
4. **[Document Processing Flow](./document-processing-flow.md)**
   - Multi-format file upload (PDF, DOCX, PPTX, XLSX, HTML, MD, TXT)
   - Docling parser microservice integration
   - Semantic chunking with embedding-based breakpoints
   - Table-aware chunking
   - Hierarchical indexing (Level 0/1/2)
   - Contextual retrieval enrichment
   - Embedding generation and vector storage
   - Knowledge graph entity extraction

### Knowledge Graph
5. **[Graph RAG Neo4j Flow](./graph-rag-neo4j-flow.md)**
   - Pattern-based + LLM entity extraction (8 entity types)
   - Multi-strategy entity resolution (exact, alias, semantic, fuzzy, abbreviation)
   - Dual storage: Neo4j (graph traversal) + PostgreSQL (persistence)
   - Graph-enhanced RAG refinement via neighborhood traversal
   - Multi-hop query detection (German language patterns)
   - Entity co-occurrence relationship inference

### Document Permissions
6. **[Document Permissions Flow](./document-permissions-flow.md)**
   - Classification levels (public, internal, confidential, restricted)
   - Visibility settings (only_me, department, all_users, specific_users)
   - PostgreSQL Row-Level Security (RLS) with 6 policies
   - Role-based classification restrictions (Employee/Manager/Admin)
   - Permission editing by owner/admin with live preview
   - RAG search integration with permission-filtered document IDs

### Data Storage
7. **[Database Schema Relations](./database-schema-relations.md)**
   - PostgreSQL: 18 tables, 5 views, 9 functions, 6 RLS policies
   - Weaviate: DocumentChunksV2 (hierarchical) + DocumentChunks (legacy)
   - Neo4j: 11 node labels, 11 relationship types, 5 indexes
   - Redis: 4 cache categories (embeddings, search, entities, reranker)

## How to Use These Diagrams

### Finding Specific Flows
1. **By Feature**: Look for flows related to specific features (e.g., authentication, RAG)
2. **By Layer**: Find flows for specific layers (UI, API, Database)
3. **By Trigger**: Search for flows triggered by specific events

### Reading the Diagrams
- **Mermaid Syntax**: All diagrams use Mermaid flowchart syntax
- **Decision Points**: Diamond shapes indicate branching logic
- **Error Paths**: Dashed lines typically show error flows
- **Data Flow**: Arrows show direction of data/control flow

### Key Patterns

#### RAG Architecture
- Query rewriting for conversational follow-ups (LLM-based pronoun/reference resolution with think:false)
- Hybrid search combining BM25 keyword search with vector similarity (alpha=0.3)
- Two-stage retrieval: initial search → reranking (BGE-reranker-v2-m3)
- Document expansion: load all chunks from top-scoring documents
- Graph-enhanced context with Neo4j entity expansion
- Streaming responses via Server-Sent Events (SSE)
- Input guardrails (injection detection) and output guardrails (citation + groundedness)

#### Document Processing
- Multi-format support: PDF, DOCX, PPTX, XLSX, HTML, MD, TXT (max 150MB)
- V2 pipeline: Docling parser → Semantic chunking → Hierarchical indexing → Contextual retrieval → Embedding storage
- V1 fallback: Legacy unpdf extraction for PDFs when parser service unavailable
- Knowledge graph integration: entities extracted and stored in Neo4j during ingestion

#### Security Patterns
- JWT-based authentication with refresh tokens (15min access, 30 day refresh)
- PKCE for secure OAuth flows (Microsoft + Google)
- Token rotation and revocation via PostgreSQL (refresh_tokens table)
- Row-Level Security (RLS) in PostgreSQL for document permissions (6 policies)
- Document classification hierarchy: public < internal < confidential < restricted
- Role-based classification restrictions: Employee (public/internal), Manager (+confidential), Admin (+restricted)
- Visibility modes: only_me, department, all_users, specific_users
- Rate limiting per route category (auth, admin, general)

#### Data Flow Patterns
- Document chunking with semantic breakpoints (cosine similarity)
- Hierarchical indexing (Level 0: document, Level 1: sections, Level 2: paragraphs)
- Contextual retrieval with LLM-generated context per chunk
- Multi-store persistence (PostgreSQL + Weaviate + Neo4j)

## Statistics

- **Total Flows Documented**: 7
- **Backend Services**: 20+
- **API Endpoints**: 30+
- **Database Models**: 18 PostgreSQL tables + 2 Weaviate collections + 11 Neo4j node types
- **External Services**: 7 (PostgreSQL, Weaviate, Neo4j, Redis, Ollama, Reranker, Parser)

## Infrastructure

### Ubuntu Server (192.168.178.23)
- PostgreSQL :5432 (pgvector, RLS)
- Weaviate :8080 (hybrid search, DocumentChunksV2)
- Neo4j :7687 (knowledge graph)
- Redis :6379 (cache, sessions)
- Reranker :8001 (BGE-reranker-v2-m3)
- Parser :8002 (Docling multi-format)

### Local Mac
- Ollama :11434 (LLM + Embeddings)
- Vite :5173 (Frontend)
- Express :3001 (Backend)

## Quick Reference

Most commonly referenced flows:
1. [Architecture Overview](./architecture-overview.md) - System structure
2. [RAG Pipeline Flow](./rag-pipeline-flow.md) - Core feature
3. [Auth JWT Token Flow](./auth-jwt-token-flow.md) - Security
4. [Document Processing Flow](./document-processing-flow.md) - Ingestion pipeline
5. [Graph RAG Neo4j Flow](./graph-rag-neo4j-flow.md) - Knowledge graph
6. [Document Permissions Flow](./document-permissions-flow.md) - Access control
7. [Database Schema Relations](./database-schema-relations.md) - Data storage

---

Last Updated: 2026-02-11
