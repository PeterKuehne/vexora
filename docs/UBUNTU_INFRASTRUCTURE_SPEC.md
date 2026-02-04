# Ubuntu Infrastructure Spec v4 (Implementiert)

## Übersicht

Auslagerung von Infrastruktur-Services auf einen Ubuntu-Server (192.168.178.23) im lokalen Netzwerk.

**Ziele:**
- ~3 GB RAM-Ersparnis auf dem MacBook
- Zentrales Observability-Dashboard für Claude Code
- Multi-Projekt Support für Vexora

**Status:** Phase 1-3 abgeschlossen, Phase 4-5 offen

---

## Wichtige Erkenntnisse

### Langfuse vs. SigNoz

**Problem:** Langfuse akzeptiert nur OpenTelemetry **TRACES**, aber Claude Code exportiert **LOGS/METRICS**.

> *"Claude code exports LOGS and not TRACES, thus it is currently not directly compatible"*
> — [Langfuse GitHub Discussion #9088](https://github.com/orgs/langfuse/discussions/9088)

**Lösung:** SigNoz statt Langfuse für Claude Code Observability.

| Tool | OTel Traces | OTel Logs | OTel Metrics | Claude Code kompatibel |
|------|-------------|-----------|--------------|------------------------|
| Langfuse | ✅ | ❌ | ❌ | ❌ |
| SigNoz | ✅ | ✅ | ✅ | ✅ |

---

### Claude Code Native OTel Support ✅

**Bestätigt:** Claude Code hat eingebauten OpenTelemetry Support.

```bash
# Aktivierung für SigNoz
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=otlpy

export OTEL_LOGS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=grpc
export OTEL_EXPORTER_OTLP_ENDPOINT="http://192.168.178.23:4317"
```

**Exportierte Events:**
- `claude_code.user_prompt` - Prompt-Submissions
- `claude_code.tool_result` - Tool-Ausführungen
- `claude_code.api_request` - API-Anfragen
- `claude_code.api_error` - Fehler

**Quellen:**
- [Claude Code Monitoring Docs](https://code.claude.com/docs/en/monitoring-usage)
- [SigNoz Claude Code Guide](https://signoz.io/blog/claude-code-monitoring-with-opentelemetry/)

---

## Finale Architektur

```
┌─────────────────────────────────────┐      ┌─────────────────────────────────────────┐
│           MacBook (lokal)           │      │         Ubuntu (192.168.178.23)         │
│                                     │      │                                         │
│  ┌─────────────┐  ┌──────────────┐  │      │  ┌─────────────────────────────────┐    │
│  │   Ollama    │  │    Vexora    │  │      │  │         SigNoz Stack            │    │
│  │  (qwen3:8b) │  │  Dev Server  │  │      │  │                                 │    │
│  │   :11434    │  │  :5173/:3001 │  │      │  │  ┌─────────┐  ┌─────────────┐  │    │
│  └─────────────┘  └──────────────┘  │      │  │  │ SigNoz  │  │ OTel        │  │    │
│                          │          │      │  │  │  :3001  │  │ Collector   │  │    │
│  ┌─────────────┐         │          │      │  │  └─────────┘  │ :4317/:4318 │  │    │
│  │ Claude Code │         │          │      │  │       │       └─────────────┘  │    │
│  │             │─────────┼──gRPC────┼──────┼──┼───────┴───────────────┘        │    │
│  │  (OTel)     │         │          │      │  │                                │    │
│  └─────────────┘         │          │      │  │  ┌────────┐  ┌─────────────┐  │    │
│                          │          │      │  │  │ Click- │  │  ZooKeeper  │  │    │
│                          │          │      │  │  │ House  │  │             │  │    │
│                          │          │      │  │  └────────┘  └─────────────┘  │    │
│                          │          │      │  └─────────────────────────────────┘    │
│                          │          │      │                                         │
│                          │          │      │  ┌─────────────────────────────────┐    │
│                          │          │      │  │         Vexora Stack            │    │
│                          └──────────┼──────┼──►                                 │    │
│                                     │      │  │  ┌─────────┐  ┌─────────────┐  │    │
│                                     │      │  │  │Weaviate │  │ PostgreSQL  │  │    │
│                                     │      │  │  │  :8080  │  │   :5432     │  │    │
│                                     │      │  │  └─────────┘  └─────────────┘  │    │
│                                     │      │  └─────────────────────────────────┘    │
└─────────────────────────────────────┘      └─────────────────────────────────────────┘
```

---

## Laufende Services (Ubuntu)

### SigNoz Stack
Installiert via: `~/signoz-install/deploy/docker/`

| Container | Port | Beschreibung |
|-----------|------|--------------|
| signoz | 3001 | Dashboard (extern) |
| signoz-otel-collector | 4317 | OTLP gRPC (extern) |
| signoz-otel-collector | 4318 | OTLP HTTP (extern) |
| signoz-clickhouse | 8123/9000 | Datenbank (intern) |
| signoz-zookeeper-1 | 2181 | Koordination (intern) |

### Vexora Stack
Installiert via: `~/vexora-infra/`

| Container | Port | Beschreibung |
|-----------|------|--------------|
| postgres | 5432 | PostgreSQL mit pgvector (extern) |
| weaviate | 8080 | Vector Database (extern) |
| weaviate | 50051 | gRPC (extern) |

---

## Environment-Variablen (MacBook)

### Claude Code (~/.zshrc)
```bash
# SigNoz OpenTelemetry für Claude Code
export CLAUDE_CODE_ENABLE_TELEMETRY=1
export OTEL_METRICS_EXPORTER=otlp
export OTEL_LOGS_EXPORTER=otlp
export OTEL_EXPORTER_OTLP_PROTOCOL=grpc
export OTEL_EXPORTER_OTLP_ENDPOINT="http://192.168.178.23:4317"
```

### Vexora Backend (server/.env) - TODO Phase 4
```env
# PostgreSQL - Ubuntu Server
POSTGRES_HOST=192.168.178.23
POSTGRES_PORT=5432
POSTGRES_DB=vexora
POSTGRES_USER=vexora
POSTGRES_PASSWORD=xgw15pmc

# Weaviate - Ubuntu Server
WEAVIATE_URL=http://192.168.178.23:8080
WEAVIATE_GRPC_PORT=50051

# Ollama - lokal (bleibt auf MacBook)
OLLAMA_API_URL=http://localhost:11434
```

---

## RAM-Verteilung

### Ubuntu Server (aktuell)
| Service | RAM | Status |
|---------|-----|--------|
| SigNoz + ClickHouse + ZooKeeper | ~2-3 GB | ✅ Läuft |
| PostgreSQL | ~500 MB | ✅ Läuft |
| Weaviate | ~1-2 GB | ✅ Läuft |
| **Gesamt** | **~4-6 GB** | |

### MacBook (Ersparnis nach Phase 4)
| Vorher | Nachher |
|--------|---------|
| Weaviate: 2 GB | ❌ |
| PostgreSQL: 1 GB | ❌ |
| **~3 GB** | **0 MB** |

---

## Implementierungs-Phasen

### Phase 1: Ubuntu Setup ✅ ERLEDIGT
- Docker + Docker Compose auf Ubuntu
- SigNoz installiert (`~/signoz-install/`)
- Weaviate + PostgreSQL installiert (`~/vexora-infra/`)

### Phase 2: SigNoz einrichten ✅ ERLEDIGT
- Dashboard erreichbar: http://192.168.178.23:3001
- Keine weitere Einrichtung nötig (out-of-the-box)

### Phase 3: Claude Code verbinden ✅ ERLEDIGT
- `~/.zshrc` konfiguriert
- Telemetrie-Daten kommen in SigNoz an
- Logs sichtbar unter "Logs" im Dashboard

### Phase 4: Vexora verbinden ⏳ OFFEN
1. `server/.env` mit Ubuntu-Adressen aktualisieren
2. Lokale Docker-Container (Weaviate, PostgreSQL) stoppen
3. Vexora Backend testen
4. Optional: Daten migrieren

### Phase 5: ADW Sync (Optional) ⏳ OFFEN
Minimaler Service für features.db + adw_config.yaml Sync.
Nur nötig wenn ADW-spezifische Daten gewünscht.

---

## URLs & Zugänge

| Service | URL | Anmerkung |
|---------|-----|-----------|
| SigNoz Dashboard | http://192.168.178.23:3001 | Keine Auth nötig |
| Weaviate | http://192.168.178.23:8080 | Anonymous Access |
| PostgreSQL | 192.168.178.23:5432 | User: vexora / xgw15pmc |

---

## Container Management

### SigNoz
```bash
cd ~/signoz-install/deploy/docker
docker compose ps
docker compose logs -f signoz
docker compose restart
```

### Vexora (Weaviate + PostgreSQL)
```bash
cd ~/vexora-infra
docker compose ps
docker compose logs -f
docker compose restart
```

---

## Referenzen

- [Claude Code Monitoring Docs](https://code.claude.com/docs/en/monitoring-usage)
- [SigNoz Self-Hosting](https://signoz.io/docs/install/docker/)
- [SigNoz Claude Code Guide](https://signoz.io/blog/claude-code-monitoring-with-opentelemetry/)
- [Langfuse GitHub Discussion (Inkompatibilität)](https://github.com/orgs/langfuse/discussions/9088)
