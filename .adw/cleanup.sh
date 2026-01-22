#!/bin/bash
# ADW Cleanup Script for Vexora Enterprise Authentication & Authorization System
# Auto-generated from adw_config.yaml

# Colors for output
GREEN="\033[0;32m"
NC="\033[0m"

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }

log_info "Stopping all servers and processes..."

log_info "Stopping frontend..."
pkill -f "vite" 2>/dev/null || true
log_info "Stopping backend..."
pkill -f "tsx watch server" 2>/dev/null || true

log_info "Stopping browser processes..."
pkill -f 'playwright' 2>/dev/null || true
pkill -f 'chromium' 2>/dev/null || true

log_info "✅ Cleanup complete!"