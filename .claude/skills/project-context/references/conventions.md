# Konventionen-Checkliste

Pruefe diese Punkte bevor du Aenderungen als fertig betrachtest.

---

## Sprache

- [ ] Alle UI-Texte auf Deutsch (Labels, Buttons, Fehlermeldungen, Toasts)
- [ ] Code-Kommentare und Variablennamen auf Englisch
- [ ] Antworten an den User auf Deutsch

## Naming

- [ ] Tools: snake_case (`rag_search`, `send_notification`, `sama_employees`)
- [ ] Skills: kebab-case Verzeichnisse (`server/skills/skill-name/`)
- [ ] Subagents/Expert Agents: kebab-case (`hr-expert`, `accounting-expert`)
- [ ] TypeScript Dateien: camelCase oder kebab-case (`AgentExecutor.ts`, `rag-search.ts`)
- [ ] Interfaces: PascalCase (`AgentTool`, `AgentUserContext`)
- [ ] MCP Tools: `sama_` Prefix fuer SamaWorkforce Tools

## Tool-Definition Pattern

Jedes Tool folgt diesem Schema:
- [ ] `name`: snake_case, eindeutig
- [ ] `description`: Deutsch, erklaert wann das Tool genutzt wird
- [ ] `inputSchema`: Zod Schema (bevorzugt) oder JSON Schema (legacy)
- [ ] `execute(args, context, options)`: Gibt `ToolResult` zurueck
- [ ] Optional: `requiredRoles`, `skillGated`

```typescript
export const myTool: AgentTool = {
  name: 'my_tool',
  description: 'Beschreibung auf Deutsch...',
  inputSchema: z.object({ ... }),
  async execute(args, context, options) {
    return { output: '...', metadata: {} };
  },
};
```

## Skill-Definition Pattern

Jeder Skill folgt diesem Schema:
- [ ] Verzeichnis unter `server/skills/` mit `SKILL.md`
- [ ] YAML Frontmatter: `name` (kebab-case) + `description`
- [ ] Optional: `references/`, `scripts/`, `assets/`
- [ ] Body: Markdown Instruktionen (< 500 Zeilen)

## Agent/Subagent-Definition Pattern

- [ ] Markdown-Datei mit YAML Frontmatter
- [ ] Frontmatter: `name`, `description`, `tools` (komma-separiert), `maxSteps`
- [ ] Body: System Prompt fuer den Agent
- [ ] Pfad: `server/agents/` (built-in) oder `server/expert-agents/` (Expert Agents)

## Express Routes

- [ ] Pfad: `server/src/routes/`
- [ ] Auth Middleware auf allen geschuetzten Routen
- [ ] Error Handling via `asyncHandler` Wrapper
- [ ] SSE fuer Agent-Events (`text/event-stream`)

## Environment Variablen

- [ ] In `server/.env` definiert
- [ ] Ueber `server/src/config/env.ts` geladen
- [ ] Secrets NIEMALS committen
- [ ] Neue Variablen in `.env.example` dokumentieren

## Git

- [ ] Commit Messages auf Englisch
- [ ] Format: `type: description` (feat, fix, docs, refactor)
- [ ] Keine `.env` Dateien committen
- [ ] Feature Branches: `feat/feature-name`

## Services

- [ ] Alle externen Services ueber SSH-Tunnel erreichbar (Hetzner)
- [ ] Verbindungen in `.env` konfiguriert
- [ ] Graceful Degradation wenn ein Service nicht erreichbar ist
- [ ] Logging bei Verbindungsfehlern (nicht crashen)
