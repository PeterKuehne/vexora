# RAG System Improvements Specification

**Version:** 1.0
**Datum:** 2026-02-04
**Status:** Draft
**Autor:** Claude Code Analysis

---

## 1. Executive Summary

Diese Spezifikation dokumentiert die identifizierten Schwachstellen im aktuellen RAG-System und definiert die notwendigen Verbesserungen. Die Analyse basiert auf einer umfassenden Code-Review und dem Vergleich mit aktuellen Best Practices (EMNLP 2024, Industry Standards 2025).

### Kernproblem

Das aktuelle System verliert relevante Chunks während der Retrieval-Phase. Ein Dokument kann teilweise gefunden werden, aber kritische Informationen (z.B. Arbeitserfahrung in einem Lebenslauf) werden nicht an das LLM weitergegeben.

### Lösungsansatz

**Document Expansion Strategy**: Wenn ein Chunk eines Dokuments gefunden wird, werden alle Chunks dieses Dokuments abgerufen und dem LLM zur Verfügung gestellt.

---

## 2. Identifizierte Probleme

### 2.1 Kritisch (P0) - Chunk-Verlust

| ID | Problem | Auswirkung |
|----|---------|------------|
| P0-1 | **Document Expansion fehlt** | Relevante Chunks desselben Dokuments werden nicht abgerufen |
| P0-2 | **Level-Filter zu restriktiv** | Nur Level 2 (Paragraphen) wird durchsucht; Level 0/1 ignoriert |
| P0-3 | **Parent-Context Fetch fehlerhaft** | UUID/Path-Verwechslung verhindert Kontext-Enrichment |

### 2.2 Hoch (P1) - Qualitätsverlust

| ID | Problem | Auswirkung |
|----|---------|------------|
| P1-1 | **Overlap nicht implementiert** | Kontext geht an Chunk-Grenzen verloren |
| P1-2 | **hybridAlpha suboptimal** | 50/50 Keyword/Semantic ist für deutsche Fachtexte ungünstig |
| P1-3 | **Reranker-Score ungenutzt** | Bessere Scores werden weggeworfen |
| P1-4 | **Threshold-Anwendung nach Limit** | Unvorhersehbare Ergebnisanzahl |

### 2.3 Mittel (P2) - Optimierungspotenzial

| ID | Problem | Auswirkung |
|----|---------|------------|
| P2-1 | **Extractive Summaries zu kurz** | Document-Level Chunks sind wenig aussagekräftig |
| P2-2 | **Query-Strategien nicht implementiert** | Query-Typ hat keinen Einfluss auf Retrieval |
| P2-3 | **minChunkSize zu klein** | Zu viele fragmentierte Mini-Chunks |
| P2-4 | **Percentile-Breakpoints instabil** | Inkonsistente Chunk-Qualität |

---

## 3. Document Expansion Strategy

### 3.1 Konzept

Document Expansion löst das Problem, dass relevante Informationen in verschiedenen Chunks desselben Dokuments verteilt sind. Anstatt nur die Top-K Chunks zu verwenden, werden alle Chunks der gefundenen Dokumente abgerufen.

### 3.2 Funktionsweise

1. **Initial Retrieval**: Hybrid-Suche findet Top-N Chunks basierend auf Query
2. **Document Identification**: Einzigartige Document-IDs aus den Ergebnissen extrahieren
3. **Expansion**: Alle Chunks der identifizierten Dokumente abrufen
4. **Deduplication**: Duplikate entfernen (bereits gefundene Chunks)
5. **Ordering**: Chunks nach Document-ID und Chunk-Index sortieren
6. **Context Building**: Vollständigen Dokumentkontext an LLM übergeben

### 3.3 Konfigurationsparameter

| Parameter | Beschreibung | Standardwert |
|-----------|--------------|--------------|
| `enableDocumentExpansion` | Feature aktivieren/deaktivieren | `true` |
| `maxDocumentsToExpand` | Maximale Anzahl Dokumente für Expansion | `3` |
| `maxChunksPerDocument` | Maximale Chunks pro erweitertes Dokument | `20` |
| `expansionThreshold` | Minimaler Score für Expansion-Trigger | `0.3` |

