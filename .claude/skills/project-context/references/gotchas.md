# Gotchas — Nicht-offensichtliche Fallen

Lies diese Datei wenn du auf unerwartetes Verhalten stoesst oder bevor du in einen
neuen Bereich einsteigst.

---

## SSH-Tunnel muessen laufen

**Was du erwarten wuerdest:** Services wie PostgreSQL, Weaviate, Neo4j laufen lokal.

**Was tatsaechlich passiert:** Alle externen Services laufen auf dem Hetzner-Server
(167.235.135.132) und werden ueber SSH-Tunnel auf localhost gemapped.

**Konsequenz:** Vor dem Starten von Cor7ex: `server/start-tunnels.sh` in einem
separaten Terminal ausfuehren. Ohne Tunnel bekommst du `ECONNREFUSED` Fehler.

**Ports die getunnelt werden:** 5432 (PostgreSQL), 6379 (Redis), 7687 (Neo4j),
8080 (Weaviate), 8001 (Reranker), 8002 (Parser), 8003/8004 (Presidio).

---

## Zwei PostgreSQL-Instanzen

**Was du wissen musst:** Es gibt zwei separate PostgreSQL-Datenbanken:
- **Cor7ex DB** auf Hetzner (Port 5432 via Tunnel) — Agent Tasks, User, etc.
- **SamaWorkforce DB** lokal im Docker (Port 5432) — SamaWorkforce Daten

**Konsequenz:** Wenn SamaWorkforce parallel laeuft, pruefen ob der lokale Docker-
PostgreSQL auf Port 5432 laeuft. Cor7ex' Tunnel mapped auch auf 5432 — Konflikte
moeglich. SamaWorkforce Docker muss zuerst gestartet werden.

---

## SamaWorkforce muss vor Cor7ex starten

**Was du wissen musst:** Die MCP-Integration verbindet sich beim Cor7ex-Start zum
SamaWorkforce MCP-Server (Port 3000). Wenn SamaWorkforce nicht laeuft, startet
Cor7ex trotzdem — aber ohne MCP Tools (`sama_*`).

**Konsequenz:** Reihenfolge: 1) SamaWorkforce (`bun run start:dev`), 2) Cor7ex
(`bun run dev:all`). Der MCP Client hat Auto-Reconnect — wenn SamaWorkforce spaeter
startet, verbindet er sich beim naechsten Tool-Call.

---

## Agent System Prompt wird dynamisch generiert

**Was du erwarten wuerdest:** Ein statischer System Prompt.

**Was tatsaechlich passiert:** `AgentExecutor.buildSystemPrompt()` baut den Prompt
dynamisch aus: verfuegbaren Tools, geladenen Skills, verfuegbaren Subagents,
und aktiver Skill-Instruktion.

**Konsequenz:** Aenderungen am Agent-Verhalten erfordern oft NICHT eine Prompt-
Aenderung, sondern eine Aenderung an den Tools, Skills oder Subagent-Definitionen.
Der Prompt passt sich automatisch an.

---

## prepareStep erzwingt Tool-Nutzung im ersten Step

**Was du wissen musst:** In `AgentExecutor.runTurn()` wird `prepareStep` genutzt
um im ersten Step des ersten Turns `toolChoice: 'required'` zu setzen. Das zwingt
das LLM ein Tool aufzurufen statt direkt zu antworten.

**Konsequenz:** Der Agent wird IMMER zuerst ein Tool aufrufen (rag_search, load_skill,
agent) bevor er antwortet. Das ist beabsichtigt — verhindert Halluzinationen bei
Wissensfragen. Kann aber bei einfachen Fragen ("Hallo") zu unnoetigem Tool-Overhead
fuehren.

---

## Verschluesselung in SamaWorkforce

**Was du wissen musst:** SamaWorkforce verschluesselt personenbezogene Daten mit
AES-256-GCM (`@encrypted` Directive). Felder wie `nameEnc`, `cityEnc`, `phoneEnc`
sind in der DB verschluesselt.

