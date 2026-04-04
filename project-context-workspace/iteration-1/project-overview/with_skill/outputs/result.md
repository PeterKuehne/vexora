# Cor7ex -- Projekt-Ueberblick

## Was ist Cor7ex?

Cor7ex ist ein **lernendes Nervensystem fuer Unternehmen**. Die Kernidee: KI-Agents und menschliche Mitarbeiter bilden ein gemeinsames Bewusstsein -- einen "Hive Mind" -- der mit jedem Tag klueger wird. Das System ist kein reiner Chatbot und kein reines RAG-Tool, sondern eine Plattform, die Wissen, Agents, Skills und Enterprise-Software zu einem einheitlichen Organismus verbindet.

Das Projekt befindet sich in Version 0.1.0 und wurde von "Vexora" in "Cor7ex" umbenannt (2026-03-20).

---

## Technischer Stack

| Schicht       | Technologie                                                       |
|---------------|-------------------------------------------------------------------|
| **Frontend**  | React 19, Vite 7, Tailwind CSS 4, React Router 7, Socket.io      |
| **Backend**   | Express 5 (TypeScript), Bun als Runtime                           |
| **AI SDK**    | Vercel AI SDK 6 (`ai` ^6.0.134, `@ai-sdk/openai-compatible`)     |
| **LLM**       | OVH gpt-oss-120b (Cloud), Ollama (lokal), Cloud-Provider          |
| **Vector DB** | Weaviate (Hybrid Search: BM25 + Semantic, alpha=0.3)              |
| **Graph DB**  | Neo4j (Knowledge Graph, Entity Extraction/Resolution)             |
| **SQL DB**    | PostgreSQL (User, Tasks, Documents, Steps, Skills, Audit)         |
| **Cache**     | Redis (Rate Limiting, Caching)                                    |
| **PII**       | Presidio Analyzer + Anonymizer (PIIGuard fuer Cloud-LLMs)         |
| **Reranker**  | BGE-reranker-v2-m3 (Search Threshold 0.1)                        |
| **MCP**       | Model Context Protocol Client (Anbindung an SamaWorkforce)        |
| **Testing**   | Vitest, Playwright, Testing Library                               |

---

## Architektur-Ueberblick

### Monorepo-Struktur

```
/
  src/                  -- React Frontend (Vite)
    components/         -- UI: ChatInput, DocumentList, AgentTaskDetail, SkillCard, ...
      layout/           -- AppShell, ChatArea, Header, Sidebar, WorkspaceLayout
    pages/              -- Login, Documents, Admin, Profile, AuditLogs
    lib/                -- API Client, Socket.io, Storage, Error Handling
  server/
    src/
      index.ts          -- Express-Server, Middleware, Routes, Socket.io, Service-Init
      config/           -- Env-Konfiguration
      middleware/        -- Security (HTTPS, Headers, Sanitization, Rate Limiting, Cookies)
      routes/           -- 14 Route-Module (auth, admin, agents, skills, documents, rag, ...)
      services/
        agents/          -- Agent-System (AgentExecutor, ToolRegistry, Persistence, Subagents)
          tools/         -- 16 Tools (rag_search, graph_query, sql_query, agent, create_document, ...)
        skills/          -- Skill-Loader, Registry, Validator, SwarmPromotion
        graph/           -- Neo4j, EntityExtractor, EntityResolver, GraphRefinement
        mcp/             -- MCP Client (SamaWorkforce OAuth 2.1)
        rag/             -- RAG Pipeline
        cache/           -- Redis Cache
        llm/             -- PIIGuard, AI Middleware
        monitoring/      -- Observability
        parsing/         -- Document Parsing
        chunking/        -- Hierarchical Chunking (V2)
    skills/             -- Built-in Skill-Definitionen (Markdown+Frontmatter)
      agent-creator/
      document-summary/
      research-report/
      skill-creator/
    agents/             -- Subagent-Definitionen (Markdown)
      kb-explorer.md
      skill-analyzer.md
      skill-comparator.md
      skill-grader.md
  specs/                -- 25+ Spezifikationen (Vision, HiveMind Phases, Agents, Skills, MCP, ...)
  memory/               -- Projekt-Memory, AI-Diagramme
  docker/               -- Docker-Konfiguration
  ubuntu-infra/         -- Infrastruktur-Setup
```

