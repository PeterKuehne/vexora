# Spec: Multi-Tenant

**Status:** Entwurf
**Abhaengigkeiten:** [21](./02-hive-mind-orchestrator.md), [22](./03-expert-agent-harness.md), [23](./04-memory-system.md), [24](./05-heartbeat-engine.md)
**Bezug:** [00-cor7ex-vision.md](./00-cor7ex-vision.md) — Abschnitt "Multi-Tenant"

---

## Zusammenfassung

Cor7ex ist ein Framework das **mehrere Unternehmen** auf der gleichen Infrastruktur bedient. Jedes Unternehmen (Tenant) hat seine eigenen Expert Agents, Memory, Heartbeats, Skills, Enterprise-Anbindungen und einen eigenen Hive Mind der ueber Zeit waechst.

**Kernprinzip:** Vollstaendige Datenisolation zwischen Tenants. Kein Unternehmen sieht Daten eines anderen — weder im Memory, noch in Heartbeats, noch in der Wissensdatenbank.

---

## Tenant-Modell

### Was ist ein Tenant?

Ein Tenant = ein Unternehmen. Z.B. "Samaritano GmbH" oder "Autohaus Mueller".

```typescript
interface Tenant {
  id: string;                    // UUID
  slug: string;                  // z.B. "samaritano", "autohaus-mueller"
  name: string;                  // Anzeigename
  plan: 'starter' | 'pro' | 'enterprise';
  branchTemplate?: string;       // z.B. "personaldienstleister", "autohaus"
  createdAt: Date;
  settings: {
    companyName: string;
    defaultModel: string;        // LLM-Modell (aktuell: gpt-oss-120b)
    defaultLanguage: string;     // z.B. "de"
    maxUsers: number;
    maxExpertAgents: number;
    maxHeartbeats: number;
  };
}
```

### Tenant-User Zuordnung

```typescript
interface TenantUser {
  userId: string;
  tenantId: string;
  role: string;                  // ADMIN, DISPATCHER, ACCOUNTANT, EMPLOYEE, ...
  isAdmin: boolean;              // Kann Tenant-Einstellungen aendern
  createdAt: Date;
}
```

Ein User gehoert zu **genau einem Tenant** (Phase 1). Multi-Tenant-User (ein Berater der fuer mehrere Firmen arbeitet) als spaeteres Feature.

---

## Isolations-Strategie pro Subsystem

### Uebersicht

| Subsystem | Isolation | Mechanismus |
|---|---|---|
| **Expert Agents** | Datei-basiert | `server/expert-agents/{tenantId}/*.md` |
| **Memory (Hindsight)** | Bank-Prefix + DB-Schema | `user-{tenantId}-{userId}`, `hive-{tenantId}` |
| **Heartbeats** | Spalten-basiert | `tenant_id` Spalte + WHERE-Filter |
| **Wissensdatenbank** | Collection-basiert | Weaviate: `Tenant_{tenantId}_Chunks` |
| **Knowledge Graph** | Label-basiert | Neo4j: `(:Entity {tenantId: "..."})` |
| **Enterprise (MCP)** | Config-basiert | Separate MCP-Credentials pro Tenant |
| **Skills** | Pfad-basiert | `server/skills/{tenantId}/*.md` |
| **Conversations** | Spalten-basiert | `tenant_id` Spalte in agent_tasks |

### 1. Expert Agents

```
server/expert-agents/
├── _defaults/              ← Built-in (Branchen-Templates)
│   ├── hr-expert.md
│   ├── accounting-expert.md
│   └── knowledge-expert.md
├── samaritano/             ← Tenant: Samaritano
│   ├── hr-expert.md        ← Override (ueberschreibt Default)
│   └── compliance-expert.md ← Zusaetzlicher Agent
└── autohaus-mueller/       ← Tenant: Autohaus Mueller
    ├── sales-expert.md
    └── workshop-expert.md
```

**ExpertAgentLoader** Lade-Reihenfolge (Prioritaet hoch → niedrig):
1. `server/expert-agents/{tenantId}/*.md` — Tenant-spezifisch
2. `server/expert-agents/_defaults/*.md` — Built-in Defaults
3. DB: `expert_agents` Tabelle mit `tenant_id` Filter

Bei Namenskollision gewinnt die hoehere Prioritaet.

### 2. Memory (Hindsight)

Isolation ueber **Bank-Naming-Convention**:

```
Memory Banks pro Tenant:
├── user-{tenantId}-{userId}        → User Memory
│   z.B. "user-samaritano-lisa-123"
├── agent-{tenantId}-{agentName}    → Agent Memory
│   z.B. "agent-samaritano-hr-expert"
└── hive-{tenantId}                 → Hive Mind Memory
    z.B. "hive-samaritano"
```

