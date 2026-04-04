# Spec: Expert Agent Harness

**Status:** Entwurf
**Abhaengigkeiten:** [02-hive-mind-orchestrator.md](./02-hive-mind-orchestrator.md)
**Bezug:** [00-cor7ex-vision.md](./00-cor7ex-vision.md) — Abschnitt "Expert Agents" + "Technische Detailentscheidungen"

---

## Zusammenfassung

Expert Agents werden ueber eine **Admin-UI** erstellt, konfiguriert und verwaltet — nicht ueber Chat-Tools. Jeder Expert Agent wird in der **PostgreSQL-Datenbank** gespeichert (Single Source of Truth). Built-in Branchen-Templates werden beim Serverstart aus Markdown-Dateien in die DB geseeded.

Die UI ist fuer **alle User sichtbar** (eigener Navigations-Punkt), aber nur Admins koennen Agents erstellen, bearbeiten und (de)aktivieren. Jeder Agent hat einen **Character-Avatar** fuer visuelle Identitaet.

**Kernprinzip:** Deklarativ konfiguriert (UI-Formular), programmatisch ausgefuehrt (ToolLoopAgent). Jeder Kunde kann seine Expert Agents konfigurieren ohne Code zu schreiben.

---

## UI-Design

### Navigation

Expert Agents bekommen einen **eigenen Navigations-Punkt** in der Sidebar (wie Documents). Sichtbar fuer alle User, aber mit rollenbasierten Einschraenkungen:

| Rolle | Darf sehen | Darf erstellen/bearbeiten | Darf (de)aktivieren |
|---|---|---|---|
| Admin | Alle Agents | Ja | Ja |
| Manager | Alle Agents | Nein | Nein |
| Employee | Alle aktiven Agents | Nein | Nein |

### View 1: Uebersicht (Cards Grid)

```
┌──────────────────────────────────────────────────────────┐
│  Expert Agents                          [+ Neuer Agent]  │
│                                          (nur Admin)     │
│                                                          │
│  ┌────────────────┐ ┌────────────────┐ ┌────────────────┐│
│  │   [Avatar]     │ │   [Avatar]     │ │   [Avatar]     ││
│  │                │ │                │ │                ││
│  │  hr-expert     │ │  accounting-   │ │  knowledge-    ││
│  │                │ │  expert        │ │  expert        ││
│  │  Personal &    │ │  Buchhaltung   │ │  Wissens-      ││
│  │  Einsatz-      │ │  & Finanzen    │ │  datenbank     ││
│  │  planung       │ │                │ │                ││
│  │                │ │                │ │                ││
│  │  12 Tools      │ │  22 Tools      │ │  3 Tools       ││
│  │  Admin, Mgr    │ │  Admin, Mgr    │ │  Alle          ││
│  │  🟢 Aktiv      │ │  🟢 Aktiv      │ │  🟢 Aktiv      ││
│  │  ────────────  │ │  ────────────  │ │  ────────────  ││
│  │  [Bearbeiten]  │ │  [Bearbeiten]  │ │  [Bearbeiten]  ││
│  │  (nur Admin)   │ │  (nur Admin)   │ │  (nur Admin)   ││
│  └────────────────┘ └────────────────┘ └────────────────┘│
└──────────────────────────────────────────────────────────┘
```

**Card-Inhalt:**
- Character-Avatar (Bild/Icon — Platzhalter bis echte Avatare erstellt werden)
- Name (kebab-case Identifier)
- Kurzbeschreibung (1-2 Zeilen, truncated)
- Tool-Anzahl
- Erlaubte Rollen
- Status-Badge (Aktiv/Inaktiv)
- Source-Badge (Built-in / Custom)
- Bearbeiten-Button (nur fuer Admins sichtbar)

### View 2: Detail / Bearbeiten (Formular)

Beim Klick auf Card (alle User: Read-only) oder "Bearbeiten" (Admin: Edit-Mode):

