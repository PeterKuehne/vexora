# Phase 2: Agent Framework

**Zeitraum:** Wochen 4-7
**Abhängigkeiten:** Phase 1 (LLM Provider Abstraction)
**Ziel:** Agenten die Multi-Step-Tasks planen, Tools nutzen und Ergebnisse berichten. Erweitert das bestehende `AgenticRAG`-Pattern zu einem allgemeinen Agent-System.

---

## 2.1 Agent-Architektur

```
server/src/services/agents/
  AgentExecutor.ts        ← ReAct-Loop: think → tool call → observe → repeat
  ToolRegistry.ts         ← Registriert Tools die Agenten nutzen können
  AgentPersistence.ts     ← Speichert/Resumiert Tasks in PostgreSQL
  types.ts                ← Agent, Tool, AgentTask, AgentStep Interfaces
  tools/                  ← Built-in Tool-Implementierungen
    rag-search.ts
    graph-query.ts
    read-chunk.ts
    sql-query.ts
    create-document.ts
    send-notification.ts
  index.ts
```

### AgentExecutor (ReAct-Pattern)

Basierend auf dem existierenden `AgenticRAG.ts` (server/src/services/rag/AgenticRAG.ts), das bereits einen Tool-Loop mit 4 Tools implementiert. Dieses Pattern wird generalisiert.

**Input:**
- User-Query + Chat-History
- Verfügbare Tools (aus ToolRegistry, gefiltert nach User-Rolle)
- User-Permissions (JWT Claims: user_id, role, department)
- Optional: Skill-Definition (vordefinierter Workflow)

**Loop:**
1. LLM erhält System-Prompt mit Tool-Beschreibungen + bisherige Steps
2. LLM generiert `thought` (Reasoning) + `tool_call` (Name + Arguments)
3. Tool wird ausgeführt mit User-Kontext (Permission-Vererbung)
4. Tool-Result wird dem Kontext hinzugefügt
5. Wiederholung bis `finish`-Tool aufgerufen wird oder Max-Iterationen erreicht
6. Jeder Step wird in `agent_steps` Tabelle persistiert

**Konfiguration:**
- `MAX_AGENT_ITERATIONS=10` (Default)
- `AGENT_DEFAULT_MODEL=anthropic:claude-sonnet-4-6`
- `AGENT_TIMEOUT_MS=300000` (5 Minuten)

### Permission-Vererbung

Agenten sind keine eigenständigen Akteure – sie handeln **im Namen des Users**:
- Agent erbt JWT-Claims des aufrufenden Users
- `rag_search` Tool nutzt bestehende RLS (sieht nur Dokumente die der User sehen darf)
- `sql_query` Tool nutzt Column-Allowlist basierend auf User-Rolle
- `create_document` Tool setzt `owner_id` auf den aufrufenden User
- Audit-Log: Jeder Tool-Call wird mit `user_id` + `agent_task_id` geloggt

---

## 2.2 Built-in Tools

### rag_search
- **Wraps:** Bestehenden `VectorServiceV2.search()` + `RerankerService.rerank()`
- **Input:** `{ query: string, limit?: number, documentFilter?: string[] }`
- **Output:** Top-K Chunks mit Scores und Dokumenten-Metadaten
- **Permissions:** Nutzt `allowedDocumentIds` aus RLS-Kontext

### graph_query
- **Wraps:** Bestehenden `GraphService.refineRAGResults()`
- **Input:** `{ entities: string[], depth?: number }`
- **Output:** Verwandte Entitäten, Beziehungen, zusätzliche Chunks
- **Permissions:** Nur Entitäten aus zugänglichen Dokumenten

### read_chunk
- **Bestehend aus:** `AgenticRAG.ts`
- **Input:** `{ chunkId: string, expandContext?: boolean }`
- **Output:** Chunk-Inhalt + optional Parent/Sibling-Chunks

### sql_query (Neu)
- **Funktion:** Read-Only SQL gegen PostgreSQL
- **Input:** `{ query: string, params?: any[] }`
- **Sicherheit:**
  - Nur SELECT-Statements erlaubt (Regex-Validierung)
  - Separate DB-Connection mit Read-Only User
  - Column-Allowlist pro Rolle (z.B. Employee darf keine salary-Spalten sehen)
  - Query-Timeout: 10 Sekunden
  - Max Result Rows: 1000
- **Output:** Tabelle als JSON-Array

### create_document (Neu)
- **Funktion:** Erstellt Markdown-Dokument und registriert es im System
- **Input:** `{ title: string, content: string, classification?: string }`
- **Flow:** Speichert Datei → Triggert Processing-Pipeline (Parsing, Chunking, Embedding)
- **Permissions:** Owner wird auf aufrufenden User gesetzt

### send_notification (Neu)
- **Funktion:** Sendet Benachrichtigung an User
- **Input:** `{ message: string, type: 'info' | 'success' | 'warning' }`
- **Flow:** Socket.io Event an User-Session oder in Notification-Queue

---

## 2.3 Datenbank

### Migration `010_agent_system.sql`

