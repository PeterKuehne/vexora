# Migration Spec: Custom AgentExecutor → Vercel AI SDK 6

## 1. Ziel

Migration des bestehenden Agent-Systems (custom AgentExecutor mit ReAct-Loop) auf das Vercel AI SDK 6 (`ai` Package). Dadurch:
- Native Subagenten-Unterstützung via `ToolLoopAgent`
- Standardisiertes Tool-Calling über alle Provider
- Frontend-Vereinfachung mit `useChat` / `createAgentUIStreamResponse`
- Weniger eigener Code (~800 LOC → ~200 LOC)
- MCP-Kompatibilität für zukünftige Integrationen

## 2. Bestandsaufnahme (Ist-Zustand)

### 2.1 Backend-Dateien die sich ändern

| Datei | LOC | Änderung | Impact |
|-------|-----|----------|--------|
| `server/src/services/agents/AgentExecutor.ts` | 446 | **Komplett ersetzen** durch AI SDK Agent | HOCH |
| `server/src/services/agents/ToolRegistry.ts` | 99 | **Refactoren** — Tool-Format auf AI SDK anpassen | MITTEL |
| `server/src/services/agents/types.ts` | 179 | **Refactoren** — Vercel-kompatible Types | MITTEL |
| `server/src/services/agents/tools/*.ts` (11 Tools) | ~800 | **Format anpassen** — execute-Signatur ändern | MITTEL |
| `server/src/services/agents/index.ts` | 29 | **Anpassen** — neue Exports | NIEDRIG |
| `server/src/routes/agents.ts` | 263 | **Refactoren** — Streaming auf AI SDK umstellen | HOCH |
| `server/src/services/llm/LLMRouter.ts` | ~200 | **Evaluieren** — PII Guard + Usage Logging behalten, LLM-Routing an SDK delegieren | MITTEL |
| `server/src/services/llm/LLMProvider.ts` | ~80 | **Refactoren** — Interface wird durch AI SDK Types ersetzt | MITTEL |
| `server/src/services/llm/OllamaProvider.ts` | ~150 | **Entfernen** — AI SDK Ollama Provider nutzen | HOCH |
| `server/src/services/llm/AnthropicProvider.ts` | ~150 | **Entfernen** — AI SDK Anthropic Provider nutzen | HOCH |
| `server/src/services/llm/PIIGuard.ts` | ~100 | **Behalten + Anpassen** — als `wrapLanguageModel` Middleware integrieren | MITTEL |
| `server/src/routes/chat.ts` | ~300 | **Anpassen** — nutzt `llmRouter.chat()` / `chatStream()` unabhängig von Agents. Muss auf AI SDK umgestellt werden wenn LLMRouter entfällt | HOCH |
| `server/src/index.ts` | 3 Zeilen | **Minimal** — Initialisierung anpassen | NIEDRIG |

### 2.2 Frontend-Dateien die sich ändern

| Datei | LOC | Änderung | Impact |
|-------|-----|----------|--------|
| `src/contexts/AgentContext.tsx` | 396 | **Refactoren** — SSE-Parsing auf AI SDK Stream-Format. Fetch-URLs: `/api/agents/run` (POST), `/api/agents/tasks` (GET), `/api/agents/tasks/:id` (GET), `/api/agents/tasks/:id/cancel` (POST) | HOCH |
| `src/components/AgentTaskDetail.tsx` | ~420 | **Prüfen** — Importiert `useAgent`, `AgentStep`, `AgentTaskStatus`. Step-Visualisierung muss zum neuen Event-Format passen | MITTEL |
| `src/components/AgentTaskSidebar.tsx` | 128 | **Prüfen** — Importiert `useAgent`, `AgentTaskStatus`. Liest aus AgentContext | NIEDRIG |
| `src/App.tsx` | 2 Zeilen | **Unverändert** — Importiert `AgentProvider`, `useAgent` aus contexts | NIEDRIG |

### 2.3 Dateien die NICHT geändert werden

| Datei | Grund |
|-------|-------|
| `server/src/services/agents/AgentPersistence.ts` | DB-Layer ist SDK-unabhängig |
| `server/src/migrations/010_agent_system.sql` | Schema bleibt identisch |
| `server/src/migrations/011_skills.sql` | Unverändert |
| `server/src/services/skills/SkillRegistry.ts` | Keine direkte Agent-Abhängigkeit |
| `server/src/services/skills/SwarmPromotion.ts` | Reine DB-Logik |
| `server/src/routes/skills.ts` | Keine Agent-Abhängigkeit |
| `server/src/services/DatabaseService.ts` | Infrastruktur |
| Alle Tool-Execute-Bodies | Interne Logik bleibt, nur die Signatur ändert sich |

