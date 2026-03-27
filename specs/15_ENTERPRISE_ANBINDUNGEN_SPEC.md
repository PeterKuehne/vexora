# Spec: Enterprise-Anbindungen — Die Software des Unternehmens

**Status:** Nicht implementiert, Architektur-Entscheidungen getroffen
**Bezug:** [00_COR7EX_VISION.md](./00_COR7EX_VISION.md) — Säule 3: "Enterprise-Anbindungen"
**Technologien:** Vercel Chat SDK (Kanäle), Custom GraphQL-Tools (Systeme), MCP (Zukunft)

---

## Zusammenfassung

Cor7ex steht nicht alleine. Es verbindet sich mit der bestehenden Software-Landschaft des Unternehmens. Diese Anbindung hat zwei Dimensionen:

1. **Kanäle** — Wo der Agent erreichbar ist (Slack, Teams, WhatsApp, Web-App)
2. **Systeme** — Worin der Agent handeln kann (Samaritano, ERP, externe APIs)

Jedes angebundene System wird zu einem Werkzeug das der Agent nutzen kann. Schrittweise, kein Big Bang.

---

## 1. Kanäle — Wo der Agent erreichbar ist

### 1.1 Problem

Aktuell ist der Cor7ex Agent nur über die **Web-App** erreichbar. Mitarbeiter müssen sich einloggen und die App öffnen. Die Vision sagt: Der Agent sollte dort sein wo die Mitarbeiter bereits arbeiten.

### 1.2 Entscheidung: Vercel Chat SDK

**Chat SDK** (MIT Lizenz, TypeScript, Beta seit März 2026) ermöglicht es den Agent-Code einmal zu schreiben und über multiple Messaging-Plattformen auszuliefern.

**Warum Chat SDK:**
- TypeScript — gleiche Sprache wie Cor7ex
- Vercel AI SDK Integration — nutzen wir bereits für den Agent
- PostgreSQL State Adapter — passt zu bestehender DB
- MIT Lizenz — kommerziell nutzbar
- Event-driven — Mentions, Messages, Reactions, Slash-Commands

### 1.3 Unterstützte Kanäle

| Kanal | Priorität | Adapter | Streaming | Besonderheiten |
|---|---|---|---|---|
| **Web-App** | Bereits da | Eigenes Frontend | SSE (nativ) | Haupt-UI, vollständige Features |
| **Slack** | Hoch | `@chat-adapter/slack` | Nativ | Cards, Modals, Reactions |
| **Microsoft Teams** | Hoch | `@chat-adapter/teams` | Post+Edit | Adaptive Cards, Enterprise-SSO |
| **WhatsApp** | Mittel | `@chat-adapter/whatsapp` | Nein | 24h Messaging-Fenster (Meta) |
| **Telegram** | Niedrig | `@chat-adapter/telegram` | Post+Edit | Teilweise Cards |
| **E-Mail** | Niedrig | `@resend/chat-sdk-adapter` | Nein | Bidirektional, HTML, Threading |

### 1.4 Architektur

```
Slack/Teams/WhatsApp/Telegram
    │
    ▼
Chat SDK (Webhook-Empfang + Event-Routing)
    │
    ▼
Cor7ex Agent-Pipeline
    │  Query-Router → Model-Auswahl
    │  RAG → Wissensspeicher
    │  Skills → Workflow-Ausführung
    │  Tools → Samaritano, DB, etc.
    ▼
Chat SDK (Antwort zurück in den Kanal)
    │
    ▼
User sieht Antwort in Slack/Teams/WhatsApp
```

Die Web-App bleibt als Haupt-UI bestehen. Chat SDK ist die **zusätzliche Delivery-Schicht**.

### 1.5 Kanal-Adapter Implementierung

**Neuer Service:** `server/src/services/channels/ChatSDKService.ts`

```typescript
import { Chat } from 'chat';
import { SlackAdapter } from '@chat-adapter/slack';
import { PostgresStateAdapter } from '@chat-adapter/state-pg';

const chat = new Chat({
  adapters: [new SlackAdapter()],
  state: new PostgresStateAdapter({ connectionString: env.DATABASE_URL }),
});

chat.onNewMention(async ({ thread, message }) => {
  // Query an Cor7ex Agent-Pipeline weiterleiten
  const result = await agentExecutor.execute(
    message.text,
    getUserContext(message.userId),
    { emitSSE: (event) => thread.post(event.data.result) }
  );
});
```

