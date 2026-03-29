---
name: skill-creator
description: Erstellt, testet und verbessert Skills mit automatischem A/B-Testing
  und iterativer Verbesserung. Nutze diesen Skill wenn der User sagt 'erstelle einen
  Skill', 'neuen Skill bauen', 'Skill erstellen', 'Workflow automatisieren', 'Skill
  verbessern', 'Skill testen', oder einen wiederholbaren Prozess beschreibt den
  er als Skill haben moechte.
allowed-tools: create_skill update_skill compare_skill load_skill list_skills agent list_agents
---

# Skill Creator

Erstelle, teste und verbessere Skills mit automatischem A/B-Testing.

Dein Job ist herauszufinden wo der User im Prozess steht und ihm beim naechsten Schritt zu helfen. Vielleicht will er einen neuen Skill, vielleicht hat er schon einen Entwurf, vielleicht will er einen bestehenden verbessern. Sei flexibel.

## Der Kern-Loop

```
1. Intent verstehen → 2. Skill schreiben → 3. Erstellen
                                               │
    6. Fertig ←── 5. Verbessern ←── 4. A/B Testen
         ↑              │                │
         └──────────────┘                │
              (wiederholen bis gut)       │
                                         ▼
                               User-Feedback
```

---

## Phase 1: Intent erfassen

Verstehe was der User will. Frage:
- Was soll der Skill koennen? (konkretes Beispiel)
- Wann soll er automatisch ausgeloest werden? (Trigger-Phrasen)
- Welches Ausgabeformat? (Tabelle, Fliesstext, Aufzaehlung)

Wenn der User schon einen Konversationsverlauf hat der zeigt was er will (z.B. "mach das was wir gerade gemacht haben als Skill"), extrahiere die Antworten aus dem Verlauf. Frage nur was unklar ist.

## Phase 2: Interview & Recherche

Bevor du schreibst:
- **Wissensdatenbank durchsuchen**: Nutze `rag_search` um nach verwandten Dokumenten, Vorlagen oder Beispielen zu suchen die als Referenz fuer den neuen Skill dienen koennten. Wenn der User z.B. einen Vertrags-Skill will, suche nach bestehenden Vertraegen in der Wissensdatenbank.
- Edge Cases: Was passiert wenn keine Dokumente gefunden werden?
- Input/Output: Braucht der Skill bestimmte Eingaben?
- Abhaengigkeiten: Welche Tools werden gebraucht?
- Qualitaetskriterien: Woran erkennt man eine gute Antwort?

## Phase 3: Skill schreiben & erstellen

### SKILL.md Anatomie

```
skill-name/
├── SKILL.md (Pflicht)
│   ├── YAML Frontmatter (name, description)
│   └── Markdown Instruktionen
└── references/ (optional, fuer Progressive Disclosure)
    ├── vorlage.md        # Beispiel: Dokumentvorlage
    ├── api-guide.md      # Beispiel: API-Referenz
    └── checkliste.md     # Beispiel: Qualitaetscheckliste
```

### Progressive Disclosure — 3 Stufen

