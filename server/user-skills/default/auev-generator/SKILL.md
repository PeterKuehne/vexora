---
name: auev-generator
description: >-
  Erstelle einen vollständigen Arbeitnehmerüberlassungsvertrag (AÜV) für die
  samaritano GmbH. Trigger-Phrase: „Erstelle AÜV‑Vertrag“ oder „Generiere
  AÜV‑Vertrag“. Erwartet ein JSON-Objekt mit Mitarbeiter‑ und Einsatzdaten.
allowed-tools: rag_search read_chunk create_document send_notification
metadata:
  version: 1.0.0
  category: erstellung
  tags: ''
---
# Skill: AÜV‑Vertrag Generator für samaritano GmbH

## Ziel
Der Skill erzeugt ein rechtskonformes AÜV‑Vertragsdokument für die samaritano GmbH, basierend auf der internen Vertragsvorlage.

## Eingabe‑Schema (JSON)
```json
{
  "mitarbeiter": {
    "vorname": "string",
    "nachname": "string",
    "geburtsdatum": "TT.MM.JJJJ",
    "staatsangehoerigkeit": "string",
    "sozialversicherungsnummer": "string"
  },
  "einsatz": {
    "ort": "string",
    "abteilung": "string",
    "taetigkeitsbeschreibung": "string",
    "qualifikation": "string",
    "arbeitszeit": "string"
  },
  "vertrag": {
    "beginn": "TT.MM.JJJJ",
    "laufzeit": "unbefristet | xx Monate",
    "kuendigungsfrist": "xx Monate zum Quartalsende",
    "sonstige": "string (optional)"
  }
}
```

## Ablauf (Step‑by‑Step)
1. **Vorlage laden**
   ```text
   rag_search(query="AÜV Vertrag samaritano Vorlage", limit=1, searchMode="hybrid")
   ```
   – Ergebnis‑Chunk‑ID wird gespeichert.
2. **Detail‑Chunks auslesen**
   ```text
   read_chunk(chunkId="<gefunden‑ID>", expandContext=true)
   ```
   – Wir holen alle relevanten Paragraphen (Personaldaten, Einsatzbedingungen, Zulassung, Laufzeit, Arbeitszeit …).
3. **Platzhalter ersetzen**
   - Die gelesenen Texte enthalten Platzhalter wie `{{VORNAME}}`, `{{EINSATZORT}}` usw. Ersetze sie mit den Werten aus dem Eingabe‑JSON.
4. **Dokument erzeugen**
   ```text
   create_document(
       title="AÜV‑Vertrag_{{nachname}}_{{beginn}}.pdf",
       classification="confidential",
       content="<voller Vertragstext>"
   )
   ```
5. **Bestätigung zurückgeben**
   - Gib den Link/Dateinamen des erstellten Dokuments zurück. Optional: `send_notification` mit Erfolgsmeldung.

## Hinweis zu Quellen
Alle statischen Vertragsteile stammen aus dem internen Dokument **auev‑AyÌV‑2026‑0003.pdf** (Samaritano GmbH). Die relevanten Abschnitte wurden aus den Chunks 1‑5 extrahiert.

## Weiteres
- Der Skill prüft, ob alle Pflichtfelder befüllt sind; fehlt ein Feld, wird ein Hinweis‑Prompt zurückgegeben.
- Für Mehrsprachigkeit kann ein zweiter Referenz‑Chunk (englische Version) ergänzt werden.
- Der Skill ist erweiterbar: weitere Paragraphen (z. B. Haftung, Datenschutz) können per zusätzlichem Chunk eingebunden werden.

