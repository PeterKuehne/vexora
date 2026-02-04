# V1+Rerank Evaluation Results

**Date:** 2026-01-30
**Evaluation Run ID:** fea7f25e-7339-41d0-b10e-ad464ac79093
**Phase:** 1 - Reranking (Spec 01_FOUNDATION_SPEC.md)

---

## Configuration

```json
{
  "ragVersion": "V1+Rerank",
  "ragConfig": {
    "embeddingModel": "nomic-embed-text",
    "rerankerEnabled": true,
    "rerankerModel": "BAAI/bge-reranker-v2-m3",
    "searchLimit": 20,
    "searchThreshold": 0.1,
    "hybridAlpha": 0.5
  },
  "evaluateGeneration": true
}
```

---

## Reranker Setup

| Parameter | Wert |
|-----------|------|
| **Modell** | BGE-reranker-v2-m3 (BAAI) |
| **Server** | Ubuntu 192.168.178.23:8001 |
| **Framework** | FastAPI + sentence-transformers |
| **Timeout** | 30 Sekunden |
| **Top-K** | 5 (nach Reranking) |

---

## Vergleich: V1 Baseline vs V1+Rerank

### Retrieval Metrics

| Metrik | V1 Baseline | V1+Rerank | Änderung | Ziel |
|--------|-------------|-----------|----------|------|
| **Precision@5** | 11.8% | 16.7% | **+41.5%** | ≥15% ✅ |
| **Recall@20** | 48.2% | 70.0% | **+45.2%** | - |

### Generation Metrics

| Metrik | V1 Baseline | V1+Rerank | Änderung |
|--------|-------------|-----------|----------|
| **Groundedness** | 26.9% | 25.1% | -6.7% |

### Latenz

| Metrik | V1 Baseline | V1+Rerank | Änderung |
|--------|-------------|-----------|----------|
| **Avg Total** | 64,533ms | 110,916ms | +46,383ms |

---

## Analyse

### Positive Ergebnisse

1. **Precision@5 verbessert um 41.5%** (11.8% → 16.7%)
   - Ziel von ≥15% Verbesserung wurde **deutlich übertroffen**
   - Relevante Dokumente werden jetzt besser in die Top-5 gerankt

2. **Recall@20 verbessert um 45.2%** (48.2% → 70.0%)
   - Mehr relevante Dokumente werden gefunden
   - Kombinierter Effekt aus niedrigerem Threshold + besserer Ranking

3. **Reranker funktioniert zuverlässig**
   - Verarbeitet 13-20 Chunks pro Anfrage
   - Konsistente Ergebnisse über 85 Queries

### Herausforderungen

1. **Latenz-Overhead ist hoch** (+46 Sekunden)
   - Reranker läuft auf CPU (kein GPU)
   - ~19 Sekunden pro Batch mit 20 Dokumenten
   - Ziel <200ms wurde nicht erreicht

2. **Groundedness leicht gesunken** (-6.7%)
   - Möglicherweise wegen veränderter Kontext-Reihenfolge
   - Erfordert weitere Untersuchung

### Kritische Fixes während Implementation

| Problem | Lösung |
|---------|--------|
| Nur 1 Chunk an Reranker gesendet | `searchThreshold` von 0.5 auf 0.1 gesenkt |
| Reranker Timeout | `timeout` von 10s auf 30s erhöht |
| Service nicht initialisiert | `rerankerService.initialize()` vor Evaluation aufrufen |

---

## Empfehlungen für Phase 2+

1. **GPU-Beschleunigung** für Reranker (auf Ubuntu-Server)
   - Würde Latenz von ~19s auf <1s reduzieren

2. **Batch-Größe optimieren**
   - Weniger Chunks senden (z.B. Top-10 statt Top-20)
   - Trade-off zwischen Qualität und Geschwindigkeit

3. **Groundedness untersuchen**
   - Analysieren warum sie gesunken ist
   - Evtl. Prompt-Anpassungen

---

## Raw Data

- **Database:** `evaluation_runs` Tabelle
- **Run ID:** `fea7f25e-7339-41d0-b10e-ad464ac79093`

```sql
SELECT * FROM evaluation_results
WHERE run_id = 'fea7f25e-7339-41d0-b10e-ad464ac79093'
ORDER BY created_at;
```

---

## Status

| Aufgabe | Status |
|---------|--------|
| Reranker implementiert | ✅ |
| Auf Ubuntu deployed | ✅ |
| Evaluation durchgeführt | ✅ |
| P@5 Ziel erreicht (≥15%) | ✅ |
| Latenz-Ziel (<200ms) | ❌ |

**Phase 1 abgeschlossen - Bereit für Phase 2 (Document Processing)**

---

## Nächste Phase

Siehe [PHASE2_DOCUMENT_PROCESSING_PLAN.md](./PHASE2_DOCUMENT_PROCESSING_PLAN.md) und [V2_SEMANTIC_CHUNKING_RESULTS.md](./V2_SEMANTIC_CHUNKING_RESULTS.md)