### 3.4 Anwendungsfälle

**Geeignet für:**
- Kleine bis mittlere Dokumente (< 50 Chunks)
- Fragen, die Informationen aus verschiedenen Dokumentteilen benötigen
- Lebenslauf-Analysen, Vertragsanalysen, Zusammenfassungen

**Nicht geeignet für:**
- Sehr große Dokumente (> 100 Chunks) - Context-Window-Limit
- Needle-in-Haystack-Suchen über viele Dokumente

### 3.5 Betroffene Komponenten

| Komponente | Änderungstyp | Beschreibung |
|------------|--------------|--------------|
| `RAGService.ts` | Erweiterung | Document Expansion Logik nach Retrieval |
| `VectorServiceV2.ts` | Neue Methode | Methode zum Abrufen aller Chunks eines Dokuments |
| `RAGRequest` Interface | Erweiterung | Neue Konfigurationsparameter |

### 3.6 Akzeptanzkriterien

- [x] Bei einer Suche in einem 7-Chunk-Dokument werden alle 7 Chunks abgerufen, wenn mindestens einer gefunden wird
- [x] Die Expansion respektiert `maxDocumentsToExpand` und `maxChunksPerDocument`
- [x] Dokumente unter `expansionThreshold` werden nicht expandiert
- [x] Die Chunk-Reihenfolge bleibt erhalten (nach Index sortiert)
- [x] Performance-Impact < 100ms zusätzliche Latenz
- [x] Logging zeigt Expansion-Aktivität

### 3.7 Implementierung (2026-02-05)

**Status:** ✅ Implementiert

**Geänderte Dateien:**
- `server/src/services/VectorServiceV2.ts`: Neue Methode `getChunksByDocumentIds()`
- `server/src/services/RAGService.ts`: Document Expansion Logik nach Reranking (beide Methoden)

**Neue Parameter in RAGRequest:**
```typescript
enableDocumentExpansion?: boolean  // Default: true
maxDocumentsToExpand?: number      // Default: 3
maxChunksPerDocument?: number      // Default: 20
expansionThreshold?: number        // Default: 0.3
```

**Funktionsweise:**
1. Nach Reranking werden einzigartige Document-IDs aus Ergebnissen extrahiert
2. Nur Dokumente mit Score >= expansionThreshold qualifizieren sich
3. Maximal `maxDocumentsToExpand` Dokumente werden expandiert
4. Alle Level-2 Chunks dieser Dokumente werden geladen
5. Duplikate werden entfernt, neue Chunks mit Score 0.1 markiert
6. Logging: "📄 Document Expansion: Added X chunks from Y document(s)"

---

## 4. Level-Filter Erweiterung

### 4.1 Konzept

Das aktuelle System durchsucht nur Level 2 (Paragraph-Chunks). Document Summaries (Level 0) und Section Summaries (Level 1) werden ignoriert, obwohl sie für Übersichtsfragen relevant sein können.

### 4.2 Funktionsweise

Der Level-Filter wird dynamisch basierend auf Query-Typ angepasst:

| Query-Typ | Level-Filter | Begründung |
|-----------|--------------|------------|
| Factual (Was/Wer/Wo) | `[1, 2]` | Sections für Kontext + Paragraphen |
| Aggregative (Liste/Übersicht) | `[0, 1, 2]` | Summaries enthalten Übersichten |
| Comparative (Vergleich) | `[1, 2]` | Sections + Details |
| Procedural (Wie/Anleitung) | `[1, 2]` | Sections + Details für Schritte |
| Relational (Zusammenhänge) | `[1, 2]` | Sections für Struktur |
| Temporal (Wann/Zeit) | `[1, 2]` | Sections + Details |
| Default | `[1, 2]` | Balancierter Ansatz |

### 4.3 Betroffene Komponenten

