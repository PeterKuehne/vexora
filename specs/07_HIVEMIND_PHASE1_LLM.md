# Phase 1: LLM Provider Abstraction + PII Guard + Conversations DB

**Status:** Implementiert (LLM-System migriert auf Vercel AI SDK 6)
**Abhängigkeiten:** Keine (Startphase)
**Ziel:** Mehrere LLM-Provider (Claude, Ollama) verfügbar machen, PII-Schutz für Cloud-Calls, Konversationen serverseitig speichern.

---

## 1.1 Route-Refactoring

`server/src/index.ts` wurde auf ~260 Zeilen reduziert. Route-Handler sind in separate Dateien extrahiert:

```
server/src/routes/
  chat.ts           ← /api/chat (Streaming + Non-Streaming, RAG + Standard)
  documents.ts      ← /api/documents/* (Upload, CRUD, Processing)
  models.ts         ← /api/models (Ollama + Cloud Models)
  conversations.ts  ← /api/conversations (CRUD + Messages)
  agents.ts         ← /api/agents (Multi-Turn Agent-Konversationen)
  skills.ts         ← /api/skills (Skill-Verwaltung + Voting)
  ollama.ts         ← /api/ollama (Proxy-Endpoints)
  settings.ts       ← /api/settings (Admin-Settings)
  admin.ts          ← /api/admin (User-Management)
  monitoring.ts     ← /api/monitoring (Health + Metrics)
  evaluation.ts     ← /api/evaluation (Golden Dataset)
  usage.ts          ← /api/usage (API-Kosten Dashboard)
```

---

## 1.2 LLM Provider System (Vercel AI SDK 6)

### Aktueller Stand

Das LLM-System wurde auf **Vercel AI SDK 6** (`ai@6.0.134`) migriert. Die ursprünglichen custom Provider (LLMRouter, OllamaProvider, AnthropicProvider) wurden gelöscht und durch AI SDK Provider ersetzt.

### Architektur

```
server/src/services/agents/
  ai-provider.ts      ← resolveModel(), parseModelString(), Provider-Setup
  ai-middleware.ts     ← PII Guard Integration (setPIIGuard, maskMessages)

server/src/services/llm/
  PIIGuard.ts          ← Presidio HTTP-Client (einzige verbleibende Datei)
```

### ai-provider.ts (Model Resolution)

Zentrales Model-Routing über `resolveModel()`:

```typescript
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOllama } from 'ollama-ai-provider-v2';

// "anthropic:claude-sonnet-4-6" → @ai-sdk/anthropic
// "qwen3:8b" oder "ollama:qwen3:8b" → ollama-ai-provider-v2

resolveModel('anthropic:claude-sonnet-4-6')  // → Anthropic LanguageModel
resolveModel('qwen3:8b')                     // → Ollama LanguageModel
```

**Funktionen:**
- `resolveModel(modelString)` — Gibt AI SDK LanguageModel zurück
- `parseModelString(model)` — Parst Provider + Model-Name
- `hasProvider(name)` — Prüft ob Provider verfügbar
- `isCloudModel(model)` — Cloud vs. lokal
- `getProviderOptions(model)` — Ollama: `{ think: false }` für Tool-Calling
- `getCloudModels()` — Statische Cloud-Model-Liste mit Pricing

### Nutzung in Services

Alle LLM-Calls nutzen AI SDK `generateText()` / `streamText()`:

| Service | Aufruf | Zweck |
|---------|--------|-------|
| `chat.ts` (Route) | `streamText()` / `generateText()` | Standard-Chat (Streaming + Non-Streaming) |
| `RAGService.ts` | `generateText()` / `streamText()` | RAG-Antworten generieren |
| `ConversationService.ts` | `generateText()` | Auto-Titel-Generierung |
| `QueryRewriter.ts` | `generateText()` | Query-Rewriting für Follow-ups |
| `AgentExecutor.ts` | `generateText()` | Multi-Step Agent mit Tools |
| `run-skill-test.ts` | `generateText()` | Sub-Agent Testing |

### Gelöschte Dateien

