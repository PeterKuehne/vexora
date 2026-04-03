# Spec: Memory System

**Status:** Entwurf
**Abhaengigkeiten:** [22_EXPERT_AGENT_HARNESS_SPEC.md](./22_EXPERT_AGENT_HARNESS_SPEC.md)
**Bezug:** [00_COR7EX_VISION.md](./00_COR7EX_VISION.md) — Abschnitt "Memory-Architektur"
**Analyse:** [memory/analysis_memory_systems.md](../memory/analysis_memory_systems.md) — Deep-Dive Zep vs Mem0 vs Letta

---

## Zusammenfassung

Mem0 OSS (`mem0ai` npm-Package) wird als Memory-Engine eingesetzt. Drei Memory-Ebenen (User, Agent, Hive Mind) nutzen PGVector fuer Vektor-Fakten und Neo4j fuer Graph-Beziehungen. Eine Custom Promotion Pipeline stuft Agent-Wissen zum Unternehmenswissen hoch. Temporale Metadaten erweitern Mem0 um Zeitgueltigkeit.

**Kernprinzip:** Memory waechst automatisch aus Interaktionen. Der Hive Mind wird mit jedem Tag klueger — nicht weil jemand es programmiert, sondern weil er es erlebt.

---

## Technologie-Entscheidung

| Kriterium | Mem0 OSS |
|---|---|
| Package | `mem0ai` v2.2.2 (Apache-2.0) |
| TypeScript SDK | Ja — `import { Memory } from 'mem0ai/oss'` |
| PGVector | Nativ unterstuetzt |
| Neo4j Graph | Nativ unterstuetzt |
| Vercel AI SDK | `@mem0/vercel-ai-provider` |
| Self-hosted | Ja — laeuft komplett lokal |
| Vendor Lock-in | Keines |

---

## Storage-Trennung

| System | Zweck | Aenderung |
|---|---|---|
| **Weaviate** | Wissensdatenbank/RAG (Dokumente, Chunks) | Bleibt wie bisher — NICHT fuer Memory |
| **PGVector** | Memory-Fakten (Vektor-Embeddings) | Neu — pgvector Extension auf bestehendem PostgreSQL |
| **Neo4j** | Graph-Beziehungen (Entitaeten, Relationen) | Erweitert — Mem0 nutzt bestehende Neo4j-Instanz |
| **PostgreSQL** | Strukturierte Daten (Tasks, Users, etc.) | Bleibt wie bisher |
| **Redis** | Cache | Bleibt wie bisher |

**Weaviate und Mem0 sind getrennt.** Weaviate fuer Dokument-Suche (RAG), PGVector fuer Memory-Fakten. Keine Vermischung.

---

## Konfiguration

```typescript
import { Memory } from 'mem0ai/oss';

const memoryConfig = {
  version: 'v1.1',

  // LLM fuer Fakten-Extraktion (nutzt bestehendes gpt-oss-120b)
  llm: {
    provider: 'openai',
    config: {
      apiKey: process.env.LLM_API_KEY,
      model: process.env.CLOUD_MODEL || 'gpt-oss-120b',
      baseURL: process.env.LLM_BASE_URL,     // OVH/Custom Endpoint
      temperature: 0.1,
    },
  },

  // Embedding Model
  embedder: {
    provider: 'openai',
    config: {
      apiKey: process.env.EMBEDDING_API_KEY,
      model: 'text-embedding-3-small',        // 1536 dims
    },
  },

  // Vektor-Store: PGVector auf bestehendem PostgreSQL
  vectorStore: {
    provider: 'pgvector',
    config: {
      connectionString: process.env.DATABASE_URL,
      collectionName: 'cor7ex_memories',
      embeddingModelDims: 1536,
    },
  },

  // Graph-Store: Bestehende Neo4j-Instanz
  graphStore: {
    provider: 'neo4j',
    config: {
      url: process.env.NEO4J_URI,             // bolt://127.0.0.1:7687
      username: process.env.NEO4J_USER,
      password: process.env.NEO4J_PASSWORD,
    },
  },
  enableGraph: true,

  // Audit-Trail
  historyStore: {
    provider: 'sqlite',                        // Leichtgewichtig fuer History
  },
};

export const memory = new Memory(memoryConfig);
```

