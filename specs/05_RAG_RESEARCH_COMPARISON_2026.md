# RAG Forschungsvergleich 2026

**Version:** 1.0
**Datum:** 2026-02-05
**Status:** Analyse abgeschlossen

---

## Executive Summary

Diese Analyse vergleicht die aktuelle Vexora RAG-Implementierung mit den neuesten Forschungsergebnissen der führenden AI-Labore (Stand Februar 2026). Die Implementierung ist **solide und fortschrittlich**, liegt aber in einigen Bereichen hinter dem aktuellen State-of-the-Art zurück.

### Gesamtbewertung

| Bereich | Vexora Status | State-of-the-Art 2026 | Gap |
|---------|---------------|----------------------|-----|
| Hybrid Search | ✅ Implementiert | Contextual Retrieval | Mittel |
| Reranking | ✅ BGE-v2-m3 | ColBERT v2 / Late Interaction | Klein |
| Hierarchical Chunking | ✅ 3-Level | RAPTOR / Late Chunking | Mittel |
| Graph-RAG | ✅ Neo4j Integration | Microsoft GraphRAG | Klein |
| Agentic RAG | ⚠️ Partiell | A-RAG Hierarchical Interfaces | Groß |
| Contextual Retrieval | ❌ Nicht vorhanden | Anthropic Standard | Groß |

---

## 1. Neueste Forschungsergebnisse 2025-2026

### 1.1 Anthropic: Contextual Retrieval (September 2024 - Standard 2026)

