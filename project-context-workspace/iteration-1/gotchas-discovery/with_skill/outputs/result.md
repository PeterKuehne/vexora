# Cor7ex -- Nicht-offensichtliche Fallen fuer neue Entwickler

Dieses Dokument fasst die versteckten Stolperfallen im Cor7ex-Projekt zusammen,
die ein neuer Entwickler kennen sollte, bevor er produktiv arbeiten kann.

---

## 1. Nichts laeuft lokal -- alles kommt ueber SSH-Tunnel

**Erwartung:** PostgreSQL, Weaviate, Neo4j, Redis etc. laufen als lokale Docker-Container.

**Realitaet:** Alle schweren Infrastruktur-Services laufen auf einem Hetzner-Server
(167.235.135.132) und werden ueber SSH-Tunnel auf `localhost` gemapped. Ohne das
Skript `server/start-tunnels.sh` in einem separaten Terminal bekommt man bei jedem
Service-Zugriff `ECONNREFUSED`.

**Betroffene Ports:** 5432 (PostgreSQL), 6379 (Redis), 7687 (Neo4j), 8080 (Weaviate),
8001 (Reranker), 8002 (Parser), 8003/8004 (Presidio Analyzer/Anonymizer).

**Tipp:** Das Skript `server/switch-env.sh local|hetzner` schaltet zwischen dem
Hetzner-Server und einem lokalen Ubuntu-Server (192.168.2.38) um -- aber beide
Varianten erfordern Tunnel oder Netzwerkzugang, keine lokalen Container.

---

## 2. Port-5432-Konflikt: Zwei PostgreSQL-Instanzen

**Das Problem:** Cor7ex tunnelt PostgreSQL von Hetzner auf Port 5432. SamaWorkforce
(das Enterprise-System) hat einen eigenen lokalen Docker-PostgreSQL -- ebenfalls auf
Port 5432. Wenn beide gleichzeitig laufen sollen, gibt es einen Portkonflikt.

**Loesung:** SamaWorkforce Docker muss *zuerst* gestartet werden. Der Tunnel bindet
sich dann ggf. auf einen anderen Port oder man muss die Konfiguration anpassen.
Dieses Problem tritt vor allem auf, wenn man an der MCP-Integration arbeitet, die
beide Systeme gleichzeitig braucht.

---

## 3. Startreihenfolge ist kritisch

**Erwartung:** Man startet Cor7ex und alles funktioniert.

**Realitaet:** Die korrekte Reihenfolge ist:

1. `server/start-tunnels.sh` (SSH-Tunnel zum Hetzner-Server)
2. SamaWorkforce starten (`bun run start:dev` im SamaWorkforce-Repo, Port 3000)
3. Cor7ex starten (`bun run dev:all`, Backend Port 3001, Frontend Port 5173)

Wenn SamaWorkforce nicht laeuft, startet Cor7ex zwar -- aber ohne MCP-Tools
(`sama_*`). Der MCP Client hat Auto-Reconnect, d.h. wenn SamaWorkforce spaeter
hochfaehrt, verbindet er sich beim naechsten Tool-Call. Aber beim ersten Test
wundert man sich, warum die Workforce-Tools fehlen.

---

## 4. Der System Prompt ist dynamisch -- nicht in einer Datei editierbar

**Erwartung:** Es gibt eine System-Prompt-Datei die man anpasst.

**Realitaet:** `AgentExecutor.buildSystemPrompt()` generiert den Prompt zur Laufzeit
aus den aktuell verfuegbaren Tools, geladenen Skills, registrierten Subagents und
der aktiven Skill-Instruktion. Wenn man das Agent-Verhalten aendern will, muss man
meistens nicht den Prompt editieren, sondern die Tool-Definitionen, Skill-Markdown-
Dateien oder Subagent-Definitionen anpassen. Der Prompt passt sich automatisch an.

---

## 5. prepareStep erzwingt Tool-Nutzung im ersten Schritt

**Was passiert:** In `AgentExecutor.runTurn()` setzt `prepareStep` im ersten Step
des ersten Turns `toolChoice: 'required'`. Das LLM *muss* ein Tool aufrufen bevor
es antworten darf.

**Warum das wichtig ist:** Dies verhindert Halluzinationen bei Wissensfragen (der
Agent sucht erst in der Wissensdatenbank). Aber bei einfachen Fragen wie "Hallo"
oder "Wie geht's?" fuehrt das zu unnoetigem Tool-Overhead -- der Agent wird
trotzdem erst `rag_search` oder ein anderes Tool aufrufen.

**Falle:** Wenn man sich wundert, warum der Agent nie direkt antwortet, liegt es
an diesem Mechanismus, nicht an einem Bug.

---

## 6. MCP-Tool-Argumente sind JSON-Strings, keine Objekte

**Erwartung:** Man uebergibt `args: { id: "abc-123" }` als normales JS-Objekt.

**Realitaet:** MCP-Tools erwarten `args` als serialisierten JSON-String:
`args: '{"id": "abc-123"}'`. Der GraphQL Bridge parst diesen String intern.

**Zusaetzlich:** GraphQL-Enum-Werte wie `HOSPITAL`, `ACTIVE` etc. werden als
UPPER_SNAKE_CASE erkannt und *ohne Anfuehrungszeichen* in die GraphQL-Query
eingefuegt. Wenn man sie mit Quotes uebergibt, bricht die Query.

---

## 7. Verschluesselte Felder in SamaWorkforce

**Das Problem:** SamaWorkforce verschluesselt personenbezogene Daten mit AES-256-GCM
(`@encrypted` Directive). Felder wie `nameEnc`, `cityEnc`, `phoneEnc` sind in der
Datenbank als verschluesselte Strings gespeichert (z.B. `v1:58fcb86e...:c2d9b5da...`).

