# Spec: Memory System

**Status:** Entwurf
**Abhaengigkeiten:** [22_EXPERT_AGENT_HARNESS_SPEC.md](./22_EXPERT_AGENT_HARNESS_SPEC.md)
**Bezug:** [00_COR7EX_VISION.md](./00_COR7EX_VISION.md) — Abschnitt "Memory-Architektur"
**Analyse:** [memory/analysis_memory_systems.md](../memory/analysis_memory_systems.md) — Deep-Dive Zep vs Mem0 vs Letta + Hindsight + Backboard

---

## Zusammenfassung

**Hindsight** wird als Memory-Engine eingesetzt. Ein Docker-Container auf dem Hetzner-Server stellt die Memory-API bereit. Der TypeScript-Client (`@vectorize-io/hindsight-client`) verbindet Cor7ex mit dem Memory-Server. Drei Memory-Ebenen (User, Agent, Hive Mind) werden ueber **Memory Banks** abgebildet. Hindsight speichert alles in PostgreSQL (pgvector + BM25 + Graph als SQL-Relationen).

**Kernprinzip:** Memory waechst automatisch aus Interaktionen. Der Hive Mind wird mit jedem Tag klueger — nicht weil jemand es programmiert, sondern weil er es erlebt.

---

## Technologie-Entscheidung

### Bewertung aller Kandidaten

| Kriterium | Hindsight | Mem0 OSS | Zep/Graphiti | Backboard.io |
|---|---|---|---|---|
| **LoCoMo Benchmark** | **85%** | 66% | 75% | 90% (kein Self-Hosting) |
| **LongMemEval** | **89-91%** | — | ~85% | 93% (kein Self-Hosting) |
| **Self-hosted** | Ja (Docker) | Ja (Library) | Graphiti: Ja | Nein → ausgeschieden |
| **Lizenz** | MIT | Apache-2.0 | Apache-2.0 | Proprietaer → ausgeschieden |
| **Retrieval** | **4 Strategien** (Vektor+BM25+Graph+Temporal) | 2 (Vektor+Graph) | 3 (Vektor+BM25+Graph) | Unbekannt |
| **Temporal** | **Stark** (occurred_start/end nativ) | Schwach (nur Timestamps) | Sehr stark (bi-temporal) | Unbekannt |
| **LLM-Kosten Recall** | **Kein LLM noetig** | LLM pro Suche | LLM pro Suche | Unbekannt |
| **Custom Extraction** | **Sehr konfigurierbar** (Mission + Mode + Custom Instructions) | Basic (Custom Prompt) | LLM-basiert | — |
| **TypeScript SDK** | HTTP Client | Library (ab v2.4.5) | Nur Cloud Client | HTTP Client |
| **Storage** | PostgreSQL only (pgvector) | PGVector + Neo4j | Neo4j (Graphiti) | Black Box |

### Entscheidung: Hindsight

**Gruende:**
1. 85% vs 66% Accuracy — bei einem System das "ueber Zeit lernen" soll entscheidend
2. Temporale Awareness nativ (keine Custom-Erweiterung noetig)
3. LLM-freier Recall spart Kosten bei hunderten Anfragen pro Tag
4. 4 Retrieval-Strategien parallel — optimale Ergebnisse
5. Custom Extraction pro Bank — perfekt fuer Expert Agent Domains
6. PostgreSQL-only vereinfacht Infrastruktur fuer Memory

**Trade-offs akzeptiert:**
- Extra Docker-Container (akzeptabel — wir betreiben bereits 8+ Services)
- Pre-1.0 (MIT-lizenziert, aktive Entwicklung, fork-bar)
- Kein Neo4j fuer Memory (Neo4j bleibt fuer bestehenden GraphService/Wissensdatenbank)

---

## Architektur

### Deployment

```
Hetzner Server (167.235.135.132):
  ├── PostgreSQL :5432        (bestehend — Hindsight nutzt eigene DB/Schema)
  ├── Hindsight Server :8888  (NEU — Docker Container)
  ├── Weaviate :8080          (bestehend — Wissensdatenbank/RAG, NICHT fuer Memory)
  ├── Neo4j :7687             (bestehend — GraphService, NICHT fuer Memory)
  ├── Reranker :8001          (bestehend)
  └── ...

Lokaler Mac:
  ├── Cor7ex Backend :3001    (ruft Hindsight via SSH-Tunnel auf)
  └── Cor7ex Frontend :5173
```