| Datei | Ersetzt durch |
|-------|---------------|
| `LLMRouter.ts` | `ai-provider.ts` (`resolveModel`, `parseModelString`) |
| `OllamaProvider.ts` | `ollama-ai-provider-v2` Package |
| `AnthropicProvider.ts` | `@ai-sdk/anthropic` Package |
| `LLMProvider.ts` | AI SDK eigene Types (`LanguageModel`, etc.) |
| `llm/index.ts` | Nicht mehr benötigt |

### Dependencies

```json
{
  "ai": "^6.0.0",
  "@ai-sdk/anthropic": "...",
  "ollama-ai-provider-v2": "..."
}
```

`@anthropic-ai/sdk` wurde entfernt (ersetzt durch `@ai-sdk/anthropic`).

---

## 1.3 PIIGuard (via Microsoft Presidio)

PII-Erkennung über [Microsoft Presidio](https://github.com/microsoft/presidio) als Docker-Service. Nutzt NLP-basierte Named Entity Recognition (SpaCy) für Deutsch.

### PIIGuard.ts (HTTP-Client)

```
server/src/services/llm/PIIGuard.ts  ← Einzige verbleibende Datei im llm/ Ordner
```

**Eigenes `PIIMessage` Interface** (keine Abhängigkeit auf gelöschte LLMProvider Types):

```typescript
interface PIIMessage {
  role: string;
  content: string;
}
```

**Methoden:**
- `isAvailable()` — Health-Check mit 30s Cache
- `mask(messages)` — PII erkennen + durch Token ersetzen (`<PERSON_1>`, `<EMAIL_2>`)
- `unmask(content)` — Token durch Originalwerte ersetzen
- `getTokenMap()` — Debugging

### Integration

PII Guard wird beim Server-Start initialisiert und in `ai-middleware.ts` gesetzt:

```typescript
// server/src/index.ts
const piiGuard = new PIIGuard();
if (await piiGuard.isAvailable()) {
  setPIIGuard(piiGuard);  // → ai-middleware.ts
}
```

`ai-middleware.ts` stellt `maskMessages()` und `unmaskContent()` bereit, die von Chat/RAG-Services genutzt werden können.

### Presidio Docker-Setup

```yaml
presidio-analyzer:
  image: mcr.microsoft.com/presidio-analyzer:latest
  ports: ["8003:3000"]
  # Deutsch: de_core_news_lg SpaCy-Modell

presidio-anonymizer:
  image: mcr.microsoft.com/presidio-anonymizer:latest
  ports: ["8004:3000"]
```

### Konfiguration

```env
PII_GUARD_ENABLED=true
PRESIDIO_ANALYZER_URL=http://192.168.2.38:8003  # oder Hetzner
PRESIDIO_ANONYMIZER_URL=http://192.168.2.38:8004
PII_MIN_CONFIDENCE=0.7
```

### Erkannte PII-Typen

| PII-Typ | Erkennungsmethode | Beispiel |
|---------|-------------------|----------|
| PERSON | NER (SpaCy) | "Peter Kühne" |
| EMAIL_ADDRESS | Pattern + Kontext | peter@firma.de |
| IBAN_CODE | Pattern + Checksum | DE89370400440532013000 |
| PHONE_NUMBER | Pattern | +49 151 12345678 |
| LOCATION | NER (SpaCy) | "München", "Hauptstraße 5" |
| DATE_TIME | NER + Pattern | "26.03.1990" |

### Fallback

Wenn Presidio nicht erreichbar: Cloud-Calls funktionieren ohne PII-Masking (Warning beim Start). Lokale Ollama-Modelle sind nicht betroffen.

---

## 1.4 Konversationen → PostgreSQL

### Migration `009_conversations_and_llm.sql`

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID,
  title TEXT,
  model TEXT,
  is_pinned BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  model TEXT,
  token_count INTEGER,
  sources JSONB,
  thinking_content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE api_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cost_usd NUMERIC(10,6) DEFAULT 0,
  pii_masked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### ConversationService

`server/src/services/ConversationService.ts`:
- CRUD für Conversations + Messages mit RLS
- Auto-Titel-Generierung via `generateText()` (Qwen3:8b, denkt nicht nach mit `think: false`)
- Pagination: Default 50 Konversationen

### API

```
GET    /api/conversations              → Liste (paginiert, sortiert nach updated_at)
POST   /api/conversations              → Neue Konversation erstellen
GET    /api/conversations/:id          → Konversation mit Messages laden
PATCH  /api/conversations/:id          → Titel/Pin/Archiv ändern
DELETE /api/conversations/:id          → Konversation löschen
POST   /api/conversations/:id/messages → Message hinzufügen
```

---

## 1.5 Frontend: Workspace-Layout

### 3-Spalten Layout (implementiert)

```
┌──────┬──────────────┬─────────────────────────────────────┐
│      │              │                                     │
│  💬  │  Kontext-    │   Arbeitsbereich                    │
│      │  abhängige   │                                     │
│  🤖  │  Sidebar     │   Chat-Verlauf                      │
│      │              │   oder                              │
│  📄  │              │   Agent-Konversation                │
│      │              │                                     │
│  🔗  │              │                                     │
│      │              │                                     │
│  ──  │              │   ┌─────────────────────────────┐   │
│  ⚙️  │              │   │  Eingabefeld                │   │
│      │              │   └─────────────────────────────┘   │
└──────┴──────────────┴─────────────────────────────────────┘
 48px    260px                     Rest
```

### Icon-Rail (48px)

Vertikale Navigation mit Akzent-Indikator:

| Icon | Bereich | Status |
|------|---------|--------|
| 💬 Chat | Standard-Chat mit RAG | Aktiv |
| 🤖 Agent Tasks | Multi-Turn Agent-Konversationen | Aktiv |
| 📄 Dokumente | Wissensspeicher verwalten | Aktiv |
| 🔗 Wissen | Knowledge Graph Explorer | Aktiv |
| ⚙️ Einstellungen | System-Config | Aktiv |

### Sidebar (260px, kontextabhängig)

| Nav-Item | Sidebar-Inhalt |
|----------|---------------|
| Chat | Konversationsliste + "Neue Frage" |
| Agent Tasks | Task-Liste mit Status-Badges + "+" Button |
| Dokumente | Dokument-Liste + Upload |
| Wissen | Entity-Suche + Filter |

### Chat-Route (chat.ts)

Streaming-Protokoll für Frontend-Kompatibilität:

```
data: {"message": {"content": "chunk"}, "done": false}
data: {"done": true, "model": "...", "inputTokens": ..., "outputTokens": ...}
data: [DONE]
```

RAG-Streaming sendet Sources zuerst als Metadata, dann den Text-Stream.

---

## Infrastruktur

### Hetzner Server (167.235.135.132)

```
:5432  PostgreSQL
:8080  Weaviate
:7687  Neo4j
:6379  Redis
:8001  Reranker (BGE-reranker-v2-m3)
:8002  Parser (Docling)
:8003  Presidio Analyzer
:8004  Presidio Anonymizer
```

### Lokaler Mac

```
:11434 Ollama (LLM + Embeddings)
:5173  Vite (Frontend)
:3001  Express (Backend)
```

---

## Verifikation

1. **Backward-Kompatibilität:** Ohne `ANTHROPIC_API_KEY` verhält sich alles wie vorher
2. **Ollama-Chat:** `qwen3:8b` funktioniert via `streamText()` / `generateText()`
3. **Claude-Chat:** `anthropic:claude-sonnet-4-6` liefert Antworten
4. **PII-Guard:** PERSON + EMAIL werden von Presidio erkannt und maskiert
5. **PII-Guard Fallback:** Presidio offline → Warning, Cloud-Calls ohne Masking
6. **Konversationen:** CRUD über API, RLS pro User, Auto-Titel
7. **RAG mit Cloud:** RAG-Suche + Cloud-Antwort funktioniert
8. **Streaming:** Chat-Streaming-Format kompatibel mit Frontend
9. **TypeScript:** `tsc --noEmit` fehlerfrei (keine neuen Fehler)