```
┌──────────────────────────────────────────────────────────┐
│  ← Zurueck           hr-expert           [Speichern]     │
│                                          [Deaktivieren]  │
│                                          [Loeschen]      │
│                                                          │
│  [Avatar]   Name:        [hr-expert              ]       │
│             Beschreibung:[Personalwesen und...   ]       │
│             Status:      [🟢 Aktiv  ▼]                   │
│                                                          │
│  ── Modell & Limits ───────────────────────────────────  │
│  Modell:      [gpt-oss-120b     ▼]                       │
│  Max Steps:   [15               ]                        │
│                                                          │
│  ── Zugriff (Guardrails) ──────────────────────────────  │
│  Rollen:      [☑ Admin] [☑ Manager] [☐ Employee]        │
│  Regeln:                                                 │
│    [Keine Gehaltsdaten an Nicht-Admins          ] ✕      │
│    [Drehtuerklausel pruefen (3 Monate Karenz)   ] ✕      │
│    [Hoechstueberlassungsdauer (18 Monate)       ] ✕      │
│    [+ Regel hinzufuegen]                                 │
│                                                          │
│  ── Tools (12 von 94 ausgewaehlt) ─────────────────────  │
│  [Suche...]                                              │
│                                                          │
│  MCP / SamaWorkforce:                                    │
│    [☑ sama_employees]      [☑ sama_employee]             │
│    [☑ sama_assignments]    [☑ sama_activeAssignments]    │
│    [☑ sama_assignmentsNearLimit]  [☐ sama_accountMoves]  │
│    ...                                                   │
│  Suche & Wissen:                                         │
│    [☑ rag_search]  [☐ read_chunk]  [☐ graph_query]      │
│  Kommunikation:                                          │
│    [☐ send_notification]                                 │
│                                                          │
│  ── System Prompt (Markdown) ──────────────────────────  │
│  [Bearbeiten] [Vorschau]                                 │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Du bist der HR-Experte im Hive Mind.               │  │
│  │                                                    │  │
│  │ ## Deine Expertise                                 │  │
│  │ - Personalverwaltung und Einsatzplanung            │  │
│  │ - Arbeitnehmerueberlassungsgesetz (AUeG)           │  │
│  │ ...                                                │  │
│  └────────────────────────────────────────────────────┘  │
│  (Markdown-Preview mit Syntax-Highlighting)              │
└──────────────────────────────────────────────────────────┘
```

**Formular-Felder:**

| Feld | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| `name` | Text (kebab-case) | Ja | Eindeutiger Identifier. Wird als Tool-Name im Hive Mind registriert. |
| `description` | Textarea | Ja | Wann soll der Hive Mind diesen Agent aufrufen? |
| `avatar` | Image/URL | Nein | Character-Avatar (Platzhalter-Icon wenn leer) |
| `is_active` | Toggle | Ja | Aktiv/Inaktiv. Inaktive Agents werden nicht geladen. |
| `model` | Dropdown | Ja | LLM-Modell (aktuell nur gpt-oss-120b). Default: gpt-oss-120b. |
| `max_steps` | Number | Ja | Max. Tool-Call-Schritte pro Aufruf. Default: 15. |
| `roles` | Checkbox-Gruppe | Nein | Welche User-Rollen duerfen diesen Agent nutzen. Leer = alle. |
| `rules` | Dynamische Liste | Nein | Verhaltensregeln (werden in System Prompt injiziert). |
| `tools` | Multi-Select (grouped) | Ja | Tools-Whitelist aus der ToolRegistry. |
| `instructions` | Markdown-Editor | Ja | System Prompt. Markdown-Preview mit Syntax-Highlighting. |

**Non-Admin View**: Gleiche Ansicht, aber alle Felder read-only, keine Buttons (Speichern/Loeschen/Deaktivieren).

### View 3: Neuer Agent (leeres Formular)

Identisch mit View 2, aber alle Felder leer. Defaults:
- `model`: gpt-oss-120b
- `max_steps`: 15
- `is_active`: true
- `roles`: leer (alle duerfen)
- `tools`: leer

---

## Datenmodell

### PostgreSQL Tabelle: `expert_agents`

```sql
CREATE TABLE IF NOT EXISTS expert_agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    avatar_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    model VARCHAR(100) NOT NULL DEFAULT 'gpt-oss-120b',
    max_steps INTEGER NOT NULL DEFAULT 15,
    roles TEXT[] DEFAULT '{}',
    rules TEXT[] DEFAULT '{}',
    tools TEXT[] NOT NULL DEFAULT '{}',
    instructions TEXT NOT NULL,
    source VARCHAR(20) NOT NULL DEFAULT 'custom'
        CHECK (source IN ('builtin', 'custom')),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_agent_per_tenant UNIQUE(tenant_id, name)
);

CREATE INDEX idx_expert_agents_tenant ON expert_agents(tenant_id);
CREATE INDEX idx_expert_agents_active ON expert_agents(is_active);
```

