# Spec: Hybrid Agent Architecture — Search-First Pipeline + Evaluation

**Status:** Geplant
**Bezug:** [00_COR7EX_VISION.md](./00_COR7EX_VISION.md) — "Ein Kanal: Agent-Konversationen"
**Erweitert:** [12_AGENT_KONVERSATION_SPEC.md](./12_AGENT_KONVERSATION_SPEC.md)

---

## Zusammenfassung

Das lokale Modell (Qwen 3:8b via Ollama) nutzt Agent-Tools (`rag_search`) nicht zuverlässig — es halluziniert statt zu suchen. Ursache: Ollama unterstützt kein `toolChoice` zur Erzwingung von Tool-Aufrufen auf API-Level. Cloud-Modelle (gpt-oss-120b via OVH) unterstützen `toolChoice: 'required'` und nutzen Tools zuverlässig.

**Lösung:** Eine Hybrid-Architektur die beide Modelle optimal einsetzt:
- **Einfache Fragen** → RAG-Suche deterministisch VOR dem LLM-Call, Ergebnisse als Kontext injizieren, Qwen antwortet (schnell, kostenlos)
- **Komplexe Aufgaben** → gpt-oss-120b mit voller Tool-Autonomie via `toolChoice` (zuverlässig, kostet Cloud-Tokens)

Ein Evaluation-Framework misst ob die Hybrid-Lösung besser ist als Cloud-Only.

---

## Hintergrund: Warum `toolChoice` bei Ollama nicht funktioniert

```
Cloud API (Anthropic, OpenAI, OVH):
  Request + toolChoice:'required' → API-Server ERZWINGT Tool-Call
  → Modell kann nur Tool-Call-Tokens generieren, kein freier Text

Ollama:
  Request + Tools → Ollama baut Prompt mit Tool-Beschreibungen
  → Modell generiert FREI → kann Tools ignorieren → Halluzination
```

**Messung (Ist-Zustand):**

| Modell | Tasks | Tool-Use Erfolg | Erfolgsrate |
|--------|-------|-----------------|-------------|
| gpt-oss-120b (OVH) | 5 | 5 | **100%** |
| Mistral Large (EU) | 4 | 4 | **100%** |
| Qwen 3:8b (Lokal) | 3 | 1 | **33%** |

---

## 1. Architektur

```
User-Query
  │
  ├─ Step 1: QueryClassifier (Heuristik, ~0ms)
  │   → simple: Zusammenfassung, Übersetzung, Erklärung, einfache Frage
  │   → complex: Report, Recherche, Analyse, Skill-Nutzung, Multi-Step
  │
  ├─ Wenn simple:
  │   ├─ RAG-Suche deterministisch ausführen (vectorServiceV2.search)
  │   │   → mit allowedDocumentIds (Rechte-Filter)
  │   ├─ Ergebnisse als <search_results> in System-Prompt injizieren
  │   └─ Qwen antwortet mit Kontext → schnell, kostenlos, korrekt
  │
  └─ Wenn complex:
      └─ gpt-oss-120b mit voller Tool-Autonomie
          → prepareStep: toolChoice='required' auf Step 0
          → kann rag_search, read_chunk, load_skill, graph_query nutzen
```

### 1.1 Prinzipien

1. **Immer suchen**: Für einfache Queries wird die RAG-Suche automatisch ausgeführt (Kosten: ~100ms). Das Modell muss nicht entscheiden ob es suchen soll.
2. **Klassifikation statt Routing**: Der QueryClassifier entscheidet nur die Komplexität (simple/complex), nicht ob RAG genutzt wird.
3. **Ausnahmeliste**: Offensichtlich nicht-RAG Queries (Übersetzung, Mathe) überspringen die Vor-Suche.
4. **Cloud für Autonomie**: Komplexe Aufgaben gehen an gpt-oss, das selbständig Tools aufrufen, Skills laden und iterieren kann.

### 1.2 Rollen der Modelle

| Aufgabe | Modell | Grund |
|---------|--------|-------|
| Einfache Frage + RAG-Kontext | **Qwen 3:8b** | Kann gut zusammenfassen wenn Kontext gegeben |
| Übersetzung, Mathe, Allgemeinwissen | **Qwen 3:8b** | Kein RAG nötig |
| Report erstellen, Recherche | **gpt-oss-120b** | Braucht Tool-Autonomie (Multi-Step) |
| Skill-basierte Aufgaben | **gpt-oss-120b** | Muss Skills laden und befolgen |
| Analyse, Vergleich | **gpt-oss-120b** | Braucht mehrere Suchschritte |

---

## 2. Implementierung

### 2.1 QueryClassifier (Neue Datei)

**Datei:** `server/src/services/agents/QueryClassifier.ts`

