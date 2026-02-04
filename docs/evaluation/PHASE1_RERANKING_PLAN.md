# Phase 1: Reranking Implementation

## Modell
**BGE-reranker-v2-m3** (BAAI) - Multilingual, Open Source, 100+ Sprachen

## Aufgaben

- [x] Python Reranker-Service erstellen (FastAPI Microservice)
- [x] RerankerService.ts für Node.js Integration
- [x] RAGService erweitern mit Reranking-Option
- [x] Environment Variables hinzufügen
- [x] Reranker Service auf Ubuntu deployen (192.168.178.23:8001)
- [x] Evaluation V1 vs V1+Rerank ausführen
- [x] Ergebnisse dokumentieren → siehe V1_RERANK_RESULTS.md

## Architektur

```
Mac (Dev)                    Ubuntu Server (192.168.178.23)
─────────                    ──────────────────────────────
Node.js Backend ──HTTP──→ Reranker Service (Port 8001)
                          PostgreSQL (Port 5432)
                          Weaviate (Port 8080)
```

## Ergebnisse

| Metrik | V1 Baseline | V1+Rerank | Änderung | Ziel |
|--------|-------------|-----------|----------|------|
| P@5 | 11.8% | 16.7% | **+41.5%** | ≥15% ✅ |
| R@20 | 48.2% | 70.0% | **+45.2%** | - |
| Latency | 64,533ms | 110,916ms | +46,383ms | <200ms ❌ |

**Status: Phase 1 abgeschlossen** - siehe [V1_RERANK_RESULTS.md](./V1_RERANK_RESULTS.md)

**Nächste Phase:** [PHASE2_DOCUMENT_PROCESSING_PLAN.md](./PHASE2_DOCUMENT_PROCESSING_PLAN.md)

## Dateien

- `server/src/services/rag/reranker_service.py` - Python Service
- `server/src/services/rag/RerankerService.ts` - Node Integration
- `server/src/services/rag/requirements.txt` - Python Dependencies
- `server/src/services/rag/start-reranker.sh` - Start Script
- `server/src/services/RAGService.ts` - Updated with rerank option
- `server/.env` - Added RERANKER_* variables

## Deployment (Ubuntu Server)

```bash
# Deploy to Ubuntu (einmalig)
cd server/src/services/rag
./deploy-ubuntu.sh

# Oder manuell auf Ubuntu:
ssh peter@192.168.178.23
cd /opt/vexora/reranker
sudo systemctl start reranker
sudo systemctl status reranker
```

## Lokal starten (Alternative)

```bash
cd server/src/services/rag
./start-reranker.sh
```

## API Usage

```typescript
// Mit Reranking
ragService.generateResponse({
  query: "...",
  rerank: true,      // Enable reranking
  rerankTopK: 5,     // Return top 5 after reranking
  // ...
})
```