**Herausforderungen:**
- **Auth-Mapping:** Slack/Teams User → Cor7ex User (via E-Mail Matching)
- **Berechtigungen:** Kanal-User erbt Cor7ex-Rolle für RLS
- **Streaming:** Slack unterstützt nativ, andere via Post+Edit
- **Rich Content:** Markdown → plattformspezifische Formatierung (Block Kit, Adaptive Cards)
- **Multi-Turn:** Thread-Subscriptions für Konversations-Kontext

### 1.6 Konfiguration

| Variable | Beschreibung |
|---|---|
| `SLACK_BOT_TOKEN` | Slack Bot OAuth Token |
| `SLACK_SIGNING_SECRET` | Webhook Verification |
| `TEAMS_APP_ID` | Teams App Registration |
| `TEAMS_APP_PASSWORD` | Teams App Secret |
| `WHATSAPP_TOKEN` | Meta Business API Token |
| `WHATSAPP_VERIFY_TOKEN` | Webhook Verification |
| `CHANNELS_ENABLED` | Komma-separierte Liste: `slack,teams,whatsapp` |

---

## 2. Systeme — Worin der Agent handeln kann

### 2.1 Problem

Der Agent kann aktuell im Wissensspeicher suchen, Dokumente erstellen und SQL lesen. Aber er kann nicht in der **operativen Software** des Unternehmens handeln — keine Einsatzpläne erstellen, keine Zeiterfassung abfragen, keine Buchhaltungsdaten auswerten.

### 2.2 Samaritano-Plattform

**Was ist Samaritano?**
- NestJS + GraphQL + PostgreSQL Backend
- 65 Queries + 70 Mutations
- Domänen: Einsatzplanung, Zeiterfassung, Buchhaltung, AÜG (Arbeitnehmerüberlassung)
- Standort: `/Users/peter/Coding/Projekte-samaritano/samaritano-platform`
- Port: 3000

### 2.3 Entscheidung: Fokussierte Custom-Tools (kein MCP)

**135 GraphQL-Operationen direkt als Agent-Tools zu exponieren wäre katastrophal** — LLMs werden bei >10 Tools unzuverlässig. Stattdessen: **10-15 domänen-spezifische Tools** die jeweils mehrere GraphQL-Operationen bündeln.

**Warum kein MCP jetzt:**
- Extra Infrastruktur (eigener Server-Prozess) nötig
- Wir besitzen beide Systeme — kein Protokoll-Standard nötig
- Auth ist in der GraphQL-Schicht bereits gelöst
- MCP-Auth für Enterprise noch nicht ausgereift
- Migration Custom-Tools → MCP später trivial (gleiche Business-Logik)

**Warum MCP im Blick behalten:**
- 10.000+ MCP Server, Backed by Anthropic/OpenAI/Google/Microsoft
- `@ai-sdk/mcp` Paket existiert für unseren Stack
- Apollo's Insight: *"GraphQL is the ideal orchestration layer for MCP"*
- Sinnvoll wenn andere AI-Clients (Claude Desktop, VS Code) Zugriff brauchen

### 2.4 Tool-Design: Domänen-Gruppierung

Statt 135 einzelne Operationen → **10-15 aggregierte Tools** nach Geschäftsdomäne:

| Tool | Domäne | Bündelt ca. | Rollen |
|---|---|---|---|
| `samaritano_einsatzplan_suchen` | Einsatzplanung | 3-4 Queries | Employee+ |
| `samaritano_einsatzplan_erstellen` | Einsatzplanung | 2-3 Mutations | Manager+ |
| `samaritano_einsatzplan_optimieren` | Einsatzplanung | 2-3 Queries + Logik | Manager+ |
| `samaritano_mitarbeiter_suchen` | Personal | 2-3 Queries | Employee+ |
| `samaritano_mitarbeiter_verfuegbarkeit` | Personal | 2-3 Queries | Manager+ |
| `samaritano_zeiterfassung_abfragen` | Zeiterfassung | 2-3 Queries | Employee+ |
| `samaritano_zeiterfassung_erfassen` | Zeiterfassung | 1-2 Mutations | Employee+ |
| `samaritano_buchhaltung_report` | Buchhaltung | 4-5 Queries | Manager+ |
| `samaritano_buchhaltung_rechnung` | Buchhaltung | 2-3 Queries | Manager+ |
| `samaritano_aueg_uebersicht` | AÜG | 3-4 Queries | Manager+ |
| `samaritano_aueg_vertrag` | AÜG | 2-3 Queries/Mutations | Admin |

