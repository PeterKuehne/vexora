# Spec: Context-Fenster Management — Tool-History über Turns

**Status:** Geplant
**Bezug:** [12_AGENT_KONVERSATION_SPEC.md](./12_AGENT_KONVERSATION_SPEC.md), [16_SKILLS_REFACTORING_SPEC.md](./16_SKILLS_REFACTORING_SPEC.md)
**Referenz:** Claude Messages API (Anthropic), OpenAI Chat Completions API, Vercel AI SDK 6

---

## Zusammenfassung

Unser Agent verliert nach jedem Turn alle Tool-Ergebnisse. In Turn 2+ sieht das Modell nur die User/Assistant-Texte — die Tool-Calls und Tool-Results aus vorherigen Turns fehlen komplett. Dadurch sucht der Agent redundant, obwohl die Quelldaten bereits vorhanden waren.

Diese Spec beschreibt die Migration auf den Industriestandard: **Volle Message-History inklusive Tool-Calls und Tool-Results bei jedem Turn**, mit automatischem Pruning bei großen Kontexten.

---

## 1. Ist-Zustand

### 1.1 Aktuelles Message-Format

Messages werden als einfache Text-Strings in `agent_messages` gespeichert:

```sql
-- Aktuelles Schema
CREATE TABLE agent_messages (
  id UUID PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES agent_tasks(id),
  turn_number INTEGER NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,           -- Nur Plaintext
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 1.2 Was der Agent in Turn 2 sieht

```
[user]:      "Analysiere den Vertrag Rahmenvertrag_Müller_GmbH_2026"
[assistant]: "## Vertragsanalyse-Report\n1. Vertragsparteien..."
[user]:      "Erkläre die Empfehlungen genauer"
```

Die Tool-Calls (`load_skill`, `rag_search`, `read_chunk`) und deren Ergebnisse (Chunk-Inhalte, Skill-Body) aus Turn 1 **fehlen komplett**.

### 1.3 Probleme

- **Redundante Suchen**: Agent führt `rag_search` erneut aus, obwohl die Daten im vorherigen Turn bereits geladen wurden
- **Kontextverlust**: Agent kann nur seine eigene Zusammenfassung referenzieren, nicht die Originaldaten
- **Inkonsistenz mit Standard**: Claude, ChatGPT und alle großen Plattformen senden die volle History

---

## 2. Soll-Zustand

### 2.1 Wie Claude und ChatGPT es machen

Beide APIs sind stateless — der Client muss die **komplette** Message-History bei jedem API-Call mitschicken. Die History enthält alle Zwischenschritte:

**Anthropic Claude Format:**
```json
[
  { "role": "user", "content": "Analysiere den Vertrag" },
  { "role": "assistant", "content": [
    { "type": "text", "text": "Ich suche den Vertrag." },
    { "type": "tool_use", "id": "toolu_01", "name": "rag_search", "input": {"query": "Vertrag Müller"} }
  ]},
  { "role": "user", "content": [
    { "type": "tool_result", "tool_use_id": "toolu_01", "content": "Gefunden: Rahmenvertrag..." }
  ]},
  { "role": "assistant", "content": "## Vertragsanalyse-Report\n..." },
  { "role": "user", "content": "Erkläre die Empfehlungen" }
]
```

**OpenAI/OVH Format (unser Provider):**
```json
[
  { "role": "user", "content": "Analysiere den Vertrag" },
  { "role": "assistant", "content": null, "tool_calls": [
    { "id": "call_1", "type": "function", "function": {"name": "rag_search", "arguments": "{\"query\": \"Vertrag\"}"} }
  ]},
  { "role": "tool", "tool_call_id": "call_1", "content": "Gefunden: Rahmenvertrag..." },
  { "role": "assistant", "content": "## Vertragsanalyse-Report\n..." },
  { "role": "user", "content": "Erkläre die Empfehlungen" }
]
```

### 2.2 Was der Agent in Turn 2 sehen soll

```
[user]:      "Analysiere den Vertrag Rahmenvertrag_Müller_GmbH_2026"
[assistant]: [tool_use: load_skill("vertragsanalyse-report")]
[tool]:      [tool_result: "# Vertragsanalyse-Report\n## Instruktionen..."]
[assistant]: [tool_use: rag_search("Rahmenvertrag Müller")]
[tool]:      [tool_result: "§1 Vertragsgegenstand... §2 Laufzeit..."]
[assistant]: [tool_use: read_chunk("doc_123:4")]
[tool]:      [tool_result: "§ 3 Vergütung\nSenior Consultant: 145€..."]
[assistant]: "## Vertragsanalyse-Report\n1. Vertragsparteien..."
[user]:      "Erkläre die Empfehlungen genauer"
```

→ Agent kann direkt aus den vorhandenen Chunk-Daten antworten ohne erneut zu suchen.

### 2.3 Vercel AI SDK: `result.response.messages`

Der AI SDK `ToolLoopAgent.generate()` gibt nach Completion `result.response.messages` zurück — ein Array das ALLE Zwischenschritte enthält:

```typescript
const result = await agent.generate({ messages });