### Storage-Trennung

| System | Zweck | Aenderung |
|---|---|---|
| **PostgreSQL + pgvector** | Hindsight Memory (Fakten, Embeddings, Graph, Temporal) | Neue DB `hindsight` auf bestehendem PostgreSQL |
| **Weaviate** | Wissensdatenbank/RAG (Dokumente, Chunks) | Bleibt wie bisher — NICHT fuer Memory |
| **Neo4j** | Knowledge Graph (Dokument-Beziehungen) | Bleibt wie bisher — NICHT fuer Memory |
| **Redis** | Cache | Bleibt wie bisher |

**Saubere Trennung:** Weaviate + Neo4j fuer die Wissensdatenbank. Hindsight (PostgreSQL) fuer Memory. Kein Mischen.

---

## Hindsight Konfiguration

### Docker Deployment

```yaml
# docker-compose.yml (auf Hetzner)
hindsight:
  image: ghcr.io/vectorize-io/hindsight:latest
  ports:
    - "8888:8888"
  environment:
    # PostgreSQL (eigene DB auf bestehendem Server)
    HINDSIGHT_API_DB_HOST: localhost
    HINDSIGHT_API_DB_PORT: 5432
    HINDSIGHT_API_DB_NAME: hindsight
    HINDSIGHT_API_DB_USER: hindsight
    HINDSIGHT_API_DB_PASSWORD: ${HINDSIGHT_DB_PASSWORD}

    # LLM fuer Fakten-Extraktion
    HINDSIGHT_API_LLM_PROVIDER: openai
    HINDSIGHT_API_LLM_BASE_URL: ${LLM_BASE_URL}     # OVH Endpoint
    HINDSIGHT_API_LLM_API_KEY: ${LLM_API_KEY}
    HINDSIGHT_API_LLM_MODEL: gpt-oss-120b

    # Embeddings (multilingual fuer Deutsch)
    HINDSIGHT_API_EMBEDDER_PROVIDER: openai
    HINDSIGHT_API_EMBEDDER_BASE_URL: ${EMBEDDING_BASE_URL}
    HINDSIGHT_API_EMBEDDER_MODEL: text-embedding-3-small

    # Reranker (optional — nutzt bestehenden Reranker)
    HINDSIGHT_API_RERANKER_PROVIDER: tei
    HINDSIGHT_API_RERANKER_BASE_URL: http://localhost:8001
```

### SSH-Tunnel Erweiterung

```bash
# In start-tunnels.sh ergaenzen:
-L 8888:localhost:8888    # Hindsight Memory Server
```

---

## Drei Memory-Ebenen via Memory Banks

Hindsight nutzt **Memory Banks** als Isolation-Einheit. Wir bilden unsere drei Ebenen darauf ab:

```
Memory Banks:
├── user-{userId}              → User Memory (pro Mitarbeiter)
│   z.B. "user-lisa-123"
├── agent-{agentName}          → Agent Memory (pro Expert Agent)
│   z.B. "agent-hr-expert"
│   z.B. "agent-accounting-expert"
└── hive-{orgId}               → Hive Mind Memory (pro Unternehmen)
    z.B. "hive-tenant-samaritano"
```

### Bank-Erstellung bei Setup

```typescript
import { HindsightClient } from '@vectorize-io/hindsight-client';

const hindsight = new HindsightClient({
  baseUrl: 'http://localhost:8888',
});

// User Bank erstellen
await hindsight.createBank(`user-${userId}`, {
  retainMission: 'Speichere Praeferenzen, Feedback und Arbeitsmuster dieses Mitarbeiters.',
  retainExtractionMode: 'concise',
  enableObservations: true,
});

// Agent Bank erstellen (mit domain-spezifischer Extraction)
await hindsight.createBank('agent-hr-expert', {
  retainMission: `
    Speichere HR-relevante Fakten: Mitarbeiter-Infos, Einsatz-Details,
    AUeG-Fristen, Kuendigungsmuster, Schichtpraeferenzen.
    Achte auf zeitliche Angaben (seit wann, bis wann).
  `,
  retainExtractionMode: 'custom',
  retainCustomInstructions: `
    Extrahiere folgende Fakt-Typen:
    - mitarbeiter: Name, Qualifikation, Praeferenzen, Gesundheit
    - einsatz: Kunde, Einrichtung, Zeitraum, Status
    - compliance: AUeG-Fristen, Equal Pay, Drehtuerklausel
    - muster: Wiederkehrende Beobachtungen, saisonale Trends
    Gib zeitliche Angaben als occurred_start/occurred_end an.
  `,
  enableObservations: true,
});

// Hive Mind Bank erstellen
await hindsight.createBank(`hive-${orgId}`, {
  retainMission: `
    Speichere unternehmensweite Erkenntnisse: Cross-Domain-Zusammenhaenge,
    bestaetigte Muster, strategisches Wissen.
  `,
  retainExtractionMode: 'verbose',
  enableObservations: true,
});
```

