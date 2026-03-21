# Phase 1: LLM Provider Abstraction + PII Guard + Conversations DB

**Zeitraum:** Wochen 1-3
**Abhängigkeiten:** Keine (Startphase)
**Ziel:** Claude Sonnet neben Ollama verfügbar machen, Konversationen serverseitig speichern, ohne bestehende Funktionalität zu brechen.

---

## 1.1 Route-Refactoring (Voraussetzung)

`server/src/index.ts` (1500+ Zeilen) hat alle Route-Handler inline. Bevor neue Funktionalität hinzukommt, muss das aufgeteilt werden.

### Aufgabe

Extrahiere Route-Handler in separate Dateien:

```
server/src/routes/
  chat.ts           ← /api/chat Handlers (Zeilen ~241-441 in index.ts)
  documents.ts      ← /api/documents/* Handlers (Zeilen ~562-780)
  rag.ts            ← /api/rag/* Handlers
  models.ts         ← /api/models/* Handlers
  conversations.ts  ← Neu in Schritt 1.4
```

`server/src/index.ts` wird auf ~200 Zeilen reduziert: Middleware-Setup + `app.use('/api/chat', chatRoutes)` etc.

### Pattern

Nutze Express Router:
```typescript
// server/src/routes/chat.ts
import { Router } from 'express';
const router = Router();
router.post('/', authenticateToken, asyncHandler(async (req, res) => { ... }));
export default router;

// server/src/index.ts
import chatRoutes from './routes/chat.js';
app.use('/api/chat', chatRoutes);
```

### Verifikation
- Alle bestehenden API-Endpoints müssen identisch funktionieren
- `npm run typecheck` fehlerfrei
- Manueller Test: Chat, RAG, Dokument-Upload, Model-Listing

---

## 1.2 LLM Provider Abstraction

### Neue Dateien

```
server/src/services/llm/
  LLMProvider.ts          ← Interface
  OllamaProvider.ts       ← Wraps bestehenden OllamaService
  AnthropicProvider.ts    ← Claude API via @anthropic-ai/sdk
  LLMRouter.ts            ← Routet nach Model-Prefix
  PIIGuard.ts             ← Maskiert PII vor Cloud-Calls
  index.ts                ← Barrel export
```

### LLMProvider Interface

```typescript
interface LLMProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  think?: boolean;       // Qwen3 thinking mode
  stream?: boolean;
}

interface ChatResponse {
  content: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  thinkingContent?: string;
}

interface LLMModel {
  id: string;             // z.B. "anthropic:claude-sonnet-4-6"
  name: string;           // z.B. "Claude Sonnet 4.6"
  provider: 'ollama' | 'anthropic';
  isCloud: boolean;
  contextWindow: number;
  inputPricePerMTok?: number;   // nur Cloud
  outputPricePerMTok?: number;  // nur Cloud
}

interface LLMProvider {
  readonly providerName: string;
  chat(messages: ChatMessage[], model: string, options?: ChatOptions): Promise<ChatResponse>;
  chatStream(messages: ChatMessage[], model: string, options?: ChatOptions): AsyncIterable<string>;
  getModels(): Promise<LLMModel[]>;
  healthCheck(): Promise<{ ok: boolean; error?: string }>;
}
```

### OllamaProvider

- Wraps bestehenden `OllamaService` und implementiert `LLMProvider`
- Model-Name: Prefix `ollama:` wird gestrippt (z.B. `ollama:qwen3:8b` → `qwen3:8b` an Ollama)
- Bestehende Streaming-Logik (ReadableStream) wird auf `AsyncIterable<string>` adaptiert
- Keine funktionalen Änderungen am Ollama-Verhalten

### AnthropicProvider

- Nutzt `@anthropic-ai/sdk` für API-Calls
- Model-Name: Prefix `anthropic:` wird gestrippt
- Mapping von ChatMessage-Format auf Anthropic-Format (system prompt separat)
- Streaming via `client.messages.stream()`
- Token-Usage aus Response extrahieren für Kosten-Tracking
- API-Key aus Env-Variable `ANTHROPIC_API_KEY`

