/**
 * MCP Client Configuration
 * Reads connection details from environment variables
 */

export interface McpServerConfig {
  /** MCP server URL (e.g., http://localhost:3000/mcp) */
  url: string;
  /** OAuth token endpoint */
  tokenEndpoint: string;
  /** OAuth client credentials */
  clientId: string;
  clientSecret: string;
  /** Default scopes to request */
  defaultScopes: string[];
  /** Server name (used as tool prefix) */
  name: string;
}

export function loadMcpConfig(): McpServerConfig | null {
  const url = process.env.MCP_SAMAWORKFORCE_URL;
  const clientId = process.env.MCP_SAMAWORKFORCE_CLIENT_ID;
  const clientSecret = process.env.MCP_SAMAWORKFORCE_CLIENT_SECRET;

  if (!url || !clientId || !clientSecret) {
    console.log('[MCP] SamaWorkforce MCP not configured (set MCP_SAMAWORKFORCE_URL, MCP_SAMAWORKFORCE_CLIENT_ID, MCP_SAMAWORKFORCE_CLIENT_SECRET)');
    return null;
  }

  // Derive token endpoint from MCP URL (same host)
  const baseUrl = new URL(url);
  const tokenEndpoint = `${baseUrl.protocol}//${baseUrl.host}/oauth/token`;

  const scopes = (process.env.MCP_SAMAWORKFORCE_SCOPES || 'employees:read customers:read facilities:read assignments:read timeentries:read accounting:read contracts:read').split(' ');

  return {
    url,
    tokenEndpoint,
    clientId,
    clientSecret,
    defaultScopes: scopes,
    name: 'sama',
  };
}
