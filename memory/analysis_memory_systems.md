---
name: Memory Systems Deep Analysis
description: Technical comparison of Zep, Mem0, and Letta for Cor7ex Hive Mind memory architecture
type: analysis
date: 2026-03-30
---

# Memory Systems Deep Analysis: Zep vs Mem0 vs Letta

## Executive Summary

| Dimension | Zep | Mem0 | Letta |
|---|---|---|---|
| **Core Model** | Temporal Knowledge Graph | Fact Store (Vector + Graph) | Agent-native Block Memory |
| **Self-hosted OSS** | NO (deprecated) | YES (Apache-2.0) | YES (Apache-2.0) |
| **TypeScript SDK** | Cloud-only client | Full OSS + Cloud client | Cloud API client only |
| **Neo4j** | Via Graphiti (Python only) | Native in TS SDK | No |
| **Weaviate** | No | Python only, not in TS SDK | No |
| **PostgreSQL** | No (uses internal DB) | PGVector in TS SDK | Yes (core DB) |
| **Multi-tenant** | Projects + Users + Groups | user_id/agent_id scoping | Agent-level isolation |
| **German language** | LLM-dependent | LLM-dependent | LLM-dependent |
| **License** | Proprietary (Cloud) / Apache-2.0 (Graphiti) | Apache-2.0 (OSS) | Apache-2.0 |
| **Monthly cost** | $475+ (Flex Plus) | Free (OSS) / $249 (Pro) | Free (OSS) / API pricing |

---

## 1. ZEP

### What It Is
Zep is a **context engineering platform** that builds temporal knowledge graphs from conversations. Its open-source engine is **Graphiti** (Apache-2.0, Python-only), while the commercial product is **Zep Cloud** (proprietary, hosted).

### 1.1 Library/SDK Availability

- **TypeScript SDK**: `@getzep/zep-cloud` (v3.18.0) -- **Cloud API client only**. No local processing, all calls go to Zep's servers.
- **Community Edition**: `@getzep/zep-js` (v2.0.2) -- **DEPRECATED**. Docs state: "no longer supported and has been deprecated."
- **Graphiti** (the OSS engine): `pip install graphiti-core` (v0.28.2) -- **Python only**. No TypeScript SDK. This is the actual knowledge graph engine that powers Zep.
- **Self-hosted**: Only via Graphiti (Python). The full Zep product is cloud-only. Enterprise customers can get BYOK/BYOM/BYOC but that's custom pricing.

**Verdict**: Cannot use as a TypeScript library. Would need to run Graphiti as a Python sidecar service, or pay for Zep Cloud.

### 1.2 Architecture Fit for Cor7ex

**Memory Model**:
- Users: YES -- per-user knowledge graphs with fact extraction
- Groups: YES -- shared context graphs not tied to specific users (maps to Hive Mind)
- Agent Memory: PARTIAL -- no native concept of "agent memory." Agents are consumers, not entities with their own memory.

**Multi-Tenant**: Projects serve as top-level isolation. Users and Groups exist within Projects. This maps well to company-level tenancy.

**Cross-Agent Sharing**: Groups enable shared knowledge graphs. Any agent can query both user-specific and group-level graphs. This is architecturally the closest to Hive Mind.

**Infrastructure Integration**:
- Neo4j: Graphiti uses Neo4j 5.26+ natively (also FalkorDB, Kuzu, Neptune)
- Weaviate: NOT supported. Graphiti uses its own embedding storage within Neo4j.
- PostgreSQL: Not used by Zep/Graphiti at all.

### 1.3 Write Pipeline

- LLM extracts entities, facts, and relationships from conversation episodes
- Facts get bi-temporal timestamps (valid_from, valid_until)
- Entity resolution merges duplicate entities automatically
- Contradictions are handled by invalidating old facts (not deleting) and creating new ones with updated validity windows
- Supports both prescribed ontology (predefined entity/edge types via Pydantic) and emergent ontology (learns patterns)
- Incremental: no batch recomputation needed

