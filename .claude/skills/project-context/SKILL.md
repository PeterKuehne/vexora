---
name: project-context
description: >
  Initiale Orientierung in der Cor7ex-Codebase. Gibt Claude eine klare Lesereihenfolge,
  um sich zu Beginn einer Session schnell im Projekt zurechtzufinden — ohne statisches
  Wissen zu duplizieren (der Code ist die Single Source of Truth).
  Verwende diesen Skill NUR zur initialen Orientierung: wenn der User explizit nach
  Projektkontext fragt ("give me project context", "orient yourself", "was ist das fuer
  ein Projekt", "mach dich mit der Codebase vertraut"). NICHT verwenden fuer Feature-Arbeit,
  Bug-Fixes, Code-Edits oder sonstige Aufgaben.
---

# Project Context — Initiale Orientierung

Dieser Skill verschafft dir einen schnellen Ueberblick ueber die Cor7ex-Codebase.
Er zeigt dir **wo** du nachschauen musst und in **welcher Reihenfolge**.
Der Code ist die Single Source of Truth.

Sobald du orientiert bist, ist der Skill erledigt. Fuer die eigentliche Arbeit
brauchst du ihn nicht — CLAUDE.md, die Specs und der Code sind dann deine Grundlage.

## Projekt-Ueberblick

Cor7ex ist ein **lernendes Nervensystem fuer Unternehmen** — KI-Agents und menschliche
Mitarbeiter bilden ein gemeinsames Bewusstsein (Hive Mind). Monorepo mit Express-Backend
und React-Frontend.

## Orientierungs-Workflow (5 Schritte)

### Schritt 1: Projekt-Grundlagen

Lies die Vision und Architektur:
- `specs/00-cor7ex-vision.md` — Vision, Hive Mind, Expert Agents, Memory, Heartbeat
- `specs/` — Alle technischen Specs (21-25)

### Schritt 2: Backend-Struktur

Scanne das Backend-Verzeichnis:
- `server/src/index.ts` — Express-Server Einstiegspunkt, Middleware, Service-Init
- `server/src/services/agents/` — Agent-System (AgentExecutor, ToolRegistry, Tools)
- `server/src/services/agents/AgentExecutor.ts` — Kern: ToolLoopAgent, System Prompt, SSE
- `server/src/services/agents/ToolRegistry.ts` — Tool-Registrierung, Rolle/Skill-Filtering

### Schritt 3: Tool- und Skill-System

Verstehe wie Tools und Skills funktionieren:
- `server/src/services/agents/tools/index.ts` — Alle registrierten Tools
- `server/src/services/agents/tools/agent.ts` — Subagent-Spawning Pattern
- `server/src/services/skills/` — Skill-Loader, Skill-Registry
- `server/skills/` — Skill-Definitionen (Markdown+Frontmatter)
- `server/agents/` — Subagent-Definitionen

### Schritt 4: Infrastruktur-Services

Ueberblick ueber externe Services:
- `server/src/services/VectorServiceV2.ts` — Weaviate (RAG/Hybrid Search)
- `server/src/services/graph/GraphService.ts` — Neo4j (Knowledge Graph)
- `server/src/services/mcp/` — MCP Client (SamaWorkforce-Anbindung)
- `server/.env` — Alle Konfigurationen und Verbindungen

### Schritt 5: Frontend

Ueberblick ueber die UI:
- `src/` — React Frontend (Vite)
- `src/components/` — UI-Komponenten (ChatInput, DocumentList, etc.)
- `src/pages/` — Seiten (Login, Documents, Admin, Profile)
- `src/lib/api.ts` — API-Client (REST Calls)
- `src/lib/socket.ts` — Socket.io Client

## Referenzdateien (bei Bedarf)

| Bedarf | Referenz |
|--------|----------|
| Welche Dateien in welcher Reihenfolge lesen (je nach Aufgabentyp) | `references/reading-order.md` |
| Naming, Patterns, Konventionen | `references/conventions.md` |
| Nicht-offensichtliche Fallen im Projekt | `references/gotchas.md` |

## Tipps

- **Paralleles Lesen**: Schritt 1-3 koennen parallel ausgefuehrt werden.
- **Nicht zu tief graben**: Dies ist eine Orientierung, kein Deep-Dive.
- **Specs lesen**: Fuer Feature-Arbeit die relevante Spec aus `specs/` lesen (21-25).
- **SSH-Tunnel**: Alle externen Services (PostgreSQL, Weaviate, Neo4j, Redis) laufen auf dem Hetzner-Server und werden ueber SSH-Tunnel erreicht (`server/start-tunnels.sh`).