### Voraussetzungen

```sql
-- pgvector Extension aktivieren (einmalig)
CREATE EXTENSION IF NOT EXISTS vector;
```

```bash
# Neo4j: APOC Plugin muss installiert sein (auf Hetzner bereits vorhanden)
```

---

## Drei Memory-Ebenen

### Ebene 1: User Memory

**Scope:** `userId` — pro Mitarbeiter

**Was gespeichert wird:**
- Praeferenzen: "Ich will Tabellen statt Fliesstext"
- Persoenliches Feedback: "Klinikum X ist unzuverlaessig"
- Gelernte Muster: "Lisa fragt montags immer nach Klinikum X"

**API:**

```typescript
// Speichern (nach jeder Interaktion)
await memory.add(
  `User: Zeige mir die Einsaetze als Tabelle\nAssistant: Hier ist die Tabelle...`,
  { userId: context.userId }
);

// Abrufen (bei jeder neuen Anfrage)
const userMemories = await memory.search(
  userQuery,
  { userId: context.userId, limit: 10 }
);
```

**Wann geschrieben:** Automatisch nach jeder Interaktion (Hintergrund-Job).

### Ebene 2: Expert Agent Memory

**Scope:** `agentId` — pro Expert Agent

**Was gespeichert wird:**
- Domain-Fakten: "Klinikum X zahlt durchschnittlich 45 Tage spaet"
- Gelernte Regeln: "Bei Kuendigungen im Februar wird April-Planung eng"
- Procedurale Erinnerungen: "Monatsbericht braucht Daten aus 3 Quellen"

**API:**

```typescript
// Speichern (nach jedem Expert Agent Aufruf)
await memory.add(
  `Task: Status Klinikum X\nResult: 3 offene Rechnungen, 45 Tage ueberfaellig`,
  { agentId: 'accounting-expert' }
);

// Abrufen (beim Start eines Expert Agent Aufrufs)
const agentMemories = await memory.search(
  task,
  { agentId: 'accounting-expert', limit: 10 }
);
```

**Custom Extraction Prompts pro Agent:**

```typescript
// HR-Agent extrahiert Personen, Vertraege, Fristen
const hrExtractionPrompt = `
Du extrahierst Fakten aus HR-Konversationen.
Erlaubte Fakt-Typen:
- mitarbeiter (Name, Qualifikation, Praeferenzen)
- einsatz (Kunde, Zeitraum, Status)
- compliance (AUeG-Fristen, Equal Pay, Drehtuer)
- muster (wiederkehrende Beobachtungen)

Beispiel:
Input: "Mitarbeiter Mueller bevorzugt Fruehschicht und hat Rueckenprobleme"
Output: {"facts": [
  {"type": "mitarbeiter", "content": "Mueller bevorzugt Fruehschicht"},
  {"type": "mitarbeiter", "content": "Mueller hat Rueckenprobleme"}
]}

Leerer Fall:
Input: "Hier ist die Liste der Einsaetze"
Output: {"facts": []}

Gib NUR ein JSON-Objekt mit "facts" Key zurueck.
`;

// Accounting-Agent extrahiert Betraege, Fristen, Zahlungsverhalten
const accountingExtractionPrompt = `
Du extrahierst Fakten aus Buchhaltungs-Konversationen.
Erlaubte Fakt-Typen:
- zahlung (Kunde, Betrag, Verzoegerung)
- rechnung (Status, Faelligkeit)
- muster (Zahlungsverhalten, saisonale Trends)
...
`;
```

**Wann geschrieben:** Nach jedem Expert Agent Aufruf (Hintergrund-Job).

### Ebene 3: Hive Mind Memory

**Scope:** `agentId: 'hive_mind'` + `metadata: { orgId: tenantId }`

**Was gespeichert wird:**
- Cross-Domain Zusammenhaenge: "Klinikum X: spaete Zahlung + geplante Einsaetze = Risiko"
- Hochgestuftes Wissen: "5 Mitarbeiter sagen Klinikum X ist unzuverlaessig"
- Saisonale Muster: "Im Februar kuendigen ueberdurchschnittlich viele"