**Falle:** Wenn man ueber die MCP-Integration (GraphQL) auf die Daten zugreift,
bekommt man die entschluesselten Klartext-Werte -- der Resolver entschluesselt
automatisch. Schaut man aber direkt in die PostgreSQL-Datenbank, sehen die Werte
voellig anders aus. Das ist kein Datenfehler, sondern gewollte Verschluesselung.

---

## 8. Weaviate und Neo4j sind NICHT fuer das Memory-System

**Erwartung:** Weaviate (Vector DB) und Neo4j (Graph DB) werden fuer alles genutzt
was mit Vektoren oder Graphen zu tun hat.

**Realitaet:**
- **Weaviate** = nur Wissensdatenbank (Dokumente, Chunks, RAG/Hybrid Search)
- **Neo4j** = nur Knowledge Graph (Dokument-Beziehungen)
- **Memory-System (Hindsight)** = nutzt PostgreSQL mit pgvector fuer Vektoren und
  SQL-Relationen fuer den Memory-Graph

Wer Memory-Features implementiert, darf NICHT `VectorServiceV2` (Weaviate) oder
`GraphService` (Neo4j) verwenden. Es gibt zwei getrennte Graph-Systeme und zwei
getrennte Vektor-Speicher.

---

## 9. Nur ein LLM-Modell verfuegbar: gpt-oss-120b

**Erwartung:** Man kann zwischen verschiedenen Modellen wechseln (Claude, GPT-4, etc.)

**Realitaet:** Aktuell ist ausschliesslich `gpt-oss-120b` ueber OVH EU Cloud
verfuegbar. Alle Referenzen in den Specs auf "sonnet", "haiku" oder "opus" sind
Zukunftsplaene. Das Modell ist in `.env` als `CLOUD_MODEL` konfiguriert.

**Konsequenz:** Man kann keine Modell-spezifischen Features nutzen (z.B. Claude
Vision fuer Bilder). Alle Agent-Logik muss mit diesem einen Modell funktionieren.

---

## 10. Vercel AI SDK 6 -- ToolLoopAgent statt generateText

**Erwartung:** Man nutzt `generateText()` fuer LLM-Aufrufe.

**Realitaet:** Cor7ex nutzt `ToolLoopAgent` aus dem Vercel AI SDK 6 (frueher
`experimental_generateText` mit Tool-Loop). Das ist der automatische Agent-Loop
der Tools aufruft und iteriert. `generateText()` direkt ist nur fuer einfache
LLM-Calls ohne Tool-Loop gedacht.

**Falle:** Wer Agent-Logik mit `generateText()` implementiert, umgeht den gesamten
Tool-Loop-Mechanismus und bekommt kein Tool-Calling.

---

## 11. Sprach-Mix: Deutsch aussen, Englisch innen

**Erwartung:** Alles ist entweder Deutsch oder Englisch.

**Realitaet:** Es gibt eine strikte Trennung:
- **Deutsch:** Alle UI-Texte (Labels, Buttons, Fehlermeldungen, Toasts), Antworten
  an den User, Tool/Skill-Descriptions
- **Englisch:** Code-Kommentare, Variablennamen, Commit Messages, Typ-Bezeichner

Wer einen Button mit "Submit" statt "Absenden" beschriftet oder eine Variable
`benutzerName` statt `userName` nennt, bricht die Konvention.

---

## 12. Skill- und Tool-Definitionen leben in Markdown, nicht in Code

**Erwartung:** Skills und Subagents werden im TypeScript-Code definiert.

**Realitaet:** Skills liegen als Markdown-Dateien mit YAML-Frontmatter unter
`server/skills/skill-name/SKILL.md`. Subagents liegen unter `server/agents/` bzw.
`server/expert-agents/` als Markdown mit Frontmatter (`name`, `description`, `tools`,
`maxSteps`). Der Body ist der System Prompt.

Der `SkillLoader` und `SubagentLoader` parsen diese Markdown-Dateien zur Laufzeit.
Aenderungen an Skills erfordern also keine Code-Aenderung -- nur Markdown editieren.

---

## 13. Port-Uebersicht (leicht zu verwechseln)

| Port | Service | Wo |
|------|---------|----|
| 3000 | SamaWorkforce API (NestJS) | Lokal |
| 3001 | Cor7ex Backend (Express) | Lokal |
| 5173 | Cor7ex Frontend (Vite) | Lokal |
| 5211 | SamaWorkforce Frontend (Vite) | Lokal |
| 5432 | PostgreSQL | Hetzner via Tunnel ODER Docker lokal |
| 6379 | Redis | Hetzner via Tunnel |
| 7687 | Neo4j | Hetzner via Tunnel |
| 8080 | Weaviate | Hetzner via Tunnel |
| 8001 | Reranker | Hetzner via Tunnel |
| 8002 | Parser | Hetzner via Tunnel |
| 8003 | Presidio Analyzer | Hetzner via Tunnel |
| 8004 | Presidio Anonymizer | Hetzner via Tunnel |
| 8888 | Hindsight Memory (geplant) | Hetzner |

---

## Zusammenfassung: Die 5 wichtigsten Dinge fuer Tag 1

1. **Tunnel starten** -- ohne `server/start-tunnels.sh` geht nichts
2. **Startreihenfolge einhalten** -- Tunnel, dann SamaWorkforce, dann Cor7ex
3. **Nicht den System Prompt suchen** -- er wird dynamisch gebaut
4. **Memory != Weaviate/Neo4j** -- das Memory-System nutzt PostgreSQL/pgvector
5. **Nur gpt-oss-120b** -- kein Claude, kein GPT-4, nur dieses eine Modell
