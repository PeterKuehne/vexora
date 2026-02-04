"""
Reranker Microservice - BGE-reranker-v2-m3
Phase 1 - RAG V2 Implementation

Usage: uvicorn reranker_service:app --host 0.0.0.0 --port 8001
"""

import os
import time
from typing import List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import CrossEncoder

# Configuration
MODEL_NAME = os.getenv("RERANKER_MODEL", "BAAI/bge-reranker-v2-m3")
DEFAULT_TOP_K = int(os.getenv("RERANKER_TOP_K", "5"))

# Global model instance
model: Optional[CrossEncoder] = None


class RerankRequest(BaseModel):
    query: str
    documents: List[str]
    top_k: Optional[int] = None


class RerankResult(BaseModel):
    index: int
    score: float
    document: str


class RerankResponse(BaseModel):
    results: List[RerankResult]
    processing_time_ms: float
    model: str


class HealthResponse(BaseModel):
    status: str
    model: str
    ready: bool


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model on startup."""
    global model
    print(f"Loading reranker model: {MODEL_NAME}")
    start = time.time()
    model = CrossEncoder(MODEL_NAME, max_length=512)
    print(f"Model loaded in {time.time() - start:.2f}s")
    yield
    print("Shutting down reranker service")


app = FastAPI(
    title="Reranker Service",
    description="BGE-reranker-v2-m3 for RAG reranking",
    version="1.0.0",
    lifespan=lifespan
)


@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint."""
    return HealthResponse(
        status="ok" if model else "loading",
        model=MODEL_NAME,
        ready=model is not None
    )


@app.post("/rerank", response_model=RerankResponse)
async def rerank(request: RerankRequest):
    """
    Rerank documents for a given query.

    Returns documents sorted by relevance score (highest first).
    """
    if not model:
        raise HTTPException(status_code=503, detail="Model not loaded")

    if not request.documents:
        return RerankResponse(
            results=[],
            processing_time_ms=0,
            model=MODEL_NAME
        )

    start = time.time()

    # Create query-document pairs
    pairs = [[request.query, doc] for doc in request.documents]

    # Get scores from cross-encoder
    scores = model.predict(pairs)

    # Create results with original indices
    results = [
        RerankResult(
            index=i,
            score=float(scores[i]),
            document=doc
        )
        for i, doc in enumerate(request.documents)
    ]

    # Sort by score descending
    results.sort(key=lambda x: x.score, reverse=True)

    # Apply top_k limit
    top_k = request.top_k or DEFAULT_TOP_K
    results = results[:top_k]

    processing_time = (time.time() - start) * 1000

    return RerankResponse(
        results=results,
        processing_time_ms=round(processing_time, 2),
        model=MODEL_NAME
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
