/**
 * Authentication Middleware for JWT token validation and user context extraction
 *
 * Validates JWT tokens and adds user context to requests for permission-aware operations.
 * Used for protecting API routes that require user authorization.
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { type UserContext, type JWTPayload, type AuthenticatedRequest } from '../types/auth.js';

/**
 * Middleware to extract and validate JWT token from Authorization header
 * Adds user context to request object for downstream use
 */
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : null;

    if (!token) {
      res.status(401).json({
        error: 'Access token required',
        code: 'MISSING_TOKEN',
        message: 'Authorization header with Bearer token is required'
      });
      return;
    }

    // Verify JWT token
    const decoded = jwt.verify(token, env.JWT_SECRET) as JWTPayload;

    // Create user context for the request
    const userContext: UserContext = {
      user_id: decoded.user_id,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
      department: decoded.department,
      is_active: true, // JWT tokens are only issued for active users
    };

    // Attach user context to request
    req.user = userContext;

    console.log(`🔐 Authenticated: ${userContext.role} (${userContext.department}) - ${userContext.email}`);

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED',
        message: 'Access token has expired. Please refresh your token.'
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        error: 'Invalid token',
        code: 'INVALID_TOKEN',
        message: 'Access token is invalid or malformed.'
      });
      return;
    }

    console.error('❌ Authentication error:', error);
    res.status(500).json({
      error: 'Authentication failed',
      code: 'AUTH_ERROR',
      message: 'Internal server error during authentication.'
    });
  }
}

/**
 * Optional authentication middleware - allows both authenticated and anonymous access
 * If token is provided and valid, adds user context. Otherwise continues without user.
 */
export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : null;

    if (!token) {
      // No token provided - continue without authentication
      console.log('🔓 No authentication token provided - continuing anonymously');
      next();
      return;
    }

    // Verify JWT token if provided
    const decoded = jwt.verify(token, env.JWT_SECRET) as JWTPayload;

    // Create user context for the request
    const userContext: UserContext = {
      user_id: decoded.user_id,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
      department: decoded.department,
      is_active: true,
    };

    // Attach user context to request
    req.user = userContext;

    console.log(`🔐 Optional auth success: ${userContext.role} (${userContext.department}) - ${userContext.email}`);

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError || error instanceof jwt.JsonWebTokenError) {
      // Invalid token - continue without authentication rather than failing
      console.log(`⚠️  Invalid/expired token provided - continuing anonymously: ${error.message}`);
      req.user = undefined;
      next();
      return;
    }

    console.error('❌ Optional authentication error:', error);
    res.status(500).json({
      error: 'Authentication failed',
      code: 'AUTH_ERROR',
      message: 'Internal server error during authentication.'
    });
  }
}

/**
 * Role-based authorization middleware
 * Requires authentication first (use after authenticateToken)
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'NO_USER_CONTEXT',
        message: 'User authentication is required for this endpoint.'
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_ROLE',
        message: `Role '${req.user.role}' is not authorized. Required: ${allowedRoles.join(', ')}`
      });
      return;
    }

    console.log(`✅ Role authorization passed: ${req.user.role} in ${allowedRoles}`);
    next();
  };
}