### 2.4 Dateien die VALIDIERT werden müssen

| Datei | Grund |
|-------|-------|
| `server/src/services/skills/SkillValidator.ts` | Importiert `toolRegistry` aus `../agents/ToolRegistry.js`. Falls ToolRegistry API sich ändert (z.B. `getToolNames()`), muss SkillValidator angepasst werden |
| `server/src/services/agents/tools/send-notification.ts` | Dynamischer Import: `const { io } = await import('../../../index.js')` — Runtime-Abhängigkeit auf Socket.io Instanz |
| `server/src/middleware/auth.ts` | Setzt `req.user` mit `user_id`, `role`, `department`. Agent-Route mappt auf `AgentUserContext` (`userId`, `userRole`). Mapping muss erhalten bleiben |

### 2.4 Kritische Abhängigkeiten

```
AgentExecutor
  ├── llmRouter.chatWithTools()        → Wird durch AI SDK model.doGenerate() ersetzt
  ├── toolRegistry.getAvailableTools() → Bleibt, Format-Konverter anpassen
  ├── toolRegistry.getTool()           → Bleibt
  ├── agentPersistence.createTask()    → Bleibt (wird im Route-Handler aufgerufen)
  ├── agentPersistence.createStep()    → Bleibt (wird in onStepFinish Callback aufgerufen)
  ├── EventEmitter ('sse')             → Wird durch AI SDK Stream ersetzt
  └── AbortController                  → AI SDK hat eigenen abortSignal Support
```

## 3. Neue Packages

```bash
# AI SDK Core + Provider
npm install ai @ai-sdk/anthropic

# Ollama Provider (Community)
npm install ollama-ai-provider-v2

# Zod für Tool-Parameter-Schemas (AI SDK Anforderung)
npm install zod
```

**Entfernte Packages** (nach Migration):
```bash
# @anthropic-ai/sdk wird NICHT entfernt — wird weiter für PII Guard Usage Logging gebraucht
# Aber die direkte Chat-Nutzung geht über @ai-sdk/anthropic
```

## 4. Migrations-Schritte

### Schritt 1: AI SDK Setup + Provider-Konfiguration
**Neue Datei:** `server/src/services/agents/ai-provider.ts`

```typescript
import { anthropic } from '@ai-sdk/anthropic';
import { createOllama } from 'ollama-ai-provider-v2';

// Ollama Provider (lokal)
export const ollama = createOllama({
  baseURL: process.env.OLLAMA_API_URL || 'http://localhost:11434/api',
});

// Model-Resolver: "anthropic:claude-sonnet-4-6" → AI SDK Model
export function resolveModel(modelString: string) {
  const [provider, ...rest] = modelString.split(':');
  const modelName = rest.join(':');

  switch (provider) {
    case 'anthropic':
      return anthropic(modelName);
    case 'ollama':
    default:
      return ollama(modelName || process.env.OLLAMA_DEFAULT_MODEL || 'qwen3:8b');
  }
}
```

**Warum separat:** Hält die Provider-Konfiguration isoliert. PII Guard und Usage Logging werden separat behandelt (siehe Schritt 5).

### Schritt 2: Tool-Format Migration

**Aktuelles Format (AgentTool):**
```typescript
interface AgentTool {
  name: string;
  description: string;
  parameters: JSONSchema;  // Manuelles JSON Schema
  execute: (args: Record<string, unknown>, context: AgentUserContext) => Promise<ToolResult>;
  requiredRoles?: UserRole[];
}
```

**Neues Format (AI SDK CoreTool mit Zod):**
```typescript
import { tool } from 'ai';
import { z } from 'zod';

const ragSearchTool = tool({
  description: 'Search the document knowledge base...',
  parameters: z.object({
    query: z.string().describe('The search query'),
    limit: z.number().optional().describe('Max results (default: 5)'),
    searchMode: z.enum(['keyword', 'semantic', 'hybrid']).optional(),
  }),
  execute: async ({ query, limit, searchMode }) => {
    // Bestehende Logik bleibt identisch
    // Aber: kein context Parameter mehr — siehe Lösung unten
  },
});
```