**Warum PostgreSQL statt Dateien:**
- Multi-Tenant Isolation (jeder Tenant sieht nur seine Agents)
- CRUD via API (Frontend braucht keinen Filesystem-Zugriff)
- Audit Trail (created_at, updated_at, created_by)
- Active/Inactive als DB-Spalte
- Versionierung moeglich (spaeter)
- Pattern: Gleich wie `skills` Tabelle

### Seeding: Built-in Templates → DB

Beim Serverstart werden die Markdown-Dateien aus `server/expert-agents/*.md` in die DB geseeded — identisches Pattern wie `SkillRegistry.seedBuiltinSkills()`:

```typescript
async seedBuiltinAgents(agents: ExpertAgentHarness[]): Promise<void> {
  for (const agent of agents) {
    await db.query(`
      INSERT INTO expert_agents (tenant_id, name, description, model, max_steps,
        roles, rules, tools, instructions, source)
      VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8, 'builtin')
      ON CONFLICT (tenant_id, name) DO UPDATE SET
        description = EXCLUDED.description,
        model = EXCLUDED.model,
        max_steps = EXCLUDED.max_steps,
        roles = EXCLUDED.roles,
        rules = EXCLUDED.rules,
        tools = EXCLUDED.tools,
        instructions = EXCLUDED.instructions,
        updated_at = NOW()
      WHERE expert_agents.source = 'builtin'
    `, [agent.name, agent.description, agent.model, agent.maxSteps,
        agent.guardrails?.roles || [], agent.guardrails?.rules || [],
        agent.tools, agent.instructions]);
  }
}
```

**Wichtig:** `ON CONFLICT ... WHERE source = 'builtin'` — nur Built-in Agents werden ueberschrieben. Custom Agents (vom Admin erstellt) bleiben unberuehrt.

---

## Tools: Woher kommen sie?

### Verfuegbare Tools

Die Tool-Liste im Expert Agent Formular zeigt **alle registrierten Tools** aus der ToolRegistry:

| Quelle | Beispiele | Wie sie erscheinen |
|---|---|---|
| Built-in (15 Tools) | rag_search, graph_query, send_notification | Immer verfuegbar |
| MCP (79 Tools) | sama_employees, sama_accountMoves | Verfuegbar wenn MCP-Server verbunden |

### Kategorisierung (automatisch)

Tools werden in der UI nach Prefix/Typ gruppiert:

| Kategorie | Prefix/Regel | Beispiele |
|---|---|---|
| MCP / SamaWorkforce | `sama_*` | sama_employees, sama_accountMoves |
| Suche & Wissen | rag_search, read_chunk, graph_query | - |
| Skills | load_skill, list_skills | - |
| Kommunikation | send_notification | - |
| Datenbank | sql_query | - |

### Neue Tools hinzufuegen

Expert Agents waehlen aus **vorhandenen** Tools. Neue Tools entstehen durch:

| Bedarf | Loesung | Wer |
|---|---|---|
| Bestehendes System anbinden | MCP-Server konfigurieren (neuer Endpoint in .env) | Admin (Config) |
| Einfache API-Calls | HTTP-Tool Template (spaeter) | Admin (UI) |
| Komplexe Logik | Python-Script via `run_script` | Entwickler |
| Komplett neues Tool | Entwickler schreibt Code, deployed | Entwickler |

Kein Tool-Builder im Agent-Editor — Tools sind Infrastruktur, keine Agent-Konfiguration.

---

## API Endpoints

### Expert Agent CRUD

```
GET    /api/expert-agents              → Alle Agents (gefiltert nach Tenant + Rolle)
GET    /api/expert-agents/:id          → Einzelner Agent (Detail)
POST   /api/expert-agents              → Neuen Agent erstellen (Admin only)
PUT    /api/expert-agents/:id          → Agent bearbeiten (Admin only)
PATCH  /api/expert-agents/:id/toggle   → Aktiv/Inaktiv toggle (Admin only)
DELETE /api/expert-agents/:id          → Agent loeschen (Admin only)
```

### Verfuegbare Tools

```
GET    /api/expert-agents/available-tools  → Alle Tools aus ToolRegistry
                                            [{ name, description, source, category }]
```

### Responses

