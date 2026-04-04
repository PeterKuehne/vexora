# Spec: Hive Mind Orchestrator

**Status:** Entwurf
**Abhaengigkeiten:** Keine (erste Implementierung)
**Bezug:** [00-cor7ex-vision.md](./00-cor7ex-vision.md) — Abschnitt "Technische Architektur"

---

## Zusammenfassung

Der bestehende AgentExecutor wird zum **Hive Mind Orchestrator** — einem ToolLoopAgent der Expert Agents als Subagent-Tools aufruft, Ergebnisse zusammenfuehrt, und dem User eine ganzheitliche Antwort liefert.

**Kernprinzip:** Der User spricht mit dem Hive Mind. Expert Agents sind innere Organe — unsichtbar fuer den User.

---

## Ist-Zustand

### Aktueller AgentExecutor

```
User-Anfrage → AgentExecutor → EIN ToolLoopAgent mit ALLEN Tools
                                ├── rag_search
                                ├── graph_query
                                ├── sql_query
                                ├── sama_employees (77 MCP-Tools)
                                ├── load_skill
                                ├── agent (Subagent-Delegation)
                                └── ... (15+ eigene + 77 MCP Tools)
```

**Probleme:**
- 90+ Tools in einem Agent → LLM muss raten welches passt
- Kein Domain-Fokus → generische Antworten
- Subagents existieren, aber sind simpel (ein Prompt, ein Ergebnis)
- System Prompt wird zu gross mit allen Tool-Descriptions

### Bestehende Bausteine die wir wiederverwenden

| Baustein | Datei | Was bleibt |
|---|---|---|
| `ToolLoopAgent` | Vercel AI SDK | Runtime fuer Hive Mind UND Expert Agents |
| `AgentExecutor` | `AgentExecutor.ts` | Wird zum HiveMindExecutor (SSE, Multi-Turn, Persistence) |
| `SubagentLoader` | `SubagentLoader.ts` | Wird zum ExpertAgentLoader (Markdown+Frontmatter) |
| `agent` Tool | `tools/agent.ts` | Pattern fuer Expert Agent Spawning |
| `ToolRegistry` | `ToolRegistry.ts` | Bleibt, aber Tools werden Agent-spezifisch gefiltert |
| `AgentPersistence` | `AgentPersistence.ts` | Bleibt fuer Task/Step/Message Tracking |
| `AgentUserContext` | `types.ts` | Bleibt, wird an Expert Agents durchgereicht |

---

## Soll-Zustand

### Architektur

```
User-Anfrage
    │
    ▼
┌──────────────────────────────────────────────────┐
│  HIVE MIND (ToolLoopAgent)                       │
│                                                  │
│  System Prompt (dynamisch generiert):            │
│  - Tenant-spezifisch (Firmenname, Branche)       │
│  - Expert Agent Verzeichnis (aus Harness-Dateien)│
│  - User Memory (via Mem0 search)                 │
│  - Hive Mind Memory (via Mem0 search)            │
│                                                  │
│  Tools:                                          │
│  ├── hr_expert(task)        → ToolLoopAgent      │
│  ├── accounting_expert(task) → ToolLoopAgent     │
│  ├── knowledge_expert(task)  → ToolLoopAgent     │
│  ├── rag_search             → direktes Tool      │
│  └── send_notification      → direktes Tool      │
│                                                  │
│  Hybrid mit Memory-Shortcuts:                    │
│  - Unbekannte Anfrage: LLM entscheidet           │
│  - Bekannte Muster: Shortcut aus Memory          │
└──────────────────────────────────────────────────┘
    │
    ├── Expert Agents arbeiten parallel/sequentiell
    │   (eigener Context, eigene Tools, eigenes Memory)
    │
    ▼
Ganzheitliche Antwort + strukturierte Panel-Daten
```

### Expert Agent als Tool (Vercel AI SDK Subagent Pattern)

Jeder Expert Agent wird als Tool im Hive Mind registriert:

