# Spec: Agent-Konversation — Ein Kanal für Mensch-KI Zusammenarbeit

**Status:** Teilweise implementiert, Erweiterung geplant
**Bezug:** [00_COR7EX_VISION.md](./00_COR7EX_VISION.md) — "Ein Kanal: Agent-Konversationen"
**Ersetzt:** Separater Chat (entfernt), 08_HIVEMIND_PHASE2_AGENTS.md (erweitert diese Spec)

---

## Zusammenfassung

Die Agent-Konversation ist der **einzige Kanal** für die Zusammenarbeit zwischen Mensch und KI in Cor7ex. Es gibt keinen separaten Chat. Der Agent entscheidet selbst was nötig ist: direkte Antwort, Wissensspeicher durchsuchen, Tools nutzen, oder mehrstufig mit Feedback arbeiten.

Diese Spec beschreibt den Soll-Zustand auf Basis der Vision und der getroffenen Architektur-Entscheidungen.

---

## 1. Konversations-Modell

### 1.1 Konversationen bleiben offen

Eine Konversation ist kein "Task" der abgeschlossen wird. Sie bleibt offen bis der User sie **löscht**. Der User kann jederzeit zurückkehren und die Konversation fortsetzen.

| Status | Bedeutung | ChatInput sichtbar |
|---|---|---|
| `pending` | Agent startet | Nein |
| `running` | Agent arbeitet | Nein |
| `awaiting_input` | Agent ist fertig, wartet auf User | **Ja** |
| `completed` | Legacy (wird wie `awaiting_input` behandelt) | **Ja** |
| `failed` | Fehler aufgetreten | **Ja** (Retry möglich) |
| `cancelled` | User hat abgebrochen | Nein |

**Bereits implementiert:**
- ✅ Chat entfernt, Agent ist einziger Einstiegspunkt
- ✅ ChatInput immer sichtbar (außer running/cancelled)
- ✅ "Beenden"-Button entfernt
- ✅ Konversationen per Rechtsklick → "Löschen" entfernen
- ✅ Datums-Gruppierung in Sidebar (Heute, Gestern, Letzte 7 Tage, Älter)
- ✅ Floating Scroll-to-Bottom Button bei Zurück-Scrollen

### 1.2 Sidebar

Minimalistisch — nur die Query als Text, keine Status-Icons, keine Metadaten.

- **Header:** `+ Neu` als voller Button
- **Einträge:** Nur Query-Text (truncated), keine Icons/Status/Zeitangaben
- **Kontextmenü:** Rechtsklick → "Löschen" mit Bestätigungsdialog
- **Gruppierung:** Heute / Gestern / Letzte 7 Tage / Älter

**Bereits implementiert:** ✅ Vollständig

---

## 2. Intelligentes Query-Routing

### 2.1 Problem

Der Agent muss entscheiden ob er den Wissensspeicher (RAG) befragen soll oder direkt antworten kann. Aktuell wird RAG-first erzwungen (`"You MUST call rag_search for EVERY question"`). Das widerspricht der Vision.

### 2.2 Randbedingungen

- **DSGVO/AI Act:** Sensible Daten dürfen nicht auf US/CN-Server gelangen
- **Lokale Modelle (7B-14B):** Zu schwach für freie Routing-Entscheidungen (~80% Accuracy)
- **Kosten:** Cloud-API Calls kosten Geld, lokale Verarbeitung ist "kostenlos"

### 2.3 Entscheidung: Cascading Router

Ein dreistufiger Router entscheidet **automatisch** welches Model und ob RAG nötig ist. Der User muss nichts auswählen.

```
User-Query
    │
    ▼
[1. Keyword-Heuristik]              0ms, kein GPU
    │  "wer ist", Eigenname → RAG
    │  "erkläre", "schreibe" → Direkt
    │  ~60-70% der Fälle abgedeckt
    ▼ (unklar)
[2. Embedding-Similarity]           ~10ms, BGE-M3 lokal
    │  Query gegen KB-Centroids
    │  Similarity > 0.75 → RAG
    │  Similarity < 0.3 → Direkt
    ▼ (immer noch unklar)
[3. Lokales Model: Klassifikation]  ~200ms, Qwen 14B
    │  Strukturierter Output:
    │  {"route": "search|direct|multi-step"}
    ▼
┌────────────────────────────────────────────┐
│  Einfach  → Lokales Model (Qwen 14B)      │
│  Moderat  → Lokales Model + RAG            │
│  Komplex  → EU-Cloud Model + RAG + Multi   │
└────────────────────────────────────────────┘
```

