/**
 * Hindsight Memory Configuration
 */

export const memoryConfig = {
  /** Hindsight server URL (via SSH tunnel from Hetzner) */
  url: process.env.HINDSIGHT_URL || 'http://localhost:8888',

  /** Whether memory system is enabled */
  enabled: !!process.env.HINDSIGHT_URL,

  /** Max tokens for user memory recall */
  userRecallMaxTokens: 2000,

  /** Max tokens for hive mind memory recall */
  hiveMindRecallMaxTokens: 4000,

  /** Max tokens for agent memory recall */
  agentRecallMaxTokens: 3000,

  /** Recall budget (low/mid/high) — affects retrieval depth */
  recallBudget: 'mid' as const,
};