```typescript
// Pseudocode — basiert auf bestehendem tools/agent.ts Pattern
function createExpertAgentTool(harness: ExpertAgentHarness): AgentTool {
  return {
    name: harness.name,
    description: harness.description,
    inputSchema: z.object({
      task: z.string().describe('Die Aufgabe fuer diesen Expert Agent'),
    }),

    async execute(args, context, options) {
      // 1. Agent Memory laden (via Mem0)
      const agentMemory = await mem0.search(args.task, {
        agent_id: harness.name,
      });

      // 2. System Prompt aus Harness + Memory zusammenbauen
      const instructions = buildExpertPrompt(harness, agentMemory);

      // 3. Tools filtern (nur die des Expert Agents)
      const tools = toolRegistry.getAISDKTools(
        context,
        harness.tools,  // Whitelist aus Harness
      );

      // 4. ToolLoopAgent starten (isolierter Context)
      // Aktuell nur gpt-oss-120b verfuegbar — Hive Mind und alle Expert Agents
      // nutzen dasselbe Modell. Model-Feld im Harness ist fuer spaeter vorbereitet.
      const agent = new ToolLoopAgent({
        model: resolveModel(harness.model || DEFAULT_AGENT_CONFIG.defaultModel),
        instructions,
        tools,
        stopWhen: stepCountIs(harness.maxSteps || 15),
        temperature: 0.1,
      });

      const result = await agent.generate({
        prompt: args.task,
        abortSignal: options?.abortSignal,
      });

      // 5. Antwort + Panel-Daten zurueckgeben
      return {
        output: result.text,
        metadata: {
          panels: extractPanels(result),
          steps: result.steps.length,
        },
      };
    },
  };
}
```

### Dynamischer System Prompt

```typescript
function buildHiveMindPrompt(
  tenant: TenantConfig,
  expertAgents: ExpertAgentHarness[],
  userMemory: MemoryResult[],
  hiveMindMemory: MemoryResult[],
  userName: string,
): string {
  return `
Du bist der Hive Mind von ${tenant.companyName}.
Du bist das zentrale Nervensystem des Unternehmens.

## Deine Rolle
- Verstehe was der User braucht
- Delegiere an die richtigen Expert Agents
- Fuehre Ergebnisse zu einer ganzheitlichen Antwort zusammen
- Erkenne Zusammenhaenge zwischen verschiedenen Domains
- Wenn ein Expert Agent eine Rueckfrage hat, stelle sie dem User

## Verfuegbare Expert Agents
${expertAgents.map(a => `- **${a.name}**: ${a.description}`).join('\n')}

## Regeln
- Rufe mehrere Agents parallel auf wenn die Anfrage mehrere Domains betrifft
- Formuliere EINE zusammenhaengende Antwort, keine Einzelergebnisse
- Erkenne Zusammenhaenge (z.B. offene Rechnungen + geplante Einsaetze = Risiko)
- Fuer einfache Wissensfragen nutze rag_search direkt (kein Expert Agent noetig)
- Antworte immer auf Deutsch

## Ueber den User
Name: ${userName}
${userMemory.length > 0 ? `Bekannte Praeferenzen:\n${userMemory.map(m => `- ${m.text}`).join('\n')}` : ''}

## Gelerntes Unternehmenswissen
${hiveMindMemory.length > 0 ? hiveMindMemory.map(m => `- ${m.text}`).join('\n') : 'Noch keine Erkenntnisse gespeichert.'}
  `.trim();
}
```

### Rueckfragen-Flow

```
Hive Mind → hr_expert(task: "Plane Einsatz bei Klinikum X")

HR-Agent kann nicht alleine entscheiden → gibt zurueck:
  output: "RUECKFRAGE: Welche Schicht soll es sein? (Frueh/Spaet/Nacht)"

Hive Mind erkennt "RUECKFRAGE:" Prefix → stellt die Frage an den User:
  "Fuer den Einsatz bei Klinikum X: Welche Schicht soll es sein?"

User: "Fruehschicht"

Hive Mind → hr_expert(task: "Plane Einsatz bei Klinikum X, Fruehschicht")

HR-Agent: output: "Einsatz geplant: Fruehschicht bei Klinikum X ab 01.04."
```