Reine synchrone Funktion, 0ms Latenz. Wiederverwendet Patterns aus bestehendem QueryRouter.

```typescript
interface ClassificationResult {
  complexity: 'simple' | 'complex';
  skipPreSearch: boolean;  // true für Übersetzung, Mathe etc.
  reason: string;
}

function classify(query: string): ClassificationResult
```

**Klassifikationsregeln:**

| Erkennung | Ergebnis | Beispiel |
|-----------|----------|---------|
| Complex-Marker (analysiere, vergleiche, erstelle report, recherche, skill) | `complex` | "Erstelle einen Report über..." |
| Query > 200 Zeichen + Firmen-Keywords | `complex` | Lange detaillierte Anfragen |
| Skip-Marker (übersetze, berechne, was ist X+Y) ohne Firmen-Bezug | `simple, skipPreSearch=true` | "Übersetze das auf Englisch" |
| Alles andere | `simple, skipPreSearch=false` | "Worum geht es im AMA Dokument?" |

### 2.2 Search-First Pipeline (AgentExecutor Erweiterung)

**Datei:** `server/src/services/agents/AgentExecutor.ts`

Neue Methode `executeHybrid()`:

```typescript
async executeHybrid(
  query: string,
  context: AgentUserContext,
  classification: ClassificationResult,
  options?: ExecuteOptions
): Promise<AgentTask>
```

**Für simple + !skipPreSearch:**
1. `vectorServiceV2.search({ query, limit: 5, hybridAlpha: 0.3, allowedDocumentIds, levelFilter: [1,2] })`
2. Ergebnisse formatieren und in System-Prompt injizieren:
   ```
   <search_results>
   Dokument: AMA.pdf | Seite: 1 | Score: 0.85
   Inhalt: Die AMA-Richtlinie beschreibt...
   ---
   Dokument: AMA.pdf | Seite: 3 | Score: 0.72
   Inhalt: Kernpunkte der Vereinbarung...
   </search_results>

   Beantworte die Frage basierend auf den obigen Dokumenten.
   Wenn die Dokumente keine relevante Information enthalten, sage das ehrlich.
   ```
3. `execute()` mit LOCAL_MODEL aufrufen

**Für simple + skipPreSearch:**
- `execute()` direkt mit LOCAL_MODEL (keine Vor-Suche)

**Für complex:**
- `execute()` mit CLOUD_MODEL + `routingDecision: 'rag-complex'`
- Bestehendes `prepareStep` erzwingt `toolChoice: 'required'`

### 2.3 Route-Anpassung

**Datei:** `server/src/routes/agents.ts`

```typescript
// Vorher:
const routing = await queryRouter.route(query);
// effectiveModel basierend auf routing.model

// Nachher:
const classification = queryClassifier.classify(query);
// Bei complex → CLOUD_MODEL
// Bei simple → LOCAL_MODEL
// agentExecutor.executeHybrid(query, context, classification, ...)
```

### 2.4 SSE Event Erweiterung

**Datei:** `server/src/services/agents/types.ts`

Neues Feld `strategy` in `task:complete` Event:
```typescript
strategy?: 'hybrid-local' | 'hybrid-cloud' | 'cloud-only' | 'local-only';
```

---

## 3. Agent Evaluation Framework

### 3.1 Übersicht

Erweitert das bestehende Evaluation-System um Agent-spezifische Metriken. Nutzt den Golden Dataset und führt dieselben Queries durch drei Strategien:

| Strategie | Beschreibung | Erwartung |
|-----------|-------------|-----------|
| **hybrid** | QueryClassifier + Search-First/Cloud | Gute Qualität, niedrige Kosten |
| **cloud-only** | Alles über gpt-oss + toolChoice | Beste Qualität, höchste Kosten |
| **local-only** | Alles über Qwen ohne Pre-Search | Baseline (kaputt, halluziniert) |

### 3.2 Metriken

**Qualität:**
- `keyFactsCovered` (0-1): Anteil der erwarteten Key Facts in der Antwort
- `groundedness` (0-1): Ist die Antwort durch RAG-Ergebnisse gestützt?
- `hallucinationDetected` (bool): Enthält die Antwort verbotene/erfundene Inhalte?

**Tool-Zuverlässigkeit:**
- `usedRAG` (bool): Wurde RAG-Kontext genutzt (Pre-Search oder rag_search Tool)?
- `expectedToolUsed` (bool): Wurde das richtige Tool aufgerufen?
- `ragResultCount` (int): Wie viele Dokumente wurden gefunden?

**Kosten:**
- `model` (string): Welches Modell wurde genutzt?
- `inputTokens`, `outputTokens` (int): Token-Verbrauch
- `estimatedCostEUR` (float): Geschätzte Kosten in EUR

