# Phase 4: Multi-Channel Access

**Zeitraum:** Wochen 11-14 (parallel zu Phase 3 möglich)
**Abhängigkeiten:** Phase 2 (Agent Framework)
**Ziel:** Slack-Bot und REST API. Die selbe Agent/Skill-Infrastruktur bedient alle Kanäle.

---

## 4.1 Channel-Architektur

```
server/src/channels/
  ChannelAdapter.ts       ← Interface: receiveMessage(), sendResponse()
  WebAdapter.ts           ← Wraps bestehende Express/SSE Endpoints
  SlackAdapter.ts         ← Slack Bolt SDK
  APIAdapter.ts           ← REST API mit API-Key Auth
  ChannelRouter.ts        ← Routet Messages zum Agent-System
  index.ts
```

### ChannelAdapter Interface

```typescript
interface IncomingMessage {
  channelType: 'web' | 'slack' | 'api' | 'telegram';
  channelUserId: string;    // Externe User-ID (Slack ID etc.)
  userId: UUID;             // Gemappte Cor7ex User-ID
  content: string;
  conversationId?: string;  // Thread/Conversation-Referenz
  metadata?: Record<string, any>;
}

interface OutgoingMessage {
  content: string;
  sources?: RAGSource[];
  agentSteps?: AgentStep[];
  metadata?: Record<string, any>;
}

interface ChannelAdapter {
  readonly channelType: string;
  initialize(): Promise<void>;
  sendResponse(channelUserId: string, message: OutgoingMessage): Promise<void>;
  // Incoming messages werden über Callbacks an ChannelRouter delegiert
}
```

### ChannelRouter

- Empfängt `IncomingMessage` von jedem Adapter
- Mappt externen User auf Cor7ex-User (via Email-Lookup)
- Entscheidet: direkter Chat vs. Agent-Task vs. Skill-Ausführung
- Erstellt/findet Konversation in PostgreSQL
- Delegiert an `AgentExecutor` oder `RAGService`
- Sendet Antwort zurück über den entsprechenden Adapter

---

## 4.2 Slack Integration

### Setup

- **SDK:** `@slack/bolt` (Socket Mode für Dev, HTTP für Prod)
- **Env-Variablen:** `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`, `SLACK_APP_TOKEN`
- Slack App muss im Workspace installiert werden (OAuth2 Scopes: `chat:write`, `im:history`, `users:read.email`)

### Features

**Mentions + DMs:**
- Bot reagiert auf `@botname` in Channels und auf DMs
- Slack User wird via Email zu Cor7ex User gemappt
- Nicht-gemappte User bekommen Fehlermeldung

**Thread-Konversationen:**
- Jeder Slack-Thread = eine Cor7ex-Konversation
- Chat-History wird aus Thread geladen
- Antworten im Thread (nicht im Channel)

**Slash Commands:**
- `/ask <frage>` – Stellt Frage an Wissensspeicher
- `/skill <name> <inputs>` – Führt Skill aus
- `/tasks` – Zeigt laufende Agent-Tasks

**Interaktive Elemente:**
- Skill-Ausführungs-Ergebnisse als Block Kit Messages
- "Details anzeigen"-Button → Link zur Web-UI
- Feedback-Buttons (Daumen hoch/runter)

### User-Mapping

```sql
-- Erweiterung der users Tabelle
ALTER TABLE users ADD COLUMN slack_user_id TEXT;
CREATE INDEX idx_users_slack ON users(slack_user_id) WHERE slack_user_id IS NOT NULL;
```

Mapping passiert beim ersten Kontakt: Slack-Email wird gegen `users.email` geprüft.

---

## 4.3 REST API (für externe Agents/Tools)

### API-Key Authentication

```
server/src/middleware/apiKeyAuth.ts
```

- API-Key wird im `Authorization: Bearer vxr_...` Header gesendet
- Key-Format: `vxr_` Prefix + 32 zufällige alphanumerische Zeichen
- Gehasht (SHA-256) in DB gespeichert
- Lookup über `key_prefix` (erste 8 Zeichen) + Hash-Vergleich
- Jeder Key ist an einen User gebunden → erbt dessen Permissions

### Endpoints