// result.response.messages enthält:
// [
//   { role: 'assistant', content: [{ type: 'tool-call', toolCallId: '...', toolName: 'rag_search', args: {...} }] },
//   { role: 'tool', content: [{ type: 'tool-result', toolCallId: '...', result: '...' }] },
//   { role: 'assistant', content: [{ type: 'text', text: 'Final answer...' }] }
// ]
```

Für den nächsten Turn:
```typescript
const nextTurnMessages = [...previousMessages, ...result.response.messages, { role: 'user', content: newQuery }];
```

---

## 3. Implementierung

### 3.1 DB-Schema erweitern

**Migration:** `016_context_messages.sql`

```sql
-- role erweitern um 'tool' Messages
ALTER TABLE agent_messages DROP CONSTRAINT IF EXISTS agent_messages_role_check;
ALTER TABLE agent_messages ADD CONSTRAINT agent_messages_role_check
  CHECK (role IN ('user', 'assistant', 'tool'));

-- Strukturierte Message-Inhalte (tool_use blocks, etc.)
ALTER TABLE agent_messages ADD COLUMN IF NOT EXISTS content_json JSONB;

-- tool_call_id für Tool-Result Korrelation
ALTER TABLE agent_messages ADD COLUMN IF NOT EXISTS tool_call_id VARCHAR(100);
```

`content_json` speichert die AI SDK Content-Blocks als JSONB. `content` (TEXT) bleibt für Abwärtskompatibilität und wird als Fallback genutzt.

### 3.2 Message-Persistierung

**Nach `agent.generate()`:**

```typescript
const result = await agent.generate({ messages, abortSignal: signal });

