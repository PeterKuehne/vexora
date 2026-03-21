/**
 * Models Routes - List available LLM and embedding models
 * Now includes both Ollama (local) and Anthropic (cloud) models via LLMRouter
 */

import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../middleware/index.js';
import { ValidationError } from '../errors/index.js';
import {
  modelQuerySchema,
  validate,
  formatValidationErrors,
  type ModelQuery,
} from '../validation/index.js';
import { ollamaService } from '../services/index.js';
import { llmRouter } from '../services/llm/index.js';

const router = Router();

// List all available models (Ollama + Anthropic)
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const queryValidation = validate(modelQuerySchema, req.query)
  if (!queryValidation.success) {
    throw new ValidationError(formatValidationErrors(queryValidation.errors), {
      field: 'query',
      details: queryValidation.errors,
    })
  }
  const query: ModelQuery = queryValidation.data

  // Get Ollama models (existing behavior)
  const ollamaResult = await ollamaService.getModels({
    search: query.search,
    family: query.family,
  })

  // Get cloud models from LLMRouter
  let cloudModels: Array<{
    id: string;
    name: string;
    provider: string;
    isCloud: boolean;
    contextWindow: number;
    inputPricePerMTok?: number;
    outputPricePerMTok?: number;
  }> = [];

  if (llmRouter.hasProvider('anthropic')) {
    try {
      const allModels = await llmRouter.getModels();
      cloudModels = allModels
        .filter(m => m.isCloud)
        .filter(m => {
          if (!query.search) return true;
          const searchLower = query.search.toLowerCase();
          return m.id.toLowerCase().includes(searchLower) || m.name.toLowerCase().includes(searchLower);
        })
        .map(m => ({
          id: m.id,
          name: m.name,
          provider: m.provider,
          isCloud: m.isCloud,
          contextWindow: m.contextWindow,
          inputPricePerMTok: m.inputPricePerMTok,
          outputPricePerMTok: m.outputPricePerMTok,
        }));
    } catch {
      // Cloud models unavailable - continue with Ollama only
    }
  }

  res.json({
    models: ollamaResult.models,
    cloudModels,
    defaultModel: ollamaService.getDefaultModel(),
    totalCount: ollamaResult.totalCount + cloudModels.length,
  })
}))

// List embedding models (Ollama only - embeddings stay local)
router.get('/embedding', asyncHandler(async (_req: Request, res: Response) => {
  const result = await ollamaService.getModels({})

  const embeddingModels = result.models.filter((model) => {
    const nameLC = model.id.toLowerCase()
    const familyLC = model.family.toLowerCase()

    return (
      nameLC.includes('embed') ||
      nameLC.includes('nomic') ||
      nameLC.includes('mxbai') ||
      nameLC.includes('bge') ||
      nameLC.includes('gte') ||
      nameLC.includes('e5') ||
      familyLC === 'bert' ||
      familyLC === 'nomic-bert'
    )
  })

  const defaultEmbedding = embeddingModels.find(m => m.id.includes('nomic-embed'))
    || embeddingModels[0]
    || null

  res.json({
    models: embeddingModels,
    defaultModel: defaultEmbedding?.id || null,
    totalCount: embeddingModels.length,
  })
}))

export default router;