| Komponente | Änderungstyp |
|------------|--------------|
| `RAGService.ts` | Query-Typ-basierte Level-Auswahl |
| `QueryRouter.ts` | Level-Empfehlung pro Query-Typ |
| `RAGRequest` Interface | `levelFilter` als optionaler Override |

### 4.4 Akzeptanzkriterien

- [x] Aggregative Queries durchsuchen alle Level
- [x] Factual Queries durchsuchen Level 1+2 (geändert für besseren Kontext)
- [ ] Level-Filter kann manuell überschrieben werden
- [x] Default-Verhalten ist `[1, 2]`

### 4.5 Implementierung (2026-02-05)

**Status:** ✅ Implementiert

**Geänderte Dateien:**
- `server/src/services/rag/QueryRouter.ts`:
  - Import von `ChunkLevel` aus `../../types/chunking.js`
  - Erweiterung `QueryAnalysis` Interface mit `recommendedLevelFilter: ChunkLevel[]`
  - Neue Methode `getLevelFilterForQueryType(queryType, isMultiHop)`
- `server/src/services/RAGService.ts`:
  - Nutzung von `queryAnalysis.recommendedLevelFilter` statt hardcoded `[2]`
  - Logging zeigt verwendeten Level-Filter: `levels=1,2`

**Funktionsweise:**
1. QueryRouter analysiert die Query und bestimmt den Query-Typ
2. Basierend auf Query-Typ wird ein optimaler Level-Filter empfohlen
3. RAGService nutzt den empfohlenen Level-Filter für die Suche
4. Für aggregative Queries (Übersicht, Liste, alle) werden alle Level durchsucht
5. Für alle anderen Queries werden Level 1+2 durchsucht (Sections + Paragraphen)

**Logging:**
```
🔀 Query routed: type=factual, strategy=hybrid, entities=1, levels=1,2
🔍 Using V2 hierarchical search with levelFilter=1,2
```

---

## 5. Parent-Context Fix

### 5.1 Problem

Die aktuelle Implementierung vergleicht UUIDs mit Pfad-Strings, was zum Scheitern des Parent-Context-Enrichments führt.

**Ursprünglicher Bug:**
- `parentChunkId` enthält interne IDs wie `chunk_1234567890_abc123def`
- Diese IDs werden aber nicht als durchsuchbare Property in Weaviate gespeichert
- Die Abfrage versuchte `path` mit diesen IDs zu vergleichen → keine Treffer

### 5.2 Lösung

Parent-Pfade werden aus Child-Pfaden abgeleitet (z.B. `doc/section-1/chunk-0` → `doc/section-1`), anstatt die nicht-gespeicherte `parentChunkId` zu verwenden.

### 5.3 Betroffene Komponenten

| Komponente | Änderungstyp |
|------------|--------------|
| `VectorServiceV2.ts` | Fix der `enrichWithParentContext` Methode |

### 5.4 Akzeptanzkriterien

- [x] Parent-Chunks werden korrekt abgerufen
- [x] Chunk-Inhalt wird mit Parent-Kontext angereichert
- [x] Keine Fehler bei Chunks ohne Parent

### 5.5 Implementierung (2026-02-05)

**Status:** ✅ Implementiert

**Geänderte Dateien:**
- `server/src/services/VectorServiceV2.ts`: Methode `enrichWithParentContext()`

**Funktionsweise (neu):**
1. Für Level-2 Chunks wird der Parent-Pfad aus dem Chunk-Pfad abgeleitet
   - `doc/section-1/chunk-0` → `doc/section-1`
2. Alle einzigartigen Parent-Pfade werden gesammelt
3. Parent-Chunks werden per `Filters.or()` mit exakten Pfad-Matches abgefragt
4. Parent-Content wird als Kontext-Prefix zum Chunk-Content hinzugefügt

**Logging:**
```
📎 Parent context: Found 3 of 3 parent chunks
```

---

## 6. Chunk Overlap Implementation

### 6.1 Konzept

Aktuell haben Chunks keine Überlappung. Information an Chunk-Grenzen kann verloren gehen. Overlap stellt sicher, dass Kontext erhalten bleibt.