**This is the strongest write pipeline of all three systems.**

### 1.4 Read Pipeline

- Hybrid search: semantic embeddings + BM25 keyword + graph traversal
- Graph distance reranking
- Sub-second latency claimed; Zep Cloud claims <200ms
- Context assembled via templates for LLM injection

### 1.5 Temporal Awareness

**Best in class.** Bi-temporal tracking:
- When a fact became valid
- When a fact was superseded
- Historical queries across any time period
- "Klinikum X WAS unreliable but improved since January" -- fully supported natively

### 1.6 Integration Effort

- **HIGH if using Graphiti OSS**: Need Python sidecar, need to bridge TypeScript <-> Python, need to build your own API layer
- **MEDIUM if using Zep Cloud**: Just use the TS SDK, but you're locked into their cloud and pricing
- **Cannot keep Weaviate** -- Graphiti uses its own embedding approach within Neo4j
- **Can keep Neo4j** -- Graphiti uses it as primary store

### 1.7 Limitations and Risks

- **Vendor lock-in**: Zep Cloud is proprietary. If they raise prices or shut down, you're stuck.
- **No TypeScript OSS**: Graphiti is Python-only. For a TypeScript/Node.js stack, this is a significant friction.
- **No agent-level memory**: Designed for user conversations, not for agents that learn domain knowledge independently.
- **LLM cost**: Every episode ingestion requires LLM calls for extraction. At scale with many agents processing many interactions, this gets expensive.
- **Community Edition abandoned**: The self-hosted Zep product is dead. Only Graphiti (the engine) survives as OSS.

---

## 2. MEM0

### What It Is
Mem0 is a **memory layer** that automatically extracts, stores, and retrieves facts from conversations using a combination of vector search and optional graph memory. Fully open source (Apache-2.0) with a commercial managed platform.

### 2.1 Library/SDK Availability

- **TypeScript OSS SDK**: `mem0ai` (v2.4.4) -- **Full local implementation**, not just an API client. Contains:
  - Memory class with add/search/update/delete
  - Vector stores: Qdrant, PGVector, Redis, Supabase, Azure AI Search, Langchain adapter, in-memory
  - Graph store: **Neo4j native driver** built-in
  - LLMs: OpenAI, Anthropic, Google, Groq, Ollama, LM Studio, Mistral, Langchain
  - Embedders: OpenAI, Ollama, Google, Azure, LM Studio, Langchain
- **Weaviate**: NOT in TypeScript SDK (Python SDK has it). But Langchain adapter could bridge this.
- **Self-hosted**: YES, fully. The OSS SDK runs entirely locally with your own infrastructure.
- **Vercel AI SDK**: Official `@mem0/vercel-ai-provider` package for direct integration.
- **MCP Server**: `@mem0/mcp-server` available.

**Verdict**: Best TypeScript SDK of the three. Can run fully self-hosted with your existing Neo4j and PostgreSQL (via PGVector).

### 2.2 Architecture Fit for Cor7ex

**Memory Model**:
- User Memory: YES -- scoped via `user_id`. Per-user fact extraction and retrieval.
- Agent Memory: YES -- scoped via `agent_id`. When messages include assistant role, special "agent memory extraction" prompts activate. Supports procedural memories (learned behaviors).
- Hive Mind Memory: PARTIAL -- no built-in "shared/promoted" concept. Would need a custom `org_id` or dedicated shared memory instance.

**Multi-Tenant**: Entity-scoped via `user_id`, `agent_id`, `run_id`. For company isolation, you would add a custom metadata layer or use separate collections/databases per tenant.

**Cross-Agent Sharing**: Not built-in. Each agent's memory is isolated by `agent_id`. Sharing requires explicit read across agent scopes -- doable but must be built.

**Infrastructure Integration**:
- Neo4j: **Native in TypeScript SDK** (neo4j-driver)
- Weaviate: Not in TS SDK, but PGVector available as alternative
- PostgreSQL: PGVector supported natively
- Redis: Supported as vector store

