/**
 * Ollama Routes - Protected direct access to Ollama API
 */

import { Router, type Response } from 'express';
import { asyncHandler, authenticateToken } from '../middleware/index.js';
import { ValidationError } from '../errors/index.js';
import {
  modelQuerySchema,
  validate,
  formatValidationErrors,
  type ModelQuery,
} from '../validation/index.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import { ollamaService } from '../services/index.js';

const router = Router();

// Protected models list
router.get('/models', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const queryValidation = validate(modelQuerySchema, req.query)
  if (!queryValidation.success) {
    throw new ValidationError(formatValidationErrors(queryValidation.errors), {
      field: 'query',
      details: queryValidation.errors,
    })
  }
  const query: ModelQuery = queryValidation.data

  try {
    const result = await ollamaService.getModels({
      search: query.search,
      family: query.family,
    })

    res.json({
      success: true,
      models: result.models,
      defaultModel: ollamaService.getDefaultModel(),
      totalCount: result.totalCount,
      userContext: {
        role: req.user!.role,
        department: req.user!.department,
      }
    })
  } catch (error) {
    console.error('Ollama models failed:', error)
    res.status(500).json({
      error: 'Failed to get models',
      code: 'OLLAMA_MODELS_ERROR',
      message: 'Failed to retrieve Ollama models'
    })
  }
}))

// Protected health check
router.get('/health', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ollamaHealth = await ollamaService.healthCheck(5000)

    const healthStatus = {
      success: true,
      status: ollamaHealth.status,
      url: ollamaHealth.url,
      defaultModel: ollamaHealth.defaultModel,
      availableModels: ollamaHealth.availableModels,
      error: ollamaHealth.error,
      userContext: {
        role: req.user!.role,
        department: req.user!.department,
      }
    }

    const httpStatus = ollamaHealth.status === 'ok' ? 200 : 503
    res.status(httpStatus).json(healthStatus)
  } catch (error) {
    console.error('Ollama health check failed:', error)
    res.status(500).json({
      error: 'Health check failed',
      code: 'OLLAMA_HEALTH_ERROR',
      message: 'Failed to check Ollama health'
    })
  }
}))

// Direct Ollama chat
router.post('/chat', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { messages, model, options } = req.body

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({
      error: 'Messages array is required',
      code: 'MISSING_MESSAGES',
      message: 'Messages field must be provided as a non-empty array'
    })
    return
  }

  try {
    const response = await ollamaService.chat({
      messages,
      model: model || 'qwen3:8b',
      options,
    })

    res.json({
      success: true,
      ...response,
      userContext: {
        role: req.user!.role,
        department: req.user!.department,
      }
    })
  } catch (error) {
    console.error('Ollama chat failed:', error)
    res.status(500).json({
      error: 'Ollama chat failed',
      code: 'OLLAMA_CHAT_ERROR',
      message: 'Failed to get Ollama chat response'
    })
  }
}))

export default router;