### 6.2 Konfiguration

| Parameter | Beschreibung | Standardwert |
|-----------|--------------|--------------|
| `overlapSize` | Anzahl Zeichen Überlappung | `50` |
| `overlapStrategy` | `prefix` (von vorherigem Chunk) | `prefix` |

### 6.3 Betroffene Komponenten

| Komponente | Änderungstyp |
|------------|--------------|
| `SemanticChunker.ts` | Overlap-Logik implementieren |
| `ChunkingPipeline.ts` | Overlap-Konfiguration durchreichen |
| `ChunkMetadata` | Neue Felder `overlapPrefix`, `overlapSuffix`, `overlapSize` |

### 6.4 Akzeptanzkriterien

- [x] Aufeinanderfolgende Chunks haben gemeinsamen Inhalt
- [x] Overlap-Größe ist konfigurierbar
- [x] Overlap wird in Metadata gespeichert (nicht im Content dupliziert)

### 6.5 Implementierung (2026-02-05)

**Status:** ✅ Implementiert

**Geänderte Dateien:**
- `server/src/types/chunking.ts`:
  - Erweitert `ChunkMetadata` mit `overlapPrefix`, `overlapSuffix`, `overlapSize`
- `server/src/services/chunking/SemanticChunker.ts`:
  - Neue Methode `applyOverlapToChunks(chunks)`
  - Neue Methode `extractOverlapText(content, targetSize)`
  - Integration in `createChunksFromGroups()`

**Funktionsweise:**
1. Nach dem Erstellen aller Chunks wird `applyOverlapToChunks()` aufgerufen
2. Für jeden Chunk (außer dem ersten) wird Overlap vom vorherigen Chunk extrahiert
3. Der Overlap wird an Wortgrenzen ausgerichtet (kein Abschneiden mitten im Wort)
4. Overlap wird in `metadata.overlapPrefix` gespeichert, nicht im `content`
5. Dies verhindert doppelte Embedding-Berechnung für überlappende Inhalte

**Design-Entscheidung:**
Der Overlap wird in Metadata gespeichert statt im Content, weil:
- Embeddings nur für den eigentlichen Content berechnet werden
- Bei Bedarf kann der Overlap für LLM-Kontext hinzugefügt werden
- Keine doppelte Gewichtung bei der Suche

**Logging:**
```
🔗 Applied 50 char overlap to 6 chunk boundaries
```

---

## 7. Hybrid-Alpha Optimierung

### 7.1 Problem

Der aktuelle Wert `hybridAlpha = 0.5` gewichtet Keyword- und Semantic-Suche gleich. Für deutsche Fachtexte mit spezifischer Terminologie ist mehr Keyword-Gewichtung oft besser.

### 7.2 Lösung

- Standardwert auf `0.3` ändern (70% Keyword, 30% Semantic)
- Query-Typ-basierte Anpassung ermöglichen
- Umgebungsvariable für globale Konfiguration

### 7.3 Empfohlene Werte

| Dokumenttyp | hybridAlpha | Begründung |
|-------------|-------------|------------|
| Fachtexte (DE) | 0.2-0.3 | Terminologie wichtig |
| Allgemeine Texte | 0.4-0.5 | Balanciert |
| Narrative Texte | 0.6-0.7 | Semantik wichtiger |

### 7.4 Akzeptanzkriterien

- [ ] Standardwert ist `0.3`
- [ ] Wert kann per Request überschrieben werden
- [ ] Umgebungsvariable `HYBRID_ALPHA` wird respektiert

---

## 8. Reranker-Score Nutzung

### 8.1 Problem

Der Reranker berechnet neue Scores, aber diese werden nicht in die Ausgabe übernommen. Die UI zeigt die alten Hybrid-Scores.

### 8.2 Lösung

Reranker-Scores werden als primäre Scores verwendet und in der Ausgabe angezeigt.

### 8.3 Betroffene Komponenten

