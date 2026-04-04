# Spec: Heartbeat Engine

**Status:** Entwurf
**Abhaengigkeiten:** [21_HIVE_MIND_ORCHESTRATOR_SPEC.md](./21_HIVE_MIND_ORCHESTRATOR_SPEC.md), [23_MEMORY_SYSTEM_SPEC.md](./23_MEMORY_SYSTEM_SPEC.md)
**Bezug:** [00_COR7EX_VISION.md](./00_COR7EX_VISION.md) — Abschnitt "Heartbeat"

---

## Zusammenfassung

Die Heartbeat Engine fuehrt proaktive Pruefungen im Hintergrund aus — ohne dass ein User fragt. Ergebnisse warten bis der User Cor7ex oeffnet und werden als **Briefing** im Chat praesentiert, mit strukturierten **Kacheln** in den Kontext-Panels rechts.

**Kernprinzip:** Der Hive Mind wartet nicht auf Fragen. Er beobachtet, erkennt und informiert — wie ein aufmerksamer Kollege der morgens sagt "3 Dinge die du wissen solltest".

---

## Heartbeat-Typen

### Zwei Typen (Kosten-Optimierung)

| Typ | Was | Wann | Kosten | Beispiel |
|---|---|---|---|---|
| **Data Heartbeat** | Reine DB/MCP-Queries, kein LLM | 90% der Faelle | Guenstig | "Wie viele Rechnungen sind > 30 Tage offen?" |
| **Agent Heartbeat** | Expert Agent analysiert + interpretiert | Wenn Zusammenhaenge oder Empfehlungen noetig | Teurer | "Analysiere Kuendigungsmuster der letzten 6 Monate" |

### Drei Ebenen

| Ebene | Wer definiert | Beispiel |
|---|---|---|
| **Unternehmens-Heartbeat** | Admin | "Taeglich offene Rechnungen > 30 Tage pruefen" |
| **User-Heartbeat** | Mitarbeiter selbst | "Morgens unbesetzte Schichten zeigen" |
| **Gelernter Heartbeat** | Hive Mind erkennt selbst | "Lisa fragt montags immer nach Klinikum X" |

### Trigger: Nur Cron (Phase 1)

Keine echten Events. Cron-Jobs pruefen regelmaessig Schwellwerte. Event-basierte Trigger (Webhooks) als spaeteres Feature.

---

## Heartbeat-Definition

### Schema

```typescript
interface HeartbeatDefinition {
  id: string;
  name: string;
  description: string;
  cron: string;                          // Cron-Expression ("0 7 * * 1-5")
  type: 'data' | 'agent';
  level: 'company' | 'user' | 'learned';

  // Data Heartbeat: MCP Tool Call
  dataQuery?: {
    tool: string;                        // z.B. "sama_assignmentsNearLimit"
    args?: Record<string, unknown>;      // Tool-Argumente
    selections?: string;                 // GraphQL Selections
    threshold?: {                        // Wann ist das Ergebnis relevant?
      field: string;                     // z.B. "length" (Array-Laenge)
      operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'ne';
      value: number;
    };
  };

  // Agent Heartbeat: Expert Agent Aufruf
  agentTask?: {
    agent: string;                       // z.B. "hr-expert"
    task: string;                        // Aufgabe fuer den Agent
  };

  // Scope
  tenantId: string;
  userId?: string;                       // Nur bei User/Learned Heartbeats
  roles?: string[];                      // Welche Rollen sehen das Ergebnis?

  // UI
  icon?: string;                         // Emoji fuer die Kachel
  priority?: 'critical' | 'warning' | 'info';
  enabled: boolean;
}
```

### Beispiel-Definitionen