Der User merkt nicht dass ein Expert Agent gefragt hat. Der Hive Mind uebersetzt.

### Panel-Daten aus Expert Agent Ergebnissen

Expert Agents koennen strukturierte Daten fuer die UI-Panels zurueckliefern:

```typescript
// Expert Agent gibt zurueck:
{
  output: "3 aktive Einsaetze bei Klinikum X, alle stabil.",
  metadata: {
    panels: [
      {
        type: 'table',
        title: 'Einsaetze Klinikum X',
        columns: ['Mitarbeiter', 'Zeitraum', 'Status'],
        rows: [
          ['Mueller', '01.01 - 31.03', 'Aktiv'],
          ['Schmidt', '15.02 - 30.06', 'Aktiv'],
          ['Weber', '01.03 - 31.08', 'Aktiv'],
        ],
      },
    ],
  },
}

// Hive Mind reicht panels durch → Frontend zeigt rechte Seite
```

---

## Implementierung

### Phase 1a: ExpertAgentLoader (ersetzt SubagentLoader)

**Neue Datei:** `server/src/services/agents/ExpertAgentLoader.ts`

Liest Expert Agent Harness-Dateien (Markdown+Frontmatter) und erstellt Tool-Definitionen:

```
Quellen:
  1. Built-in:  server/expert-agents/*.md          (Branchen-Template)
  2. Tenant:    server/expert-agents/{tenantId}/*.md (Kundenspezifisch)
  3. DB:        expert_agents Tabelle                (Dynamisch erstellt)
```

**Harness-Datei Format:**

```markdown
---
name: hr-expert
description: >
  Personalwesen und Einsatzplanung. Mitarbeiter, Qualifikationen,
  Einsaetze, AUeG-Compliance. Verwende diesen Agent wenn es um
  Personal, Schichten, Einsatzplanung oder Arbeitsrecht geht.
tools:
  - sama_employees
  - sama_employee
  - sama_assignments
  - sama_assignment
  - sama_activeAssignments
  - sama_assignmentsNearLimit
  - sama_timeEntries
  - sama_pendingApprovals
  - sama_staffingContracts
  - sama_createAssignment
  - sama_createTimeEntry
  - rag_search
model: gpt-oss-120b   # Aktuell einziges verfuegbares Modell. Feld fuer spaetere Multi-Model-Unterstuetzung.
maxSteps: 15
guardrails:
  - role_check: [ADMIN, DISPATCHER]
  - prompt: "Keine Gehaltsdaten an Nicht-Admins"
  - prompt: "Vor jedem neuen Einsatz Drehtuerklausel pruefen"
---

Du bist der HR-Experte im Hive Mind.

## Deine Expertise
- Personalverwaltung und Einsatzplanung
- Arbeitnehmerueberlassungsgesetz (AUeG)
- Zeiterfassung und Genehmigungsworkflow

## Wichtige Regeln
- Equal Pay Grenze (9 Monate) im Auge behalten
- Hoechstueberlassungsdauer (18 Monate) ueberwachen
- Drehtuerklausel (3 Monate Karenz) pruefen

## Antwortformat
- Liefere immer strukturierte Panel-Daten mit (JSON in metadata.panels)
- Wenn du eine Rueckfrage hast, beginne mit "RUECKFRAGE:"
```

### Phase 1b: HiveMindExecutor (erweitert AgentExecutor)

**Modifizierte Datei:** `server/src/services/agents/AgentExecutor.ts`

Aenderungen:
1. `buildSystemPrompt()` → Dynamisch aus Harness-Dateien + Memory
2. `runTurn()` → Expert Agent Tools werden per-Tenant geladen
3. Bestehende SSE-Events bleiben, neue Events fuer Expert Agent Tracking
4. Multi-Turn bleibt identisch (Hive Mind fuehrt die Konversation)

**Neue SSE Events:**

