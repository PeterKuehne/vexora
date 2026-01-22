#!/bin/bash
# ADW Init Script for Vexora Enterprise Authentication & Authorization System
# Auto-generated from adw_config.yaml

set -e

# Colors for output
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m"

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Step 1: Cleanup old processes
log_info "Stopping old frontend processes..."
pkill -f "vite" 2>/dev/null || true
log_info "Stopping old backend processes..."
pkill -f "tsx watch server" 2>/dev/null || true
sleep 1

# Step 3: Start development servers
log_info "Starting frontend..."
npm run dev > /dev/null 2>&1 &
FRONTEND_PID=$!

log_info "Starting backend..."
npm run dev:server > /dev/null 2>&1 &
BACKEND_PID=$!

# Step 4: Wait for readiness
log_info "Waiting for frontend (http://localhost:5173)..."
for i in {1..30}; do
  if curl -s -o /dev/null -w '%{http_code}' http://localhost:5173 2>/dev/null | grep -q '200'; then
    log_info "frontend is ready!"
    break
  fi
  if [ "$i" -eq "30" ]; then
    log_error "frontend failed to start within 30s"
    exit 1
  fi
  sleep 1
done

log_info "Waiting for backend (http://localhost:3001/api/health)..."
for i in {1..20}; do
  if curl -s -o /dev/null -w '%{http_code}' http://localhost:3001/api/health 2>/dev/null | grep -q '200'; then
    log_info "backend is ready!"
    break
  fi
  if [ "$i" -eq "20" ]; then
    log_error "backend failed to start within 20s"
    exit 1
  fi
  sleep 1
done

log_info "✅ Development environment ready!"

log_info "Servers running in background. Use ./cleanup.sh to stop."