**Quelle:** [Anthropic Research](https://www.anthropic.com/news/contextual-retrieval)

**Kernkonzept:**
Traditionelles Chunking entfernt Kontext. Contextual Retrieval fügt jedem Chunk einen kurzen, LLM-generierten Kontext hinzu, bevor Embeddings erstellt werden.

**Technik:**
- **Contextual Embeddings**: Chunk + LLM-generierter Kontext → Embedding
- **Contextual BM25**: Chunk + Kontext → BM25 Index

**Ergebnisse:**
- 49% Reduktion fehlgeschlagener Retrievals
- 67% Reduktion mit zusätzlichem Reranking
- Top-20-Chunk Failure Rate: 5.7% → 2.9%

**Prompt-Template (vereinfacht):**
```
<document>{{WHOLE_DOCUMENT}}</document>
Here is the chunk we want to situate within the whole document:
<chunk>{{CHUNK_CONTENT}}</chunk>
Please give a short succinct context to situate this chunk within
the overall document for improving search retrieval.
```

---

### 1.2 A-RAG: Hierarchical Retrieval Interfaces (Februar 2026)

**Quelle:** [arXiv:2602.03442](https://arxiv.org/abs/2602.03442)

**Kernkonzept:**
Anstatt Retrieval als Preprocessing zu behandeln, wird dem LLM direkter Zugriff auf drei Retrieval-Tools gegeben. Das Modell entscheidet selbst, wann und wie es sucht.

**Drei Retrieval-Tools:**
1. **Keyword Search** - Lexikalische Suche für explizite Terme
2. **Semantic Search** - Vektorbasierte Suche für Konzepte
3. **Chunk Read** - Feinkörniges Lesen auf verschiedenen Granularitäten

**Unterschied zu traditionellem RAG:**
- Traditionell: Retrieval → Concatenation → LLM
- A-RAG: LLM entscheidet iterativ, welche Tools wann genutzt werden

**Ergebnisse:**
- Outperformt existierende Ansätze bei vergleichbarer oder niedrigerer Token-Nutzung
- Skaliert besser mit Modellgröße

---

### 1.3 RAPTOR: Recursive Abstractive Processing (ICLR 2024 - Produktionsreif 2026)

**Quelle:** [arXiv:2401.18059](https://arxiv.org/abs/2401.18059)

**Kernkonzept:**
Rekursives Clustering und Zusammenfassen von Chunks zu einer Baumstruktur. Ermöglicht Multi-Level-Retrieval für holistische Dokumentverständnis.

**Algorithmus:**
1. Chunks auf unterster Ebene clustern (z.B. k-means)
2. Cluster durch LLM zusammenfassen → neue Knoten
3. Rekursiv wiederholen bis Wurzelknoten

**Ergebnisse:**
- 20% absolute Accuracy-Verbesserung auf QuALITY Benchmark
- Besonders effektiv für Multi-Hop-Fragen

**Integration:** RAGFlow v0.6.0+ unterstützt RAPTOR nativ

---

### 1.4 Late Chunking (EMNLP 2024 - Jina Standard 2026)

**Quelle:** [Jina AI Research](https://jina.ai/news/late-chunking-in-long-context-embedding-models/)

**Kernkonzept:**
Embedding des gesamten Dokuments zuerst, dann Chunking auf Token-Level. Bewahrt Cross-Chunk-Kontext.

**Traditionell (Early Chunking):**
```
Document → Chunk 1, Chunk 2, ... → Embed(Chunk 1), Embed(Chunk 2), ...
```

**Late Chunking:**
```
Document → Embed(Document) → Chunk Token Embeddings → Pool to Chunk Embeddings
```

**Vorteile:**
- Kein Kontextverlust an Chunk-Grenzen
- Keine zusätzlichen LLM-Calls wie bei Contextual Retrieval
- Benötigt Long-Context Embedding Model (z.B. jina-embeddings-v2, 8K context)

**Ergebnisse:**
- Signifikante Verbesserung bei Retrieval-Qualität
- Jina ColBERT v2: +6.5% gegenüber ColBERT-v2

---

### 1.5 Microsoft GraphRAG (2024-2026 Enterprise Standard)

**Quelle:** [Microsoft Research](https://www.microsoft.com/en-us/research/project/graphrag/)

**Kernkonzept:**
Automatische Konstruktion von Entity-Relationship-Graphen aus Dokumenten. Ermöglicht thematische Abfragen über große Wissensbasen.

**Architektur:**
1. Entity Extraction aus Dokumenten
2. Relationship Detection zwischen Entities
3. Community Detection (Cluster von verwandten Entities)
4. Hierarchical Summarization der Communities

**Unterschied zu klassischem RAG:**
- Klassisch: "Was steht in Dokument X über Y?"
- GraphRAG: "Was sind die Compliance-Risiken über alle Verträge?"

**Integration:** Azure AI Search, LangChain, LlamaIndex

---

### 1.6 ColBERT v2 / Late Interaction Reranking (State-of-the-Art 2026)

**Quelle:** [Stanford FutureData](https://github.com/stanford-futuredata/ColBERT)

**Kernkonzept:**
Token-Level Interaktion zwischen Query und Document Embeddings. Effizienter als Cross-Encoder, genauer als Bi-Encoder.

**Vergleich:**
| Methode | Genauigkeit | Latenz | Use Case |
|---------|-------------|--------|----------|
| Bi-Encoder | Mittel | Schnell | Initial Retrieval |
| Cross-Encoder (BGE) | Hoch | Langsam | Reranking (klein) |
| ColBERT | Hoch | Mittel | Reranking (skalierbar) |

**Neueste Entwicklungen:**
- Jina ColBERT v2: 89 Sprachen, 8192 Token-Length
- ModernBERT + ColBERT: +4.2pp Recall@3 auf PubMedQA
- Col-Bandit: Query-Time Pruning für Effizienz

---

### 1.7 Google DeepMind: Embedding Limitations & Speculative RAG

**Quelle:** [Dataconomy](https://dataconomy.com/2025/09/05/deepmind-finds-rag-limit-with-fixed-size-embeddings/)

**Kernfinding:**
Fixed-Size Embeddings haben fundamentale Kapazitätslimits:
- 512 Dimensionen: ~500.000 Dokumente
- 1024 Dimensionen: ~4 Millionen Dokumente

**Speculative RAG:**
- Drafting-basierter Ansatz für schnellere Generation
- Parallel Retrieval während Generation

---

### 1.8 Meta: REFRAG (2025-2026)

**Quelle:** [Data Science Dojo](https://datasciencedojo.com/blog/refrag-metas-breakthrough-in-rag/)

**Kernkonzept:**
Compression von Retrieved Passages in Dense Vectors statt Raw Tokens.

**Ergebnisse:**
- 30× Beschleunigung Time-to-First-Token
- 16× Context Window Expansion
- Keine Genauigkeitseinbußen

**Technik:**
- 16-Token Chunks → Dense Vector Embeddings
- LLM verarbeitet Embeddings statt Tokens

---

## 2. Vergleich: Vexora vs. State-of-the-Art

### 2.1 Retrieval-Strategie

| Feature | Vexora | State-of-the-Art | Bewertung |
|---------|--------|------------------|-----------|
| Hybrid Search | BM25 + Vector (α=0.5) | Contextual BM25 + Contextual Embeddings | ⚠️ Gap |
| Fusion Method | relativeScoreFusion | RRF (Reciprocal Rank Fusion) | ✅ OK |
| Permission Filtering | ✅ PostgreSQL RLS | Standard | ✅ Gut |

**Gap-Analyse:**
Vexora verwendet Standard-Embeddings ohne Kontextanreicherung. Anthropics Contextual Retrieval könnte Failure Rate um 49-67% senken.

---

### 2.2 Chunking-Strategie

| Feature | Vexora | State-of-the-Art | Bewertung |
|---------|--------|------------------|-----------|
| Strategie | Semantic Chunking (Embedding-based) | Late Chunking / Agentic Chunking | ⚠️ Gap |
| Hierarchie | 3-Level (Doc/Section/Para) | RAPTOR Tree-Structured | ⚠️ Ähnlich |
| Overlap | ❌ Nicht implementiert | 10-20% Standard | ❌ Gap |
| Summaries | Extractive (500 chars) | LLM-Abstractive | ⚠️ Gap |
| Context Preservation | Parent-Context (fehlerhaft) | Late Chunking | ❌ Gap |

**Gap-Analyse:**
- Fehlendes Overlap führt zu Kontextverlust an Grenzen
- Extractive Summaries sind weniger aussagekräftig als LLM-generierte
- Late Chunking würde Kontextproblem elegant lösen

---

### 2.3 Reranking

| Feature | Vexora | State-of-the-Art | Bewertung |
|---------|--------|------------------|-----------|
| Modell | BGE-reranker-v2-m3 | ColBERT v2 / Jina ColBERT v2 | ✅ Gut |
| Architektur | Cross-Encoder | Late Interaction | ⚠️ Upgrade möglich |
| Multilingual | ✅ Ja | ✅ Ja | ✅ Gut |
| Top-K | 5 (fest) | Dynamisch | ⚠️ Gap |

**Gap-Analyse:**
BGE-reranker-v2-m3 ist ein solider Cross-Encoder. ColBERT v2 wäre effizienter bei größeren Kandidatenmengen, aber der Unterschied ist für lokales RAG gering.

---

### 2.4 Graph-RAG

| Feature | Vexora | State-of-the-Art | Bewertung |
|---------|--------|------------------|-----------|
| Graph DB | Neo4j | Neo4j / Custom | ✅ Gut |
| Entity Extraction | Pattern + LLM | LLM-based | ✅ Gut |
| Traversal | Max Depth 2 | Configurable | ✅ Gut |
| Community Detection | ❌ Nicht vorhanden | Microsoft GraphRAG | ⚠️ Gap |
| Hierarchical Summarization | ❌ Nicht vorhanden | Microsoft GraphRAG | ⚠️ Gap |

**Gap-Analyse:**
Vexora hat solide Graph-RAG Basics. Microsoft GraphRAG bietet zusätzlich Community Detection für thematische Queries - relevant für große Dokumentensammlungen.

---

### 2.5 Agentic Capabilities

| Feature | Vexora | State-of-the-Art | Bewertung |
|---------|--------|------------------|-----------|
| Query Routing | ✅ 6 Query-Typen | ✅ Standard | ✅ Gut |
| Strategy Selection | ✅ Automatisch | A-RAG Agent-Controlled | ⚠️ Gap |
| Tool Use | ❌ Intern/Implizit | Explizite Tool-Interfaces | ❌ Gap |
| Multi-Step Reasoning | ⚠️ Partiell (Graph) | A-RAG Iterative | ⚠️ Gap |
| Planning | ❌ Nicht vorhanden | ReAct-Style Agents | ❌ Gap |

**Gap-Analyse:**
Vexora hat intelligentes Query-Routing, aber keine echte Agent-Architektur. A-RAG zeigt, dass LLMs bessere Retrieval-Entscheidungen treffen können, wenn sie direkte Tool-Kontrolle haben.

---

## 3. Priorisierte Verbesserungsempfehlungen

### Priorität 1: Kritisch (Sofortige Wirkung)

#### 1.1 Document Expansion
**Problem:** Relevante Chunks desselben Dokuments werden nicht abgerufen.
**Lösung:** Wenn ein Chunk gefunden wird, alle Chunks des Dokuments laden.
**Aufwand:** Klein
**Impact:** Hoch

#### 1.2 Chunk Overlap Implementation
**Problem:** Kontext geht an Chunk-Grenzen verloren.
**Lösung:** 10-20% Overlap zwischen aufeinanderfolgenden Chunks.
**Aufwand:** Mittel
**Impact:** Mittel-Hoch

#### 1.3 Level-Filter Erweiterung
**Problem:** Nur Level 2 wird durchsucht.
**Lösung:** Query-Typ-basierte Level-Auswahl (aggregative → alle Level).
**Aufwand:** Klein
**Impact:** Mittel

---

### Priorität 2: Strategisch (Mittelfristig)

#### 2.1 Contextual Retrieval (Anthropic-Stil)
**Problem:** Chunks verlieren Dokumentkontext.
**Lösung:** LLM-generierter Kontext pro Chunk bei Indexierung.
**Aufwand:** Mittel
**Impact:** Hoch (49-67% bessere Retrieval)
**Trade-off:** Erhöhte Indexierungskosten (LLM-Calls pro Chunk)

#### 2.2 Late Chunking Evaluation
**Problem:** Early Chunking verliert Cross-Chunk-Kontext.
**Lösung:** Integration von jina-embeddings-v3 mit late_chunking Parameter.
**Aufwand:** Mittel
**Impact:** Hoch
**Trade-off:** Benötigt Long-Context Embedding Model

#### 2.3 LLM-basierte Abstractive Summaries
**Problem:** Extractive Summaries (500 chars) sind wenig aussagekräftig.
**Lösung:** LLM-generierte Zusammenfassungen für Level 0/1.
**Aufwand:** Mittel
**Impact:** Mittel

---

### Priorität 3: Zukunftsorientiert (Langfristig)

#### 3.1 A-RAG Style Agent Interface
**Problem:** LLM hat keine direkte Kontrolle über Retrieval.
**Lösung:** Drei explizite Tools: keyword_search, semantic_search, chunk_read.
**Aufwand:** Groß
**Impact:** Hoch (Skaliert mit Modellqualität)

#### 3.2 RAPTOR Tree-Structured Retrieval
**Problem:** Hierarchie ist flach (3 Level).
**Lösung:** Rekursives Clustering mit LLM-Summaries.
**Aufwand:** Groß
**Impact:** Hoch für Multi-Hop-Fragen

#### 3.3 ColBERT v2 Late Interaction
**Problem:** Cross-Encoder skaliert schlecht.
**Lösung:** Jina ColBERT v2 für effizienteres Reranking.
**Aufwand:** Mittel
**Impact:** Mittel (Performance-Verbesserung)

---

## 4. Empfohlene Architektur 2026

Basierend auf der Analyse empfehlen wir folgende Zielarchitektur:

```
                    ┌─────────────────────────────────────┐
                    │         USER QUERY                  │
                    └─────────────────┬───────────────────┘
                                      │
                    ┌─────────────────▼───────────────────┐
                    │      AGENTIC QUERY ROUTER           │
                    │  - Query Type Classification        │
                    │  - Entity Extraction                │
                    │  - Strategy Selection               │
                    └─────────────────┬───────────────────┘
                                      │
            ┌─────────────────────────┼─────────────────────────┐
            │                         │                         │
┌───────────▼───────────┐ ┌───────────▼───────────┐ ┌───────────▼───────────┐
│   KEYWORD SEARCH      │ │   SEMANTIC SEARCH     │ │    CHUNK READ         │
│   (Contextual BM25)   │ │ (Contextual Embed.)   │ │  (Document Expand)    │
└───────────┬───────────┘ └───────────┬───────────┘ └───────────┬───────────┘
            │                         │                         │
            └─────────────────────────┼─────────────────────────┘
                                      │
                    ┌─────────────────▼───────────────────┐
                    │      FUSION & RERANKING             │
                    │  - RRF Score Fusion                 │
                    │  - ColBERT v2 Late Interaction      │
                    │  - Document Expansion               │
                    └─────────────────┬───────────────────┘
                                      │
                    ┌─────────────────▼───────────────────┐
                    │      GRAPH ENRICHMENT               │
                    │  - Entity Traversal (Neo4j)         │
                    │  - Community Context (optional)     │
                    └─────────────────┬───────────────────┘
                                      │
                    ┌─────────────────▼───────────────────┐
                    │      CONTEXT BUILDING               │
                    │  - Hierarchical Context             │
                    │  - Source Attribution               │
                    └─────────────────┬───────────────────┘
                                      │
                    ┌─────────────────▼───────────────────┐
                    │      LLM GENERATION                 │
                    │  - Ollama (qwen3:8b / llama3:70b)   │
                    │  - Iterative Retrieval (optional)   │
                    └─────────────────┬───────────────────┘
                                      │
                    ┌─────────────────▼───────────────────┐
                    │      OUTPUT GUARDRAILS              │
                    │  - Groundedness Check               │
                    │  - Citation Validation              │
                    └─────────────────────────────────────┘
```

---

## 5. Konkrete Implementierungsroadmap

### Phase 1: Quick Wins (Woche 1-2)

| Task | Beschreibung | Dateien |
|------|--------------|---------|
| Document Expansion | Alle Chunks eines gefundenen Dokuments laden | RAGService.ts, VectorServiceV2.ts |
| Level-Filter | Query-Typ-basierte Auswahl | RAGService.ts, QueryRouter.ts |
| Overlap | 10% Overlap zwischen Chunks | SemanticChunker.ts |
| Parent-Context Fix | UUID statt Path | VectorServiceV2.ts |

### Phase 2: Contextual Retrieval (Woche 3-4)

| Task | Beschreibung | Dateien |
|------|--------------|---------|
| Context Generation | LLM-Kontext pro Chunk bei Upload | DocumentService.ts |
| Contextual Embeddings | Kontext + Chunk → Embedding | VectorServiceV2.ts |
| Contextual BM25 | Kontext in BM25 Index | VectorServiceV2.ts |

### Phase 3: Advanced Features (Woche 5-8)

| Task | Beschreibung | Dateien |
|------|--------------|---------|
| Late Chunking Eval | jina-embeddings-v3 Integration | EmbeddingService.ts |
| Abstractive Summaries | LLM-Summaries für Level 0/1 | HierarchicalIndexer.ts |
| A-RAG Prototype | Explizite Tool-Interfaces | RAGService.ts, neue Agent-Klasse |

---

## 6. Risiken und Trade-offs

### Contextual Retrieval
- **Pro:** 49-67% bessere Retrieval-Qualität
- **Contra:** LLM-Call pro Chunk bei Indexierung (Kosten, Latenz)
- **Mitigation:** Batch-Processing, Caching, kleineres Modell für Kontext

### Late Chunking
- **Pro:** Kein Kontextverlust, keine zusätzlichen LLM-Calls
- **Contra:** Benötigt Long-Context Embedding Model
- **Mitigation:** jina-embeddings-v3 unterstützt 8192 Tokens

### A-RAG Agent Interface
- **Pro:** Skaliert mit Modellqualität, flexibler
- **Contra:** Komplexere Implementierung, Debug-Aufwand
- **Mitigation:** Schrittweise Migration, Fallback auf klassisches RAG

---

## 7. Fazit

Die Vexora RAG-Implementierung ist **solide und überdurchschnittlich** für ein lokales System. Die wichtigsten Gaps sind:

1. **Contextual Retrieval** - Größter Impact auf Retrieval-Qualität
2. **Document Expansion** - Löst akutes Problem mit verlorenen Chunks
3. **Agentic Interfaces** - Zukunftssicher für bessere Modelle

Die empfohlene Strategie ist ein **inkrementeller Ansatz**: Zuerst Document Expansion und Overlap (sofortige Verbesserung), dann Contextual Retrieval (signifikanter Quality-Boost), schließlich A-RAG Interfaces (Zukunftsinvestition).

---

## Quellen

- [Anthropic: Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval)
- [A-RAG: Hierarchical Retrieval Interfaces (arXiv:2602.03442)](https://arxiv.org/abs/2602.03442)
- [RAPTOR: Tree-Organized Retrieval (arXiv:2401.18059)](https://arxiv.org/abs/2401.18059)
- [Jina: Late Chunking](https://jina.ai/news/late-chunking-in-long-context-embedding-models/)
- [Microsoft GraphRAG](https://www.microsoft.com/en-us/research/project/graphrag/)
- [Stanford ColBERT](https://github.com/stanford-futuredata/ColBERT)
- [Meta REFRAG](https://datasciencedojo.com/blog/refrag-metas-breakthrough-in-rag/)
- [Agentic RAG Survey (arXiv:2501.09136)](https://arxiv.org/abs/2501.09136)
- [HiPRAG (arXiv:2510.07794)](https://arxiv.org/abs/2510.07794)
