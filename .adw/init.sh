#!/bin/bash
# ADW Init Script for Vexora Enterprise Authentication & Authorization System
# Auto-generated from adw_config.yaml
#
# This script sets up the development environment in a worktree.
# Run from worktree root: ./init.sh

set -e  # Exit on error

# Colors for output
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m" # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Load port configuration if available
if [ -f ".ports.env" ]; then
    source ".ports.env"
    log_info "Loaded port configuration from .ports.env"
else
    log_warn "No port configuration found, using defaults"
fi
