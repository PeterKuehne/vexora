---
name: auev-generator-samaritano
description: >-
  Erstellt AÜV‑Verträge für die samaritano GmbH. Trigger: "Erstelle AÜV für
  ...", "Generiere Arbeitnehmerüberlassungsvertrag" usw.
allowed-tools: rag_search read_chunk create_document send_notification
metadata:
  version: 1.0.0
  category: erstellung
  tags: auev vertrag samaritano automatisierung
---
# Skill: auev-generator-samaritano

## Ziel
Erstellt automatisiert Arbeitnehmerüberlassungsverträge (AÜV) für die **samaritano GmbH** basierend auf der internen AÜV‑Vorlage.

## Ablauf
1. **Vorlage finden** – Suche mit `rag_search` nach der internen AÜV‑Vorlage (z. B. "auev‑AyÌV‑2026‑0003.pdf").
2. **Vorlage laden** – Lese die relevanten Chunks mit `read_chunk` (Titel, Paragraphen, Platzhalter).
3. **Nutzereingaben parsen** – Extrahiere vom Nutzer übermittelte Angaben (Name, Vorname, Geburtsdatum, Staatsangehörigkeit, Sozialversicherungsnummer, Tätigkeit, Qualifikation, Einsatzort, Einsatzbeginn, Laufzeit, Kündigungsfrist).
4. **Platzhalter ersetzen** – Ersetze in der Vorlage alle Marker (`{{NAME}}`, `{{VORNAME}}`, `{{GEBDATUM}}`, `{{STAATSANGEHOERIGKEIT}}`, `{{SOZIALVERSICHERUNGSNUMMER}}`, `{{TAETIGKEIT}}`, `{{QUALIFIKATION}}`, `{{EINSATZORT}}`, `{{EINSATZBEGINN}}`, `{{LAUFZEIT}}`, `{{KUENDIGUNGSFRIST}}`) durch die Werte aus Schritt 3 (oder „‑“, falls nicht angegeben).
5. **Vertrag finalisieren** – Setze den fertigen Text zusammen, füge einen Hinweis zur automatischen Generierung hinzu.
6. **Dokument anlegen** – Speichere den Vertrag mit `create_document` (Titel: `AÜV_{{NAME}}_{{VORNAME}}_{{EINSATZBEGINN}}.md`, Klassifizierung: `confidential`).
7. **Rückmeldung** – Informiere den Nutzer über `send_notification` mit Dokument‑ID und Hinweis auf eventuell fehlende Angaben.

## Fehlerbehandlung
- Fehlende Pflichtangaben werden mit einem Bindestrich (`‑`) im Vertrag ersetzt.
- Nach Erstellung wird eine zweite Benachrichtigung gesendet, die alle nicht gelieferten Felder auflistet.

## Sicherheit
- Das erzeugte Dokument wird als **confidential** klassifiziert, da personenbezogene Daten enthalten sind.

## Beispiel‑Prompt (Trigger)
"Erstelle einen AÜV‑Vertrag für Thomas Schmidt, Anästhesiepflege, Einsatz ab 01.05.2024 in Hildesheim, Laufzeit 12 Monate."

## Hinweis für Entwickler
- Bei Änderungen an der Vorlage muss die `rag_search`‑Abfrage ggf. angepasst werden (z. B. neues Jahr).
- Weitere Vertragstypen können durch zusätzliche Platzhalter‑Sets und Vorlagen ergänzt werden.

