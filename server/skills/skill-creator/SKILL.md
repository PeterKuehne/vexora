---
name: skill-creator
description: Create new skills, modify and improve existing skills, and measure skill
  performance. Use when users want to create a skill from scratch, edit or optimize
  an existing skill, run evals to test a skill, benchmark skill performance, or optimize
  a skill's description for better triggering accuracy. Nutze diesen Skill wenn der
  User sagt 'erstelle einen Skill', 'Skill bauen', 'Skill verbessern', 'Skill testen',
  'Workflow automatisieren', oder einen wiederholbaren Prozess beschreibt.
allowed-tools: create_skill update_skill compare_skill load_skill list_skills agent list_agents run_script
---

# Skill Creator

Ein Skill zum Erstellen neuer Skills und deren iterativer Verbesserung.

Auf hoher Ebene geht das so:

- Entscheide was der Skill tun soll und grob wie
- Schreibe einen Entwurf
- Erstelle Test-Prompts und fuehre den Skill mit A/B-Vergleich aus
- Hilf dem User die Ergebnisse qualitativ und quantitativ zu bewerten
  - Waehrend die Tests laufen, entwerfe quantitative Expectations (Assertions)
  - Nutze `run_script(aggregate_benchmark.py)` um die Ergebnisse zu aggregieren
- Ueberarbeite den Skill basierend auf Feedback und Benchmark-Ergebnissen
- Wiederhole bis zufriedenstellend
- Erweitere die Test-Suite und teste nochmal in groesserem Umfang

Dein Job ist herauszufinden wo der User im Prozess steht und ihm beim naechsten Schritt zu helfen. Vielleicht sagt er "Ich will einen Skill fuer X". Du hilfst beim Eingrenzen, schreibst einen Entwurf, erstellst Tests, und iterierst.

Vielleicht hat er schon einen Entwurf. Dann spring direkt zum Eval/Iterate-Teil.

Sei flexibel — wenn der User sagt "Ich brauch keine aufwaendigen Evaluations, lass uns einfach loslegen", mach das stattdessen.

Nach dem Skill (aber die Reihenfolge ist flexibel) kannst du auch den Description-Optimizer laufen lassen um das Triggering zu verbessern.

## Kommunikation mit dem User

Der Skill Creator wird von Menschen mit unterschiedlichem technischem Hintergrund genutzt. Achte auf Kontext-Hinweise:

- "Evaluation" und "Benchmark" sind grenzwertig, aber OK
- Bei "JSON" und "Assertion" willst du klare Signale vom User sehen dass er weiss was das ist, bevor du sie ohne Erklaerung verwendest
- Im Zweifel: kurz erklaeren ("Tokens sind die Texteinheiten die das Modell verarbeitet — je weniger, desto schneller und guenstiger")

---

## Einen Skill erstellen

### Intent erfassen

Verstehe zuerst was der User will. Vielleicht enthaelt das Gespraech schon einen Workflow den er als Skill haben will (z.B. "mach das was wir gerade gemacht haben als Skill"). Wenn ja, extrahiere die Antworten aus dem Verlauf — die genutzten Tools, die Schrittfolge, Korrekturen die der User gemacht hat, beobachtete Ein-/Ausgabeformate. Der User muss Luecken fuellen und bestaetigen bevor du weitergehst.

1. Was soll der Skill ermoeglichen?
2. Wann soll er triggern? (welche User-Phrasen/Kontexte)
3. Welches Ausgabeformat wird erwartet?
4. Brauchen wir Test-Cases? Skills mit objektiv verifizierbaren Outputs (Datentransformation, Extraktion, feste Workflow-Schritte) profitieren von Tests. Skills mit subjektiven Outputs (Schreibstil, Design) brauchen oft keine. Schlage den passenden Default vor, aber lass den User entscheiden.

### Interview und Recherche

Frage proaktiv nach Edge Cases, Ein-/Ausgabeformaten, Beispieldateien, Erfolgskriterien und Abhaengigkeiten. Warte mit dem Schreiben der Test-Prompts bis das geklaert ist.

Durchsuche die Wissensdatenbank mit `rag_search` — gibt es verwandte Dokumente, Vorlagen oder bestehende Skills die als Referenz dienen koennten? Wenn ja, nutze sie als Grundlage.

### SKILL.md schreiben

Basierend auf dem Interview, fulle diese Komponenten:

- **name**: Skill-Bezeichner (kebab-case)
- **description**: Wann triggern, was es tut. Das ist der primaere Trigger-Mechanismus — enthaelt SOWOHL was der Skill tut ALS AUCH spezifische Kontexte wann er genutzt werden soll. Alle "wann nutzen" Infos gehoeren hierher, nicht in den Body. Hinweis: Der Agent hat eine Tendenz Skills zu selten zu nutzen. Mache die Beschreibung etwas "pushy". Statt "Erstellt AUeV-Vertraege" lieber "Erstellt AUeV-Vertraege fuer die samaritano GmbH. Nutze diesen Skill immer wenn der User Vertraege, AUeV, Personalueberlassung, Arbeitnehmerueberlassung oder aehnliches erwaehnt."
- **allowed-tools**: Welche Tools der Skill nutzen darf
- **der Rest des Skills :)**

### Skill Writing Guide

#### Anatomie eines Skills

```
skill-name/
├── SKILL.md (Pflicht)
│   ├── YAML Frontmatter (name, description Pflicht)
│   └── Markdown Instruktionen
└── Gebundene Ressourcen (optional)
    ├── scripts/    - Ausfuehrbarer Code (Python via uv run)
    ├── references/ - Dokumentation, on demand geladen
    └── assets/     - Templates, Vorlagen, Icons
```

#### Progressive Disclosure

Skills nutzen ein 3-stufiges Ladesystem:
1. **Metadaten** (name + description) — Immer im Kontext (~100 Woerter)
2. **SKILL.md Body** — Im Kontext wenn der Skill triggert (<500 Zeilen ideal)
3. **Gebundene Ressourcen** — Bei Bedarf (unbegrenzt, Scripts koennen ausgefuehrt werden ohne geladen zu werden)

**Wichtige Patterns:**
- Halte SKILL.md unter 500 Zeilen. Wenn du dich dem Limit naeherst, lagere Details in `references/` aus mit klaren Verweisen wann sie gelesen werden sollen
- Referenziere Dateien klar: "Vor dem Generieren, lies `references/vorlage.md` fuer die Vertragsstruktur"
- Bei grossen Referenzdateien (>300 Zeilen): Inhaltsverzeichnis einbauen

**Domain-Organisation** — Wenn ein Skill mehrere Varianten unterstuetzt:
```
vertrag-generator/
├── SKILL.md (Workflow + Auswahl)
└── references/
    ├── auev-vorlage.md
    ├── rahmenvertrag-vorlage.md
    └── arbeitsvertrag-vorlage.md
```
Der Agent liest nur die relevante Referenzdatei.

#### Schreibmuster

Bevorzuge den Imperativ: "Suche mit rag_search" statt "Du solltest rag_search nutzen".

**Ausgabeformate definieren:**
```markdown
## Vertragsstruktur
Nutze IMMER dieses Template:
# [Titel]
## Praeambel
## § 1 Vertragsgegenstand
## § 2 Laufzeit
```

**Beispiele einbauen:**
```markdown
## Eingabeformat
**Beispiel 1:**
Input: Erstelle AUeV fuer Thomas Schmidt, Anaesthesiepflege, Klinikum Minden
Output: Vollstaendiger AUeV-Vertrag mit allen 12 Paragraphen
```

#### Schreibstil

Erklaere dem Modell WARUM Dinge wichtig sind statt schwerfaellige MUSS-Regeln. Nutze Theory of Mind und mache den Skill allgemein, nicht super-eng auf spezifische Beispiele. Schreibe einen Entwurf, dann lies ihn mit frischen Augen und verbessere ihn.

### Test-Cases definieren

Nach dem Skill-Entwurf: Ueberlege 2-3 realistische Test-Prompts — was wuerde ein echter User sagen? Teile sie mit dem User: "Hier sind Test-Faelle die ich ausprobieren moechte. Passen die, oder willst du andere?" Dann fuehre sie aus.

Definiere die Tests als evals-Struktur. Schreibe noch keine Assertions — nur die Prompts. Die Assertions entwirfst du im naechsten Schritt waehrend die Tests laufen.

```json
{
  "skill_name": "auev-generator",
  "evals": [
    {
      "id": 1,
      "prompt": "Erstelle AUeV fuer Thomas Schmidt, Anaesthesiepflege, Klinikum Minden",
      "expected_output": "Vollstaendiger Vertrag mit allen 12 Paragraphen"
    }
  ]
}
```

