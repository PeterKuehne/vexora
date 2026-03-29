---
name: agent-creator
description: Erstellt neue Subagent-Definitionen. Nutze diesen Skill wenn der User
  einen neuen spezialisierten Agenten erstellen moechte, z.B. 'erstelle einen Agent
  der Vertraege prueft', 'baue mir einen Subagent fuer Onboarding', 'neuen Agent erstellen'.
allowed-tools: create_agent list_agents list_skills rag_search
---

# Agent Creator

Erstelle spezialisierte Subagenten die wiederkehrende Aufgaben in eigenem Kontext ausfuehren.

## Was ist ein Subagent?

Ein Subagent ist ein eigenstaendiger Agent der in isoliertem Kontext arbeitet. Er bekommt eine Aufgabe, fuehrt sie mit seinen Tools aus, und gibt nur eine Zusammenfassung zurueck. Das spart Kontext im Hauptgespraech.

## Vorgehen

### 1. Zweck verstehen

Frage den User:
- Was soll der Agent koennen?
- Welche Dokumente/Daten soll er durchsuchen?
- Wie oft wird diese Aufgabe gebraucht?

### 2. Pruefen ob ein Subagent der richtige Ansatz ist

Ein Subagent ist richtig wenn:
- Die Aufgabe viel Recherche/Suche erfordert (viele Tool-Calls)
- Der User das Ergebnis als Zusammenfassung braucht, nicht die Zwischenschritte
- Die Aufgabe wiederholt vorkommt

Ein Skill ist besser wenn:
- Der User waehrend der Ausfuehrung Feedback geben soll
- Der Workflow den Konversationskontext braucht
- Es ein definierter Schritt-fuer-Schritt Prozess ist

### 3. Tools waehlen

Verfuegbare Tools fuer Subagenten:
- `rag_search` — Wissensdatenbank durchsuchen (Hybrid: Keyword + Semantisch)
- `read_chunk` — Dokument-Chunks im Detail lesen
- `graph_query` — Wissensgraph nach Entitaeten/Beziehungen durchsuchen
- `sql_query` — Datenbank-Abfragen (nur SELECT, nur Manager/Admin)

NICHT erlaubt (Meta-Tools):
- `agent` — keine Verschachtelung
- `create_skill`, `update_skill`, `create_agent` — Meta-Tools gehoeren nicht in Subagenten
- `load_skill`, `list_skills` — Skills sind fuer den Hauptagent
- `send_notification` — Subagenten kommunizieren nicht direkt mit dem User

### 4. Instruktionen schreiben

Gute Subagent-Instruktionen enthalten:
- **Rolle**: Wer ist der Agent? (1 Satz)
- **Vorgehen**: Nummerierte Schritte (3-6 Schritte)
- **Regeln**: Was darf er NICHT tun?
- **Ausgabeformat**: Wie soll die Zusammenfassung strukturiert sein?

### 5. Agent erstellen

Nutze `create_agent` mit:
- `name`: kebab-case, beschreibend (z.B. "vertrag-prufer", "onboarding-guide")
- `description`: MUSS sagen WANN der Agent genutzt werden soll. Beginne mit dem Hauptzweck.
- `tools`: Komma-getrennte Liste (minimal, nur was gebraucht wird)
- `instructions`: Die vollstaendigen Markdown-Instruktionen
- `maxSteps`: 8-15 je nach Komplexitaet

### 6. Testen

Sage dem User wie er den neuen Agent nutzen kann:
- Automatisch: Der Hauptagent delegiert wenn die Aufgabe passt
- Explizit: "@{agent-name} {aufgabe}" im Chat
- Liste: "Welche Agenten gibt es?" zeigt alle verfuegbaren

## Beispiel

Wenn der User sagt "Erstelle einen Agent der Vertraege auf Risiken prueft":

```
create_agent(
  name: "vertrag-risiko-prufer",
  description: "Prueft Vertraege auf rechtliche und finanzielle Risiken. Nutze diesen Agent wenn ein Vertrag auf Risiken, problematische Klauseln oder fehlende Regelungen geprueft werden soll.",
  tools: "rag_search, read_chunk",
  instructions: "Du bist ein Vertrags-Risikopruefer...",
  maxSteps: 10
)
```