**Problem: AgentUserContext in Tools**

AI SDK Tools haben keinen `context` Parameter. Unsere Tools brauchen aber `userId`, `userRole`, `allowedDocumentIds` etc.

**Lösung:** Tool-Factory-Pattern mit Closure:
```typescript
function createRagSearchTool(context: AgentUserContext) {
  return tool({
    description: 'Search the document knowledge base...',
    parameters: z.object({ query: z.string(), limit: z.number().optional() }),
    execute: async ({ query, limit }) => {
      // context ist via Closure verfügbar
      const results = await vectorServiceV2.search({
        query,
        limit: limit || 5,
        allowedDocumentIds: context.allowedDocumentIds,
      });
      return formatResults(results);
    },
  });
}
```

**Migrationsplan für alle 11 Tools:**

| Tool | Context benötigt? | Anpassung |
|------|-------------------|-----------|
| rag_search | Ja (allowedDocumentIds) | Factory mit context Closure |
| read_chunk | Nein | Direkte Migration |
| graph_query | Nein | Direkte Migration |
| sql_query | Ja (userRole für Berechtigungsprüfung) | Factory mit context Closure |
| create_document | Ja (userId) | Factory mit context Closure |
| send_notification | Nein (nutzt io global) | Direkte Migration |
| load_skill | Ja (userId, userRole, department) | Factory mit context Closure |
| list_skills | Ja (userId, userRole, department) | Factory mit context Closure |
| create_skill | Ja (userId, userRole, department) | Factory mit context Closure |
| update_skill | Ja (userId, userRole, department) | Factory mit context Closure |

**ToolRegistry Update:**
```typescript
// Neue Methode: Erzeugt AI SDK Tools mit Context-Binding
getAISDKTools(context: AgentUserContext): Record<string, CoreTool> {
  const tools: Record<string, CoreTool> = {};
  for (const [name, agentTool] of this.tools) {
    // Rolle prüfen
    if (agentTool.requiredRoles?.length && !agentTool.requiredRoles.includes(context.userRole)) {
      continue;
    }
    tools[name] = tool({
      description: agentTool.description,
      parameters: convertJSONSchemaToZod(agentTool.parameters), // Adapter-Funktion
      execute: async (args) => agentTool.execute(args, context),
    });
  }
  return tools;
}
```

**Alternative (einfacher):** JSON Schema direkt nutzen statt Zod:
```typescript
import { jsonSchema } from 'ai';

tools[name] = tool({
  description: agentTool.description,
  parameters: jsonSchema(agentTool.parameters), // AI SDK akzeptiert JSON Schema!
  execute: async (args) => agentTool.execute(args, context),
});
```

→ **`jsonSchema()` von AI SDK nutzen statt Zod-Konvertierung.** Das vermeidet die komplexe JSON-Schema-zu-Zod Konvertierung und hält die bestehenden Tool-Definitionen kompatibel.

### Schritt 3: AgentExecutor ersetzen

**Neue Datei:** `server/src/services/agents/AgentExecutor.ts` (Rewrite)