### 2.3 Write Pipeline

1. Messages sent to `memory.add()` with user/agent/session scoping
2. LLM extracts key facts from conversation
3. Each fact is embedded and compared against existing memories (dedup)
4. Second LLM call determines action: ADD, UPDATE, DELETE, or NONE
5. Vector store and graph store operations execute in parallel
6. Graph layer extracts entities and relationships into Neo4j nodes/edges

**Contradiction handling**: LLM-driven. The second LLM call decides whether to UPDATE (replace old fact) or ADD (new fact). Less deterministic than Graphiti's bi-temporal approach -- old facts get overwritten rather than invalidated with timestamps.

**Customization**: Custom extraction prompts, configurable confidence thresholds for graph edges, per-request graph enable/disable toggle.

### 2.4 Read Pipeline

- Semantic vector search with threshold filtering
- Graph queries run in parallel, returning related entities in a `relations` array
- Reranker support (Cohere, HuggingFace, LLM-based)
- Platform claims <50ms retrieval; OSS depends on your infrastructure
- Results can be injected as system prompt context via Vercel AI SDK provider

### 2.5 Temporal Awareness

**Basic.** Timestamps exist:
- `created_at` preserved across updates
- `updated_at` refreshed on modifications
- SQLite history manager records all changes for audit trail

**But**: No bi-temporal validity windows. Cannot natively express "this was true from January to March." Facts are current state, not temporal state. The history log exists for audit but is not queryable as a timeline.

**"Klinikum X WAS unreliable but improved since January"** -- would need to be stored as two separate memories with metadata, or handled via custom prompt engineering. Not natively supported like in Graphiti.

### 2.6 Integration Effort

- **LOW**: TypeScript SDK runs natively in Node.js. PGVector for your existing PostgreSQL, Neo4j for graph memory.
- **Weaviate gap**: Your existing Weaviate won't be used for Mem0's memory. You keep Weaviate for your knowledge base RAG, and use PGVector for memory facts. This is actually clean separation.
- **Vercel AI SDK**: Official provider makes injection into prompts trivial.
- **1-2 weeks** to integrate basic memory layer. Additional time for Hive Mind cross-agent sharing logic.

### 2.7 Limitations and Risks

- **No temporal reasoning**: Biggest gap. Facts are "current truth" not "truth over time."
- **Contradiction handling is LLM-dependent**: Less predictable than deterministic graph invalidation.
- **No native Hive Mind/shared memory**: Cross-agent knowledge sharing must be custom-built.
- **Weaviate not in TS SDK**: Minor issue since PGVector covers the use case.
- **Graph memory is simpler than Graphiti**: Entity/relationship extraction without the bi-temporal sophistication.
- **Vendor risk: LOW**: Apache-2.0, full source code, runs locally. Zero lock-in.

---

## 3. LETTA (formerly MemGPT)

### What It Is
Letta is an **agent framework** with built-in memory management. Agents have structured memory blocks (core, archival, recall) and can self-modify their memory. It's a complete agent platform, not just a memory layer.

### 3.1 Library/SDK Availability

- **TypeScript SDK**: `@letta-ai/letta-client` (v1.10.1) -- **API client only**. Talks to a Letta server.
- **Self-hosted**: YES. Docker image with PostgreSQL+pgvector. Run `docker run letta/letta:latest`.
- **Cannot use as library**: The memory system is tightly coupled to Letta's agent runtime. You cannot extract just the memory layer and use it in your own agent framework.
- **No Neo4j/Weaviate**: Uses PostgreSQL+pgvector exclusively. No graph database support.

**Verdict**: Would require replacing your entire agent architecture with Letta's framework. Memory is not separable from the agent runtime.

### 3.2 Architecture Fit for Cor7ex

