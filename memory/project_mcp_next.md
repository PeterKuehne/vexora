---
name: MCP Connector Planung
description: Naechstes grosses Feature - MCP Server fuer SamaWorkforce Anbindung mit OAuth 2.1 Sicherheit. Muss gruendlich recherchiert und nach 2026 Best Practices implementiert werden.
type: project
---

## Naechstes Feature: MCP Connector fuer SamaWorkforce

**Why:** Cor7ex soll in Zukunft fuer andere Kunden bereitgestellt werden. MCP ist der Standard fuer Tool-Anbindungen (Linux Foundation seit Dez 2025). Direkte API-Anbindung waere Wegwerf-Arbeit.

**How to apply:** Bei der Planung IMMER recherchieren was die neuesten Best Practices 2026 sind. Keine eigenen Loesungswege ausdenken — alles mit validen Quellen abgleichen.

### Kernanforderungen:
- MCP Server in SamaWorkforce (NestJS + GraphQL, Port 3000)
- OAuth 2.1 mit PKCE (MCP Authorization Specification)
- Scoped Access Control (contracts:read, shifts:write, etc.)
- SamaWorkforce hat: 65 Queries, 70 Mutations (Einsatzplanung, Zeiterfassung, Buchhaltung, AUeG)
- Lokation: /Users/peter/Coding/Projekte-samaritano/samaritano-platform

### Recherche-Quellen:
- MCP Authorization Spec: https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization
- OWASP MCP Security Guide: https://genai.owasp.org/resource/a-practical-guide-for-secure-mcp-server-development/
- MCP Server Best Practices 2026: https://www.cdata.com/blog/mcp-server-best-practices-2026
- Auth0 MCP Integration: https://auth0.com/blog/mcp-specs-update-all-about-auth/

### User-Anforderung:
"Immer recherchieren was die neusten Best Practices 2026 fuer diesen Fall sind. Denke dir keine eigenen Loesungswege aus, recherchiere immer! Gleiche sie mit validen Quellen ab."
