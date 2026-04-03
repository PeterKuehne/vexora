# Spec: Expert Agent Harness

**Status:** Entwurf
**Abhaengigkeiten:** [21_HIVE_MIND_ORCHESTRATOR_SPEC.md](./21_HIVE_MIND_ORCHESTRATOR_SPEC.md)
**Bezug:** [00_COR7EX_VISION.md](./00_COR7EX_VISION.md) — Abschnitt "Expert Agents" + "Technische Detailentscheidungen"

---

## Zusammenfassung

Das Expert Agent Harness ist das **konfigurierbare Framework** das jeden Expert Agent definiert. Eine Markdown-Datei mit YAML-Frontmatter beschreibt wer der Agent ist, was er kann, was er darf und was er proaktiv prueft. Der ExpertAgentLoader liest diese Dateien und erstellt daraus ToolLoopAgent-Instanzen.

**Kernprinzip:** Deklarativ definiert (Markdown+YAML), programmatisch ausgefuehrt (ToolLoopAgent). Jeder Kunde kann seine Expert Agents konfigurieren ohne Code zu schreiben.

---

## Harness-Datei Format

### Vollstaendiges Beispiel

```markdown
---
name: hr-expert
description: >
  Personalwesen und Einsatzplanung. Mitarbeiter, Qualifikationen,
  Einsaetze, AUeG-Compliance, Zeiterfassung. Verwende diesen Agent
  wenn es um Personal, Schichten, Einsatzplanung, Arbeitsrecht oder
  Zeiterfassung geht.
tools:
  - sama_employees
  - sama_employee
  - sama_assignments
  - sama_assignment
  - sama_activeAssignments
  - sama_assignmentsNearLimit
  - sama_checkAssignmentOverlap
  - sama_checkRotatingDoorClause
  - sama_timeEntries
  - sama_pendingApprovals
  - sama_staffingContracts
  - sama_createAssignment
  - sama_createTimeEntry
  - rag_search
model: gpt-oss-120b
maxSteps: 15
guardrails:
  roles: [ADMIN, DISPATCHER]
  rules:
    - "Keine Gehaltsdaten an Nicht-Admins"
    - "Vor jedem neuen Einsatz Drehtuerklausel pruefen"
    - "Hoechstueberlassungsdauer (18 Monate) immer pruefen"
---

Du bist der HR-Experte im Hive Mind.

## Deine Expertise
- Personalverwaltung und Einsatzplanung
- Arbeitnehmerueberlassungsgesetz (AUeG) Compliance
- Zeiterfassung und Genehmigungsworkflow
- Mitarbeiter-Qualifikationen und Zertifizierungen

## Wichtige Regeln
- Equal Pay Grenze (9 Monate) im Auge behalten
- Hoechstueberlassungsdauer (18 Monate) ueberwachen
- Drehtuerklausel (3 Monate Karenz) vor jedem neuen Einsatz pruefen
- Zeiterfassungen: DRAFT → SIGNED → SUBMITTED → APPROVED/REJECTED

## Antwortformat
- Liefere strukturierte Panel-Daten wenn moeglich (JSON in metadata.panels)
- Wenn du eine Rueckfrage hast, beginne mit "RUECKFRAGE:"
- Nenne immer konkrete Zahlen und Daten, keine vagen Aussagen
```

### Frontmatter-Felder

| Feld | Pflicht | Typ | Beschreibung |
|---|---|---|---|
| `name` | Ja | string | Eindeutiger Identifier (kebab-case). Wird als Tool-Name im Hive Mind registriert. |
| `description` | Ja | string | Wann soll der Hive Mind diesen Agent aufrufen? Entscheidend fuer die Delegation. |
| `tools` | Ja | string[] | Liste der Tools die dieser Agent nutzen darf. Whitelist — alles andere ist blockiert. |
| `model` | Nein | string | LLM-Modell. Default: `gpt-oss-120b` (aktuell einziges verfuegbares Modell). |
| `maxSteps` | Nein | number | Max. Tool-Call-Schritte. Default: 15. |
| `guardrails` | Nein | object | Zugriffskontrolle und Verhaltensregeln (siehe unten). |

