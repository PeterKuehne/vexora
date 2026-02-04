# V1 RAG Baseline Evaluation Results

**Date:** 2026-01-29
**Evaluation Run ID:** 3fa38fc1-c05e-48d1-b533-f62904877bb0
**Phase:** 0 - Foundation (Spec 01_FOUNDATION_SPEC.md)

---

## Configuration

```json
{
  "ragVersion": "V1",
  "ragConfig": {
    "embeddingModel": "nomic-embed-text",
    "rerankerEnabled": false,
    "searchLimit": 20,
    "hybridAlpha": 0.5
  },
  "evaluateGeneration": true
}
```

---

## Golden Dataset

| Category | Count |
|----------|-------|
| factual | 20 |
| comparative | 10 |
| procedural | 15 |
| relational | 15 |
| aggregative | 10 |
| multi_hop | 15 |
| **Total** | **85** |

**Languages:** German (DE), English (EN)

**Documents used:**
- 202107_KI-Pruefkatalog.pdf
- 221202LFReifegradmodellDigitale-Gerschaftsprozesse-20.pdf
- ui-ux-design-principles.pdf
- React Native Guide.pdf
- AMA.pdf
- InsightAgents.pdf
- Whitepaper_Bias_KI.pdf
- RankersJudgesAndAsssistans.pdf

---

## Retrieval Metrics

| Metric | Value | Target (Phase 1) |
|--------|-------|------------------|
| **Precision@5** | 11.8% | > 30% |
| **Recall@20** | 48.2% | > 70% |
| **MRR** | ~0.58 | > 0.75 |

### Analysis

- **Low P@5 (11.8%)**: Relevant documents are being found, but not ranked in the top 5 positions
- **Moderate R@20 (48.2%)**: Documents ARE present in top 20, indicating the vector search finds them
- **Gap Analysis**: The 36.4 percentage point gap between R@20 and P@5 indicates ranking quality issues
- **Implication**: A reranker should significantly improve precision by re-ordering the top candidates

---

## Generation Metrics

| Metric | Value | Target |
|--------|-------|--------|
| **Groundedness** | 26.9% | > 50% |
| **Key Facts Coverage** | varies | > 60% |
| **Hallucination Rate** | varies | < 10% |

### Analysis

- **Low Groundedness (26.9%)**: Generated responses are not consistently grounded in retrieved context
- **Contributing factors**:
  1. Low retrieval quality feeds poor context to the LLM
  2. Model (qwen3:8b) may not follow context strictly
  3. Evaluation metric may be too strict

---

## Latency

| Metric | Value |
|--------|-------|
| **Avg Total Latency** | 64,533ms |
| **Est. Retrieval** | ~19,360ms (30%) |
| **Est. Generation** | ~45,173ms (70%) |

### Analysis

- Most latency is in LLM generation
- Retrieval could be faster with optimized embedding caching
- Consider streaming responses for better UX

---

## Embedding Model Comparison

| Model | Available | Notes |
|-------|-----------|-------|
| nomic-embed-text | Yes | Currently in use, 768 dimensions |
| mxbai-embed-large | No | Would need `ollama pull mxbai-embed-large` |
| all-minilm | No | Would need `ollama pull all-minilm` |

---

## Improvement Opportunities (Phase 1)

1. **Reranking**: Implement cross-encoder reranker to re-order top 20 results
   - Expected P@5 improvement: +15-20 percentage points
   - Use a model like `BAAI/bge-reranker-base`

2. **Hybrid Search Tuning**: Experiment with alpha parameter
   - Current: 0.5 (equal BM25/vector weight)
   - Try: 0.3, 0.7 to find optimal balance

3. **Embedding Model**: Consider testing larger embedding models
   - `mxbai-embed-large` (1024 dimensions)
   - May improve semantic matching

4. **Chunking Strategy**: Current strategy may miss context
   - Consider semantic chunking
   - Add chunk overlap

---

## Next Steps

- [x] Implement Phase 1: Reranking
- [x] Run evaluation after reranking implementation
- [x] Compare V1+Rerank metrics to this baseline
- [x] Document improvement percentages

**Ergebnisse:** Siehe [V1_RERANK_RESULTS.md](./V1_RERANK_RESULTS.md)

---

## Raw Data Location

- Database: `evaluation_runs` table
- Results: `evaluation_results` table
- Run ID: `3fa38fc1-c05e-48d1-b533-f62904877bb0`

Query to retrieve full results:
```sql
SELECT * FROM evaluation_results
WHERE run_id = '3fa38fc1-c05e-48d1-b533-f62904877bb0'
ORDER BY created_at;
```
