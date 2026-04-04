# Hive Mind Enterprise Platform – Architektur-Overview

## Context

Das Projekt (aktuell "Cor7ex") wird von einem RAG-Chat zu einer Hive-Mind-Plattform umgebaut. Menschen und Agenten greifen rechtebasiert auf einen zentralen Wissensspeicher zu, nutzen Skills und kommunizieren über mehrere Kanäle.

**Auslöser:** RAG-Chat reicht nicht aus. Es fehlen: Agent-Reasoning, Tool-Nutzung, wiederverwendbare Skills, Multi-Channel-Zugang, Cloud-LLM.

**Ziel:** Enterprise AI-Plattform mit Hybrid-LLM (lokal + Claude), Agent-Framework, Skill-System, Multi-Channel-Zugang und DSGVO/AI-Act-Compliance.

---

## Architektur-Entscheidungen

### Projektname
Wird noch festgelegt. Das Produkt ist ein anderes als der bisherige RAG-Chat "Cor7ex".

### Modularer Monolith
Kein Microservice-Split. Team ist klein (1-2 Entwickler). Klare Verzeichnisgrenzen statt Service-Grenzen. Agent-Executor kann bei Bedarf später als Worker-Prozess via Redis Queue extrahiert werden.

### Multi-Tenancy-fähig
System wird zunächst intern (Samaritano) genutzt, aber so gebaut, dass Multi-Tenancy später möglich ist. `tenant_id` Spalte auf zentralen Tabellen von Anfang an. Tenant-Isolation über RLS.

### Konversationen in PostgreSQL
Migration von LocalStorage zu PostgreSQL. Konversationen, Messages, Agent-Tasks – alles serverseitig. Ermöglicht Multi-Channel, geräteübergreifenden Zugriff und Durchsuchbarkeit.

### LLM-Strategie: Hybrid
- **Claude Sonnet 4.6** (Anthropic API direkt, ~$3/$15 pro MTok) für Agent-Reasoning und Skills
- **Lokales Ollama** für Embeddings, Reranking, einfache Klassifikation (sensible Daten verlassen nie den Server)
- **PII-Guard** maskiert sensible Daten vor Cloud-Calls
- **Provider-Abstraktion** ermöglicht Wechsel zu Bedrock/Vertex ohne Code-Änderung

### Was bleibt (Fundament)
Auth (JWT + OAuth2 + RBAC), PostgreSQL mit RLS, Weaviate V2 hierarchische Vektorsuche, Neo4j Knowledge Graph, BGE Reranker, Docling Parser, Tracing, Guardrails, Audit Logs, Dokumenten-Pipeline.

---

## Phasen-Übersicht

| Phase | Titel | Wochen | Spec |
|-------|-------|--------|------|
| 1 | LLM Abstraction + PII Guard + Conversations DB | 1-3 | [07_HIVEMIND_PHASE1_LLM.md](07_HIVEMIND_PHASE1_LLM.md) |
| 2 | Agent Framework | 4-7 | [08_HIVEMIND_PHASE2_AGENTS.md](08_HIVEMIND_PHASE2_AGENTS.md) |
| 3 | Skill System | 8-10 | [09_HIVEMIND_PHASE3_SKILLS.md](09_HIVEMIND_PHASE3_SKILLS.md) |
| 4 | Multi-Channel Access | 11-14 | [10_HIVEMIND_PHASE4_CHANNELS.md](10_HIVEMIND_PHASE4_CHANNELS.md) |
| 5 | Knowledge Enhancement + Compliance | 15-18 | [11_HIVEMIND_PHASE5_COMPLIANCE.md](11_HIVEMIND_PHASE5_COMPLIANCE.md) |

### Abhängigkeiten

```
Phase 1 (LLM Abstraction)     → Sofort starten, keine Abhängigkeiten
    ↓
Phase 2 (Agent Framework)     → Braucht Phase 1 für Claude-Zugang
    ↓
Phase 3 (Skill System)        → Braucht Phase 2 für Agent-Execution
    ↓                              ↑
Phase 4 (Multi-Channel)       → Braucht Phase 2, parallel zu Phase 3 möglich
    ↓
Phase 5 (Knowledge + Compliance) → Braucht Phase 2-3
```

---

## Kosten-Schätzung (Anthropic API)

Claude Sonnet 4.6 bei $3/$15 pro MTok:

| Szenario | Input | Output | Kosten |
|----------|-------|--------|--------|
| Agent-Task (durchschnittlich) | ~5K Token | ~2K Token | ~$0.045 |
| Chat-Query (einfach) | ~2K Token | ~500 Token | ~$0.014 |
| 100 Queries/Tag | - | - | ~$42/Monat |
| Mit Prompt Caching (80% Hit) | - | - | ~$15/Monat |

Safety: `MAX_MONTHLY_CLOUD_SPEND` Env-Variable, LLMRouter fällt auf Ollama zurück bei Limit.

---

## Ziel-Verzeichnisstruktur (nach allen Phasen)

```
server/src/
  channels/              ← Phase 4: Multi-Channel Adapter
  config/                ← Bestehend: Env-Konfiguration
  errors/                ← Bestehend: Error-Types
  middleware/             ← Bestehend: Auth, Security, Rate Limiting
  migrations/             ← Bestehend + neu (009-013)
  routes/                 ← Phase 1: extrahiert + neue Route-Dateien
    agents.ts             ← Phase 2
    chat.ts               ← Phase 1 (extrahiert)
    conversations.ts      ← Phase 1 (neu)
    documents.ts          ← Phase 1 (extrahiert)
    graph.ts              ← Phase 5
    models.ts             ← Phase 1 (extrahiert)
    rag.ts                ← Phase 1 (extrahiert)
    skills.ts             ← Phase 3
  services/
    agents/               ← Phase 2: Agent-Framework
    cache/                ← Bestehend: Redis Cache
    chunking/             ← Bestehend: Dokument-Chunking
    context/              ← Phase 5: Kontext-Injection
    evaluation/           ← Bestehend: RAG-Evaluation
    graph/                ← Bestehend: Neo4j Knowledge Graph
    guardrails/           ← Bestehend: Input/Output-Validierung
    llm/                  ← Phase 1: Provider-Abstraktion
    monitoring/           ← Bestehend: System-Monitoring
    observability/        ← Bestehend: Tracing
    parsing/              ← Bestehend: Dokument-Parsing
    rag/                  ← Bestehend: RAG-Pipeline
    skills/               ← Phase 3: Skill-System
  types/
  utils/
  validation/
```