**Body (Markdown):** Der System Prompt des Expert Agents. Definiert Rolle, Expertise, Regeln, Antwortformat.

### Guardrails-Struktur

```yaml
guardrails:
  # Ebene 2: Welche Rollen duerfen diesen Agent ueberhaupt nutzen?
  roles: [ADMIN, DISPATCHER]

  # Ebene 1 + 3: Verhaltensregeln (in System Prompt UND als Pre-Validation)
  rules:
    - "Keine Gehaltsdaten an Nicht-Admins"
    - "Maximal 18 Monate Einsatzdauer pruefen"
```

**Drei Enforcement-Ebenen:**

| Ebene | Was | Wie | Zuverlaessigkeit |
|---|---|---|---|
| 1. Prompt | Rules werden in den System Prompt injiziert | LLM wird instruiert | Weich |
| 2. Tool-Einschraenkung | `tools` Whitelist — Agent hat nur diese Tools | Deterministisch | Hart |
| 3. Pre-Validation | `roles` wird VOR der Delegation geprueft | Code-Check | Hart |

Rollen-Check passiert bevor der Hive Mind den Expert Agent aufruft:
```typescript
// Im Hive Mind, vor Delegation:
if (harness.guardrails?.roles) {
  if (!harness.guardrails.roles.includes(context.userRole)) {
    return "Du hast keine Berechtigung fuer diesen Bereich.";
  }
}
```

---

## ExpertAgentLoader

### Quellen (Prioritaet hoch → niedrig)

| Quelle | Pfad | Zweck |
|---|---|---|
| Tenant-spezifisch | `server/expert-agents/{tenantId}/*.md` | Kundenspezifische Agents |
| Built-in | `server/expert-agents/*.md` | Branchen-Template Agents |
| DB (spaeter) | Tabelle `expert_agents` | Dynamisch erstellte Agents |

Bei Namenskollision gewinnt die hoehere Prioritaet (Tenant ueberschreibt Built-in).

### Interface

```typescript
interface ExpertAgentHarness {
  name: string;
  description: string;
  tools: string[];
  model: string;
  maxSteps: number;
  guardrails?: {
    roles?: string[];
    rules?: string[];
  };
  instructions: string;   // Markdown Body = System Prompt
  filePath: string;        // Woher geladen
}

class ExpertAgentLoader {
  // Alle Harness-Dateien eines Tenants laden
  loadAll(tenantId?: string): ExpertAgentHarness[];

  // Einzelnen Agent laden
  load(name: string, tenantId?: string): ExpertAgentHarness | null;

  // Neuen Agent speichern (vom Hive Mind erstellt, Admin bestaetigt)
  save(harness: ExpertAgentHarness, tenantId: string): void;
}
```

### Parsing

```typescript
// Pseudocode — kompatibel mit bestehendem SubagentLoader Pattern
function parseHarnessFile(filePath: string): ExpertAgentHarness {
  const content = fs.readFileSync(filePath, 'utf-8');
  const { data: frontmatter, content: body } = parseYamlFrontmatter(content);

  return {
    name: frontmatter.name,
    description: frontmatter.description,
    tools: frontmatter.tools || [],
    model: frontmatter.model || DEFAULT_AGENT_CONFIG.defaultModel,
    maxSteps: frontmatter.maxSteps || 15,
    guardrails: frontmatter.guardrails,
    instructions: body.trim(),
    filePath,
  };
}
```

---

## Expert Agent Erstellung durch den Hive Mind

### Flow: Admin beschreibt → Hive Mind erstellt → Admin aktiviert