```sql
CREATE TABLE agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  tenant_id UUID,
  conversation_id UUID REFERENCES conversations(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','paused','completed','failed','cancelled')),
  query TEXT NOT NULL,
  skill_id UUID,        -- NULL für Ad-hoc Tasks
  model TEXT NOT NULL,
  result JSONB,          -- Finales Ergebnis
  error TEXT,
  total_steps INTEGER DEFAULT 0,
  total_duration_ms INTEGER,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE agent_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  thought TEXT,            -- LLM Reasoning
  tool_name TEXT,          -- Welches Tool aufgerufen wurde
  tool_input JSONB,        -- Tool-Argumente
  tool_output TEXT,        -- Tool-Ergebnis (truncated bei großen Outputs)
  tokens_used INTEGER DEFAULT 0,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices
CREATE INDEX idx_agent_tasks_user ON agent_tasks(user_id, status, created_at DESC);
CREATE INDEX idx_agent_tasks_conversation ON agent_tasks(conversation_id);
CREATE INDEX idx_agent_steps_task ON agent_steps(task_id, step_number);

-- RLS
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_tasks_user_access ON agent_tasks
  FOR ALL USING (
    user_id = current_setting('app.user_id', true)::uuid
    OR (
      current_setting('app.user_role', true) = 'Manager'
      AND tenant_id = (SELECT tenant_id FROM users WHERE id = current_setting('app.user_id', true)::uuid)
    )
    OR current_setting('app.user_role', true) = 'Admin'
  );
```

---

## 2.4 API Endpoints

### Neue Route `server/src/routes/agents.ts`

```
POST   /api/agents/run                 → Agent-Task starten
  Body: { query: string, model?: string, conversationId?: string }
  Response: { taskId: string } + SSE-Stream Header

GET    /api/agents/tasks               → User-Tasks listen (paginiert)
  Query: ?status=running&limit=20&offset=0
  Response: { tasks: AgentTask[], total: number }

GET    /api/agents/tasks/:id           → Task-Details mit Steps
  Response: { task: AgentTask, steps: AgentStep[] }

POST   /api/agents/tasks/:id/cancel    → Laufenden Task abbrechen
  Response: { success: boolean }

GET    /api/agents/tasks/:id/stream    → SSE-Stream für Echtzeit-Updates
  Events: step:start, step:complete, task:complete, task:error
```

### SSE-Stream Format

```
event: step:start
data: {"stepNumber": 1, "thought": "Ich suche nach relevanten Dokumenten..."}

event: step:complete
data: {"stepNumber": 1, "toolName": "rag_search", "duration": 1234}

event: task:complete
data: {"taskId": "...", "result": "...", "totalSteps": 3, "duration": 5678}
```

---

## 2.5 Frontend

### AgentContext.tsx

Neuer Context für Agent-Task-State:
- `tasks: AgentTask[]` – Aktive und kürzliche Tasks
- `activeTask: AgentTask | null` – Aktuell laufender Task
- `startTask(query, model)` – Startet Agent und öffnet SSE-Stream
- `cancelTask(taskId)` – Bricht Task ab
- `loadTasks()` – Lädt Task-Historie

### Chat-Integration

- "Agent Mode"-Toggle im ChatInput (neben RAG-Toggle)
- Wenn aktiv: User-Message wird an `/api/agents/run` statt `/api/chat` gesendet
- Agent-Antwort wird als spezielle AI-Message dargestellt mit:
  - Thinking Steps (aufklappbar)
  - Tool-Calls (mit Input/Output)
  - Finales Ergebnis

### AgentTaskSidebar

- Liste laufender/kürzlicher Tasks
- Status-Badges (running, completed, failed)
- Click → öffnet Task-Detail

### AgentTaskDetail

- Step-für-Step Timeline
- Thought-Bubbles + Tool-Call-Cards
- Duration pro Step
- Token-Verbrauch + Kosten

---

## Dateien-Übersicht

### Geänderte Dateien
| Datei | Änderung |
|-------|----------|
| `server/src/index.ts` | Agent-Routes mounten |
| `server/src/services/rag/AgenticRAG.ts` | Pattern extrahieren, referenzieren |
| `src/App.tsx` | AgentContext Provider |
| `src/components/ChatContainer.tsx` | Agent-Mode Toggle |
| `src/components/ChatInput.tsx` | Agent-Mode Button |

### Neue Dateien
| Datei | Zweck |
|-------|-------|
| `server/src/services/agents/AgentExecutor.ts` | ReAct-Loop |
| `server/src/services/agents/ToolRegistry.ts` | Tool-Verwaltung |
| `server/src/services/agents/AgentPersistence.ts` | DB-Persistence |
| `server/src/services/agents/types.ts` | TypeScript-Interfaces |
| `server/src/services/agents/tools/*.ts` | 6 Built-in Tools |
| `server/src/routes/agents.ts` | API-Endpoints |
| `server/src/migrations/010_agent_system.sql` | DB-Schema |
| `src/contexts/AgentContext.tsx` | Frontend-State |
| `src/components/AgentTaskSidebar.tsx` | Task-Liste |
| `src/components/AgentTaskDetail.tsx` | Task-Detail-View |

---

## Verifikation

1. **Agent starten:** Query senden → Task wird erstellt, Steps erscheinen in Echtzeit
2. **RAG-Tool:** Agent nutzt `rag_search` → findet relevante Dokumente
3. **Permission-Test:** Employee-Agent findet keine restricted Dokumente
4. **Abbrechen:** Laufenden Task canceln → Status wechselt zu 'cancelled'
5. **Persistenz:** Browser schließen, öffnen → abgeschlossene Tasks sind sichtbar
6. **Kosten-Tracking:** Cloud-Agent-Calls erscheinen in `api_usage_log`
7. **Audit:** Agent-Steps sind in DB nachvollziehbar
