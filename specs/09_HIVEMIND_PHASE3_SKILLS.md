# Phase 3: Schwarm-Skill-System

**Zeitraum:** Wochen 8-10
**Abhängigkeiten:** Phase 2 (Agent Framework)
**Ziel:** Ein organisches Skill-System nach dem Hive-Mind-Prinzip: Jeder kann Fertigkeiten für den Schwarm entwickeln, der Schwarm entscheidet welche zum Standard werden. Skills kodifizieren den Willen, die Regeln und Richtlinien des Unternehmens in ausführbare Agent-Workflows.

---

## Design-Philosophie: Bienenschwarm statt Organigramm

Skills sind keine Admin-gesteuerten Automatisierungen. Sie sind das **kollektive Wissen des Schwarms**, kodifiziert in ausführbare Workflows.

```
Bienenschwarm:                        Hive Mind:
Spurbiene findet guten Nistplatz  →   Mitarbeiter erstellt nützlichen Skill
Tanzt intensiver je besser        →   Skill wird genutzt + positiv bewertet
Andere Bienen folgen dem Tanz     →   Team-Mitglieder übernehmen den Skill
Schwarm entscheidet ohne Chef     →   Schwarm-Adoption durch Usage + Votes
```

**Kein Gatekeeper, der Schwarm entscheidet.**

---

## 3.1 Skill-Lebenszyklus

### Drei Scopes: Personal → Team → Schwarm

```
┌─────────────┐    Teilen     ┌──────────────┐   Schwarm-     ┌──────────────┐
│  Personal   │  ──────────►  │    Team      │   Adoption    │   Schwarm    │
│  (Draft)    │               │  (Shared)    │  ──────────►  │  (Standard)  │
└─────────────┘               └──────────────┘               └──────────────┘

Nur Ersteller            Abteilung sieht,         Gesamtes Unternehmen,
sieht + nutzt            nutzt + bewertet          Best Practice
```

**Personal (Draft):**
- Jeder Mitarbeiter kann einen Skill erstellen
- Nur der Ersteller sieht und nutzt ihn
- Experimentell, unfertig, persönlicher Workflow

**Team (Shared):**
- Ersteller teilt den Skill mit seiner Abteilung
- Team-Mitglieder können nutzen und bewerten (Upvote/Downvote + Kommentar)
- Kein Manager-Approval nötig

**Schwarm (Standard):**
- Automatische Promotion wenn Schwelle überschritten:
  - `adoption_count >= 5` (mindestens 5 verschiedene Nutzer)
  - `upvotes / (upvotes + downvotes) >= 0.8` (80%+ positiv)
- Sichtbar für das gesamte Unternehmen
- Wird zum Best Practice – der "beste Nistplatz"
- Kann von Admins zusätzlich als "Verified" markiert werden

### Degradation

Wenn ein Schwarm-Skill über Zeit schlechte Bewertungen bekommt (Quote fällt unter 60%), wird er automatisch zum Team-Skill zurückgestuft. Der Schwarm korrigiert sich selbst.

---

## 3.2 Skill-Architektur

```
server/src/services/skills/
  SkillEngine.ts          ← Führt Skill über AgentExecutor aus
  SkillRegistry.ts        ← CRUD + Discovery + Schwarm-Logik
  SkillValidator.ts       ← Validiert Definitionen + Inputs
  SwarmPromotion.ts       ← Automatische Scope-Änderung basierend auf Votes/Usage
  types.ts
  builtin/                ← Eingebaute Seed-Skills
    document-summary.json
    email-draft.json
    weekly-report.json
  index.ts
```

### Skill-Definition Format

Skills werden als JSON in PostgreSQL gespeichert:

```json
{
  "name": "Wochenbericht erstellen",
  "description": "Fasst Aktivitäten der Woche zusammen basierend auf Dokumenten und Daten",
  "version": "1.0",
  "inputs": [
    {
      "name": "week",
      "type": "string",
      "required": true,
      "description": "Kalenderwoche (z.B. KW12 2026)"
    },
    {
      "name": "department",
      "type": "string",
      "required": false,
      "options": ["Marketing", "Vertrieb", "Pflege", "Verwaltung"]
    }
  ],
  "context": "Du erstellst professionelle Wochenberichte. Nutze formelle Sprache, strukturiere nach: Zusammenfassung, Highlights, Herausforderungen, Nächste Schritte.",
  "steps": [
    {
      "name": "Daten sammeln",
      "prompt": "Suche alle Dokumente und Daten zur Woche {{week}} für {{department}}.",
      "tools": ["rag_search", "sql_query"],
      "maxIterations": 3
    },
    {
      "name": "Bericht erstellen",
      "prompt": "Erstelle den Wochenbericht als strukturiertes Markdown.",
      "tools": ["create_document"]
    }
  ],
  "category": "Berichte",
  "tags": ["woche", "report"],
  "estimatedDuration": "1-3 Minuten"
}
```

