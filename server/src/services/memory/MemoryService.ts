/**
 * MemoryService — Cor7ex wrapper around Hindsight Memory Engine
 *
 * Three memory banks:
 * - user-{userId}:     User preferences, feedback, interaction patterns
 * - agent-{agentName}: Domain-specific knowledge per Expert Agent
 * - hive-{orgId}:      Cross-domain enterprise knowledge (promoted from user/agent)
 *
 * Write operations are non-blocking (fire-and-forget with error logging).
 * Read operations are parallel and LLM-free (fast, cheap).
 */

import { HindsightClient } from '@vectorize-io/hindsight-client';
import type { RecallResponse } from '@vectorize-io/hindsight-client';
import { memoryConfig } from './memory-config.js';

// ============================================
// Types
// ============================================

export interface HiveMindContext {
  userMemory: string;
  hiveMindMemory: string;
}

// ============================================
// Service
// ============================================

class MemoryServiceImpl {
  private client: HindsightClient | null = null;
  private initialized = false;
  private knownBanks = new Set<string>();

  /**
   * Initialize the Hindsight client. Non-blocking — fails gracefully if server unavailable.
   */
  async initialize(): Promise<boolean> {
    if (!memoryConfig.enabled) {
      console.log('[MemoryService] Disabled (HINDSIGHT_URL not set)');
      return false;
    }

    try {
      this.client = new HindsightClient({ baseUrl: memoryConfig.url });

      // Health check
      const response = await fetch(`${memoryConfig.url}/health`);
      if (!response.ok) throw new Error(`Health check failed: ${response.status}`);

      this.initialized = true;
      console.log(`[MemoryService] Connected to Hindsight at ${memoryConfig.url}`);
      return true;
    } catch (error) {
      console.warn(`[MemoryService] Failed to connect (non-critical): ${error}`);
      this.client = null;
      this.initialized = false;
      return false;
    }
  }

  get isAvailable(): boolean {
    return this.initialized && this.client !== null;
  }

  // ─── Bank Management (lazy creation) ───────

  private async ensureBank(bankId: string, config?: {
    retainMission?: string;
    retainExtractionMode?: string;
    retainCustomInstructions?: string;
    enableObservations?: boolean;
  }): Promise<void> {
    if (!this.client || this.knownBanks.has(bankId)) return;

    try {
      await this.client.createBank(bankId, {
        retainMission: config?.retainMission,
        retainExtractionMode: config?.retainExtractionMode,
        retainCustomInstructions: config?.retainCustomInstructions,
        enableObservations: config?.enableObservations ?? true,
      });
      this.knownBanks.add(bankId);
    } catch (error: any) {
      // Bank already exists is fine (409 or similar)
      if (error?.statusCode === 409 || error?.statusCode === 200) {
        this.knownBanks.add(bankId);
        return;
      }
      // Other errors: just mark as known to avoid retrying
      this.knownBanks.add(bankId);
      console.warn(`[MemoryService] Bank creation warning for ${bankId}: ${error?.message || error}`);
    }
  }

  // ─── Write (non-blocking) ──────────────────

  /**
   * Store user memory after an interaction. Fire-and-forget.
   */
  retainUserMemory(userId: string, conversation: string, sessionId?: string): void {
    if (!this.client) return;

    const bankId = `user-${userId}`;

    setImmediate(async () => {
      try {
        await this.ensureBank(bankId, {
          retainMission: 'Speichere Praeferenzen, Feedback und Arbeitsmuster dieses Mitarbeiters.',
          retainExtractionMode: 'concise',
          enableObservations: true,
        });

        await this.client!.retain(bankId, conversation, {
          timestamp: new Date(),
          tags: sessionId ? [`session-${sessionId}`] : undefined,
        });

        console.log(`[Memory] Retained user memory for ${bankId}`);
      } catch (error) {
        console.error(`[Memory] User retain failed (non-critical): ${error}`);
      }
    });
  }

