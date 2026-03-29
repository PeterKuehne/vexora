# JSON Schemas

Definiert die JSON-Strukturen die vom Skill-Creator verwendet werden.

---

## evals.json

Definiert die Test-Cases fuer einen Skill. Wird vor dem Testen erstellt.

```json
{
  "skill_name": "example-skill",
  "evals": [
    {
      "id": 1,
      "prompt": "User's example prompt",
      "expected_output": "Description of expected result",
      "expectations": [
        "The output includes X",
        "The skill used rag_search to find relevant documents",
        "Sources are cited with document name and page number"
      ]
    }
  ]
}
```

**Felder:**
- `skill_name`: Name passend zum Skill-Frontmatter
- `evals[].id`: Eindeutige Integer-ID
- `evals[].prompt`: Der auszufuehrende Test-Prompt
- `evals[].expected_output`: Menschenlesbare Beschreibung des erwarteten Ergebnisses
- `evals[].expectations`: Liste verifizierbarer Aussagen (Assertions)

---

## history.json

Verfolgt die Versions-Progression ueber Iterationen. Wird im Chat-Kontext mitgefuehrt.

```json
{
  "started_at": "2026-03-28T10:30:00Z",
  "skill_name": "recherche-report",
  "current_best": "v2",
  "iterations": [
    {
      "version": "v0",
      "parent": null,
      "expectation_pass_rate": 0.65,
      "grading_result": "baseline",
      "is_current_best": false
    },
    {
      "version": "v1",
      "parent": "v0",
      "expectation_pass_rate": 0.75,
      "grading_result": "won",
      "is_current_best": false
    },
    {
      "version": "v2",
      "parent": "v1",
      "expectation_pass_rate": 0.85,
      "grading_result": "won",
      "is_current_best": true
    }
  ]
}
```

**Felder:**
- `started_at`: ISO Zeitstempel des Starts
- `skill_name`: Name des Skills der verbessert wird
- `current_best`: Versions-Bezeichner des besten Performers
- `iterations[].version`: Versions-Bezeichner (v0, v1, ...)
- `iterations[].parent`: Eltern-Version von der abgeleitet wurde
- `iterations[].expectation_pass_rate`: Pass-Rate vom Grading
- `iterations[].grading_result`: "baseline", "won", "lost", oder "tie"
- `iterations[].is_current_best`: Ob dies die aktuell beste Version ist

---

## grading.json

Ausgabe des skill-grader Subagents. Bewertet ob Expectations erfuellt wurden.

```json
{
  "expectations": [
    {
      "text": "Die Antwort nennt die Vertragsparteien",
      "passed": true,
      "evidence": "Gefunden: 'Samaritano GmbH (Auftraggeber) und Mueller IT-Solutions GmbH (Auftragnehmer)'"
    },
    {
      "text": "Kuendigungsfristen werden explizit genannt",
      "passed": false,
      "evidence": "Die Antwort erwaehnt den Vertrag allgemein aber nennt keine konkreten Fristen"
    }
  ],
  "summary": {
    "passed": 2,
    "failed": 1,
    "total": 3,
    "pass_rate": 0.67
  },
  "execution_metrics": {
    "tool_calls": {
      "rag_search": 3,
      "read_chunk": 2,
      "graph_query": 0
    },
    "total_tool_calls": 5,
    "total_steps": 5,
    "errors_encountered": 0
  },
  "timing": {
    "total_duration_seconds": 23.3,
    "total_tokens": 4852
  },
  "claims": [
    {
      "claim": "Der Vertrag hat eine Laufzeit bis 30.6.2026",
      "type": "factual",
      "verified": true,
      "evidence": "Bestaetigt in Chunk 3: 'Ende der Ueberlassung: 30.6.2026'"
    }
  ],
  "eval_feedback": {
    "suggestions": [
      {
        "assertion": "Quellen werden zitiert",
        "reason": "Zu allgemein — prueft nicht ob die RICHTIGEN Quellen zitiert werden"
      }
    ],
    "overall": "Assertions pruefen Vorhandensein aber nicht Korrektheit."
  }
}
```

**Felder:**
- `expectations[]`: Bewertete Expectations mit Evidenz
  - `text`: Die Expectation (String)
  - `passed`: true/false
  - `evidence`: Konkreter Beleg (Zitat oder Beschreibung)
- `summary`: Aggregierte Pass/Fail Zahlen mit `pass_rate`
- `execution_metrics`: Tool-Nutzung aus dem Test-Run
  - `tool_calls`: Anzahl pro Tool-Typ
  - `total_tool_calls`: Summe aller Tool-Aufrufe
  - `total_steps`: Anzahl der Schritte
  - `errors_encountered`: Anzahl der Fehler
- `timing`: Zeitmessung
  - `total_duration_seconds`: Gesamtdauer
  - `total_tokens`: Token-Verbrauch
