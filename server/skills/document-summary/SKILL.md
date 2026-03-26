---
name: document-summary
description: >-
  Fasst Dokumente aus der Wissensdatenbank zusammen. Nutze diesen Skill wenn der
  User sagt 'fasse zusammen', 'Zusammenfassung', 'Überblick geben', oder nach
  einer Zusammenfassung zu einem Thema fragt. NICHT verwenden bei: Recherche mit
  mehreren Quellen (→ research-report), einfachen Ja/Nein-Fragen, oder wenn der
  User eigenen Text zusammenfassen will der nicht in der Wissensdatenbank liegt.
allowed-tools: rag_search read_chunk create_document
metadata:
  version: "1.0.0"
  category: zusammenfassung
  tags: zusammenfassung dokumente recherche
---

# Dokument-Zusammenfassung

Erstelle eine strukturierte Zusammenfassung basierend auf Dokumenten aus der Wissensdatenbank.

## Instruktionen

### Schritt 1: Thema identifizieren
Extrahiere das Kernthema aus der Frage des Users.

### Schritt 2: Dokumente durchsuchen
Nutze `rag_search` mit verschiedenen Suchbegriffen:
1. Exakte Begriffe aus der Frage
2. Synonyme und verwandte Begriffe
3. Übergeordnete Themenbegriffe

Führe mindestens 2 verschiedene Suchen durch um breite Abdeckung zu gewährleisten.

### Schritt 3: Details lesen
Nutze `read_chunk` für die relevantesten Treffer, um den vollständigen Kontext zu erhalten.

### Schritt 4: Zusammenfassung erstellen
Strukturiere die Zusammenfassung wie folgt:

**Kurz (wenn User 'kurz' oder 'knapp' sagt):**
- 2-3 Absätze, nur Kernaussagen

**Standard:**
- Einleitung mit Kernaussage
- 3-5 Hauptpunkte mit Details
- Fazit

**Ausführlich (wenn User 'ausführlich' oder 'detailliert' sagt):**
- Vollständige Analyse aller gefundenen Informationen
- Unterpunkte und Zusammenhänge
- Quellenverweise pro Abschnitt

## Wichtige Regeln
- IMMER Quellen zitieren (Dokumentname, Seitenzahl)
- NUR Informationen aus den gefundenen Dokumenten verwenden
- Wenn keine relevanten Dokumente gefunden werden, das klar kommunizieren
- Widersprüche zwischen Dokumenten aufzeigen

## Letzter Schritt: Ergebnis sichern
Frage den User: "Soll ich die Zusammenfassung im Wissensspeicher ablegen?"
- Ja → Nutze `create_document` mit der Zusammenfassung als Inhalt und einem passenden Titel
- Nein → Aufgabe beenden
