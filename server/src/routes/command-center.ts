/**
 * Command Center Routes — Home view API
 */

import { Router, type Response } from 'express';
import { asyncHandler, authenticateToken } from '../middleware/index.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import { commandCenterService } from '../services/command-center/CommandCenterService.js';

const router = Router();

/**
 * GET /api/command-center/home — Get personalized home view data
 */
router.get('/home', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.user_id || '';
  const userName = req.user?.name || req.user?.email || 'User';
  const userRole = req.user?.role || 'Employee';

  const homeData = await commandCenterService.getHomeData(userId, userName, userRole);

  res.json(homeData);
}));

export default router;