```typescript
import { generateText, streamText } from 'ai';
import { resolveModel } from './ai-provider.js';
import { toolRegistry } from './ToolRegistry.js';
import { agentPersistence } from './AgentPersistence.js';
import { skillRegistry } from '../skills/SkillRegistry.js';
import type { AgentUserContext, AgentTask } from './types.js';

export class AgentExecutor {
  private activeControllers: Map<string, AbortController> = new Map();

  async execute(
    query: string,
    context: AgentUserContext,
    options?: {
      model?: string;
      conversationId?: string;
      signal?: AbortSignal;
      systemPrompt?: string;
      allowedTools?: string[];
    }
  ): Promise<{ task: AgentTask; stream: ReadableStream }> {

    const modelString = options?.model || 'qwen3:8b';
    const model = resolveModel(modelString);
    const abortController = new AbortController();
    const signal = options?.signal || abortController.signal;

    // Task in DB erstellen
    const task = await agentPersistence.createTask(context, query, modelString, options?.conversationId);
    this.activeControllers.set(task.id, abortController);
    await agentPersistence.updateTaskStatus(task.id, 'running');

    // System Prompt mit Skill-Descriptions (Progressive Disclosure Level 1)
    const systemPrompt = options?.systemPrompt || await this.buildSystemPrompt(context);

    // Tools für diesen Context erstellen
    let tools = toolRegistry.getAISDKTools(context);
    if (options?.allowedTools) {
      const allowed = new Set(options.allowedTools);
      tools = Object.fromEntries(
        Object.entries(tools).filter(([name]) => allowed.has(name))
      );
    }

    // AI SDK generateText mit Multi-Step Tool Loop
    let stepNumber = 0;

    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: query,
      tools,
      maxSteps: 10,
      abortSignal: signal,
      temperature: 0.1,
      maxTokens: 4096,

      // Callback pro Schritt — hier persistieren wir Steps
      onStepFinish: async ({ text, toolCalls, toolResults, usage }) => {
        stepNumber++;
        for (const tc of toolCalls || []) {
          await agentPersistence.createStep({
            taskId: task.id,
            stepNumber,
            thought: text || undefined,
            toolName: tc.toolName,
            toolInput: tc.args,
            toolOutput: toolResults?.find(r => r.toolCallId === tc.toolCallId)?.result || '',
            tokensUsed: (usage?.promptTokens || 0) + (usage?.completionTokens || 0),
            durationMs: 0, // AI SDK gibt keine Step-Duration
          });
        }
      },
    });

    // Task abschließen
    await agentPersistence.updateTaskStatus(task.id, 'completed', {
      result: { answer: result.text },
      totalSteps: stepNumber,
      inputTokens: result.usage?.promptTokens || 0,
      outputTokens: result.usage?.completionTokens || 0,
    });

    this.activeControllers.delete(task.id);
    return {
      task: { ...task, status: 'completed', result: { answer: result.text } },
      stream: null as any, // Für Streaming-Variante siehe Schritt 4
    };
  }

  // ... cancel(), isRunning(), buildSystemPrompt() bleiben ähnlich
}
```

### Schritt 4: SSE Streaming Migration

**Aktuell:** Custom EventEmitter → Express SSE → Frontend fetch + ReadableStream
**Neu:** AI SDK `streamText` → `createDataStreamResponse` oder `pipeDataStreamToResponse`

**Route Handler (neu):**
```typescript
import { streamText, pipeDataStreamToResponse } from 'ai';

router.post('/run', authenticateToken, async (req, res) => {
  const context = getUserContext(req);
  const { query, model } = req.body;

  const task = await agentPersistence.createTask(context, query, model);

  const result = streamText({
    model: resolveModel(model),
    system: await buildSystemPrompt(context),
    prompt: query,
    tools: toolRegistry.getAISDKTools(context),
    maxSteps: 10,
    temperature: 0.1,
    onStepFinish: async ({ toolCalls, toolResults, usage }) => {
      // Steps in DB persistieren
    },
    onFinish: async ({ text, usage }) => {
      // Task in DB als completed markieren
    },
  });

  // AI SDK handled SSE-Format automatisch
  pipeDataStreamToResponse(result.toDataStream(), res);
});
```

**Frontend mit `useChat` Hook (Alternative):**
```typescript
import { useChat } from '@ai-sdk/react';

// Ersetzt den gesamten SSE-Parsing-Code im AgentContext
const { messages, isLoading, append } = useChat({
  api: '/api/agents/run',
  // ...
});
```

**ACHTUNG:** `useChat` ist primär für Chat-UIs gedacht. Für unsere Task-basierte UI (kein Chat-Verlauf, sondern einzelne Tasks mit Steps) ist die manuelle Stream-Verarbeitung besser:

```typescript
// Frontend: AI SDK Data Stream parsen
const response = await fetch('/api/agents/run', { ... });
const reader = response.body.getReader();
// AI SDK Data Stream Format ist anders als unser Custom SSE
// Muss in handleSSEEvent gemappt werden
```

### Schritt 5: PII Guard + Usage Logging erhalten

**Problem:** Der bestehende LLMRouter hat PII Guard (Presidio) und Usage Logging für Cloud-Provider. AI SDK hat das nicht eingebaut.