---

## Ebene 1: User Memory

**Bank:** `user-{userId}`

**Was gespeichert wird:**
- Praeferenzen: "Ich will Tabellen statt Fliesstext"
- Persoenliches Feedback: "Klinikum X ist unzuverlaessig"
- Gelernte Muster: "Lisa fragt montags immer nach Klinikum X"

**API:**

```typescript
// Speichern (nach jeder Interaktion)
await hindsight.retain(
  `user-${userId}`,
  conversationText,
  { timestamp: new Date(), tags: [`session-${sessionId}`] }
);

// Abrufen (bei neuer Anfrage)
const userMemories = await hindsight.recall(
  `user-${userId}`,
  userQuery,
  { maxTokens: 2000, tags: [`user-${userId}`] }
);
```

**Wann geschrieben:** Automatisch nach jeder Interaktion (non-blocking).

### Ebene 2: Expert Agent Memory

**Bank:** `agent-{agentName}`

**Was gespeichert wird:**
- Domain-Fakten: "Klinikum X zahlt durchschnittlich 45 Tage spaet"
- Gelernte Regeln: "Bei Kuendigungen im Februar wird April-Planung eng"
- Procedurale Erinnerungen: "Monatsbericht braucht Daten aus 3 Quellen"

**API:**

```typescript
// Speichern (nach jedem Expert Agent Aufruf)
await hindsight.retain(
  `agent-${agentName}`,
  `Task: ${task}\nResult: ${result}`,
  { timestamp: new Date() }
);

// Abrufen (beim Start eines Expert Agent Aufrufs)
const agentMemories = await hindsight.recall(
  `agent-${agentName}`,
  task,
  { maxTokens: 3000 }
);
```

**Custom Extraction pro Agent:** Jede Agent-Bank hat ihre eigene `retainMission` und `retainCustomInstructions` — HR extrahiert Personen/Vertraege, Buchhaltung extrahiert Betraege/Fristen.

### Ebene 3: Hive Mind Memory

**Bank:** `hive-{orgId}`

**Was gespeichert wird:**
- Cross-Domain Zusammenhaenge: "Klinikum X: spaete Zahlung + geplante Einsaetze = Risiko"
- Hochgestuftes Wissen: "5 Mitarbeiter sagen Klinikum X ist unzuverlaessig"
- Saisonale Muster: "Im Februar kuendigen ueberdurchschnittlich viele"

**API:**

```typescript
// Hochstufen (Admin-Aktion)
await hindsight.retain(
  `hive-${orgId}`,
  `Unternehmens-Erkenntnis: Klinikum X zahlt unzuverlaessig (bestaetigt von 5 Mitarbeitern)`,
  {
    timestamp: new Date(),
    metadata: { promotedFrom: 'user_memories', confidence: 0.92 },
  }
);

// Abrufen (bei jeder User-Anfrage)
const hiveMindMemories = await hindsight.recall(
  `hive-${orgId}`,
  userQuery,
  { maxTokens: 4000 }
);
```

**Wann geschrieben:** Nur durch Promotion Pipeline (Admin-gesteuert, Phase 1).

---

## Write-Pipeline

### Automatisch: Nach jeder Interaktion

