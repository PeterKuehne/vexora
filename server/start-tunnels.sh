#!/bin/bash
# SSH-Tunnels zu Hetzner-Services (167.235.135.132)
# Alle Services sind auf 127.0.0.1 gebunden — nur via SSH-Tunnel erreichbar.
#
# Usage: ./start-tunnels.sh        — Tunnels starten
#        ./start-tunnels.sh stop   — Tunnels beenden

set -euo pipefail

SSH_KEY=~/.ssh/cor7ex_hetzner
SSH_HOST=peter@167.235.135.132

PORTS=(
  5432   # PostgreSQL
  6379   # Redis
  7474   # Neo4j HTTP
  7687   # Neo4j Bolt
  8080   # Weaviate HTTP
  50051  # Weaviate gRPC
  8001   # Reranker
  8002   # Parser
  8003   # Presidio Analyzer
  8004   # Presidio Anonymizer
)

stop_tunnels() {
  echo "Stopping existing SSH tunnels to $SSH_HOST..."
  pkill -f "ssh.*-L.*$SSH_HOST" 2>/dev/null && echo "Tunnels stopped." || echo "No tunnels running."
}

if [[ "${1:-}" == "stop" ]]; then
  stop_tunnels
  exit 0
fi

# Stop any existing tunnels first
stop_tunnels

# Build -L arguments
LOCAL_FORWARDS=()
for port in "${PORTS[@]}"; do
  LOCAL_FORWARDS+=("-L" "127.0.0.1:${port}:127.0.0.1:${port}")
done

echo "Starting SSH tunnels to $SSH_HOST..."
echo "Ports: ${PORTS[*]}"

ssh -i "$SSH_KEY" -f -N \
  -o ServerAliveInterval=60 \
  -o ServerAliveCountMax=3 \
  -o ExitOnForwardFailure=yes \
  "${LOCAL_FORWARDS[@]}" \
  "$SSH_HOST"

echo "SSH tunnels established. All services available on 127.0.0.1."
echo "Run '$0 stop' to disconnect."
