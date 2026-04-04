# Cor7ex Codebase -- Non-Obvious Pitfalls and Gotchas

## 1. CRITICAL: Secrets Committed in server/.env

The file `server/.env` contains real production credentials (database passwords, API keys, JWT secrets, OAuth client secrets) and is **tracked by git** or at minimum present on disk. While `.gitignore` lists `.env`, the `server/.env` file contains:

- PostgreSQL password: `J45aJc9eAhcZDduJ0hhPEQMFe+UKn4Sd`
- Redis password embedded in URL
- Neo4j password: `f26d56df29f9e440cecf8673fd4277cd`
- Mistral API key
- OVH AI API key (a full JWT PAT token)
- Google OAuth2 Client ID + Secret
- MCP client credentials
- JWT signing secret

**Gotcha**: Even though `.env` is in `.gitignore`, `server/.env.hetzner` is listed in `.gitignore` but is duplicated (appears twice, line 64-65). The `server/.env.local` header still says "Qwen Chat" (the old project name), suggesting it is a stale copy. A new developer copying `.env.example` might think the defaults are safe, but the actual `.env` running on the machine has real keys.

**Risk**: If any of these files were ever committed to git history, all secrets are compromised.

---

## 2. Two Separate .env Files with Different Scopes

The project has **two independent `.env` files** that serve different purposes:

| File | Purpose |
|------|---------|
| `/.env` (root) | Frontend (Vite) variables only -- `VITE_*` prefixed |
| `/server/.env` | Backend (Express) variables -- DB, LLM, auth, everything |

The backend loads its env from `server/.env` via `config({ path: resolve(__dirname, '../../.env') })` in `server/src/config/env.ts`, which resolves relative to the `config/` directory up to the `server/` folder.

**Gotcha**: The root `.env` currently contains a Claude Code OAuth token (`CLAUDE_CODE_OAUTH_TOKEN`), which has nothing to do with the application. A new developer might confuse which `.env` to edit.

---

## 3. Environment Switching Overwrites server/.env

The `server/switch-env.sh` script copies either `.env.local` or `.env.hetzner` over `server/.env`:

```
cp "$SCRIPT_DIR/.env.local" "$SCRIPT_DIR/.env"
cp "$SCRIPT_DIR/.env.hetzner" "$SCRIPT_DIR/.env"
```

**Gotcha**: Any manual edits to `server/.env` will be silently lost when switching environments. The Hetzner variant also starts SSH tunnels to the remote server. A new developer who runs `switch-env.sh hetzner` without the SSH key at `~/.ssh/cor7ex_hetzner` will get a cryptic failure.

---

## 4. Services Require SSH Tunnels on Hetzner

When using the Hetzner environment, all infrastructure services (PostgreSQL, Weaviate, Neo4j, Redis, Presidio, Reranker, Parser) bind to `127.0.0.1` on the remote server. They are **only accessible via SSH tunnels** (`server/start-tunnels.sh`).

**Gotcha**: The `.env.hetzner` comments explicitly warn that Reranker and Parser are "NICHT auf Hetzner" (not running on Hetzner). So even with tunnels, these services may not work. This means RAG document processing and reranking silently degrade when on Hetzner.

---

## 5. DocumentService is a Singleton with Mutable User Context (Race Condition)

`DocumentService` is exported as a singleton:

```typescript
export const documentService = new DocumentService();
```

It stores user context as instance state:

```typescript
private userContext: { userId: string; userRole: string; userDepartment: string } | null = null;

async setUserContext(userId: string, userRole: string, userDepartment?: string): Promise<void> {
    this.userContext = { userId, userRole, userDepartment: userDepartment || '' };
}
```

**Gotcha**: In a concurrent Node.js server handling multiple requests, two simultaneous requests will overwrite each other's `userContext`. If Request A sets user context, then Request B sets a different context before Request A reads documents, Request A will use Request B's permissions. This is a **permission bypass vulnerability** under concurrent load.

The pattern `setUserContext() -> doWork() -> clearUserContext()` is used extensively in routes like `documents.ts` and `rag.ts`, but it is inherently unsafe for a shared singleton in a multi-request environment.

---

## 6. Input Sanitization Mutates Request Bodies Aggressively

The `inputSanitization` middleware in `security.ts` replaces characters in ALL string values in the request body:

```typescript
return obj
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
```

**Gotcha**: This transforms every forward slash `/` in every request body string to `&#x2F;`. This will corrupt:
- File paths sent in requests
- URLs in request bodies
- Regular expressions
- Any structured content (Markdown, code snippets) sent to the LLM

Additionally, the `--` pattern is in the dangerous patterns list (`/--/g`), which means any text containing SQL-style comments or Markdown horizontal rules will be rejected. Since users interact with an LLM chatbot, they might paste code or technical content that triggers false positives.