```typescript
// Unternehmens-Heartbeat: AUeG-Fristen
const auegHeartbeat: HeartbeatDefinition = {
  id: 'hb-aueg-fristen',
  name: 'AUeG-Fristen',
  description: 'Einsaetze die in 60 Tagen die 18-Monats-Grenze erreichen',
  cron: '0 7 * * 1-5',                  // Werktags 7:00
  type: 'data',
  level: 'company',
  dataQuery: {
    tool: 'sama_assignmentsNearLimit',
    args: { daysThreshold: 60 },
    threshold: { field: 'length', operator: 'gt', value: 0 },
  },
  tenantId: 'samaritano',
  roles: ['ADMIN', 'DISPATCHER'],
  icon: '⚠️',
  priority: 'warning',
  enabled: true,
};

// Unternehmens-Heartbeat: Offene Rechnungen
const offeneRechnungen: HeartbeatDefinition = {
  id: 'hb-offene-rechnungen',
  name: 'Offene Rechnungen',
  description: 'Rechnungen die laenger als 30 Tage offen sind',
  cron: '0 8 * * 1-5',                  // Werktags 8:00
  type: 'data',
  level: 'company',
  dataQuery: {
    tool: 'sama_accountMoves',
    args: { filter: { state: 'POSTED', paymentState: 'NOT_PAID' } },
    selections: '{ id moveNumber totalGross dueDate customerId }',
    threshold: { field: 'length', operator: 'gt', value: 0 },
  },
  tenantId: 'samaritano',
  roles: ['ADMIN', 'ACCOUNTANT'],
  icon: '💰',
  priority: 'warning',
  enabled: true,
};

// User-Heartbeat: Lisas Schicht-Check
const lisaSchichten: HeartbeatDefinition = {
  id: 'hb-lisa-schichten',
  name: 'Unbesetzte Schichten',
  description: 'Schichten die naechste Woche noch unbesetzt sind',
  cron: '0 7 * * 1-5',                  // Werktags 7:00
  type: 'data',
  level: 'user',
  dataQuery: {
    tool: 'sama_assignments',
    args: { status: 'ACTIVE' },
    selections: '{ id assignmentId assignmentStart customerId }',
  },
  tenantId: 'samaritano',
  userId: 'lisa-123',
  icon: '📋',
  priority: 'info',
  enabled: true,
};

// Agent Heartbeat: Kuendigungsmuster (monatlich)
const kuendigungsmuster: HeartbeatDefinition = {
  id: 'hb-kuendigungsmuster',
  name: 'Kuendigungsmuster',
  description: 'HR-Agent analysiert Kuendigungstrends',
  cron: '0 9 1 * *',                    // 1. des Monats, 9:00
  type: 'agent',
  level: 'company',
  agentTask: {
    agent: 'hr-expert',
    task: 'Analysiere Kuendigungen der letzten 3 Monate. Gibt es Muster (saisonal, pro Einrichtung, pro Qualifikation)? Vergleiche mit dem Vorjahreszeitraum.',
  },
  tenantId: 'samaritano',
  roles: ['ADMIN'],
  icon: '📊',
  priority: 'info',
  enabled: true,
};
```

---

## Heartbeat Engine

### Architektur

```
┌──────────────────────────────────────────────┐
│  HEARTBEAT ENGINE                            │
│                                              │
│  Cron Scheduler (node-cron)                  │
│  ├── Laedt alle HeartbeatDefinitions         │
│  ├── Registriert Cron-Jobs                   │
│  └── Pro Job:                                │
│      │                                       │
│      ├── Data Heartbeat?                     │
│      │   → MCP Tool Call ausfuehren          │
│      │   → Threshold pruefen                 │
│      │   → Wenn relevant: Ergebnis speichern │
│      │                                       │
│      └── Agent Heartbeat?                    │
│          → Expert Agent starten              │
│          → Ergebnis speichern                │
│                                              │
│  Ergebnis-Speicher (PostgreSQL)              │
│  └── heartbeat_results Tabelle               │
│      ├── heartbeatId                         │
│      ├── tenantId                            │
│      ├── userId (optional)                   │
│      ├── data (JSON)                         │
│      ├── priority                            │
│      ├── deliveredAt (null = nicht gelesen)   │
│      └── createdAt                           │
└──────────────────────────────────────────────┘
```

### HeartbeatEngine Service