**Validierung:** Dieses Pattern ist produktionserprobt:
- **RouteLLM** (LMSYS): 85% Kostenreduktion bei 95% GPT-4 Qualität
- **vLLM Semantic Router** (Red Hat): -47% Latenz, -48% Token-Verbrauch

### 2.4 Implementierung

**Neue Datei:** `server/src/services/agents/QueryRouter.ts`

```typescript
interface RoutingResult {
  route: 'direct' | 'rag' | 'rag-complex';
  model: 'local' | 'cloud';
  confidence: number;
  reason: string;
}
```

**Stufe 1 — Keyword-Heuristik:**
- Deutsche Fragewörter mit Firmenbezug → RAG (`"unsere", "Vertrag", "Mitarbeiter"`)
- Allgemeine Wissensfragen ohne Firmenbezug → Direkt (`"Was ist eine GmbH?"`)
- Kreative/generative Aufgaben → Direkt (`"Schreibe", "Erstelle", "Erkläre"`)
- Zeitbezug auf Firmendaten → RAG (`"Quartalszahlen", "letztes Jahr"`)

**Stufe 2 — Embedding-Similarity:**
- Query embedden mit BGE-M3 (lokal, bereits für RAG im Einsatz)
- Cosine-Similarity gegen KB-Centroids (Top-N Dokument-Embeddings)
- Schwellenwerte: `> 0.75` → RAG, `< 0.3` → Direkt, dazwischen → Stufe 3

**Stufe 3 — LLM-Klassifikation:**
- Lokales Model (Qwen 14B) mit constrainted Output
- Prompt: `Classify: {"route": "search|direct|multi-step", "reason": "..."}`
- Nur für ~15-20% der Queries nötig

### 2.5 System-Prompt Anpassung

**Alt (aktuell):**
> "You MUST call rag_search tool for EVERY question. NEVER answer from your own knowledge."

**Neu:**
> "Der Query-Router hat diese Query als `[ROUTE: {route}]` klassifiziert.
> Bei `search`: Nutze rag_search um relevante Informationen zu finden.
> Bei `direct`: Antworte direkt wenn du sicher bist. Bei Unsicherheit über Unternehmensfakten nutze rag_search.
> Bei `multi-step`: Zerlege die Aufgabe und nutze mehrere Tools.
> Antworte auf Deutsch. Zitiere Quellen wenn du Dokumente nutzt."

---

## 3. Model-Tiering (Lokal + EU-Cloud)

### 3.1 Entscheidung: Automatische Model-Auswahl

Der Cascade-Router wählt automatisch das passende Model. Der User sieht **nach** der Antwort transparent was passiert ist. Kein manueller Schalter.

### 3.2 Model-Tiers

| Tier | Model | Wo | Wann |
|---|---|---|---|
| **Lokal** | Qwen 14B (Ollama) | Eigener Server | Einfache Fragen, Routing, RAG-Synthese |
| **EU-Cloud** | Mistral Large 3 | Mistral API (Paris) | Komplexe Reasoning, Multi-Step |
| **EU-Cloud Alt** | IONOS AI Model Hub | IONOS (Deutschland) | Fallback, Llama 3.3 70B |

### 3.3 Mistral Bewertung

- **Stärken:** 5-7x günstiger als OpenAI, EU-gehostet (Paris), DSGVO-konform (DPA, ISO 27001, SOC 2), Tool-Calling produktionsreif
- **Schwächen:** 5-10% schwächer als GPT-4o bei komplexem Reasoning, max ~10 Tools pro Request zuverlässig
- **Konsequenz:** Tool-Sets müssen pro Aufgabe kuratiert werden statt alle 11 Tools zu senden

### 3.4 IONOS als deutscher Fallback

