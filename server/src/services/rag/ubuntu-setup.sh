#!/bin/bash
# Vexora Reranker - Ubuntu Setup Script
# Run this ON the Ubuntu server (192.168.178.23)

set -e

INSTALL_DIR="/opt/vexora/reranker"

echo "=========================================="
echo "  Vexora Reranker Service Setup"
echo "  Model: BGE-reranker-v2-m3"
echo "=========================================="

# Create directory
sudo mkdir -p $INSTALL_DIR
sudo chown $USER:$USER $INSTALL_DIR
cd $INSTALL_DIR

# Create Python service
cat > reranker_service.py << 'PYEOF'
"""
Reranker Microservice - BGE-reranker-v2-m3
"""
import os
import time
from typing import List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import CrossEncoder

MODEL_NAME = os.getenv("RERANKER_MODEL", "BAAI/bge-reranker-v2-m3")
DEFAULT_TOP_K = int(os.getenv("RERANKER_TOP_K", "5"))

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
    global model
    print(f"Loading reranker model: {MODEL_NAME}")
    start = time.time()
    model = CrossEncoder(MODEL_NAME, max_length=512)
    print(f"Model loaded in {time.time() - start:.2f}s")
    yield
    print("Shutting down reranker service")

app = FastAPI(title="Reranker Service", version="1.0.0", lifespan=lifespan)

@app.get("/health", response_model=HealthResponse)
async def health():
    return HealthResponse(status="ok" if model else "loading", model=MODEL_NAME, ready=model is not None)

@app.post("/rerank", response_model=RerankResponse)
async def rerank(request: RerankRequest):
    if not model:
        raise HTTPException(status_code=503, detail="Model not loaded")
    if not request.documents:
        return RerankResponse(results=[], processing_time_ms=0, model=MODEL_NAME)

    start = time.time()
    pairs = [[request.query, doc] for doc in request.documents]
    scores = model.predict(pairs)

    results = [
        RerankResult(index=i, score=float(scores[i]), document=doc)
        for i, doc in enumerate(request.documents)
    ]
    results.sort(key=lambda x: x.score, reverse=True)
    top_k = request.top_k or DEFAULT_TOP_K
    results = results[:top_k]

    return RerankResponse(
        results=results,
        processing_time_ms=round((time.time() - start) * 1000, 2),
        model=MODEL_NAME
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
PYEOF

# Create requirements.txt
cat > requirements.txt << 'EOF'
fastapi>=0.109.0
uvicorn>=0.27.0
sentence-transformers>=2.2.2
pydantic>=2.5.0
torch>=2.0.0
EOF

# Create virtual environment
echo ""
echo "Creating virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Install dependencies
echo "Installing dependencies (this may take a few minutes)..."
pip install --upgrade pip
pip install -r requirements.txt

# Create systemd service
echo ""
echo "Creating systemd service..."
sudo tee /etc/systemd/system/reranker.service > /dev/null << EOF
[Unit]
Description=Vexora Reranker Service
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR
Environment="PATH=$INSTALL_DIR/venv/bin"
ExecStart=$INSTALL_DIR/venv/bin/uvicorn reranker_service:app --host 0.0.0.0 --port 8001
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable reranker
sudo systemctl start reranker

echo ""
echo "=========================================="
echo "  Setup Complete!"
echo "=========================================="
echo ""
echo "Service status:"
sudo systemctl status reranker --no-pager -l
echo ""
echo "Health check: curl http://localhost:8001/health"
echo ""
