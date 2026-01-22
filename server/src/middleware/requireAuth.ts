/**
 * requireAuth Middleware - Authentication Required
 */

import { type Request, type Response, type NextFunction } from 'express';
import type { AuthenticatedRequest } from '../types/auth.js';

/**
 * Middleware to require authentication
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      code: 'AUTHENTICATION_REQUIRED'
    });
  }

  next();
}

/**
 * Middleware to require a specific role
 */
export function requireRole(role: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTHENTICATION_REQUIRED'
      });
    }

    if (req.user.role.toLowerCase() !== role.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: `Access denied. ${role} role required.`,
        code: 'INSUFFICIENT_PERMISSIONS'
      });
    }

    next();
  };
}