**Zusaetzlich:** Hindsight unterstuetzt PostgreSQL Schema-basierte Isolation (TenantExtension). Pro Tenant ein eigenes Schema — haertere Isolation als Bank-Prefix. Konfigurierbar:

```
Phase 1: Bank-Prefix (einfach, ausreichend fuer wenige Tenants)
Phase 2: Schema-Isolation (wenn mehr Tenants oder Compliance-Anforderungen)
```

### 3. Heartbeats

Spalten-basiert — `tenant_id` in jeder Tabelle:

```sql
-- Alle Heartbeat-Queries filtern nach tenant_id
SELECT * FROM heartbeat_definitions WHERE tenant_id = $1;
SELECT * FROM heartbeat_results WHERE tenant_id = $1;
```

Die HeartbeatEngine laeuft pro Tenant separat:

```typescript
// Pro Tenant eigene Cron-Jobs
for (const tenant of tenants) {
  await heartbeatEngine.initialize(tenant.id);
}
```

### 4. Wissensdatenbank (Weaviate)

Collection pro Tenant:

```
Weaviate Collections:
├── Tenant_samaritano_Chunks      → Samaritano Dokumente
├── Tenant_autohaus_mueller_Chunks → Autohaus Mueller Dokumente
└── ...
```

**Bestehender Mechanismus:** Der `VectorServiceV2` bekommt den `tenantId` aus dem `AgentUserContext` und filtert die Collection entsprechend.

### 5. Knowledge Graph (Neo4j)

Label-basiert — jeder Node hat ein `tenantId` Property:

```cypher
-- Tenant-gefilterte Queries
MATCH (e:Entity {tenantId: $tenantId})-[r]->(e2:Entity {tenantId: $tenantId})
WHERE e.name CONTAINS $searchTerm
RETURN e, r, e2
```

**Bestehender Mechanismus:** Der `GraphService` filtert bereits nach `tenantId`.

### 6. Enterprise-Anbindungen (MCP)

Separate MCP-Konfiguration pro Tenant:

```typescript
interface TenantMcpConfig {
  tenantId: string;
  servers: {
    name: string;                    // z.B. "samaworkforce"
    url: string;                     // MCP Server URL
    clientId: string;                // OAuth Client ID
    clientSecret: string;            // OAuth Client Secret
    scopes: string[];                // Erlaubte Scopes
  }[];
}
```

Jeder Tenant hat seine eigenen OAuth-Credentials fuer seine Enterprise-Systeme. Der `McpClientManager` wird pro Tenant instanziiert.

### 7. Skills

Pfad-basiert — wie Expert Agents:

```
server/skills/
├── _defaults/              ← Built-in Skills
│   ├── auev-generator/
│   └── monatsbericht/
├── samaritano/             ← Tenant: Samaritano
│   ├── auev-generator/     ← Override
│   └── custom-report/      ← Zusaetzlicher Skill
└── autohaus-mueller/
    └── angebot-erstellen/
```

### 8. Conversations (Agent Tasks)

Spalten-basiert — bestehende `tenant_id` Spalte in `agent_tasks`:

```sql
-- RLS Policy (bereits vorhanden)
CREATE POLICY agent_tasks_tenant ON agent_tasks
  USING (tenant_id = current_setting('app.tenant_id', true));
```

---

## Branchen-Templates

### Template-Struktur

```typescript
interface BranchTemplate {
  slug: string;                      // z.B. "personaldienstleister"
  name: string;                      // z.B. "Personaldienstleister"
  description: string;

  expertAgents: string[];            // Harness-Dateien die kopiert werden
  skills: string[];                  // Skill-Verzeichnisse die kopiert werden
  heartbeats: HeartbeatDefinition[]; // Standard-Heartbeats
  roles: string[];                   // Verfuegbare Rollen
  mcpServers?: {                     // Optionale MCP-Server Vorlagen
    name: string;
    description: string;
  }[];
}
```

### Verfuegbare Templates (Phase 1)

```
server/templates/
├── personaldienstleister/
│   ├── template.json              ← Template-Definition
│   ├── expert-agents/
│   │   ├── hr-expert.md
│   │   ├── accounting-expert.md
│   │   ├── knowledge-expert.md
│   │   └── compliance-expert.md
│   ├── skills/
│   │   ├── auev-generator/
│   │   └── monatsbericht/
│   └── heartbeats/
│       ├── aueg-fristen.json
│       ├── offene-rechnungen.json
│       └── unbesetzte-schichten.json
│
└── allgemein/                     ← Fallback Template
    ├── template.json
    ├── expert-agents/
    │   └── knowledge-expert.md
    └── skills/
        └── (leer)
```

### Tenant-Erstellung (Onboarding)

