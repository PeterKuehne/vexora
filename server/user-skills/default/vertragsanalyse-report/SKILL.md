---
name: vertragsanalyse-report
description: >-
  Analysiert Verträge aus dem Wissensspeicher und extrahiert strukturierte
  Informationen zu Laufzeiten, Kündigungsfristen, Vergütung, Haftung, Risiken
  und Pflichten. Wird ausgelöst, wenn der Nutzer nach einer "Vertragsanalyse",
  "Vertragsprüfung", "Klauselprüfung" oder "Vertragszusammenfassung" fragt oder
  explizit einen Report zu einem Vertrag anfordert.
allowed-tools: rag_search read_chunk
metadata:
  version: 1.0.0
  category: analyse
  tags: vertrag analyse report recht
---
# Vertragsanalyse-Report Skill

## Zweck
Dieser Skill analysiert Verträge aus dem Wissensspeicher und erstellt einen strukturierten Report zu den wichtigsten Vertragselementen. Der Report hilft Nutzern, schnell die zentralen Bedingungen, Risiken und Pflichten eines Vertrags zu verstehen.

## Trigger-Phrasen (Nutzeranfragen)
- "Analysiere den Vertrag [Vertragsname] und erstelle einen Report zu Laufzeiten, Kündigungsfristen und Haftung."
- "Prüfe den Vertrag [Vertragsname] auf Risiken und Pflichten."
- "Erstelle eine Zusammenfassung des Vertrags [Vertragsname] mit Fokus auf Vergütung und Kündigungsfristen."
- "Was sind die wichtigsten Klauseln im Vertrag [Vertragsname]?"
- "Ich brauche eine strukturierte Analyse des Vertrags [Vertragsname]."
- "Extrahiere Laufzeiten, Haftung und Vergütung aus dem Vertrag [Vertragsname]."

---

## Schritt-für-Schritt-Anleitung

### 1. Vertrag identifizieren und suchen
**Ziel:** Den relevanten Vertrag im Wissensspeicher finden.

**Schritte:**
1. Nutze die Nutzeranfrage, um den **Vertragsnamen** oder **Thema** zu extrahieren.
   - Beispiel: Wenn der Nutzer sagt "Analysiere den Mietvertrag Büro München", ist der Vertragsname "Mietvertrag Büro München".
2. Führe eine **`rag_search`** mit dem Vertragsnamen oder Thema durch, um relevante Dokumente zu finden.
   - **Suchmodus:** `hybrid` (Standard)
   - **Limit:** 5 Ergebnisse (kann auf 10 erhöht werden, wenn keine relevanten Treffer gefunden werden).
3. Prüfe die Ergebnisse auf Relevanz:
   - Enthält das Dokument Vertragsbedingungen?
   - Stimmt der Titel mit dem gesuchten Vertrag überein?
4. Falls keine relevanten Ergebnisse gefunden werden:
   - Frage den Nutzer nach präziseren Informationen (z. B. "Handelt es sich um einen Mietvertrag, Dienstvertrag oder Kaufvertrag?").
   - Wiederhole die Suche mit angepassten Suchbegriffen.

**Tools:** `rag_search`

---

### 2. Vertragsinhalte extrahieren und strukturieren
**Ziel:** Die relevanten Abschnitte des Vertrags identifizieren und für die Analyse vorbereiten.

**Schritte:**
1. Wähle das relevanteste Dokument aus den Suchergebnissen aus (höchster Score).
2. Lade den **gesamten Vertragsinhalt** mit **`read_chunk`** und **`expandContext: true`**, um den vollständigen Kontext zu erhalten.
   - **Chunk-ID:** Aus dem `rag_search`-Ergebnis übernehmen.