```
User ↔ Hive Mind ↔ Expert Agent
          │
          ▼
    Hintergrund-Job (non-blocking):
          │
          ├── User Memory:
          │   hindsight.retain(`user-${userId}`, conversation)
          │   → Hindsight extrahiert Fakten automatisch (4 Memory-Typen)
          │   → Erstellt Entitaeten, Links, Embeddings
          │   → Consolidation generiert Observations async
          │
          └── Agent Memory:
              hindsight.retain(`agent-${agentName}`, taskResult)
              → Custom Extraction via retainMission
              → Domain-spezifische Fakten + temporale Einordnung
```

**Non-blocking:** Memory-Writes passieren im Hintergrund.

```typescript
// In AgentExecutor, nach jeder abgeschlossenen Interaktion:
setImmediate(async () => {
  try {
    // User Memory
    await hindsight.retain(`user-${context.userId}`, conversationText, {
      timestamp: new Date(),
    });

    // Agent Memory (fuer jeden aufgerufenen Expert Agent)
    for (const expertCall of expertAgentCalls) {
      await hindsight.retain(
        `agent-${expertCall.agentName}`,
        `Task: ${expertCall.task}\nResult: ${expertCall.result}`,
        { timestamp: new Date() }
      );
    }
  } catch (error) {
    console.error('[Memory] Write failed (non-critical):', error);
  }
});
```

### Explizit: User sagt "Merke dir X"

```typescript
// Hive Mind erkennt expliziten Memory-Befehl:
await hindsight.retain(
  `user-${context.userId}`,
  `Explizites Feedback: ${userFeedback}`,
  { timestamp: new Date(), metadata: { explicit: true } }
);
```

### Reflect: Tiefere Analyse

Hindsight's `reflect` Operation fuer komplexe Fragen die Reasoning ueber Memory brauchen:

```typescript
// Z.B. fuer Heartbeat "Was ist das Muster bei Kuendigungen?"
const insight = await hindsight.reflect(
  `agent-hr-expert`,
  'Welche Muster gibt es bei Kuendigungen in den letzten 12 Monaten?'
);
// → Generiert Mental Model basierend auf allen gespeicherten Fakten
```

---

## Read-Pipeline

### Bei jeder User-Anfrage (Hive Mind Kontext)

```typescript
async function loadHiveMindContext(
  userQuery: string,
  userId: string,
  orgId: string,
): Promise<{ userMemory: string; hiveMindMemory: string }> {

  // Parallel: User Memory + Hive Mind Memory (LLM-frei!)
  const [userResults, hiveMindResults] = await Promise.all([
    hindsight.recall(`user-${userId}`, userQuery, { maxTokens: 2000 }),
    hindsight.recall(`hive-${orgId}`, userQuery, { maxTokens: 4000 }),
  ]);

  return {
    userMemory: formatRecallResults(userResults),
    hiveMindMemory: formatRecallResults(hiveMindResults),
  };
}
```

### Bei jedem Expert Agent Aufruf

```typescript
async function loadAgentMemory(
  task: string,
  agentName: string,
): Promise<string> {
  const results = await hindsight.recall(
    `agent-${agentName}`,
    task,
    { maxTokens: 3000 }
  );
  return formatRecallResults(results);
}
```

### Retrieval: 4 Strategien parallel (Hindsight intern)

```
recall("agent-hr-expert", "Status Klinikum X")
  │
  ├── 1. Semantic Search (pgvector cosine similarity)
  ├── 2. Keyword Search (BM25 Full-Text)
  ├── 3. Graph Retrieval (Entity Link Expansion)
  └── 4. Temporal Search (occurred_start/end Range)
  │
  ▼
  Reciprocal Rank Fusion + Cross-Encoder Reranking
  │
  ▼
  Top-N relevanteste Memories
```

**Kein LLM-Call beim Recall** — nur Embeddings + Reranking. Schnell und guenstig.

---

## Temporale Awareness (nativ)

Hindsight trackt Zeitgueltigkeit automatisch:

```typescript
// Beim Retain extrahiert Hindsight automatisch:
await hindsight.retain(
  'agent-accounting-expert',
  'Seit Juni 2025 zahlt Klinikum X regelmaessig zu spaet.',
  { timestamp: new Date() }
);
// → Hindsight erkennt: occurred_start = 2025-06-01

// Spaeter:
await hindsight.retain(
  'agent-accounting-expert',
  'Seit Januar 2026 zahlt Klinikum X wieder puenktlich.',
  { timestamp: new Date() }
);
// → Hindsight erkennt: occurred_start = 2026-01-01
// → Temporal Search kann beides finden und zeitlich einordnen
```

