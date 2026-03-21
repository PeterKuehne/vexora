/**
 * LLMRouter - Routes requests to the appropriate LLM provider based on model prefix
 *
 * Model naming convention:
 *   "anthropic:claude-sonnet-4-6" → AnthropicProvider with model "claude-sonnet-4-6"
 *   "ollama:qwen3:8b"            → OllamaProvider with model "qwen3:8b"
 *   "qwen3:8b"                   → OllamaProvider (default, no prefix)
 */

import type {
  LLMProvider,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  LLMModel,
  HealthCheckResult,
} from './LLMProvider.js';
import { OllamaProvider } from './OllamaProvider.js';
import { AnthropicProvider } from './AnthropicProvider.js';
import type { PIIGuard } from './PIIGuard.js';
import { databaseService } from '../DatabaseService.js';

export interface UsageLogEntry {
  userId?: string;
  conversationId?: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  piiMasked: boolean;
}

export class LLMRouter {
  private providers: Map<string, LLMProvider> = new Map();
  private piiGuard: PIIGuard | null = null;
  private defaultProvider = 'ollama';

  constructor() {
    // Always register Ollama
    this.providers.set('ollama', new OllamaProvider());

    // Register Anthropic if API key is available
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      this.providers.set('anthropic', new AnthropicProvider(anthropicKey));
      console.log('[LLMRouter] Anthropic provider registered');
    }
  }

  /**
   * Set PII Guard for cloud provider calls
   */
  setPIIGuard(guard: PIIGuard): void {
    this.piiGuard = guard;
  }

  /**
   * Chat with tools - applies PII guard + usage logging, returns tool calls
   */
  async chatWithTools(
    messages: ChatMessage[],
    model: string,
    options?: ChatOptions,
    userId?: string,
    conversationId?: string,
  ): Promise<ChatResponse> {
    const { provider, modelName } = this.parseModel(model);
    const llmProvider = this.getProvider(provider);
    const isCloud = provider !== 'ollama';

    // PII Guard for cloud providers
    let processedMessages = messages;
    if (isCloud) {
      if (!this.piiGuard) {
        throw new Error('PII-Schutz nicht konfiguriert. Cloud-Modelle sind ohne PII Guard nicht verfügbar.');
      }
      if (!await this.piiGuard.isAvailable()) {
        throw new Error('PII-Schutz nicht erreichbar (Presidio offline). Cloud-Modelle temporär deaktiviert.');
      }
      processedMessages = await this.piiGuard.mask(messages);
    }

    const response = await llmProvider.chat(processedMessages, modelName, options);

    // Unmask PII in response
    if (isCloud && this.piiGuard) {
      response.content = this.piiGuard.unmask(response.content);
    }

    // Log usage for cloud providers
    if (isCloud) {
      await this.logUsage(provider, modelName, response, userId, conversationId);
    }

    return response;
  }

  /**
   * Non-streaming chat
   */
  async chat(messages: ChatMessage[], model: string, options?: ChatOptions): Promise<ChatResponse> {
    const { provider, modelName } = this.parseModel(model);
    const llmProvider = this.getProvider(provider);
    const isCloud = provider !== 'ollama';

    // PII Guard for cloud providers - MUST be available for cloud calls
    let processedMessages = messages;
    if (isCloud) {
      if (!this.piiGuard) {
        throw new Error('PII-Schutz nicht konfiguriert. Cloud-Modelle sind ohne PII Guard nicht verfügbar.');
      }
      if (!await this.piiGuard.isAvailable()) {
        throw new Error('PII-Schutz nicht erreichbar (Presidio offline). Cloud-Modelle temporär deaktiviert. Lokale Modelle funktionieren weiterhin.');
      }
      processedMessages = await this.piiGuard.mask(messages);
    }

    const response = await llmProvider.chat(processedMessages, modelName, options);

    // Unmask PII in response
    if (isCloud && this.piiGuard) {
      response.content = this.piiGuard.unmask(response.content);
    }

    // Log usage for cloud providers
    if (isCloud) {
      await this.logUsage(provider, modelName, response);
    }

    return response;
  }

  /**
   * Streaming chat - returns AsyncIterable<string> for all providers
   */
  async chatStream(messages: ChatMessage[], model: string, options?: ChatOptions): Promise<AsyncIterable<string>> {
    const { provider, modelName } = this.parseModel(model);
    const llmProvider = this.getProvider(provider);
    const isCloud = provider !== 'ollama';

    // PII Guard for cloud providers - MUST be available for cloud calls
    let processedMessages = messages;
    if (isCloud) {
      if (!this.piiGuard) {
        throw new Error('PII-Schutz nicht konfiguriert. Cloud-Modelle sind ohne PII Guard nicht verfügbar.');
      }
      if (!await this.piiGuard.isAvailable()) {
        throw new Error('PII-Schutz nicht erreichbar (Presidio offline). Cloud-Modelle temporär deaktiviert.');
      }
      processedMessages = await this.piiGuard.mask(messages);
    }

    return llmProvider.chatStream(processedMessages, modelName, options);
  }

  /**
   * Get raw Ollama streaming response (backward compat for existing SSE code)
   */
  async chatStreamRaw(messages: ChatMessage[], model: string, options?: ChatOptions): Promise<Response> {
    const { provider, modelName } = this.parseModel(model);

    if (provider === 'ollama') {
      const ollamaProvider = this.providers.get('ollama') as OllamaProvider;
      return ollamaProvider.chatStreamRaw(messages, modelName, options);
    }

    throw new Error(`Raw streaming not supported for provider: ${provider}`);
  }

  /**
   * List all models from all providers
   */
  async getModels(): Promise<LLMModel[]> {
    const allModels: LLMModel[] = [];

    for (const [, provider] of this.providers) {
      try {
        const models = await provider.getModels();
        allModels.push(...models);
      } catch (error) {
        console.warn(`[LLMRouter] Failed to get models from ${provider.providerName}:`, error);
      }
    }

    return allModels;
  }

  /**
   * Health check all providers
   */
  async healthCheck(): Promise<Record<string, HealthCheckResult>> {
    const results: Record<string, HealthCheckResult> = {};

    for (const [name, provider] of this.providers) {
      try {
        results[name] = await provider.healthCheck();
      } catch (error) {
        results[name] = {
          ok: false,
          provider: name,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    return results;
  }

  /**
   * Check if a provider is available
   */
  hasProvider(name: string): boolean {
    return this.providers.has(name);
  }

  /**
   * Parse model string into provider + model name
   * "anthropic:claude-sonnet-4-6" → { provider: "anthropic", modelName: "claude-sonnet-4-6" }
   * "ollama:qwen3:8b"            → { provider: "ollama", modelName: "qwen3:8b" }
   * "qwen3:8b"                   → { provider: "ollama", modelName: "qwen3:8b" }
   */
  parseModel(model: string): { provider: string; modelName: string } {
    // Check for known provider prefixes
    for (const providerName of this.providers.keys()) {
      const prefix = `${providerName}:`;
      if (model.startsWith(prefix)) {
        return {
          provider: providerName,
          modelName: model.substring(prefix.length),
        };
      }
    }

    // No recognized prefix → default to ollama
    return {
      provider: this.defaultProvider,
      modelName: model,
    };
  }

  private getProvider(name: string): LLMProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`LLM Provider "${name}" nicht verfügbar`);
    }
    return provider;
  }

  private async logUsage(provider: string, model: string, response: ChatResponse, userId?: string, conversationId?: string): Promise<void> {
    try {
      const inputTokens = response.inputTokens ?? 0;
      const outputTokens = response.outputTokens ?? 0;

      // Calculate cost based on model pricing
      const modelInfo = (await this.getModels()).find(
        m => m.provider === provider && m.id === `${provider}:${model}`
      );

      let costUsd = 0;
      if (modelInfo?.inputPricePerMTok && modelInfo?.outputPricePerMTok) {
        costUsd = (inputTokens / 1_000_000) * modelInfo.inputPricePerMTok
          + (outputTokens / 1_000_000) * modelInfo.outputPricePerMTok;
      }

      // Log to database
      await databaseService.query(
        `INSERT INTO api_usage_log (provider, model, input_tokens, output_tokens, cost_usd, pii_masked)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [provider, model, inputTokens, outputTokens, costUsd, this.piiGuard !== null]
      );
    } catch (error) {
      // Don't fail the request if usage logging fails
      console.warn('[LLMRouter] Failed to log API usage:', error);
    }
  }
}

// Singleton instance
export const llmRouter = new LLMRouter();