1. **Frontmatter** (immer geladen): Name + Description — entscheidet ob der Skill aktiviert wird
2. **SKILL.md Body** (bei Trigger geladen): Kern-Instruktionen — unter 500 Zeilen halten
3. **references/** (on demand): Detaillierte Dokumentation, Vorlagen, Beispiele — nur geladen wenn der Skill darauf verweist

Halte SKILL.md schlank. Wenn du Vorlagen, Checklisten, API-Docs oder Domainwissen hast das laenger als 50 Zeilen ist, packe es in `references/` und verweise darauf:

```markdown
Bevor du den Vertrag generierst, lies `references/auev-vorlage.md` fuer:
- Die Standardstruktur mit allen Paragraphen
- Pflichtfelder und variable Daten
- Kontaktdaten des Unternehmens
```

### Erstellen mit references/

Das `create_skill` Tool unterstuetzt einen `references` Parameter — ein JSON-Objekt mit Dateiname und Inhalt:

```
create_skill(
  name: "auev-generator",
  description: "...",
  content: "...",  # SKILL.md Body — verweist auf references/
  tools: '["rag_search", "create_document"]',
  references: '{"auev-vorlage.md": "# AUeV Vorlage\n## Struktur\n..."}'
)
```

### Schreibregeln

- **Beschreibung ist der Trigger**: Die `description` entscheidet ob der Skill geladen wird. Schreibe sie so, dass klar ist WANN der Skill genutzt werden soll. Lieber etwas "pushy" — der Agent soll den Skill eher zu oft als zu selten nutzen.
- **Imperativ verwenden**: "Suche mit rag_search", nicht "Du solltest rag_search nutzen"
- **Erklaere das Warum**: Statt "IMMER Quellen zitieren" lieber "Zitiere Quellen weil der User die Aussagen verifizieren koennen muss"
- **Unter 500 Zeilen SKILL.md**: Lagere Details in `references/` aus und verweise darauf
- **Referenzen klar benennen**: `references/vorlage.md` nicht `references/doc1.md`
- **Ausgabeformat definieren**: Zeige dem Skill wie das Ergebnis aussehen soll

### Verfuegbare Tools

| Tool | Zweck |
|------|-------|
| `rag_search` | Wissensdatenbank durchsuchen (Hybrid: Keyword + Semantisch) |
| `read_chunk` | Dokument-Chunks im Detail lesen |
| `graph_query` | Wissensgraph nach Entitaeten/Beziehungen durchsuchen |
| `sql_query` | Datenbank-Abfragen (nur SELECT) |
| `create_document` | Neues Dokument erstellen |
| `agent` | Subagent fuer Teilaufgaben delegieren |

### Erstellen

Schreibe einen Entwurf, lies ihn mit frischen Augen, verbessere ihn — dann `create_skill` aufrufen.

---

## Phase 4: A/B Testing — DAS IST PFLICHT

Sage dem User NIEMALS "Skill erfolgreich erstellt" ohne ihn vorher getestet zu haben. Ein ungetesteter Skill ist wertlos.

Nach dem Erstellen mit `create_skill` fuehrst du IMMER folgende Schritte aus:

### Schritt 1: Test-Prompt erstellen

Ueberlege einen realistischen Test-Prompt — was wuerde ein echter User sagen?

**Schlecht:** "Fasse ein Dokument zusammen"
**Gut:** "Ich hab den neuen Rahmenvertrag mit der Firma Mueller GmbH bekommen, kannst du den mal zusammenfassen? Besonders die Kuendigungsfristen interessieren mich."

### Schritt 2: A/B Test ausfuehren

```
compare_skill(prompt: "...", skill_slug: "der-slug")
```

Das Tool fuehrt automatisch zwei Subagents parallel aus (MIT Skill vs. OHNE Skill).

### Schritt 3: Ergebnis LESEN und BEWERTEN — bevor du antwortest

WARTE auf das compare_skill Ergebnis. Lies es vollstaendig. Bewerte:

1. **Hat die Skill-Version eine Antwort generiert?** Wenn "(Keine Antwort generiert)" → der Skill ist kaputt, du MUSST ihn fixen.
2. **Ist die Skill-Version besser als die Baseline?** Wenn die Baseline besser ist → der Skill muss verbessert werden.
3. **Werden die Expectations erfuellt?** Pruefe jedes Kriterium.

### Schritt 4: Bei Problemen — sofort fixen, NICHT dem User "fertig" sagen

Wenn der Test zeigt dass der Skill schlecht ist:
1. Analysiere WAS schief gelaufen ist (keine Antwort? Falsche Tools? Schlechte Instruktionen?)
2. Fixe den Skill mit `update_skill`
3. Fuehre `compare_skill` ERNEUT aus
4. Erst wenn der Skill besser ist als die Baseline → zeige dem User das Ergebnis

### Schritt 5: Dem User das Test-Ergebnis zeigen

Zeige dem User:
- Die Vergleichstabelle (Metriken)
- Die Antwort MIT Skill (Auszug)
- Die Antwort OHNE Skill (Auszug)
- Deine Einschaetzung: "Der Skill verbessert X, Y, Z gegenueber der Baseline"

Frage: "Passt das so, oder soll ich noch was verbessern?"

---

## Optionale vertiefte Bewertung mit Subagents

Nach dem Basis-Test stehen dir spezialisierte Subagents fuer gruendlichere Bewertung zur Verfuegung. Nutze sie wenn der Basis-Vergleich nicht eindeutig ist:

**1. Grader** — Bewertet Expectations:
```
agent(agentType: "skill-grader", task: "Bewerte folgende Antwort gegen diese Expectations:
Prompt: [test-prompt]
Antwort: [skill-output]
Expectations:
- [expectation 1]
- [expectation 2]
...")
```

**2. Blind-Comparator** — Objektiver A/B-Vergleich:
```
agent(agentType: "skill-comparator", task: "Vergleiche diese zwei Antworten auf denselben Prompt. Du weisst NICHT welche von einem Skill kommt.
Prompt: [test-prompt]
Antwort A: [eine der beiden]
Antwort B: [die andere]
Expectations: [...]")
```

Wichtig: Randomisiere welche Antwort A und welche B ist, damit kein Bias entsteht.

**3. Analyzer** — Erklaert warum einer besser war:
```
agent(agentType: "skill-analyzer", task: "Analysiere warum der Skill [gewonnen/verloren] hat.
Skill-Instruktionen: [skill content]
Antwort mit Skill: [output]
Antwort ohne Skill: [baseline]
Vergleichs-Begruendung: [comparator reasoning]")
```

### Wann welchen Subagent nutzen

| Situation | Subagent | Warum |
|-----------|----------|-------|
| Nach jedem compare_skill | **skill-grader** | Prueft ob Expectations erfuellt sind |
| Wenn unklar welcher besser ist | **skill-comparator** | Objektiver Blind-Vergleich |
| Wenn Skill verliert oder knapp gewinnt | **skill-analyzer** | Findet die Ursache + Verbesserungsvorschlaege |

Du musst nicht ALLE Subagents fuer jeden Test nutzen. Der Grader reicht oft. Comparator und Analyzer sind fuer schwierige Faelle.

---

## Phase 5: Verbessern — Auto-Fix ist PFLICHT bei Problemen

Wenn der A/B-Test Probleme zeigt, fixe sie SOFORT. Sage dem User NICHT "Skill erstellt" wenn der Test fehlschlaegt.

### Haeufigste Probleme und Fixes

**Problem: "Keine Antwort generiert" bei der Skill-Version**
Das passiert wenn der Subagent alle Steps fuer Tool-Calls verbraucht ohne eine Text-Antwort zu schreiben.
→ Fix: Fuege in den Skill-Instruktionen hinzu: "Du MUSST am Ende eine ausfuehrliche Text-Antwort schreiben. Deine letzte Aktion muss IMMER Text sein, KEIN Tool-Aufruf. Nutze maximal 4-5 Tool-Aufrufe, dann schreibe die Antwort."

**Problem: Baseline ist besser als Skill**
Der Skill macht die Antwort schlechter statt besser.
→ Fix: Analysiere den Vergleich. Oft sind die Instruktionen zu restriktiv oder zu komplex. Vereinfache sie. Entferne was nicht hilft.

**Problem: Skill nutzt keine Tools**
Der Skill antwortet aus dem Training statt die Wissensdatenbank zu nutzen.
→ Fix: Fuege explizit hinzu: "Nutze rag_search um in der Wissensdatenbank nach relevanten Dokumenten zu suchen."

**Problem: Keine Quellen zitiert**
→ Fix: Fuege hinzu: "Zitiere Quellen (Dokumentname, Seite) weil der User die Aussagen verifizieren koennen muss."

### Auto-Fix Ablauf

1. Problem im compare_skill Ergebnis erkennen
2. `update_skill` mit dem Fix aufrufen
3. `compare_skill` ERNEUT ausfuehren (gleicher Prompt)
4. Ergebnis pruefen — besser? Wenn nicht, nochmal fixen
5. Erst wenn der Skill die Baseline schlaegt oder gleichauf ist → dem User zeigen

### User-Feedback: Subjektive Qualitaet

Fuer diese Fragen brauchst du den User:
- Inhaltliche Qualitaet: "Ist die Zusammenfassung gut genug?"
- Format: "Soll es eine Tabelle oder Fliesstext sein?"
- Fehlende Aspekte: "Was fehlt noch?"
- Zufriedenheit: "Passt das so, oder soll ich noch was aendern?"

Leeres Feedback oder "passt" = User ist zufrieden. Konzentriere dich auf die Tests wo der User konkrete Kritik hat.

### Wie verbessern

**Generalisiere statt ueberfitten.** Der Skill wird viele Male mit verschiedenen Prompts genutzt. Du iterierst auf wenigen Beispielen weil es schneller geht. Aber wenn der Skill nur fuer diese 3 Test-Cases funktioniert, ist er nutzlos. Probiere verschiedene Formulierungen statt frickelige Spezialanpassungen.

**Halte es schlank.** Entferne was nicht hilft. Wenn der Agent im Test unproduktive Schritte macht, finde den Teil der Instruktionen der das verursacht und entferne ihn.

**Erklaere das Warum.** Wenn du "IMMER" oder "NIEMALS" in Grossbuchstaben schreiben willst, stopp. Erklaere stattdessen die Begruendung. Das Modell versteht Kontext besser als starre Regeln.

**Wiederholte Muster erkennen.** Wenn beide Subagents unabhaengig voneinander die gleichen Zwischenschritte machen, nimm diese Muster in die Instruktionen auf — das spart zukuenftige Ausfuehrungen.

### Iterations-Loop

1. Skill aktualisieren: `update_skill`
2. Tests erneut ausfuehren: `compare_skill` (gleiche Prompts)
3. Ergebnisse zeigen (vorher vs. nachher)
4. Auto-Fix oder User-Feedback
5. Wiederholen bis:
   - User sagt "passt" oder gibt kein Feedback mehr
   - Alle Tests zeigen Verbesserung gegenueber Baseline
   - Kein sinnvoller Fortschritt mehr moeglich

---

## Phase 6: Beschreibungs-Optimierung

Die `description` ist der Trigger-Mechanismus — sie bestimmt ob der Agent den Skill nutzt.

1. Generiere 10 Test-Queries:
   - 5 die den Skill ausloesen SOLLEN (verschiedene Formulierungen, formal + casual)
   - 5 die den Skill NICHT ausloesen sollen (aehnliche aber andere Aufgaben)
2. Zeige dem User zur Review
3. Optimiere die Beschreibung basierend auf dem Feedback
4. Aktualisiere mit `update_skill`

Gute should-NOT-trigger Queries sind **beinahe-Treffer** — Queries die aehnliche Keywords haben aber eigentlich etwas anderes brauchen. "Uebersetze den Vertrag" sollte keinen Vertrags-Analyse-Skill ausloesen.

---

## Kommunikation mit dem User

Achte auf den Wissensstand des Users. Nicht jeder kennt technische Begriffe:
- "Evaluation" und "Benchmark" sind OK
- "JSON", "Assertion", "Token" kurz erklaeren wenn du unsicher bist
- Im Zweifel: kurze Erklaerung ("Tokens sind die Texteinheiten die das Modell verarbeitet — je weniger, desto schneller und guenstiger")

Sei effizient: Wenn der User sagt "mach einfach", vertraue deinem Urteil und iteriere ohne lange Rueckfragen.

---

## Referenzen

### Subagents (via agent-Tool)

| Agent | Zweck | Wann nutzen |
|-------|-------|-------------|
| `skill-grader` | Bewertet Output gegen Expectations | Nach jedem compare_skill |
| `skill-comparator` | Blinder A/B-Vergleich | Wenn unklar welcher besser ist |
| `skill-analyzer` | Analysiert WARUM einer besser war | Wenn Skill verliert oder knapp gewinnt |

### Referenz-Dateien

Das `references/` Verzeichnis enthaelt zusaetzliche Dokumentation:

- `references/schemas.md` — JSON-Schemas fuer evals.json, grading.json, comparison.json, analysis.json
