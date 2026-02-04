#!/bin/bash
# Start Reranker Service
# Phase 1 - RAG V2 Implementation

# Change to script directory
cd "$(dirname "$0")"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -q -r requirements.txt

# Start service
echo "Starting Reranker Service on port 8001..."
echo "Model: BAAI/bge-reranker-v2-m3"
python reranker_service.py
