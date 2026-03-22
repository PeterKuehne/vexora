/**
 * AI SDK Middleware - PII Guard integration
 *
 * Provides PII masking for cloud LLM calls.
 * Uses the existing PIIGuard service (Presidio-based).
 *
 * Note: Instead of wrapLanguageModel (which requires LanguageModelV3),
 * we apply PII masking at the message level before calling generateText/streamText.
 * This is simpler and works with any model type the AI SDK supports.
 */

import type { LanguageModel } from 'ai';
import type { PIIGuard } from '../llm/PIIGuard.js';

// Module-level PII Guard instance (set during initialization)
let piiGuard: PIIGuard | null = null;

/**
 * Set the PII Guard instance (called during server startup)
 */
export function setPIIGuard(guard: PIIGuard): void {
  piiGuard = guard;
}

/**
 * Get the current PII Guard instance
 */
export function getPIIGuard(): PIIGuard | null {
  return piiGuard;
}

/**
 * Ensure PII Guard is available for cloud models.
 * Throws if PII protection is required but unavailable.
 */
export async function ensurePIIGuardAvailable(isCloud: boolean): Promise<void> {
  if (!isCloud) return;

  if (!piiGuard) {
    // No PII guard configured — allow cloud calls without masking
    // (this matches the behavior in index.ts where PII guard failure is a warning)
    return;
  }

  if (!await piiGuard.isAvailable()) {
    throw new Error('PII-Schutz nicht erreichbar (Presidio offline). Cloud-Modelle temporär deaktiviert.');
  }
}

/**
 * Mask messages for cloud provider calls.
 * Returns original messages unchanged for local models.
 */
export async function maskMessages(
  messages: Array<{ role: string; content: string }>,
  isCloud: boolean,
): Promise<Array<{ role: string; content: string }>> {
  if (!isCloud || !piiGuard) return messages;

  return piiGuard.mask(messages as any) as any;
}

/**
 * Unmask PII tokens in a response string.
 */
export function unmaskContent(content: string, isCloud: boolean): string {
  if (!isCloud || !piiGuard) return content;
  return piiGuard.unmask(content);
}

/**
 * Passthrough function — returns the model as-is.
 * PII masking is applied at the message level, not the model level.
 * This function exists for API compatibility with callers that expect a "guarded" model.
 */
export function createGuardedModel(model: LanguageModel, _isCloud: boolean): LanguageModel {
  return model;
}