  /**
   * Store expert agent memory after a task. Fire-and-forget.
   */
  retainAgentMemory(agentName: string, task: string, result: string): void {
    if (!this.client) return;

    const bankId = `agent-${agentName}`;

    setImmediate(async () => {
      try {
        await this.ensureBank(bankId, {
          retainMission: `Speichere domain-spezifische Fakten und Muster fuer den ${agentName} Expert Agent.`,
          retainExtractionMode: 'concise',
          enableObservations: true,
        });

        await this.client!.retain(bankId, `Task: ${task}\nResult: ${result}`, {
          timestamp: new Date(),
        });

        console.log(`[Memory] Retained agent memory for ${bankId}`);
      } catch (error) {
        console.error(`[Memory] Agent retain failed (non-critical): ${error}`);
      }
    });
  }

  // ─── Read (parallel, LLM-free) ─────────────

  /**
   * Load Hive Mind context: User Memory + Hive Mind Memory in parallel.
   * Returns formatted strings ready for system prompt injection.
   */
  async loadHiveMindContext(
    query: string,
    userId: string,
    orgId?: string,
  ): Promise<HiveMindContext> {
    if (!this.client) return { userMemory: '', hiveMindMemory: '' };

    const userBankId = `user-${userId}`;
    const hiveBankId = `hive-${orgId || 'default'}`;

    try {
      const [userResults, hiveResults] = await Promise.all([
        this.safeRecall(userBankId, query, memoryConfig.userRecallMaxTokens),
        this.safeRecall(hiveBankId, query, memoryConfig.hiveMindRecallMaxTokens),
      ]);

      return {
        userMemory: this.formatRecallResults(userResults),
        hiveMindMemory: this.formatRecallResults(hiveResults),
      };
    } catch (error) {
      console.warn(`[Memory] loadHiveMindContext failed (non-critical): ${error}`);
      return { userMemory: '', hiveMindMemory: '' };
    }
  }

  /**
   * Load Expert Agent memory context for a specific task.
   */
  async loadAgentContext(query: string, agentName: string): Promise<string> {
    if (!this.client) return '';

    const bankId = `agent-${agentName}`;

    try {
      const results = await this.safeRecall(bankId, query, memoryConfig.agentRecallMaxTokens);
      return this.formatRecallResults(results);
    } catch (error) {
      console.warn(`[Memory] loadAgentContext failed for ${agentName} (non-critical): ${error}`);
      return '';
    }
  }

  // ─── Reflect (for Heartbeat, later) ────────

  /**
   * Deep analysis using agent memory — for Heartbeat and pattern recognition.
   */
  async reflectAgent(agentName: string, question: string): Promise<string> {
    if (!this.client) return '';

    const bankId = `agent-${agentName}`;

    try {
      const result = await this.client.reflect(bankId, question, { budget: 'mid' });
      return result.text || '';
    } catch (error) {
      console.warn(`[Memory] reflectAgent failed for ${agentName}: ${error}`);
      return '';
    }
  }

  // ─── Health ────────────────────────────────

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${memoryConfig.url}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  // ─── Helpers ───────────────────────────────

  /**
   * Safe recall — returns null instead of throwing if bank doesn't exist.
   */
  private async safeRecall(
    bankId: string,
    query: string,
    maxTokens: number,
  ): Promise<RecallResponse | null> {
    try {
      return await this.client!.recall(bankId, query, {
        maxTokens,
        budget: memoryConfig.recallBudget,
      });
    } catch (error: any) {
      // Bank not found (404) is expected for new users/agents
      if (error?.statusCode === 404) return null;
      throw error;
    }
  }

  /**
   * Format recall results into a human-readable string for prompt injection.
   */
  private formatRecallResults(response: RecallResponse | null): string {
    if (!response?.results || response.results.length === 0) return '';

    return response.results
      .map(r => `- ${r.text}`)
      .join('\n');
  }
}

export const memoryService = new MemoryServiceImpl();
