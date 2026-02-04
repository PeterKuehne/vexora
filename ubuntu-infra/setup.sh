#!/bin/bash
# Vexora + Langfuse Infrastructure Setup Script
# Ubuntu Server: 192.168.178.23
#
# Ausführen mit: bash setup.sh

set -e

echo "========================================"
echo "  Vexora + Langfuse Infrastructure Setup"
echo "========================================"
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo "Bitte NICHT als root ausführen!"
    exit 1
fi

# Step 1: Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "[1/6] Docker installieren..."
    sudo apt-get update
    sudo apt-get install -y ca-certificates curl
    sudo install -m 0755 -d /etc/apt/keyrings
    sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    sudo chmod a+r /etc/apt/keyrings/docker.asc
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    sudo usermod -aG docker $USER
    echo "Docker installiert! Bitte neu einloggen und das Script erneut ausführen."
    exit 0
else
    echo "[1/6] Docker bereits installiert ✓"
fi

# Step 2: Check Docker Compose
if ! docker compose version &> /dev/null; then
    echo "Docker Compose nicht gefunden!"
    exit 1
fi
echo "[2/6] Docker Compose verfügbar ✓"

# Step 3: Check .env file
if [ ! -f .env ]; then
    echo "[3/6] FEHLER: .env Datei nicht gefunden!"
    echo "       Bitte .env Datei erstellen mit den Passwörtern."
    exit 1
fi
echo "[3/6] .env Datei gefunden ✓"

# Step 4: Start containers
echo "[4/6] Container starten..."
docker compose up -d

# Step 5: Wait for services
echo "[5/6] Warte auf Services..."
echo "      (Das kann 1-2 Minuten dauern)"

# Wait for PostgreSQL
echo -n "      PostgreSQL: "
until docker exec postgres pg_isready -U postgres &> /dev/null; do
    echo -n "."
    sleep 2
done
echo " ✓"

# Wait for ClickHouse
echo -n "      ClickHouse: "
for i in {1..30}; do
    if docker exec clickhouse clickhouse-client --password "$(grep CLICKHOUSE_PASSWORD .env | cut -d '=' -f2)" --query "SELECT 1" &> /dev/null; then
        echo " ✓"
        break
    fi
    echo -n "."
    sleep 2
done

# Wait for Redis
echo -n "      Redis:      "
until docker exec redis redis-cli ping &> /dev/null; do
    echo -n "."
    sleep 2
done
echo " ✓"

# Wait for Weaviate
echo -n "      Weaviate:   "
for i in {1..30}; do
    if curl -s http://localhost:8080/v1/.well-known/ready &> /dev/null; then
        echo " ✓"
        break
    fi
    echo -n "."
    sleep 2
done

# Wait for Langfuse
echo -n "      Langfuse:   "
for i in {1..60}; do
    if curl -s http://localhost:3000 &> /dev/null; then
        echo " ✓"
        break
    fi
    echo -n "."
    sleep 2
done

# Step 6: Create MinIO bucket
echo "[6/6] MinIO Bucket erstellen..."
sleep 5
docker exec minio mc alias set local http://localhost:9000 $(grep MINIO_ROOT_USER .env | cut -d '=' -f2) $(grep MINIO_ROOT_PASSWORD .env | cut -d '=' -f2) 2>/dev/null || true
docker exec minio mc mb local/langfuse 2>/dev/null || echo "      Bucket existiert bereits"

echo ""
echo "========================================"
echo "  Setup abgeschlossen!"
echo "========================================"
echo ""
echo "Services:"
echo "  - Langfuse:   http://192.168.178.23:3000"
echo "  - Weaviate:   http://192.168.178.23:8080"
echo "  - PostgreSQL: 192.168.178.23:5432"
echo ""
echo "Nächste Schritte:"
echo "  1. Öffne http://192.168.178.23:3000"
echo "  2. Erstelle einen Admin-Account"
echo "  3. Erstelle ein Projekt und generiere API Keys"
echo ""
echo "Container Status:"
docker compose ps
