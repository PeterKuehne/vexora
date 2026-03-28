#!/bin/bash
# Switch between local Ubuntu server and Hetzner cloud
# Usage: ./switch-env.sh local|hetzner

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

case "$1" in
  local)
    cp "$SCRIPT_DIR/.env.local" "$SCRIPT_DIR/.env"
    # Stop Hetzner tunnels if running
    "$SCRIPT_DIR/start-tunnels.sh" stop 2>/dev/null
    echo "✅ Switched to LOCAL (Ubuntu 192.168.2.38)"
    ;;
  hetzner)
    cp "$SCRIPT_DIR/.env.hetzner" "$SCRIPT_DIR/.env"
    # Start SSH tunnels (services are only on 127.0.0.1 am Server)
    "$SCRIPT_DIR/start-tunnels.sh"
    echo "✅ Switched to HETZNER (via SSH-Tunnel)"
    ;;
  *)
    echo "Usage: ./switch-env.sh local|hetzner"
    echo ""
    echo "Current:"
    grep -m1 "POSTGRES_HOST" "$SCRIPT_DIR/.env" 2>/dev/null | sed 's/.*=/  /'
    exit 1
    ;;
esac
