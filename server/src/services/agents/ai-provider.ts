/**
 * AI Provider Setup - Vercel AI SDK 6
 *
 * Unified model resolution for Ollama, Anthropic, Mistral, and OVH providers.
 * Supports local (Ollama) and EU-Cloud model tiers.
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import { createMistral } from '@ai-sdk/mistral';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
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

// Mistral provider (EU-Cloud, Paris — only if API key is set)
const mistral = process.env.MISTRAL_API_KEY
  ? createMistral({ apiKey: process.env.MISTRAL_API_KEY })
  : null;

// OVH AI Endpoints provider (EU-Cloud, OpenAI-compatible — only if API key is set)
const ovh = process.env.OVH_AI_API_KEY
  ? createOpenAICompatible({
      name: 'ovh',
      baseURL: process.env.OVH_AI_BASE_URL || 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1',
      apiKey: process.env.OVH_AI_API_KEY,
    })
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
  if (model.startsWith('mistral:')) {
    return { provider: 'mistral', modelName: model.substring('mistral:'.length) };
  }
  if (model.startsWith('ovh:')) {
    return { provider: 'ovh', modelName: model.substring('ovh:'.length) };
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

  if (provider === 'mistral') {
    if (!mistral) {
      throw new Error('Mistral provider nicht verfügbar (MISTRAL_API_KEY fehlt)');
    }
    return mistral(modelName);
  }

  if (provider === 'ovh') {
    if (!ovh) {
      throw new Error('OVH AI provider nicht verfügbar (OVH_AI_API_KEY fehlt)');
    }
    return ovh.chatModel(modelName);
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
  if (name === 'mistral') return mistral !== null;
  if (name === 'ovh') return ovh !== null;
  return false;
}

/**
 * Check if a model string refers to a cloud provider
 */
export function isCloudModel(modelString: string): boolean {
  const { provider } = parseModelString(modelString);
  return provider === 'anthropic' || provider === 'mistral' || provider === 'ovh';
}

/**
 * Default provider options for Ollama models (disable thinking for tool calling)
 */
export function getProviderOptions(modelString: string): Record<string, JSONObject> {
  const { provider } = parseModelString(modelString);
  if (provider === 'ollama') {
    return { ollama: { think: false } };
  }
  if (provider === 'ovh') {
    // gpt-oss-120b is a reasoning model — use low effort for tool-calling tasks
    // to avoid excessive thinking time on large contexts
    return { openaiCompatible: { reasoning_effort: 'low' } as JSONObject };
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
    id: 'ovh:gpt-oss-120b',
    name: 'GPT-OSS 120B',
    provider: 'ovh',
    isCloud: true,
    contextWindow: 131000,
    inputPricePerMTok: 0.08,
    outputPricePerMTok: 0.40,
  },
  {
    id: 'mistral:mistral-large-latest',
    name: 'Mistral Large',
    provider: 'mistral',
    isCloud: true,
    contextWindow: 128000,
    inputPricePerMTok: 2.0,
    outputPricePerMTok: 6.0,
  },
  {
    id: 'mistral:mistral-small-latest',
    name: 'Mistral Small',
    provider: 'mistral',
    isCloud: true,
    contextWindow: 128000,
    inputPricePerMTok: 0.2,
    outputPricePerMTok: 0.6,
  },
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
  const models: CloudModel[] = [];
  if (ovh) models.push(...CLOUD_MODELS.filter(m => m.provider === 'ovh'));
  if (mistral) models.push(...CLOUD_MODELS.filter(m => m.provider === 'mistral'));
  if (anthropic) models.push(...CLOUD_MODELS.filter(m => m.provider === 'anthropic'));
  return models;
}

/**
 * Estimate cost in EUR for a cloud model based on token usage
 */
export function estimateCost(modelString: string, inputTokens: number, outputTokens: number): number | null {
  const model = CLOUD_MODELS.find(m => m.id === modelString);
  if (!model) return null;
  return (inputTokens / 1_000_000) * model.inputPricePerMTok + (outputTokens / 1_000_000) * model.outputPricePerMTok;
}
