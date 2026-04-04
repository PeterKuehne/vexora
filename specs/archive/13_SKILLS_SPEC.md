# Spec: Skills — Kodifiziertes Unternehmenswissen

**Status:** Grundsystem implementiert, Schwarm-Mechanik unvollständig
**Bezug:** [00_COR7EX_VISION.md](./00_COR7EX_VISION.md) — "Skills — das mächtigste Werkzeug"
**Inspiration:** OpenClaw Skill-System (Progressive Disclosure, Trigger-Patterns, Slash-Commands)
**Ersetzt:** 09_HIVEMIND_PHASE3_SKILLS.md (erweitert diese Spec)

---

## Zusammenfassung

Skills sind das **kodifizierte Wissen des Unternehmens** — bewährte Prozesse, die von Menschen entwickelt, vom Schwarm bewertet und als Standard übernommen werden. Sie machen Wissen ausführbar: Statt einer Prozessbeschreibung in einem PDF wird der Prozess zu einem Skill, den der Agent Schritt für Schritt ausführen kann.

---

## 1. Skill-Modell

### 1.1 Datenstruktur

| Feld                    | Typ      | Beschreibung                                                            |
| ----------------------- | -------- | ----------------------------------------------------------------------- |
| `id`                    | UUID     | Primärschlüssel                                                         |
| `name`                  | String   | Anzeigename                                                             |
| `slug`                  | String   | URL-safe Identifier (unique per Tenant)                                 |
| `description`           | String   | Trigger-Phrasen und Use-Case (entscheidend für Agent-Erkennung)         |
| `definition`            | JSONB    | `{ content, tools, version }` — Markdown-Anweisungen + empfohlene Tools |
| `scope`                 | Enum     | `personal` / `team` / `swarm`                                           |
| `category`              | String   | recherche, zusammenfassung, analyse, vergleich, erstellung, meta        |
| `tags`                  | String[] | Freie Tags                                                              |
| `isBuiltin`             | Boolean  | Systemweite vordefinierte Skills                                        |
| `isVerified`            | Boolean  | Vom Schwarm bestätigt                                                   |
| `upvotes` / `downvotes` | Integer  | Community-Bewertung                                                     |
| `adoptionCount`         | Integer  | Wie viele User den Skill aktiv nutzen                                   |
| `executionCount`        | Integer  | Gesamte Ausführungen                                                    |
| `disableAutoInvocation` | Boolean  | **NEU** — Skill nur per Slash-Command aufrufbar                         |

**Bereits implementiert:** ✅ Vollständig in DB + API + Frontend (außer `disableAutoInvocation`)

### 1.2 Scopes — Der Schwarm-Weg

```
Personal                Team                   Schwarm
┌──────────┐    Share   ┌──────────┐   Auto    ┌──────────┐
│ Mein     │ ────────→  │ Abtei-   │ ──────→   │ Unter-   │
│ Skill    │            │ lung     │ Promotion │ nehmens- │
└──────────┘            └──────────┘           │ Standard │
  Nur ich               Mein Team              └──────────┘
  sieht ihn              sieht ihn              Alle sehen ihn
```

**Personal → Team:** User klickt "Teilen" → Skill wird für die Abteilung sichtbar

**Team → Schwarm (Auto-Promotion):**

- Mindestens 5 Adoptions (User haben aktiv gevoted "Ich nutze diesen Skill")
- Mindestens 80% Upvote-Ratio
- Skill wird automatisch `scope: 'swarm'`, `isVerified: true`

**Schwarm → Team (Auto-Degradation):**

- Upvote-Ratio fällt unter 60% bei mindestens 10 Votes
- Built-in Skills werden nie degradiert

**Bereits implementiert:** ✅ Promotion/Degradation-Logik in `SwarmPromotion.ts`

---

## 2. Agent-Integration

### 2.1 Progressive Disclosure (3 Stufen)

Der Agent erfährt nicht alle Skill-Details auf einmal — das würde den Prompt sprengen. Dieses Pattern ist validiert durch OpenClaw (332k+ GitHub Stars) das identisch vorgeht.