// Speichere alle Zwischenschritt-Messages dieses Turns
const responseMessages = result.response?.messages || [];
await agentPersistence.createStructuredMessages(task.id, turnNumber, responseMessages);
```

**`createStructuredMessages()`** speichert jede Response-Message als eigene Zeile:
- `role: 'assistant'` mit `content_json` = `[{ type: 'tool-call', ... }]`
- `role: 'tool'` mit `content_json` = `[{ type: 'tool-result', ... }]` und `tool_call_id`
- Die letzte text-only Assistant-Message wird **nicht** doppelt gespeichert (wird separat als Final Answer gesichert)

### 3.3 Message-History Aufbau

**`getMessages()`** gibt die volle strukturierte History zurück:
- Wenn `content_json` vorhanden → nutze als Content (Array von Blocks)
- Sonst → Fallback auf `content` TEXT (Legacy/User-Messages)
- Sortierung: `ORDER BY turn_number ASC, created_at ASC`

### 3.4 Context-Pruning

Wenn die History zu groß wird (>100k Tokens bei 131k Context-Window), werden ältere Tool-Results automatisch gekürzt.

**Option A — AI SDK `pruneMessages()`:**
```typescript
import { pruneMessages } from 'ai';
const prunedMessages = pruneMessages(messages, {
  maxTokens: 100000,
  strategy: { toolCalls: 'before-last-3-messages' }
});
```

**Option B — Eigene Implementierung:**
- Ältere Turns (nicht die letzten 3): Tool-Results auf 500 Zeichen kürzen
- Reasoning-Content aus älteren Turns entfernen
- Leere Messages nach Kürzung entfernen

**Option C — Compaction (wie Claude Code):**
- Bei ~95% Context: LLM-Aufruf um die bisherige Konversation zusammenzufassen
- Zusammenfassung ersetzt die älteren Messages
- Letzte 3 Turns bleiben unverändert

Empfehlung: **Option A** (AI SDK built-in) mit **Option B** als Fallback.

---

## 4. Message-Reihenfolge

Die korrekte Reihenfolge in der DB:

```
Turn 1:
  ① user:      "Analysiere den Vertrag..."          (createMessage - TEXT)
  ② assistant: [tool_use: load_skill]               (createStructuredMessages - JSONB)
  ③ tool:      [tool_result: skill body]             (createStructuredMessages - JSONB)
  ④ assistant: [tool_use: rag_search]                (createStructuredMessages - JSONB)
  ⑤ tool:      [tool_result: chunks]                 (createStructuredMessages - JSONB)
  ⑥ assistant: "Hier ist der Report..."              (createMessage - TEXT)

Turn 2:
  ⑦ user:      "Erkläre die Empfehlungen"            (createMessage - TEXT)
  ⑧ assistant: "Die Empfehlungen bedeuten..."        (createMessage - TEXT, keine Tools nötig)
```

**Wichtig:** Die `created_at` Timestamps müssen die Reihenfolge innerhalb eines Turns korrekt abbilden. `createStructuredMessages()` muss zwischen ① und ⑥ eingefügt werden.

---

## 5. Was sich NICHT ändert

| Feature | Warum es bleibt |
|---------|----------------|
| **Frontend** | Zeigt weiterhin nur User-Bubbles + Tool-Steps + Assistant-Antwort |
| **agent_steps Tabelle** | Bleibt für Tool-Execution-Tracking (Dauer, UI-Darstellung) |
| **SSE-Streaming** | Tool-Call Events bleiben wie bisher |
| **StepStream UI** | Rendert aus `agent_steps`, nicht aus Messages |
| **Skill-System** | Unverändert |
| **QueryRouter** | Unverändert |

---

## 6. Dateien

| Datei | Änderung |
|-------|----------|
| `server/src/migrations/016_context_messages.sql` | NEU — Schema-Erweiterung |
| `server/src/services/agents/AgentPersistence.ts` | ÄNDERN — `createStructuredMessages()`, `getMessages()` |
| `server/src/services/agents/AgentExecutor.ts` | ÄNDERN — `response.messages` speichern, History laden |
| `server/src/services/agents/types.ts` | ÄNDERN — `AgentMessage.contentJson` |
| `src/contexts/AgentContext.tsx` | ÄNDERN — `getTaskDetail` mapped strukturierte Messages |

---

## 7. Verifikation

1. **Keine redundanten Suchen**: Turn 1 macht `rag_search`, Turn 2 antwortet direkt aus Kontext
2. **Korrekte History**: DB enthält `user` + `assistant` (tool_use) + `tool` (result) + `assistant` (text) Messages
3. **Abwärtskompatibilität**: Alte Tasks ohne `content_json` laden weiterhin korrekt
4. **Context-Pruning**: Bei Turn 10+ werden ältere Tool-Results automatisch gekürzt
5. **Frontend**: Keine sichtbaren Änderungen — Tool-Steps werden aus `agent_steps` gerendert
6. **Token-Effizienz**: Turn 2 nutzt weniger Tokens (kein erneutes rag_search nötig)
7. `npx tsc --noEmit` fehlerfrei