```typescript
async function createTenant(
  name: string,
  slug: string,
  templateSlug: string,
  adminUser: { email: string; name: string },
): Promise<Tenant> {

  // 1. Tenant in DB erstellen
  const tenant = await db.tenants.create({
    slug, name,
    plan: 'starter',
    branchTemplate: templateSlug,
    settings: { defaultModel: 'gpt-oss-120b', defaultLanguage: 'de', ... },
  });

  // 2. Template laden
  const template = loadTemplate(templateSlug);

  // 3. Expert Agents kopieren
  for (const agentFile of template.expertAgents) {
    copyFile(
      `server/templates/${templateSlug}/expert-agents/${agentFile}`,
      `server/expert-agents/${tenant.id}/${agentFile}`,
    );
  }

  // 4. Skills kopieren
  for (const skillDir of template.skills) {
    copyDir(
      `server/templates/${templateSlug}/skills/${skillDir}`,
      `server/skills/${tenant.id}/${skillDir}`,
    );
  }

  // 5. Heartbeat-Definitionen erstellen
  for (const hb of template.heartbeats) {
    await db.heartbeatDefinitions.create({ ...hb, tenantId: tenant.id });
  }

  // 6. Hindsight Memory Banks erstellen
  await memoryService.createHiveMindBank(tenant.id);

  // 7. Admin-User erstellen
  await db.tenantUsers.create({
    userId: adminUser.id,
    tenantId: tenant.id,
    role: 'ADMIN',
    isAdmin: true,
  });

  // 8. Weaviate Collection erstellen
  await vectorService.createTenantCollection(tenant.id);

  return tenant;
}
```

---

## Kontext-Propagation

### Wie fliesst der Tenant durch das System?

```
User Login
  → JWT Token enthaelt: { userId, tenantId, role }
  │
  ▼
Express Middleware
  → Extrahiert tenantId aus Token
  → Setzt PostgreSQL app.tenant_id (RLS)
  │
  ▼
AgentUserContext
  → { userId, tenantId, userRole }
  │
  ├── Hive Mind
  │   → Laedt Expert Agents fuer diesen Tenant
  │   → Laedt Memory aus tenant-spezifischen Banks
  │   → System Prompt mit Tenant-Name
  │
  ├── Expert Agents
  │   → Tools gefiltert nach Tenant MCP-Config
  │   → Agent Memory Bank: agent-{tenantId}-{agentName}
  │
  ├── Heartbeat
  │   → Nur Definitionen dieses Tenants
  │   → Ergebnisse nur fuer Tenant-User
  │
  ├── RAG Search
  │   → Weaviate Collection: Tenant_{tenantId}_Chunks
  │   → Neo4j: tenantId Filter
  │
  └── Skills
      → Lade-Reihenfolge: Tenant → Defaults
```

### AgentUserContext (erweitert)

```typescript
interface AgentUserContext {
  userId: string;
  userRole: string;
  tenantId: string;                      // Immer gesetzt
  department?: string;
  allowedDocumentIds?: string[];
  taskId?: string;
  tenantSettings?: {                     // Tenant-spezifische Config
    companyName: string;
    defaultModel: string;
    defaultLanguage: string;
  };
}
```

---

## Template-Ecosystem (Zukunft)

### Phase 1: Eigene Templates
Wir erstellen Templates fuer die ersten Kunden (Samaritano = erster Kunde).

### Phase 2: Partner-Templates
Branchenexperten/Berater erstellen Templates. Marketplace-Konzept:

```
Cor7ex Template Marketplace:
├── Personaldienstleister (by Cor7ex)        ★★★★★
├── Pflegeheim (by Cor7ex)                   ★★★★☆
├── Autohaus (by Partner: AutoConsult GmbH)  ★★★★☆
├── Steuerbuero (by Partner: TaxTech)        ★★★☆☆
└── ...
```

### Phase 3: Community-Templates
Kunden teilen ihre besten Configs als Templates:

```
Tenant "Samaritano" exportiert:
  → Expert Agents (anonymisiert)
  → Skills (anonymisiert)
  → Heartbeat-Definitionen
  → Guardrail-Regeln
  = "Personaldienstleister Pro" Template

Andere Personaldienstleister koennen es installieren.
```

---

## Datenbank-Schema

### Migration

```sql
-- Tenants
CREATE TABLE tenants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  plan            TEXT NOT NULL DEFAULT 'starter',
  branch_template TEXT,
  settings        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Tenant-User Zuordnung
CREATE TABLE tenant_users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT NOT NULL,
  tenant_id  UUID REFERENCES tenants(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'EMPLOYEE',
  is_admin   BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tenant_id)
);

CREATE INDEX idx_tenant_users_tenant ON tenant_users(tenant_id);
CREATE INDEX idx_tenant_users_user ON tenant_users(user_id);

-- MCP Server Configs pro Tenant
CREATE TABLE tenant_mcp_servers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  url           TEXT NOT NULL,
  client_id     TEXT NOT NULL,
  client_secret TEXT NOT NULL,             -- Verschluesselt speichern!
  scopes        TEXT[] DEFAULT '{}',
  enabled       BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name)
);
```