```typescript
import cron from 'node-cron';

class HeartbeatEngine {
  private jobs: Map<string, cron.ScheduledTask> = new Map();

  constructor(
    private mcpClient: McpClientManager,
    private agentExecutor: AgentExecutor,
    private db: DatabaseService,
    private memoryService: MemoryService,
  ) {}

  /**
   * Alle Heartbeats laden und Cron-Jobs registrieren
   */
  async initialize(tenantId: string): Promise<void> {
    const definitions = await this.loadDefinitions(tenantId);

    for (const def of definitions) {
      if (!def.enabled) continue;

      const job = cron.schedule(def.cron, async () => {
        try {
          await this.executeHeartbeat(def);
        } catch (error) {
          console.error(`[Heartbeat] ${def.name} failed:`, error);
        }
      });

      this.jobs.set(def.id, job);
    }

    console.log(`[Heartbeat] ${this.jobs.size} jobs registered for tenant ${tenantId}`);
  }

  /**
   * Einzelnen Heartbeat ausfuehren
   */
  private async executeHeartbeat(def: HeartbeatDefinition): Promise<void> {
    console.log(`[Heartbeat] Executing: ${def.name}`);

    let result: HeartbeatResult;

    if (def.type === 'data' && def.dataQuery) {
      result = await this.executeDataHeartbeat(def);
    } else if (def.type === 'agent' && def.agentTask) {
      result = await this.executeAgentHeartbeat(def);
    } else {
      return;
    }

    // Threshold pruefen (nur Data Heartbeats)
    if (def.dataQuery?.threshold && !this.checkThreshold(result.data, def.dataQuery.threshold)) {
      return; // Nicht relevant → nicht speichern
    }

    // Ergebnis speichern
    await this.saveResult(def, result);
  }

  /**
   * Data Heartbeat: MCP Tool Call
   */
  private async executeDataHeartbeat(def: HeartbeatDefinition): Promise<HeartbeatResult> {
    const toolResult = await this.mcpClient.callTool(
      def.dataQuery!.tool.replace('sama_', ''),  // MCP Tool Name ohne Prefix
      {
        args: def.dataQuery!.args ? JSON.stringify(def.dataQuery!.args) : undefined,
        selections: def.dataQuery!.selections,
      },
    );

    return {
      type: 'data',
      data: typeof toolResult === 'string' ? JSON.parse(toolResult) : toolResult,
      summary: null,  // Wird vom Briefing-LLM generiert
    };
  }

  /**
   * Agent Heartbeat: Expert Agent starten
   */
  private async executeAgentHeartbeat(def: HeartbeatDefinition): Promise<HeartbeatResult> {
    // Agent Memory laden fuer besseren Kontext
    const agentMemory = await this.memoryService.recallAgentMemory(
      def.agentTask!.agent,
      def.agentTask!.task,
    );

    // Expert Agent als ToolLoopAgent starten
    const result = await this.agentExecutor.executeHeartbeatAgent(
      def.agentTask!.agent,
      def.agentTask!.task,
      agentMemory,
    );

    return {
      type: 'agent',
      data: result.data,
      summary: result.text,
    };
  }

  /**
   * Threshold pruefen
   */
  private checkThreshold(data: unknown, threshold: HeartbeatDefinition['dataQuery']['threshold']): boolean {
    if (!threshold) return true;

    let value: number;
    if (threshold.field === 'length' && Array.isArray(data)) {
      value = data.length;
    } else if (typeof data === 'object' && data !== null) {
      value = (data as Record<string, number>)[threshold.field] ?? 0;
    } else {
      return true;
    }

    switch (threshold.operator) {
      case 'gt': return value > threshold.value;
      case 'gte': return value >= threshold.value;
      case 'lt': return value < threshold.value;
      case 'lte': return value <= threshold.value;
      case 'eq': return value === threshold.value;
      case 'ne': return value !== threshold.value;
    }
  }

  /**
   * Ungelesene Ergebnisse fuer einen User laden
   */
  async getUndeliveredResults(userId: string, tenantId: string, userRole: string): Promise<HeartbeatResult[]> {
    return this.db.query(`
      SELECT hr.*, hd.name, hd.icon, hd.priority, hd.description
      FROM heartbeat_results hr
      JOIN heartbeat_definitions hd ON hr.heartbeat_id = hd.id
      WHERE hr.tenant_id = $1
        AND hr.delivered_at IS NULL
        AND (hr.user_id IS NULL OR hr.user_id = $2)
        AND (hd.roles IS NULL OR $3 = ANY(hd.roles))
      ORDER BY hd.priority DESC, hr.created_at DESC
    `, [tenantId, userId, userRole]);
  }

  /**
   * Ergebnisse als "gelesen" markieren
   */
  async markDelivered(resultIds: string[]): Promise<void> {
    await this.db.query(`
      UPDATE heartbeat_results
      SET delivered_at = NOW()
      WHERE id = ANY($1)
    `, [resultIds]);
  }
}
```

---

## Briefing: Wenn der User Cor7ex oeffnet

### Flow