```
1. Admin: "Ich brauche einen Experten fuer die Buchhaltung"

2. Hive Mind analysiert:
   → Verfuegbare Tools scannen (sama_accountMoves, sama_payments, ...)
   → Passende Guardrails vorschlagen (Rollen, Regeln)
   → System Prompt generieren (Domain-Wissen, Regeln, Format)

3. Hive Mind praesentiert Entwurf:
   "Vorschlag: Buchhaltungs-Expert
    - 14 Tools (Rechnungen, Zahlungen, Mahnwesen, Reports)
    - Rollen: ACCOUNTANT, ADMIN
    - Regeln: Nur gebuchte Rechnungen aendern, Mahnfristen einhalten
    Soll ich ihn aktivieren?"

4. Admin: "Ja, aber fuege Zugriff auf Bilanzreports hinzu"

5. Hive Mind: Passt Harness an → Speichert als Markdown-Datei
   → ExpertAgentLoader laedt neu → Hive Mind Prompt aktualisiert
```

### Technisch: Hive Mind nutzt ein internes Tool

```typescript
const createExpertAgentTool: AgentTool = {
  name: 'create_expert_agent',
  description: 'Erstelle einen neuen Expert Agent. Nur fuer Admins.',
  requiredRoles: ['ADMIN'],
  inputSchema: z.object({
    name: z.string(),
    description: z.string(),
    tools: z.array(z.string()),
    guardrails: z.object({
      roles: z.array(z.string()).optional(),
      rules: z.array(z.string()).optional(),
    }).optional(),
    instructions: z.string(),
  }),

  async execute(args, context) {
    // Harness-Datei schreiben
    const harness = buildHarnessMarkdown(args);
    expertAgentLoader.save(harness, context.tenantId);
    return { output: `Expert Agent "${args.name}" erstellt und aktiviert.` };
  },
};
```

---

## Starter Expert Agents (Branchen-Template: Personaldienstleister)

### hr-expert.md

```markdown
---
name: hr-expert
description: >
  Personalwesen und Einsatzplanung. Mitarbeiter, Qualifikationen,
  Einsaetze, AUeG-Compliance, Zeiterfassung.
tools:
  - sama_employees
  - sama_employee
  - sama_assignments
  - sama_assignment
  - sama_activeAssignments
  - sama_assignmentsNearLimit
  - sama_checkAssignmentOverlap
  - sama_checkRotatingDoorClause
  - sama_timeEntries
  - sama_pendingApprovals
  - sama_staffingContracts
  - sama_createAssignment
  - sama_createTimeEntry
  - rag_search
model: gpt-oss-120b
maxSteps: 15
guardrails:
  roles: [ADMIN, DISPATCHER]
---

Du bist der HR-Experte. Dein Wissen umfasst Personalverwaltung,
Einsatzplanung und AUeG-Compliance.

[... vollstaendiger System Prompt ...]
```

### accounting-expert.md

```markdown
---
name: accounting-expert
description: >
  Buchhaltung, Rechnungen, Zahlungen, Mahnwesen, Reports und
  Finanzauswertungen. Verwende diesen Agent fuer alles was mit
  Geld, Rechnungen, Zahlungen oder Finanzen zu tun hat.
tools:
  - sama_accountMoves
  - sama_accountMove
  - sama_accounts
  - sama_payments
  - sama_payment
  - sama_billingRates
  - sama_agedReceivable
  - sama_profitAndLoss
  - sama_revenueReport
  - sama_createAccountMove
  - sama_postAccountMove
  - sama_generateInvoice
  - sama_createPayment
  - sama_confirmPayment
  - rag_search
model: gpt-oss-120b
maxSteps: 15
guardrails:
  roles: [ADMIN, ACCOUNTANT]
---

Du bist der Buchhaltungs-Experte. Dein Wissen umfasst Rechnungswesen,
Zahlungsverkehr, Mahnwesen und Finanzreporting.

[... vollstaendiger System Prompt ...]
```

### knowledge-expert.md

