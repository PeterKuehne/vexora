# Phase 2: Agent Framework

**Status:** Implementiert (migriert auf Vercel AI SDK 6)
**Abhängigkeiten:** Phase 1 (LLM Provider Abstraction — ersetzt durch AI SDK)
**Ziel:** Agenten die Multi-Step-Tasks planen, Tools nutzen und Ergebnisse berichten. Multi-Turn Konversationen für interaktive Workflows.

---

## 2.1 Agent-Architektur

```
server/src/services/agents/
  AgentExecutor.ts        ← Multi-Turn via AI SDK generateText() + stopWhen
  ToolRegistry.ts         ← Registriert Tools, liefert AI SDK + legacy Formate
  AgentPersistence.ts     ← Tasks, Steps, Messages in PostgreSQL mit RLS
  ai-provider.ts          ← resolveModel(), parseModelString(), Provider-Setup
  ai-middleware.ts        ← PII Guard Integration (setPIIGuard, createGuardedModel)
  types.ts                ← AgentTask, AgentStep, AgentMessage, SSE Events
  tools/                  ← Built-in Tool-Implementierungen
    rag-search.ts
    graph-query.ts
    read-chunk.ts
    sql-query.ts
    create-document.ts
    send-notification.ts
    list-skills.ts
    load-skill.ts
    create-skill.ts
    update-skill.ts
    run-skill-test.ts     ← Sub-Agent via generateText()
  index.ts                ← registerBuiltinTools() + cleanupStaleTasks()
```

### AgentExecutor (Vercel AI SDK 6)

Nutzt `generateText()` mit `stopWhen: stepCountIs(n)` statt manuellem ReAct-Loop. Das AI SDK übernimmt automatisch:
- Multi-Step Tool-Calling (Model ruft Tool auf → Ergebnis → nächster Schritt)
- Tool-Format-Konvertierung (AI SDK `tool()` + `jsonSchema()`)
- Provider-Routing (Anthropic, Ollama via `resolveModel()`)

**Kern-Methoden:**

| Methode | Zweck |
|---------|-------|
| `execute(query, context, options)` | Neue Konversation starten (Turn 1) |
| `continueTask(taskId, message, context)` | Follow-up Nachricht (Turn N) |
| `completeTask(taskId)` | Konversation beenden |
| `cancel(taskId)` | Laufenden Task abbrechen |
| `isRunning(taskId)` | Prüfen ob Task aktiv |
| `buildSystemPrompt(toolNames, context)` | System-Prompt mit Skills (Level 1) |

**Multi-Turn Flow:**
1. `execute()` erstellt Task + erste User-Message in DB
2. Ruft `runTurn()` auf → `generateText({ messages, tools, ... })`
3. Agent antwortet, Status wird `awaiting_input`
4. User sendet Follow-up → `continueTask()` lädt Message-History aus DB
5. Ruft `runTurn()` mit voller History auf → Agent hat vollen Kontext
6. Wiederholung bis User `completeTask()` aufruft

**Konfiguration (Umgebungsvariablen):**
- `MAX_AGENT_ITERATIONS=10` (Default Steps pro Turn)
- `AGENT_DEFAULT_MODEL=anthropic:claude-sonnet-4-6`
- `AGENT_TIMEOUT_MS=300000` (5 Minuten)

### AI Provider (ai-provider.ts)

Ersetzt den alten LLMRouter. Zentrales Model-Resolution:

```typescript
resolveModel('anthropic:claude-sonnet-4-6')  → @ai-sdk/anthropic Provider
resolveModel('qwen3:8b')                     → ollama-ai-provider-v2
resolveModel('ollama:qwen3:8b')              → ollama-ai-provider-v2
```

**Funktionen:**
- `resolveModel(modelString)` — Gibt AI SDK LanguageModel zurück
- `parseModelString(model)` — Parst Provider + Model-Name
- `hasProvider(name)` — Prüft Verfügbarkeit
- `isCloudModel(model)` — Cloud vs. lokal
- `getProviderOptions(model)` — Ollama: `{ think: false }` für Tool-Calling
- `getCloudModels()` — Statische Cloud-Model-Liste mit Pricing

### PII Guard Middleware (ai-middleware.ts)

PII-Masking für Cloud-Provider via Presidio (Analyzer + Anonymizer):

- `setPIIGuard(guard)` — Wird beim Server-Start gesetzt
- `createGuardedModel(model, isCloud)` — Wraps Model (aktuell Passthrough, PII auf Message-Level)
- `maskMessages(messages, isCloud)` — Maskiert PII in Messages
- `unmaskContent(content, isCloud)` — Demaskiert PII in Antworten

### SSE Event Emission

Events werden via Callback-Funktion (`SSEEmitter`) direkt an die HTTP Response gesendet — kein EventEmitter-Pattern mehr.

