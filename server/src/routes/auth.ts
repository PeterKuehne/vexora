/**
 * Auth Routes - Microsoft & Google OAuth2, JWT Authentication, Token Management
 */

import express, { type Request, type Response } from 'express';
import { authService } from '../services/AuthService.js';
import { asyncHandler } from '../middleware/index.js';
import { ValidationError } from '../errors/index.js';
import { env } from '../config/env.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import { LoggerService } from '../services/LoggerService.js';

const router = express.Router();

/**
 * GET /api/auth/microsoft/login
 * Redirect to Microsoft OAuth2 authorization with CSRF protection
 */
router.get('/microsoft/login', asyncHandler(async (req: Request, res: Response) => {
  try {
    // Extract IP address for audit logging
    const ipAddress = req.ip || req.socket.remoteAddress;

    // Generate auth URL with CSRF-protected state parameter
    const authUrl = await authService.createMicrosoftAuthUrl(ipAddress);

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
  const frontendUrl = env.FRONTEND_URL;

  // Check for OAuth error
  if (error) {
    console.error('Microsoft OAuth error:', error);
    const errorDescription = req.query.error_description || 'OAuth authentication failed';
    return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(errorDescription as string)}`);
  }

  // Validate required parameters
  if (!code || typeof code !== 'string') {
    console.error('Missing authorization code');
    return res.redirect(`${frontendUrl}/login?error=missing_code`);
  }

  if (!state || typeof state !== 'string') {
    console.error('Missing state parameter - possible CSRF attack');
    return res.redirect(`${frontendUrl}/login?error=security_error`);
  }

  try {
    // Exchange code for user info (includes state validation)
    const microsoftUser = await authService.exchangeMicrosoftCode(code, state as string);

    // Create or update user
    const user = await authService.createOrUpdateUser(microsoftUser);

    // Generate auth session
    const session = await authService.createAuthSession(user);

    // Set secure cookies with enhanced security settings

    res.cookie('auth_token', session.access_token, {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: env.isProduction ? 'strict' : 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/',
      domain: env.isProduction ? undefined : undefined // Let browser handle domain
    });

    res.cookie('refresh_token', session.refresh_token, {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: env.isProduction ? 'strict' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/',
      domain: env.isProduction ? undefined : undefined // Let browser handle domain
    });

    // Log successful login
    console.log(`✅ User logged in: ${user.email} (${user.role})`);

    // Create audit log
    await authService.createAuditLog({
      userId: user.id,
      userEmail: user.email,
      action: 'login',
      result: 'success',
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      metadata: { provider: 'microsoft', method: 'oauth2' }
    });

    // Redirect to app
    res.redirect(`${frontendUrl}/chat`);
  } catch (error) {
    console.error('Microsoft callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
    res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(errorMessage)}`);
  }
}));

/**
 * GET /api/auth/google/login
 * Redirect to Google OAuth2 authorization with CSRF protection
 */
router.get('/google/login', asyncHandler(async (req: Request, res: Response) => {
  try {
    // Extract IP address for audit logging
    const ipAddress = req.ip || req.socket.remoteAddress;

    // Generate auth URL with CSRF-protected state parameter
    const authUrl = await authService.createGoogleAuthUrl(ipAddress);

    // Redirect to Google OAuth
    res.redirect(authUrl);
  } catch (error) {
    console.error('Google auth URL generation failed:', error);
    res.status(500).json({
      error: 'OAuth configuration error',
      message: 'Google authentication is not properly configured'
    });
  }
}));

/**
 * GET /api/auth/google/callback
 * Handle Google OAuth2 callback with authorization code
 */