**Lösung:** AI SDK Middleware / Wrapper:
```typescript
import { wrapLanguageModel } from 'ai';

function createGuardedModel(modelString: string, userId: string) {
  const baseModel = resolveModel(modelString);
  const [provider] = modelString.split(':');

  if (provider === 'anthropic' && piiGuard) {
    return wrapLanguageModel({
      model: baseModel,
      middleware: {
        transformParams: async ({ params }) => {
          // PII maskieren vor dem Senden an Cloud
          params.prompt = await piiGuard.mask(params.prompt);
          return params;
        },
        wrapGenerate: async ({ doGenerate }) => {
          const result = await doGenerate();
          // PII unmaskieren in der Antwort
          result.text = await piiGuard.unmask(result.text);
          // Usage loggen
          await logUsage(userId, provider, result.usage);
          return result;
        },
      },
    });
  }

  return baseModel;
}
```

### Schritt 6: Subagenten implementieren

**Neue Datei:** `server/src/services/agents/subagents.ts`

```typescript
import { generateText } from 'ai';
import { tool } from 'ai';
import { jsonSchema } from 'ai';
import { resolveModel } from './ai-provider.js';

// Recherche-Subagent: Führt tiefe Dokumentensuche durch
export function createResearchSubagentTool(context: AgentUserContext) {
  return tool({
    description: 'Starte eine tiefgehende Recherche als Subagent. Nutze dies für komplexe Recherche-Aufgaben die mehrere Suchläufe erfordern.',
    parameters: jsonSchema({
      type: 'object',
      required: ['task'],
      properties: {
        task: { type: 'string', description: 'Die Recherche-Aufgabe' },
        depth: { type: 'string', enum: ['schnell', 'gründlich'], description: 'Recherchetiefe' },
      },
    }),
    execute: async ({ task, depth }) => {
      const result = await generateText({
        model: resolveModel('qwen3:8b'),
        system: `Du bist ein Recherche-Agent. Durchsuche die Wissensdatenbank gründlich.
                 Tiefe: ${depth || 'gründlich'}. Antworte auf Deutsch.`,
        prompt: task,
        tools: {
          rag_search: createRagSearchTool(context),
          read_chunk: readChunkTool,
        },
        maxSteps: depth === 'schnell' ? 3 : 8,
        temperature: 0.1,
      });
      return result.text;
    },
  });
}
```

### Schritt 7: Frontend AgentContext Update

**Kernänderung:** SSE-Event-Format ändert sich von unserem Custom-Format zum AI SDK Data Stream Format.

**Option A: Minimaler Change — Custom SSE beibehalten**
- Backend wrapped AI SDK stream in unser bestehendes SSE-Format
- Frontend bleibt fast identisch
- Pro: Weniger Frontend-Änderungen
- Contra: Extra Mapping-Layer

**Option B: AI SDK Stream nativ nutzen**
- Frontend parst AI SDK Data Stream direkt
- `useChat` Hook oder `readDataStream`
- Pro: Standardisiert, weniger Code
- Contra: AgentContext muss neu geschrieben werden

**Empfehlung: Option A für Phase 1** — Backend emittiert weiterhin unser Custom-SSE-Format, gemappt aus den AI SDK Callbacks (`onStepFinish`, `onFinish`). Frontend bleibt stabil. In Phase 2 kann auf AI SDK native Streams umgestellt werden.

```typescript
// Route: AI SDK Callbacks → Custom SSE Events
const result = streamText({
  model, system, prompt, tools,
  onStepFinish: ({ toolCalls, text }) => {
    // Mappen auf unser Event-Format
    res.write(`event: step:tool_complete\ndata: ${JSON.stringify({
      taskId: task.id,
      stepNumber,
      toolName: toolCalls[0]?.toolName,
      toolOutput: toolCalls[0]?.result,
    })}\n\n`);
  },
  onFinish: ({ text, usage }) => {
    res.write(`event: task:complete\ndata: ${JSON.stringify({
      taskId: task.id,
      result: text,
      inputTokens: usage.promptTokens,
      outputTokens: usage.completionTokens,
    })}\n\n`);
    res.end();
  },
});
```

## 5. Risiken und Mitigationen

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| Ollama Tool-Calling Inkompatibilität | MITTEL | HOCH | `ollama-ai-provider-v2` vor Migration testen. Fallback: `ai-sdk-ollama` Package |
| Qwen3 `think: false` nicht unterstützt | MITTEL | HOCH | Prüfen ob Ollama Provider `providerOptions.ollama.think` unterstützt |
| PII Guard Integration bricht | NIEDRIG | HOCH | `wrapLanguageModel` Middleware Pattern ist dokumentiert |
| Frontend-Events inkompatibel | NIEDRIG | MITTEL | Option A (Custom SSE beibehalten) eliminiert dieses Risiko |
| Step-Persistierung timing | MITTEL | MITTEL | `onStepFinish` ist synchron — DB-Write muss schnell sein |
| Tool-Timeout bei Subagenten | MITTEL | MITTEL | Timeout pro Tool konfigurieren, Subagent-Steps begrenzen |
| DB-Schema Inkompatibilität | NIEDRIG | NIEDRIG | Schema bleibt identisch, nur die Schreiber ändern sich |