**Memory Model**:
- Core Memory: In-context blocks (persona, human) with character limits. Agent can read/write during conversation. Maps to short-term working memory.
- Archival Memory: External vector store for long-term storage. Agent can search and insert.
- Recall Memory: Conversation history storage.
- **User Memory**: Via "human" block -- limited to character count, not a growing fact store.
- **Agent Memory**: Best fit -- each agent has its own memory blocks that it self-manages.
- **Hive Mind**: Via shared memory blocks between agents. Letta supports this natively.

**Multi-Tenant**: Agent-level isolation. Each agent is a separate entity. Tenant isolation would be at the project/deployment level.

**Cross-Agent Sharing**: **Best of the three systems.** Native support for:
- Shared memory blocks (read/write by multiple agents)
- Async/sync inter-agent messaging
- Broadcast to agents by tags
- Supervisor-worker, hierarchical teams, producer-reviewer patterns

### 3.3 Write Pipeline

- **Agent self-modifies**: The agent decides what to remember using `core_memory_append` and `core_memory_replace` tools.
- **No automatic extraction**: Unlike Zep/Mem0, Letta does NOT automatically extract facts from conversations. The agent must be prompted/instructed to do so.
- **Archival memory**: Agent can explicitly insert data with `archival_memory_insert`.
- Contradiction handling: Agent uses `core_memory_replace` to update old text with new text. Relies on LLM judgment.

**This is fundamentally different from Zep/Mem0**: Memory management is the agent's responsibility, not an automatic pipeline.

### 3.4 Read Pipeline

- Core memory is always in context (no retrieval needed, always visible)
- Archival memory via vector search (PostgreSQL+pgvector)
- No hybrid search (no BM25, no graph traversal)
- Latency depends on your PostgreSQL instance

### 3.5 Temporal Awareness

**None built-in.** Core memory blocks are plain text that agents edit. No timestamps on facts, no validity windows, no historical tracking. The agent could write "As of January 2026, Klinikum X improved..." but there's no structured temporal layer.

### 3.6 Integration Effort

- **VERY HIGH / REPLACEMENT**: Letta is not a memory layer -- it's a complete agent platform. Integrating it means:
  - Replacing your Vercel AI SDK agent loop with Letta's agent runtime
  - Replacing your skill/tool system with Letta's tool system
  - Running a Letta server (Docker + PostgreSQL)
  - Abandoning Weaviate and Neo4j for memory (keeping them only for RAG)
- **TypeScript SDK is API-client only**: All logic runs on the Letta server (Python), your Node.js app just sends API calls.

### 3.7 Limitations and Risks

- **All-or-nothing**: Cannot use just the memory system. Must adopt the entire framework.
- **Agent-driven memory is unreliable**: LLM decides what to remember. May forget important facts or remember irrelevant ones.
- **No automatic fact extraction**: Must engineer prompts carefully for each agent to manage its own memory.
- **No temporal layer**: Plain text memory blocks with no structured time tracking.
- **Python server dependency**: Your TypeScript app talks to a Python server. Adds operational complexity.
- **No Neo4j/Weaviate**: Loses your existing graph and vector infrastructure.
- **Vendor risk: LOW**: Apache-2.0, self-hostable. But architecture lock-in is HIGH.

---

## 4. HEAD-TO-HEAD COMPARISON

### Cor7ex Requirements Matrix

| Requirement | Zep | Mem0 | Letta |
|---|---|---|---|
| TypeScript SDK (library, not API client) | NO | **YES** | NO |
| Self-hosted OSS | Graphiti only (Python) | **YES** | YES (full server) |
| User Memory | **YES** | **YES** | Partial |
| Agent Memory | NO | **YES** | **YES** |
| Hive Mind / Shared Memory | **YES** (Groups) | Custom build needed | **YES** (shared blocks) |
| Multi-tenant isolation | **YES** (Projects) | Custom metadata layer | Agent-level only |
| Automatic fact extraction | **YES** | **YES** | NO (agent-driven) |
| Temporal awareness (bi-temporal) | **YES** (best) | Basic timestamps only | NO |
| Contradiction handling | **YES** (invalidation) | LLM-driven (UPDATE) | Agent-driven (replace) |
| Neo4j integration | **YES** (Graphiti) | **YES** (TS SDK) | NO |
| Weaviate integration | NO | NO (in TS SDK) | NO |
| PostgreSQL integration | NO | **YES** (PGVector) | **YES** (pgvector) |
| Vercel AI SDK | NO | **YES** (official) | NO |
| German language | LLM-dependent | LLM-dependent | LLM-dependent |
| Integration effort | HIGH | **LOW** | VERY HIGH |
| Vendor lock-in risk | HIGH (Cloud) / Medium (Graphiti) | **NONE** | LOW (but architecture lock-in) |

