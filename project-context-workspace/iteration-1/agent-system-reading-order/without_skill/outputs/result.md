# Agent-System Lesereihenfolge

Um das Agent-System zu verstehen und zu aendern, sollten die Dateien in der folgenden Reihenfolge gelesen werden. Die Reihenfolge geht von den Grundlagen (Typen, Datenbank) zu den hoeheren Schichten (Executor, Routes, Frontend).

---

## Phase 1: Typen und Datenmodell

Diese Dateien definieren die Grundstruktur -- ohne sie versteht man die restlichen Dateien nicht.

### 1. `server/src/services/agents/types.ts`
**Warum zuerst:** Definiert alle zentralen Interfaces und Typen (`AgentTool`, `AgentTask`, `AgentStep`, `AgentMessage`, `AgentUserContext`, `AgentSSEEvent`, `AgentConfig`). Jede andere Datei im Agent-System importiert aus dieser Datei.

### 2. `server/src/migrations/010_agent_system.sql`
**Warum:** Zeigt das Datenbankschema fuer `agent_tasks` und `agent_steps` -- inklusive RLS-Policies. Erklaert, welche Felder persistiert werden.

### 3. `server/src/migrations/012_agent_multi_turn.sql`
**Warum:** Fuegt `agent_messages` hinzu, erweitert Steps um `turn_number`, und ergaenzt den Status `awaiting_input`. Unverzichtbar fuer das Verstaendnis der Multi-Turn-Konversationen.

---

## Phase 2: Kern-Services (Backend)

Die zentralen Services, die das Agent-System ausmachen.

### 4. `server/src/services/agents/ToolRegistry.ts`
**Warum:** Singleton-Registry, in der alle Tools registriert werden. Stellt `getAISDKTools()` bereit, das die Tools im Vercel AI SDK Format liefert. Implementiert Skill-Gating und rollenbasierte Filterung.

### 5. `server/src/services/agents/AgentPersistence.ts`
**Warum:** CRUD-Schicht fuer Tasks, Steps und Messages. Hier wird klar, wie die Daten in die DB geschrieben und gelesen werden, inklusive RLS via `set_config`.

### 6. `server/src/services/agents/ai-provider.ts`
**Warum:** Konfiguriert den AI-Provider (OVH AI Endpoints). `resolveModel()` wird vom AgentExecutor aufgerufen. Definiert ausserdem Kostenberechnung und Cloud-Model-Metadaten.

### 7. `server/src/services/agents/ai-middleware.ts`
**Warum:** PII-Guard Integration. Eher duenn (Masking auf Message-Level), aber wichtig zu wissen, dass es existiert.

### 8. `server/src/services/agents/AgentExecutor.ts`
**Warum:** Das Herzst ueck des Systems. Erstellt `ToolLoopAgent`-Instanzen pro Turn, verwaltet:
- `execute()` fuer den ersten Turn
- `continueTask()` fuer Folgenachrichten
- `runTurn()` mit SSE-Callbacks, Lifecycle-Hooks, Message-Pruning
- System-Prompt-Aufbau (Skills, Subagents, Workflow-Regeln)
- `prepareStep()` fuer dynamische Tool-Steuerung

### 9. `server/src/services/agents/SubagentLoader.ts`
**Warum:** Laedt Subagent-Definitionen aus Markdown-Dateien (`server/agents/` und `server/user-agents/`). Wird vom AgentExecutor fuer den System-Prompt und vom `agent`-Tool genutzt.

### 10. `server/src/services/agents/index.ts`
**Warum:** Barrel-Export und `initializeAgentSystem()` -- zeigt wie alles zusammengefuegt wird und bei Server-Start initialisiert wird.

---

## Phase 3: Tools

Jedes Tool implementiert das `AgentTool`-Interface. Lese zuerst die Registrierung, dann die wichtigsten Tools.

### 11. `server/src/services/agents/tools/index.ts`
**Warum:** `registerBuiltinTools()` -- die zentrale Stelle, die alle 14 Tools registriert. Zeigt die vollstaendige Tool-Liste auf einen Blick.

### 12. `server/src/services/agents/tools/rag-search.ts`
**Warum:** Das am haeufigsten genutzte Tool. Zeigt das Tool-Pattern: Zod-Schema, `execute()` mit Context, Ergebnis-Formatierung.

### 13. `server/src/services/agents/tools/agent.ts`
**Warum:** Das Subagent-Tool. Spawnt einen eigenen `ToolLoopAgent` mit isoliertem Kontext. Demonstriert Nesting-Prevention und Kontext-Isolation.

### 14. `server/src/services/agents/tools/create-agent.ts`
**Warum:** Skill-gated Tool (`skillGated: 'agent-creator'`). Zeigt wie neue Subagents als MD-Dateien erstellt werden.

### 15. `server/src/services/agents/tools/list-agents.ts`
**Warum:** Einfaches Tool, gut als Minimal-Beispiel.

### Weitere Tools (bei Bedarf):
- `tools/load-skill.ts` -- Progressive Disclosure (Skill laden)
- `tools/create-skill.ts`, `tools/update-skill.ts` -- Skill-CRUD
- `tools/read-chunk.ts` -- Dokument-Detail lesen
- `tools/graph-query.ts` -- Neo4j Wissensgraph
- `tools/sql-query.ts` -- Direkter DB-Zugriff (Admin-only)
- `tools/run-script.ts` -- Python-Script Ausfuehrung
- `tools/create-document.ts` -- Dokument erstellen
- `tools/send-notification.ts` -- Benachrichtigungen
- `tools/run-skill-test.ts` -- A/B-Test fuer Skills