```typescript
const emitSSE = (event: AgentSSEEvent) => {
  res.write(`event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`);
};

agentExecutor.execute(query, context, { emitSSE });
```

### Permission-Vererbung

Agenten handeln **im Namen des Users**:
- Agent erbt JWT-Claims des aufrufenden Users (userId, userRole, department)
- `rag_search` nutzt bestehende RLS (sieht nur erlaubte Dokumente)
- `sql_query` nur SELECT, 10s Timeout, 1000 Rows, Manager/Admin only
- `create_document` setzt owner auf aufrufenden User
- Jeder Step wird mit task_id + user_id in DB persistiert

### Server-Start Cleanup

`initializeAgentSystem()` beim Start:
1. Registriert alle Built-in Tools
2. Setzt `running`/`pending` Tasks auf `cancelled` (kein AbortController nach Restart)
3. `awaiting_input` Tasks bleiben erhalten (können nach Restart fortgesetzt werden)

---

## 2.2 Built-in Tools (11 Stück)

| Tool | Zweck | Einschränkungen |
|------|-------|-----------------|
| `rag_search` | Hybrid-Suche (BM25 + Semantic) in Dokumenten | RLS-gefiltert |
| `read_chunk` | Chunk-Details mit Kontext-Erweiterung (Adjacent Chunks) | Validiert Chunk-ID Format |
| `graph_query` | Neo4j Entity-Suche + Beziehungen | Optional (GRAPH_ENABLED) |
| `sql_query` | Read-Only SQL (nur SELECT) | Manager/Admin, 10s Timeout, 1000 Rows |
| `create_document` | Text-Dokument erstellen | Setzt Classification Level |
| `send_notification` | Echtzeit-Benachrichtigung via Socket.io | info/success/warning/error |
| `list_skills` | Skills durchsuchen (Kategorie, Suche) | Max 20 Ergebnisse |
| `load_skill` | Skill-Instruktionen laden (Progressive Disclosure Level 2) | Trackt Execution |
| `create_skill` | Neuen Personal-Skill erstellen | Validiert Definition |
| `update_skill` | Bestehenden Skill aktualisieren | Nur Owner/Admin |
| `run_skill_test` | Sub-Agent Test (mit/ohne Skill, A/B-Vergleich) | Eigener generateText() Call |

### ToolRegistry

Zentrale Registrierung mit Rollen-basierter Filterung:

```typescript
toolRegistry.register(tool)              // Tool registrieren
toolRegistry.getAvailableTools(context)  // Nach Rolle gefiltert
toolRegistry.getAISDKTools(context)      // AI SDK Format (tool() + jsonSchema())
toolRegistry.getToolNames()              // Für SkillValidator
```

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
    CHECK (status IN ('pending','running','completed','failed','cancelled','awaiting_input')),
  query TEXT NOT NULL,
  model TEXT NOT NULL,
  result JSONB,
  error TEXT,
  total_steps INTEGER DEFAULT 0,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE agent_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  turn_number INTEGER DEFAULT 1,
  thought TEXT,
  tool_name TEXT,
  tool_input JSONB,
  tool_output TEXT,
  tokens_used INTEGER DEFAULT 0,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Migration `012_agent_multi_turn.sql`

```sql
CREATE TABLE agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
  turn_number INTEGER NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_messages_task ON agent_messages(task_id, turn_number);
```

### RLS

- Tasks: User sieht eigene, Manager sieht Tenant, Admin sieht alle
- Steps: Folgt Task-Visibility (CASCADE)
- Messages: Folgt Task-Visibility

---

## 2.4 API Endpoints

```
POST   /api/agents/run                    → Neue Konversation starten (Turn 1, SSE)
POST   /api/agents/tasks/:id/message      → Follow-up Nachricht senden (Turn N, SSE)
POST   /api/agents/tasks/:id/complete     → Konversation beenden
POST   /api/agents/tasks/:id/cancel       → Laufenden Task abbrechen
GET    /api/agents/tasks                  → Task-Liste (paginiert, RLS)
GET    /api/agents/tasks/:id             → Task + Steps + Messages laden
GET    /api/agents/tasks/:id/stream      → Task-Daten für Reconnect/Polling
```

### SSE Events

```
event: task:start
data: {"taskId": "..."}

event: step:start
data: {"taskId": "...", "stepNumber": 1}

event: step:tool_start
data: {"taskId": "...", "stepNumber": 1, "toolName": "rag_search", "toolInput": {...}}

event: step:tool_complete
data: {"taskId": "...", "stepNumber": 1, "toolName": "rag_search", "toolOutput": "...", "duration": 1234}

event: step:complete
data: {"taskId": "...", "stepNumber": 1, "thought": "...", "duration": 1500}

event: task:complete
data: {"taskId": "...", "result": "...", "totalSteps": 3, "nextStatus": "awaiting_input", "turnNumber": 1}

event: task:error
data: {"taskId": "...", "error": "..."}

event: task:cancelled
data: {"taskId": "..."}
```