- **IONOS AI Model Hub:** Managed LLM-Inference, ausschließlich in Deutschland gehostet
- OpenAI-kompatible API → minimaler Integrationsaufwand
- Llama 3.3 70B, Mistral-Varianten verfügbar
- Kein Vendor-Lock-in, Standard-APIs

### 3.5 Provider-Priorisierung

```
1. Lokal (Qwen 14B)         → Immer verfügbar, kostenlos
2. Mistral API (Paris)       → EU-Cloud, günstig, stark
3. IONOS (Deutschland)       → Fallback wenn Mistral nicht erreichbar
4. Fehler                    → "EU-Cloud nicht erreichbar. Lokal verarbeitet."
```

### 3.6 Implementierung

**Änderung in:** `server/src/services/agents/ai-provider.ts`

Neuer Provider `mistral` via `@ai-sdk/mistral`:
```typescript
resolveModel('mistral:mistral-large-latest')  → Mistral API
resolveModel('ionos:llama-3.3-70b')           → IONOS API
resolveModel('qwen3:14b')                     → Ollama (lokal)
```

**Änderung in:** `server/src/routes/agents.ts`

Model-Auswahl durch Router statt Env-Var:
```typescript
// Alt:
const effectiveModel = model || process.env.AGENT_DEFAULT_MODEL;

// Neu:
const routingResult = await queryRouter.route(query, context);
const effectiveModel = routingResult.model === 'cloud'
  ? env.CLOUD_MODEL    // 'mistral:mistral-large-latest'
  : env.LOCAL_MODEL;   // 'qwen3:14b'
```

---

## 4. Transparenz

### 4.1 Entscheidung: Transparenz nach Verarbeitung

Der User sieht **nach** jeder Agent-Antwort welches Model genutzt wurde, wo verarbeitet wurde und was es gekostet hat.

### 4.2 Transparenz-Leiste

Am Ende jeder Agent-Antwort, dezent und nicht-invasiv:

**Lokale Verarbeitung:**
```
🔒 Qwen 14B · lokal · 847 Tokens
```

**EU-Cloud Verarbeitung:**
```
☁️ Mistral Large · EU · 2.4k Tokens · ~€0.004
```

**Fehlerfall:**
```
⚠️ EU-Cloud nicht erreichbar · Lokal verarbeitet (Qwen 14B)
```

### 4.3 Implementierung

**SSE Event erweitern:** `task:complete` bekommt zusätzliche Felder:

```typescript
{
  event: 'task:complete',
  data: {
    // ... bestehende Felder ...
    model: 'mistral:mistral-large-latest',
    modelLocation: 'eu-cloud',      // 'local' | 'eu-cloud'
    inputTokens: 1200,
    outputTokens: 800,
    estimatedCost: 0.004,           // EUR, nur bei Cloud
    routingDecision: 'rag-complex', // Was der Router entschied
  }
}
```

**Frontend:** Neue Komponente `TransparencyBar` unter jeder Agent-Antwort in `AgentTaskDetail.tsx`.

---

## 5. Fehlerbehandlung

### 5.1 Cloud nicht erreichbar

Wenn Mistral/IONOS nicht erreichbar ist:
1. **Kein automatischer Fallback auf lokal** — lokales Model ist zu schwach für komplexe Aufgaben
2. **Fehlermeldung** an den User: `"EU-Cloud nicht erreichbar. Bitte versuche es erneut."`
3. **Retry-Button** in der Fehlermeldung

### 5.2 Lokales Model nicht erreichbar (Ollama down)

1. **Fehlermeldung:** `"Lokaler KI-Service nicht verfügbar."`
2. **Kein Fallback auf Cloud** — Routing-Entscheidung kann nicht getroffen werden

### 5.3 Timeout

- Lokales Model: 60s Timeout
- Cloud Model: 120s Timeout
- Bei Timeout: Fehlermeldung + Retry-Button

---

## 6. Konfiguration

### 6.1 Umgebungsvariablen

