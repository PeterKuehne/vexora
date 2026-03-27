# Spec: Skills-Refactoring — Migration auf Agent Skills Standard

**Status:** Geplant
**Bezug:** [13_SKILLS_SPEC.md](./13_SKILLS_SPEC.md) (aktuelle Implementierung), [00_COR7EX_VISION.md](./00_COR7EX_VISION.md)
**Standard:** [Agent Skills Specification](https://agentskills.io/specification) (Anthropic, adoptiert von 30+ Plattformen)
**Referenz:** "The Complete Guide to Building Skills for Claude" (Anthropic, 2026)

---

## Zusammenfassung

Unsere Skills sind aktuell JSON-Blobs in der Datenbank. Der Anthropic Agent Skills Standard hat sich als offener Standard durchgesetzt (Claude, Cursor, GitHub Copilot, Gemini CLI, OpenAI Codex, JetBrains, Mistral und 30+ weitere). Diese Spec beschreibt die Migration auf diesen Standard: Skills werden zu `SKILL.md`-Dateien auf dem Filesystem, die Datenbank behält nur noch Metadaten (Votes, Tracking, Scope).

---

## 1. Ist-Zustand

### 1.1 Aktuelles Format

Skills sind Zeilen in der `skills`-Tabelle mit einer `definition` JSONB-Spalte:

```json
{
  "content": "# Recherche-Report\n\nErstelle einen umfassenden...",
  "tools": ["rag_search", "read_chunk", "graph_query"],
  "version": "1.0.0"
}
```

Built-in Skills liegen als `.json`-Dateien in `server/src/services/skills/builtin/` und werden beim Start in die DB geseeded.

### 1.2 Probleme

- **Nicht portabel** — Skills funktionieren nur in Cor7ex
- **Kein Level 3** — keine Scripts, References oder Assets möglich
- **Nicht standard-konform** — inkompatibel mit dem Agent Skills Ecosystem
- **Schwer editierbar** — Markdown in JSON-Strings, kein Syntax-Highlighting

---

## 2. Soll-Zustand

### 2.1 Dateiformat: SKILL.md (Anthropic Standard)

Jeder Skill ist ein Ordner mit einer `SKILL.md`-Datei:

```
research-report/
├── SKILL.md                  # Pflicht — YAML Frontmatter + Markdown Body
├── references/               # Optional — Doku die bei Bedarf geladen wird
│   └── report-template.md
├── scripts/                  # Optional — ausführbarer Code
└── assets/                   # Optional — Templates, Icons, Fonts
```

### 2.2 SKILL.md Format

```yaml
---
name: research-report
description: >
  Erstellt umfassende Recherche-Reports mit Dokumenten- und Graph-Analyse.
  Use when user says "Recherche", "Report erstellen", "recherchiere zu",
  "analysiere das Thema", or wants deep analysis of a topic.
  Do NOT use for simple fact questions, short summaries, or single document reads.
allowed-tools: rag_search read_chunk graph_query create_document
metadata:
  author: cor7ex
  version: 1.0.0
  category: recherche
  tags: recherche report analyse graph
  requires-roles: Admin Manager
---

# Recherche-Report

Erstelle einen umfassenden Recherche-Report...

## Phase 1: Breite Dokumentenrecherche
1. Nutze `rag_search` mit dem Hauptthema
...
```

**Wichtig:** Kein `README.md` im Skill-Ordner. `SKILL.md` ist die einzige Dokumentation.

### 2.3 Frontmatter-Felder

#### Erlaubte Top-Level Keys (Agent Skills Standard)

Der Standard erlaubt **exakt 6 Top-Level Keys**. Alle anderen werden vom Validator abgelehnt.

| Feld | Pflicht | Regeln |
|------|---------|--------|
| `name` | Ja | kebab-case, 1-64 Zeichen, keine führenden/folgenden/doppelten Hyphens, muss Ordnername matchen, keine reservierten Wörter ("anthropic", "claude") |
| `description` | Ja | 1-1024 Zeichen, keine XML-Tags (`<` `>`), keine reservierten Wörter ("anthropic", "claude") |
| `allowed-tools` | Nein | Space-delimited String (kein YAML-Array): `rag_search read_chunk graph_query` |
| `metadata` | Nein | **String-zu-String Map** — Werte müssen Strings sein, keine Arrays oder verschachtelten Objekte |
| `license` | Nein | SPDX Identifier, z.B. `MIT`, `Apache-2.0` |
| `compatibility` | Nein | 1-500 Zeichen, Umgebungsanforderungen |

#### metadata — String-zu-String Constraint

Das `metadata`-Feld ist strikt: **alle Werte müssen Strings sein**. Keine Arrays, keine Objekte.

```yaml
# RICHTIG — alle Werte sind Strings
metadata:
  author: cor7ex
  version: 1.0.0
  category: recherche
  tags: recherche report analyse graph    # Space-delimited String, kein Array
  requires-roles: Admin Manager           # Space-delimited String, kein Array

# FALSCH — Arrays sind nicht erlaubt
metadata:
  tags: [recherche, report]               # FEHLER: Array statt String
  requires-roles: ["Admin", "Manager"]    # FEHLER: Array statt String
```

#### Cor7ex-spezifische metadata-Keys

| Key | Beschreibung | Mapping von |
|-----|-------------|-------------|
| `category` | recherche, zusammenfassung, analyse, etc. | `skills.category` |
| `tags` | Freie Tags (space-delimited String) | `skills.tags` |
| `version` | Skill-Version | `definition.version` |
| `author` | Ersteller | — |
| `requires-roles` | Rollen die den Skill nutzen dürfen (space-delimited) | `definition.requires.roles` |

#### Claude Code Felder (NICHT im Open Standard)

Diese Felder sind **Claude Code Erweiterungen** und bestehen die Standard-Validierung (`skills-ref validate`) NICHT. Cor7ex interpretiert sie intern, speichert die Logik aber in der DB statt im Frontmatter.

| Claude Code Feld | Cor7ex Äquivalent | Wo gespeichert |
|------------------|-------------------|----------------|
| `disable-model-invocation` | `disable_auto_invocation` | DB-Spalte |
| `user-invocable` | Invers von obigem | DB-Spalte |
| `argument-hint` | Autocomplete-Hinweis | DB-Spalte |

**Entscheidung:** Wir nutzen KEINE nicht-standard Frontmatter-Keys. Cor7ex-spezifische Steuerung bleibt in der DB. So sind unsere Skills standard-konform UND haben Enterprise-Features.

---

## 3. Filesystem-Struktur

### 3.1 Built-in Skills (System)

```
server/skills/
├── research-report/
│   ├── SKILL.md
│   └── references/
│       └── report-template.md
├── document-summary/
│   └── SKILL.md
└── skill-creator/
    ├── SKILL.md
    ├── references/
    │   └── schemas.md
    └── scripts/
```

Built-in Skills werden beim Server-Start **nicht mehr in die DB geseeded**. Sie werden direkt vom Filesystem gelesen. Die DB speichert nur Metadaten (Votes, Execution-Count) und verweist per `file_path` auf den Ordner.

### 3.2 User-erstellte Skills

```
server/user-skills/
└── {tenant-id}/
    └── {skill-name}/
        └── SKILL.md
```

Wenn ein User via Skill-Creator oder `create_skill` Tool einen Skill erstellt, wird eine `SKILL.md`-Datei geschrieben. Die DB speichert den Pfad + Metadaten.

### 3.3 Importierte Skills (Zukunft)

Skills von extern (GitHub, Agent Skills Marketplace) werden in den gleichen Ordner kopiert. Die `source`-URL wird in der DB gespeichert für Sync.

---

## 4. Datenbank — nur noch Metadaten

### 4.1 Neue `skills`-Tabelle

```sql
-- Felder die BLEIBEN (Schwarm-Mechanik + Tracking)
id, tenant_id, created_by, scope, department,
is_verified, promoted_at, upvotes, downvotes,
adoption_count, execution_count, avg_duration_ms,
is_builtin, is_active, disable_auto_invocation,
created_at, updated_at

-- Felder die NEU sind
file_path        VARCHAR(500)   -- Pfad zum Skill-Ordner relativ zu server/
source_url       VARCHAR(1000)  -- Ursprung (GitHub URL, etc.) für Sync

-- Felder die ENTFALLEN
name             -- kommt aus SKILL.md Frontmatter
slug             -- = name aus Frontmatter = Ordnername
description      -- kommt aus SKILL.md Frontmatter
definition       -- kommt aus SKILL.md Body + Frontmatter
category         -- kommt aus metadata.category in Frontmatter
tags             -- kommt aus metadata.tags in Frontmatter
```

### 4.2 Migration

Die Migration läuft in 3 Schritten:

1. **Built-in Skills**: JSON-Dateien → SKILL.md Ordner konvertieren
2. **DB-Migration**: `file_path` Spalte hinzufügen, `definition` behalten als Fallback
3. **Lese-Logik**: Zuerst aus `file_path` lesen, Fallback auf `definition` JSONB

So bleibt das System während der Migration funktionsfähig.

---

## 5. Lese-Flow (Progressive Disclosure)

### Level 1 — System-Prompt (immer)

Beim Start liest der `SkillLoader` alle Skill-Ordner und extrahiert `name` + `description` aus dem YAML Frontmatter. Diese werden im System-Prompt aufgelistet.

- **~100 Tokens pro Skill** (name + description)
- Context-Budget für Skill-Descriptions: **2% des Context-Windows** (Anthropic Default)

```
SKILLS:
- Recherche-Report [research-report]: Erstellt umfassende Recherche-Reports
- Dokument-Zusammenfassung [document-summary]: Fasst Dokumente zusammen
```

### Level 2 — Skill geladen (bei Bedarf)

Wenn der Agent `load_skill(slug)` aufruft oder ein Slash-Command genutzt wird, wird die gesamte `SKILL.md` gelesen und der Body in den Kontext injiziert.

- **< 5.000 Tokens** empfohlen für den SKILL.md Body
- **< 500 Zeilen** empfohlen für die SKILL.md Datei
- Bei längeren Skills: Detail-Dokumentation in `references/` auslagern und aus SKILL.md verlinken

### Level 3 — Referenzen (bei Bedarf)

Wenn die SKILL.md auf Dateien in `references/` oder `scripts/` verweist, kann der Agent diese einzeln lesen. Scripts werden **ausgeführt** (Output geht in den Kontext), nicht als Text geladen. Token-Budget: unbegrenzt.

---

## 6. Schreib-Flow (Skill erstellen/bearbeiten)

### 6.1 Skill Creator

Der Skill Creator schreibt eine `SKILL.md`-Datei ins Filesystem statt `INSERT INTO skills`. Der Workflow:

1. User beschreibt Intent
2. Agent erstellt `SKILL.md` mit korrektem Frontmatter
3. Agent schreibt Datei nach `server/user-skills/{tenant}/{skill-name}/SKILL.md`
4. DB-Eintrag wird erstellt mit `file_path` Pointer

### 6.2 `create_skill` Tool

Statt `INSERT INTO skills (..., definition)` jetzt:

1. SKILL.md Datei auf Disk schreiben
2. DB-Eintrag mit `file_path` erstellen (nur Metadaten)

### 6.3 `update_skill` Tool

Statt `UPDATE skills SET definition = ...` jetzt:

1. SKILL.md Datei auf Disk aktualisieren
2. DB `updated_at` refreshen

---

## 7. Was sich NICHT ändert

| Feature | Warum es bleibt |
|---------|----------------|
| **Schwarm-Promotion** | DB-basiert, braucht kein Filesystem |
| **Voting** | DB-basiert |
| **Execution-Tracking** | DB-basiert |
| **Multi-Tenant RLS** | DB-basiert, `tenant_id` bleibt |
| **Slash-Commands** | Funktionieren gleich, lesen jetzt aus Datei statt DB |
| **`disableAutoInvocation`** | Wird zu `disable-model-invocation` im Frontmatter |
| **Scope (personal/team/swarm)** | Bleibt in DB, Datei-Scope wird durch Ordner-Pfad bestimmt |
| **Agent-Integration** | `load_skill` liest jetzt Datei statt DB-Spalte |
| **Frontend** | Skills-Ansicht funktioniert gleich, API-Schicht abstrahiert |

---

## 8. Implementierungs-Reihenfolge

### Phase A: Built-in Skills migrieren (Klein)

1. `builtin/*.json` → `server/skills/*/SKILL.md` konvertieren
2. `SkillLoader.ts` (NEU) — liest SKILL.md Frontmatter, parsed YAML
3. Seed-Logik anpassen: SKILL.md-Ordner scannen statt JSON importieren
4. `load_skill` Tool: aus Datei lesen statt DB

### Phase B: DB-Schema anpassen (Klein)

1. Migration: `file_path` + `source_url` Spalten hinzufügen
2. `definition` JSONB behalten als Fallback
3. `SkillRegistry` anpassen: bei `getSkillBySlug` zuerst `file_path` prüfen

### Phase C: User-Skills auf Filesystem (Mittel)

1. `server/user-skills/{tenant}/` Ordner-Struktur
2. `create_skill` Tool: SKILL.md schreiben statt DB-Insert
3. `update_skill` Tool: SKILL.md editieren statt DB-Update
4. Skill-Creator Instruktionen anpassen

### Phase D: Level 3 ermöglichen (Klein)

1. `references/` und `scripts/` Support in `load_skill`
2. Agent kann `read_file` auf Skill-Referenzen aufrufen
3. Agent kann Scripts ausführen

---

## 9. Dateien die geändert werden

| Datei | Änderung |
|-------|----------|
| `server/skills/*/SKILL.md` | NEU — Built-in Skills als SKILL.md |
| `server/src/services/skills/SkillLoader.ts` | NEU — YAML Frontmatter Parser |
| `server/src/services/skills/SkillRegistry.ts` | Lese-Logik: Datei vor DB |
| `server/src/services/agents/tools/load-skill.ts` | Aus Datei lesen statt DB |
| `server/src/services/agents/tools/create-skill.ts` | SKILL.md schreiben statt DB-Insert |
| `server/src/services/agents/tools/update-skill.ts` | SKILL.md editieren statt DB-Update |
| `server/src/services/skills/builtin/*.json` | ENTFÄLLT — ersetzt durch SKILL.md |
| `server/src/migrations/015_skills_filesystem.sql` | NEU — `file_path`, `source_url` |

---

## 10. Verifikation

1. **Built-in Skill liest aus SKILL.md:** `load_skill("research-report")` → Agent bekommt Markdown aus `server/skills/research-report/SKILL.md`
2. **Level 1 aus Frontmatter:** System-Prompt zeigt `name` + `description` aus YAML, nicht aus DB
3. **Level 3 funktioniert:** SKILL.md verweist auf `references/report-template.md` → Agent kann es lesen
4. **User erstellt Skill:** Skill-Creator schreibt `server/user-skills/{tenant}/mein-skill/SKILL.md`
5. **Voting funktioniert:** Votes werden in DB gespeichert, unabhängig vom Filesystem
6. **Schwarm-Promotion funktioniert:** Skill mit 5+ Adoptions wird zu `scope: swarm` — Datei bleibt wo sie ist
7. **Slash-Command funktioniert:** `/research-report Thema X` → liest SKILL.md direkt
8. **Standard-konform:** SKILL.md besteht den `skills-ref validate` Check (agentskills.io)
9. **Abwärtskompatibel:** Skills mit `definition` JSONB (ohne `file_path`) funktionieren weiterhin
