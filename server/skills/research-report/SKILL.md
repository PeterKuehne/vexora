---
name: research-report
description: >-
  Erstellt umfassende Recherche-Reports mit Dokumenten- und Graph-Analyse. Nutze
  diesen Skill wenn der User sagt 'Recherche', 'Report erstellen', 'recherchiere
  zu', 'analysiere das Thema', oder eine tiefgehende Analyse zu einem Thema
  wünscht. NICHT verwenden bei: einfachen Faktenfragen, kurzen Zusammenfassungen,
  oder wenn der User nur ein einzelnes Dokument lesen will.
allowed-tools: rag_search read_chunk graph_query create_document
metadata:
  version: "1.0.0"
  category: recherche
  tags: recherche report analyse graph
---

# Recherche-Report

Erstelle einen umfassenden Recherche-Report der Dokumentensuche mit Graph-Analyse kombiniert.

## Instruktionen

### Phase 1: Breite Dokumentenrecherche
1. Nutze `rag_search` mit dem Hauptthema
2. Nutze `rag_search` mit verwandten Begriffen und Synonymen
3. Nutze `rag_search` mit spezifischen Fachbegriffen zum Thema
4. Nutze `read_chunk` für die Top-Treffer um vollständigen Kontext zu erhalten

### Phase 2: Graph-Analyse
1. Nutze `graph_query` um Entitäten zum Thema zu finden
2. Identifiziere Beziehungen und Verbindungen zwischen Entitäten
3. Suche nach Clustern und Mustern

### Phase 3: Report erstellen
Strukturiere den Report wie folgt:

#### 1. Executive Summary
- 2-3 Sätze Kernaussage
- Wichtigste Erkenntnis

#### 2. Haupterkenntnisse
- Nummerierte Liste der wichtigsten Findings
- Jeweils mit Quellenangabe

#### 3. Detailanalyse
- Thematisch gegliederte Abschnitte
- Jeder Abschnitt mit Belegen aus den Dokumenten

#### 4. Verbindungen und Zusammenhänge
- Erkenntnisse aus der Graph-Analyse
- Wie hängen die gefundenen Informationen zusammen?

#### 5. Fazit und Empfehlungen
- Zusammenfassung der Analyse
- Konkrete nächste Schritte oder Empfehlungen

## Qualitätskriterien
- Mindestens 3 verschiedene Suchläufe durchführen
- Mindestens 1 Graph-Query
- Jede Aussage mit Quelle belegen
- Widersprüche klar benennen
- Lücken in der Datenlage aufzeigen

## Bei 'schnell' (wenn User Eile hat)
- Phase 1: Nur 1-2 Suchläufe
- Phase 2: Optional
- Phase 3: Nur Executive Summary + Haupterkenntnisse

## Letzter Schritt: Ergebnis sichern
Frage den User: "Soll ich den Report im Wissensspeicher ablegen?"
- Ja → Nutze `create_document` mit dem vollständigen Report als Inhalt und einem passenden Titel
- Nein → Aufgabe beenden