**GET /api/expert-agents:**
```json
[
  {
    "id": "uuid",
    "name": "hr-expert",
    "description": "Personalwesen und Einsatzplanung...",
    "avatarUrl": null,
    "isActive": true,
    "model": "gpt-oss-120b",
    "maxSteps": 15,
    "roles": ["Admin", "Manager"],
    "rules": ["Keine Gehaltsdaten an Nicht-Admins"],
    "tools": ["sama_employees", "sama_assignments", "rag_search"],
    "instructions": "Du bist der HR-Experte...",
    "source": "builtin",
    "toolCount": 12,
    "createdAt": "2026-04-04T10:00:00Z",
    "updatedAt": "2026-04-04T10:00:00Z"
  }
]
```

---

## Guardrails

### Struktur (in DB)

```
roles TEXT[]    → Welche Rollen duerfen diesen Agent nutzen (leer = alle)
rules TEXT[]    → Verhaltensregeln als Array von Strings
```

### Drei Enforcement-Ebenen

| Ebene | Was | Wie | Zuverlaessigkeit |
|---|---|---|---|
| 1. Prompt | Rules werden in den System Prompt injiziert | LLM wird instruiert | Weich |
| 2. Tool-Einschraenkung | `tools` Array — Agent hat nur diese Tools | Deterministisch | Hart |
| 3. Pre-Validation | `roles` wird VOR der Delegation geprueft | Code-Check | Hart |

### Rollen-Check

```typescript
// In createExpertAgentTool(), vor der Delegation:
if (harness.roles.length > 0 && !harness.roles.includes(context.userRole)) {
  return `Zugriff verweigert: ${harness.name} erfordert Rolle ${harness.roles.join(' oder ')}.`;
}
```

---

## Character-Avatare

Jeder Expert Agent hat einen optionalen **Character-Avatar** fuer visuelle Identitaet in der UI.

### Phase 1 (jetzt)
- Platzhalter-Icons basierend auf Agent-Typ (z.B. Stethoskop fuer HR, Taschenrechner fuer Accounting)
- Oder generierte Initialen-Badges (wie User-Avatare)

### Phase 2 (spaeter)
- Echte Character-Bilder (KI-generiert oder manuell erstellt)
- `avatar_url` Feld in der DB
- Upload im Agent-Editor

---

## ExpertAgentLoader: Migration File → DB

### Bisheriger Flow (Spec 02)

```
Startup → Lese server/expert-agents/*.md → Parse → In-Memory Cache → createExpertAgentTool()
```

### Neuer Flow (Spec 03)

```
Startup:
  1. Lese server/expert-agents/*.md (Templates)
  2. Seed in DB (UPSERT, nur builtin-source ueberschreiben)
  3. Ab jetzt: DB ist Single Source of Truth

Request (runTurn):
  1. Lade aktive Agents aus DB (WHERE is_active = true AND tenant_id = ?)
  2. createExpertAgentTool() fuer jeden Agent
  3. Registriere als Hive Mind Tools
```

### ExpertAgentService (ersetzt ExpertAgentLoader teilweise)

```typescript
class ExpertAgentService {
  // DB-Operationen
  async getAll(tenantId?: string): Promise<ExpertAgentRecord[]>;
  async getById(id: string): Promise<ExpertAgentRecord | null>;
  async create(data: CreateExpertAgentInput, userId: string): Promise<ExpertAgentRecord>;
  async update(id: string, data: UpdateExpertAgentInput): Promise<ExpertAgentRecord>;
  async toggleActive(id: string): Promise<ExpertAgentRecord>;
  async delete(id: string): Promise<void>;

  // Tool-Listing
  async getAvailableTools(): Promise<ToolInfo[]>;

  // Seeding
  async seedBuiltinAgents(): Promise<void>;

  // Fuer AgentExecutor: Aktive Agents als Harness laden
  async loadActiveHarnesses(tenantId?: string): Promise<ExpertAgentHarness[]>;
}
```

---

## Starter Expert Agents (Branchen-Template: Personaldienstleister)

Die drei Markdown-Dateien in `server/expert-agents/` bleiben als Templates bestehen und werden beim Start in die DB geseeded:

| Template | Domain | Tools | Rollen |
|---|---|---|---|
| `hr-expert.md` | Personal, Einsaetze, AUeG, Zeiterfassung | 12 sama_* + rag_search | Admin, Manager |
| `accounting-expert.md` | Rechnungen, Zahlungen, Mahnwesen, Reports | 22 sama_* + rag_search | Admin, Manager |
| `knowledge-expert.md` | Wissensdatenbank, Dokumente, Vertraege | rag_search, read_chunk, graph_query | Alle |

---

## Implementierung

### Phase 1: DB + API (Backend)