Siehe `references/schemas.md` fuer das vollstaendige Schema (inkl. expectations/assertions die du spaeter hinzufuegst).

---

## Tests ausfuehren und auswerten

Dieser Abschnitt ist eine zusammenhaengende Sequenz — halte nicht mittendrin an.

### Schritt 1: Alle Tests gleichzeitig starten (mit Skill UND Baseline)

Fuer jeden Test-Case:
```
compare_skill(prompt: "...", skill_slug: "der-slug")
```

Das Tool fuehrt automatisch beide Varianten parallel aus (MIT Skill + OHNE Skill) und liefert eine strukturierte Vergleichstabelle.

Wenn du mehrere Test-Cases hast, fuehre sie nacheinander aus. Jeder `compare_skill` Aufruf liefert sein eigenes Ergebnis.

### Schritt 2: Waehrend die Tests laufen, Assertions entwerfen

Warte nicht einfach auf die Ergebnisse — nutze die Zeit produktiv. Entwerfe quantitative Assertions fuer jeden Test-Case und erklaere sie dem User.

Gute Assertions sind objektiv verifizierbar und haben beschreibende Namen — sie sollen beim Ueberfliegen sofort klar machen was sie pruefen. Subjektive Skills (Schreibstil, Design) werden besser qualitativ bewertet — zwinge keine Assertions auf Dinge die menschliches Urteil brauchen.

Beispiel Assertions fuer einen AUeV-Generator:
- "Die Antwort enthaelt alle 12 Paragraphen (§1 bis §12)"
- "Die Vertragsparteien werden korrekt genannt"
- "Die Personaldaten der ueberlassenen Arbeitskraft sind ausgefuellt"
- "Zuschlagstabelle ist vorhanden (Nacht, Sonntag, Feiertag)"
- "Quellen aus der Wissensdatenbank werden zitiert"

### Schritt 3: Ergebnis LESEN — bevor du antwortest

WARTE auf das compare_skill Ergebnis. Lies es vollstaendig. Bewerte:

1. **Hat die Skill-Version eine Antwort generiert?** Wenn "(Keine Antwort generiert)" → der Skill ist kaputt.
2. **Ist die Skill-Version besser als die Baseline?** Wenn die Baseline besser ist → der Skill muss verbessert werden.
3. **Werden die Expectations erfuellt?**

Sage dem User NIEMALS "Skill erfolgreich erstellt" wenn der Test fehlschlaegt.

### Schritt 4: Bewerten, Aggregieren, Berichten

Sobald alle Tests fertig sind:

1. **Bewertung mit Grader-Subagent** — fuer gruendliche Analyse:
   ```
   agent(agentType: "skill-grader", task: "Bewerte folgende Antwort:
   Prompt: [test-prompt]
   Antwort: [skill-output]
   Expectations:
   - [expectation 1]
   - [expectation 2]")
   ```

2. **Benchmark aggregieren** — wenn mehrere Tests gelaufen sind:
   ```
   run_script(script: "aggregate_benchmark.py", skill_slug: "skill-creator",
     args: "--skill-name auev-generator",
     input: "[{compare_skill_metadata_1}, {compare_skill_metadata_2}]")
   ```
   Das erzeugt Statistiken mit pass_rate, Zeit und Tokens pro Konfiguration inkl. Deltas. Siehe `references/schemas.md` fuer das exakte Schema.

3. **Analyst-Pass** — lies die Benchmark-Daten und suche Muster die die aggregierten Statistiken verbergen. Nutze den `skill-analyzer` Subagent fuer Details. Achte auf:
   - Assertions die immer passen egal ob mit oder ohne Skill (nicht-differenzierend)
   - Hohe Varianz (moeglicherweise instabiler Test)
   - Zeit/Token-Tradeoffs

4. **Report generieren:**
   ```
   run_script(script: "generate_report.py", skill_slug: "skill-creator",
     input: "{benchmark.json Inhalt}")
   ```
   Zeige dem User den Report im Chat.

### Schritt 5: User-Feedback einholen

Zeige dem User fuer jeden Test:
- Die Vergleichstabelle (Metriken)
- Die Antwort MIT Skill (Auszug)
- Die Antwort OHNE Skill (Auszug)
- Deine Einschaetzung