```
POST /api/v1/query
  Auth: API-Key
  Body: { query: string, model?: string, mode?: 'chat' | 'agent' }
  Response: { answer: string, sources?: [], taskId?: string }

POST /api/v1/skills/:slug/execute
  Auth: API-Key
  Body: { inputs: Record<string, any> }
  Response: { taskId: string, status: string }

GET  /api/v1/tasks/:id
  Auth: API-Key
  Response: { task: AgentTask, steps: AgentStep[] }

GET  /api/v1/skills
  Auth: API-Key
  Response: { skills: Skill[] }
```

### Webhooks (optional)

- User kann Webhook-URL konfigurieren
- Bei Task-Completion wird POST an Webhook gesendet
- Payload: `{ taskId, status, result, duration }`

---

## 4.4 Datenbank

### Migration `012_channels.sql`

```sql
-- API Keys
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  tenant_id UUID,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,  -- Erste 8 Zeichen für schnelles Lookup
  scopes TEXT[] DEFAULT '{read,query}',
  rate_limit INTEGER DEFAULT 100,  -- Requests pro Minute
  webhook_url TEXT,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix) WHERE is_active = TRUE;
CREATE INDEX idx_api_keys_user ON api_keys(user_id);

-- Slack User Mapping
ALTER TABLE users ADD COLUMN IF NOT EXISTS slack_user_id TEXT;
CREATE INDEX idx_users_slack ON users(slack_user_id) WHERE slack_user_id IS NOT NULL;

-- Channel Messages (Audit)
CREATE TABLE channel_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL,
  channel_user_id TEXT,
  user_id UUID REFERENCES users(id),
  conversation_id UUID REFERENCES conversations(id),
  task_id UUID REFERENCES agent_tasks(id),
  direction TEXT CHECK (direction IN ('incoming', 'outgoing')),
  content TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_channel_messages_conv ON channel_messages(conversation_id, created_at);
```

---

## 4.5 Frontend (Admin)

### API-Key Management

- Admin-Seite: `/admin/api-keys`
- Key erstellen (Name, Scopes, Rate Limit, Ablaufdatum)
- Key wird einmalig nach Erstellung angezeigt (danach nicht mehr sichtbar)
- Key-Liste: Name, Prefix, letzter Zugriff, Status
- Key deaktivieren/löschen

### Slack Integration Settings

- Admin-Seite: Slack-Konfiguration
- Bot-Token + Signing Secret eingeben
- Connection-Status anzeigen
- User-Mapping-Übersicht

### Channel-Indikator

- Agent-Tasks zeigen Herkunftskanal (Web/Slack/API)
- Icon-Badge auf Task-Cards

---

## Neue Dependencies

```bash
npm install @slack/bolt @slack/web-api
```

---

## Dateien-Übersicht

### Neue Dateien
| Datei | Zweck |
|-------|-------|
| `server/src/channels/ChannelAdapter.ts` | Interface |
| `server/src/channels/WebAdapter.ts` | Web-Wrapper |
| `server/src/channels/SlackAdapter.ts` | Slack Bot |
| `server/src/channels/APIAdapter.ts` | REST API |
| `server/src/channels/ChannelRouter.ts` | Message-Routing |
| `server/src/middleware/apiKeyAuth.ts` | API-Key Middleware |
| `server/src/routes/v1.ts` | External API Routes |
| `server/src/routes/apiKeys.ts` | API-Key Management |
| `server/src/migrations/012_channels.sql` | DB-Schema |
| `src/pages/AdminApiKeysPage.tsx` | API-Key Admin UI |

---

## Verifikation

1. **Slack Bot:** Bot in Workspace installieren → Mention → Antwort im Thread
2. **Slack User Mapping:** Gemappter User sieht nur seine Dokumente
3. **API-Key:** Key erstellen → Query via curl → Antwort erhalten
4. **Rate Limiting:** Mehr als Rate-Limit Requests → 429 Response
5. **Skill via API:** `/api/v1/skills/quarterly-report/execute` → Task läuft
6. **Channel-Audit:** Messages in `channel_messages` Tabelle vorhanden
7. **Permission-Vererbung:** API-Key mit Employee-User findet keine restricted Docs
