---
name: auev-contract-generator
description: >-
  Generiere einen vollständigen AÜV‑Vertrag für die samaritano GmbH, wenn der
  Nutzer nach einem „AÜV‑Vertrag“, „Arbeitnehmer‑Überlassungsvertrag“ oder
  ähnlichen Begriffen fragt. Der Skill nutzt die interne AÜV‑Vorlage, füllt alle
  Platzhalter mit den vom Nutzer gelieferten Daten und gibt das fertige Dokument
  als Markdown‑Datei zurück.
allowed-tools: rag_search read_chunk create_document
metadata:
  version: 1.0.0
  category: analyse
  tags: ''
---
## AÜV‑Contract‑Generator – Anweisungen (final)

**Ziel:** Erstelle einen vollständigen AÜV‑Vertrag für die samaritano GmbH, indem du die interne Vorlage nutzt, alle Platzhalter mit den vom Nutzer gelieferten Angaben füllst und das Ergebnis als Markdown‑Datei erzeugst.

### 1. Eingabefelder (Pflicht)

- `worker_name`
- `worker_address` (Straße, Hausnummer, PLZ, Ort) – falls nicht angegeben, setze **"nicht angegeben"**
- `worker_birthdate`
- `worker_nationality`
- `worker_ssn`
- `assignment_description`
- `assignment_qualification` – falls nicht angegeben, setze **"nicht angegeben"**
- `assignment_location`
- `assignment_department`
- `contract_start_date`
- `contract_duration`
- `notice_period`
- `weekly_hours`
- `working_days`
- `payment_terms`
- `vacation_days`
- `jurisdiction`
- `creation_date` – falls nicht angegeben, verwende das aktuelle Datum (TT.MM.JJJJ)

### 2. Fehlende Angaben automatisch ergänzen

- Prüfe, welche Felder im Prompt fehlen.
- Für `worker_address`, `assignment_qualification` setze den Platzhalter **"nicht angegeben"**.
- Für `creation_date` setze das heutige Datum (z. B. `{{today}}`).
- Keine Rückfrage an den Nutzer – der Skill soll in einem Durchlauf ein Dokument erzeugen.

### 3. Vorlage laden (Tool‑Aufrufe)

1. **RAG‑Search** nach der aktuellen AÜV‑Vorlage:
   ```text
   query: "AÜV‑Vertrag Samaritano Vorlage"
   ```
   (Ergebnis wird in Variable `search_result` gespeichert.)
2. **read_chunk** – verwende die `chunkId` des ersten Treffers aus `search_result` und speichere den Inhalt in `template`.

### 4. Platzhalter ersetzen

- Ersetze in `template` alle `{{…}}`‑Platzhalter durch die gesammelten Werte (inkl. Standard‑ bzw. Ersatzwerte).
- Achte auf Datumsformat **TT.MM.JJJJ**.
- Ergebnis in Variable `filled_template`.

### 5. Dokument erzeugen (Tool‑Aufruf)

- **create_document** mit folgendem Payload:
  ```json
  {
    "title": "AÜV‑Vertrag_{{worker_name}}_{{contract_start_date}}.md",
    "content": "{{filled_template}}",
    "classification": "internal"
  }
  ```
- Der Dateiname enthält Name und Vertragsbeginn, damit das Dokument eindeutig ist.

### 6. Rückmeldung an den Nutzer

- Antworte ausschließlich mit dem Hinweis auf das erstellte Dokument, z. B.:
  "Der Vertrag wurde erstellt: **AÜV‑Vertrag_Thomas Schmidt_01.02.2026.md**. Bitte prüfen und unterschreiben."
- **Quellen zitieren**: Am Ende des Dokuments muss stehen: *Quelle: auev‑A‑2026‑0003.pdf, Seite 1* (oder die tatsächlich geladene Quelle).

### 7. Fehler‑Handling

- Wenn `rag_search` kein Ergebnis liefert, informiere den Nutzer und biete an, ein Minimal‑Gerüst zu erstellen.
- Sollte `create_document` fehlschlagen, gib eine Fehlermeldung aus und bitte um erneuten Versuch.

### 8. Abschluss

- **Wichtig:** Die **letzte** Aktion des Skills muss das Erzeugen des Dokuments sein – danach darf **kein** weiteres Tool‑Aufruf erfolgen. Die Antwort an den Nutzer besteht ausschließlich aus dem Hinweis auf das erstellte Dokument.