## 6. Migrations-Reihenfolge

```
Phase 1: Foundation (nicht-brechend)
├── 1.1 Packages installieren (ai, @ai-sdk/anthropic, ollama-ai-provider-v2, zod)
├── 1.2 ai-provider.ts erstellen (resolveModel)
├── 1.3 ToolRegistry.getAISDKTools() Methode hinzufügen
└── 1.4 Smoke-Test: generateText mit einem Tool lokal testen

Phase 2: AgentExecutor Migration
├── 2.1 AgentExecutor.ts rewriten mit generateText + onStepFinish
├── 2.2 agents.ts Route auf neues Streaming umstellen
├── 2.3 Custom SSE Events aus AI SDK Callbacks emittieren (Option A)
└── 2.4 Integration-Test: Task starten, Steps prüfen, Ergebnis prüfen

Phase 3: Provider Migration
├── 3.1 Anthropic Provider durch @ai-sdk/anthropic ersetzen
├── 3.2 Ollama Provider durch ollama-ai-provider-v2 ersetzen
├── 3.3 PII Guard als wrapLanguageModel Middleware integrieren
├── 3.4 Usage Logging anpassen
├── 3.5 LLMRouter vereinfachen oder entfernen
└── 3.6 chat.ts Route auf AI SDK umstellen (llmRouter.chat/chatStream → generateText/streamText)

Phase 4: Subagenten (neues Feature)
├── 4.1 Research Subagent Tool erstellen
├── 4.2 Subagent in Skills integrieren (Recherche-Report nutzt Subagent)
├── 4.3 Nested Streaming testen
└── 4.4 Parallel-Ausführung mit Promise.all testen

Phase 5: Frontend Optimization (optional)
├── 5.1 AI SDK Data Stream nativ parsen (statt Custom SSE)
├── 5.2 useChat Hook evaluieren
└── 5.3 AgentContext vereinfachen
```

## 7. Validierungs-Checkliste

Nach jeder Phase müssen diese Tests bestehen:

### Funktionale Tests
- [ ] Agent Task starten mit Qwen3:8b (Ollama)
- [ ] Agent Task starten mit Claude Sonnet (Anthropic)
- [ ] Tool-Calling: rag_search wird korrekt aufgerufen
- [ ] Tool-Calling: read_chunk mit Chunk-ID funktioniert
- [ ] Tool-Calling: load_skill lädt Skill-Instruktionen
- [ ] Tool-Calling: create_skill speichert neuen Skill
- [ ] Tool-Calling: graph_query (wenn Neo4j aktiv)
- [ ] Tool-Calling: sql_query (nur mit Admin/Manager Rolle)
- [ ] Multi-Step: Agent macht 3+ Tool-Calls in einem Task
- [ ] Cancellation: Laufender Task kann abgebrochen werden
- [ ] Fehlerbehandlung: Ungültiger Tool-Call wird graceful gehandelt

### Streaming Tests
- [ ] SSE Events kommen in korrekter Reihenfolge im Frontend an
- [ ] task:start Event enthält taskId
- [ ] step:tool_start enthält toolName + toolInput
- [ ] step:tool_complete enthält toolOutput
- [ ] task:complete enthält result + token counts
- [ ] Keepalive Pings verhindern Timeout
- [ ] Client-Disconnect wird sauber behandelt

### Persistenz Tests
- [ ] agent_tasks Record wird korrekt erstellt
- [ ] agent_steps Records werden pro Tool-Call erstellt
- [ ] Status-Transitions: pending → running → completed
- [ ] Token-Counts werden korrekt erfasst
- [ ] Fehler-Tasks haben status='failed' und error-Text
- [ ] GET /api/agents/tasks listet Tasks korrekt
- [ ] GET /api/agents/tasks/:id gibt Steps zurück