```
Lisa oeffnet Cor7ex morgens um 8:15
    │
    ▼
Frontend: GET /api/heartbeat/briefing
    │
    ▼
Backend:
  1. Ungelesene Heartbeat-Ergebnisse laden (Rolle + User gefiltert)
  2. Wenn Ergebnisse vorhanden:
     → Hive Mind (LLM) fasst alle Ergebnisse zusammen
     → Erkennt Zusammenhaenge zwischen Ergebnissen
     → Generiert natuerliches Briefing + Panel-Daten
  3. Ergebnisse als "delivered" markieren
    │
    ▼
Lisa sieht:
  Chat:   "Guten Morgen Lisa. Hier dein Ueberblick: ..."
  Panels: Kacheln mit Details (klickbar)
```

### Briefing-Generierung

```typescript
async function generateBriefing(
  results: HeartbeatResult[],
  userName: string,
  userMemory: string,
): Promise<{ text: string; panels: Panel[] }> {

  if (results.length === 0) {
    return {
      text: `Guten Morgen ${userName}. Keine neuen Meldungen — alles im gruenen Bereich.`,
      panels: [],
    };
  }

  // Hive Mind fasst zusammen (EIN LLM-Call)
  const prompt = `
Du bist der Hive Mind. Erstelle ein kurzes Morgen-Briefing fuer ${userName}.

Heartbeat-Ergebnisse:
${results.map(r => `- [${r.priority}] ${r.name}: ${JSON.stringify(r.data)}`).join('\n')}

User-Praeferenzen:
${userMemory}

Regeln:
- Kritische Punkte zuerst
- Erkenne Zusammenhaenge zwischen den Ergebnissen
- Maximal 5-8 Saetze
- Biete an Details zu zeigen
- Antworte auf Deutsch
  `;

  const briefingText = await generateText({
    model: resolveModel('gpt-oss-120b'),
    prompt,
  });

  // Panel-Daten aus Ergebnissen extrahieren
  const panels = results.map(r => ({
    type: r.type === 'data' ? 'table' : 'text',
    title: `${r.icon} ${r.name}`,
    priority: r.priority,
    data: r.data,
    heartbeatId: r.heartbeatId,
  }));

  return { text: briefingText, panels };
}
```

### API Endpunkt

```typescript
// GET /api/heartbeat/briefing
router.get('/briefing', authMiddleware, async (req, res) => {
  const { userId, tenantId, userRole } = req.user;

  // Ungelesene Ergebnisse
  const results = await heartbeatEngine.getUndeliveredResults(userId, tenantId, userRole);

  if (results.length === 0) {
    return res.json({ hasBriefing: false });
  }

  // User Memory fuer Personalisierung
  const userMemory = await memoryService.recallUserMemory(userId, 'Briefing Praeferenzen');

  // Briefing generieren
  const briefing = await generateBriefing(results, req.user.name, userMemory);

  // Als gelesen markieren
  await heartbeatEngine.markDelivered(results.map(r => r.id));

  res.json({
    hasBriefing: true,
    text: briefing.text,
    panels: briefing.panels,
  });
});
```

---

## UI Integration

### Drei-Spalten-Layout (Cowork-inspiriert)

```
┌──────────────┬────────────────────────────┬──────────────────┐
│  Navigation  │  Chat mit Hive Mind        │  Kontext-Panels  │
│              │                            │                  │
│ 🏠 Home     │  Guten Morgen Lisa.        │  ┌────────────┐  │
│ 🔍 Suchen   │                            │  │ ⚠️ AUeG    │  │
│ 📋 Geplant  │  Hier dein Ueberblick:     │  │ 3 kritisch │  │
│ 📁 Projekte │                            │  │ [Details]  │  │
│ 👥 Dispatch │  ⚠️ 3 Einsaetze erreichen  │  └────────────┘  │
│              │  in 60 Tagen die AUeG-     │                  │
│ ─────────── │  Grenze. Davon 2 bei       │  ┌────────────┐  │
│ Letzte       │  Klinikum X — dort sind    │  │ 💰 Rechnung│  │
│ Gespraeche  │  auch 2 Rechnungen offen.  │  │ 2 offen    │  │
│              │                            │  │ [Details]  │  │
│              │  📋 5 Schichten naechste   │  └────────────┘  │
│              │  Woche noch unbesetzt.     │                  │
│              │                            │  ┌────────────┐  │
│              │  ✅ Alle Zeiterfassungen   │  │ 📋 Schichten│  │
│              │  von gestern genehmigt.    │  │ 5 offen    │  │
│              │                            │  │ [Details]  │  │
│              │  Soll ich Details zeigen?  │  └────────────┘  │
│              │                            │                  │
│              │  [Antworten...]            │                  │
└──────────────┴────────────────────────────┴──────────────────┘
```