---

## Kern-Systeme

### 1. Agent-System (Vercel AI SDK 6 / ToolLoopAgent)

- **AgentExecutor** (`server/src/services/agents/AgentExecutor.ts`): Kern des Systems. Nutzt `ToolLoopAgent` aus dem Vercel AI SDK 6 fuer strukturierte Agent-Ausfuehrung. Multi-Turn-Konversationen mit SSE-Streaming, Abort-Support, Step-Persistence.
- **ToolRegistry** (`server/src/services/agents/ToolRegistry.ts`): Singleton fuer zentrale Tool-Registrierung. Supports Role-based Access (requiredRoles) und Skill-Gating (Tools werden erst nach load_skill verfuegbar).
- **prepareStep**: Erster Schritt im ersten Turn erzwingt Tool-Nutzung (rag_search, load_skill, list_skills, agent). Danach entscheidet das Modell frei.
- **Subagents**: Isolierte ToolLoopAgents fuer spezialisierte Aufgaben (kb-explorer, skill-analyzer, etc.). Kein Nesting (Subagents koennen keine Sub-Subagents spawnen). Nur result.text wird zurueckgegeben (Context Isolation).

### 2. Tool-System (16 registrierte Tools)

| Tool                | Zweck                                              |
|---------------------|----------------------------------------------------|
| `rag_search`        | Hybrid Search (BM25 + Semantic) in Weaviate        |
| `graph_query`       | Neo4j Knowledge Graph Abfragen                     |
| `read_chunk`        | Einzelnen Chunk lesen                               |
| `sql_query`         | PostgreSQL Abfragen                                 |
| `create_document`   | Dokument erstellen + Weaviate-Indexierung           |
| `send_notification` | Benachrichtigungen senden                           |
| `list_skills`       | Verfuegbare Skills auflisten                        |
| `load_skill`        | Skill laden (Instruktionen injizieren)              |
| `create_skill`      | Neuen Skill erstellen (skill-gated)                 |
| `update_skill`      | Skill aktualisieren (skill-gated)                   |
| `compare_skill`     | A/B Skill-Testing (skill-gated)                     |
| `agent`             | Subagent spawnen fuer tiefgehende Aufgaben          |
| `list_agents`       | Verfuegbare Subagents auflisten                     |
| `create_agent`      | Neuen Subagent erstellen                            |
| `run_script`        | Python-Script via `uv run` ausfuehren               |

### 3. Skill-System

- Skills = Markdown-Dateien mit YAML-Frontmatter (in `server/skills/`)
- Dynamisch ladbar per `load_skill` Tool -- injiziert Instruktionen in den System Prompt
- Skill-Gating: Bestimmte Tools (create_skill, update_skill, compare_skill) nur nach Laden des parent Skills verfuegbar
- Skill-Creator V2: A/B Testing mit Grader/Comparator/Analyzer Subagents
- SwarmPromotion: Skill-Voting und Community-Promotion
- 4 Built-in Skills: agent-creator, document-summary, research-report, skill-creator

### 4. RAG Pipeline (Hybrid Search)

- **VectorServiceV2** (`server/src/services/VectorServiceV2.ts`): Weaviate V2 Collection mit hierarchischem Schema (Chunk-Levels, Parent-Child, Path)
- Hybrid Alpha: 0.3 (70% BM25 Keyword, 30% Semantic Vector) -- optimiert fuer deutsche Texte
- Search Threshold: 0.1 (niedrig, damit der Reranker mehr Kandidaten bekommt)
- BGE-reranker-v2-m3 als Reranker
- Graph-RAG: Neo4j Knowledge Graph mit Entity Extraction, Resolution und Refinement