**API:**

```typescript
// Hochstufen (Admin-Aktion)
await memory.add(
  `Unternehmens-Erkenntnis: Klinikum X zahlt unzuverlaessig (bestaetigt von 5 Mitarbeitern)`,
  {
    agentId: 'hive_mind',
    metadata: {
      orgId: context.tenantId,
      promotedFrom: 'user_memories',
      confidence: 0.92,
    },
  }
);

// Abrufen (bei jeder User-Anfrage an den Hive Mind)
const hiveMindMemories = await memory.search(
  userQuery,
  {
    agentId: 'hive_mind',
    metadata: { orgId: context.tenantId },
    limit: 15,
  }
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
          │   memory.add(conversation, { userId })
          │   → Mem0 extrahiert Fakten automatisch (ADD/UPDATE/DELETE/NOOP)
          │
          └── Agent Memory:
              memory.add(agentConversation, { agentId })
              → Custom Extraction Prompt pro Agent-Domain
```

**Non-blocking:** Memory-Writes passieren im Hintergrund. Die User-Antwort wird nicht verzoegert.

```typescript
// In AgentExecutor, nach jeder abgeschlossenen Interaktion:
process.nextTick(async () => {
  try {
    // User Memory
    await memory.add(conversationText, { userId: context.userId });

    // Agent Memory (fuer jeden aufgerufenen Expert Agent)
    for (const expertCall of expertAgentCalls) {
      await memory.add(
        `Task: ${expertCall.task}\nResult: ${expertCall.result}`,
        { agentId: expertCall.agentName }
      );
    }
  } catch (error) {
    console.error('[Memory] Write failed (non-critical):', error);
  }
});
```

### Explizit: User sagt "Merke dir X"

```
User: "Merke dir: Klinikum X ist unzuverlaessig"

Hive Mind erkennt expliziten Memory-Befehl:
  → memory.add("Klinikum X ist unzuverlaessig", {
      userId: context.userId,
      metadata: { explicit: true }
    })
```

### Memory Flush: Vor Context-Compaction

Wenn der Context zu voll wird (OpenClaw/Claude Pattern):

```typescript
// Bevor der Context komprimiert wird:
const importantFacts = await extractImportantFacts(currentContext);
for (const fact of importantFacts) {
  await memory.add(fact, { agentId: currentExpertAgent });
}
// Dann Context komprimieren
```

---

## Read-Pipeline

### Bei jeder User-Anfrage

```typescript
async function loadMemoryContext(
  userQuery: string,
  context: AgentUserContext,
): Promise<{ userMemory: string; hiveMindMemory: string }> {

  // Parallel: User Memory + Hive Mind Memory
  const [userResults, hiveMindResults] = await Promise.all([
    memory.search(userQuery, {
      userId: context.userId,
      limit: 10,
    }),
    memory.search(userQuery, {
      agentId: 'hive_mind',
      limit: 15,
    }),
  ]);

  return {
    userMemory: userResults.map(m => `- ${m.content}`).join('\n'),
    hiveMindMemory: hiveMindResults.map(m => `- ${m.content}`).join('\n'),
  };
}

// → Wird in den Hive Mind System Prompt injiziert
```

### Bei jedem Expert Agent Aufruf

```typescript
async function loadAgentMemory(
  task: string,
  agentName: string,
): Promise<string> {
  const results = await memory.search(task, {
    agentId: agentName,
    limit: 10,
  });

  return results.map(m => `- ${m.content}`).join('\n');
}

// → Wird in den Expert Agent System Prompt injiziert
```

### Retrieval-Strategie

- **Semantische Vektor-Suche** (PGVector via Mem0) — findet aehnliche Fakten
- **Graph-Queries parallel** (Neo4j via Mem0) — findet verbundene Entitaeten
- **Relevanz-basiert** — nur Top-N Ergebnisse, kein festes Limit fuer alle Memories
- **Skaliert** — ob 50 oder 50.000 Memories, die Suche liefert immer die relevantesten

---

## Promotion Pipeline (Phase 1: Manuell)

### Admin-Dashboard