### Frontend-Integration

```typescript
// Beim Oeffnen von Cor7ex / Route "Home":
async function loadBriefing(): Promise<void> {
  const response = await fetch('/api/heartbeat/briefing');
  const data = await response.json();

  if (data.hasBriefing) {
    // Briefing als erste Nachricht im Chat anzeigen
    addSystemMessage(data.text);

    // Panels rechts anzeigen
    setPanels(data.panels);
  }
}

// Klick auf Panel → Chat-Konversation starten
function onPanelClick(panel: Panel): void {
  // Startet neue Konversation mit Kontext
  startConversation(`Zeige mir Details zu: ${panel.title}`);
}
```

---

## Gelernter Heartbeat (Phase 2)

In Phase 1 werden Heartbeats nur von Admin und User definiert. In Phase 2 kann der Hive Mind selbst Heartbeats vorschlagen:

```
Hive Mind erkennt: "Lisa fragt jeden Montag nach Klinikum X"

Hive Mind schlaegt vor:
  "Mir ist aufgefallen dass du montags immer nach Klinikum X fragst.
   Soll ich das automatisch pruefen und dir montags morgens berichten?"

Lisa: "Ja"

→ Neuer User-Heartbeat wird erstellt:
  {
    name: "Klinikum X Status",
    cron: "0 7 * * 1",        // Jeden Montag 7:00
    type: "data",
    level: "learned",
    dataQuery: { tool: "sama_assignments", args: { customerId: "..." } },
    userId: "lisa-123",
  }
```

Technisch: Der Hive Mind nutzt Hindsight Memory um Interaktionsmuster zu erkennen, und das `create_heartbeat` Admin-Tool um den Heartbeat anzulegen.

---

## Heartbeat-Verwaltung

### Admin-UI

```
Admin oeffnet Heartbeat-Verwaltung:

┌────────────────────────────────────────────────────┐
│  Heartbeat-Verwaltung                              │
│                                                    │
│  Unternehmens-Heartbeats:                          │
│  ┌────────────────────────────────────────────┐    │
│  │ ⚠️ AUeG-Fristen           Mo-Fr 07:00     │    │
│  │    Einsaetze < 60 Tage    [Aktiv] [Edit]   │    │
│  ├────────────────────────────────────────────┤    │
│  │ 💰 Offene Rechnungen      Mo-Fr 08:00     │    │
│  │    Rechnungen > 30 Tage   [Aktiv] [Edit]   │    │
│  ├────────────────────────────────────────────┤    │
│  │ 📊 Kuendigungsmuster      1. des Monats   │    │
│  │    HR-Agent Analyse       [Aktiv] [Edit]   │    │
│  └────────────────────────────────────────────┘    │
│                                                    │
│  [+ Neuen Heartbeat erstellen]                     │
│                                                    │
│  User-Heartbeats (Lisa):                           │
│  ┌────────────────────────────────────────────┐    │
│  │ 📋 Unbesetzte Schichten   Mo-Fr 07:00     │    │
│  │    Gelernt am 15.03.2026  [Aktiv] [Edit]   │    │
│  └────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────┘
```

### API Endpunkte

```typescript
// CRUD fuer Heartbeat-Definitionen
POST   /api/heartbeat/definitions          // Neuen Heartbeat erstellen
GET    /api/heartbeat/definitions          // Alle Heartbeats listen
PUT    /api/heartbeat/definitions/:id      // Heartbeat aendern
DELETE /api/heartbeat/definitions/:id      // Heartbeat loeschen
PATCH  /api/heartbeat/definitions/:id/toggle  // Aktivieren/Deaktivieren

// Ergebnisse
GET    /api/heartbeat/briefing             // Briefing fuer aktuellen User
GET    /api/heartbeat/results              // Alle Ergebnisse (Admin)
GET    /api/heartbeat/results/:id          // Einzelnes Ergebnis (Detail)

// Manueller Trigger (Admin/Debug)
POST   /api/heartbeat/definitions/:id/run  // Heartbeat manuell ausfuehren
```

---

## Datenbank

### Migration

