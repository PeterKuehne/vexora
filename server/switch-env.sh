#!/bin/bash
# Switch between local Ubuntu server and Hetzner cloud
# Usage: ./switch-env.sh local|hetzner

case "$1" in
  local)
    cp .env.local .env
    echo "✅ Switched to LOCAL (Ubuntu 192.168.2.38)"
    ;;
  hetzner)
    cp .env.hetzner .env
    echo "✅ Switched to HETZNER (167.235.135.132)"
    ;;
  *)
    echo "Usage: ./switch-env.sh local|hetzner"
    echo ""
    echo "Current:"
    grep -m1 "POSTGRES_HOST" .env 2>/dev/null | sed 's/.*=/  /'
    exit 1
    ;;
esac
