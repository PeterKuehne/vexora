---
name: skill-creator
description: >-
  Erstellt, testet und verbessert Skills iterativ mit automatisierten
  Sub-Agent-Tests. Nutze diesen Skill wenn der User sagt 'erstelle einen Skill',
  'neuen Skill anlegen', 'Skill bauen', 'Workflow automatisieren', 'Skill
  verbessern', 'Skill testen', oder einen wiederholbaren Prozess beschreibt den
  er als Skill speichern möchte. Auch verwenden wenn der User sagt 'mach daraus
  einen Skill', 'das will ich öfter machen', oder 'kannst du das als Vorlage
  speichern'. NICHT verwenden bei: einmaligen Aufgaben die kein Skill sein
  müssen, reiner Dokumentensuche, oder wenn der User nur eine Frage hat.
allowed-tools: create_skill update_skill load_skill list_skills run_skill_test
metadata:
  version: "4.0.0"
  category: meta
  tags: meta automatisierung skill-erstellung evaluation
---

# Skill Creator

Erstelle, teste und verbessere Skills mit automatisierten Sub-Agent-Tests.

## Überblick

Der Prozess auf einen Blick:

1. Verstehe was der Skill tun soll
2. Schreibe einen Entwurf
3. Teste ihn mit Sub-Agenten (mit UND ohne Skill)
4. Zeige dem User die Ergebnisse, sammle Feedback
5. Verbessere den Skill basierend auf dem Feedback
6. Wiederhole bis der User zufrieden ist
7. Optimiere die Description für besseres Triggering

Finde heraus wo der User im Prozess steht und hilf von dort aus weiter. Vielleicht will er einen neuen Skill, vielleicht hat er schon einen Entwurf, vielleicht will er einen bestehenden verbessern. Sei flexibel — wenn der User sagt "keine Evaluation nötig, einfach bauen", dann mach das.

## Kommunikation

Achte auf Kontext-Signale um den richtigen Ton zu treffen. Manche User sind erfahrene Entwickler, andere nutzen das System zum ersten Mal.

- Fachbegriffe wie "Evaluation" oder "Benchmark" sind OK, aber "JSON-Array" oder "Assertion" nur verwenden wenn der User selbst technisch kommuniziert
- Im Zweifel: kurz erklären statt voraussetzen
- Antworte auf Deutsch
- Sei geduldig und flexibel

## Phase 1: Intent erfassen

Die aktuelle Konversation enthält möglicherweise bereits einen Workflow den der User als Skill speichern möchte (z.B. "mach daraus einen Skill"). Wenn ja, extrahiere zuerst aus dem bisherigen Verlauf:
- Welche Tools wurden genutzt und in welcher Reihenfolge?
- Welche Korrekturen hat der User gemacht?
- Welche Input/Output-Formate wurden verwendet?

Der User muss eventuell Lücken füllen — lass ihn bestätigen bevor du weitermachst.

Kläre mit dem User:
- Was soll der Skill ermöglichen?
- Wann soll er ausgelöst werden? (welche Phrasen/Kontexte)
- Was ist das erwartete Ausgabeformat?
- Sollen wir Test-Cases aufsetzen um den Skill zu prüfen? Skills mit objektiv prüfbarem Output (Datenextraktion, strukturierte Reports, feste Workflows) profitieren davon. Skills mit subjektivem Output (Schreibstil, kreative Texte) oft nicht. Schlage den passenden Default vor, aber lass den User entscheiden.

## Phase 2: Interview und Recherche

Frage proaktiv nach:
- Edge Cases (Was passiert wenn keine Ergebnisse gefunden werden?)
- Input/Output-Formate und Beispiele
- Erfolgskriterien (wann ist das Ergebnis gut?)
- Abhängigkeiten (welche Tools werden gebraucht?)

Warte mit dem Schreiben bis diese Phase abgeschlossen ist.

## Phase 3: Skill schreiben

### Anatomie eines Skills

```
skill-name/
├── SKILL.md              # Pflicht — YAML Frontmatter + Markdown Body
└── references/            # Optional — Doku die bei Bedarf geladen wird
    └── beispiel.md
```

Skills nutzen drei Ebenen (Progressive Disclosure):
1. **Metadaten** (name + description) — Immer im Kontext (~100 Wörter)
2. **SKILL.md Body** — Wird geladen wenn der Skill triggert (unter 500 Zeilen halten)
3. **References** — Bei Bedarf einzeln geladen (unbegrenzt)

Wenn ein Skill länger als 500 Zeilen wird: Detail-Dokumentation in `references/` auslagern und aus der SKILL.md klar verlinken mit Hinweis wann die Datei gelesen werden soll.

### Die Description — das Wichtigste

Die Description bestimmt ob der Agent den Skill lädt. Sie ist der primäre Trigger-Mechanismus. Alle "wann verwenden"-Infos gehören hierhin, nicht in den Body.

Struktur: `[Was er tut]. Nutze diesen Skill wenn der User [Trigger-Phrasen]. [Kernfähigkeiten].`