| Komponente | Änderungstyp |
|------------|--------------|
| `RAGService.ts` | Reranker-Score in Ergebnis übernehmen |
| `RAGResponse` Interface | Score-Typ dokumentieren |

### 8.4 Akzeptanzkriterien

- [ ] Nach Reranking zeigt `score` den Reranker-Score
- [ ] Original-Score optional als `hybridScore` verfügbar
- [ ] Logging zeigt beide Scores

---

## 9. Contextual Retrieval

### 9.1 Konzept

Basierend auf Anthropic's Contextual Retrieval Technik (September 2024). Traditionelles Chunking entfernt Kontext. Contextual Retrieval fügt jedem Chunk einen kurzen, LLM-generierten Kontext hinzu.

**Ergebnisse (Anthropic):**
- 49% Reduktion fehlgeschlagener Retrievals
- 67% Reduktion mit zusätzlichem Reranking

### 9.2 Konfiguration

| Parameter | Beschreibung | Standardwert |
|-----------|--------------|--------------|
| `CONTEXTUAL_RETRIEVAL_ENABLED` | Feature aktivieren | `false` |
| `CONTEXTUAL_RETRIEVAL_MODEL` | LLM für Kontext-Generierung | `qwen3:14b` |
| `maxContextLength` | Maximale Kontextlänge | `200` chars |
| `batchSize` | Parallele Verarbeitung | `5` |
| `minChunkSizeForContext` | Min. Chunk-Größe für Kontext | `50` chars |

### 9.3 Betroffene Komponenten

| Komponente | Änderungstyp |
|------------|--------------|
| `ContextualRetrieval.ts` | Neuer Service |
| `ChunkingPipeline.ts` | Integration des Services |
| `ChunkMetadata` | Neue Felder `hasContextualContext`, `originalContent` |

### 9.4 Akzeptanzkriterien

- [x] LLM generiert Kontext für jeden Level-2 Chunk
- [x] Kontext wird vor Embedding zum Content hinzugefügt
- [x] Original-Content wird in Metadata gespeichert
- [x] Feature ist per Umgebungsvariable aktivierbar

### 9.5 Implementierung (2026-02-05)

**Status:** ✅ Implementiert

**Neue Dateien:**
- `server/src/services/rag/ContextualRetrieval.ts`: Neuer Service

**Geänderte Dateien:**
- `server/src/services/chunking/ChunkingPipeline.ts`: Integration nach Hierarchical Indexing
- `server/src/types/chunking.ts`: Neue Metadata-Felder

**Funktionsweise:**
1. Nach dem Chunking wird `enrichChunksWithContext()` aufgerufen (wenn aktiviert)
2. Für jeden Level-2 Chunk wird ein LLM-Prompt erstellt:
   - Dokument-Inhalt (gekürzt auf 8000 Zeichen)
   - Chunk-Content
   - Aufforderung zur Kontext-Generierung
3. LLM generiert 2-3 Sätze Kontext (max. 200 Zeichen)
4. Kontext wird vor den Chunk-Content gestellt
5. Original-Content wird in `metadata.originalContent` gespeichert

**Prompt-Template:**
```
<document>{{DOCUMENT_CONTENT}}</document>
Here is the chunk we want to situate within the whole document:
<chunk>{{CHUNK_CONTENT}}</chunk>
Please give a short succinct context to situate this chunk...
```

**Logging:**
```
🧠 Applying Contextual Retrieval...
📝 Contextual Retrieval: Generating context for 7 chunks...
   Progress: 5/7 chunks
   Progress: 7/7 chunks
✅ Contextual Retrieval: Generated 7 contexts in 12500ms
```

**Hinweis:** Dieses Feature ist standardmäßig DEAKTIVIERT, da es einen LLM-Call pro Chunk benötigt. Aktivierung via `CONTEXTUAL_RETRIEVAL_ENABLED=true`.

---

## 10. Contextual Embeddings

### 10.1 Konzept

Contextual Embeddings nutzen den LLM-generierten Kontext aus Contextual Retrieval für die Embedding-Generierung. Der Kontext wird vor den Chunk-Content gestellt, wodurch die Embeddings mehr Dokumentkontext enthalten.