### Retrieval Speed

| System | Claimed Latency | Notes |
|---|---|---|
| Zep Cloud | <200ms | Cloud-dependent |
| Mem0 Platform | <50ms | Managed service |
| Mem0 OSS | Depends on infra | Vector search + parallel graph query |
| Letta | Depends on infra | Core memory is always in-context (0ms), archival via pgvector |

---

## 5. COULD WE COMBINE THEM?

### Option A: Mem0 + Graphiti Sidecar
- **Mem0 (TypeScript)** for User Memory and Agent Memory (low-friction, native TS)
- **Graphiti (Python sidecar)** for Hive Mind Memory (temporal knowledge graph, bi-temporal facts)
- Your existing **Weaviate** for RAG/knowledge base search
- Your existing **Neo4j** shared between Mem0 graph memory and Graphiti

**Pros**: Best temporal awareness for company-level knowledge, native TS for agent/user memory
**Cons**: Two memory systems to maintain, Python sidecar adds operational complexity, Neo4j contention

### Option B: Mem0 Only + Custom Temporal Layer
- **Mem0 (TypeScript)** for all three memory layers
- Build a **custom promotion pipeline**: Agent memories get promoted to Hive Mind scope based on frequency/importance
- Add **temporal metadata** manually (valid_from, valid_until fields in memory metadata)
- Use **Neo4j** for graph relationships across all scopes

**Pros**: Single system, all TypeScript, minimal operational complexity
**Cons**: Must build Hive Mind promotion logic and temporal reasoning yourself

### Option C: Letta for Multi-Agent + Mem0 for Memory
- **Letta server** for agent orchestration, inter-agent communication, shared memory blocks
- **Mem0** somehow injected for fact extraction...

**Verdict**: Does not work. Letta's memory is tightly coupled to its agent runtime. You cannot swap in Mem0 as the memory backend.

---

## 6. RECOMMENDATION FOR COR7EX

### Primary Recommendation: Mem0 OSS (Option B)

**Use Mem0 as the foundation and build the missing pieces.**

#### Why Mem0:
1. **Only system with a real TypeScript OSS SDK** that runs as a library in your Node.js process
2. **Native Neo4j graph support** in the TypeScript SDK -- uses your existing Neo4j
3. **Native PGVector support** -- uses your existing PostgreSQL
4. **Vercel AI SDK provider** -- trivial prompt injection
5. **Apache-2.0** -- zero vendor lock-in
6. **Automatic fact extraction** -- LLM-driven pipeline for both user and agent memories
7. **Agent-specific memory** -- built-in `agent_id` scoping with specialized extraction prompts
8. **Lowest integration effort** -- 1-2 weeks for basic integration

#### What You Need to Build on Top:

1. **Hive Mind Layer** (~2-3 weeks):
   - A promotion pipeline: when an agent memory reaches a threshold (confirmed by multiple agents, high confidence, or explicitly promoted by a human), copy/link it to a shared `hive_mind` scope
   - A Hive Mind memory instance with its own `agent_id = "hive_mind"` or a custom scope
   - Query pipeline that merges user + agent + hive_mind results

2. **Temporal Enhancement** (~1-2 weeks):
   - Add `valid_from` and `valid_until` metadata fields to memories
   - Custom extraction prompt that asks the LLM to identify temporal qualifiers
   - Search filter that considers temporal validity
   - History query endpoint using Mem0's built-in history manager

