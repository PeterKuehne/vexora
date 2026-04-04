# Phase 3: Schwarm-Skill-System

**Status:** Implementiert
**Abhängigkeiten:** Phase 2 (Agent Framework), Vercel AI SDK 6 Migration
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
- Jeder Mitarbeiter kann einen Skill erstellen (auch über den Agenten via Skill Creator Skill)
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

Wenn ein Schwarm-Skill über Zeit schlechte Bewertungen bekommt (Quote fällt unter 60% bei mindestens 10 Votes), wird er automatisch zum Team-Skill zurückgestuft. Built-in Skills werden nie degradiert. Der Schwarm korrigiert sich selbst.

---

## 3.2 Skill-Architektur: Progressive Disclosure

Skills nutzen ein **dreistufiges Laden** inspiriert von Anthropic Claude Code Skills:

### Level 1: Metadata (immer im Kontext)

Skill-Name + Description werden in den Agent System-Prompt injiziert (~100 Wörter pro Skill). Der Agent weiß dadurch immer welche Skills existieren, ohne sie laden zu müssen.

```
SKILLS (pre-built workflows):
- Skill Creator [skill-creator]: Erstellt, testet und verbessert Skills...
- Dokument-Zusammenfassung [document-summary]: Fasst Dokumente zusammen...
- Recherche-Report [research-report]: Erstellt strukturierte Recherche-Reports...
```

### Level 2: Instruktionen (on-demand via load_skill)

Wenn der Agent einen passenden Skill erkennt, lädt er die vollständigen Markdown-Instruktionen via `load_skill(slug)`. Diese enthalten den kompletten Workflow, Regeln, Beispiele.

### Level 3: Tool-Nutzung

Der Agent folgt den Skill-Instruktionen und nutzt die empfohlenen Tools (rag_search, read_chunk, create_skill, etc.) um die Aufgabe zu erledigen.

```
User: "Erstelle einen Recherche-Report zum Thema X"

Agent erkennt: Skill "research-report" passt
  → load_skill("research-report")
  → Erhält vollständige Markdown-Instruktionen
  → Folgt dem Workflow: rag_search → read_chunk → graph_query → Report formatieren
```

### Skill-Definition Format

Skills werden als JSONB in PostgreSQL gespeichert:

```typescript
interface SkillDefinition {
  content: string;    // Vollständige Markdown-Instruktionen
  tools: string[];    // Empfohlene Tool-Namen
  version: string;    // Semantische Version
}
```

**Beispiel (document-summary.json):**
```json
{
  "slug": "document-summary",
  "name": "Dokument-Zusammenfassung",
  "description": "Fasst Dokumente zusammen. Nutze diesen Skill wenn der User 'fasse zusammen', 'Zusammenfassung', 'Überblick' sagt...",
  "category": "zusammenfassung",
  "tags": ["zusammenfassung", "dokument"],
  "definition": {
    "version": "1.0.0",
    "tools": ["rag_search", "read_chunk"],
    "content": "# Dokument-Zusammenfassung\n\n## Workflow\n1. Durchsuche die Wissensdatenbank...\n2. Lies relevante Chunks...\n3. Erstelle eine strukturierte Zusammenfassung..."
  }
}
```

### Description — das Wichtigste

Die Description bestimmt ob der Agent den Skill lädt. Sie muss enthalten:
1. Was der Skill tut (1 Satz)
2. Wann er genutzt werden soll (Trigger-Phrasen auf Deutsch)
3. Konkretes Beispiel was User sagen könnten

Tendenz ist dass Skills zu selten getriggert werden — daher die Description etwas "pushier" formulieren.

---

## 3.3 Agent-Tools für Skills

Skills werden über Agent-Tools gesteuert, nicht über separate API-Endpoints:

| Tool | Zweck |
|------|-------|
| `load_skill` | Lädt vollständige Instruktionen eines Skills (Level 2) |
| `list_skills` | Durchsucht verfügbare Skills (Kategorie, Suche) |
| `create_skill` | Erstellt einen neuen Personal-Skill |
| `update_skill` | Aktualisiert einen bestehenden Skill |
| `run_skill_test` | Testet einen Skill via Sub-Agent (mit/ohne Skill, A/B-Vergleich) |