```typescript
// Zusaetzlich zu bestehenden Events:
'expert:start'     // Expert Agent gestartet { expertName, task }
'expert:complete'   // Expert Agent fertig { expertName, duration, panels }
```

### Phase 1c: Tool-Registrierung anpassen

**Modifizierte Datei:** `server/src/services/agents/tools/index.ts`

```typescript
export function registerBuiltinTools(): void {
  // Basis-Tools (bleiben direkt am Hive Mind)
  toolRegistry.register(ragSearchTool);
  toolRegistry.register(sendNotificationTool);
  toolRegistry.register(listSkillsTool);
  toolRegistry.register(loadSkillTool);

  // Expert Agent Tools (dynamisch aus Harness-Dateien)
  const expertAgents = expertAgentLoader.loadAll(tenantId);
  for (const harness of expertAgents) {
    const expertTool = createExpertAgentTool(harness);
    toolRegistry.register(expertTool);
  }

  // MCP Tools (sama_*) werden NICHT mehr direkt registriert
  // → sie werden den Expert Agents zugewiesen via Harness-Config
}
```

**Wichtig:** Die 77 `sama_*` Tools werden nicht mehr direkt am Hive Mind registriert. Sie sind nur noch ueber Expert Agents erreichbar. Das reduziert die Tool-Liste des Hive Mind drastisch.

### Dateien

#### Neue Dateien:
1. `server/src/services/agents/ExpertAgentLoader.ts` — Laedt Harness-Dateien
2. `server/expert-agents/hr-expert.md` — HR Expert Agent Harness
3. `server/expert-agents/accounting-expert.md` — Buchhaltungs Expert Agent Harness
4. `server/expert-agents/knowledge-expert.md` — Wissens Expert Agent Harness

#### Modifizierte Dateien:
1. `server/src/services/agents/AgentExecutor.ts` — System Prompt dynamisch, Expert Agent Tools
2. `server/src/services/agents/tools/index.ts` — MCP Tools nicht mehr direkt, Expert Agent Tools stattdessen
3. `server/src/services/agents/tools/agent.ts` — Nutzt ExpertAgentLoader statt SubagentLoader
4. `server/src/index.ts` — ExpertAgentLoader initialisieren

#### Unveraendert:
- `ToolRegistry.ts` — Bleibt wie ist
- `AgentPersistence.ts` — Bleibt wie ist
- `types.ts` — Bleibt wie ist (ggf. ExpertAgentHarness Interface ergaenzen)
- `routes/agents.ts` — Bleibt wie ist (SSE Event Handling)

---

## Migration: Schrittweise, kein Big Bang

### Schritt 1: ExpertAgentLoader bauen
- Liest Harness-Dateien (kompatibel mit bestehendem SubagentLoader Format)
- Erstellt Expert Agent Tools
- Parallel zum bestehenden System (nicht ersetzen)

### Schritt 2: Erster Expert Agent (HR)
- `server/expert-agents/hr-expert.md` erstellen
- HR-relevante `sama_*` Tools zuweisen
- Im AgentExecutor als zusaetzliches Tool registrieren
- Bestehende Tools bleiben erstmal auch direkt verfuegbar (Fallback)

### Schritt 3: System Prompt anpassen
- `buildSystemPrompt()` erweitern mit Expert Agent Verzeichnis
- Hive Mind instruieren: "Delegiere an Expert Agents statt Tools direkt zu nutzen"
- Memory-Injection (Mem0) vorbereiten (Platzhalter bis Spec 23)

### Schritt 4: Weitere Expert Agents + MCP Tools entfernen
- Accounting, Knowledge Expert Agents erstellen
- `sama_*` Tools aus direkter Registrierung entfernen
- Nur noch ueber Expert Agents erreichbar

### Schritt 5: SubagentLoader deprecaten
- ExpertAgentLoader ist die neue Quelle
- Alte Subagent-Definitionen migrieren oder loeschen

---

## Verifikation

