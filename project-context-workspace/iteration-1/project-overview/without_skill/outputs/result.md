# Cor7ex -- Project Overview

## What Is This?

**Cor7ex** (formerly "Vexora", originally "qwen-chat") is an enterprise-grade AI knowledge platform built as a full-stack TypeScript application. It started as a simple local-LLM chat UI and has evolved into a comprehensive intelligence hub that combines document management, retrieval-augmented generation (RAG), an agentic task framework, a skill system, and enterprise authentication -- all aimed at connecting agents, humans, knowledge, and enterprise software (the "Hive Mind" vision).

The project is developed by a single developer (Peter) under the "Samaritano" organization and is tightly coupled with the **Samaritano Platform**, a NestJS-based workforce management system (Einsatzplanung, Zeiterfassung, Buchhaltung, AUeG) that Cor7ex can connect to via the Model Context Protocol (MCP).

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, TypeScript, Vite 7, Tailwind CSS 4, Headless UI, Lucide icons, react-markdown |
| **Backend** | Express 5, TypeScript, Bun runtime, Socket.io (real-time events) |
| **AI / LLM** | Vercel AI SDK 6 (`ai` package), OVH AI Endpoints (EU-Cloud, gpt-oss-120b), local Ollama for embeddings |
| **Embeddings** | `nomic-embed-text-v2-moe` (768d, multilingual MoE) via Ollama |
| **Reranking** | BGE-reranker-v2-m3 (Python microservice) |
| **Vector DB** | Weaviate 1.28 (hybrid BM25 + semantic search) |
| **Relational DB** | PostgreSQL 16 with pgvector (auth, tasks, skills, documents, audit logs) |
| **Graph DB** | Neo4j (entity extraction, knowledge graph, Graph RAG) |
| **Cache** | Redis 7 (caching, rate limiting) |
| **PII Protection** | Microsoft Presidio (Analyzer + Anonymizer microservices) |
| **Document Parsing** | Custom Python parser microservice (PDF, DOCX, PPTX, XLSX, HTML, MD, TXT) |
| **Auth** | Microsoft OAuth2 + Google OAuth2, JWT with httpOnly cookies, PKCE, RBAC (Employee/Manager/Admin) |
| **Testing** | Vitest (unit), Playwright (e2e) |
| **Linting** | ESLint 9 + Prettier |

---

## Architecture Overview

### Infrastructure

- **Hetzner CX43** (167.235.135.132) -- primary dev server running PostgreSQL, Weaviate, Neo4j, Redis, Presidio, Reranker, Parser
- **Local Ubuntu Server** (192.168.2.38) -- alternative local host, switchable via `server/switch-env.sh`
- **Local Mac** -- Ollama (embeddings), Vite dev server (:5173), Express API (:3001)
- **Docker Compose** provisions Weaviate, PostgreSQL (pgvector), and Redis locally

### Application Layers

```
Frontend (React 19 + Vite)          Backend (Express 5 + Bun)
---------------------------------   -----------------------------------------
WorkspaceLayout (3-column)          Routes (14 route modules)
  IconRail | Sidebar | Content        /api/auth, /api/admin, /api/documents
  Sections: tasks, skills, docs       /api/rag, /api/agents, /api/skills, ...
  AgentContext (multi-turn SSE)     Services
  DocumentContext                     AgentExecutor (ToolLoopAgent, AI SDK 6)
  SkillContext                        RAGService (hybrid search + reranking)
  AuthContext (OAuth + JWT)           DocumentService (multi-format pipeline)
                                      VectorServiceV2 (Weaviate hierarchical)
                                      GraphService (Neo4j entity graph)
                                      SkillRegistry (CRUD + RLS + votes)
                                      AuthService (OAuth2 + JWT + RBAC)
                                      PIIGuard (Presidio masking)
                                      MonitoringService (dashboard metrics)
                                      TracingService (RAG observability)
                                    Middleware
                                      auth, requireAuth, security, errorHandler
                                      HTTPS enforcement, CSP, rate limiting
```

---

## Core Subsystems

### 1. RAG Pipeline (Retrieval-Augmented Generation)

The RAG system has gone through multiple phases (V1 through V2 Phase 6) and is the core intelligence engine:

- **Hybrid Search**: Weaviate with configurable alpha (default 0.3 = 70% BM25 keyword, 30% semantic vector), optimized for German technical texts
- **Hierarchical Chunking**: `ChunkingPipeline` combining `SemanticChunker` (embedding-based breakpoints), `TableChunker`, and `HierarchicalIndexer` (parent-child chunk relationships at document/section/paragraph levels)
- **Contextual Retrieval**: Based on Anthropic's technique -- LLM generates contextual descriptions per chunk to improve retrieval by 49-67%
- **Reranking**: BGE-reranker-v2-m3 (Python microservice) re-scores initial retrieval results
- **Query Intelligence**: `QueryRouter` classifies queries (factual, comparative, procedural, relational, aggregative, temporal) and selects strategy (vector_only, hybrid, hybrid_with_graph, table_focused, multi_index); `QueryRewriter` reformulates queries
- **Graph RAG**: Neo4j knowledge graph with entity extraction, entity resolution, and graph refinement enriches retrieval results
- **Agentic RAG**: `AgenticRAG` gives the LLM direct access to retrieval tools (keyword_search, semantic_search, read_chunk) instead of retrieval as preprocessing
- **Guardrails**: Input validation (injection detection, rate limiting, sanitization) and output validation (groundedness checking, citation requirements)
- **Observability**: `TracingService` provides end-to-end span-level tracing (query_analysis, embedding, vector_search, graph_traversal, reranking, llm_generation, guardrails)

**Key files**: `server/src/services/RAGService.ts`, `server/src/services/VectorServiceV2.ts`, `server/src/services/rag/`

### 2. Agent Framework

A multi-turn agentic system built on Vercel AI SDK 6's `ToolLoopAgent`:

- **AgentExecutor**: Manages task lifecycle (create, execute turns, continue, cancel) with SSE streaming for real-time frontend updates
- **ToolRegistry**: Central registry for 16 built-in tools:
  - *Core*: `rag_search`, `graph_query`, `read_chunk`, `sql_query`, `create_document`, `send_notification`
  - *Skills*: `list_skills`, `load_skill`, `create_skill`, `update_skill`, `compare_skill`
  - *Subagents*: `agent`, `list_agents`, `create_agent`
  - *Execution*: `run_script` (Python via `uv run`)
- **SubagentLoader**: Loads agent definitions from Markdown files with YAML frontmatter (`server/agents/`). Built-in agents: `kb-explorer`, `skill-analyzer`, `skill-comparator`, `skill-grader`
- **AI Provider**: Single cloud model via OVH AI Endpoints (EU-Cloud, `gpt-oss-120b`), OpenAI-compatible API
- **PII Guard**: Masks PII via Presidio before sending to cloud LLM, unmasks in responses
- **AgentPersistence**: Full DB persistence of tasks, steps, and messages for audit trail and multi-turn conversations
- **Task Types**: pending, running, completed, failed, cancelled, awaiting_input (for multi-turn)

**Key files**: `server/src/services/agents/`

### 3. Skill System

Inspired by Anthropic's Progressive Disclosure pattern:

- **Level 1**: Name + description (always available in system prompt)
- **Level 2**: Full Markdown body (loaded on demand via `load_skill` tool)
- **Level 3**: Referenced tools/documents (used as needed by agent)

Features:
- **CRUD with RLS**: Row-level security per user/tenant
- **Scopes**: personal, team, swarm (progressive sharing)
- **Swarm Promotion**: Skills can be promoted from personal to swarm-wide with community voting (upvotes/downvotes)
- **Built-in Skills**: Loaded from `server/skills/` directories (agent-creator, document-summary, research-report, skill-creator)
- **Skill Creator V2**: A/B testing with `compare_skill`, grader/comparator/analyzer subagents
- **Execution Tracking**: Duration, success rate, adoption metrics

**Key files**: `server/src/services/skills/`

### 4. Document Management

Multi-format document processing pipeline:

- **Supported Formats**: PDF, DOCX, PPTX, XLSX, HTML, Markdown, TXT
- **Processing Pipeline**: Upload -> Parser (Python microservice) -> Chunking Pipeline -> Weaviate Indexing -> Graph Entity Extraction
- **Permissions**: Classification levels (public, internal, confidential, restricted) with role-based access constraints
- **Categories**: Allgemein, Vertrag, Rechnung, Bericht, Handbuch, Praesentation, Sonstiges
- **Storage Quotas**: Role-based (Employee: 100MB, Manager: 500MB, Admin: 10GB)
- **Real-time Updates**: Socket.io events for upload, delete, update, permissions change, bulk delete
- **Preview**: PDF native rendering, Markdown rendered display

**Key files**: `server/src/services/DocumentService.ts`, `server/src/services/parsing/`, `server/src/services/chunking/`