```sql
-- Heartbeat-Definitionen
CREATE TABLE heartbeat_definitions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   TEXT NOT NULL,
  user_id     TEXT,                       -- NULL = Unternehmens-Heartbeat
  name        TEXT NOT NULL,
  description TEXT,
  cron        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('data', 'agent')),
  level       TEXT NOT NULL CHECK (level IN ('company', 'user', 'learned')),
  config      JSONB NOT NULL,            -- dataQuery oder agentTask
  roles       TEXT[],
  icon        TEXT DEFAULT '📋',
  priority    TEXT DEFAULT 'info' CHECK (priority IN ('critical', 'warning', 'info')),
  enabled     BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_heartbeat_defs_tenant ON heartbeat_definitions(tenant_id, enabled);

-- Heartbeat-Ergebnisse
CREATE TABLE heartbeat_results (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  heartbeat_id  UUID REFERENCES heartbeat_definitions(id) ON DELETE CASCADE,
  tenant_id     TEXT NOT NULL,
  user_id       TEXT,
  data          JSONB NOT NULL,
  summary       TEXT,                    -- Agent-generierte Zusammenfassung
  priority      TEXT DEFAULT 'info',
  delivered_at  TIMESTAMPTZ,             -- NULL = noch nicht gelesen
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_heartbeat_results_undelivered
  ON heartbeat_results(tenant_id, delivered_at)
  WHERE delivered_at IS NULL;
```

---

## Implementierung

### Phase 1: Basis (Woche 1-2)
- DB-Migration (heartbeat_definitions + heartbeat_results)
- HeartbeatEngine Service mit node-cron
- Data Heartbeat Ausfuehrung (MCP Tool Calls)
- Briefing API Endpunkt
- Frontend: Briefing beim Oeffnen laden + anzeigen

### Phase 2: Agent Heartbeats + Panels (Woche 3)
- Agent Heartbeat Ausfuehrung (Expert Agent starten)
- Panel-Daten aus Ergebnissen generieren
- Frontend: Kacheln rechts anzeigen, klickbar
- Admin-UI: Heartbeat-Verwaltung

### Phase 3: User-Heartbeats + Gelernte (Woche 4)
- User kann eigene Heartbeats konfigurieren
- Gelernter Heartbeat: Hive Mind schlaegt vor basierend auf Interaktionsmustern
- `create_heartbeat` Tool fuer den Hive Mind

---

## Dateien

### Neue Dateien:
1. `server/src/services/heartbeat/HeartbeatEngine.ts` — Cron-Scheduler + Ausfuehrung
2. `server/src/services/heartbeat/briefing.ts` — Briefing-Generierung (LLM)
3. `server/src/routes/heartbeat.ts` — API Endpunkte
4. `server/src/migrations/0XX_heartbeat.sql` — DB-Schema
5. `server/src/services/agents/tools/create-heartbeat.ts` — Tool fuer Hive Mind

### Modifizierte Dateien:
1. `server/src/index.ts` — HeartbeatEngine initialisieren
2. Frontend: Home-Page Komponente fuer Briefing + Panels

### Neue Dependencies:
- `node-cron` — Cron-Scheduler (bereits in vielen Node.js Projekten Standard)

---

## Verifikation

| Test | Erwartung |
|---|---|
| Cron registriert | `heartbeatEngine.initialize()` → Jobs laufen |
| Data Heartbeat | MCP Tool Call gibt Daten zurueck, Ergebnis gespeichert |
| Threshold | Ergebnis unter Threshold wird NICHT gespeichert |
| Agent Heartbeat | Expert Agent laeuft, Zusammenfassung gespeichert |
| Briefing API | `GET /api/heartbeat/briefing` → Text + Panels |
| Rollen-Filter | Buchhalter sieht keine HR-Heartbeats |
| User-Filter | Lisa sieht ihre User-Heartbeats, nicht Markus' |
| Delivered | Nach Briefing-Abruf: `delivered_at` gesetzt |
| Panel-Klick | Oeffnet Chat-Konversation mit Kontext |
| Admin-UI | Heartbeats erstellen, editieren, aktivieren/deaktivieren |

---

## Offene Punkte (spaetere Specs)

- **Push-Notifications**: Spaeteres Feature — Email, Browser-Push, Mobile → Eigenstaendige Spec
- **Event-basierte Trigger**: Webhooks von Enterprise-Systemen → Wenn MCP das unterstuetzt
- **Multi-Tenant**: Heartbeat-Isolation pro Tenant → Spec 25
- **Heartbeat-Templates**: Branchen-Templates enthalten vorkonfigurierte Heartbeats