### 10.2 Implementierung

**Status:** ✅ Implizit implementiert (Teil von Contextual Retrieval)

Die Implementierung erfolgt automatisch durch die ChunkingPipeline:

1. ChunkingPipeline ersetzt `chunk.content` mit `contextualContent` (Kontext + Original)
2. VectorServiceV2 nutzt `chunks.map((c) => c.content)` für Embeddings
3. Dadurch werden Embeddings automatisch mit Kontext generiert

**Kein zusätzlicher Code erforderlich** - die Architektur unterstützt dies bereits.

**Vorteil:**
- Embeddings enthalten Dokumentkontext
- Bessere semantische Ähnlichkeit bei der Suche
- Keine Änderung am VectorService nötig

---

## 11. Contextual BM25

### 11.1 Konzept

Contextual BM25 nutzt den LLM-generierten Kontext für die BM25 (Keyword) Suche. Der Kontext enthält zusätzliche Schlüsselwörter, die bei der lexikalischen Suche helfen.

### 11.2 Implementierung

**Status:** ✅ Implizit implementiert (Teil von Contextual Retrieval)

Weaviate's Hybrid Search nutzt BM25 auf dem `content` Feld:
- Schema: `content` hat `indexSearchable: true` → BM25 aktiv
- Da `content` den kontextuellen Content enthält, profitiert BM25 automatisch

**Vorteil:**
- Zusätzliche Keywords aus LLM-Kontext
- Bessere Keyword-Matches bei der Suche
- Keine Änderung am Schema nötig

**Beispiel:**
```
Original: "Peter Kühne arbeitete 5 Jahre bei Firma XYZ."
Mit Kontext: "Dieser Abschnitt beschreibt die Berufserfahrung des Bewerbers
im Bereich Softwareentwicklung. Peter Kühne arbeitete 5 Jahre bei Firma XYZ."
```

Der Kontext fügt "Berufserfahrung", "Bewerbers", "Softwareentwicklung" hinzu, die bei einer Suche nach "Arbeitserfahrung" matchen können.

---

## 12. Abstractive Summaries

### 12.1 Konzept

Ersetze extraktive Summaries (erste N Zeichen) durch LLM-generierte abstrakte Zusammenfassungen für Document-Level (Level 0) und Section-Level (Level 1) Chunks.

**Vorteil:**
- Bessere Qualität der Summaries
- Erfassung von Kernaussagen statt nur Textanfang
- Bessere Retrieval-Ergebnisse für Übersichtsfragen

### 12.2 Konfiguration

| Parameter | Beschreibung | Standardwert |
|-----------|--------------|--------------|
| `ABSTRACTIVE_SUMMARIES_ENABLED` | Feature aktivieren | `false` |
| `ABSTRACTIVE_SUMMARIES_MODEL` | LLM für Summary-Generierung | `qwen3:14b` |
| `maxInputLength` | Max. Input für LLM | `6000` chars |

### 12.3 Betroffene Komponenten

| Komponente | Änderungstyp |
|------------|--------------|
| `HierarchicalIndexer.ts` | Async mit LLM-Summaries |
| `ChunkingPipeline.ts` | Await für async createHierarchy |
| `ChunkMetadata` | Neues Feld `isAbstractiveSummary` |

### 12.4 Akzeptanzkriterien

- [x] LLM generiert Summaries für Level 0 und Level 1 Chunks
- [x] Fallback auf extraktive Summaries bei LLM-Fehler
- [x] Feature per Umgebungsvariable aktivierbar
- [x] Metadata markiert abstractive Summaries

### 12.5 Implementierung (2026-02-05)

**Status:** ✅ Implementiert

**Geänderte Dateien:**
- `server/src/services/chunking/HierarchicalIndexer.ts`:
  - Import von `ollamaService`
  - `AbstractiveSummaryConfig` und Prompts hinzugefügt
  - `createHierarchy()` ist jetzt `async`
  - `createDocumentChunk()` und `createSectionChunk()` sind jetzt `async`
  - Neue Methode `generateAbstractiveSummary()`