### RLS auf bestehenden Tabellen

```sql
-- agent_tasks: tenant_id Spalte existiert bereits
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_tasks ON agent_tasks
  USING (tenant_id = current_setting('app.tenant_id', true));

-- heartbeat_definitions: tenant_id existiert (Spec 24)
ALTER TABLE heartbeat_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_heartbeats ON heartbeat_definitions
  USING (tenant_id = current_setting('app.tenant_id', true));

-- heartbeat_results: tenant_id existiert (Spec 24)
ALTER TABLE heartbeat_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_heartbeat_results ON heartbeat_results
  USING (tenant_id = current_setting('app.tenant_id', true));
```

---

## Implementierung

### Phase 1: Basis-Isolation (Woche 1-2)
- DB-Migration: `tenants` + `tenant_users` + `tenant_mcp_servers`
- Middleware: tenantId aus JWT extrahieren, in AgentUserContext propagieren
- ExpertAgentLoader: Tenant-Pfad Unterstuetzung
- SkillLoader: Tenant-Pfad Unterstuetzung
- Memory Banks: Tenant-Prefix in Bank-Namen

### Phase 2: MCP pro Tenant (Woche 3)
- McpClientManager pro Tenant instanziieren
- Tenant MCP-Configs aus DB laden
- OAuth-Credentials verschluesselt speichern

### Phase 3: Onboarding-Flow (Woche 4)
- Branchen-Template Loader
- `createTenant()` Funktion (kopiert Template, erstellt Banks, etc.)
- Admin-UI: Tenant erstellen + konfigurieren

### Phase 4: Template-Export (Woche 5-6)
- Tenant-Config anonymisiert exportieren
- Template-Import Funktion
- Marketplace-Grundstruktur (spaeter)

---

## Dateien

### Neue Dateien:
1. `server/src/services/tenant/TenantService.ts` — Tenant CRUD + Onboarding
2. `server/src/services/tenant/TemplateLoader.ts` — Branchen-Templates laden + anwenden
3. `server/src/routes/tenants.ts` — Admin API
4. `server/src/middleware/tenant.ts` — Tenant-Context Middleware
5. `server/src/migrations/0XX_multi_tenant.sql` — DB-Schema
6. `server/templates/personaldienstleister/` — Erstes Branchen-Template
7. `server/templates/allgemein/` — Fallback Template

### Modifizierte Dateien:
1. `server/src/services/agents/AgentExecutor.ts` — tenantId in allen Aufrufen
2. `server/src/services/agents/ExpertAgentLoader.ts` — Tenant-Pfad laden
3. `server/src/services/skills/SkillLoader.ts` — Tenant-Pfad laden
4. `server/src/services/mcp/McpClientManager.ts` — Pro Tenant instanziieren
5. `server/src/services/memory/MemoryService.ts` — Tenant-Prefix in Banks
6. `server/src/services/heartbeat/HeartbeatEngine.ts` — Pro Tenant initialisieren
7. `server/src/middleware/auth.ts` — tenantId aus JWT extrahieren

---

## Verifikation

| Test | Erwartung |
|---|---|
| Tenant erstellen | DB-Eintrag, Expert Agents kopiert, Memory Banks erstellt |
| Tenant-Isolation | Tenant A sieht keine Daten von Tenant B |
| Expert Agent Override | Tenant-spezifischer Agent ueberschreibt Default |
| Memory Isolation | `recall("user-tenantA-lisa")` findet keine Daten von Tenant B |
| Heartbeat Isolation | Heartbeat von Tenant A laeuft nicht fuer Tenant B User |
| MCP pro Tenant | Tenant A hat SamaWorkforce, Tenant B hat anderes System |
| RLS | SQL-Query ohne tenant_id gibt nur eigene Daten zurueck |
| Template Onboarding | Neuer Tenant mit Personaldienstleister-Template hat 4 Expert Agents + 3 Heartbeats |
| Skill Isolation | Tenant A Skill ist nicht fuer Tenant B sichtbar |

---

## Offene Punkte (spaetere Features)

- **Multi-Tenant User**: Ein Berater arbeitet fuer mehrere Firmen → Tenant-Switcher
- **Template Marketplace**: Community-Templates kaufen/teilen
- **Tenant Billing**: Nutzungsbasierte Abrechnung pro Tenant
- **Tenant Admin-UI**: Self-Service Verwaltung (Agents, Heartbeats, MCP-Server, User)
- **Tenant-uebergreifendes Wissen**: Anonymisierte Insights zwischen Tenants teilen (opt-in)
