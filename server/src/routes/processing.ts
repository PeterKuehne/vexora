/**
 * Processing Routes - Job status tracking
 */

import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../middleware/index.js';
import { ValidationError } from '../errors/index.js';
import { processingJobService } from '../services/ProcessingJobService.js';

const router = Router();

// Get processing job status
router.get('/:jobId', asyncHandler(async (req: Request, res: Response) => {
  const { jobId } = req.params
  const job = processingJobService.getJob(jobId || '')

  if (!job) {
    throw new ValidationError('Processing Job nicht gefunden', {
      field: 'jobId',
      details: ['Der angegebene Job existiert nicht'],
    })
  }

  res.json({
    success: true,
    job,
  })
}))

export default router;
