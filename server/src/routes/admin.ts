/**
 * Admin Routes - User Management for Administrators
 */

import express, { type Request, type Response } from 'express';
import { authService } from '../services/AuthService.js';
import { asyncHandler, authenticateToken } from '../middleware/index.js';
import { ValidationError } from '../errors/index.js';
import type { AuthenticatedRequest, UserRole, UpdateUserPayload } from '../types/auth.js';

const router = express.Router();

/**
 * Check if user has Admin role
 */
const requireAdminRole = (req: AuthenticatedRequest, res: Response, next: any) => {
  if (!req.user || req.user.role !== 'Admin') {
    return res.status(403).json({
      error: 'Access denied',
      code: 'INSUFFICIENT_PERMISSIONS',
      message: 'Admin role required for user management operations'
    });
  }
  next();
};

/**
 * GET /api/admin/users
 * Get all users (Admin only)
 */
router.get('/users', authenticateToken, requireAdminRole, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const users = await authService.getAllUsers();
    const stats = await authService.getUserStatistics();

    const userContext = req.user ? {
      userId: req.user.user_id,
      userRole: req.user.role,
      userDepartment: req.user.department
    } : undefined;

    res.json({
      success: true,
      data: {
        users,
        statistics: stats,
        userContext
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'USER_FETCH_FAILED',
      message: 'Failed to fetch users'
    });
  }
}));

/**
 * GET /api/admin/users/:id
 * Get specific user by ID (Admin only)
 */
router.get('/users/:id', authenticateToken, requireAdminRole, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        error: 'Bad request',
        code: 'MISSING_USER_ID',
        message: 'User ID is required'
      });
    }

    // Use internal getUserById method (we'll need to expose this)
    const user = await authService.getUserById(id);

    if (!user) {
      return res.status(404).json({
        error: 'Not found',
        code: 'USER_NOT_FOUND',
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'USER_FETCH_FAILED',
      message: 'Failed to fetch user'
    });
  }
}));

/**
 * PUT /api/admin/users/:id
 * Update user (Admin only)
 */
router.put('/users/:id', authenticateToken, requireAdminRole, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updatePayload = req.body as UpdateUserPayload;

    if (!id) {
      return res.status(400).json({
        error: 'Bad request',
        code: 'MISSING_USER_ID',
        message: 'User ID is required'
      });
    }

    // Validate update payload
    const allowedFields = ['name', 'role', 'department', 'is_active'];
    const providedFields = Object.keys(updatePayload);
    const invalidFields = providedFields.filter(field => !allowedFields.includes(field));

    if (invalidFields.length > 0) {
      return res.status(400).json({
        error: 'Bad request',
        code: 'INVALID_FIELDS',
        message: `Invalid fields: ${invalidFields.join(', ')}. Allowed: ${allowedFields.join(', ')}`
      });
    }

    // Validate role if provided
    if (updatePayload.role) {
      const validRoles: UserRole[] = ['Employee', 'Manager', 'Admin'];
      if (!validRoles.includes(updatePayload.role)) {
        return res.status(400).json({
          error: 'Bad request',
          code: 'INVALID_ROLE',
          message: `Invalid role. Must be one of: ${validRoles.join(', ')}`
        });
      }
    }

    // Validate department if provided
    if (updatePayload.department) {
      const validDepartments = [
        'Engineering', 'Marketing', 'Sales', 'HR', 'Finance',
        'Operations', 'IT', 'Legal', 'Customer Success'
      ];
      if (!validDepartments.includes(updatePayload.department)) {
        return res.status(400).json({
          error: 'Bad request',
          code: 'INVALID_DEPARTMENT',
          message: `Invalid department. Must be one of: ${validDepartments.join(', ')}`
        });
      }
    }

    // Prevent admin from deactivating themselves
    if (updatePayload.is_active === false && req.user?.user_id === id) {
      return res.status(400).json({
        error: 'Bad request',
        code: 'SELF_DEACTIVATION_DENIED',
        message: 'Cannot deactivate your own account'
      });
    }

    const adminUserId = req.user!.user_id;
    const updatedUser = await authService.updateUser(id, updatePayload, adminUserId);

    const userContext = req.user ? {
      userId: req.user.user_id,
      userRole: req.user.role,
      userDepartment: req.user.department
    } : undefined;

    res.json({
      success: true,
      data: {
        user: updatedUser,
        userContext
      },
      message: 'User updated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error updating user:', error);

    if (error instanceof Error) {
      if (error.message === 'User not found') {
        return res.status(404).json({
          error: 'Not found',
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        });
      }
    }

    res.status(500).json({
      error: 'Internal server error',
      code: 'USER_UPDATE_FAILED',
      message: 'Failed to update user'
    });
  }
}));

/**
 * GET /api/admin/stats
 * Get user statistics (Admin only)
 */
router.get('/stats', authenticateToken, requireAdminRole, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const stats = await authService.getUserStatistics();

    const userContext = req.user ? {
      userId: req.user.user_id,
      userRole: req.user.role,
      userDepartment: req.user.department
    } : undefined;

    res.json({
      success: true,
      data: {
        statistics: stats,
        userContext
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching user statistics:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'STATS_FETCH_FAILED',
      message: 'Failed to fetch user statistics'
    });
  }
}));

/**
 * GET /api/admin/audit-logs
 * Get audit logs (Admin only)
 */
router.get('/audit-logs', authenticateToken, requireAdminRole, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const daysBack = parseInt(req.query.daysBack as string) || 90;

    // Validate parameters
    if (limit > 1000) {
      return res.status(400).json({
        error: 'Bad request',
        code: 'LIMIT_TOO_HIGH',
        message: 'Limit cannot exceed 1000'
      });
    }

    if (offset < 0 || limit < 1 || daysBack < 1 || daysBack > 365) {
      return res.status(400).json({
        error: 'Bad request',
        code: 'INVALID_PARAMETERS',
        message: 'Invalid pagination or date parameters'
      });
    }

    const auditLogs = await authService.getAuditLogs(limit, offset, daysBack);
    const stats = await authService.getAuditLogStats();

    const userContext = req.user ? {
      userId: req.user.user_id,
      userRole: req.user.role,
      userDepartment: req.user.department
    } : undefined;

    res.json({
      success: true,
      data: {
        auditLogs,
        statistics: stats,
        pagination: {
          limit,
          offset,
          daysBack,
          returned: auditLogs.length
        },
        userContext
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'AUDIT_LOGS_FETCH_FAILED',
      message: 'Failed to fetch audit logs'
    });
  }
}));

export default router;