**Recall mit Zeitfilter:**

```typescript
const results = await hindsight.recall(
  'agent-accounting-expert',
  'Zahlungsverhalten Klinikum X',
  {
    maxTokens: 3000,
    // Hindsight's temporal strategy findet automatisch
    // die aktuellsten Fakten und ordnet sie zeitlich ein
  }
);
```

Kein manuelles `validFrom`/`validUntil` noetig — Hindsight extrahiert temporale Informationen automatisch aus dem Text.

---

## Promotion Pipeline (Phase 1: Manuell)

Identisch zum vorherigen Design — Admin entscheidet:

```
Admin-Dashboard zeigt:
  "3 Mitarbeiter haben unabhaengig gemerkt: Klinikum X zahlt spaet"
  [→ Zum Unternehmenswissen hochstufen]
  [→ Ignorieren]
```

```typescript
// Promotion: User Memory → Hive Mind Memory
async function promoteToHiveMind(
  userBankId: string,
  factContent: string,
  orgId: string,
) {
  await hindsight.retain(
    `hive-${orgId}`,
    `Unternehmens-Erkenntnis: ${factContent}`,
    {
      timestamp: new Date(),
      metadata: { promotedFrom: userBankId },
    }
  );
}
```

### Kandidaten-Erkennung

```typescript
// Cron-Job: Taeglich aehnliche User-Memories suchen
async function findPromotionCandidates(orgId: string, userIds: string[]) {
  const candidates: Map<string, { users: string[]; content: string }> = new Map();

  for (const userId of userIds) {
    const memories = await hindsight.recall(
      `user-${userId}`,
      '*',  // Alle Memories
      { maxTokens: 10000 }
    );

    // Aehnliche Memories ueber User hinweg gruppieren
    for (const mem of memories) {
      // ... Similarity-Check gegen bestehende Kandidaten
    }
  }

  // Cluster mit >= 3 verschiedenen Usern → Kandidat
  return [...candidates.values()].filter(c => c.users.length >= 3);
}
```

---

## Integration in den Hive Mind

### System Prompt Injection

```typescript
// In buildHiveMindPrompt() (Spec 21):
const { userMemory, hiveMindMemory } = await loadHiveMindContext(
  userQuery, context.userId, context.tenantId
);

const systemPrompt = `
Du bist der Hive Mind von ${tenant.companyName}.

## Verfuegbare Expert Agents
${expertAgentList}

## Ueber den User (${userName})
${userMemory || 'Noch keine Praeferenzen gespeichert.'}

## Gelerntes Unternehmenswissen
${hiveMindMemory || 'Noch keine Erkenntnisse gespeichert.'}

## Regeln
...
`;
```

### Expert Agent System Prompt Injection

```typescript
// In createExpertAgentTool() (Spec 21):
const agentMemory = await loadAgentMemory(task, harness.name);

const instructions = `
${harness.instructions}

## Dein gelerntes Wissen
${agentMemory || 'Noch keine Erfahrungen gespeichert.'}
`;
```

---

## MemoryService (Wrapper)

```typescript
class MemoryService {
  private client: HindsightClient;

  constructor(baseUrl: string) {
    this.client = new HindsightClient({ baseUrl });
  }

  // ─── Setup ─────────────────────────────────────
  async createUserBank(userId: string): Promise<void>;
  async createAgentBank(agentName: string, mission: string, customInstructions?: string): Promise<void>;
  async createHiveMindBank(orgId: string): Promise<void>;

  // ─── Write ─────────────────────────────────────
  async retainUserMemory(userId: string, conversation: string): Promise<void>;
  async retainAgentMemory(agentName: string, taskResult: string): Promise<void>;
  async retainHiveMindMemory(orgId: string, content: string, meta?: object): Promise<void>;

  // ─── Read ──────────────────────────────────────
  async recallUserMemory(userId: string, query: string, maxTokens?: number): Promise<string>;
  async recallAgentMemory(agentName: string, query: string, maxTokens?: number): Promise<string>;
  async recallHiveMindMemory(orgId: string, query: string, maxTokens?: number): Promise<string>;

  // ─── Hive Mind Context (parallel load) ─────────
  async loadHiveMindContext(query: string, userId: string, orgId: string): Promise<HiveMindContext>;
  async loadAgentContext(query: string, agentName: string): Promise<string>;

  // ─── Reflect ───────────────────────────────────
  async reflectAgent(agentName: string, question: string): Promise<string>;

  // ─── Promotion ─────────────────────────────────
  async promoteToHiveMind(userBankId: string, content: string, orgId: string): Promise<void>;
  async findPromotionCandidates(orgId: string, userIds: string[]): Promise<PromotionCandidate[]>;
}
```