**Beispiel (gut):**
"Analysiert Verträge und identifiziert Risiken, Fristen und Pflichten. Nutze diesen Skill wenn der User 'Vertrag prüfen', 'Vertragsanalyse', 'Risiken im Vertrag', 'Vertragsbedingungen' sagt oder ein Vertragsdokument analysieren möchte, auch wenn er nicht explizit 'Vertragsanalyse' sagt. Erstellt strukturierte Reports mit Risiko-Bewertung."

**Beispiel (schlecht):**
"Hilft bei Dokumenten." (Zu vage, keine Trigger-Phrasen)

Die Tendenz ist dass Skills zu selten getriggert werden. Formuliere die Description etwas "pushiger" — lieber einmal zu viel triggern als ein Mal zu wenig.

### Instruktionen schreiben

- **Imperativ verwenden**: "Durchsuche die Wissensdatenbank" statt "Du solltest durchsuchen"
- **Erkläre das Warum**: Statt "MUSS immer rag_search nutzen" besser "Nutze rag_search weil die Antwort auf Dokumenten basieren soll, nicht auf Vorwissen — das stellt sicher dass die Informationen aktuell und belegt sind." LLMs haben ein gutes Verständnis für Kontext und Motivation. Wenn du erklärst warum etwas wichtig ist, kann das Modell in Randfällen besser entscheiden als mit starren Regeln.
- **Struktur**: `##` für Hauptschritte, `###` für Unterpunkte
- **Beispiele einbauen**: Zeige konkrete Eingabe → Ausgabe Paare. Zum Beispiel:

```
## Ausgabeformat
**Beispiel:**
Eingabe: "Fasse den Vertrag mit der Firma XY zusammen"
Ausgabe:
# Vertragszusammenfassung: Firma XY
## Kernpunkte
- Laufzeit: 24 Monate ab 01.01.2026
...
```

- **Fehlerbehandlung**: Was tun wenn keine Ergebnisse gefunden werden?
- **Qualitätskriterien**: Wann ist das Ergebnis gut genug?
- **Schlank halten**: Jede Zeile in der Instruktion muss ihren Platz verdienen. Wenn etwas nicht hilft, raus damit.

### Ausgabeformate definieren

Wenn der Skill ein bestimmtes Ausgabeformat haben soll, zeige ein konkretes Template:

```
## Report-Struktur
Verwende dieses Template:
# [Titel]
## Zusammenfassung
## Kernerkenntnisse
## Empfehlungen
```

### Verfügbare Tools für Skills

- `rag_search` — Dokumentensuche (hybrid: keyword + semantisch)
- `read_chunk` — Chunk-Details mit Kontext-Erweiterung
- `graph_query` — Graph-DB für Entitäten und Beziehungen
- `sql_query` — SQL-Abfragen (nur SELECT)
- `create_document` — Dokumente im Wissensspeicher erstellen
- `send_notification` — Benachrichtigungen senden

### Ergebnis sichern

Wenn ein Skill Ergebnisse produziert (Reports, Analysen, Zusammenfassungen), füge als letzten Schritt hinzu:

```
## Letzter Schritt: Ergebnis sichern
Frage den User: "Soll ich das Ergebnis im Wissensspeicher ablegen?"
- Ja → Nutze `create_document` mit dem Ergebnis als Inhalt
- Nein → Aufgabe beenden
```

Füge in dem Fall `create_document` zur Tool-Liste hinzu.

### Skill erstellen

Schreibe einen Entwurf, lies ihn nochmal mit frischen Augen, verbessere ihn — dann erstelle ihn mit `create_skill`.

## Phase 4: Testen mit Sub-Agenten

Das ist das Herzstück. Nach dem Erstellen:

### Test-Prompts definieren

Überlege 2-3 realistische Test-Prompts — was würde ein echter User sagen? Nicht abstrakt, sondern konkret mit Details und Kontext.

**Schlecht:** "Fasse ein Dokument zusammen"
**Gut:** "Ich hab letzte Woche den neuen Rahmenvertrag mit der Firma Müller GmbH bekommen, kannst du den mal zusammenfassen? Besonders die Kündigungsfristen interessieren mich."

Teile die Test-Cases mit dem User: "Hier sind ein paar Test-Fälle die ich ausprobieren möchte. Passen die, oder willst du andere hinzufügen?"

### Tests ausführen

Für jeden Test-Prompt zwei `run_skill_test` Aufrufe machen — beides im selben Schritt starten damit die Ergebnisse etwa gleichzeitig fertig sind:

1. **Mit Skill**: `run_skill_test(prompt: "...", skill_slug: "der-skill-slug")`
2. **Ohne Skill (Baseline)**: `run_skill_test(prompt: "...")` (kein skill_slug)

Der direkte Vergleich zeigt: Was macht der Skill besser (oder schlechter) als der Agent ohne Skill?

### Ergebnisse präsentieren

Zeige dem User für jeden Test-Prompt:
- Die Antwort **mit** Skill
- Die Antwort **ohne** Skill
- Metriken: Dauer, Steps, Tokens, genutzte Tools
- Deine Einschätzung was besser oder schlechter ist