### LLMRouter

```typescript
class LLMRouter {
  private providers: Map<string, LLMProvider>;
  private piiGuard: PIIGuard;
  private defaultProvider: string = 'ollama';

  // Routet basierend auf Model-Prefix
  chat(messages, model, options): Promise<ChatResponse> {
    const { provider, modelName } = this.parseModel(model);

    // PII Guard nur für Cloud-Provider
    if (provider !== 'ollama') {
      messages = this.piiGuard.mask(messages);
    }

    const response = await this.providers.get(provider).chat(messages, modelName, options);

    // Unmask und Usage-Logging
    if (provider !== 'ollama') {
      response.content = this.piiGuard.unmask(response.content);
      await this.logUsage(provider, modelName, response);
    }

    return response;
  }

  // "anthropic:claude-sonnet-4-6" → { provider: "anthropic", modelName: "claude-sonnet-4-6" }
  // "qwen3:8b" → { provider: "ollama", modelName: "qwen3:8b" }
  private parseModel(model: string): { provider: string; modelName: string };
}
```

### PIIGuard (via Microsoft Presidio)

PII-Erkennung wird **nicht** per Regex gelöst, sondern über [Microsoft Presidio](https://github.com/microsoft/presidio) als Docker-Service auf dem Ubuntu-Server. Presidio nutzt NLP-basierte Named Entity Recognition und erkennt damit auch Personennamen, Adressen und kontextabhängige Daten – weit mehr als Regex leisten kann.

#### Presidio Docker-Setup auf Ubuntu (192.168.2.38)

Neuer Service auf Port `:8003`:

```yaml
# ubuntu-infra/docker-compose.yaml (Ergänzung)
presidio-analyzer:
  image: mcr.microsoft.com/presidio-analyzer:latest
  ports:
    - "8003:3000"
  environment:
    - ANALYZER_CONF_FILE=/conf/analyzer-config.yml
  volumes:
    - ./presidio/analyzer-config.yml:/conf/analyzer-config.yml
  restart: unless-stopped

presidio-anonymizer:
  image: mcr.microsoft.com/presidio-anonymizer:latest
  ports:
    - "8004:3000"
  restart: unless-stopped
```

#### Presidio-Konfiguration für Deutsch

```yaml
# ubuntu-infra/presidio/analyzer-config.yml
nlp_engine_name: spacy
models:
  - lang_code: de
    model_name: de_core_news_lg  # Deutsches SpaCy-Modell für NER

supported_languages:
  - de
  - en
```

#### Erkannte PII-Typen

| PII-Typ | Erkennungsmethode | Beispiel |
|---------|-------------------|----------|
| PERSON | NER (SpaCy) | "Peter Kühne" |
| EMAIL_ADDRESS | Pattern + Kontext | peter@firma.de |
| IBAN_CODE | Pattern + Checksum | DE89370400440532013000 |
| PHONE_NUMBER | Pattern | +49 151 12345678 |
| LOCATION | NER (SpaCy) | "München", "Hauptstraße 5" |
| DATE_TIME | NER + Pattern | "26.03.1990" |
| MEDICAL_LICENSE | Pattern | Medizinische Kennzahlen |
| Custom: STEUER_ID | Custom Recognizer | 12345678901 |
| Custom: SVN | Custom Recognizer | 12 010190 A 1234 |

#### PIIGuard.ts als HTTP-Client

```typescript
// server/src/services/llm/PIIGuard.ts
class PIIGuard {
  private analyzerUrl: string;   // http://192.168.2.38:8003
  private anonymizerUrl: string; // http://192.168.2.38:8004
  private tokenMap: Map<string, string>;  // [PII_1] → Originalwert
  private enabled: boolean;
  private minConfidence: number = 0.7;

  async mask(messages: ChatMessage[]): Promise<ChatMessage[]> {
    this.tokenMap = new Map();

    return Promise.all(messages.map(async (msg) => {
      // 1. Analyze: PII-Entitäten erkennen
      const entities = await this.analyze(msg.content);

      // 2. Anonymize: Ersetzen mit deterministischen Token
      const anonymized = await this.anonymize(msg.content, entities);

      // 3. Token-Map aufbauen für späteres Unmask
      for (const entity of entities) {
        this.tokenMap.set(entity.anonymizedValue, entity.originalValue);
      }

      return { ...msg, content: anonymized };
    }));
  }

  unmask(content: string): string {
    // Alle [PII_*] Token durch Originalwerte ersetzen
    for (const [token, original] of this.tokenMap) {
      content = content.replaceAll(token, original);
    }
    return content;
  }

  private async analyze(text: string): Promise<PresidioEntity[]> {
    const response = await fetch(`${this.analyzerUrl}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        language: 'de',
        score_threshold: this.minConfidence,
      }),
    });
    return response.json();
  }

  private async anonymize(text: string, entities: PresidioEntity[]): Promise<string> {
    const response = await fetch(`${this.anonymizerUrl}/anonymize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        analyzer_results: entities,
        anonymizers: {
          DEFAULT: { type: 'replace', new_value: '<PII>' },
          PERSON: { type: 'replace', new_value: '<PERSON>' },
          EMAIL_ADDRESS: { type: 'replace', new_value: '<EMAIL>' },
        },
      }),
    });
    return (await response.json()).text;
  }
}
```

#### Ablauf

```
User: "Kontaktieren Sie Peter Kühne unter peter@firma.de"
  ↓ PIIGuard.mask()
  ↓ POST presidio:8003/analyze → [{type: PERSON, start: 18, end: 30, score: 0.92}, ...]
  ↓ POST presidio:8004/anonymize → "Kontaktieren Sie <PERSON> unter <EMAIL>"
  ↓ Token-Map: {"<PERSON>": "Peter Kühne", "<EMAIL>": "peter@firma.de"}
  ↓
Claude API: "Kontaktieren Sie <PERSON> unter <EMAIL>"
  ↓
Response: "Sie können <PERSON> per <EMAIL> erreichen."
  ↓ PIIGuard.unmask()
  ↓
User: "Sie können Peter Kühne per peter@firma.de erreichen."
```

#### Konfiguration

```env
# .env
PII_GUARD_ENABLED=true
PRESIDIO_ANALYZER_URL=http://192.168.2.38:8003
PRESIDIO_ANONYMIZER_URL=http://192.168.2.38:8004
PII_MIN_CONFIDENCE=0.7
```

#### Fallback

Wenn Presidio nicht erreichbar ist (Health-Check fehlschlägt):
- Cloud-Calls werden **blockiert** (nicht still durchgelassen)
- User bekommt Fehlermeldung: "PII-Schutz nicht verfügbar, Cloud-Modelle temporär deaktiviert"
- Lokale Ollama-Modelle funktionieren weiterhin normal

---

## 1.3 Migration in bestehenden Services

### RAGService.ts

Alle `ollamaService.chat()` und `ollamaService.chatStream()` Calls ersetzen durch `llmRouter.chat()` / `llmRouter.chatStream()`.

**Betroffene Methoden:**
- `generateResponse()` – LLM-Generation am Ende der RAG-Pipeline
- `generateStreamingResponse()` – Streaming-Variante

Das Modell kommt aus dem Request (`request.model`). Wenn User Claude gewählt hat, wird Claude genutzt. Wenn Ollama, dann Ollama. Transparent.

### QueryRewriter.ts

`ollamaService.chat()` → `llmRouter.chat()`. Query Rewriting kann mit günstigerem lokalem Modell laufen – kein Cloud-Call nötig.

### Bestehende Funktionalität

Wenn kein `ANTHROPIC_API_KEY` konfiguriert ist, verhält sich das System exakt wie vorher. Claude-Modelle erscheinen einfach nicht in der Modell-Liste.

---

## 1.4 Konversationen → PostgreSQL

### Migration `009_conversations_and_llm.sql`

```sql
-- Conversations (replaces LocalStorage)
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  tenant_id UUID,  -- Multi-Tenancy vorbereitet (nullable für jetzt)
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
  sources JSONB,  -- RAG-Quellen als JSON
  thinking_content TEXT,  -- Extended Thinking (Qwen3/Claude)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- API Usage Tracking
CREATE TABLE api_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  conversation_id UUID REFERENCES conversations(id),
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  cost_usd NUMERIC(10,6) DEFAULT 0,
  pii_masked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices
CREATE INDEX idx_conversations_user ON conversations(user_id, updated_at DESC);
CREATE INDEX idx_conversations_tenant ON conversations(tenant_id) WHERE tenant_id IS NOT NULL;
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_api_usage_user ON api_usage_log(user_id, created_at DESC);

-- RLS Policies
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversations_user_access ON conversations
  FOR ALL USING (
    owner_id = current_setting('app.user_id', true)::uuid
    OR current_setting('app.user_role', true) = 'Admin'
  );

CREATE POLICY messages_via_conversation ON messages
  FOR ALL USING (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE owner_id = current_setting('app.user_id', true)::uuid
      OR current_setting('app.user_role', true) = 'Admin'
    )
  );
```

### Neue Route `server/src/routes/conversations.ts`

```
GET    /api/conversations              → Liste (paginiert, sortiert nach updated_at)
POST   /api/conversations              → Neue Konversation erstellen
GET    /api/conversations/:id          → Konversation mit Messages laden
PATCH  /api/conversations/:id          → Titel/Pin/Archiv ändern
DELETE /api/conversations/:id          → Konversation löschen
GET    /api/conversations/:id/messages → Messages paginiert laden
POST   /api/conversations/:id/messages → Message hinzufügen
```

### ConversationService

Neuer Service `server/src/services/ConversationService.ts`:
- CRUD für Conversations + Messages
- Setzt User-Context für RLS vor jedem Query
- Auto-Title-Generation: Nach erster User-Message wird LLM gebeten, einen kurzen Titel zu generieren
- Pagination: Default 50 Konversationen, 100 Messages pro Page

### Frontend-Migration

**`src/contexts/ConversationContext.tsx`:**
- `loadConversations()` → `GET /api/conversations` statt LocalStorage
- `createConversation()` → `POST /api/conversations`
- `deleteConversation()` → `DELETE /api/conversations/:id`
- `updateConversation()` → `PATCH /api/conversations/:id`
- LocalStorage als Write-Through-Cache beibehalten (Offline-Fähigkeit)

**`src/contexts/ChatContext.tsx`:**
- Messages werden beim Conversation-Wechsel via API geladen
- Neue Messages werden sofort an API gesendet + lokal im State gehalten
- Streaming-Response wird nach Abschluss als Message persistiert

**`src/lib/conversationStorage.ts`:**
- Wird zu einem API-Client-Wrapper
- Fallback auf LocalStorage wenn API nicht erreichbar

---

## 1.5 Frontend: Workspace-Layout (inspiriert von Claude Cowork)

### Design-Vision

Inspiriert von Claude Cowork's task-zentriertem Ansatz: Nicht "noch ein Chat", sondern "eine Aufgabe erledigen". Das UI unterscheidet klar zwischen schnellen Fragen (Chat) und komplexen Aufgaben (Tasks/Skills). Die Sidebar zeigt live den Fortschritt – Steps, Tools, Sources – wie bei Cowork.

### Layout: 3-Spalten Workspace

```
┌──────┬──────────────┬─────────────────────────────────────┐
│      │              │                                     │
│  💬  │  Konversa-   │   Arbeitsbereich                    │
│      │  tionen      │                                     │
│  🤖  │  ──────────  │   ┌─────────────────────────────┐   │
│      │  Marketing-  │   │                             │   │
│  ⚡  │  Strategie   │   │  Chat-Verlauf               │   │
│      │  Q1 Report   │   │  oder                       │   │
│  📄  │  Analyse...  │   │  Task-Ansicht:              │   │
│      │              │   │  Plan → Steps → Output      │   │
│  🔗  │  ──────────  │   │                             │   │
│      │  + Neue      │   │  [Quellen] [Tools] [Kosten] │   │
│  ──  │    Aufgabe   │   │                             │   │
│  ⚙️  │              │   └─────────────────────────────┘   │
│  👤  │              │   ┌─────────────────────────────┐   │
│      │              │   │  Eingabe / Nächste Aufgabe  │   │
└──────┴──────────────┴───┴─────────────────────────────┴───┘
 48px    260px                     Rest
```

### Aufbau

**1. Icon-Rail (48px, links fest)**

Vertikale Navigation. Aktiver Bereich hat Akzent-Indikator (wie Cowork's Tab-Auswahl).

```
Oberer Bereich (Arbeitsbereiche):
  💬 Chat        → Schnelle Fragen, RAG-Suche
  🤖 Tasks       → Agent-Aufgaben (à la Cowork "New Task")
  ⚡ Skills      → Vordefinierte Workflows
  📄 Dokumente   → Wissensspeicher verwalten
  🔗 Wissen      → Knowledge Graph Explorer

Unterer Bereich (System):
  ── Divider
  ⚙️ Einstellungen
  👤 User-Avatar + Menu
```

Phase 1: Chat + Dokumente aktiv. Tasks, Skills, Wissen als disabled Icons mit Tooltip "Kommt bald".

**2. Sidebar (260px, kontextabhängig, einklappbar)**

Zeigt je nach aktivem Icon-Rail-Item:

| Nav-Item | Sidebar-Inhalt | Content-Area |
|----------|---------------|--------------|
| Chat | Konversationsliste + "Neue Frage" Button | Chat-Verlauf mit RAG-Quellen |
| Tasks | Task-Liste mit Status-Badges + "Neue Aufgabe" | Task-Detail: Plan → Steps → Output (Phase 2) |
| Skills | Skill-Library Cards + Suche | Skill-Execution mit Input-Form (Phase 3) |
| Dokumente | Dokument-Liste + Upload-Button | Dokument-Management (bestehend) |
| Wissen | Entity-Suche + Filter | Graph-Visualisierung (Phase 5) |

**3. Arbeitsbereich (Rest, Hauptfläche)**

Zwei Modi, inspiriert von Cowork's Chat vs. Task-Ansicht:

**Chat-Modus** (bei Nav "Chat"):
- Klassischer Chat-Verlauf (bestehende Komponenten)
- RAG-Quellen als aufklappbare Karten unter der Antwort
- Model-Indikator (welches LLM antwortet)
- Eingabefeld unten mit Model-Selector + RAG-Toggle

**Task-Modus** (bei Nav "Tasks", Phase 2):
Inspiriert von Cowork's Task-Progress:
```
┌─────────────────────────────────────┐
│ 📋 Task: "Quartalsreport Q1 2026"  │
│ Status: Läuft... (Schritt 2/4)     │
├─────────────────────────────────────┤
│                                     │
│ ✅ Schritt 1: Daten sammeln         │
│    Tool: rag_search → 12 Quellen    │
│    Tool: sql_query → 3 Tabellen     │
│    ▸ Details anzeigen               │
│                                     │
│ ⏳ Schritt 2: Analyse erstellen     │
│    Denkt nach...                    │
│    "Ich analysiere die Umsatz-      │
│     entwicklung und vergleiche..."  │
│                                     │
│ ○ Schritt 3: Bericht formatieren    │
│ ○ Schritt 4: Dokument speichern     │
│                                     │
├─────────────────────────────────────┤
│ Quellen: 12 Chunks | 3 Dokumente   │
│ Modell: Claude Sonnet 4.6          │
│ Kosten: ~$0.08 | Dauer: 45s        │
└─────────────────────────────────────┘
```

### Cowork-inspirierte UX-Patterns

1. **"Neue Aufgabe" statt "Neuer Chat"**: Im Tasks-Bereich startet man eine Aufgabe, nicht einen Chat. Der Agent fragt ggf. nach Klärung (wie Cowork) bevor er loslegt.

2. **Plan-Review**: Bei komplexen Tasks zeigt der Agent seinen Plan und wartet auf Bestätigung, bevor er Schritte ausführt. User kann den Plan anpassen.

3. **Live-Progress**: Sidebar zeigt bei laufenden Tasks den Status. Im Arbeitsbereich sieht man Schritt für Schritt was passiert – Thoughts, Tool-Calls, Zwischenergebnisse.

4. **Multi-Tasking**: Mehrere Tasks können parallel laufen. Die Task-Liste in der Sidebar zeigt Status-Badges (⏳ läuft, ✅ fertig, ❌ fehlgeschlagen).

5. **Transparenz-Footer**: Jede Antwort zeigt: Modell, Kosten, Anzahl Quellen, Dauer. (AI Act Compliance + Kostenkontrolle)

### Neue Komponenten

| Komponente | Ersetzt | Funktion |
|------------|---------|----------|
| `WorkspaceLayout.tsx` | `AppShell.tsx` | 3-Spalten Shell |
| `IconRail.tsx` | `SidebarTabs.tsx` | Vertikale Icon-Navigation |
| `WorkspaceSidebar.tsx` | `MainSidebar.tsx` | Kontextabhängiger Sidebar-Container |
| `TransparencyFooter.tsx` | Neu | Modell + Kosten + Quellen pro Antwort |

### Migration bestehender Komponenten

| Bestehend | Aktion |
|-----------|--------|
| `AppShell.tsx` | Wird durch `WorkspaceLayout.tsx` ersetzt |
| `SidebarTabs.tsx` | Wird durch `IconRail.tsx` ersetzt |
| `MainSidebar.tsx` | Wird durch `WorkspaceSidebar.tsx` ersetzt |
| `ConversationSidebar.tsx` | Bleibt, wird in WorkspaceSidebar eingebettet |
| `RAGSidebar.tsx` | Bleibt, wird in WorkspaceSidebar eingebettet |
| `ChatArea.tsx` | Bleibt unverändert (Content-Container) |
| `ChatContainer.tsx` | Bleibt unverändert |
| `DocumentsPageEmbedded.tsx` | Bleibt, wird über IconRail statt Tab erreichbar |
| `Header.tsx` | Wird vereinfacht (Model-Selector + minimale Actions) |

**In Phase 1 implementiert:** Chat + Dokumente voll funktional im neuen Layout. Tasks/Skills/Wissen als disabled Placeholder.

### ModelSelector

- Neue Sektion "Cloud-Modelle" unter den lokalen Ollama-Modellen
- Claude-Modelle zeigen Kosten-Badge: "~$0.02/Query"
- Cloud-Modelle nur sichtbar wenn `ANTHROPIC_API_KEY` konfiguriert
- Info-Icon: "Cloud-Modelle senden Daten an externe Server (PII wird maskiert)"

### SettingsModal

- Neuer Tab "AI Provider" (nur für Admins sichtbar)
- Anthropic API-Key Input (masked)
- PII Guard Toggle
- Kosten-Übersicht: Verbrauch aktueller Monat

### API-Usage Dashboard (Admin)

- Einfache Tabelle: Verbrauch pro User, pro Tag, pro Modell
- Gesamt-Kosten aktueller Monat
- Daten aus `api_usage_log` Tabelle

---

## Neue Dependencies

```bash
npm install @anthropic-ai/sdk
```

## Infrastruktur (Ubuntu Server)

Presidio als Docker-Service hinzufügen:

```
Ubuntu Server (192.168.2.38):
  :5432  PostgreSQL      (bestehend)
  :8080  Weaviate         (bestehend)
  :7687  Neo4j            (bestehend)
  :6379  Redis            (bestehend)
  :8001  Reranker         (bestehend)
  :8002  Docling Parser   (bestehend)
  :8003  Presidio Analyzer (NEU)
  :8004  Presidio Anonymizer (NEU)
```

Setup:
1. `docker-compose.yaml` in `ubuntu-infra/` erweitern
2. Presidio-Config für Deutsch anlegen (`ubuntu-infra/presidio/analyzer-config.yml`)
3. Deutsches SpaCy-Modell `de_core_news_lg` wird beim ersten Start geladen

---

## Dateien-Übersicht

### Geänderte Dateien
| Datei | Änderung |
|-------|----------|
| `server/src/index.ts` | Routes extrahieren → ~200 Zeilen |
| `server/src/services/RAGService.ts` | LLMRouter statt OllamaService |
| `server/src/services/rag/QueryRewriter.ts` | LLMRouter statt OllamaService |
| `src/contexts/ConversationContext.tsx` | API-basiert statt LocalStorage |
| `src/contexts/ChatContext.tsx` | Messages über API laden/speichern |
| `src/lib/conversationStorage.ts` | API-Client, LocalStorage nur Cache |
| `src/components/ModelSelector.tsx` | Cloud-Modelle anzeigen |
| `src/components/SettingsModal.tsx` | Provider-Tab hinzufügen |
| `src/App.tsx` | Workspace-Layout statt AppShell + Sidebar-Tabs |

### Neue Dateien
| Datei | Zweck |
|-------|-------|
| `server/src/services/llm/LLMProvider.ts` | Interface-Definition |
| `server/src/services/llm/OllamaProvider.ts` | Ollama-Wrapper |
| `server/src/services/llm/AnthropicProvider.ts` | Claude API Client |
| `server/src/services/llm/LLMRouter.ts` | Provider-Routing + Usage-Logging |
| `server/src/services/llm/PIIGuard.ts` | Presidio HTTP-Client (Mask/Unmask) |
| `ubuntu-infra/presidio/analyzer-config.yml` | Presidio-Config (Deutsch) |
| `server/src/services/ConversationService.ts` | Conversations CRUD |
| `src/components/layout/WorkspaceLayout.tsx` | 3-Spalten Shell (ersetzt AppShell) |
| `src/components/layout/IconRail.tsx` | Vertikale Icon-Navigation (ersetzt SidebarTabs) |
| `src/components/layout/WorkspaceSidebar.tsx` | Kontextabhängiger Sidebar-Container |
| `src/components/TransparencyFooter.tsx` | Modell + Kosten + Quellen pro Antwort |
| `server/src/routes/chat.ts` | Chat-Routes (extrahiert) |
| `server/src/routes/documents.ts` | Document-Routes (extrahiert) |
| `server/src/routes/rag.ts` | RAG-Routes (extrahiert) |
| `server/src/routes/models.ts` | Model-Routes (extrahiert) |
| `server/src/routes/conversations.ts` | Conversation-API |
| `server/src/migrations/009_conversations_and_llm.sql` | DB-Schema |

---

## Verifikation

1. **Backward-Kompatibilität:** Ohne `ANTHROPIC_API_KEY` verhält sich alles wie vorher
2. **Route-Refactoring:** Alle bestehenden Endpoints identisch erreichbar
3. **Ollama-Chat:** Funktioniert wie bisher über `ollama:qwen3:8b`
4. **Claude-Chat:** Neues Modell `anthropic:claude-sonnet-4-6` liefert Antworten
5. **PII-Guard (Presidio):** "Peter Kühne, peter@firma.de" → Presidio erkennt PERSON + EMAIL → maskiert an Claude → unmaskiert im Response
6. **PII-Guard Fallback:** Presidio stoppen → Cloud-Modelle werden blockiert, Ollama funktioniert weiter
6. **Konversationen:** Neue Konversation erstellen, Messages senden, Browser schließen, wieder öffnen → Messages sind da
7. **RAG mit Claude:** RAG-Suche + Claude-Antwort funktioniert
8. **Usage-Log:** Nach Cloud-Calls Eintrag in `api_usage_log` vorhanden
9. **TypeScript:** `npm run typecheck` fehlerfrei
