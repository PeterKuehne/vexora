# Agent-System aendern: Empfohlene Lesereihenfolge

Basierend auf dem `project-context` Skill (SKILL.md + references/reading-order.md) und Validierung gegen die tatsaechliche Codebase.

---

## Primaere Lesereihenfolge (7 Dateien)

Die `reading-order.md` definiert folgende Reihenfolge fuer die Aufgabe "Agent-System aendern":

### 1. `specs/21_HIVE_MIND_ORCHESTRATOR_SPEC.md` -- Architektur verstehen

**Warum zuerst:** Diese Spec beschreibt den Soll-Zustand des Agent-Systems. Der bestehende AgentExecutor soll zum Hive Mind Orchestrator werden -- ein ToolLoopAgent, der Expert Agents als Subagent-Tools aufruft. Ohne dieses Zielbild kann man keine sinnvollen Aenderungen planen.

### 2. `server/src/services/agents/AgentExecutor.ts` -- Aktueller Agent-Loop

**Warum als zweites:** Dies ist die zentrale Datei des Agent-Systems. Hier laeuft der ToolLoopAgent (Vercel AI SDK 6) mit Multi-Turn-Support, SSE-Streaming, und Lifecycle-Callbacks. Jede Aenderung am Agent-Verhalten betrifft diese Datei.

### 3. `server/src/services/agents/ToolRegistry.ts` -- Tool-Registrierung

**Warum als drittes:** Der ToolRegistry ist ein Singleton, der alle Tools verwaltet und sie nach Rollen/Skills filtert. Wer das Agent-System aendert, muss verstehen wie Tools dem Agent bereitgestellt werden.

### 4. `server/src/services/agents/tools/index.ts` -- Registrierte Tools

**Warum als viertes:** Zeigt alle 15+ Built-in Tools die registriert werden (rag_search, graph_query, sql_query, agent, create_document, load_skill, run_script, etc.). Gibt den Ueberblick darueber, was der Agent aktuell kann.

### 5. `server/src/services/agents/tools/agent.ts` -- Subagent-Pattern

**Warum als fuenftes:** Das agent-Tool implementiert das Subagent-Spawning-Pattern -- ToolLoopAgent mit isoliertem Kontext, abortSignal-Propagation, nur result.text zurueck an den Parent. Dies ist die Vorlage fuer Expert Agents.

### 6. `server/src/services/agents/SubagentLoader.ts` -- Markdown-Parsing fuer Agent-Definitionen

**Warum als sechstes:** Laedt Subagent-Definitionen aus Markdown-Dateien (YAML-Frontmatter + Markdown-Body) aus `server/agents/` (built-in) und `server/user-agents/` (custom). Wer neue Agents hinzufuegen oder das Agent-Format aendern will, muss diesen Loader verstehen.

### 7. `server/src/services/agents/types.ts` -- AgentTool, AgentUserContext Interfaces

**Warum als siebtes:** Definiert alle TypeScript-Interfaces: AgentTool, AgentTask, AgentStep, AgentSSEEvent, AgentUserContext, AgentConfig, ToolResult, etc. Referenz fuer Typen und Vertraege.

---

## Ergaenzende Dateien (je nach Aenderungstyp)

Diese Dateien sind nicht in der Kern-Lesereihenfolge, aber relevant je nach konkreter Aenderung:

### Wenn Expert Agents / Harness geaendert werden:
- `specs/22_EXPERT_AGENT_HARNESS_SPEC.md` -- Deklaratives Framework fuer Expert Agents (Markdown+YAML)
- `server/agents/kb-explorer.md` -- Beispiel-Subagent (Wissensdatenbank-Recherche)
- `server/agents/skill-grader.md`, `skill-comparator.md`, `skill-analyzer.md` -- Weitere Subagents

### Wenn AI-Provider / Modell-Konfiguration betroffen ist:
- `server/src/services/agents/ai-provider.ts` -- OVH AI Endpoints Setup, Modell-Routing
- `server/src/services/agents/ai-middleware.ts` -- PII-Guard, Modell-Wrapping

### Wenn Persistenz / Task-Tracking betroffen ist:
- `server/src/services/agents/AgentPersistence.ts` -- CRUD fuer agent_tasks, agent_steps, agent_messages

### Wenn das Barrel-Export / Init betroffen ist:
- `server/src/services/agents/index.ts` -- Barrel-Export und `initAgentSystem()` Funktion

### Fuer Vision und Gesamtkontext:
- `specs/00_COR7EX_VISION.md` -- Hive Mind Vision, Expert Agents, Memory-Architektur

---

## Zusammenfassung der Dateistruktur

```
server/src/services/agents/
  AgentExecutor.ts        -- Kern: ToolLoopAgent, SSE, Multi-Turn
  ToolRegistry.ts         -- Tool-Verwaltung, Rollen-Filtering
  SubagentLoader.ts       -- Markdown-basierte Agent-Definitionen laden
  AgentPersistence.ts     -- DB-Persistenz fuer Tasks/Steps/Messages
  ai-provider.ts          -- LLM-Provider (OVH/Ollama)
  ai-middleware.ts        -- PII-Guard Middleware
  types.ts                -- Alle TypeScript-Interfaces
  index.ts                -- Barrel-Export + Init
  tools/
    index.ts              -- Registrierung aller Built-in Tools
    agent.ts              -- Subagent-Spawning (Vorlage fuer Expert Agents)
    rag-search.ts         -- RAG Hybrid Search Tool
    graph-query.ts        -- Neo4j Knowledge Graph Tool
    sql-query.ts          -- PostgreSQL Query Tool
    read-chunk.ts         -- Chunk-Loader Tool
    create-document.ts    -- Dokument-Pipeline Tool
    load-skill.ts         -- Skill-Loader Tool
    list-skills.ts        -- Skill-Listing Tool
    create-skill.ts       -- Skill-Creator Tool
    update-skill.ts       -- Skill-Update Tool
    run-skill-test.ts     -- Skill A/B Testing Tool
    list-agents.ts        -- Agent-Listing Tool
    create-agent.ts       -- Agent-Creator Tool
    run-script.ts         -- Python Script Runner Tool
    send-notification.ts  -- Notification Tool

server/agents/            -- Built-in Subagent-Definitionen (Markdown)
  kb-explorer.md
  skill-grader.md
  skill-comparator.md
  skill-analyzer.md

specs/
  21_HIVE_MIND_ORCHESTRATOR_SPEC.md  -- Orchestrator-Architektur
  22_EXPERT_AGENT_HARNESS_SPEC.md    -- Expert Agent Framework
```

---

## Quelle

Lesereihenfolge basiert auf:
- `.claude/skills/project-context/SKILL.md` (Schritt 2: Backend-Struktur)
- `.claude/skills/project-context/references/reading-order.md` (Abschnitt "Agent-System aendern")
- Validierung: Alle 7 Dateien existieren und sind aktuell in der Codebase vorhanden.
