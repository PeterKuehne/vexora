/**
 * Auth Routes - Microsoft OAuth2, JWT Authentication, Token Management
 */

import express, { type Request, type Response } from 'express';
import { authService } from '../services/AuthService.js';
import { asyncHandler } from '../middleware/index.js';
import { ValidationError } from '../errors/index.js';
import type { AuthenticatedRequest } from '../types/auth.js';

const router = express.Router();

/**
 * GET /api/auth/microsoft/login
 * Redirect to Microsoft OAuth2 authorization
 */
router.get('/microsoft/login', asyncHandler(async (_req: Request, res: Response) => {
  try {
    const authUrl = authService.createMicrosoftAuthUrl();

    // Redirect to Microsoft OAuth
    res.redirect(authUrl);
  } catch (error) {
    console.error('Microsoft auth URL generation failed:', error);
    res.status(500).json({
      error: 'OAuth configuration error',
      message: 'Microsoft authentication is not properly configured'
    });
  }
}));

/**
 * GET /api/auth/microsoft/callback
 * Handle Microsoft OAuth2 callback with authorization code
 */
router.get('/microsoft/callback', asyncHandler(async (req: Request, res: Response) => {
  const { code, state, error } = req.query;

  // Check for OAuth error
  if (error) {
    console.error('Microsoft OAuth error:', error);
    const errorDescription = req.query.error_description || 'OAuth authentication failed';
    return res.redirect(`/login?error=${encodeURIComponent(errorDescription as string)}`);
  }

  // Validate required parameters
  if (!code || typeof code !== 'string') {
    console.error('Missing authorization code');
    return res.redirect('/login?error=missing_code');
  }

  try {
    // Exchange code for user info
    const microsoftUser = await authService.exchangeMicrosoftCode(code, state as string);

    // Create or update user
    const user = await authService.createOrUpdateUser(microsoftUser);

    // Generate auth session
    const session = await authService.createAuthSession(user);

    // Set secure cookies (production should use httpOnly and secure)
    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie('auth_token', session.access_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/'
    });

    res.cookie('refresh_token', session.refresh_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/'
    });

    // Log successful login
    console.log(`✅ User logged in: ${user.email} (${user.role})`);

    // Redirect to app
    res.redirect('/chat');
  } catch (error) {
    console.error('Microsoft callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
    res.redirect(`/login?error=${encodeURIComponent(errorMessage)}`);
  }
}));

/**
 * GET /api/auth/me
 * Get current user info (requires valid JWT)
 */
router.get('/me', asyncHandler(async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader?.replace('Bearer ', '') || (req as any).cookies?.auth_token;

    if (!token) {
      return res.status(401).json({ error: 'No authentication token provided' });
    }

    // Verify JWT token
    const payload = authService.verifyAccessToken(token);

    // Get fresh user context
    const userContext = await authService.getUserContext(payload.user_id);

    if (!userContext) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    // Return user info (without sensitive data)
    const user = {
      id: userContext.user_id,
      email: userContext.email,
      name: userContext.name,
      role: userContext.role,
      department: userContext.department,
      is_active: userContext.is_active,
    };

    return res.json(user);
  } catch (error) {
    console.error('Auth verification error:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}));

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh', asyncHandler(async (req: Request, res: Response) => {
  try {
    const refreshToken = req.body.refresh_token || (req as any).cookies?.refresh_token;

    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token provided' });
    }

    // Verify refresh token and get user
    const user = await authService.verifyRefreshToken(refreshToken);

    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    // Generate new access token
    const newAccessToken = authService.generateAccessToken(user);

    // Update access token cookie
    const isProduction = process.env.NODE_ENV === 'production';

    res.cookie('auth_token', newAccessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/'
    });

    return res.json({
      access_token: newAccessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        department: user.department,
      }
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    return res.status(401).json({ error: 'Token refresh failed' });
  }
}));

/**
 * POST /api/auth/logout
 * Logout user and revoke tokens
 */
router.post('/logout', asyncHandler(async (req: Request, res: Response) => {
  try {
    const refreshToken = req.body.refresh_token || (req as any).cookies?.refresh_token;

    // Revoke refresh token if provided
    if (refreshToken) {
      await authService.revokeRefreshToken(refreshToken);
    }

    // Clear cookies
    res.clearCookie('auth_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });

    return res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    // Still clear cookies even if token revocation fails
    res.clearCookie('auth_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/' });

    return res.json({
      success: true,
      message: 'Logged out (with errors)'
    });
  }
}));

/**
 * GET /api/auth/status
 * Quick auth status check (lightweight)
 */
router.get('/status', asyncHandler(async (req: Request, res: Response) => {
  try {
    const token = req.headers['authorization']?.replace('Bearer ', '') || (req as any).cookies?.auth_token;

    if (!token) {
      return res.json({ authenticated: false });
    }

    // Quick JWT verification (no database lookup)
    const payload = authService.verifyAccessToken(token);

    return res.json({
      authenticated: true,
      user: {
        id: payload.user_id,
        email: payload.email,
        name: payload.name,
        role: payload.role,
        department: payload.department,
      }
    });
  } catch (error) {
    return res.json({ authenticated: false });
  }
}));

export default router;