- `claims`: Extrahierte und verifizierte Behauptungen aus dem Output
  - `claim`: Die Behauptung
  - `type`: "factual", "process", oder "quality"
  - `verified`: true/false
  - `evidence`: Beleg
- `eval_feedback`: (optional) Verbesserungsvorschlaege fuer die Evals selbst
  - `suggestions[]`: Schwache Assertions die verbessert werden sollten
  - `overall`: Gesamteinschaetzung der Eval-Qualitaet

---

## metrics.json

Metriken aus einem Test-Run. Wird von compare_skill im metadata-Feld zurueckgegeben.

```json
{
  "tool_calls": {
    "rag_search": 3,
    "read_chunk": 2,
    "graph_query": 1
  },
  "total_tool_calls": 6,
  "total_steps": 5,
  "errors_encountered": 0
}
```

**Felder:**
- `tool_calls`: Anzahl pro Tool-Typ
- `total_tool_calls`: Summe aller Tool-Aufrufe
- `total_steps`: Anzahl der Schritte
- `errors_encountered`: Anzahl der Fehler waehrend der Ausfuehrung

---

## timing.json

Zeitmessung fuer einen Run. Wird von compare_skill im metadata-Feld zurueckgegeben.

**Wie erfassen:** Das compare_skill Tool misst `durationMs` pro Subagent und gibt `inputTokens` + `outputTokens` zurueck. Diese Daten sind nur im Tool-Ergebnis verfuegbar.

```json
{
  "total_tokens": 4852,
  "duration_ms": 23332,
  "total_duration_seconds": 23.3
}
```

---

## benchmark.json

Aggregierte Ergebnisse ueber mehrere Test-Runs. Wird nach allen compare_skill Aufrufen zusammengestellt.

```json
{
  "metadata": {
    "skill_name": "recherche-report",
    "skill_slug": "recherche-report",
    "model": "ovh:gpt-oss-120b",
    "timestamp": "2026-03-28T10:30:00Z",
    "evals_run": [1, 2, 3]
  },

  "runs": [
    {
      "eval_id": 1,
      "eval_name": "vertrag-zusammenfassung",
      "configuration": "with_skill",
      "result": {
        "pass_rate": 0.85,
        "passed": 6,
        "failed": 1,
        "total": 7,
        "time_seconds": 42.5,
        "tokens": 3800,
        "tool_calls": 8,
        "errors": 0
      },
      "expectations": [
        {"text": "Vertragsparteien genannt", "passed": true, "evidence": "..."}
      ]
    },
    {
      "eval_id": 1,
      "eval_name": "vertrag-zusammenfassung",
      "configuration": "without_skill",
      "result": {
        "pass_rate": 0.43,
        "passed": 3,
        "failed": 4,
        "total": 7,
        "time_seconds": 28.0,
        "tokens": 2100,
        "tool_calls": 4,
        "errors": 0
      },
      "expectations": [
        {"text": "Vertragsparteien genannt", "passed": true, "evidence": "..."}
      ]
    }
  ],

  "run_summary": {
    "with_skill": {
      "pass_rate": {"mean": 0.85, "stddev": 0.05},
      "time_seconds": {"mean": 45.0, "stddev": 12.0},
      "tokens": {"mean": 3800, "stddev": 400}
    },
    "without_skill": {
      "pass_rate": {"mean": 0.35, "stddev": 0.08},
      "time_seconds": {"mean": 32.0, "stddev": 8.0},
      "tokens": {"mean": 2100, "stddev": 300}
    },
    "delta": {
      "pass_rate": "+0.50",
      "time_seconds": "+13.0",
      "tokens": "+1700"
    }
  },

  "notes": [
    "Assertion 'Quellen werden zitiert' passt in 100% beider Konfigurationen — differenziert nicht",
    "Eval 3 zeigt hohe Varianz (50% +/- 40%) — moeglicherweise instabil",
    "Skill fuegt 13s durchschnittliche Ausfuehrungszeit hinzu aber verbessert pass_rate um 50%"
  ]
}
```

**Felder:**
- `metadata`: Informationen ueber den Benchmark-Run
  - `skill_name`: Name des Skills
  - `skill_slug`: Slug fuer compare_skill Aufrufe
  - `model`: Genutztes Modell
  - `timestamp`: Zeitpunkt des Benchmarks
  - `evals_run`: Liste der ausgefuehrten Eval-IDs
- `runs[]`: Einzelne Run-Ergebnisse
  - `eval_id`: Numerische Eval-ID
  - `eval_name`: Menschenlesbarer Eval-Name
  - `configuration`: Muss `"with_skill"` oder `"without_skill"` sein
  - `result`: Verschachteltes Objekt mit `pass_rate`, `passed`, `total`, `time_seconds`, `tokens`, `errors`
  - `expectations[]`: Bewertete Expectations