### 5. MCP Connector (SamaWorkforce)

- **McpClientManager** (`server/src/services/mcp/McpClientManager.ts`): MCP Client der sich mit dem SamaWorkforce MCP-Server verbindet
- OAuth 2.1 mit PKCE
- Automatische Tool-Discovery und Registration im ToolRegistry
- Verbindet das Cor7ex-System mit dem Samaritano ERP (NestJS + GraphQL, 65 Queries, 70 Mutations)

### 6. Security

- JWT Auth (HS256) mit httpOnly Cookies
- HTTPS Enforcement, Security Headers, Input Sanitization
- Rate Limiting (Auth: 100/15min, Admin: 100/15min, General: 200/15min)
- PII Guard (Presidio) fuer Cloud-LLM-Provider
- Document Permissions (Application-Level Filtering)
- Audit Logs

---

## Infrastruktur

| Server               | Adresse              | Dienste                                                |
|----------------------|----------------------|--------------------------------------------------------|
| **Hetzner CX43**     | 167.235.135.132      | PostgreSQL, Weaviate, Neo4j, Redis, Presidio, Reranker, Parser |
| **Ubuntu (lokal)**   | 192.168.2.38         | Gleiche Services, umschaltbar via switch-env.sh        |
| **Local Mac**        | localhost             | Ollama :11434, Vite :5173, Express :3001               |

Externe Services werden via SSH-Tunnel erreicht (`server/start-tunnels.sh`).

---

## Spezifikationen (specs/)

25+ Spec-Dateien dokumentieren die gesamte Systemarchitektur in Phasen:

- **00**: Vision (Hive Mind Konzept)
- **01-05**: Foundation, Document Processing, Intelligence Production, RAG Improvements
- **06-11**: HiveMind Phasen 1-5 (LLM, Agents, Skills, Channels, Compliance)
- **12-17**: Agent-Konversation, Skills, Wissensspeicher, Enterprise-Anbindungen, Skills-Refactoring, Context Management
- **18-20**: Hybrid Agent Architecture, Skill-Creator V2, MCP SamaWorkforce
- **21-25**: Hive Mind Orchestrator, Expert Agent Harness, Memory System, Heartbeat Engine, Multi-Tenant

---

## Frontend-Ueberblick

React 19 SPA mit Vite 7. Hauptseiten:

- **LoginPage**: Authentifizierung
- **DocumentsPage**: Dokumentenverwaltung mit Upload, Vorschau (PDF nativ, Markdown gerendert), Permissions
- **AdminUsersPage / AdminSystemSettingsPage**: Administration
- **ProfilePage**: Benutzerprofil
- **AuditLogsPage**: Audit-Logs

Zentrale UI-Komponenten: ChatInput, AgentTaskDetail (zeigt Agent-Steps live), SkillCard/SkillDetail, DocumentList/DocumentPreview, ModelSelector.

Layout: AppShell mit Header, IconRail, Sidebar, ChatArea, WorkspaceLayout.

Kommunikation: REST via httpClient (`src/lib/httpClient.ts`), Real-time via Socket.io (`src/lib/socket.ts`).

---

## Zusammenfassung

Cor7ex ist ein ambitioniertes Enterprise-AI-System, das weit ueber einen einfachen Chat hinausgeht. Es kombiniert:

1. **Agentic AI** (ToolLoopAgent, Subagents, Multi-Turn)
2. **Knowledge Management** (Hybrid RAG, Knowledge Graph, hierarchisches Chunking)
3. **Skill-System** (dynamische Faehigkeiten, A/B Testing, Community-Promotion)
4. **Enterprise-Integration** (MCP/SamaWorkforce, SQL, PII Guard, RBAC)
5. **Hive Mind Vision** (kollektive Intelligenz aus Mensch + KI + Daten + Software)

Das System ist als Monorepo mit Express-Backend und React-Frontend strukturiert, nutzt Bun als Runtime und Vercel AI SDK 6 als AI-Framework.
