/**
 * MCP Client Manager
 * Manages the MCP client connection lifecycle (singleton)
 * Connects to SamaWorkforce MCP server, discovers tools, registers them
 */

import { toolRegistry } from '../agents/ToolRegistry.js';
import { McpOAuthClient } from './McpOAuthClient.js';
import { mcpToolToAgentTool } from './McpToolAdapter.js';
import { loadMcpConfig, type McpServerConfig } from './mcp-config.js';

interface McpSession {
  sessionId: string;
  config: McpServerConfig;
  oauthClient: McpOAuthClient;
}

export class McpClientManager {
  private session: McpSession | null = null;
  private toolNames: string[] = [];

  /**
   * Initialize the MCP client: connect, discover tools, register them
   * Called once at server startup
   */
  async initialize(): Promise<boolean> {
    const config = loadMcpConfig();
    if (!config) return false;

    const oauthClient = new McpOAuthClient(config);

    try {
      // 1. Get OAuth token
      const token = await oauthClient.getToken();

      // 2. MCP Initialize handshake
      const initResponse = await this.mcpRequest(config.url, token, null, {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: { name: 'cor7ex', version: '1.0.0' },
        },
      });

      const sessionId = initResponse.sessionId;
      if (!sessionId) {
        console.error('[MCP Client] No session ID returned from initialize');
        return false;
      }

      this.session = { sessionId, config, oauthClient };
      console.log(`[MCP Client] Connected to ${config.name} MCP server, session: ${sessionId}`);

      // 3. Send initialized notification
      await this.mcpRequest(config.url, token, sessionId, {
        jsonrpc: '2.0',
        method: 'notifications/initialized',
        params: {},
      });

      // 4. Discover tools
      const toolsResponse = await this.mcpRequest(config.url, token, sessionId, {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      });

      const tools = toolsResponse.result?.tools || [];
      console.log(`[MCP Client] Discovered ${tools.length} tools from ${config.name}`);

      // 5. Register each tool with ToolRegistry
      for (const mcpTool of tools) {
        const agentTool = mcpToolToAgentTool(mcpTool, config.name, this);
        toolRegistry.register(agentTool);
        this.toolNames.push(agentTool.name);
      }

      console.log(`[MCP Client] Registered ${this.toolNames.length} MCP tools (skill-gated: samaworkforce)`);
      return true;
    } catch (error) {
      console.error(`[MCP Client] Failed to initialize: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  }

  /**
   * Call an MCP tool by its original name (without prefix)
   */
  async callTool(toolName: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.session) {
      throw new Error('MCP client not initialized');
    }

    console.log(`[MCP Client] Calling tool: ${toolName}`, JSON.stringify(args));

    const token = await this.session.oauthClient.getToken();

    const response = await this.mcpRequest(
      this.session.config.url,
      token,
      this.session.sessionId,
      {
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args,
        },
      },
    );

    if (response.result?.isError) {
      const errorText = response.result.content
        ?.map((c: { text?: string }) => c.text)
        .join('\n') || 'Unknown MCP error';
      console.error(`[MCP Client] Tool error: ${errorText}`);
      throw new Error(errorText);
    }

    // Extract text content from MCP response
    const content = response.result?.content || [];
    const textParts = content
      .filter((c: { type: string }) => c.type === 'text')
      .map((c: { text: string }) => c.text);

    const result = textParts.length === 1 ? textParts[0] : textParts.join('\n');
    console.log(`[MCP Client] Tool result (${toolName}): ${String(result).slice(0, 200)}...`);
    return result;
  }

  /**
   * Send a JSON-RPC request to the MCP server and parse the SSE response
   */
  private async mcpRequest(
    url: string,
    token: string,
    sessionId: string | null,
    body: unknown,
  ): Promise<{ result?: any; sessionId?: string }> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Authorization': `Bearer ${token}`,
    };

    if (sessionId) {
      headers['Mcp-Session-Id'] = sessionId;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`MCP request failed (${response.status}): ${await response.text()}`);
    }

    // Extract session ID from response headers
    const respSessionId = response.headers.get('mcp-session-id') || sessionId || '';

    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('text/event-stream')) {
      // Parse SSE response — extract JSON from "data:" lines
      const text = await response.text();
      const dataLines = text
        .split('\n')
        .filter(line => line.startsWith('data: '))
        .map(line => line.slice(6));

      const lastDataLine = dataLines[dataLines.length - 1];
      if (lastDataLine) {
        try {
          const parsed = JSON.parse(lastDataLine);
          return { result: parsed.result, sessionId: respSessionId || undefined };
        } catch {
          return { sessionId: respSessionId || undefined };
        }
      }

      return { sessionId: respSessionId || undefined };
    }

    // JSON response
    if (contentType.includes('application/json')) {
      const data = await response.json();
      return { result: (data as any).result, sessionId: respSessionId || undefined };
    }

    // 202 Accepted (for notifications)
    return { sessionId: respSessionId || undefined };
  }

  /**
   * Cleanup: unregister tools and close session
   */
  async shutdown(): Promise<void> {
    // Unregister tools
    for (const name of this.toolNames) {
      toolRegistry.unregister(name);
    }
    this.toolNames = [];

    // Close MCP session
    if (this.session) {
      try {
        const token = await this.session.oauthClient.getToken();
        await fetch(this.session.config.url, {
          method: 'DELETE',
          headers: {
            'Mcp-Session-Id': this.session.sessionId,
            'Authorization': `Bearer ${token}`,
          },
        });
      } catch {
        // Ignore cleanup errors
      }
      this.session = null;
    }

    console.log('[MCP Client] Shutdown complete');
  }
}

// Singleton
export const mcpClientManager = new McpClientManager();