Frage: "Wie sieht das aus? Feedback zu einzelnen Tests?"

Leeres Feedback oder "passt" bedeutet der User fand es OK. Konzentriere deine Verbesserungen auf Tests wo der User konkrete Kritik hatte.

---

## Skill verbessern

Das ist der wichtigste Teil. Du hast Tests ausgefuehrt, der User hat reviewed — jetzt den Skill besser machen.

### Wie ueber Verbesserungen nachdenken

**Generalisiere statt ueberfitten.** Der Skill wird viele Male mit verschiedenen Prompts genutzt. Du iterierst auf wenigen Beispielen weil es schneller geht. Aber wenn der Skill nur fuer diese 3 Test-Cases funktioniert, ist er nutzlos. Statt frickelige Spezialanpassungen lieber andere Formulierungen oder Ansaetze ausprobieren — das ist billig und bringt manchmal ueberraschend viel.

**Halte es schlank.** Entferne was nicht hilft. Lies die Test-Ergebnisse (nicht nur die Endantworten) — wenn der Agent unproduktive Schritte macht, finde die Teile der Instruktion die das verursachen und entferne sie.

**Erklaere das Warum.** Wenn du dich dabei ertappst "IMMER" oder "NIEMALS" in Grossbuchstaben zu schreiben, ist das ein Warnsignal. Formuliere stattdessen um und erklaere die Begruendung. Das Modell versteht Kontext besser als starre Regeln, und es kann in Randfaellen eigenstaendig gute Entscheidungen treffen.

**Wiederholte Muster erkennen.** Wenn beide Subagents (mit und ohne Skill) unabhaengig voneinander die gleichen Zwischenschritte machen, nimm diese Muster in die Instruktionen auf — das spart jeder zukuenftigen Ausfuehrung die Arbeit.

**Verstehe was der User wirklich will.** Selbst wenn das Feedback knapp oder frustriert ist — versuche wirklich zu verstehen was die Aufgabe erfordert, warum der User das geschrieben hat, und was er eigentlich meint. Uebertrage dieses Verstaendnis in die Instruktionen.

### Auto-Fix bei offensichtlichen Problemen

Wenn du eines dieser Probleme erkennst, fixe es sofort ohne zu fragen:

| Problem | Fix |
|---------|-----|
| "Keine Antwort generiert" | Fuege hinzu: "Du MUSST am Ende eine Text-Antwort schreiben. Nutze max 4-5 Tool-Aufrufe, dann schreibe die Antwort." |
| Baseline besser als Skill | Analysiere mit skill-analyzer Subagent. Oft sind Instruktionen zu restriktiv — vereinfache sie. |
| Skill nutzt keine Tools | Fuege explizit hinzu: "Nutze rag_search um relevante Dokumente zu finden." |
| Keine Quellen zitiert | Fuege hinzu: "Zitiere Quellen (Dokumentname, Seite) weil der User die Aussagen verifizieren koennen muss." |
| Daten aus dem Prompt nicht uebernommen | Fuege hinzu: "Uebernimm ALLE Daten aus dem User-Prompt in den Output. Ersetze keine Daten durch Platzhalter." |

Nach dem Fix: `update_skill` → `compare_skill` erneut → Ergebnis zeigen.

### Der Iterations-Loop

1. Skill aktualisieren: `update_skill`
2. Tests erneut ausfuehren: `compare_skill` (gleiche Prompts)
3. Ergebnisse zeigen (vorher vs. nachher)
4. Auto-Fix oder User-Feedback
5. Wiederholen bis:
   - User sagt "passt" oder gibt kein Feedback mehr
   - Alle Tests zeigen Verbesserung gegenueber Baseline
   - Kein sinnvoller Fortschritt mehr moeglich

---

## Fortgeschritten: Blinder Vergleich

Fuer Situationen wo du einen rigoroseren Vergleich brauchst (z.B. der User fragt "Ist die neue Version wirklich besser?"), nutze den Blind-Comparator:

```
agent(agentType: "skill-comparator", task: "Vergleiche diese zwei Antworten.
Du weisst NICHT welche von einem Skill kommt.
Prompt: [test-prompt]
Antwort A: [eine der beiden]
Antwort B: [die andere]
Expectations: [...]")
```

Wichtig: Randomisiere welche Antwort A und welche B ist, damit kein Bias entsteht.

