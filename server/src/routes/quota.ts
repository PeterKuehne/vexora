/**
 * Quota API Routes - Storage Quota Management
 *
 * Endpoints:
 * - GET /api/quota/me - Get current user's quota usage
 * - POST /api/quota/validate - Validate file upload against quota
 * - GET /api/quota/statistics - Get system-wide quota statistics (Admin only)
 */

import express, { type Response } from 'express';
import { quotaService, type QuotaValidationResult } from '../services/QuotaService.js';
import { authenticateToken, requireRole } from '../middleware/index.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import { z } from 'zod';

const router = express.Router();

// Validation schemas
const validateUploadSchema = z.object({
  fileSize: z.number().positive().max(150 * 1024 * 1024), // 150MB max
});

/**
 * GET /api/quota/me
 * Get current user's quota usage
 */
router.get('/me', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = req.user!;
    const usage = await quotaService.getUserQuotaUsage(user.user_id, user.role);

    res.json({
      success: true,
      usage
    });
  } catch (error) {
    console.error('Error getting quota usage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get quota usage'
    });
  }
});

/**
 * POST /api/quota/validate
 * Validate if a file upload would exceed quota
 */
router.post('/validate', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Validate request body
    const { fileSize } = validateUploadSchema.parse(req.body);

    const user = req.user!;
    const validation = await quotaService.validateUpload(user.user_id, user.role, fileSize);

    res.json({
      success: true,
      validation
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.issues
      });
      return;
    }

    console.error('Error validating upload:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate upload'
    });
  }
});

/**
 * GET /api/quota/statistics
 * Get system-wide quota statistics (Admin only)
 */
router.get('/statistics', authenticateToken, requireRole('Admin'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const statistics = await quotaService.getQuotaStatistics();

    res.json({
      success: true,
      statistics
    });
  } catch (error) {
    console.error('Error getting quota statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get quota statistics'
    });
  }
});

export default router;