1. Migration: `expert_agents` Tabelle erstellen
2. `ExpertAgentService.ts`: CRUD + Seeding + loadActiveHarnesses()
3. API Routes: `/api/expert-agents` (CRUD + available-tools)
4. `AgentExecutor.ts`: Von ExpertAgentLoader auf ExpertAgentService umstellen
5. Seeding beim Startup: Markdown-Templates → DB

### Phase 2: UI (Frontend)

1. Navigation: Neuer Sidebar-Punkt "Agents"
2. `ExpertAgentsPage.tsx`: Cards Grid mit Agent-Uebersicht
3. `ExpertAgentCard.tsx`: Card-Komponente mit Avatar, Name, Stats
4. `ExpertAgentDetail.tsx`: Formular (Create/Edit/View)
5. Markdown-Editor mit Preview fuer System Prompt
6. Tool-Selector mit Kategorien und Suche
7. Rollen-basierte Sichtbarkeit (Admin: edit, andere: read-only)

### Phase 3: Polish

1. Character-Avatare (Platzhalter-Icons)
2. Tool-Kategorisierung im Selector
3. Validierung (Name-Format, Pflichtfelder, Tool-Existenz)

---

## Dateien

### Neue Dateien (Backend)

| Datei | Zweck |
|---|---|
| `server/src/migrations/019_expert_agents.sql` | DB-Tabelle |
| `server/src/services/agents/ExpertAgentService.ts` | CRUD, Seeding, Harness-Loading |
| `server/src/routes/expert-agents.ts` | API Endpoints |

### Neue Dateien (Frontend)

| Datei | Zweck |
|---|---|
| `src/pages/ExpertAgentsPage.tsx` | Uebersicht mit Cards Grid |
| `src/components/ExpertAgentCard.tsx` | Einzelne Card-Komponente |
| `src/components/ExpertAgentDetail.tsx` | Detail/Edit Formular |
| `src/components/ExpertAgentToolSelector.tsx` | Tool Multi-Select mit Kategorien |
| `src/lib/expert-agents-api.ts` | API Client Funktionen |

### Modifizierte Dateien

| Datei | Aenderung |
|---|---|
| `server/src/services/agents/AgentExecutor.ts` | loadActiveHarnesses() statt loadExpertAgents() |
| `server/src/services/agents/index.ts` | ExpertAgentService exportieren |
| `server/src/index.ts` | ExpertAgentService initialisieren + Seeding |
| `src/components/NavigationLinks.tsx` | Neuer "Agents" Link |
| `src/App.tsx` (oder Router) | Neue Route /agents |

### Unveraendert (aus Spec 02)

| Datei | Warum |
|---|---|
| `server/src/services/agents/ExpertAgentLoader.ts` | Bleibt fuer Markdown-Parsing (Seeding) |
| `server/expert-agents/*.md` | Bleiben als Templates |
| `server/src/services/agents/types.ts` | ExpertAgentHarness Interface bleibt |

---

## Verifikation

| Test | Erwartung |
|---|---|
| Seeding beim Start | 3 Built-in Agents in DB, Log: "Seeded 3 expert agents" |
| GET /api/expert-agents | Liste aller Agents mit Tool-Count |
| POST /api/expert-agents | Neuer Agent in DB, sofort im Hive Mind verfuegbar |
| PUT /api/expert-agents/:id | Aenderungen gespeichert, naechster Request nutzt neue Config |
| PATCH toggle | Agent deaktiviert → nicht mehr im Hive Mind |
| DELETE | Agent geloescht (nur custom, nicht builtin) |
| GET available-tools | 94 Tools mit Name, Description, Category |
| Non-Admin sieht Cards | Read-only, kein Bearbeiten-Button |
| Admin erstellt Agent | Formular → Speichern → Card erscheint → sofort nutzbar im Chat |
| Hive Mind nutzt DB-Agents | Chat-Anfrage → Expert Agent aus DB wird aufgerufen |

---

## Offene Punkte (spaetere Specs)

- **Memory-Feld**: Wie Agent Memory geladen/gespeichert wird → Spec 04 (Hindsight)
- **Heartbeat-Feld**: Proaktive Pruefungen pro Agent → Spec 05
- **Character-Avatar Generator**: KI-generierte Avatare → eigenes Feature
- **Multi-Tenant Isolation**: RLS Policies fuer expert_agents → Spec 06
- **Versionierung**: Aenderungshistorie pro Agent → spaeter
