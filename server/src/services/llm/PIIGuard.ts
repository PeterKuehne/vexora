/**
 * PIIGuard - Presidio HTTP Client for PII masking/unmasking
 *
 * Uses Microsoft Presidio (Analyzer + Anonymizer) running on Ubuntu server
 * to detect and mask PII before sending to cloud LLM providers.
 */

import type { ChatMessage } from './LLMProvider.js';

interface PresidioEntity {
  entity_type: string;
  start: number;
  end: number;
  score: number;
}

interface AnonymizeResult {
  text: string;
  items: Array<{
    anonymizer: string;
    entity_type: string;
    start: number;
    end: number;
    text: string;
  }>;
}

export class PIIGuard {
  private analyzerUrl: string;
  private anonymizerUrl: string;
  private tokenMap: Map<string, string> = new Map();
  private enabled: boolean;
  private minConfidence: number;
  private tokenCounter = 0;
  private lastHealthCheck: { ok: boolean; timestamp: number } | null = null;
  private healthCheckInterval = 30000; // 30 seconds

  constructor() {
    this.analyzerUrl = process.env.PRESIDIO_ANALYZER_URL || 'http://192.168.2.38:8003';
    this.anonymizerUrl = process.env.PRESIDIO_ANONYMIZER_URL || 'http://192.168.2.38:8004';
    this.enabled = process.env.PII_GUARD_ENABLED !== 'false';
    this.minConfidence = parseFloat(process.env.PII_MIN_CONFIDENCE || '0.7');
  }

  /**
   * Check if PII Guard is available (Presidio services reachable)
   */
  async isAvailable(): Promise<boolean> {
    if (!this.enabled) return true; // If disabled, always "available" (pass-through)

    // Cache health check result
    const now = Date.now();
    if (this.lastHealthCheck && (now - this.lastHealthCheck.timestamp) < this.healthCheckInterval) {
      return this.lastHealthCheck.ok;
    }

    try {
      const [analyzerHealth, anonymizerHealth] = await Promise.all([
        fetch(`${this.analyzerUrl}/health`, { signal: AbortSignal.timeout(5000) }),
        fetch(`${this.anonymizerUrl}/health`, { signal: AbortSignal.timeout(5000) }),
      ]);

      const ok = analyzerHealth.ok && anonymizerHealth.ok;
      this.lastHealthCheck = { ok, timestamp: now };
      return ok;
    } catch {
      this.lastHealthCheck = { ok: false, timestamp: now };
      return false;
    }
  }

  /**
   * Mask PII in messages before sending to cloud LLM
   */
  async mask(messages: ChatMessage[]): Promise<ChatMessage[]> {
    if (!this.enabled) return messages;

    this.tokenMap = new Map();
    this.tokenCounter = 0;

    return Promise.all(messages.map(async (msg) => {
      if (msg.role === 'system') {
        // Don't mask system prompts (they don't contain user PII)
        return msg;
      }

      try {
        // 1. Analyze: Detect PII entities
        const entities = await this.analyze(msg.content);

        if (entities.length === 0) {
          return msg;
        }

        // 2. Build token replacements (sorted by position, reverse to preserve indices)
        const sortedEntities = [...entities].sort((a, b) => b.start - a.start);

        let maskedContent = msg.content;
        for (const entity of sortedEntities) {
          const originalValue = msg.content.substring(entity.start, entity.end);
          const token = this.generateToken(entity.entity_type);

          this.tokenMap.set(token, originalValue);
          maskedContent = maskedContent.substring(0, entity.start) + token + maskedContent.substring(entity.end);
        }

        return { ...msg, content: maskedContent };
      } catch (error) {
        console.warn('[PIIGuard] Masking failed for message, passing through:', error);
        return msg;
      }
    }));
  }

  /**
   * Unmask PII tokens in response content
   */
  unmask(content: string): string {
    if (!this.enabled || this.tokenMap.size === 0) return content;

    let unmasked = content;
    for (const [token, original] of this.tokenMap) {
      unmasked = unmasked.replaceAll(token, original);
    }
    return unmasked;
  }

  /**
   * Get current token map (for debugging)
   */
  getTokenMap(): Map<string, string> {
    return new Map(this.tokenMap);
  }

  private generateToken(entityType: string): string {
    this.tokenCounter++;
    return `<${entityType}_${this.tokenCounter}>`;
  }

  private async analyze(text: string): Promise<PresidioEntity[]> {
    const response = await fetch(`${this.analyzerUrl}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        language: 'de',
        score_threshold: this.minConfidence,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Presidio Analyzer error: HTTP ${response.status}`);
    }

    return response.json() as Promise<PresidioEntity[]>;
  }
}