**Latenz:**
- `classificationMs`: Zeit für QueryClassifier
- `preSearchMs`: Zeit für RAG-Vorsuche (0 wenn übersprungen)
- `generationMs`: Zeit für LLM-Antwort
- `totalMs`: Gesamtzeit

### 3.3 Datenbank

**Migration:** `server/src/migrations/018_agent_evaluation.sql`

```sql
-- Evaluation-Runs: Eine Ausführung pro Strategie
CREATE TABLE agent_evaluation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  strategy TEXT NOT NULL,
  config JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  -- Aggregierte Metriken
  avg_key_facts_covered REAL,
  avg_groundedness REAL,
  hallucination_rate REAL,
  rag_usage_rate REAL,
  tool_reliability_rate REAL,
  avg_latency_ms INTEGER,
  total_cost_eur REAL,
  query_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Einzelergebnisse pro Query
CREATE TABLE agent_evaluation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES agent_evaluation_runs(id) ON DELETE CASCADE,
  golden_query_id TEXT NOT NULL,
  -- Klassifikation
  classification_complexity TEXT,
  classification_reason TEXT,
  skip_pre_search BOOLEAN,
  -- Qualität
  answer TEXT,
  key_facts_covered REAL,
  hallucination_detected BOOLEAN,
  groundedness REAL,
  used_rag BOOLEAN,
  rag_result_count INTEGER,
  -- Kosten
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  estimated_cost_eur REAL,
  -- Latenz
  classification_ms INTEGER,
  pre_search_ms INTEGER,
  generation_ms INTEGER,
  total_ms INTEGER,
  -- Tool-Reliability
  tool_calls_attempted INTEGER,
  tool_calls_succeeded INTEGER,
  expected_tool_used BOOLEAN,
  -- Debug
  agent_task_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 3.4 API Endpoints

**Datei:** `server/src/routes/agent-evaluation.ts`

| Endpoint | Beschreibung |
|----------|-------------|
| `POST /api/agent-eval/runs` | Strategie evaluieren: `{ strategy: 'hybrid' }` |
| `GET /api/agent-eval/runs` | Alle Runs auflisten |
| `GET /api/agent-eval/runs/:id` | Run mit Einzelergebnissen |
| `POST /api/agent-eval/benchmark` | Alle 3 Strategien vergleichen |

### 3.5 Benchmark-Output (Beispiel)

```json
{
  "hybrid":     { "groundedness": 0.85, "latencyMs": 320,  "costEUR": 0.02, "toolReliability": 0.95 },
  "cloud-only": { "groundedness": 0.92, "latencyMs": 1200, "costEUR": 0.15, "toolReliability": 1.00 },
  "local-only": { "groundedness": 0.40, "latencyMs": 250,  "costEUR": 0.00, "toolReliability": 0.20 }
}
```

---

## 4. Dateien

### Neue Dateien (4):
1. `server/src/services/agents/QueryClassifier.ts` — Klassifikation simple/complex
2. `server/src/services/evaluation/AgentEvaluationService.ts` — Agent-Benchmark-Runner
3. `server/src/routes/agent-evaluation.ts` — API-Endpoints
4. `server/src/migrations/018_agent_evaluation.sql` — DB-Schema

### Modifizierte Dateien (5):
1. `server/src/services/agents/AgentExecutor.ts` — `executeHybrid()`, `buildPreSearchPrompt()`
2. `server/src/services/agents/types.ts` — `ClassificationResult`, `AgentStrategy`
3. `server/src/routes/agents.ts` — QueryClassifier statt QueryRouter
4. `server/src/services/agents/index.ts` — Export
5. `server/src/index.ts` — Route mounten

### Unverändert:
- `QueryRouter.ts` — wird noch von RAG-EvaluationService genutzt
- `rag-search.ts` Tool — Cloud-Pfad nutzt es weiterhin
- `ToolRegistry.ts`, `ai-provider.ts` — keine Änderungen

---

## 5. Erfolgs-Kriterien

| Metrik | Hybrid Ziel | Cloud-Only Baseline |
|--------|------------|-------------------|
| Groundedness | ≥ 0.80 | ~0.92 |
| Tool-Reliability | ≥ 0.90 | 1.00 |
| Hallucination Rate | ≤ 0.10 | ~0.05 |
| Ø Kosten pro Query | ≤ 30% von Cloud-Only | 100% |
| Ø Latenz | ≤ 500ms (simple) | ~1200ms |

**Die Hybrid-Lösung ist erfolgreich wenn:**
- Qualität (Groundedness) mindestens 85% des Cloud-Only Levels erreicht
- Kosten um mindestens 60% sinken
- Einfache Fragen in < 500ms beantwortet werden