- `server/src/services/chunking/ChunkingPipeline.ts`:
  - `await` für `createHierarchy()` hinzugefügt
- `server/src/types/chunking.ts`:
  - Neues Feld `isAbstractiveSummary` in `ChunkMetadata`

**Prompts:**

Document Summary:
```
Fasse das folgende Dokument in 2-3 Sätzen zusammen. Die Zusammenfassung soll
die wichtigsten Themen und Kernaussagen des Dokuments enthalten.
```

Section Summary:
```
Fasse den folgenden Abschnitt "{TITLE}" in 1-2 Sätzen zusammen. Die Zusammenfassung
soll die Kernpunkte des Abschnitts enthalten.
```

**Logging:**
```
📝 Generated abstractive document summary
```

**Hinweis:** Dieses Feature ist standardmäßig DEAKTIVIERT. Aktivierung via `ABSTRACTIVE_SUMMARIES_ENABLED=true`.

---

## 13. Late Chunking (Evaluation)

### 13.1 Konzept

Late Chunking (Jina AI) embeddet das gesamte Dokument vor dem Chunking, um Cross-Chunk-Kontext zu bewahren.

**Traditionell (Early Chunking):**
```
Document → Chunk 1, Chunk 2 → Embed(Chunk 1), Embed(Chunk 2)
```

**Late Chunking:**
```
Document → Embed(Document) → Chunk Token Embeddings → Pool to Chunk Embeddings
```

### 13.2 Evaluation

**Status:** ⏸️ Zurückgestellt

**Voraussetzungen:**
- Long-Context Embedding Model (8K+ Token)
- Beispiel: `jina-embeddings-v2-base-de` (8192 Token Context)
- Aktuell: `nomic-embed-text` (512 Token Context)

**Herausforderungen:**
1. Ollama unterstützt kein `jina-embeddings-v2` nativ
2. Würde externen Embedding-Service erfordern
3. Signifikante Architekturänderungen nötig

**Empfehlung:**
Late Chunking zurückstellen, bis:
- Ein kompatibles Long-Context-Modell in Ollama verfügbar ist
- Oder ein externer Embedding-Service (Jina API) integriert wird

**Vergleich mit Contextual Retrieval:**
| Aspekt | Late Chunking | Contextual Retrieval |
|--------|--------------|---------------------|
| Kontextbewahrung | Implizit (Embedding) | Explizit (LLM-Text) |
| Kosten | Niedrig (nur Embedding) | Hoch (LLM pro Chunk) |
| Voraussetzung | Long-Context Model | Standard LLM |
| Implementiert | ❌ Nein | ✅ Ja |

**Fazit:**
Contextual Retrieval bietet ähnliche Vorteile und ist mit unserer aktuellen Infrastruktur kompatibel. Late Chunking wird als "Nice-to-have" für zukünftige Versionen vorgemerkt.

---

## 14. A-RAG (Agentic RAG) Prototype

### 14.1 Konzept

A-RAG (Februar 2026) gibt dem LLM direkten Zugriff auf Retrieval-Tools statt Retrieval als Preprocessing.

**Traditioneller RAG:**
```
Query → Retrieval → Concatenate → LLM → Response
```

**A-RAG:**
```
Query → LLM → [Tool: keyword_search] → LLM → [Tool: semantic_search] → LLM → Response
```

### 14.2 Drei Retrieval-Tools

| Tool | Beschreibung | Parameter |
|------|--------------|-----------|
| `keyword_search` | BM25 lexikalische Suche | query, limit |
| `semantic_search` | Vektor-basierte Suche | query, limit, threshold |
| `chunk_read` | Feinkörniges Lesen | chunk_id, expand |

### 14.3 Status

**Status:** 🔜 Geplant für Phase 3

**Voraussetzungen:**
- Tool-Use fähiges LLM (z.B. Qwen 2.5 mit Function Calling)
- Tool-Definitions im OpenAI-kompatiblen Format
- Iterative Conversation Loop