### Sub-Agent Testing (run_skill_test)

Das `run_skill_test` Tool spawnt einen unabhängigen Sub-Agenten via `generateText()`:

```typescript
// Wird innerhalb des Skill Creator Workflows genutzt
run_skill_test({
  prompt: "Fasse das Dokument XY zusammen",
  skill_slug: "document-summary",  // Test MIT Skill
})

run_skill_test({
  prompt: "Fasse das Dokument XY zusammen",
  // kein skill_slug = Baseline OHNE Skill
})
```

Der Sub-Agent hat eigene Tools, eigenes System-Prompt, eigenes Step-Limit. Ergebnis enthält: Antwort, Dauer, Steps, Tokens, genutzte Tools.

### System-Prompt Regel

Tools wie `create_skill`, `update_skill`, `run_skill_test` sind für Skill-Workflows gedacht (z.B. den Skill Creator Skill), nicht für direkten Aufruf. Der System-Prompt instruiert den Agent, bei Skill-bezogenen Anfragen zuerst den passenden Skill zu laden.

---

## 3.4 Built-in Skills

Drei Built-in Skills werden beim Server-Start via `seedBuiltinSkills()` in die DB geladen (idempotent):

| Skill | Slug | Kategorie | Tools |
|-------|------|-----------|-------|
| Skill Creator v3 | `skill-creator` | meta | create_skill, update_skill, load_skill, list_skills, run_skill_test |
| Dokument-Zusammenfassung | `document-summary` | zusammenfassung | rag_search, read_chunk |
| Recherche-Report | `research-report` | recherche | rag_search, read_chunk, graph_query |

### Skill Creator (Meta-Skill)

Der Skill Creator führt den User durch den Skill-Entwicklungsprozess:

1. **Intent erfassen** — Verstehe was der Skill tun soll
2. **Interview** — Kläre Edge Cases, Formate, Erfolgskriterien
3. **Skill schreiben** — Erstelle mit `create_skill`
4. **Testen mit Sub-Agenten** — `run_skill_test` mit UND ohne Skill
5. **Ergebnisse präsentieren** — Vergleich dem User zeigen
6. **Verbessern** — `update_skill` basierend auf Feedback
7. **Wiederholen** — Bis der User zufrieden ist
8. **Description optimieren** — Trigger-Treffsicherheit verbessern

---

## 3.5 Datenbank

### Migration `011_skills.sql`

```sql
CREATE TABLE skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  created_by UUID REFERENCES users(id),
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(200) NOT NULL,
  description TEXT,
  definition JSONB NOT NULL,  -- { content, tools, version }

  -- Schwarm-Lebenszyklus
  scope TEXT NOT NULL DEFAULT 'personal'
    CHECK (scope IN ('personal', 'team', 'swarm')),
  department VARCHAR(100),
  is_verified BOOLEAN DEFAULT FALSE,
  promoted_at TIMESTAMPTZ,

  -- Metriken
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  adoption_count INTEGER DEFAULT 0,
  execution_count INTEGER DEFAULT 0,
  avg_duration_ms INTEGER,

  -- Meta
  is_builtin BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  category VARCHAR(100),
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, slug)
);

CREATE TABLE skill_votes (
  skill_id UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  vote SMALLINT NOT NULL CHECK (vote IN (-1, 1)),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (skill_id, user_id)
);

CREATE TABLE skill_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id UUID NOT NULL REFERENCES skills(id),
  task_id UUID REFERENCES agent_tasks(id),
  user_id UUID NOT NULL REFERENCES users(id),
  inputs JSONB,
  outputs JSONB,
  status TEXT DEFAULT 'running',
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### RLS

- **Personal Skills**: Nur Ersteller oder Admin
- **Team Skills (aktiv)**: Gleiche Abteilung oder Admin
- **Schwarm Skills (aktiv)**: Alle
- **Built-in Skills**: Alle
- Insert/Update/Delete: Nur Ersteller oder Admin

---

## 3.6 Architektur-Übersicht

```
server/src/services/skills/
  SkillRegistry.ts        ← CRUD + Discovery + getSkills/getSkillBySlug
  SkillValidator.ts       ← Validiert Definitionen (content, tools, version)
  SwarmPromotion.ts       ← Automatische Scope-Änderung basierend auf Votes
  types.ts                ← SkillDefinition, Skill, SkillUserContext
  index.ts                ← Initialization + seedBuiltinSkills
  builtin/
    skill-creator.json    ← Meta-Skill mit Sub-Agent Tests (v3)
    document-summary.json ← Zusammenfassung
    research-report.json  ← Strukturierter Recherche-Report

