/**
 * Evaluation Routes - RAG Evaluation Framework API
 * Admin-only endpoints for managing golden dataset and running evaluations
 * Part of: Spec 1 - Foundation (Phase 0)
 */

import express, { type Response, type NextFunction } from 'express';
import { goldenDatasetService, evaluationService, embeddingBenchmark } from '../services/evaluation/index.js';
import { authService } from '../services/AuthService.js';
import { asyncHandler, authenticateToken } from '../middleware/index.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import type {
  CreateGoldenQueryRequest,
  UpdateGoldenQueryRequest,
  StartEvaluationRequest,
  QueryCategory,
} from '../types/evaluation.js';

const router = express.Router();

/**
 * Require Admin role for all evaluation endpoints
 */
const requireAdminRole = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user || req.user.role !== 'Admin') {
    if (req.user) {
      await authService.createAuditLog({
        userId: req.user.user_id,
        userEmail: req.user.email,
        action: 'evaluation_access_denied',
        result: 'denied',
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        metadata: { attemptedPath: req.path },
      });
    }

    res.status(403).json({
      error: 'Access denied',
      code: 'INSUFFICIENT_PERMISSIONS',
      message: 'Admin role required for evaluation operations',
    });
    return;
  }
  next();
};

// ===========================================
// Golden Dataset CRUD
// ===========================================

/**
 * GET /api/evaluation/golden-dataset
 * Get the full golden dataset with statistics
 */