router.get('/google/callback', asyncHandler(async (req: Request, res: Response) => {
  const { code, state, error } = req.query;
  const frontendUrl = env.FRONTEND_URL;

  // Check for OAuth error
  if (error) {
    console.error('Google OAuth error:', error);
    const errorDescription = req.query.error_description || 'OAuth authentication failed';
    return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(errorDescription as string)}`);
  }

  // Validate required parameters
  if (!code || typeof code !== 'string') {
    console.error('Missing authorization code');
    return res.redirect(`${frontendUrl}/login?error=missing_code`);
  }

  if (!state || typeof state !== 'string') {
    console.error('Missing state parameter - possible CSRF attack');
    return res.redirect(`${frontendUrl}/login?error=security_error`);
  }

  try {
    // Exchange code for user info (includes state validation)
    const googleUser = await authService.exchangeGoogleCode(code, state as string);

    // Create or update user
    const user = await authService.createOrUpdateUser(googleUser);

    // Generate auth session
    const session = await authService.createAuthSession(user);

    // Set secure cookies with enhanced security settings

    res.cookie('auth_token', session.access_token, {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: env.isProduction ? 'strict' : 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/',
      domain: env.isProduction ? undefined : undefined // Let browser handle domain
    });

    res.cookie('refresh_token', session.refresh_token, {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: env.isProduction ? 'strict' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/',
      domain: env.isProduction ? undefined : undefined // Let browser handle domain
    });

    // Log successful login
    console.log(`✅ User logged in via Google: ${user.email} (${user.role})`);

    // Create audit log
    await authService.createAuditLog({
      userId: user.id,
      userEmail: user.email,
      action: 'login',
      result: 'success',
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      metadata: { provider: 'google', method: 'oauth2' }
    });

    // Redirect to app
    res.redirect(`${frontendUrl}/chat`);
  } catch (error) {
    console.error('Google callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
    res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(errorMessage)}`);
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
 * Implements token rotation for enhanced security
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

    // Rotate refresh token (best practice: issue new token on every use)
    const newRefreshTokenRecord = await authService.rotateRefreshToken(refreshToken, user.id);

    if (!newRefreshTokenRecord) {
      return res.status(401).json({ error: 'Token rotation failed' });
    }

    // Create audit log for token refresh
    await authService.createAuditLog({
      userId: user.id,
      userEmail: user.email,
      action: 'token_refresh',
      result: 'success',
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent']
    });

    // Update access token cookie
    res.cookie('auth_token', newAccessToken, {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: env.isProduction ? 'strict' : 'lax',
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/',
      domain: env.isProduction ? undefined : undefined
    });

    // Update refresh token cookie with NEW token
    res.cookie('refresh_token', newRefreshTokenRecord.token_hash, {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: env.isProduction ? 'strict' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      path: '/',
      domain: env.isProduction ? undefined : undefined
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
    const authToken = req.headers['authorization']?.replace('Bearer ', '') || (req as any).cookies?.auth_token;

    // Get user info for audit log before revoking tokens
    let userEmail = 'unknown';
    let userId = undefined;
    try {
      if (authToken) {
        const payload = authService.verifyAccessToken(authToken);
        userEmail = payload.email;
        userId = payload.user_id;
      }
    } catch (error) {
      // Token might be expired, continue with logout anyway
    }

    // Revoke refresh token if provided
    if (refreshToken) {
      await authService.revokeRefreshToken(refreshToken);
    }

    // Create audit log
    await authService.createAuditLog({
      userId,
      userEmail,
      action: 'logout',
      result: 'success',
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent']
    });

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

/**
 * GET /api/auth/test-logger
 * Test LoggerService functionality
 */
router.get('/test-logger', asyncHandler(async (_req: Request, res: Response) => {
  try {
    // Test all logger methods
    LoggerService.logInfo('LoggerService test started', { test: true, timestamp: new Date().toISOString() });
    LoggerService.logWarning('Test warning message', { level: 'warning' });
    LoggerService.logError('Test error message', { level: 'error', sensitive_password: 'secret123' });

    // Test auth logging
    LoggerService.logAuth('login', {
      userId: 'test-user-123',
      email: 'test@example.com',
      ip: '127.0.0.1'
    });

    // Test redaction function
    const redactionResult = LoggerService.testRedaction();

    return res.json({
      success: true,
      message: 'LoggerService test completed',
      redactionTest: redactionResult,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    LoggerService.logError(error instanceof Error ? error : new Error('LoggerService test failed'));
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}));

export default router;