---

## 7. SQL Query Tool Concatenates Statements Unsafely

In `server/src/services/agents/tools/sql-query.ts`, the timeout and query are concatenated:

```typescript
databaseService.query(`SET statement_timeout = '${QUERY_TIMEOUT_MS}'; ${limitedQuery}`)
```

**Gotcha**: While there is regex validation for SELECT-only queries, the concatenation with `SET statement_timeout` means the database actually executes two statements. The `FORBIDDEN_KEYWORDS` regex check runs on the user query, but the tool prepends an additional statement. More importantly, an LLM agent constructs these queries -- a crafty prompt injection could potentially construct queries that pass the regex but exploit edge cases.

---

## 8. Rate Limiter is In-Memory Only (Resets on Restart)

The rate limiter in `security.ts` uses a `Map<string, ...>` in memory:

```typescript
const attempts = new Map<string, { count: number; resetTime: number }>()
```

**Gotcha**: Rate limits reset entirely when the server restarts. In development with `--watch` mode, restarts are frequent, making rate limits effectively non-existent. The code even has a comment acknowledging this: "In a production environment, you would use redis-based rate limiting." Redis is already in the stack but not used for rate limiting.

---

## 9. Dual requireRole Implementations

There are **two different `requireRole` functions** that are subtly incompatible:

1. `server/src/middleware/auth.ts` -- `requireRole(...allowedRoles: string[])` -- uses `includes()` for exact match
2. `server/src/middleware/requireAuth.ts` -- `requireRole(role: string)` -- uses `toLowerCase()` comparison for a single role

**Gotcha**: Depending on which one a route imports, role matching behaves differently. The `auth.ts` version is case-sensitive, while the `requireAuth.ts` version is case-insensitive. Both are exported from the middleware barrel (`index.ts`). A new developer importing `requireRole` might get either version.

---

## 10. Frontend Imports Server Types via Relative Path

Several frontend files import types directly from the server directory:

```typescript
// src/contexts/AuthContext.tsx
import type { User } from '../../server/src/types/auth';

// src/components/ProtectedRoute.tsx
import type { UserRole } from '../../server/src/types/auth';
```

**Gotcha**: This creates a tight coupling between the frontend Vite build and server source files. If the server directory structure changes, the frontend build breaks. This also means the frontend TypeScript compilation reaches into the server source tree, which can cause unexpected type resolution issues. Normally, shared types would be in a dedicated shared package.

---

## 11. Migration Runner Only Runs the First Migration

The migration script `server/src/scripts/run-migration.ts` is hardcoded to run only `001_enterprise_auth_setup.sql`:

```typescript
const migrationPath = resolve(__dirname, '../migrations/001_enterprise_auth_setup.sql');
```

**Gotcha**: There are 18 migration files (001 through 018). The migration runner does not auto-discover or sequence them. There is no migration tracking table. A new developer must manually determine which migrations have been applied and run them individually, or they need to run the SQL files manually against the database in order. There is no `migrate up` / `migrate down` workflow.

---

## 12. V1 and V2 Systems Coexist (Dead Code Risk)

The project has both V1 and V2 implementations running side by side:

- `VectorService.ts` (V1) and `VectorServiceV2.ts` (V2) -- different Weaviate collection schemas
- RAGService uses `USE_V2_SEARCH = true` (hardcoded constant), but V1 code paths remain
- DocumentService processes everything through V2 pipeline
- Both services are exported from `services/index.ts`

**Gotcha**: It is unclear whether V1 data still exists in Weaviate. V1 code is still imported and available. A new developer might use V1 search functions thinking they are equivalent, but they query a different collection with a different schema.

---

## 13. PII Guard Fails Open

When the PII Guard (Presidio) is unavailable, the system continues to send data to cloud LLM providers without masking:

```typescript
if (!piiGuard) {
    // No PII guard configured -- allow cloud calls without masking
    return;
}
```

**Gotcha**: The `ai-middleware.ts` explicitly allows cloud LLM calls without PII protection if Presidio is down. This is a design decision (availability over security), but a new developer might assume PII is always masked before cloud calls. The server startup only logs a warning if Presidio is unavailable.

---

## 14. Embedding Model Requires Specific Prefixes

The `EmbeddingService` applies task-specific prefixes for the nomic embedding model:

```typescript
if (model.includes('nomic-embed-text')) {
    return type === 'query' ? `search_query: ${text}` : `search_document: ${text}`;
}
```

**Gotcha**: If you call `generateEmbedding()` without specifying the `type` parameter, no prefix is applied, which produces embeddings in a different vector space than prefixed ones. Mixing prefixed and unprefixed embeddings degrades search quality silently -- there is no error, just worse results.