| Variable | Default | Beschreibung |
|---|---|---|
| `LOCAL_MODEL` | `qwen3:14b` | Lokales Ollama Model |
| `CLOUD_MODEL` | `mistral:mistral-large-latest` | EU-Cloud Model |
| `CLOUD_FALLBACK_MODEL` | `ionos:llama-3.3-70b` | Fallback EU-Cloud |
| `MISTRAL_API_KEY` | — | Mistral API Key |
| `IONOS_API_KEY` | — | IONOS API Key |
| `ROUTING_EMBEDDING_THRESHOLD` | `0.75` | Embedding-Similarity für RAG-Routing |
| `MAX_AGENT_ITERATIONS` | `10` | Max Steps pro Turn |
| `AGENT_TIMEOUT_MS` | `300000` | Timeout in ms |

### 6.2 Admin-Settings (Zukunft)

- Default-Model pro Rolle (Employee: lokal, Manager: Cloud)
- Cloud-Budget pro User/Abteilung
- Routing-Schwellenwerte anpassen

---

## 7. Was bereits implementiert ist

| Feature | Status | Datei(en) |
|---|---|---|
| Chat entfernt, Agent als einziger Kanal | ✅ | App.tsx, IconRail.tsx |
| Multi-Turn Konversationen | ✅ | AgentExecutor.ts, AgentContext.tsx |
| 11 Agent-Tools | ✅ | server/src/services/agents/tools/ |
| SSE Streaming | ✅ | routes/agents.ts |
| Sidebar mit Datums-Gruppierung | ✅ | AgentTaskSidebar.tsx |
| Kontextmenü mit Löschen | ✅ | AgentTaskSidebar.tsx |
| ChatInput immer sichtbar | ✅ | AgentTaskDetail.tsx |
| Floating Scroll-to-Bottom | ✅ | AgentTaskDetail.tsx |
| Zwei LLM-Provider (Ollama + Anthropic) | ✅ | ai-provider.ts |
| PII-Schutz für Cloud | ✅ | ai-middleware.ts |
| RLS + Rollen | ✅ | AgentPersistence.ts |

## 8. Was implementiert werden muss

| Feature | Priorität | Aufwand | Abhängigkeiten |
|---|---|---|---|
| **Cascade Query-Router** | Hoch | Mittel | Embedding-Service (BGE-M3 bereits vorhanden) |
| **Mistral Provider Integration** | Hoch | Klein | `@ai-sdk/mistral` Paket |
| **IONOS Provider Integration** | Mittel | Klein | OpenAI-kompatible API |
| **System-Prompt flexibilisieren** | Hoch | Klein | Query-Router |
| **Transparenz-Leiste (Frontend)** | Mittel | Klein | SSE Event Erweiterung |
| **SSE Event um Model-Info erweitern** | Mittel | Klein | — |
| **Tool-Set Kuratierung pro Route** | Mittel | Klein | Query-Router |
| **Fehlerbehandlung Cloud-Ausfall** | Mittel | Klein | — |
| **Model-Selector Override (Settings)** | Niedrig | Klein | Admin-Settings |

### Implementierungs-Reihenfolge

1. Mistral + IONOS Provider in `ai-provider.ts` einbinden
2. `QueryRouter.ts` implementieren (Heuristik + Embedding + LLM-Klassifikation)
3. System-Prompt von RAG-first auf Router-gesteuert umstellen
4. SSE Events um Model/Cost-Daten erweitern
5. `TransparencyBar` Komponente im Frontend
6. Fehlerbehandlung und Fallback-Logik

---

## 9. Verifikation

1. **Einfache Frage** ("Was ist eine GmbH?") → Router wählt `direct`, lokales Model, kein RAG
2. **Firmenfrage** ("Welche Verträge haben wir mit Müller GmbH?") → Router wählt `rag`, lokales Model + RAG
3. **Komplexe Aufgabe** ("Analysiere alle Verträge und erstelle Risikobericht") → Router wählt `rag-complex`, Cloud Model + RAG + Multi-Step
4. **Transparenz** → Nach jeder Antwort: Model, Location, Tokens, Kosten sichtbar
5. **Cloud-Ausfall** → Fehlermeldung, kein stiller Fallback
6. **DSGVO** → Sensible Daten gehen nur an EU-Server (Mistral Paris / IONOS Deutschland)
7. **Kosten** → Einfache Fragen kosten nichts (lokal), komplexe Fragen zeigen Kosten an