**Level 1 — System-Prompt (immer):**
Bis zu 20 Skills als Kurzliste: Name + Slug + Description. Der Agent sieht was es gibt.
Token-Kosten: ~24 Tokens pro Skill.

**Level 2 — load_skill (bei Bedarf):**
Agent ruft `load_skill(slug)` auf → bekommt vollständige Markdown-Anweisungen + empfohlene Tools.
Empfehlung: < 5.000 Wörter pro Skill.

**Level 3 — Ausführung:**
Agent folgt den Anweisungen Schritt für Schritt, nutzt die empfohlenen Tools.

**Bereits implementiert:** ✅ Vollständig

### 2.2 Skill-Trigger: 3 Wege einen Skill aufzurufen

Inspiriert von OpenClaw's Trigger-Modell. Aktuell unterstützt Cor7ex nur Weg 1 (Auto). Wege 2 und 3 werden ergänzt.

| Modus              | Wie                                                                           | Wann sinnvoll                   |
| ------------------ | ----------------------------------------------------------------------------- | ------------------------------- |
| **Auto (Default)** | LLM entscheidet anhand Description im System-Prompt                           | Normaler Gebrauch               |
| **Slash-Command**  | User tippt `/skill-slug` in der Eingabe                                       | Explizite Auslösung, Power-User |
| **Nur manuell**    | `disableAutoInvocation: true` — nicht im System-Prompt, nur per Slash-Command | Teure/sensible Skills           |

**Beispiele:**

- `/recherche-report Thema Digitalisierung` → Agent lädt Skill + startet sofort
- `/vertrag-prüfen` → Agent lädt Skill, fragt nach dem Vertrag
- Skill mit `disableAutoInvocation: true` → erscheint nicht in der Skill-Liste im System-Prompt, nur per `/slug` aufrufbar

**Warum Slash-Commands:**

- User muss nicht hoffen dass das LLM den richtigen Skill erkennt
- Deterministisch — kein Prompt-Engineering in der Description nötig
- Power-User können direkt den Skill ansprechen den sie wollen
- Teure Skills (die Cloud-Model triggern) können vor Auto-Invocation geschützt werden

### 2.3 Skill-Description: "When to Use / When NOT to Use"

Jede Skill-Description sollte explizit definieren wann der Skill **genutzt** und wann er **NICHT genutzt** werden soll. Das verbessert die LLM-Entscheidungsqualität erheblich.

**Format für Descriptions:**

```
Erstelle umfassende Recherche-Reports basierend auf dem Wissensspeicher.
Use when: "Recherchiere", "Erstelle einen Report", "Analysiere das Thema",
"Fasse zusammen was wir über X wissen"
Do NOT use when: Einfache Faktenfragen, kurze Antworten,
Aufgaben ohne Bezug zum Wissensspeicher
```

**Implementierung:**

- Skill-Creator anpassen: im Interview-Schritt explizit nach "When to Use" und "When NOT to Use" fragen
- Built-in Skills um diese Felder ergänzen
- Kein Schema-Änderung nötig — Description ist bereits Freitext

### 2.4 Skill-Gating: Voraussetzungen prüfen

Inspiriert von OpenClaw's `requires`-System. Ein Skill sollte nur angeboten werden wenn seine Voraussetzungen erfüllt sind.

**Neues Feld in `definition`:** `requires`

```json
{
  "content": "...",
  "tools": ["rag_search", "sql_query"],
  "version": "1.0",
  "requires": {
    "tools": ["sql_query"],
    "roles": ["Manager", "Admin"]
  }
}
```

**Logik:**

- Wenn der Skill `sql_query` braucht und der User kein Manager/Admin ist → Skill wird nicht im System-Prompt angezeigt
- Verhindert frustrierende Erfahrungen (Agent lädt Skill, scheitert dann an fehlenden Berechtigungen)

**Implementierung:**

- `AgentExecutor.buildSystemPrompt()` filtert Skills deren `requires.roles` nicht zum User passen
- `AgentExecutor.buildSystemPrompt()` filtert Skills deren `requires.tools` nicht für den User verfügbar sind
- Slash-Commands zeigen dem User nur Skills an die er auch nutzen kann