### 5. Enterprise Authentication & Security

- **OAuth2 Providers**: Microsoft + Google with PKCE (Proof Key for Code Exchange)
- **JWT Tokens**: httpOnly cookies, 1h access token, 30d refresh token with rotation
- **RBAC**: Three roles (Employee, Manager, Admin) with document classification constraints
- **Security Middleware**: HTTPS enforcement, CSP headers, HSTS, rate limiting, input sanitization, XSS protection
- **Audit Logging**: All auth events, document access, admin actions logged
- **Session Management**: Redis-backed, with stale task cleanup

**Key files**: `server/src/services/AuthService.ts`, `server/src/middleware/security.ts`, `server/src/types/auth.ts`

### 6. MCP Connector (Model Context Protocol)

Connects Cor7ex to the **Samaritano Platform** (NestJS workforce management):

- **McpClientManager**: Singleton managing MCP client lifecycle
- **McpOAuthClient**: OAuth 2.1 authentication with the MCP server
- **McpToolAdapter**: Converts MCP tool definitions to Cor7ex AgentTool format
- Protocol version: 2025-03-26
- Dynamically discovers and registers SamaWorkforce tools at startup

**Key files**: `server/src/services/mcp/`

---

## Frontend Structure

A 3-column workspace layout (IconRail + WorkspaceSidebar + Content):

- **Sections**: Tasks (agent conversations), Skills (skill browser), Documents (document management), Knowledge (future)
- **Pages**: LoginPage, DocumentsPage, AdminUsersPage, AdminSystemSettingsPage, AuditLogsPage, ProfilePage
- **Contexts**: AuthContext, AgentContext, DocumentContext, SkillContext, ThemeContext, SettingsContext, ToastContext
- **Key Components**: ChatInput, AgentTaskSidebar/Detail, SkillSidebar/Detail, DocumentList/Preview/Upload, WorkspaceLayout, ProtectedRoute
- **State**: React Context-based, with httpClient for API calls, Socket.io for real-time events, SSE for agent task streaming

---

## Database Schema

18 migration files in `server/src/migrations/`, covering:

1. Enterprise auth (users, refresh_tokens, audit_logs)
2. Token rotation optimization
3. OAuth state management
4. PKCE support
5. Golden evaluation dataset
6. Document processing V2
7. Graph entities
8. Observability (traces, spans)
9. Conversations and LLM settings
10. Agent system (tasks, steps)
11. Skills (definitions, votes, executions)
12. Agent multi-turn (messages)
13. Knowledge sources
14. Skill enhancements
15. Skills filesystem
16. Context messages
17. Test users
18. Agent evaluation

---

## Design Specifications

The `specs/` directory contains 25+ specification documents tracing the project's evolution:

- **Vision**: `00_COR7EX_VISION.md`
- **RAG Pipeline**: Foundation, Document Processing, Intelligence/Production, Improvements, Research Comparison 2026
- **Hive Mind Phases**: LLM -> Agents -> Skills -> Channels -> Compliance
- **Agent Architecture**: Hybrid architecture, multi-turn conversations, expert agent harness
- **Skills**: Specification, refactoring, Skill Creator V2
- **Enterprise**: Authentication system, MCP SamaWorkforce, multi-tenant
- **Advanced**: Memory system, heartbeat engine, context management

---

## Development Workflow

```bash
bun run dev:all     # Start frontend (Vite :5173) + backend (Express :3001) concurrently
bun run build:all   # Build both
bun run test        # Vitest watch mode
bun run lint:fix    # ESLint + Prettier
bun run typecheck   # TypeScript checking
```

Infrastructure services are started via Docker Compose (Weaviate, PostgreSQL, Redis) or accessed on the Hetzner/Ubuntu server.

---

## Summary

Cor7ex is a sophisticated, single-developer enterprise AI platform that has evolved far beyond its origins as a chat UI. It is a knowledge management and agent orchestration system with:

- A multi-stage RAG pipeline (hybrid search, reranking, Graph RAG, agentic RAG, guardrails, observability)
- A tool-using agent framework with multi-turn conversations and SSE streaming
- A community-driven skill system with progressive disclosure and swarm promotion
- Full enterprise auth (OAuth2 + PKCE + RBAC + audit logging)
- Multi-format document processing with permission-aware retrieval
- MCP integration to connect with external enterprise systems
- PII protection for cloud LLM interactions
- A clean, production-oriented codebase with strong typing, security hardening, and comprehensive specs