**Design-Prinzip:** Jedes Tool bildet eine **Business-Aktion** ab, nicht eine technische Operation. Der Agent denkt in "Einsatzplan für nächste Woche erstellen", nicht in "createScheduleEntry Mutation aufrufen".

### 2.5 Tool-Implementierung

**Neues Verzeichnis:** `server/src/services/agents/tools/samaritano/`

```typescript
// server/src/services/agents/tools/samaritano/einsatzplan-suchen.ts
import type { AgentTool } from '../../types.js';

export const samaritanoEinsatzplanSuchen: AgentTool = {
  name: 'samaritano_einsatzplan_suchen',
  description: `Suche Einsatzpläne in Samaritano.
    Use when: "Welche Einsätze", "Wer arbeitet am", "Einsatzplan für",
    "Schichtplan", "Dienstplan"
    Do NOT use when: Allgemeine Fragen ohne Bezug zur Einsatzplanung`,
  parameters: {
    type: 'object',
    required: ['zeitraum'],
    properties: {
      zeitraum: { type: 'string', description: 'z.B. "nächste Woche", "2026-03-24"' },
      mitarbeiter: { type: 'string', description: 'Name oder ID (optional)' },
      standort: { type: 'string', description: 'Filiale/Standort (optional)' },
    },
  },
  requiredRoles: ['Employee', 'Manager', 'Admin'],
  execute: async (args, context) => {
    const { graphqlClient } = await import('../../../samaritano/client.js');

    // Mehrere GraphQL Queries orchestrieren
    const plan = await graphqlClient.query({
      query: EINSATZPLAN_QUERY,
      variables: { von: parseDate(args.zeitraum), bis: parseEndDate(args.zeitraum) },
      context: { userId: context.userId },
    });

    return {
      content: formatEinsatzplan(plan.data),
      metadata: { source: 'samaritano', operation: 'einsatzplan_suchen' },
    };
  },
};
```

### 2.6 GraphQL Client

**Neuer Service:** `server/src/services/samaritano/client.ts`

```typescript
import { GraphQLClient } from 'graphql-request';

export const graphqlClient = new GraphQLClient(env.SAMARITANO_URL + '/graphql', {
  headers: () => ({
    Authorization: `Bearer ${getServiceToken()}`,
  }),
});
```

**Auth-Strategie:**
- Service-to-Service Token (Cor7ex → Samaritano)
- User-Context wird als Header mitgegeben für Samaritano's eigene Berechtigungsprüfung
- Kein User-Token-Durchreichen — Cor7ex authentifiziert den User, Samaritano vertraut dem Service-Token

### 2.7 Konfiguration

| Variable | Default | Beschreibung |
|---|---|---|
| `SAMARITANO_URL` | `http://localhost:3000` | Samaritano GraphQL Endpoint |
| `SAMARITANO_SERVICE_TOKEN` | — | Service-to-Service Auth Token |
| `SAMARITANO_ENABLED` | `false` | Feature-Flag |

---

## 3. Schrittweise Anbindung

Die Vision sagt: *"Kein Big Bang. Jedes neue System wird ein Tool. Nach und nach aufbauen."*

### Phase 1: Samaritano Lesen (Queries)

Nur lesende Operationen — kein Risiko, schneller Mehrwert.

| Tool | Was es tut |
|---|---|
| `samaritano_einsatzplan_suchen` | Einsatzpläne abfragen |
| `samaritano_mitarbeiter_suchen` | Mitarbeiterdaten finden |
| `samaritano_zeiterfassung_abfragen` | Arbeitsstunden einsehen |
| `samaritano_buchhaltung_report` | Finanzdaten auswerten |

### Phase 2: Samaritano Schreiben (Mutations)

Schreibende Operationen — mit Bestätigungsdialog.

| Tool | Was es tut | Sicherheit |
|---|---|---|
| `samaritano_einsatzplan_erstellen` | Einsatzplan anlegen | Agent fragt User vor Mutation |
| `samaritano_zeiterfassung_erfassen` | Stunden buchen | Agent fragt User vor Mutation |

**Bestätigungs-Pattern:**
```
Agent: "Ich möchte folgenden Einsatzplan erstellen:
  - Mitarbeiter: Max Müller
  - Datum: 25.03.2026
  - Schicht: Früh (06:00-14:00)
  - Standort: Filiale Nord

  Soll ich das so anlegen?"
User: "Ja"
Agent: [führt Mutation aus]
```

### Phase 3: Erste Kanäle (Slack/Teams)

Chat SDK Integration für die meistgenutzten Kanäle.

### Phase 4: Weitere Systeme

