/**
 * MCP OAuth 2.1 Client
 * Handles token acquisition via Client Credentials grant + automatic refresh
 */

import type { McpServerConfig } from './mcp-config.js';

interface TokenCache {
  accessToken: string;
  expiresAt: number; // Unix timestamp ms
  scope: string;
}

export class McpOAuthClient {
  private tokenCache: TokenCache | null = null;
  // Refresh 60 seconds before expiry
  private readonly REFRESH_BUFFER_MS = 60_000;

  constructor(private config: McpServerConfig) {}

  /**
   * Get a valid access token (from cache or fresh)
   */
  async getToken(scopes?: string[]): Promise<string> {
    // Return cached token if still valid
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt - this.REFRESH_BUFFER_MS) {
      return this.tokenCache.accessToken;
    }

    // Request new token via Client Credentials
    const requestedScopes = scopes || this.config.defaultScopes;

    const response = await fetch(this.config.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'client_credentials',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        scope: requestedScopes.join(' '),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OAuth token request failed (${response.status}): ${errorText}`);
    }

    const data = await response.json() as {
      access_token: string;
      expires_in: number;
      scope: string;
    };

    this.tokenCache = {
      accessToken: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
      scope: data.scope,
    };

    console.log(`[MCP OAuth] Token acquired, expires in ${data.expires_in}s, scopes: ${data.scope}`);
    return this.tokenCache.accessToken;
  }

  /**
   * Invalidate the cached token (e.g., after a 401)
   */
  invalidate(): void {
    this.tokenCache = null;
  }
}