3. Analysiere den Vertragsinhalt und extrahiere die folgenden Informationen:
   - **Vertragsparteien:** Wer sind die Vertragspartner? (Namen, Adressen, Rollen)
   - **Laufzeit:** Beginn, Ende, automatische Verlängerung?
   - **Kündigungsfristen:** Fristen, Bedingungen, Form (schriftlich/mündlich)?
   - **Vergütung:** Höhe, Fälligkeit, Zahlungsmodalitäten, Zusatzkosten?
   - **Haftung:** Haftungsbeschränkungen, Ausschlüsse, Haftungssummen?
   - **Pflichten:** Haupt- und Nebenpflichten der Vertragsparteien.
   - **Risiken:** Identifiziere potenzielle Risiken (z. B. Vertragsstrafen, Haftungsrisiken, Kündigungsrisiken).
   - **Sonstige Klauseln:** Wichtige zusätzliche Klauseln (z. B. Geheimhaltung, Salvatorische Klausel, Gerichtsstand).

**Hinweise:**
- Achte auf **Definitionen** im Vertrag (z. B. "Im Sinne dieses Vertrags bedeutet 'Vergütung'..."). Diese können die Bedeutung von Begriffen klären.
- Falls ein Abschnitt unklar ist, markiere ihn im Report als **"Klärungsbedarf"** und weise auf die Notwendigkeit einer rechtlichen Prüfung hin.

**Tools:** `read_chunk`

---

### 3. Report erstellen
**Ziel:** Einen strukturierten, leicht verständlichen Report erstellen, der die extrahierten Informationen zusammenfasst.

**Struktur des Reports:**

```markdown
# Vertragsanalyse-Report: [Vertragsname]

## 1. Vertragsparteien
- **Partei A:** [Name, Adresse, Rolle]
- **Partei B:** [Name, Adresse, Rolle]

## 2. Laufzeit
- **Beginn:** [Datum oder "nicht angegeben"]
- **Ende:** [Datum oder "unbefristet"]
- **Automatische Verlängerung:** [Ja/Nein, Bedingungen]
- **Kündigungsfristen:**
  - [Frist, z. B. "3 Monate zum Quartalsende"]
  - [Form, z. B. "schriftlich"]
  - [Besondere Bedingungen, falls vorhanden]

## 3. Vergütung
- **Höhe:** [Betrag, z. B. "5.000 € monatlich"]
- **Fälligkeit:** [Zeitpunkt, z. B. "monatlich im Voraus"]
- **Zahlungsmodalitäten:** [z. B. "Banküberweisung, 10 Tage nach Rechnungserhalt"]
- **Zusatzkosten:** [z. B. "Nebenkosten in Höhe von 200 € monatlich"]

## 4. Haftung
- **Haftungsbeschränkungen:** [z. B. "Haftung auf Vorsatz und grobe Fahrlässigkeit beschränkt"]
- **Ausschlüsse:** [z. B. "Keine Haftung für indirekte Schäden"]
- **Haftungssummen:** [z. B. "Maximal 10.000 € pro Schadensfall"]

## 5. Pflichten
### Pflichten von Partei A:
- [Pflicht 1, z. B. "Zahlung der Vergütung bis zum 3. Werktag des Monats"]
- [Pflicht 2]

### Pflichten von Partei B:
- [Pflicht 1, z. B. "Erbringung der Dienstleistung gemäß Anlage 1"]
- [Pflicht 2]

## 6. Risiken
- [Risiko 1, z. B. "Vertragsstrafe von 5.000 € bei verspäteter Zahlung"]
- [Risiko 2, z. B. "Haftungsrisiko bei grober Fahrlässigkeit"]
- [Risiko 3, z. B. "Kündigungsrisiko bei Nichtzahlung innerhalb von 14 Tagen"]

## 7. Sonstige Klauseln
- [Klausel 1, z. B. "Geheimhaltungspflicht für beide Parteien"]
- [Klausel 2, z. B. "Salvatorische Klausel: Bei Unwirksamkeit einer Klausel bleibt der Vertrag im Übrigen wirksam"]
- [Klausel 3, z. B. "Gerichtsstand ist München"]

## 8. Zusammenfassung & Empfehlungen
- **Zusammenfassung:** [Kurze Zusammenfassung der wichtigsten Punkte, z. B. "Der Vertrag ist befristet bis zum 31.12.2025 mit einer Kündigungsfrist von 3 Monaten. Die Vergütung beträgt 5.000 € monatlich. Es bestehen Haftungsrisiken bei grober Fahrlässigkeit."]
- **Empfehlungen:**
  - [Empfehlung 1, z. B. "Prüfen Sie die Haftungsklauseln auf Angemessenheit."]
  - [Empfehlung 2, z. B. "Klären Sie die automatische Verlängerung, falls keine Fortsetzung gewünscht ist."]
  - [Empfehlung 3, z. B. "Lassen Sie den Vertrag rechtlich prüfen, falls Unklarheiten bestehen."]

## 9. Klärungsbedarf
- [Punkt 1, z. B. "Die Definition von 'grober Fahrlässigkeit' ist unklar."]
- [Punkt 2, z. B. "Die Kündigungsfrist für Partei B ist nicht eindeutig geregelt."]

---
*Dieser Report dient der Information und ersetzt keine rechtliche Beratung.*
```

