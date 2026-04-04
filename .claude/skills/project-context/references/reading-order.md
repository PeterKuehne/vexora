# Lesereihenfolge nach Aufgabentyp

Lies immer nur so viel wie du fuer die Aufgabe brauchst.

---

## Agent-System aendern (Expert Agent, Hive Mind, Tools)

1. `specs/21-hive-mind-orchestrator.md` — Architektur verstehen
2. `server/src/services/agents/AgentExecutor.ts` — Aktueller Agent-Loop
3. `server/src/services/agents/ToolRegistry.ts` — Tool-Registrierung
4. `server/src/services/agents/tools/index.ts` — Registrierte Tools
5. `server/src/services/agents/tools/agent.ts` — Subagent-Pattern (Vorlage fuer Expert Agents)
6. `server/src/services/agents/SubagentLoader.ts` — Markdown-Parsing fuer Agent-Definitionen
7. `server/src/services/agents/types.ts` — AgentTool, AgentUserContext Interfaces

## Neues Tool erstellen

1. `server/src/services/agents/tools/rag-search.ts` — Bestehendes Tool als Vorlage
2. `server/src/services/agents/types.ts` — AgentTool Interface (name, description, inputSchema, execute)
3. `server/src/services/agents/tools/index.ts` — Tool registrieren
4. `server/src/services/agents/ToolRegistry.ts` — Wie Tools gefiltert werden (Rollen, Skills)

## MCP-Integration aendern

1. `specs/20-mcp-samaworkforce.md` — MCP-Architektur
2. `server/src/services/mcp/McpClientManager.ts` — Client-Lifecycle, Tool-Discovery
3. `server/src/services/mcp/McpOAuthClient.ts` — Token-Management
4. `server/src/services/mcp/McpToolAdapter.ts` — MCP Tool → AgentTool Konvertierung
5. SamaWorkforce: `samaritano-platform/apps/api/src/mcp/` — MCP Server
6. SamaWorkforce: `samaritano-platform/apps/api/src/oauth/` — OAuth 2.1

## Skill erstellen oder aendern

1. `server/skills/` — Bestehende Skills als Vorlage
2. `server/src/services/skills/SkillLoader.ts` — Wie Skills geladen werden
3. `server/src/services/skills/SkillRegistry.ts` — Skill-Verwaltung
4. `specs/archive/19_SKILL_CREATOR_V2_SPEC.md` — Skill-System Spec

## Memory-System implementieren

1. `specs/23-memory-system.md` — Hindsight-Integration, 3 Ebenen
2. `specs/00-cor7ex-vision.md` — Abschnitt "Memory-Architektur"

## Heartbeat implementieren

1. `specs/24-heartbeat-engine.md` — Cron, Briefing, Panels
2. `server/src/services/agents/AgentExecutor.ts` — SSE-Events als Vorlage

## RAG / Wissensdatenbank aendern

1. `server/src/services/VectorServiceV2.ts` — Weaviate Hybrid Search
2. `server/src/services/graph/GraphService.ts` — Neo4j Knowledge Graph
3. `server/src/services/agents/tools/rag-search.ts` — RAG Search Tool
4. `server/src/services/agents/tools/graph-query.ts` — Graph Query Tool
5. `server/src/services/agents/tools/read-chunk.ts` — Chunk-Loader

## Frontend aendern

1. `src/components/` — UI-Komponenten (ChatInput, DocumentList, etc.)
2. `src/pages/` — Seiten-Komponenten (Login, Documents, Admin)
3. `src/lib/api.ts` — REST API Client
4. `src/lib/socket.ts` — Socket.io Client
5. `src/hooks/` — Custom Hooks (useAutoResize, useSocket, etc.)
6. `src/App.tsx` — Routing

## Bug fixen

1. Symptom lokalisieren — Frontend oder Backend?
2. Frontend: Browser DevTools → Network Tab → welcher API-Call schlaegt fehl?
3. Backend: `server/src/routes/` → relevanter Endpunkt
4. Agent-Bug: `server/src/services/agents/AgentExecutor.ts` → SSE Events pruefen
5. Tool-Bug: `server/src/services/agents/tools/` → relevantes Tool
6. DB-Bug: PostgreSQL auf Hetzner pruefen (SSH Tunnel aktiv?)

## Infrastruktur / Deployment

1. `server/.env` — Alle Verbindungen und Konfigurationen
2. `server/start-tunnels.sh` — SSH-Tunnel zum Hetzner-Server
3. `server/switch-env.sh` — Umschalten zwischen Hetzner und lokal
4. `docker/` — Docker-Konfigurationen