`nextStatus: "awaiting_input"` signalisiert dem Frontend dass der Agent auf weitere Eingabe wartet.

---

## 2.5 Frontend

### AgentContext.tsx

State-Management für Multi-Turn Agent-Konversationen:

| Action | Zweck |
|--------|-------|
| `startTask(query, model)` | Neue Konversation starten, SSE-Stream verarbeiten |
| `sendMessage(taskId, message)` | Follow-up senden, SSE-Stream verarbeiten |
| `completeTask(taskId)` | Konversation beenden |
| `cancelTask(taskId)` | Laufenden Task abbrechen |
| `getTaskDetail(taskId)` | Task + Steps + Messages aus API laden |
| `loadTasks()` | Task-Liste laden |

**State:**
- `tasks: AgentTask[]` — Alle Tasks mit Steps und Messages
- `activeTaskId: string | null` — Aktuell angezeigte Konversation
- `isLoading: boolean` — Lade-Status

### AgentTaskDetail.tsx (Conversation Workspace)

Rendert Multi-Turn Konversationen wie Claude Cowork:

- **User-Nachrichten**: Rechts-eingerückte Bubble (max 85% Breite, abgerundete Ecken)
- **Agent-Antworten**: Markdown-formatiert, links ausgerichtet
- **Tool-Calls**: Collapsible mit vertikaler Linie + "Ergebnis" Badge
- **Tool-Gruppen**: "N Tools ausgeführt >" zusammenfassbar (Claude-Style)
- **Thinking**: Clock-Icon + grauer Text
- **Chat-Input**: Sichtbar bei Status `awaiting_input`
- **"Beenden" Button**: Im Header um Konversation abzuschließen
- **Turn-Trenner**: Horizontale Linie zwischen Turns

**Backward-kompatibel:** Alte Single-Turn Tasks (ohne Messages) werden über `task.query` + `task.result.answer` gerendert.

### AgentTaskSidebar.tsx

Liste aller Agent-Konversationen mit Status-Badge:

| Status | Label | Icon | Farbe |
|--------|-------|------|-------|
| `pending` | Wartend | Clock | Gelb |
| `running` | Aktiv | Loader (animiert) | Blau |
| `awaiting_input` | Wartet | Clock | Blau |
| `completed` | Fertig | CheckCircle | Grün |
| `failed` | Fehler | XCircle | Rot |
| `cancelled` | Abgebrochen | Ban | Grau |

"+" Button startet neue Konversation (ohne Task ausgewählt → ChatInput unten).

---

## 2.6 Technologie-Stack

| Komponente | Technologie |
|------------|-------------|
| LLM Routing | Vercel AI SDK 6 (`ai@6.0.134`) |
| Anthropic | `@ai-sdk/anthropic` |
| Ollama | `ollama-ai-provider-v2` |
| Tool-Calling | AI SDK `tool()` + `jsonSchema()` + `stopWhen: stepCountIs(n)` |
| Sub-Agenten | `generateText()` innerhalb von Tool-Execute |
| Streaming | SSE via Callback (kein EventEmitter) |
| PII Guard | Presidio (Analyzer + Anonymizer) |

### Gelöschte Dateien (ersetzt durch AI SDK)

- `server/src/services/llm/LLMRouter.ts` → `ai-provider.ts`
- `server/src/services/llm/OllamaProvider.ts` → `ollama-ai-provider-v2`
- `server/src/services/llm/AnthropicProvider.ts` → `@ai-sdk/anthropic`
- `server/src/services/llm/LLMProvider.ts` → AI SDK eigene Types
- `server/src/services/llm/index.ts` → Nicht mehr benötigt
- `@anthropic-ai/sdk` Paket → `@ai-sdk/anthropic`

### Erhaltene Datei

- `server/src/services/llm/PIIGuard.ts` — Weiterhin aktiv, eigenes `PIIMessage` Interface

---

## Verifikation

1. **Multi-Turn:** Query senden → Agent antwortet → Follow-up senden → Agent hat vollen Kontext
2. **RAG-Tool:** Agent nutzt `rag_search` → findet relevante Dokumente
3. **Permission-Test:** Employee-Agent findet keine restricted Dokumente
4. **Abbrechen:** Laufenden Task canceln → Status wechselt zu `cancelled`
5. **Beenden:** Konversation explizit beenden → Status wechselt zu `completed`
6. **Persistenz:** Browser schließen, öffnen → Konversationen mit Messages sichtbar
7. **Server-Restart:** `running`/`pending` Tasks → `cancelled`, `awaiting_input` Tasks bleiben
8. **Sub-Agent:** `run_skill_test` spawnt unabhängigen Agent via `generateText()`
9. **Skills:** Agent erkennt Skill aus System-Prompt → lädt via `load_skill`
10. **Backward-Kompatibilität:** Alte Single-Turn Tasks werden korrekt gerendert