```markdown
---
name: knowledge-expert
description: >
  Firmenwissen und Dokumente. Recherche in der Wissensdatenbank,
  Vertragsanalyse, Fachfragen zu Arbeitsrecht, AUeG, Compliance.
  Verwende diesen Agent fuer Wissensfragen und Dokumentenrecherche.
tools:
  - rag_search
  - read_chunk
  - graph_query
model: gpt-oss-120b
maxSteps: 10
guardrails:
  roles: [ADMIN, DISPATCHER, ACCOUNTANT, EMPLOYEE]
---

Du bist der Wissens-Experte. Du durchsuchst die Wissensdatenbank
und beantwortest Fachfragen basierend auf Unternehmensdokumenten.

[... vollstaendiger System Prompt ...]
```

---

## Kompatibilitaet mit bestehendem System

### Migration von SubagentLoader

| Bestehendes Feature | Expert Agent Equivalent |
|---|---|
| `server/agents/*.md` | `server/expert-agents/*.md` (neuer Pfad) |
| `SubagentLoader.loadAll()` | `ExpertAgentLoader.loadAll()` |
| `agent` Tool | Expert Agent Tools (pro Agent ein Tool) |
| Frontmatter: `tools: rag_search, read_chunk` | Frontmatter: `tools: [rag_search, read_chunk]` (Array statt CSV) |
| Frontmatter: `maxSteps: 8` | Frontmatter: `maxSteps: 8` (identisch) |
| Kein Guardrails | `guardrails:` Block (neu) |
| Kein Memory | `memory:` Scope (spaeter, Spec 23) |
| Kein Heartbeat | `heartbeat:` Cron (spaeter, Spec 24) |

### Was bleibt

- Bestehende Subagents (`kb-explorer`, etc.) funktionieren weiter
- SubagentLoader wird nicht sofort entfernt
- Expert Agents und Subagents koexistieren waehrend der Migration
- Expert Agents ersetzen Subagents schrittweise

---

## Dateien

### Neue Dateien:
1. `server/src/services/agents/ExpertAgentLoader.ts` — Laedt + parst Harness-Dateien
2. `server/expert-agents/hr-expert.md` — HR Expert Agent
3. `server/expert-agents/accounting-expert.md` — Buchhaltungs Expert Agent
4. `server/expert-agents/knowledge-expert.md` — Wissens Expert Agent
5. `server/src/services/agents/tools/create-expert-agent.ts` — Tool fuer Admin Agent-Erstellung

### Modifizierte Dateien:
1. `server/src/services/agents/AgentExecutor.ts` — Expert Agent Tools laden + registrieren
2. `server/src/services/agents/tools/index.ts` — Expert Agent Tools statt direkter MCP-Tools
3. `server/src/services/agents/types.ts` — ExpertAgentHarness Interface

---

## Verifikation

| Test | Erwartung |
|---|---|
| Harness-Datei wird korrekt geparst | Frontmatter + Body getrennt, alle Felder gelesen |
| Expert Agent wird als Tool registriert | `toolRegistry.getTool('hr-expert')` existiert |
| Guardrails: Rolle blockiert | EMPLOYEE kann hr-expert nicht aufrufen → Fehlermeldung |
| Guardrails: Tool-Whitelist | hr-expert kann `sama_payments` nicht aufrufen |
| Guardrails: Rules im Prompt | Expert Agent System Prompt enthaelt die Regeln |
| Admin erstellt neuen Agent | Harness-Datei wird geschrieben, Hive Mind Prompt aktualisiert |
| Tenant-Override | Tenant-spezifische Datei ueberschreibt Built-in |

---

## Offene Punkte (spaetere Specs)

- **Memory-Feld** im Harness: Wie Agent Memory geladen/gespeichert wird → Spec 23
- **Heartbeat-Feld** im Harness: Proaktive Pruefungen pro Agent → Spec 24
- **Skills-Feld** im Harness: Vorgeladene Skills pro Agent → Spec 21 (Tool-Skalierung Stufe 2)
- **Multi-Tenant Isolation**: Pfad-basiert vs DB-basiert → Spec 25