server/src/services/agents/tools/
  load-skill.ts           ← Progressive Disclosure Level 2
  list-skills.ts          ← Discovery Tool
  create-skill.ts         ← Skill-Erstellung
  update-skill.ts         ← Skill-Aktualisierung
  run-skill-test.ts       ← Sub-Agent Testing (A/B Vergleich)

server/src/services/agents/
  AgentExecutor.ts        ← System-Prompt mit Skill-Liste (Level 1)
  ai-provider.ts          ← resolveModel() für Sub-Agenten
```

---

## 3.7 Multi-Turn Agent-Konversationen

Agent Tasks sind **Multi-Turn Konversationen** (wie Claude Cowork):

- User sendet Nachricht → Agent antwortet (nutzt Tools) → User antwortet → Agent antwortet → ...
- Status `awaiting_input`: Agent wartet auf nächste User-Nachricht
- Volle Message-History wird bei jedem Turn an `generateText()` übergeben
- Konversation kann explizit beendet werden

Dies ist essentiell für den Skill Creator Workflow (Interview → Draft → Test → Feedback → Improve), der mehrere Gesprächsrunden erfordert.

### Datenbank (Migration 012)

```sql
CREATE TABLE agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
  turn_number INTEGER NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE agent_steps ADD COLUMN turn_number INTEGER DEFAULT 1;
ALTER TABLE agent_tasks ADD CONSTRAINT agent_tasks_status_check
  CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled', 'awaiting_input'));
```

### API

```
POST /api/agents/run                    → Neue Konversation starten (Turn 1)
POST /api/agents/tasks/:id/message      → Follow-up Nachricht senden (Turn N)
POST /api/agents/tasks/:id/complete     → Konversation beenden
POST /api/agents/tasks/:id/cancel       → Konversation abbrechen
GET  /api/agents/tasks/:id              → Task + Steps + Messages laden
GET  /api/agents/tasks                  → Task-Liste (paginated)
```

---

## 3.8 Frontend

### Agent Workspace (primäre Interaktion)

Der Agent Workspace zeigt Multi-Turn Konversationen:
- **User-Nachrichten**: Rechts-eingerückte Bubble (wie Claude Cowork)
- **Agent-Antworten**: Markdown-formatiert, links
- **Tool-Calls**: Collapsible mit Request/Ergebnis Badge
- **Tool-Gruppen**: "5 Tools ausgeführt >" zusammenfassbar
- **Chat-Input**: Sichtbar wenn Agent auf Input wartet (`awaiting_input`)
- **"Beenden" Button**: Im Header um Konversation abzuschließen

### Sidebar

Zeigt alle Agent-Konversationen mit Status-Badge:
- Wartend (Clock), Aktiv (Loader), Wartet (Clock/blau), Fertig (CheckCircle), Fehler (XCircle), Abgebrochen (Ban)

---

## Verifikation

1. **Skill erstellen:** User sagt "Erstelle einen Skill" → Agent lädt Skill Creator → Interview-Workflow
2. **Skill testen:** Sub-Agent wird via `run_skill_test` gespawnt → A/B Vergleich mit/ohne Skill
3. **Multi-Turn:** User gibt Feedback → Agent verbessert Skill → User gibt weiteres Feedback
4. **Skill teilen:** Personal → Team → Abteilung sieht ihn
5. **Skill bewerten:** Team-Mitglieder voten → Votes werden gezählt
6. **Schwarm-Promotion:** 5+ Nutzer + 80%+ positiv → automatisch Schwarm-Skill
7. **Schwarm-Degradation:** Vote-Ratio unter 60% → zurück zu Team
8. **Progressive Disclosure:** Level 1 (System-Prompt) → Level 2 (load_skill) → Level 3 (Tools)
9. **RLS:** Employee sieht keine Personal-Skills anderer User