**Architektur-Skizze:**
```typescript
interface RAGTool {
  name: string;
  description: string;
  parameters: JSONSchema;
  execute: (params: any) => Promise<any>;
}

const tools: RAGTool[] = [
  {
    name: 'keyword_search',
    description: 'Search for documents using keywords (BM25)',
    parameters: { query: 'string', limit: 'number' },
    execute: async ({ query, limit }) => vectorServiceV2.search({ query, limit, hybridAlpha: 0 })
  },
  {
    name: 'semantic_search',
    description: 'Search for documents using semantic similarity',
    parameters: { query: 'string', limit: 'number' },
    execute: async ({ query, limit }) => vectorServiceV2.search({ query, limit, hybridAlpha: 1 })
  },
  {
    name: 'read_chunk',
    description: 'Read a specific chunk by ID with optional expansion',
    parameters: { chunkId: 'string', expand: 'boolean' },
    execute: async ({ chunkId, expand }) => vectorServiceV2.getChunkById(chunkId, expand)
  }
];
```

**Empfehlung:**
A-RAG als separates Feature in einer zukünftigen Phase implementieren, da es:
- Signifikante Architekturänderungen erfordert
- Tool-Use Unterstützung im LLM voraussetzt
- Umfangreiche Tests benötigt

---

## 15. Implementierungsreihenfolge

### Phase 1: Kritische Fixes (Woche 1)

1. **Document Expansion** - Löst das Hauptproblem
2. **Level-Filter Erweiterung** - Schneller Fix
3. **Parent-Context Fix** - Bug-Fix

### Phase 2: Qualitätsverbesserungen (Woche 2)

4. **Hybrid-Alpha Optimierung** - Konfigurationsänderung
5. **Reranker-Score Nutzung** - Kleine Code-Änderung
6. **Chunk Overlap** - Größere Änderung im Chunker

### Phase 3: Optimierungen (Woche 3+)

7. Query-Typ-basierte Strategien
8. LLM-basierte Summaries
9. Threshold-Logik-Verbesserung

---

## 10. Erfolgskriterien

### Funktional

- Die Frage "Wo hat Peter Kühne gearbeitet?" liefert alle Arbeitgeber aus dem Lebenslauf
- Keine Information geht durch Chunk-Grenzen verloren
- Document Expansion funktioniert für Dokumente bis 50 Chunks

### Performance

- Latenz-Erhöhung durch Document Expansion < 100ms
- Keine Erhöhung des Memory-Footprints > 10%

### Qualität

- Relevante Chunks werden zu > 90% gefunden
- False-Positive-Rate < 20%

---

## 11. Risiken und Mitigationen

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| Context-Window-Overflow bei großen Dokumenten | Mittel | Hoch | `maxChunksPerDocument` Limit |
| Performance-Degradation | Niedrig | Mittel | Caching, Batch-Requests |
| Regression in bestehenden Queries | Niedrig | Hoch | Umfassende Tests, Feature-Flags |

---

## 12. Offene Fragen

1. Soll Document Expansion standardmäßig aktiviert sein oder opt-in?
2. Wie soll mit sehr großen Dokumenten (> 100 Chunks) umgegangen werden?
3. Soll die Expansion auch für Streaming-Responses gelten?

---

## Anhang A: Betroffene Dateien

```
server/src/services/
├── RAGService.ts           # Hauptlogik, Document Expansion
├── VectorServiceV2.ts      # Neue Methode getChunksByDocumentIds
├── rag/
│   └── RerankerService.ts  # Score-Handling
└── chunking/
    ├── SemanticChunker.ts  # Overlap Implementation
    └── ChunkingPipeline.ts # Konfiguration
```

## Anhang B: Referenzen

- EMNLP 2024: "Searching for Best Practices in Retrieval-Augmented Generation"
- Analytics Vidhya: "Building Contextual RAG Systems with Hybrid Search and Reranking"
- Jina AI: "Late Chunking" Whitepaper
- Weaviate Documentation: Hybrid Search Configuration