Danach den Analyzer fuer die Erklaerung:
```
agent(agentType: "skill-analyzer", task: "Analysiere warum [Gewinner] besser war.
Skill-Instruktionen: [...]
Antwort mit Skill: [...]
Antwort ohne Skill: [...]
Begruendung des Comparators: [...]")
```

Das ist optional und die meisten User brauchen es nicht. Der normale A/B-Test via `compare_skill` reicht meistens.

---

## Beschreibungs-Optimierung

Die `description` im Frontmatter ist der primaere Mechanismus der bestimmt ob der Agent den Skill laedt. Nach dem Erstellen oder Verbessern eines Skills, biete an die Beschreibung zu optimieren.

### Schritt 1: Trigger-Eval-Queries generieren

Erstelle 10 Eval-Queries — eine Mischung aus should-trigger und should-NOT-trigger:

```json
[
  {"query": "Erstelle einen AUeV-Vertrag fuer Anna Mueller", "should_trigger": true},
  {"query": "Ich brauche eine Personalueberlassungsvereinbarung", "should_trigger": true},
  {"query": "Uebersetze den Vertrag auf Englisch", "should_trigger": false},
  {"query": "Was steht im Arbeitsrecht ueber Kuendigungsfristen?", "should_trigger": false}
]
```

Die Queries muessen realistisch sein — wie ein echter User tippen wuerde. Nicht abstrakt, sondern konkret mit Details.

Fuer Should-Trigger-Queries (5-6): verschiedene Formulierungen, formal + casual, ungewoehnliche Use Cases.
Fuer Should-NOT-Trigger-Queries (4-5): die wertvollsten sind **beinahe-Treffer** — Queries die aehnliche Keywords teilen aber eigentlich etwas anderes brauchen.

### Schritt 2: Mit User reviewen

Zeige dem User die Queries und frage ob sie passen.

### Schritt 3: Analyse laufen lassen

```
run_script(script: "improve_description.py", skill_slug: "skill-creator",
  input: '{"description": "aktuelle Beschreibung...", "queries": [...]}')
```

Das Script analysiert Keyword-Overlap und gibt Score + Verbesserungsvorschlaege zurueck.

### Schritt 4: Ergebnis anwenden

Nimm die `improved_description` aus dem Script-Output und aktualisiere den Skill mit `update_skill`. Zeige dem User vorher/nachher und berichte die Scores.

### Wie Skill-Triggering funktioniert

Skills erscheinen in der `available_skills` Liste des Agents mit Name + Description. Der Agent entscheidet basierend auf der Description ob er den Skill laedt. Wichtig: Der Agent laedt Skills nur fuer Aufgaben die er nicht einfach selbst erledigen kann — simple Ein-Schritt-Anfragen triggern Skills moeglicherweise nicht, egal wie gut die Description ist.

Das bedeutet: Eval-Queries sollten substantiell genug sein dass der Agent tatsaechlich von einem Skill profitieren wuerde.

---

## Referenz-Dateien

Das `agents/` Verzeichnis (server/agents/) enthaelt Instruktionen fuer spezialisierte Subagents:

- `skill-grader` — Bewertet Assertions gegen Outputs mit Evidenz
- `skill-comparator` — Blinder A/B-Vergleich ohne Bias
- `skill-analyzer` — Analysiert warum eine Version besser war

Das `references/` Verzeichnis enthaelt zusaetzliche Dokumentation:

- `references/schemas.md` — JSON-Schemas fuer evals.json, grading.json, benchmark.json, etc.

Das `scripts/` Verzeichnis enthaelt ausfuehrbare Python-Scripts (via `run_script` Tool):

- `scripts/quick_validate.py` — Validiert SKILL.md Struktur
- `scripts/aggregate_benchmark.py` — Aggregiert Test-Ergebnisse zu benchmark.json
- `scripts/generate_report.py` — Generiert Markdown-Report aus Benchmark-Daten
- `scripts/improve_description.py` — Analysiert und verbessert Skill-Beschreibungen

---

Der Kern-Loop nochmal zur Betonung:

1. Verstehe was der Skill tun soll
2. Schreibe oder bearbeite den Skill
3. Teste mit `compare_skill` (A/B Vergleich)
4. Bewerte mit Subagents und Scripts
5. Verbessere basierend auf Ergebnissen und User-Feedback
6. Wiederhole bis zufrieden