**Konsequenz:** Wenn du ueber MCP auf SamaWorkforce-Daten zugreifst, bekommst du
die entschluesselten Werte (der GraphQL Resolver entschluesselt). Aber in der DB
sehen die Werte anders aus (z.B. `v1:58fcb86e...:c2d9b5da...`). Nicht verwirren
lassen wenn du direkt in die DB schaust.

---

## MCP Tools nutzen JSON-String fuer Args

**Was du wissen musst:** MCP Tools erwarten `args` als JSON-String, nicht als Objekt.
GraphQL Enum-Werte (HOSPITAL, ACTIVE, etc.) werden als UPPER_SNAKE_CASE erkannt
und ohne Anfuehrungszeichen in die GraphQL Query eingefuegt.

**Konsequenz:** Beim Tool-Call: `args: '{"id": "abc-123"}'` (String), nicht
`args: { id: "abc-123" }` (Objekt). Der GraphQL Bridge parst den String.

---

## Weaviate fuer Dokumente, NICHT fuer Memory

**Was du wissen musst:** Weaviate wird NUR fuer die Wissensdatenbank (RAG) genutzt —
Dokumente, Chunks, Hybrid Search. Das Memory-System (Hindsight, geplant) nutzt
PostgreSQL mit pgvector.

**Konsequenz:** Wenn du Memory-Features implementierst, verwende NICHT den
VectorServiceV2 (Weaviate). Das Memory-System hat seinen eigenen Storage-Layer.

---

## Neo4j fuer Knowledge Graph, NICHT fuer Memory

**Was du wissen musst:** Analog zu Weaviate — Neo4j wird fuer den bestehenden
Knowledge Graph (Dokument-Beziehungen, GraphService) genutzt, NICHT fuer das
Memory-System.

**Konsequenz:** Hindsight speichert seinen Graph in PostgreSQL als SQL-Relationen,
nicht in Neo4j. Zwei Graph-Systeme: Neo4j (Wissensdatenbank) + PostgreSQL (Memory).

---

## Vercel AI SDK 6: ToolLoopAgent, nicht generateText

**Was du wissen musst:** Cor7ex nutzt `ToolLoopAgent` aus dem Vercel AI SDK 6
(vormals `experimental_generateText` mit Tool-Loop). Das ist der Agent-Loop der
automatisch Tools aufruft und iteriert.

**Konsequenz:** Verwende `ToolLoopAgent` fuer Agent-Logik, nicht `generateText`
direkt. `generateText` ist fuer einfache LLM-Calls ohne Tool-Loop.

---

## gpt-oss-120b ist das einzige Modell

**Was du wissen musst:** Aktuell ist nur `gpt-oss-120b` (via OVH EU Cloud)
verfuegbar. Kein Claude, kein GPT-4, kein lokales Modell fuer Agents.

**Konsequenz:** Alle Model-Referenzen in Specs die "sonnet", "haiku" oder
"opus" erwaehnen sind fuer spaeter. Aktuell immer `gpt-oss-120b` nutzen.
Konfiguriert in `.env` als `CLOUD_MODEL`.

---

## Port-Belegung

| Port | Service |
|------|---------|
| 3000 | SamaWorkforce API (NestJS) |
| 3001 | Cor7ex Backend (Express) |
| 5173 | Cor7ex Frontend (Vite) |
| 5211 | SamaWorkforce Frontend (Vite) |
| 5432 | PostgreSQL (Hetzner via Tunnel ODER Docker lokal) |
| 6379 | Redis (Hetzner via Tunnel) |
| 7687 | Neo4j (Hetzner via Tunnel) |
| 8080 | Weaviate (Hetzner via Tunnel) |
| 8001 | Reranker (Hetzner via Tunnel) |
| 8888 | Hindsight Memory (geplant, Hetzner) |
