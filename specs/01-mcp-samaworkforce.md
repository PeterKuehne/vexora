# Spec: MCP-Anbindung SamaWorkforce ↔ Cor7ex

**Status:** In Arbeit
**Bezug:** [MCP Authorization Spec](https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization), [Auth0 MCP Update](https://auth0.com/blog/mcp-specs-update-all-about-auth/)
**Recherche-Quellen:** MCP Spec 2025-03-26, Auth0 June 2025 Update, CData 2026 Best Practices, OWASP MCP Security Guide

---

## Zusammenfassung

SamaWorkforce (NestJS+GraphQL, 65 Queries + 70 Mutations) wird als MCP Server exponiert. Cor7ex verbindet sich als MCP Client. OAuth 2.1 mit PKCE sichert den Zugriff. CASL RBAC greift weiterhin pro User.

---

## 1. Architektur-Entscheidungen

### 1.1 OAuth 2.1 Auth Server: Eingebettet in SamaWorkforce

Eigenes `OAuthModule` neben bestehendem `AuthModule`. RS256 JWTs (neu) neben HS256 JWTs (unberuehrt).

- Grant Types: Authorization Code + PKCE (interaktiv), Client Credentials (Cor7ex Server)
- Spaeter austauschbar gegen externen IdP ohne MCP-Code-Aenderungen

### 1.2 GraphQL → MCP Mapping

- Queries → MCP Resources (read-only, URI-addressierbar)
- Mutations → MCP Tools (ausfuehrbare Aktionen)
- Codegen-Script liest `schema.gql` und generiert MCP-Definitionen
- Kuratierte Allowlist: ~55 Queries + ~60 Mutations

### 1.3 Scope-Design: `{domain}:{action}`

| Scope | Beispiel-Operationen |
|---|---|
| `employees:read` | `employees`, `employee`, `me`, `employeeContract` |
| `employees:write` | `createEmployee`, `updateEmployee`, `deleteEmployee` |
| `customers:read/write` | CRUD Kunden |
| `facilities:read/write` | CRUD Einrichtungen |
| `assignments:read/write` | Einsatzplanung, Overlap-Check |
| `timeentries:read/write` | Zeiterfassung, Genehmigungsworkflow |
| `accounting:read/write` | Buchhaltung, Rechnungen, Mahnwesen |
| `contracts:read/write` | AUeV-Management |
| `health:read` | DSGVO Art. 9 (Admin only) |
| `admin:read/write` | Firmeneinstellungen |

### 1.4 Transport: Streamable HTTP

Ein Endpoint `/mcp` — POST (JSON-RPC), GET (SSE), DELETE (Session-Ende).

### 1.5 Cor7ex Client: Client Credentials + User-Delegation

Confidential Client, User-Identity via `on_behalf_of` Claim.

---

## 2. Phasen

### Phase 1: OAuth 2.1 Foundation (SamaWorkforce)

Neue Dateien in `apps/api/src/oauth/`:
- `oauth.module.ts`, `oauth.controller.ts`, `oauth.service.ts`
- `oauth-client.service.ts`, `dto/`, `guards/`, `decorators/`

Prisma: `OAuthClient`, `OAuthAuthorizationCode` Tabellen

Endpoints:
- `GET /.well-known/oauth-authorization-server` (RFC 8414)
- `GET /.well-known/oauth-protected-resource` (RFC 9728)
- `POST /oauth/authorize`, `POST /oauth/token`, `POST /oauth/register`
- `GET /oauth/jwks`

### Phase 2: MCP Server Core (SamaWorkforce)

Neue Dateien in `apps/api/src/mcp/`:
- `mcp.module.ts`, `mcp.controller.ts`, `mcp-server.service.ts`
- `schema-mapper/`, `tools/graphql-bridge.ts`

SDK: `@modelcontextprotocol/sdk`

### Phase 3: MCP Client (Cor7ex)

Neue Dateien in `server/src/services/mcp/`:
- `McpClientManager.ts`, `McpOAuthClient.ts`, `McpToolAdapter.ts`

Tools als `sama_{toolName}`, skill-gated unter `'samaworkforce'`.

### Phase 4: Write Operations + Full Coverage

Alle Mutations freischalten, destructive/idempotent Annotations.

### Phase 5: Production Hardening

Logging, Rate Limits, Session Management, Monitoring.

---

## 3. Abhaengigkeiten

```
Phase 1 (OAuth) ──→ Phase 2 (MCP Server) ──→ Phase 4 (Write Ops)
                          │                         │
                          ↓                         ↓
                    Phase 3 (MCP Client) ──→ Phase 5 (Hardening)
```

---

## 4. Kritische Dateien

| Datei | Relevanz |
|---|---|
| `samaritano-platform/.../auth/auth.service.ts` | Bestehende Tokens nicht brechen |
| `samaritano-platform/.../schema.gql` | Source of Truth fuer Schema-Mapper |
| `samaritano-platform/.../authorization/casl-ability.factory.ts` | RBAC durch MCP |
| `qwen-chat/.../agents/ToolRegistry.ts` | MCP Tool Integration |
| `qwen-chat/.../agents/types.ts` | AgentTool Interface |

---

## 5. Erfolgs-Kriterien

| Test | Erwartung |
|---|---|
| OAuth PKCE Flow | Token mit korrekten Claims ausgestellt |
| MCP Initialize | Handshake erfolgreich |
| tools/list | Alle freigeschalteten Ops gelistet |
| resources/read | Employee-Daten via MCP abrufbar |
| Agent Round-Trip | `sama_employees` Tool liefert Daten |
| CASL Enforcement | Unauthorized Ops werden geblockt |
| Destructive Ops | Bestaetigung vor Loeschung |
