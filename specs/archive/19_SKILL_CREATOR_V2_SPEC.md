# Spec: Skill Creator V2 — A/B Testing, Script Execution, Subagent Grading

**Status:** Teilweise implementiert
**Bezug:** [13_SKILLS_SPEC.md](./13_SKILLS_SPEC.md), [18_HYBRID_AGENT_ARCHITECTURE_SPEC.md](./18_HYBRID_AGENT_ARCHITECTURE_SPEC.md)
**Referenz:** [Anthropic Skill Creator](https://github.com/anthropics/skills/tree/main/skills/skill-creator), [The Complete Guide to Building Skills for Claude (PDF)](https://www.anthropic.com)

---

## Zusammenfassung

Der Skill Creator wird zum vollstaendigen Skill-Development-Framework nach Anthropic Best Practices ausgebaut. Kernfeatures: A/B Testing via `compare_skill`, spezialisierte Subagents (Grader, Comparator, Analyzer), Python-Script-Execution via `uv run`, Progressive Disclosure mit `references/` und `scripts/`, und automatische Iteration mit Auto-Fix.

---

## 1. Implementierungs-Status

| Komponente | Status | Beschreibung |
|-----------|--------|-------------|
| `compare_skill` Tool | Implementiert | Paralleler A/B Test via Promise.all |
| Subagent: skill-grader | Implementiert | Bewertet Output gegen Expectations |
| Subagent: skill-comparator | Implementiert | Blinder A/B-Vergleich |
| Subagent: skill-analyzer | Implementiert | Analysiert warum einer besser war |
| `references/schemas.md` | Implementiert | 7 JSON-Schemas (evals, grading, benchmark, etc.) |
| `create_skill` mit references/ | Implementiert | Progressive Disclosure Level 3 |
| Auto-Iteration im SKILL.md | Implementiert | Phase 4+5 mit Pflicht-Test und Auto-Fix |
| **`run_script` Tool** | **Geplant** | **Python-Scripts via `uv run` ausfuehren** |
| **Python Scripts** | **Geplant** | **Benchmark, Report, Validation, Description-Optimierung** |
| **SkillLoader.listScripts()** | **Geplant** | **Script-Discovery in Skill-Verzeichnissen** |

---

## 2. Architektur (Anthropic-Referenz)

### 2.1 Skill-Verzeichnis Struktur

```
skill-name/
├── SKILL.md                    # Pflicht — Instruktionen (< 500 Zeilen)
├── scripts/                    # Optional — ausfuehrbarer Code
│   ├── quick_validate.py       # Validiert SKILL.md Struktur
│   ├── aggregate_benchmark.py  # Aggregiert Test-Ergebnisse
│   ├── generate_report.py      # Generiert Markdown-Report
│   └── improve_description.py  # Optimiert Skill-Beschreibung
├── references/                 # Optional — Dokumentation (on demand)
│   ├── schemas.md              # JSON-Schemas
│   └── vorlage.md              # Domain-spezifische Vorlagen
└── assets/                     # Optional — Templates, Fonts, Icons
    └── template.md
```

### 2.2 Progressive Disclosure (3 Stufen)

1. **Frontmatter** (immer geladen): Name + Description — Trigger-Entscheidung
2. **SKILL.md Body** (bei Trigger): Kern-Instruktionen — unter 500 Zeilen
3. **Linked Files** (on demand): references/, scripts/, assets/ — nur bei Bedarf

### 2.3 Tool-Landschaft

```
Skill-Creator Workflow:
  ├─ create_skill     → Erstellt SKILL.md + references/ + DB-Record
  ├─ update_skill     → Aktualisiert SKILL.md + DB
  ├─ compare_skill    → Paralleler A/B Test (mit + ohne Skill)
  ├─ run_script       → Fuehrt Python-Scripts via uv run aus (NEU)
  ├─ agent            → Delegiert an Subagents (Grader, Comparator, Analyzer)
  └─ load_skill       → Laedt Skill-Instruktionen
```

---

## 3. `run_script` Tool (NEU)

### 3.1 Funktion

Fuehrt Python-Scripts aus Skill-Verzeichnissen via `uv run` aus. Ermoeglicht deterministische Validierung, Benchmark-Aggregation und Report-Generierung.

### 3.2 Input

```typescript
{
  script: string;      // Dateiname (z.B. "quick_validate.py")
  skill_slug: string;  // Skill dessen Script ausgefuehrt wird
  args?: string;       // Zusaetzliche CLI-Argumente
  input?: string;      // stdin-Daten (z.B. JSON fuer Aggregation)
}
```

### 3.3 Execution Flow

```
run_script(script, skill_slug, args?, input?)
  │
  ├─ Skill-Pfad aufloesen (SkillRegistry → filePath)
  ├─ Sicherheits-Check: Script liegt im Skill-Verzeichnis
  ├─ uv run {skillDir}/scripts/{script} {args}
  │   ├─ stdin: input (wenn vorhanden)
  │   ├─ timeout: 30s
  │   ├─ cwd: skillDir
  │   └─ maxBuffer: 10MB
  └─ Ergebnis: stdout → output, stderr → error
```

### 3.4 Sicherheit

- Script muss im `scripts/` Verzeichnis des Skills liegen
- Skill-gated: nur nach `load_skill('skill-creator')` verfuegbar
- Timeout: 30 Sekunden
- Buffer-Limit: 10MB
- Working Directory: Skill-Verzeichnis (kein Zugriff auf Parent)
- Kein Netzwerkzugriff (nur lokale Dateien)

---

## 4. Python Scripts

### 4.1 quick_validate.py

Validiert SKILL.md Struktur nach Anthropic-Regeln.

```
Input:  Skill-Verzeichnis als Argument
Output: JSON { valid: bool, errors: string[], warnings: string[] }
Exit:   0 = valid, 1 = invalid
```

Prueft:
- SKILL.md existiert und hat YAML-Frontmatter
- `name`: kebab-case, max 64 Zeichen, keine Leerzeichen/Unterstriche
- `description`: vorhanden, max 1024 Zeichen, keine XML-Tags
- Body: nicht leer
- references/: Dateien referenziert wenn vorhanden

### 4.2 aggregate_benchmark.py

Aggregiert Ergebnisse aus mehreren `compare_skill` Runs.

```
Input:  JSON via stdin (Array von compare_skill Ergebnissen)
Output: benchmark.json nach Schema (references/schemas.md)
```

Berechnet:
- pass_rate mean/stddev pro Konfiguration (with_skill, without_skill)
- time_seconds mean/stddev
- tokens mean/stddev
- delta zwischen Konfigurationen
- notes (Beobachtungen: nicht-differenzierende Assertions, hohe Varianz, etc.)

### 4.3 generate_report.py

Generiert Markdown-Report aus benchmark.json.

```
Input:  benchmark.json Pfad als Argument
Output: benchmark.md (stdout)
```

Enthaelt:
- Zusammenfassungstabelle
- Per-Eval Breakdown
- Verbesserungsvorschlaege
- Analyzer-Notizen

### 4.4 improve_description.py

Analysiert Skill-Beschreibung gegen Trigger-Queries.

```
Input:  JSON via stdin { description: string, queries: [{query, should_trigger}] }
Output: JSON { score: float, suggestions: string[], improved_description: string }
```

---

## 5. Skill-Creator Workflow mit Scripts

```
Phase 1-2: Intent → Interview
Phase 3:   create_skill → run_script(quick_validate.py) → Fix wenn noetig
Phase 4:   compare_skill × N → run_script(aggregate_benchmark.py) → run_script(generate_report.py)
Phase 5:   Auto-Fix / User-Feedback → update_skill → re-test
Phase 6:   run_script(improve_description.py) → update_skill
```

---

## 6. Subagents (implementiert)

| Agent | Zweck | Wann |
|-------|-------|------|
| `skill-grader` | Bewertet Output gegen Expectations mit Evidenz | Nach compare_skill |
| `skill-comparator` | Blinder A/B-Vergleich (bias-frei) | Wenn unklar wer besser |
| `skill-analyzer` | Analysiert WARUM einer besser war + Verbesserungsvorschlaege | Wenn Skill verliert |

---

## 7. Dateien

### Neue Dateien:
1. `server/src/services/agents/tools/run-script.ts` — Tool fuer Script-Execution
2. `server/skills/skill-creator/scripts/quick_validate.py`
3. `server/skills/skill-creator/scripts/aggregate_benchmark.py`
4. `server/skills/skill-creator/scripts/generate_report.py`
5. `server/skills/skill-creator/scripts/improve_description.py`

### Modifizierte Dateien:
1. `server/src/services/agents/tools/index.ts` — run_script registrieren
2. `server/skills/skill-creator/SKILL.md` — Script-Referenzen im Workflow
3. `server/src/services/skills/SkillLoader.ts` — listScripts() hinzufuegen

---

## 8. Erfolgs-Kriterien

| Metrik | Ziel |
|--------|------|
| Script-Execution | `uv run` fuehrt Python-Scripts zuverlaessig aus |
| Validierung | quick_validate.py erkennt fehlerhafte SKILL.md |
| Benchmark | aggregate_benchmark.py berechnet korrekte Statistiken |
| Report | generate_report.py erzeugt lesbaren Markdown-Report |
| Workflow-Integration | Skill-Creator nutzt Scripts automatisch an richtiger Stelle |
| Sicherheit | Scripts koennen nur im eigenen Skill-Verzeichnis laufen |