### 2.5 Skill-Tools (5 Stück)

| Tool             | Zweck                                 | Status |
| ---------------- | ------------------------------------- | ------ |
| `list_skills`    | Skills durchsuchen (Kategorie, Suche) | ✅     |
| `load_skill`     | Vollständige Anweisungen laden        | ✅     |
| `create_skill`   | Neuen Personal-Skill erstellen        | ✅     |
| `update_skill`   | Bestehenden Skill aktualisieren       | ✅     |
| `run_skill_test` | Sub-Agent A/B-Test mit/ohne Skill     | ✅     |

### 2.6 Built-in Skills (3 Stück)

| Skill                    | Slug               | Kategorie       | Beschreibung                                                   |
| ------------------------ | ------------------ | --------------- | -------------------------------------------------------------- |
| Skill Creator            | `skill-creator`    | meta            | 8-Phasen Workflow zum Erstellen, Testen, Verbessern von Skills |
| Dokument-Zusammenfassung | `document-summary` | zusammenfassung | Multi-Pass Suche + Zusammenfassung mit Quellen                 |
| Recherche-Report         | `research-report`  | recherche       | Dokument + Graph-Analyse → strukturierter Bericht              |

**Bereits implementiert:** ✅ Als JSON-Dateien, beim Server-Start geseedet

---

## 3. Was fehlt — Besprochene Erweiterungen

### 3.1 Adoption-Tracking reparieren (Kritisch)

**Problem:** Das Feld `adoptionCount` wird nie hochgezählt. Auto-Promotion braucht ≥5 Adoptions → der Schwarm-Mechanismus ist de facto tot.

**Entscheidung:** Adoption = User voted aktiv auf einen Skill (Upvote). Ein Upvote ist die bewusste Aussage "Ich nutze diesen Skill regelmäßig und finde ihn gut."

**Implementierung:**

Änderung in `SkillRegistry.ts` → `vote()`:

```typescript
// Bei Upvote: adoption_count hochzählen
if (vote === 1) {
  await db.query(
    `UPDATE skills SET adoption_count = (
      SELECT COUNT(*) FROM skill_votes WHERE skill_id = $1 AND vote = 1
    ) WHERE id = $1`,
    [skillId]
  )
}
```

Nach jedem Vote wird `adoption_count` aus der tatsächlichen Anzahl positiver Votes berechnet. Damit wird die Schwarm-Promotion wieder funktionsfähig.

### 3.2 Execution-Ergebnis tracken (Hoch)

**Problem:** `load_skill` loggt `{loaded: true}`, aber ob der Skill erfolgreich genutzt wurde und was das Ergebnis war → wird nicht erfasst.

**Entscheidung:** Execution-Tracking muss den gesamten Lifecycle abbilden: geladen → ausgeführt → Ergebnis.

**Implementierung:**

Änderung in `AgentExecutor.ts` → `runTurn()`:

- Wenn ein `load_skill` Call erkannt wird, den `skill_execution` Eintrag merken
- Am Ende des Turns: Execution mit Status `completed` oder `failed` + Ergebnis updaten
- Felder in `skill_executions`: `status`, `outputs`, `duration_ms`

### 3.3 "Ergebnis im Wissensspeicher ablegen" (Hoch)

**Problem:** Die Vision sagt: _"Skills sorgen dafür, dass erarbeitete Ergebnisse gespeichert werden."_ Es gibt keinen Mechanismus der nach Skill-Ausführung fragt ob das Ergebnis gespeichert werden soll.

**Entscheidung:** Dies wird als separater Schritt **im Skill selbst** umgesetzt, nicht als System-Feature. Jeder Skill der ein speicherwürdiges Ergebnis erzeugt, bekommt als letzten Schritt in seinen Anweisungen:

```markdown
## Letzter Schritt: Ergebnis sichern

Frage den User: "Soll ich das Ergebnis im Wissensspeicher ablegen?"

- Wenn ja: Nutze `create_document` mit dem Ergebnis als Inhalt
- Wenn nein: Beende die Aufgabe ohne zu speichern
```