---

## 15. The `/api/models` Route Has No Authentication

The models route (`server/src/routes/models.ts`) does not use `authenticateToken`:

```typescript
router.get('/', asyncHandler(async (_req: Request, res: Response) => { ... }));
```

**Gotcha**: While this might be intentional (the login page may need to show available models), it leaks cloud model information (pricing, provider, context window) to unauthenticated users. This is a minor information disclosure but could surprise a security-conscious developer.

---

## 16. Subagent Cache Never Invalidates Automatically

The `SubagentLoader` caches built-in agent definitions globally:

```typescript
let cachedDefinitions: SubagentDefinition[] | null = null;
```

**Gotcha**: If you edit a `.md` file in `server/agents/` while the server is running, the change will not be picked up. You must call `clearSubagentCache()` explicitly, or restart the server. There is no file watcher. This is especially confusing during development when iterating on agent prompts.

---

## 17. The "opensrc" Directory Contains 134MB of Vendored Source Repos

The `opensrc/` directory contains cloned source code from React, Vite, Vercel AI SDK, Express, and MCP -- totaling 134MB. The `.gitignore` has `openscr` (note the typo -- missing an `e`) instead of `opensrc`:

```
# Open Source Research
openscr
```

**Gotcha**: The gitignore entry `openscr` does NOT match `opensrc/`, so this 134MB directory is potentially tracked by git (though it appears to currently not be staged). The typo means this directory could accidentally be committed.

---

## 18. Hybrid Alpha Default is 0.3 (70% Keyword, 30% Semantic)

The default search blend heavily favors BM25 keyword search over semantic vector search:

```typescript
const DEFAULT_HYBRID_ALPHA = parseFloat(process.env.HYBRID_ALPHA || '0.3')
```

**Gotcha**: This is specifically tuned for German technical texts. If you add English-language documents, the keyword-heavy default may not perform well. The alpha can be overridden per request, but the default will apply to all agent tool calls and RAG searches unless explicitly changed.

---

## 19. Bun and Node Package Managers Coexist

The project has both `bun.lock` (174KB) and `package-lock.json` (370KB). Scripts use `bun`:

```json
"dev": "bunx vite",
"dev:server": "bun --watch server/src/index.ts",
```

**Gotcha**: If a developer runs `npm install` instead of `bun install`, the lockfiles may diverge. The server is started with `bun --watch` which uses Bun's TypeScript runtime directly (no compilation step needed). If you try to run with `node`, you need to compile TypeScript first via `bun run build:server`. The import paths use `.js` extensions (e.g., `from './config/env.js'`) which is a Node ESM convention that Bun handles transparently.

---

## 20. Socket.IO Authentication Reads Cookies with a Manual Regex

Instead of using a proper cookie parser, the Socket.IO auth middleware extracts the JWT from raw cookie headers with a regex:

```typescript
const match = socket.handshake.headers.cookie.match(/(?:^|;\s*)auth_token=([^;]*)/);
```

**Gotcha**: This is fragile. Cookie values with encoded characters, or changes to the cookie name, will silently break WebSocket authentication. The Express side uses the `cookie-parser` middleware, but Socket.IO does not benefit from it.

---

## Summary Table

| # | Category | Severity | Description |
|---|----------|----------|-------------|
| 1 | Security | Critical | Real secrets in server/.env on disk |
| 2 | Config | Medium | Two separate .env files with different scopes |
| 3 | DevEx | Medium | switch-env.sh silently overwrites manual .env edits |
| 4 | Infra | Medium | Hetzner services require SSH tunnels; some services missing |
| 5 | Security | High | Singleton DocumentService has race condition on user context |
| 6 | Correctness | High | Input sanitization corrupts forward slashes and legitimate content |
| 7 | Security | Medium | SQL tool concatenates statements |
| 8 | Security | Low | In-memory rate limiter resets on restart |
| 9 | Correctness | Medium | Two incompatible requireRole implementations |
| 10 | Architecture | Medium | Frontend imports server types via relative paths |
| 11 | DevEx | High | Migration runner only handles first migration file |
| 12 | Maintenance | Medium | V1 and V2 vector services coexist |
| 13 | Security | Medium | PII Guard fails open (cloud calls without masking) |
| 14 | Correctness | Medium | Embedding prefixes required but easy to omit |
| 15 | Security | Low | /api/models unauthenticated |
| 16 | DevEx | Low | Subagent cache never auto-invalidates |
| 17 | Config | Medium | opensrc gitignore has typo, 134MB could be committed |
| 18 | Correctness | Low | Search alpha tuned for German, may not suit English content |
| 19 | DevEx | Medium | Bun and npm lockfiles coexist |
| 20 | Correctness | Low | Socket.IO cookie parsing via manual regex |
