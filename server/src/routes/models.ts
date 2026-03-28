/**
 * Models Routes - List available LLM and embedding models
 */

import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../middleware/index.js';
import { ollamaService } from '../services/index.js';
import { getCloudModels } from '../services/agents/ai-provider.js';
import { env } from '../config/env.js';

const router = Router();

// List available models (cloud only for LLM, local for embeddings)
router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const cloudModels = getCloudModels().map(m => ({
    id: m.id,
    name: m.name,
    provider: m.provider,
    isCloud: m.isCloud,
    contextWindow: m.contextWindow,
    inputPricePerMTok: m.inputPricePerMTok,
    outputPricePerMTok: m.outputPricePerMTok,
  }));

  res.json({
    models: [],
    cloudModels,
    defaultModel: env.MODEL,
    totalCount: cloudModels.length,
  });
}));

// List embedding models (Ollama only — embeddings stay local)
router.get('/embedding', asyncHandler(async (_req: Request, res: Response) => {
  const result = await ollamaService.getModels({});

  const embeddingModels = result.models.filter((model) => {
    const nameLC = model.id.toLowerCase();
    return (
      nameLC.includes('embed') ||
      nameLC.includes('nomic') ||
      nameLC.includes('mxbai') ||
      nameLC.includes('bge') ||
      nameLC.includes('gte') ||
      nameLC.includes('e5')
    );
  });

  const defaultEmbedding = embeddingModels.find(m => m.id.includes('nomic-embed'))
    || embeddingModels[0]
    || null;

  res.json({
    models: embeddingModels,
    defaultModel: defaultEmbedding?.id || null,
    totalCount: embeddingModels.length,
  });
}));

export default router;