router.get(
  '/golden-dataset',
  authenticateToken,
  requireAdminRole,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const dataset = await goldenDatasetService.getDataset();
    res.json({
      success: true,
      data: dataset,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * GET /api/evaluation/golden-dataset/stats
 * Get dataset statistics only
 */
router.get(
  '/golden-dataset/stats',
  authenticateToken,
  requireAdminRole,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const counts = await goldenDatasetService.getCountByCategory();
    const dataset = await goldenDatasetService.getDataset();
    res.json({
      success: true,
      data: {
        counts,
        statistics: dataset.statistics,
      },
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * GET /api/evaluation/golden-dataset/category/:category
 * Get queries by category
 */
router.get(
  '/golden-dataset/category/:category',
  authenticateToken,
  requireAdminRole,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const category = req.params.category as QueryCategory;
    const validCategories = [
      'factual',
      'comparative',
      'procedural',
      'relational',
      'aggregative',
      'multi_hop',
    ];

    if (!validCategories.includes(category)) {
      res.status(400).json({
        error: 'Invalid category',
        code: 'INVALID_CATEGORY',
        validCategories,
      });
      return;
    }

    const queries = await goldenDatasetService.getByCategory(category);
    res.json({
      success: true,
      data: queries,
      count: queries.length,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * GET /api/evaluation/golden-dataset/:id
 * Get a specific golden query
 */
router.get(
  '/golden-dataset/:id',
  authenticateToken,
  requireAdminRole,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'ID required', code: 'MISSING_ID' });
      return;
    }

    const query = await goldenDatasetService.getById(id);

    if (!query) {
      res.status(404).json({
        error: 'Query not found',
        code: 'QUERY_NOT_FOUND',
      });
      return;
    }

    res.json({
      success: true,
      data: query,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * POST /api/evaluation/golden-dataset
 * Create a new golden query
 */
router.post(
  '/golden-dataset',
  authenticateToken,
  requireAdminRole,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const request: CreateGoldenQueryRequest = req.body;

    // Validate required fields
    if (!request.query || !request.expectedAnswer || !request.category) {
      res.status(400).json({
        error: 'Missing required fields',
        code: 'VALIDATION_ERROR',
        required: ['query', 'expectedAnswer', 'category', 'relevantDocumentIds'],
      });
      return;
    }

    const query = await goldenDatasetService.createQuery(request, req.user?.user_id);

    // Log the creation
    if (req.user) {
      await authService.createAuditLog({
        userId: req.user.user_id,
        userEmail: req.user.email,
        action: 'golden_query_created',
        resourceType: 'golden_dataset',
        resourceId: query.id,
        result: 'success',
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        metadata: { category: query.category },
      });
    }

    res.status(201).json({
      success: true,
      data: query,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * POST /api/evaluation/golden-dataset/bulk
 * Bulk import golden queries
 */
router.post(
  '/golden-dataset/bulk',
  authenticateToken,
  requireAdminRole,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { queries } = req.body;

    if (!Array.isArray(queries) || queries.length === 0) {
      res.status(400).json({
        error: 'Invalid request',
        code: 'VALIDATION_ERROR',
        message: 'Request body must contain a non-empty "queries" array',
      });
      return;
    }

    const result = await goldenDatasetService.bulkImport(queries, req.user?.user_id);

    // Log the bulk import
    if (req.user) {
      await authService.createAuditLog({
        userId: req.user.user_id,
        userEmail: req.user.email,
        action: 'golden_queries_bulk_imported',
        resourceType: 'golden_dataset',
        result: 'success',
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        metadata: { imported: result.imported, errors: result.errors.length },
      });
    }

    res.status(201).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * PUT /api/evaluation/golden-dataset/:id
 * Update a golden query
 */
router.put(
  '/golden-dataset/:id',
  authenticateToken,
  requireAdminRole,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'ID required', code: 'MISSING_ID' });
      return;
    }

    const updates: UpdateGoldenQueryRequest = req.body;

    try {
      const query = await goldenDatasetService.updateQuery(id, updates);

      res.json({
        success: true,
        data: query,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'Query not found') {
        res.status(404).json({
          error: 'Query not found',
          code: 'QUERY_NOT_FOUND',
        });
        return;
      }
      throw error;
    }
  })
);

/**
 * DELETE /api/evaluation/golden-dataset/:id
 * Delete a golden query
 */
router.delete(
  '/golden-dataset/:id',
  authenticateToken,
  requireAdminRole,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'ID required', code: 'MISSING_ID' });
      return;
    }

    try {
      await goldenDatasetService.deleteQuery(id);

      // Log the deletion
      if (req.user) {
        await authService.createAuditLog({
          userId: req.user.user_id,
          userEmail: req.user.email,
          action: 'golden_query_deleted',
          resourceType: 'golden_dataset',
          resourceId: id,
          result: 'success',
          ipAddress: req.ip || req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
        });
      }

      res.status(204).send();
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'Query not found') {
        res.status(404).json({
          error: 'Query not found',
          code: 'QUERY_NOT_FOUND',
        });
        return;
      }
      throw error;
    }
  })
);

// ===========================================
// Evaluation Runs
// ===========================================

/**
 * POST /api/evaluation/run
 * Start a new evaluation run
 */
router.post(
  '/run',
  authenticateToken,
  requireAdminRole,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const request: StartEvaluationRequest = req.body;

    // Build config with defaults
    const config = {
      ragConfig: {
        embeddingModel: request.ragConfig?.embeddingModel || 'nomic-embed-text-v2-moe',
        rerankerEnabled: request.ragConfig?.rerankerEnabled || false,
        rerankerModel: request.ragConfig?.rerankerModel,
        searchLimit: request.ragConfig?.searchLimit || 20,
        hybridAlpha: request.ragConfig?.hybridAlpha || 0.5,
      },
      evaluateGeneration: request.evaluateGeneration !== false, // Default true
    };

    const runId = await evaluationService.startEvaluation(config, req.user?.user_id);

    // Log the evaluation start
    if (req.user) {
      await authService.createAuditLog({
        userId: req.user.user_id,
        userEmail: req.user.email,
        action: 'evaluation_run_started',
        resourceType: 'evaluation_run',
        resourceId: runId,
        result: 'success',
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        metadata: { config },
      });
    }

    res.status(202).json({
      success: true,
      data: {
        runId,
        status: 'started',
        message: 'Evaluation run started in background',
      },
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * GET /api/evaluation/runs
 * Get evaluation run history
 */
router.get(
  '/runs',
  authenticateToken,
  requireAdminRole,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const limit = parseInt(req.query.limit as string) || 20;
    const runs = await evaluationService.getRunHistory(limit);

    res.json({
      success: true,
      data: runs,
      count: runs.length,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * GET /api/evaluation/runs/:id
 * Get specific evaluation run status
 */
router.get(
  '/runs/:id',
  authenticateToken,
  requireAdminRole,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'ID required', code: 'MISSING_ID' });
      return;
    }

    const run = await evaluationService.getRunStatus(id);

    if (!run) {
      res.status(404).json({
        error: 'Run not found',
        code: 'RUN_NOT_FOUND',
      });
      return;
    }

    res.json({
      success: true,
      data: run,
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * GET /api/evaluation/runs/:id/results
 * Get detailed results for an evaluation run
 */
router.get(
  '/runs/:id/results',
  authenticateToken,
  requireAdminRole,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const id = req.params.id;
    if (!id) {
      res.status(400).json({ error: 'ID required', code: 'MISSING_ID' });
      return;
    }

    const run = await evaluationService.getRunStatus(id);

    if (!run) {
      res.status(404).json({
        error: 'Run not found',
        code: 'RUN_NOT_FOUND',
      });
      return;
    }

    const results = await evaluationService.getRunResults(id);

    res.json({
      success: true,
      data: {
        run,
        results,
      },
      timestamp: new Date().toISOString(),
    });
  })
);

/**
 * GET /api/evaluation/compare
 * Compare two evaluation runs
 */
router.get(
  '/compare',
  authenticateToken,
  requireAdminRole,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { run1, run2 } = req.query;

    if (!run1 || !run2) {
      res.status(400).json({
        error: 'Missing parameters',
        code: 'VALIDATION_ERROR',
        message: 'Both run1 and run2 query parameters are required',
      });
      return;
    }

    try {
      const comparison = await evaluationService.compareRuns(
        run1 as string,
        run2 as string
      );

      res.json({
        success: true,
        data: comparison,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      if (error instanceof Error && error.message === 'One or both runs not found') {
        res.status(404).json({
          error: 'Run not found',
          code: 'RUN_NOT_FOUND',
          message: error.message,
        });
        return;
      }
      throw error;
    }
  })
);

// ===========================================
// Embedding Benchmark
// ===========================================

/**
 * POST /api/evaluation/embedding-benchmark
 * Start an embedding benchmark run
 */
router.post(
  '/embedding-benchmark',
  authenticateToken,
  requireAdminRole,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { models } = req.body;

    // Log the benchmark start
    if (req.user) {
      await authService.createAuditLog({
        userId: req.user.user_id,
        userEmail: req.user.email,
        action: 'embedding_benchmark_started',
        resourceType: 'embedding_benchmark',
        result: 'success',
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
        metadata: { models: models || 'default' },
      });
    }

    // Start benchmark in background
    res.status(202).json({
      success: true,
      data: {
        status: 'started',
        message: 'Embedding benchmark started in background. Check /embedding-benchmark/history for results.',
      },
      timestamp: new Date().toISOString(),
    });

    // Run benchmark (non-blocking)
    embeddingBenchmark.runBenchmark(models).catch((error) => {
      console.error('Embedding benchmark failed:', error);
    });
  })
);

/**
 * GET /api/evaluation/embedding-benchmark/history
 * Get embedding benchmark history
 */
router.get(
  '/embedding-benchmark/history',
  authenticateToken,
  requireAdminRole,
  asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
    const history = await embeddingBenchmark.getBenchmarkHistory();
    const recommendation = embeddingBenchmark.getRecommendation(history);

    res.json({
      success: true,
      data: {
        history,
        recommendation,
      },
      timestamp: new Date().toISOString(),
    });
  })
);

export default router;
