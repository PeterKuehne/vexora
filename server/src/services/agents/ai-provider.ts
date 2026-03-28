/**
 * AI Provider Setup - Vercel AI SDK 6
 *
 * Single provider: OVH AI Endpoints (EU-Cloud, gpt-oss-120b)
 * Embeddings remain on local Ollama (separate from this module).
 */

import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { LanguageModel } from 'ai';
import type { JSONObject } from '@ai-sdk/provider';

// OVH AI Endpoints provider (EU-Cloud, OpenAI-compatible)
const ovh = process.env.OVH_AI_API_KEY
  ? createOpenAICompatible({
      name: 'ovh',
      baseURL: process.env.OVH_AI_BASE_URL || 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1',
      apiKey: process.env.OVH_AI_API_KEY,
    })
  : null;

/**
 * Parse model string and return provider + model name.
 */
export function parseModelString(model: string): { provider: string; modelName: string } {
  if (model.startsWith('ovh:')) {
    return { provider: 'ovh', modelName: model.substring('ovh:'.length) };
  }
  return { provider: 'ovh', modelName: model };
}

/**
 * Resolve a model string to an AI SDK LanguageModel.
 */
export function resolveModel(modelString: string): LanguageModel {
  if (!ovh) {
    throw new Error('OVH AI provider nicht verfügbar (OVH_AI_API_KEY fehlt)');
  }
  const { modelName } = parseModelString(modelString);
  return ovh.chatModel(modelName);
}

/**
 * Check if a provider is available
 */
export function hasProvider(name: string): boolean {
  if (name === 'ovh') return ovh !== null;
  return false;
}

/**
 * Check if a model string refers to a cloud provider (always true now)
 */
export function isCloudModel(_modelString: string): boolean {
  return true;
}

/**
 * Provider options for the OVH model
 */
export function getProviderOptions(_modelString: string): Record<string, JSONObject> {
  return { openaiCompatible: { reasoning_effort: 'low' } as JSONObject };
}

/**
 * Cloud model definition
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
];

/**
 * Get available cloud models
 */
export function getCloudModels(): CloudModel[] {
  return ovh ? [...CLOUD_MODELS] : [];
}

/**
 * Estimate cost in EUR based on token usage
 */
export function estimateCost(modelString: string, inputTokens: number, outputTokens: number): number | null {
  const model = CLOUD_MODELS.find(m => m.id === modelString);
  if (!model) return null;
  return (inputTokens / 1_000_000) * model.inputPricePerMTok + (outputTokens / 1_000_000) * model.outputPricePerMTok;
}
