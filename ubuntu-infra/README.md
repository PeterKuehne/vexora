# Vexora + Langfuse Infrastructure

Diese Dateien auf den Ubuntu-Server (192.168.178.23) kopieren und ausführen.

## Quick Start

```bash
# 1. Dateien auf Ubuntu kopieren
scp -r ubuntu-infra/* peter@192.168.178.23:~/vexora-infra/

# 2. Auf Ubuntu einloggen
ssh peter@192.168.178.23

# 3. In das Verzeichnis wechseln
cd ~/vexora-infra

# 4. Setup-Script ausführen
bash setup.sh
```

## Services nach Setup

| Service | URL | Beschreibung |
|---------|-----|--------------|
| Langfuse | http://192.168.178.23:3000 | LLM Observability Dashboard |
| Weaviate | http://192.168.178.23:8080 | Vector Database für RAG |
| PostgreSQL | 192.168.178.23:5432 | Shared Database |

## Passwörter

Alle Passwörter sind in `.env` definiert.

**PostgreSQL Benutzer:**
- `postgres` / `xgw15pmc` (Admin)
- `langfuse` / `langfuse_db_xgw15pmc` (Langfuse DB)
- `vexora` / `xgw15pmc` (Vexora DB)

## Container Management

```bash
# Status anzeigen
docker compose ps

# Logs anzeigen
docker compose logs -f

# Logs für einzelnen Service
docker compose logs -f langfuse-web

# Neustarten
docker compose restart

# Stoppen
docker compose down

# Stoppen + Volumes löschen (ACHTUNG: Datenverlust!)
docker compose down -v
```

## Firewall

Falls UFW aktiv ist:
```bash
sudo ufw allow 3000/tcp   # Langfuse
sudo ufw allow 5432/tcp   # PostgreSQL
sudo ufw allow 8080/tcp   # Weaviate
sudo ufw allow 50051/tcp  # Weaviate gRPC
```