**Warum im Skill statt als System-Feature:**

- Nicht jeder Skill erzeugt speicherwürdige Ergebnisse
- Der Skill-Ersteller weiß am besten ob sein Ergebnis gespeichert werden sollte
- Kein automatisches Speichern von Müll
- Built-in Skills (research-report, document-summary) bekommen diesen Schritt

**Implementierung:**

- Built-in Skills `research-report.json` und `document-summary.json` um den Schritt ergänzen
- `skill-creator.json` anpassen: im Workflow darauf hinweisen, dass Skills diesen Schritt enthalten sollten

### 3.4 Slash-Commands für Skills (Mittel)

**Problem:** User muss darauf vertrauen dass das LLM den richtigen Skill erkennt. Kein deterministischer Weg einen Skill auszulösen.

**Entscheidung:** User kann `/skill-slug` in die Eingabe tippen um einen Skill direkt aufzurufen.

**Implementierung:**

Frontend (`AgentTaskDetail.tsx` / `AgentContext.tsx`):

- Eingabe wird auf `/` Prefix geprüft
- Slash-Command Autocomplete: zeigt verfügbare Skills beim Tippen
- Bei Match: `startTask(restOfMessage, undefined, undefined, skillSlug)` aufrufen

Backend (`AgentExecutor.ts`):

- Neuer Parameter `skillSlug` in `execute()`
- Wenn gesetzt: Skill wird direkt geladen (Level 2) und die Anweisungen in den System-Prompt injiziert
- Kein Umweg über LLM-Erkennung → deterministisch

API (`routes/agents.ts`):

- `POST /api/agents/run` bekommt optionales Feld `skillSlug`

### 3.5 `disableAutoInvocation` Flag (Mittel)

**Problem:** Teure Skills (die Cloud-Model triggern könnten) oder sensible Skills sollten nicht automatisch vom LLM aufgerufen werden.

**Entscheidung:** Neues Boolean-Feld `disableAutoInvocation`. Wenn `true`, erscheint der Skill nicht im System-Prompt Level 1, ist aber per Slash-Command aufrufbar.

**Implementierung:**

DB-Migration:

```sql
ALTER TABLE skills ADD COLUMN disable_auto_invocation BOOLEAN DEFAULT false;
```

`AgentExecutor.buildSystemPrompt()`:

- Skills mit `disableAutoInvocation: true` aus der Level-1 Liste filtern

Frontend:

- Toggle in Skill-Detail/Edit: "Nur per /Befehl aufrufbar"

### 3.6 Skill-Gating nach Voraussetzungen (Mittel)

**Problem:** Ein Skill der `sql_query` braucht wird auch Employees angeboten, obwohl sie das Tool nicht nutzen können. Agent lädt Skill, scheitert dann.

**Entscheidung:** `definition.requires` definiert Voraussetzungen. Skills die nicht erfüllt werden, werden nicht angeboten.

**Implementierung:**

Schema-Erweiterung in `definition` JSONB:

```json
{
  "requires": {
    "tools": ["sql_query"],
    "roles": ["Manager", "Admin"]
  }
}
```

`AgentExecutor.buildSystemPrompt()`:

- Prüft `requires.roles` gegen `context.userRole`
- Prüft `requires.tools` gegen `toolRegistry.getAvailableTools(context)`
- Filtert nicht-qualifizierte Skills aus Level-1 Liste

### 3.7 "When to Use / When NOT to Use" in Descriptions (Klein)

**Problem:** Skill-Descriptions definieren nur wann der Skill genutzt werden soll, aber nicht wann NICHT. Das führt zu Fehlauslösungen.

**Entscheidung:** Convention für Descriptions: immer "Use when" + "Do NOT use when" angeben.

**Implementierung:**

- Built-in Skills um "Do NOT use when" ergänzen
- Skill-Creator Workflow anpassen: im Interview explizit nach beiden Seiten fragen
- Keine Schema-Änderung — Description bleibt Freitext

---

## 4. Was NICHT geändert wird (vorerst)