```
Admin oeffnet Memory-Dashboard:

┌────────────────────────────────────────────────────┐
│  Memory-Insights                                   │
│                                                    │
│  Haeufige User-Memories:                           │
│  ┌──────────────────────────────────────────────┐  │
│  │ "Klinikum X ist unzuverlaessig"              │  │
│  │ 👤 Lisa, Markus, Thomas (3 Mitarbeiter)      │  │
│  │ [Hochstufen] [Ignorieren]                    │  │
│  └──────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────┐  │
│  │ "Bei Kuendigungen im Feb. wird April eng"    │  │
│  │ 👤 Lisa (1 Mitarbeiter) + HR-Agent           │  │
│  │ [Hochstufen] [Ignorieren]                    │  │
│  └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

### Promotion-Flow

```typescript
// Backend: Admin-Endpunkt
async function promoteToHiveMind(
  memoryIds: string[],
  tenantId: string,
) {
  for (const id of memoryIds) {
    const userMemory = await memory.get(id);

    await memory.add(
      `Unternehmens-Erkenntnis: ${userMemory.content}`,
      {
        agentId: 'hive_mind',
        metadata: {
          orgId: tenantId,
          promotedFrom: 'user_memory',
          sourceMemoryId: id,
          promotedAt: new Date().toISOString(),
        },
      }
    );
  }
}
```

### Kandidaten-Erkennung

```typescript
// Cron-Job: Taeglich aehnliche User-Memories gruppieren
async function findPromotionCandidates(tenantId: string) {
  // Alle User-Memories des Tenants laden
  const allUserMemories = await memory.getAll({
    metadata: { orgId: tenantId },
  });

  // Semantisch aehnliche gruppieren (Mem0 search mit hohem Threshold)
  const clusters = clusterBySimilarity(allUserMemories, threshold: 0.85);

  // Cluster mit >= 3 verschiedenen Usern → Kandidat
  return clusters.filter(c => c.uniqueUsers >= 3);
}
```

---

## Temporale Erweiterung

Mem0 hat nur `created_at` und `updated_at`. Wir erweitern mit Custom Metadata:

```typescript
// Beim Speichern eines Fakts:
await memory.add(
  "Klinikum X zahlt spaet",
  {
    agentId: 'accounting-expert',
    metadata: {
      validFrom: '2025-06-01',
      validUntil: null,            // Noch gueltig
      confidence: 0.92,
      sources: ['accounting-expert', 'hr-expert'],
    },
  }
);

// Wenn ein neuer widersprechender Fakt kommt:
// 1. Alten Fakt als abgeloest markieren
await memory.update(oldMemoryId, {
  metadata: {
    validUntil: '2026-01-15',
    supersededBy: newMemoryId,
  },
});