---

## Implementierung

### Phase 1: Deployment + Basis (Woche 1)
- Hindsight Docker auf Hetzner deployen
- PostgreSQL DB `hindsight` erstellen, pgvector aktivieren
- SSH-Tunnel erweitern (Port 8888)
- `@vectorize-io/hindsight-client` installieren
- MemoryService Grundstruktur
- User + Agent Banks erstellen

### Phase 2: Write + Read Integration (Woche 2)
- Non-blocking Retain nach Interaktionen
- Recall in Hive Mind System Prompt
- Recall in Expert Agent System Prompt
- Custom Extraction Prompts pro Agent-Domain

### Phase 3: Hive Mind Memory + Promotion (Woche 3-4)
- Hive Mind Bank pro Tenant
- Promotion Pipeline (Admin-Dashboard)
- Kandidaten-Erkennung
- Admin-API Endpunkte

### Phase 4: Reflect + Polish (Woche 5)
- Reflect-Operation fuer Heartbeat-Analysen
- Observations (Consolidation) konfigurieren
- Monitoring und Observability
- Embedding-Modell auf Multilingual testen

---

## Dateien

### Neue Dateien:
1. `server/src/services/memory/MemoryService.ts` — Zentraler Memory Service
2. `server/src/services/memory/memory-config.ts` — Hindsight Client Config
3. `server/src/routes/memory.ts` — Admin API (Dashboard, Promotion)
4. `docker/hindsight/docker-compose.yml` — Hindsight Deployment

### Modifizierte Dateien:
1. `server/src/services/agents/AgentExecutor.ts` — Memory Write + Read Integration
2. `server/src/services/agents/tools/agent.ts` → Expert Agent Tools — Agent Memory laden
3. `server/src/index.ts` — MemoryService initialisieren
4. `server/.env` — Hindsight Env-Variablen
5. `server/start-tunnels.sh` — Port 8888 ergaenzen

### Neue Dependencies:
- `@vectorize-io/hindsight-client` — TypeScript Client (878 KB, zero dependencies)

### Infrastruktur:
- Docker Container `hindsight` auf Hetzner
- PostgreSQL DB `hindsight` mit pgvector Extension

---

## Verifikation

| Test | Erwartung |
|---|---|
| Hindsight Server laeuft | `curl http://localhost:8888/health` → OK |
| Bank erstellen | `createBank("user-lisa")` → Bank existiert |
| Retain | `retain("user-lisa", "Ich mag Tabellen")` → Fakt extrahiert |
| Recall (LLM-frei) | `recall("user-lisa", "Format-Praeferenz")` → "bevorzugt Tabellen" |
| Agent Memory | `retain("agent-hr-expert", "Klinikum X...")` → Domain-Fakt gespeichert |
| Hive Mind Memory | Nach Promotion: `recall("hive-tenant", "Klinikum")` → Unternehmens-Fakt |
| Temporal | "Seit Juni spaet" + "Seit Januar puenktlich" → Recall liefert aktuellsten Stand |
| 4 Retrieval-Strategien | Recall findet Fakten via Vektor UND Keyword UND Graph UND Temporal |
| Non-blocking | Memory Write verzoegert User-Antwort nicht |
| Custom Extraction | HR-Bank extrahiert Mitarbeiter-Fakten, Accounting-Bank extrahiert Betraege |

---

## Offene Punkte (spaetere Specs)

- **Heartbeat nutzt Memory**: Reflect-Operation fuer Muster-Analyse → Spec 24
- **Multi-Tenant**: Bank-Namenskonvention + PostgreSQL Schema Isolation → Spec 25
- **Embedding-Modell**: Multilingual testen fuer deutsche Inhalte
- **Graph Cleanup**: Hindsight verwaltet Graph intern — kein manuelles Cleanup noetig