---

## Phase 4: Subagent-Definitionen

### 16. `server/agents/kb-explorer.md`
**Warum:** Der wichtigste built-in Subagent. YAML-Frontmatter mit `name`, `description`, `tools`, `maxSteps` + Markdown-Body als Instruktionen.

### Weitere Subagents:
- `server/agents/skill-grader.md`
- `server/agents/skill-comparator.md`
- `server/agents/skill-analyzer.md`

Custom Subagents liegen in `server/user-agents/{tenant}/`.

---

## Phase 5: API-Routes

### 17. `server/src/routes/agents.ts`
**Warum:** Alle REST-Endpoints des Agent-Systems:
- `POST /api/agents/run` -- Neuen Task starten (SSE-Stream)
- `POST /api/agents/tasks/:id/message` -- Follow-up senden (SSE-Stream)
- `POST /api/agents/tasks/:id/complete` -- Konversation beenden
- `POST /api/agents/tasks/:id/cancel` -- Abbrechen
- `GET /api/agents/tasks` -- Task-Liste
- `GET /api/agents/tasks/:id` -- Task-Detail
- `GET /api/agents/subagents` -- Subagent-Liste (fuer @-mention)
- `DELETE /api/agents/tasks/:id` -- Task loeschen

### 18. `server/src/routes/agent-evaluation.ts` (optional)
**Warum:** Admin-Endpoints fuer Agent-Benchmarks. Nur relevant wenn du die Evaluierung aendern willst.

---

## Phase 6: Frontend

### 19. `src/contexts/AgentContext.tsx`
**Warum:** Zentrales State-Management (React Context). Verwaltet Tasks, SSE-Stream-Processing, und bietet `startTask()`, `sendMessage()`, `cancelTask()`, `completeTask()`, `deleteTask()`.

### 20. `src/components/ChatInput.tsx`
**Warum:** Eingabefeld mit Slash-Command (`/skill`) und @-mention (`@agent`) Support. Sendet Nachrichten an den AgentContext.

### 21. `src/components/AgentTaskDetail.tsx`
**Warum:** Rendert die Multi-Turn-Konversation: User-Messages, Agent-Antworten, Tool-Call-Details, Reasoning.

### 22. `src/components/AgentTaskSidebar.tsx`
**Warum:** Sidebar mit Task-Liste, gruppiert nach Datum. Zeigt aktive Tasks, ermoeglicht Loeschen und Wechseln.

---

## Phase 7: Server-Initialisierung

### 23. `server/src/index.ts` (Zeilen 35-41, Route-Registrierung)
**Warum:** Zeigt wo `agentRoutes`, `agentEvalRoutes` eingebunden werden und wo `initializeAgentSystem()` aufgerufen wird.

---

## Zusammenfassung der Architektur

```
Frontend (React)
  ChatInput.tsx          --> Eingabe, Slash-Commands, @-mentions
  AgentContext.tsx        --> SSE-Stream, State, API-Calls
  AgentTaskDetail.tsx     --> Konversation rendern
  AgentTaskSidebar.tsx    --> Task-Liste

API (Express)
  routes/agents.ts       --> REST-Endpoints, SSE-Setup

Backend Services
  AgentExecutor.ts       --> ToolLoopAgent, Multi-Turn, System-Prompt
  ToolRegistry.ts        --> Tool-Verwaltung, Skill-Gating
  AgentPersistence.ts    --> DB-CRUD, RLS
  SubagentLoader.ts      --> MD-basierte Subagent-Definitionen
  ai-provider.ts         --> Model-Aufloesung (OVH)
  ai-middleware.ts       --> PII-Schutz

Tools (server/src/services/agents/tools/)
  14 Tools: rag_search, agent, graph_query, read_chunk, sql_query,
            create_document, send_notification, list_skills, load_skill,
            create_skill, update_skill, compare_skill, list_agents,
            create_agent, run_script

Subagent-Definitionen (Markdown)
  server/agents/         --> Built-in (kb-explorer, skill-grader, ...)
  server/user-agents/    --> Custom (pro Tenant)

Datenbank
  agent_tasks            --> Task-Metadaten, Status, Token-Counts
  agent_steps            --> Tool-Aufrufe pro Step
  agent_messages         --> Konversationsverlauf (Multi-Turn)
```

---

## Empfehlung je nach Aenderungstyp

| Aenderung | Dateien |
|---|---|
| Neues Tool hinzufuegen | `types.ts` (Interface), neues `tools/xyz.ts`, `tools/index.ts` (registrieren) |
| System-Prompt aendern | `AgentExecutor.ts` (`buildSystemPrompt()`) |
| Neuen Subagent erstellen | `server/agents/name.md` (Markdown mit YAML-Frontmatter) |
| Multi-Turn-Logik aendern | `AgentExecutor.ts` (`runTurn()`, `continueTask()`) |
| SSE-Events erweitern | `types.ts` (Event-Type), `AgentExecutor.ts` (emit), `AgentContext.tsx` (handling) |
| Neuen Provider hinzufuegen | `ai-provider.ts` |
| DB-Schema erweitern | Neue Migration + `AgentPersistence.ts` anpassen |
| Frontend-Darstellung | `AgentTaskDetail.tsx`, `AgentContext.tsx` |
| Tool-Berechtigungen | `types.ts` (`requiredRoles`, `skillGated`), `ToolRegistry.ts` |