3. **Multi-Tenant Isolation** (~1 week):
   - Prefix collection names with tenant ID, or use separate PGVector schemas per tenant
   - Neo4j: use database-per-tenant or label-based isolation
   - Middleware that enforces tenant context on all memory operations

4. **Contradiction Resolution** (~1 week):
   - Custom prompt for the UPDATE decision that explicitly asks about temporal context
   - Instead of overwriting, create a new memory and mark the old one with `superseded_by` metadata
   - This gives you Graphiti-like temporal tracking without the Python dependency

#### Architecture:

```
Cor7ex Memory Architecture (based on Mem0 OSS)

+------------------+     +------------------+     +------------------+
| User Memory      |     | Agent Memory     |     | Hive Mind Memory |
| scope: user_id   |     | scope: agent_id  |     | scope: org_id    |
| per-employee     |     | per-expert-agent |     | cross-domain     |
+--------+---------+     +--------+---------+     +--------+---------+
         |                         |                         |
         +------------+------------+------------+------------+
                      |                         |
              +-------v-------+         +-------v-------+
              | Mem0 TS SDK   |         | Promotion     |
              | (Library)     |         | Pipeline      |
              +---+-------+---+         | (Custom)      |
                  |       |             +-------+-------+
                  |       |                     |
          +-------v-+   +-v--------+    +-------v-------+
          |PGVector  |   |Neo4j    |    | Temporal      |
          |PostgreSQL|   |Graph    |    | Metadata      |
          +----------+   +---------+    +---------------+

Existing infra reuse:
- PostgreSQL (+ pgvector extension) -> Mem0 vector store
- Neo4j -> Mem0 graph memory
- Weaviate -> Knowledge Base RAG (unchanged, NOT for memory)
- Redis -> Cache layer (unchanged)
```

### Why NOT Zep:
- No TypeScript OSS. Graphiti is Python-only.
- Cloud pricing starts at $475/month for production usage.
- Community Edition is deprecated and abandoned.
- Would need a Python sidecar for Graphiti, adding operational complexity to your Node.js stack.
- The temporal knowledge graph is impressive, but you can approximate 80% of its value with Mem0 + custom temporal metadata.

### Why NOT Letta:
- Not a memory system -- it's a complete agent framework. Would require replacing your entire architecture.
- Cannot extract the memory layer independently.
- No automatic fact extraction (agents must self-manage memory).
- No Neo4j or Weaviate support.
- Python server dependency for a TypeScript stack.

### Future Consideration: Graphiti as Hive Mind Upgrade
If Cor7ex reaches a scale where temporal knowledge graphs become critical (e.g., regulatory compliance requiring "who knew what when"), consider adding Graphiti as a Python microservice specifically for the Hive Mind layer. This is Option A and can be a Phase 2 enhancement without disrupting the Mem0 foundation.

---

## 7. IMPLEMENTATION ROADMAP

### Phase 1: Foundation (Week 1-2)
- Install `mem0ai` OSS SDK
- Configure PGVector (add pgvector extension to existing PostgreSQL)
- Configure Neo4j graph memory connection
- Implement basic memory service: `addMemory()`, `searchMemory()`, `getHistory()`
- Wire up user_id scoping from authentication context

### Phase 2: Agent Memory (Week 3)
- Configure per-agent memory with `agent_id` scoping
- Custom extraction prompts per agent domain (HR extracts people/contracts, Accounting extracts amounts/deadlines)
- Memory injection via Vercel AI SDK provider or custom system prompt builder

### Phase 3: Hive Mind (Week 4-5)
- Build promotion pipeline (frequency-based, human-approved, or cross-agent confirmation)
- Shared memory scope with org-level access
- Merged retrieval: user + agent + hive_mind context assembly

### Phase 4: Temporal + Polish (Week 6)
- Temporal metadata on memories
- Contradiction resolution with supersession tracking
- Multi-tenant isolation hardening
- Monitoring and observability