| Feature                                 | Grund                                                                             |
| --------------------------------------- | --------------------------------------------------------------------------------- |
| **Skill-Versionierung**                 | Zu wenige Skills im System, Aufwand zu groß                                       |
| **Skill-Suche in Sidebar**              | Bestehende Liste reicht bei aktueller Skill-Anzahl                                |
| **Skill-Dependencies**                  | Kein Bedarf, Skills sind unabhängig                                               |
| **Skill-Creation UI**                   | Skill Creator Agent funktioniert gut                                              |
| **Benachrichtigung bei Promotion**      | Nice-to-have, niedrige Priorität                                                  |
| **RLS-Enforcement**                     | App verbindet als Table-Owner, funktioniert über App-Level Checks                 |
| **Scripts-Ordner**                      | OpenClaw hat Scripts für deterministische Tasks — Cor7ex braucht das (noch) nicht |
| **Skill-Marketplace (ClawHub-ähnlich)** | Erst relevant bei vielen Skills/Tenants                                           |
| **Skill-Format auf YAML+MD umstellen**  | DB bleibt richtig für Enterprise (RLS, Voting, Multi-Tenancy)                     |

---

## 5. Was bereits implementiert ist

| Feature                             | Status | Datei(en)                             |
| ----------------------------------- | ------ | ------------------------------------- |
| Datenmodell (alle Felder)           | ✅     | types.ts, 011_skills.sql              |
| CRUD (Create, Read, Update, Delete) | ✅     | SkillRegistry.ts, routes/skills.ts    |
| 3 Scopes (personal, team, swarm)    | ✅     | SkillRegistry.ts                      |
| Voting (Upvote/Downvote)            | ✅     | SkillRegistry.ts                      |
| Auto-Promotion (team → swarm)       | ✅     | SwarmPromotion.ts                     |
| Auto-Degradation (swarm → team)     | ✅     | SwarmPromotion.ts                     |
| Share (personal → team)             | ✅     | SkillRegistry.ts                      |
| 5 Agent-Tools                       | ✅     | tools/load-skill.ts, etc.             |
| Progressive Disclosure (L1+L2)      | ✅     | AgentExecutor.ts                      |
| Sub-Agent Testing (A/B)             | ✅     | tools/run-skill-test.ts               |
| 3 Built-in Skills                   | ✅     | builtin/\*.json                       |
| Skill Validator                     | ✅     | SkillValidator.ts                     |
| Frontend (Sidebar, Detail, Grid)    | ✅     | SkillSidebar.tsx, SkillDetail.tsx     |
| Execution-Tracking (teilweise)      | ⚠️     | Nur `{loaded: true}`, kein Ergebnis   |
| Adoption-Count                      | ❌     | Feld existiert, wird nie aktualisiert |
| Ergebnis-Speicherung                | ❌     | Kein Mechanismus vorhanden            |
| Slash-Commands                      | ❌     | Nicht implementiert                   |
| `disableAutoInvocation`             | ❌     | Nicht implementiert                   |
| Skill-Gating                        | ❌     | Nicht implementiert                   |
| "When NOT to Use" Convention        | ❌     | Nicht in Built-in Skills              |

## 6. Was implementiert werden muss

| Feature                             | Priorität | Aufwand | Beschreibung                                                              |
| ----------------------------------- | --------- | ------- | ------------------------------------------------------------------------- |
| **Adoption = Upvote-Count**         | Hoch      | Klein   | `adoption_count` aus `skill_votes` berechnen                              |
| **Execution-Ergebnis tracken**      | Hoch      | Mittel  | Skill-Ausführung mit Status + Ergebnis loggen                             |
| **"Ergebnis speichern?" in Skills** | Hoch      | Klein   | Letzten Schritt in Built-in Skills ergänzen                               |
| **Slash-Commands `/skill-slug`**    | Mittel    | Mittel  | Frontend: Prefix-Erkennung + Autocomplete, Backend: `skillSlug` Parameter |
| **`disableAutoInvocation` Flag**    | Mittel    | Klein   | DB-Feld + Filter in buildSystemPrompt                                     |
| **Skill-Gating (`requires`)**       | Mittel    | Klein   | `definition.requires` prüfen in buildSystemPrompt                         |
| **"When NOT to Use" Convention**    | Klein     | Klein   | Built-in Skills + Skill-Creator anpassen                                  |
| **Skill-Creator Hinweis**           | Klein     | Klein   | Im Workflow auf Ergebnis-Speicherung + Trigger-Patterns hinweisen         |