Frage nach Feedback zu jedem Ergebnis. Leeres Feedback bedeutet: der User fand es OK. Konzentriere dich bei der Verbesserung auf die Test-Cases wo der User konkrete Kritik hatte.

## Phase 5: Verbessern

Das ist der wichtigste Teil. Du hast die Tests ausgeführt, der User hat Feedback gegeben — jetzt den Skill besser machen.

### Wie verbessern

**Generalisiere statt überfitten.** Der Skill wird tausendmal mit verschiedenen Prompts genutzt. Hier iterierst du auf wenigen Beispielen weil es schneller geht und der User sie kennt. Aber wenn der Skill nur für diese 3 Test-Cases funktioniert, ist er nutzlos. Statt frickelige Spezialanpassungen lieber andere Formulierungen oder Ansätze ausprobieren — das ist billig und bringt manchmal überraschend viel.

**Halte es schlank.** Entferne was nicht hilft. Lies die Test-Transkripte (nicht nur die Endergebnisse) — wenn der Agent unproduktive Schritte macht, finde die Teile der Instruktion die das verursachen und entferne sie.

**Erkläre das Warum.** Wenn du dich dabei ertappst "IMMER" oder "NIEMALS" in Großbuchstaben zu schreiben, ist das ein Warnsignal. Formuliere stattdessen um und erkläre die Begründung. Das Modell versteht Kontext besser als starre Regeln, und es kann in Randfällen eigenständig gute Entscheidungen treffen.

**Wiederholte Muster erkennen.** Lies die Transkripte aller Test-Runs. Wenn alle Sub-Agenten unabhängig voneinander die gleichen Zwischenschritte machen oder die gleichen Helfer-Strategien entwickeln, nimm diese Muster in die Instruktionen auf — das spart jeder zukünftigen Ausführung die Arbeit.

**Verstehe was der User wirklich will.** Selbst wenn das Feedback knapp oder frustriert ist — versuche wirklich zu verstehen was die Aufgabe erfordert, warum der User das geschrieben hat, und was er eigentlich meint. Übertrage dieses Verständnis in die Instruktionen.

### Der Iterations-Loop

Nach dem Verbessern:
1. Skill aktualisieren mit `update_skill`
2. Alle Tests erneut ausführen (gleiche Prompts)
3. Ergebnisse dem User zeigen
4. Feedback einholen
5. Weiter verbessern oder fertig

Aufhören wenn:
- Der User zufrieden ist
- Das Feedback leer ist (alles sieht gut aus)
- Kein sinnvoller Fortschritt mehr erkennbar

## Phase 6: Description optimieren

Nach dem Erstellen/Verbessern die Trigger-Treffsicherheit der Description optimieren.

### Schritt 1: Trigger-Eval-Queries erstellen

Erstelle 20 Eval-Queries — eine Mischung aus should-trigger und should-not-trigger.

**Für should-trigger (10 Queries):** Verschiedene Formulierungen des gleichen Intents. Formell und umgangssprachlich gemischt. Fälle wo der User den Skill nicht beim Namen nennt aber ihn braucht. Auch ungewöhnliche Anwendungsfälle und Fälle wo der Skill gegen einen anderen konkurriert aber gewinnen sollte.

**Für should-not-trigger (10 Queries):** Die wertvollsten sind Beinahe-Treffer — Queries die Keywords mit dem Skill teilen aber eigentlich etwas anderes brauchen. Angrenzende Themen wo ein anderer Ansatz besser wäre. Mehrdeutige Formulierungen wo ein naiver Keyword-Match triggern würde aber nicht sollte.

Wichtig: Die should-not-trigger Queries müssen wirklich knifflig sein. "Was ist 2+2?" als Negativ-Test für einen Recherche-Skill testet nichts — das ist offensichtlich irrelevant. Die Negativ-Fälle müssen echt schwierig sein.

Die Queries müssen realistisch sein — so wie echte User schreiben. Nicht abstrakt sondern konkret mit Details, Dateinamen, persönlichem Kontext. Manche in Kleinschreibung, manche mit Tippfehlern, manche casual.

### Schritt 2: Review mit dem User

Präsentiere die Eval-Queries dem User. Dieser Schritt ist wichtig — schlechte Queries führen zu schlechten Descriptions.

### Schritt 3: Description verbessern

Prüfe ob die aktuelle Description alle should-trigger Fälle abdeckt. Wenn nicht, formuliere die Description um und aktualisiere mit `update_skill`.

Zeige dem User Vorher/Nachher und erkläre was sich geändert hat.

## Bestehenden Skill verbessern

Wenn der User einen bestehenden Skill verbessern will:

1. Lade den Skill mit `load_skill` um den aktuellen Stand zu sehen
2. Frage was verbessert werden soll
3. Teste den aktuellen Stand mit `run_skill_test` (Baseline = aktuelle Version)
4. Verbessere mit `update_skill`
5. Teste erneut und vergleiche gegen die alte Version