// 2. Neuen Fakt speichern
await memory.add(
  "Klinikum X zahlt seit Januar puenktlich",
  {
    agentId: 'accounting-expert',
    metadata: {
      validFrom: '2026-01-15',
      validUntil: null,
      supersedes: oldMemoryId,
    },
  }
);
```

### Temporale Filterung beim Abruf

```typescript
// Custom Filter: Nur aktuell gueltige Fakten
const results = await memory.search(query, {
  agentId: 'accounting-expert',
  filters: {
    OR: [
      { validUntil: null },                    // Noch gueltig
      { validUntil: { gte: new Date() } },     // In der Zukunft ablaufend
    ],
  },
});
```

---

## Integration in den Hive Mind

### System Prompt Injection

```typescript
// In buildHiveMindPrompt() (Spec 21):
const { userMemory, hiveMindMemory } = await loadMemoryContext(
  userQuery,
  context,
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

Ein zentraler Service der Mem0 kapselt und die drei Ebenen verwaltet:

```typescript
class MemoryService {
  private memory: Memory;

  constructor(config: MemoryConfig) {
    this.memory = new Memory(config);
  }

  // ─── User Memory ───────────────────────────────
  async addUserMemory(conversation: string, userId: string): Promise<void>;
  async searchUserMemory(query: string, userId: string, limit?: number): Promise<MemoryResult[]>;

  // ─── Agent Memory ──────────────────────────────
  async addAgentMemory(conversation: string, agentId: string): Promise<void>;
  async searchAgentMemory(query: string, agentId: string, limit?: number): Promise<MemoryResult[]>;

  // ─── Hive Mind Memory ──────────────────────────
  async addHiveMindMemory(content: string, orgId: string, meta?: object): Promise<void>;
  async searchHiveMindMemory(query: string, orgId: string, limit?: number): Promise<MemoryResult[]>;

  // ─── Promotion ─────────────────────────────────
  async promoteToHiveMind(memoryIds: string[], orgId: string): Promise<void>;
  async findPromotionCandidates(orgId: string): Promise<MemoryCluster[]>;

  // ─── Context Loading ───────────────────────────
  async loadHiveMindContext(query: string, userId: string, orgId: string): Promise<HiveMindContext>;
  async loadAgentContext(query: string, agentId: string): Promise<string>;
}
```

---

## Implementierung

### Phase 1: Basis (Woche 1-2)
- `mem0ai` installieren
- pgvector Extension aktivieren
- MemoryService mit User + Agent Memory
- Non-blocking Write nach Interaktionen
- Search + Injection in System Prompts

### Phase 2: Graph + Custom Prompts (Woche 3)
- Neo4j Graph Memory aktivieren
- Custom Extraction Prompts pro Agent-Domain
- Graph-Ergebnisse in Search-Results integrieren

### Phase 3: Hive Mind Memory + Promotion (Woche 4-5)
- Hive Mind Memory Scope
- Promotion Pipeline (Admin-Dashboard)
- Kandidaten-Erkennung (Clustering)
- Admin-API Endpunkte

### Phase 4: Temporal + Polish (Woche 6)
- Temporale Metadaten (validFrom, validUntil, supersededBy)
- Temporale Filterung beim Abruf
- Memory Flush vor Compaction
- Monitoring und Observability

---

## Dateien

### Neue Dateien:
1. `server/src/services/memory/MemoryService.ts` — Zentraler Memory Service
2. `server/src/services/memory/memory-config.ts` — Mem0 Konfiguration
3. `server/src/services/memory/extraction-prompts.ts` — Custom Prompts pro Agent
4. `server/src/services/memory/promotion.ts` — Promotion Pipeline Logik
5. `server/src/routes/memory.ts` — Admin API (Dashboard, Promotion)

### Modifizierte Dateien:
1. `server/src/services/agents/AgentExecutor.ts` — Memory Write + Read Integration
2. `server/src/services/agents/tools/agent.ts` → Expert Agent Tools — Agent Memory laden
3. `server/src/index.ts` — MemoryService initialisieren
4. `server/.env` — Memory-spezifische Env-Variablen

### Neue Dependencies:
- `mem0ai` — Memory SDK
- pgvector Extension auf PostgreSQL (kein neues npm-Package)

---

## Verifikation

| Test | Erwartung |
|---|---|
| User Memory Write | Nach Interaktion: `memory.search("Tabellen", { userId })` findet "bevorzugt Tabellen" |
| Agent Memory Write | Nach HR-Agent Call: `memory.search("Klinikum X", { agentId: "hr-expert" })` findet Fakten |
| Hive Mind Memory | Nach Promotion: `memory.search("Klinikum", { agentId: "hive_mind" })` findet Unternehmens-Fakt |
| Memory Injection | System Prompt enthaelt relevante Memories |
| Graph Memory | Neo4j zeigt Entitaeten (Klinikum X) mit Beziehungen (zahlt_spaet, hat_einsaetze) |
| Temporal | Alter Fakt mit `validUntil` wird nicht mehr in Search-Results geliefert |
| Non-blocking | Memory Write verzoegert die User-Antwort nicht |
| Promotion | Admin sieht Kandidaten, kann hochstufen, erscheint in Hive Mind Memory |

---

## Offene Punkte (spaetere Specs)

- **Heartbeat liest Memory**: Proaktive Pruefungen basierend auf gelerntem Wissen → Spec 24
- **Multi-Tenant Isolation**: pgvector Collection-Prefix pro Tenant, Neo4j Label-Isolation → Spec 25
- **Embedding-Modell**: Aktuell OpenAI text-embedding-3-small. Spaeter ggf. lokales Modell.