### Implementierungs-Reihenfolge

1. `adoption_count` bei Vote-Änderung aktualisieren → Schwarm-Promotion wird lebendig
2. Execution-Tracking in `AgentExecutor.ts` vervollständigen
3. Built-in Skills um "Ergebnis speichern?" + "When NOT to Use" ergänzen
4. Slash-Commands: Frontend (Prefix + Autocomplete) + Backend (`skillSlug`)
5. `disableAutoInvocation` Flag + Skill-Gating
6. Skill-Creator Anweisungen anpassen

---

## 7. Vergleich: Cor7ex vs. OpenClaw Skills

| Aspekt                      | OpenClaw                       | Cor7ex                             | Bewertung                  |
| --------------------------- | ------------------------------ | ---------------------------------- | -------------------------- |
| **Format**                  | SKILL.md (Filesystem)          | JSONB in PostgreSQL                | DB richtig für Enterprise  |
| **Progressive Disclosure**  | L1→L2→L3                       | L1→L2→L3                           | Identisch ✅               |
| **Trigger**                 | Auto + Slash + Direct Dispatch | Auto (+ Slash geplant)             | OpenClaw weiter            |
| **Auto-Invocation Control** | `disable-model-invocation`     | `disableAutoInvocation` (geplant)  | Wird übernommen            |
| **"When NOT to Use"**       | Convention in Descriptions     | Convention (geplant)               | Wird übernommen            |
| **Gating/Requirements**     | OS, Bins, Env, Config          | Roles, Tools (geplant)             | Enterprise-angepasst       |
| **Scopes**                  | Per-Agent/Machine/Public       | Personal/Team/Schwarm              | Cor7ex besser (Enterprise) |
| **Voting**                  | Stars + Comments               | Upvotes/Downvotes + Auto-Promotion | Cor7ex besser (Schwarm)    |
| **A/B Testing**             | Manuell (CLI)                  | `run_skill_test` Sub-Agent         | Cor7ex besser              |
| **Execution-Tracking**      | Keines                         | Geplant (Lifecycle)                | Cor7ex besser              |
| **Marketplace**             | ClawHub (13.7k Skills)         | Keiner (intern)                    | OpenClaw weiter            |
| **Scripts**                 | Python/JS im scripts/ Ordner   | Nicht geplant                      | Kein Bedarf aktuell        |

---

## 8. Verifikation

1. **Adoption-Tracking:** User voted Skill → `adoption_count` steigt → bei 5 Upvotes + 80% Ratio → Skill wird automatisch zu Schwarm promoviert
2. **Execution-Tracking:** Agent lädt Skill → führt aus → `skill_executions` hat Status `completed` + Ergebnis
3. **Ergebnis-Speicherung:** Research-Report Skill → am Ende fragt Agent "Soll ich das Ergebnis speichern?" → User sagt ja → Dokument wird im Wissensspeicher erstellt
4. **Slash-Command:** User tippt `/recherche-report Thema X` → Agent lädt Skill direkt → startet Workflow
5. **Auto-Invocation Control:** Skill mit `disableAutoInvocation: true` → erscheint nicht bei normalen Fragen → nur per `/slug` aufrufbar
6. **Skill-Gating:** Employee sieht Skills mit `requires.roles: ["Manager"]` nicht im System-Prompt und nicht im Slash-Autocomplete
7. **Schwarm-Degradation:** Skill bekommt viele Downvotes → fällt unter 60% Ratio bei 10+ Votes → wird von Schwarm zu Team degradiert
8. **Built-in Schutz:** Built-in Skills werden nie degradiert, auch bei schlechten Votes
