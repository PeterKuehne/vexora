/**
 * AI Provider Setup - Vercel AI SDK 6
 *
 * Unified model resolution for Anthropic and Ollama providers.
 * Replaces the custom LLMRouter for model resolution and routing.
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import { createOllama } from 'ollama-ai-provider-v2';
import type { LanguageModel } from 'ai';
import type { JSONObject } from '@ai-sdk/provider';

// Ollama provider (always available)
const ollama = createOllama({
  baseURL: (process.env.OLLAMA_API_URL || 'http://localhost:11434') + '/api',
});

// Anthropic provider (only if API key is set)
const anthropic = process.env.ANTHROPIC_API_KEY
  ? createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

/**
 * Parse model string and return provider + model name.
 * Compatible with existing LLMRouter.parseModel() format.
 *
 * "anthropic:claude-sonnet-4-6" → { provider: "anthropic", modelName: "claude-sonnet-4-6" }
 * "ollama:qwen3:8b"            → { provider: "ollama", modelName: "qwen3:8b" }
 * "qwen3:8b"                   → { provider: "ollama", modelName: "qwen3:8b" }
 */
export function parseModelString(model: string): { provider: string; modelName: string } {
  if (model.startsWith('anthropic:')) {
    return { provider: 'anthropic', modelName: model.substring('anthropic:'.length) };
  }
  if (model.startsWith('ollama:')) {
    return { provider: 'ollama', modelName: model.substring('ollama:'.length) };
  }
  // Default to ollama
  return { provider: 'ollama', modelName: model };
}

/**
 * Resolve a model string to an AI SDK LanguageModel.
 *
 * @param modelString - e.g. "anthropic:claude-sonnet-4-6" or "qwen3:8b"
 */
export function resolveModel(modelString: string): LanguageModel {
  const { provider, modelName } = parseModelString(modelString);

  if (provider === 'anthropic') {
    if (!anthropic) {
      throw new Error('Anthropic provider nicht verfügbar (ANTHROPIC_API_KEY fehlt)');
    }
    return anthropic(modelName);
  }

  // Ollama
  return ollama(modelName);
}

/**
 * Check if a provider is available
 */
export function hasProvider(name: string): boolean {
  if (name === 'ollama') return true;
  if (name === 'anthropic') return anthropic !== null;
  return false;
}

/**
 * Check if a model string refers to a cloud provider
 */
export function isCloudModel(modelString: string): boolean {
  const { provider } = parseModelString(modelString);
  return provider === 'anthropic';
}

/**
 * Default provider options for Ollama models (disable thinking for tool calling)
 */
export function getProviderOptions(modelString: string): Record<string, JSONObject> {
  const { provider } = parseModelString(modelString);
  if (provider === 'ollama') {
    return { ollama: { think: false } };
  }
  return {};
}

/**
 * Cloud model definitions with pricing (replaces AnthropicProvider.ANTHROPIC_MODELS)
 */
export interface CloudModel {
  id: string;
  name: string;
  provider: string;
  isCloud: boolean;
  contextWindow: number;
  inputPricePerMTok: number;
  outputPricePerMTok: number;
}

const CLOUD_MODELS: CloudModel[] = [
  {
    id: 'anthropic:claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    isCloud: true,
    contextWindow: 200000,
    inputPricePerMTok: 3.0,
    outputPricePerMTok: 15.0,
  },
  {
    id: 'anthropic:claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    isCloud: true,
    contextWindow: 200000,
    inputPricePerMTok: 0.80,
    outputPricePerMTok: 4.0,
  },
];

/**
 * Get cloud model definitions (for models route)
 */
export function getCloudModels(): CloudModel[] {
  if (!anthropic) return [];
  return CLOUD_MODELS;
}