### Frontend Tests
- [ ] Task-Liste zeigt alle Tasks mit korrektem Status
- [ ] Laufender Task zeigt Live-Spinner
- [ ] Tool-Calls werden mit vertikaler Linie angezeigt
- [ ] Collapsible Tool-Gruppen funktionieren
- [ ] "Ergebnis" Badge ist klickbar und zeigt Request/Response
- [ ] Markdown-Antwort wird korrekt gerendert
- [ ] "+" Button startet neuen Task
- [ ] Abbrechen-Button funktioniert bei laufendem Task

### Skill-Integration Tests
- [ ] Skills werden im System-Prompt angezeigt (Level 1)
- [ ] list_skills findet alle verfügbaren Skills
- [ ] load_skill gibt Markdown-Instruktionen zurück
- [ ] create_skill speichert neuen Skill in DB
- [ ] update_skill aktualisiert bestehenden Skill
- [ ] Skill Creator Workflow: Interview → Draft → Save funktioniert

### Regressions Tests
- [ ] Chat-Funktion (nicht Agent) funktioniert weiterhin
- [ ] Dokumenten-Upload und -Verarbeitung unverändert
- [ ] RAG-Suche im Chat unverändert
- [ ] Admin-Routes unverändert
- [ ] Auth-Flow unverändert
- [ ] TypeScript: `tsc --noEmit` fehlerfrei (Frontend + Server)

## 8. Rollback-Plan

Falls die Migration fehlschlägt:

1. **Git-basiert:** Migration in eigenem Branch (`feat/ai-sdk-migration`). Bei Problemen: `git checkout main`
2. **Feature-Flag:** Beide Executors parallel lauffähig halten:
   ```typescript
   const useAISDK = process.env.USE_AI_SDK === 'true';
   if (useAISDK) {
     // Neuer AI SDK basierter Executor
   } else {
     // Bestehender AgentExecutor
   }
   ```
3. **DB-kompatibel:** Schema ändert sich nicht → kein DB-Rollback nötig

## 9. Aufwandsschätzung

| Phase | Dateien | Geschätzter Umfang |
|-------|---------|-------------------|
| Phase 1: Foundation | 3 neue Dateien | Klein |
| Phase 2: AgentExecutor | 2 Dateien rewrite | Groß |
| Phase 3: Provider | 3 Dateien ersetzen/anpassen | Mittel |
| Phase 4: Subagenten | 1-2 neue Dateien | Mittel |
| Phase 5: Frontend | 1-2 Dateien anpassen | Klein (optional) |

## 10. Offene Fragen

1. **Qwen3 think-Mode:** Unterstützt `ollama-ai-provider-v2` den `think: false` Parameter? Das ist kritisch — ohne ihn funktioniert Qwen3 Tool-Calling nicht.

2. **`jsonSchema()` vs Zod:** AI SDK 6 unterstützt `jsonSchema()` für Tool-Parameter — damit können wir unsere bestehenden JSON Schema Definitionen 1:1 übernehmen ohne Zod-Konvertierung. Muss verifiziert werden.

3. **PII Guard Middleware:** `wrapLanguageModel` ist in AI SDK 6 vorhanden — die genaue API muss gegen die aktuelle Doku geprüft werden.

4. **Token-Counting:** AI SDK gibt `usage.promptTokens` + `usage.completionTokens` zurück. Entspricht das unserem `inputTokens`/`outputTokens`?

5. **Step-Duration:** AI SDK `onStepFinish` gibt keine Duration pro Step. Wir müssen die Zeit selbst messen (Date.now() Differenz).

6. **Chat-Route Migration:** `server/src/routes/chat.ts` nutzt `llmRouter.chat()` und `llmRouter.chatStream()` unabhängig vom Agent-System. Wenn LLMRouter entfernt wird, müssen diese Calls auf AI SDK `generateText`/`streamText` umgestellt werden. Das betrifft auch RAG-Streaming und Query-Rewriting.

7. **ToolRegistry API-Stabilität:** `SkillValidator` importiert `toolRegistry.getToolNames()`. Die Methode muss nach der Migration weiterhin existieren — auch wenn `getAnthropicTools()` und `getOllamaTools()` durch `getAISDKTools()` ersetzt werden.

8. **allowedDocumentIds:** Wird nicht vom Auth-Middleware gesetzt, sondern muss pro Request aus der DB geholt werden (Dokument-Berechtigungen). Der aktuelle Flow setzt es nie — das ist ein bestehendes Feature-Gap, kein Migrations-Problem.