Jedes neue System wird nach dem gleichen Pattern angebunden:
1. GraphQL/REST API identifizieren
2. 3-5 fokussierte Tools pro Domäne bauen
3. In ToolRegistry registrieren
4. Skills für typische Workflows erstellen

---

## 4. MCP-Migrationspfad

Wenn MCP ausgereifter ist oder andere AI-Clients Zugriff brauchen:

```
Heute:
  Agent → Custom Tool → GraphQL Client → Samaritano

Später:
  Agent → @ai-sdk/mcp → MCP Server → GraphQL Client → Samaritano
  Claude Desktop → MCP Server → GraphQL Client → Samaritano
  VS Code → MCP Server → GraphQL Client → Samaritano
```

Die Business-Logik (GraphQL Queries, Daten-Formatierung, Berechtigungsprüfung) bleibt identisch. Nur das Wrapping ändert sich von Custom-Tool auf MCP-Tool.

**Trigger für MCP-Migration:**
- Andere AI-Clients brauchen Samaritano-Zugriff
- MCP-Auth ist Enterprise-reif (OAuth 2.1 + Audit-Trail stabil)
- Kunden/Partner wollen Samaritano-Daten via eigene AI-Tools abfragen

---

## 5. Was bereits implementiert ist

| Feature | Status | Datei(en) |
|---|---|---|
| Web-App als Kanal | ✅ | AgentTaskDetail.tsx, routes/agents.ts |
| Agent-Pipeline (RAG, Tools, Skills) | ✅ | AgentExecutor.ts |
| Tool-Registry mit Rollen-Filter | ✅ | ToolRegistry.ts |
| 11 Built-in Tools | ✅ | server/src/services/agents/tools/ |
| Vercel AI SDK 6 | ✅ | ai-provider.ts |
| Samaritano GraphQL Client | ❌ | Nicht implementiert |
| Samaritano Tools | ❌ | Nicht implementiert |
| Chat SDK Integration | ❌ | Nicht implementiert |
| Slack/Teams/WhatsApp Adapter | ❌ | Nicht implementiert |
| MCP Server | ❌ | Nicht geplant (Zukunft) |

## 6. Was implementiert werden muss

| Feature | Phase | Priorität | Aufwand |
|---|---|---|---|
| **Samaritano GraphQL Client** | 1 | Hoch | Klein |
| **4 lesende Samaritano-Tools** | 1 | Hoch | Mittel |
| **Bestätigungs-Pattern für Mutations** | 2 | Mittel | Klein |
| **2-3 schreibende Samaritano-Tools** | 2 | Mittel | Mittel |
| **Chat SDK Setup + State Adapter** | 3 | Mittel | Mittel |
| **Slack Adapter + Auth-Mapping** | 3 | Mittel | Mittel |
| **Teams Adapter** | 3 | Niedrig | Mittel |
| **WhatsApp Adapter** | 4 | Niedrig | Mittel |
| **MCP Server (optional)** | Zukunft | Niedrig | Mittel |

### Implementierungs-Reihenfolge

1. Samaritano GraphQL Client mit Service-Token Auth
2. Erste 4 lesende Tools (Einsatzplan, Mitarbeiter, Zeiterfassung, Buchhaltung)
3. Skills für Samaritano-Workflows erstellen (z.B. "Einsatzplan optimieren")
4. Schreibende Tools mit Bestätigungs-Pattern
5. Chat SDK Setup + Slack als erster externer Kanal
6. Teams + WhatsApp nach Bedarf

---

## 7. Verifikation

1. **Samaritano Lesen:** User fragt "Wer arbeitet nächste Woche Frühschicht?" → Agent ruft `samaritano_einsatzplan_suchen` auf → zeigt Ergebnis
2. **Samaritano Schreiben:** User sagt "Erstelle Einsatzplan für Müller am Montag Früh" → Agent zeigt Bestätigung → User bestätigt → Mutation wird ausgeführt
3. **Berechtigungen:** Employee kann Einsatzplan lesen, aber nicht erstellen (Manager-only Tool)
4. **Slack-Kanal:** User erwähnt @cor7ex in Slack → Agent antwortet im Thread → Multi-Turn funktioniert
5. **Auth-Mapping:** Slack User peter@firma.de → Cor7ex User Peter (Manager) → sieht Manager-Level Daten
6. **Fehlerfall:** Samaritano nicht erreichbar → klare Fehlermeldung "Samaritano-System nicht erreichbar"
7. **Schrittweise:** Neue Systeme werden als weitere Tools hinzugefügt ohne bestehende zu ändern