### Chat-integrierte Auslösung

Skills werden **nicht** über eine separate Seite ausgeführt, sondern im Chat erkannt:

```
User: "Erstelle einen Wochenbericht für KW12"

Agent: 📦 Skill erkannt: Wochenbericht erstellen
       Woche: KW12 2026
       Abteilung: (alle)

       Soll ich den Bericht erstellen?
       [✅ Ja, starten] [✏️ Anpassen]

--- nach Bestätigung ---

✅ Schritt 1: Daten sammeln (8 Quellen gefunden)
⏳ Schritt 2: Bericht erstellen...
```

**Erkennung:** Der Agent bekommt die verfügbaren Skills als Tool-Beschreibungen. Wenn eine User-Anfrage zu einem Skill passt, schlägt er ihn vor statt frei zu antworten. User kann bestätigen oder ignorieren.

**Alternatives Auslösen:**
- Command Palette (Cmd+K): Skill suchen und direkt starten
- Slash-Command im Chat: `/skill wochenbericht KW12`
- API/Slack: `POST /api/v1/skills/:slug/execute`

### SkillEngine

- Nimmt Skill-Definition + User-Inputs
- Ersetzt `{{placeholders}}` in Prompts mit Input-Werten
- Injiziert Skill-Context als System-Prompt
- Führt jeden Step über `AgentExecutor` aus
- Ergebnis jedes Steps fließt als Kontext in den nächsten

### SwarmPromotion

Periodischer Check (z.B. stündlich oder bei jedem Vote):

```typescript
async checkPromotion(skillId: UUID): Promise<void> {
  const skill = await this.getSkillWithStats(skillId);

  // Team → Schwarm Promotion
  if (skill.scope === 'team'
      && skill.adoption_count >= 5
      && skill.voteRatio >= 0.8) {
    await this.promote(skillId, 'swarm');
  }

  // Schwarm → Team Degradation
  if (skill.scope === 'swarm'
      && skill.voteRatio < 0.6
      && skill.total_votes >= 10) {
    await this.demote(skillId, 'team');
  }
}
```

---

## 3.3 Datenbank

### Migration `011_skills.sql`

```sql
CREATE TABLE skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  definition JSONB NOT NULL,
  created_by UUID REFERENCES users(id),

  -- Schwarm-Lebenszyklus
  scope TEXT NOT NULL DEFAULT 'personal'
    CHECK (scope IN ('personal', 'team', 'swarm')),
  department TEXT,            -- Relevant für scope='team'
  is_verified BOOLEAN DEFAULT FALSE,  -- Admin-Siegel
  promoted_at TIMESTAMPTZ,   -- Wann zum Schwarm-Skill

  -- Metriken
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  adoption_count INTEGER DEFAULT 0,  -- Unique Users die ihn genutzt haben
  execution_count INTEGER DEFAULT 0,
  avg_duration_ms INTEGER,

  -- Meta
  is_builtin BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  category TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, slug)
);

-- Schwarm-Bewertungen
CREATE TABLE skill_votes (
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  vote INTEGER NOT NULL CHECK (vote IN (-1, 1)),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (skill_id, user_id)
);

-- Ausführungshistorie
CREATE TABLE skill_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NOT NULL REFERENCES skills(id),
  task_id UUID NOT NULL REFERENCES agent_tasks(id),
  user_id UUID NOT NULL REFERENCES users(id),
  inputs JSONB,
  outputs JSONB,
  status TEXT DEFAULT 'running',
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indices
CREATE INDEX idx_skills_scope ON skills(scope, is_active, category);
CREATE INDEX idx_skills_department ON skills(department) WHERE scope = 'team';
CREATE INDEX idx_skills_slug ON skills(tenant_id, slug);
CREATE INDEX idx_skill_votes_skill ON skill_votes(skill_id);
CREATE INDEX idx_skill_executions_skill ON skill_executions(skill_id, created_at DESC);

-- RLS: Skills sichtbar nach Scope
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY skills_visibility ON skills FOR SELECT USING (
  -- Personal: nur Ersteller
  (scope = 'personal' AND created_by = current_setting('app.user_id', true)::uuid)
  -- Team: gleiche Abteilung
  OR (scope = 'team' AND department = current_setting('app.user_department', true))
  -- Schwarm: alle
  OR scope = 'swarm'
  -- Built-in: alle
  OR is_builtin = TRUE
  -- Admin sieht alles
  OR current_setting('app.user_role', true) = 'Admin'
);
```

---

## 3.4 API Endpoints

### Route `server/src/routes/skills.ts`