**Hinweise:**
- Falls ein Abschnitt im Vertrag **nicht vorhanden** ist, schreibe: "Nicht im Vertrag geregelt."
- Falls ein Abschnitt **unklar** ist, weise darauf hin und empfehle eine rechtliche Prüfung.
- Nutze **Fettdruck** für Schlüsselbegriffe (z. B. **Haftung**, **Kündigungsfrist**).

---

### 4. Report an den Nutzer übermitteln
**Ziel:** Den Report klar und verständlich präsentieren.

**Schritte:**
1. Formatiere den Report als **Markdown** (siehe Struktur oben).
2. Sende den Report an den Nutzer mit einer kurzen Einleitung:
   - Beispiel: "Hier ist der strukturierte Report zum Vertrag **[Vertragsname]**. Der Report enthält die wichtigsten Klauseln zu Laufzeiten, Vergütung, Haftung und Risiken. Bei Fragen oder Unklarheiten können Sie gerne nachfragen oder eine rechtliche Prüfung empfehlen."
3. Falls Klärungsbedarf besteht, weise den Nutzer explizit darauf hin:
   - Beispiel: "**Hinweis:** In Abschnitt 8 (Klärungsbedarf) wurden unklare Punkte identifiziert. Eine rechtliche Prüfung wird empfohlen."

**Tools:** Keine (direkte Ausgabe an den Nutzer).

---

### 5. Optional: Rechtliche Hinweise ergänzen
**Ziel:** Den Nutzer auf die Grenzen der Analyse hinweisen.

**Schritte:**
1. Füge am Ende des Reports einen **Haftungsausschluss** hinzu:
   - Beispiel: "*Dieser Report dient der Information und ersetzt keine rechtliche Beratung. Für eine verbindliche Prüfung wenden Sie sich bitte an einen Anwalt.*"
2. Falls der Vertrag sensible oder komplexe Klauseln enthält, empfehle eine **rechtliche Prüfung**.

---

## Beispiele

### Beispiel 1: Nutzeranfrage
**Nutzer:** "Analysiere den Dienstvertrag mit der Firma XYZ und erstelle einen Report zu Laufzeiten, Vergütung und Haftung."

**Schritte:**
1. `rag_search` mit dem Suchbegriff "Dienstvertrag Firma XYZ".
2. Relevantestes Dokument auswählen und mit `read_chunk` laden.
3. Informationen zu Laufzeiten, Vergütung und Haftung extrahieren.
4. Report erstellen und an den Nutzer senden.

### Beispiel 2: Nutzeranfrage
**Nutzer:** "Was sind die Kündigungsfristen im Mietvertrag Büro München?"

**Schritte:**
1. `rag_search` mit dem Suchbegriff "Mietvertrag Büro München".
2. Relevantestes Dokument auswählen und mit `read_chunk` laden.
3. Abschnitt zu Kündigungsfristen extrahieren.
4. Report erstellen (fokussiert auf Kündigungsfristen) und an den Nutzer senden.

---

## Empfohlene Tools
- `rag_search`: Suche nach relevanten Verträgen im Wissensspeicher.
- `read_chunk`: Lade den vollständigen Vertragsinhalt für die Analyse.