| Test | Erwartung |
|---|---|
| User fragt "Zeige mir alle Kunden" | Hive Mind delegiert an passenden Expert Agent |
| User fragt "Wie ist die Lage bei Klinikum X?" | Hive Mind ruft HR + Accounting parallel auf |
| Expert Agent braucht Rueckfrage | Hive Mind stellt die Frage an den User |
| User fragt einfache Wissensfrage | Hive Mind nutzt rag_search direkt (kein Expert Agent) |
| Expert Agent liefert Panel-Daten | Frontend zeigt Kacheln rechts |
| Neuer Expert Agent wird hinzugefuegt | Hive Mind Prompt aktualisiert sich automatisch |
| 90+ Tools reduziert | Hive Mind hat nur ~5-8 Tools (Expert Agents + Basis-Tools) |

---

## Tool-Skalierung: Expert Agent Skills (Zukunft)

### Aktueller Ansatz: 10-15 Tools pro Expert Agent

Die Aufteilung in Expert Agents IST Progressive Disclosure auf Architektur-Ebene:
- **Vorher:** 1 Agent mit 90+ Tools → LLM rät, schlechte Ergebnisse
- **Nachher:** Hive Mind mit 5 Expert Agents, jeder mit 10-15 Tools → optimaler Bereich

Recherche-Ergebnisse (Anthropic, OpenAI, Vercel, Benchmarks):
- **5-20 Tools**: Optimaler Bereich, keine Degradation
- **20-25 Tools**: Messbare Accuracy-Verschlechterung beginnt
- **30+ Tools**: Signifikante Probleme (Tool-Verwechslung, Token-Overhead)
- **Claude Opus**: 49% → 74% Accuracy-Verbesserung durch Progressive Disclosure

### Skalierungs-Strategie wenn ein Expert Agent waechst

Wenn ein Expert Agent spaeter mehr als 15-20 Tools benoetigt (neue Enterprise-Anbindungen, weitere MCP-Server, andere Modelle mit kleinerem Context):

**Stufe 1: Tool-Konsolidierung**
Aehnliche Tools zusammenfassen. Z.B. `sama_employees` + `sama_employee` + `sama_searchCustomers` → ein Tool mit Filtern. Reduziert Tool-Anzahl ohne Funktionsverlust.

**Stufe 2: Skills innerhalb von Expert Agents (Progressive Disclosure)**
Der Expert Agent bekommt Skills statt direkter Tools. Skills laden Tools on-demand:

```
HR-Agent Tools (aktuell, 12 Tools):
  ├── sama_employees, sama_employee, sama_assignments, ...

HR-Agent mit Skills (spaeter, wenn >20 Tools):
  ├── Skill: "employee_management"  → laedt: sama_employees, sama_createEmployee, ...
  ├── Skill: "assignment_planning"  → laedt: sama_assignments, sama_createAssignment, ...
  ├── Skill: "timeentry_workflow"   → laedt: sama_timeEntries, sama_approveTimeEntry, ...
  └── rag_search (immer verfuegbar)
```

Nutzt das bestehende Skill-System + `load_skill` Pattern. Kein neues Framework noetig.

**Stufe 3: Vercel AI SDK `prepareStep` / `activeTools`**
Tools werden pro Step phasenweise aktiviert. Z.B. Step 1 hat nur Discovery-Tools, Step 2 hat die konkreten Aktions-Tools.

### Entscheidung

- **Phase 1 (jetzt):** 10-15 Tools pro Expert Agent. Kein Skill-Layer noetig.
- **Spaeter bei Bedarf:** Skills innerhalb von Expert Agents aktivieren (Stufe 2).
- **Trigger:** Wenn ein Agent auf >20 Tools waechst ODER bei Nutzung schwaecher/kleinerer Modelle.

---

## Offene Punkte (geloest in spaeterer Specs)

- **Memory-Injection**: Wie Mem0 integriert wird → Spec 23
- **Heartbeat**: Proaktive Pruefungen → Spec 24
- **Multi-Tenant**: Tenant-Isolation der Harness-Dateien → Spec 25
- **Guardrails**: Pre-Validation Hooks technisch → Spec 22