```
GET    /api/skills                        → Sichtbare Skills (gefiltert nach Scope/Rolle/Abteilung)
  Query: ?scope=swarm&category=Berichte&search=bericht
  Response: { skills: Skill[], total: number }

POST   /api/skills                        → Neuen Skill erstellen (personal)
  Body: { name, description, definition, category, tags }
  Response: { skill: Skill }

PUT    /api/skills/:id                    → Skill aktualisieren (nur Owner)

POST   /api/skills/:id/share              → Skill teilen (personal → team)
  Body: { department: string }

POST   /api/skills/:id/execute            → Skill ausführen
  Body: { inputs: Record<string, any> }
  Response: { taskId: string } + SSE-Stream

POST   /api/skills/:id/vote               → Bewerten
  Body: { vote: 1 | -1, comment?: string }

GET    /api/skills/:id/votes              → Bewertungen anzeigen
  Response: { upvotes, downvotes, ratio, comments: [] }

GET    /api/skills/suggestions            → Skill-Vorschläge basierend auf User-Aktivität
  Response: { skills: Skill[] }
```

---

## 3.5 Frontend

### Chat-Integration (primäre Interaktion)

- Agent erkennt passende Skills und schlägt sie inline vor
- Bestätigungs-Card mit Input-Feldern direkt im Chat
- Progress-Anzeige im Chat (Steps, Tools, Ergebnisse)
- Kein separater Skills-Bereich nötig für die Ausführung

### Command Palette (Cmd+K)

- Globale Suche über alle sichtbaren Skills
- Zeigt Scope-Badge (Personal/Team/Schwarm)
- Schnelles Ausführen: Skill wählen → Input-Dialog → Start
- Zeigt auch kürzlich genutzte Skills

### Skill-Verwaltung (im Icon-Rail unter "Skills")

Sidebar zeigt:
- **Meine Skills** (personal, mit "Teilen"-Button)
- **Team-Skills** (shared, mit Vote-Buttons)
- **Schwarm-Skills** (verifiziert, Best Practices)
- **Skill erstellen** Button

Main Content zeigt:
- Skill-Detail mit Definition, Metriken, Bewertungen
- Einfacher Skill-Editor (Formular-basiert, nicht JSON)
- Ausführungshistorie

### Schwarm-Metriken auf Skill-Cards

```
┌──────────────────────────────────────┐
│ 📄 Wochenbericht erstellen           │
│ Fasst Aktivitäten der Woche zusammen │
│                                      │
│ 🐝 Schwarm-Skill  ✓ Verifiziert     │
│ 👥 23 Nutzer  |  ▲ 18  ▼ 2  |  ⚡ 47x│
│ ⏱ ~2 Min  |  📂 Berichte            │
└──────────────────────────────────────┘
```

### Skill-Erstellung (alle Rollen)

Einfaches Formular statt JSON-Editor:
1. Name + Beschreibung
2. Inputs definieren (Name, Typ, Pflicht)
3. Schritte definieren (Prompt + Tools auswählen)
4. Kategorie + Tags
5. Vorschau → Speichern als Personal-Skill

---

## Dateien-Übersicht

### Neue Dateien
| Datei | Zweck |
|-------|-------|
| `server/src/services/skills/SkillEngine.ts` | Skill-Ausführung über AgentExecutor |
| `server/src/services/skills/SkillRegistry.ts` | CRUD + Discovery |
| `server/src/services/skills/SkillValidator.ts` | Validierung |
| `server/src/services/skills/SwarmPromotion.ts` | Automatische Scope-Änderung |
| `server/src/services/skills/types.ts` | TypeScript-Interfaces |
| `server/src/services/skills/builtin/*.json` | Seed-Skills |
| `server/src/routes/skills.ts` | API-Endpoints |
| `server/src/migrations/011_skills.sql` | DB-Schema |
| `src/components/SkillSuggestionCard.tsx` | Inline-Vorschlag im Chat |
| `src/components/SkillCard.tsx` | Skill-Karte mit Metriken |
| `src/components/SkillEditor.tsx` | Formular-basierter Editor |
| `src/components/SkillVoteButtons.tsx` | Upvote/Downvote |
| `src/components/CommandPalette.tsx` | Cmd+K Suche |

---

## Verifikation

1. **Skill erstellen:** Mitarbeiter erstellt Personal-Skill → nur er sieht ihn
2. **Skill teilen:** Personal → Team → Abteilung sieht ihn
3. **Skill bewerten:** Team-Mitglieder voten → Votes werden gezählt
4. **Schwarm-Promotion:** 5+ Nutzer + 80%+ positiv → automatisch Schwarm-Skill
5. **Schwarm-Degradation:** Vote-Ratio unter 60% → zurück zu Team
6. **Chat-Erkennung:** "Erstelle Wochenbericht" → Agent schlägt Skill vor
7. **Command Palette:** Cmd+K → "wochen" → Skill finden → ausführen
8. **RLS:** Employee sieht keine Personal-Skills anderer User
9. **Multi-Channel:** `/skill wochenbericht KW12` in Slack → funktioniert