- `run_summary`: Statistische Aggregate pro Konfiguration
  - `with_skill` / `without_skill`: Jeweils `pass_rate`, `time_seconds`, `tokens` mit `mean` und `stddev`
  - `delta`: Differenz-Strings wie `"+0.50"`, `"+13.0"`, `"+1700"`
- `notes`: Freitext-Beobachtungen vom Analyzer

---

## comparison.json

Ausgabe des skill-comparator Subagents. Blinder A/B-Vergleich.

```json
{
  "winner": "A",
  "reasoning": "Antwort A liefert eine vollstaendige Zusammenfassung mit allen Vertragsdetails und Quellenangaben. Antwort B ist oberflaechlich und nennt keine konkreten Zahlen.",
  "rubric": {
    "A": {
      "content": {
        "correctness": 5,
        "completeness": 5,
        "accuracy": 4
      },
      "structure": {
        "organization": 4,
        "formatting": 5,
        "usability": 4
      },
      "content_score": 4.7,
      "structure_score": 4.3,
      "overall_score": 9.0
    },
    "B": {
      "content": {
        "correctness": 3,
        "completeness": 2,
        "accuracy": 3
      },
      "structure": {
        "organization": 3,
        "formatting": 2,
        "usability": 3
      },
      "content_score": 2.7,
      "structure_score": 2.7,
      "overall_score": 5.4
    }
  },
  "output_quality": {
    "A": {
      "score": 9,
      "strengths": ["Vollstaendige Vertragsdetails", "Quellen zitiert", "Klar strukturiert"],
      "weaknesses": ["Etwas lang"]
    },
    "B": {
      "score": 5,
      "strengths": ["Kurz und praegnant"],
      "weaknesses": ["Keine Quellen", "Fehlende Details", "Oberflaechlich"]
    }
  },
  "expectation_results": {
    "A": {
      "passed": 4,
      "total": 5,
      "pass_rate": 0.80,
      "details": [
        {"text": "Vertragsparteien genannt", "passed": true}
      ]
    },
    "B": {
      "passed": 3,
      "total": 5,
      "pass_rate": 0.60,
      "details": [
        {"text": "Vertragsparteien genannt", "passed": true}
      ]
    }
  }
}
```

---

## analysis.json

Ausgabe des skill-analyzer Subagents. Erklaert WARUM einer besser war.

```json
{
  "comparison_summary": {
    "winner": "A",
    "winner_skill": "recherche-report",
    "loser_skill": "(baseline)",
    "comparator_reasoning": "Antwort A hatte vollstaendige Details und Quellen"
  },
  "winner_strengths": [
    "Klare Schritt-fuer-Schritt Instruktionen fuehrten zu systematischer Suche",
    "Explizite Quellen-Anforderung sorgte fuer Quellenangaben"
  ],
  "loser_weaknesses": [
    "Ohne Skill keine Struktur-Vorgabe — Agent antwortete frei und unstrukturiert",
    "Keine Anweisung Quellen zu zitieren — Agent machte es nicht"
  ],
  "instruction_following": {
    "winner": {
      "score": 9,
      "issues": ["Minor: hat optionalen Wissensgraph-Check uebersprungen"]
    },
    "loser": {
      "score": 6,
      "issues": [
        "Hat kein definiertes Ausgabeformat verwendet",
        "Hat eigenen Ansatz erfunden statt strukturiert zu suchen"
      ]
    }
  },
  "improvement_suggestions": [
    {
      "priority": "high",
      "category": "instructions",
      "suggestion": "Konkrete Suchbegriffe in die Instruktionen aufnehmen statt nur 'suche nach dem Thema'",
      "expected_impact": "Wuerde die Trefferquote bei spezifischen Fragen verbessern"
    },
    {
      "priority": "medium",
      "category": "output_format",
      "suggestion": "Ausgabe-Template mit Platzhaltern hinzufuegen",
      "expected_impact": "Konsistenteres Ergebnis-Format"
    }
  ],
  "transcript_insights": {
    "winner_execution_pattern": "rag_search (breit) -> read_chunk (Detail) -> rag_search (alternativ) -> Zusammenfassung",
    "loser_execution_pattern": "rag_search (einmal) -> direkt geantwortet ohne Vertiefung"
  }
}
```

**Felder:**
- `comparison_summary`: Zusammenfassung wer gewonnen hat und warum
- `winner_strengths`: Was der Skill besser gemacht hat (konkret, mit Beleg)
- `loser_weaknesses`: Was ohne Skill schlechter war
- `instruction_following`: Wie gut jede Variante den Instruktionen gefolgt ist (1-10 Score)
- `improvement_suggestions[]`: Konkrete Verbesserungsvorschlaege
  - `priority`: "high", "medium", "low"
  - `category`: "instructions", "output_format", "tools", "error_handling", "search_strategy"
  - `suggestion`: Konkreter Aenderungsvorschlag
  - `expected_impact`: Erwartete Auswirkung
- `transcript_insights`: Ausfuehrungsmuster beider Varianten
