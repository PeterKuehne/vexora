/**
 * AuthService - Microsoft & Google OAuth2, JWT Token Management and User Management
 * Implements Enterprise Authentication with RBAC
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { randomBytes, randomUUID, createHash } from 'crypto';

/**
 * Base64URL encoding (RFC 4648)
 * Used for PKCE code_verifier and code_challenge
 */
function base64url(buffer: Buffer): string {
  return buffer
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
// Note: AuthorizationCode not needed for our implementation
import type {
  User,
  CreateUserPayload,
  UpdateUserPayload,
  RefreshToken,
  CreateRefreshTokenPayload,
  JWTPayload,
  LoginResult,
  MicrosoftUserInfo,
  GoogleUserInfo,
  AuthSession,
  UserContext
} from '../types/auth.js';
import { databaseService } from './index.js';
import { LoggerService } from './LoggerService.js';

export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn = '15m'; // 15 minutes
  private readonly refreshExpiresIn = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
    if (!this.jwtSecret || this.jwtSecret === 'dev-secret-change-in-production') {
      LoggerService.logWarning('Using default JWT secret in development', {
        environment: process.env.NODE_ENV || 'development'
      });
    }
  }

  /**
   * Create Microsoft OAuth2 authorization URL with CSRF protection + PKCE
   */
  async createMicrosoftAuthUrl(ipAddress?: string): Promise<string> {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:3001/api/auth/microsoft/callback';

    if (!clientId) {
      throw new Error('Microsoft OAuth not configured: MICROSOFT_CLIENT_ID missing');
    }

    // Generate and store state parameter + PKCE for security
    const { state, codeChallenge } = await this.generateAndStoreState('microsoft', ipAddress);

    const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', 'openid profile email User.Read');
    authUrl.searchParams.set('state', state);

    // PKCE parameters (OAuth 2.1)
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    return authUrl.toString();
  }

  /**
   * Exchange Microsoft OAuth2 code for tokens and user info
   */
  async exchangeMicrosoftCode(code: string, state: string): Promise<MicrosoftUserInfo> {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:3001/api/auth/microsoft/callback';

    if (!clientId || !clientSecret) {
      throw new Error('Microsoft OAuth not configured');
    }

    // CSRF Protection + PKCE: Validate state and get code_verifier
    const stateValidation = await this.validateAndConsumeState(state, 'microsoft');
    if (!stateValidation.valid) {
      throw new Error('CSRF attack detected: Invalid or expired state parameter');
    }

    // Exchange code for access token with PKCE
    const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    });

    // Add PKCE code_verifier (OAuth 2.1)
    if (stateValidation.codeVerifier) {
      tokenParams.set('code_verifier', stateValidation.codeVerifier);
    }

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams,
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`Microsoft token exchange failed: ${error}`);
    }

    const tokens = await tokenResponse.json();

    // Get user info from Microsoft Graph
    const userResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!userResponse.ok) {
      const error = await userResponse.text();
      throw new Error(`Microsoft user info failed: ${error}`);
    }

    const userInfo = await userResponse.json();

    return {
      id: userInfo.id,
      displayName: userInfo.displayName || userInfo.mail || userInfo.userPrincipalName,
      mail: userInfo.mail,
      userPrincipalName: userInfo.userPrincipalName,
      givenName: userInfo.givenName,
      surname: userInfo.surname,
      jobTitle: userInfo.jobTitle,
      department: userInfo.department,
    };
  }

  /**
   * Create Google OAuth2 authorization URL with CSRF protection + PKCE
   */
  async createGoogleAuthUrl(ipAddress?: string): Promise<string> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/auth/google/callback';

    if (!clientId) {
      throw new Error('Google OAuth not configured: GOOGLE_CLIENT_ID missing');
    }

    // Generate and store state parameter + PKCE for security
    const { state, codeChallenge } = await this.generateAndStoreState('google', ipAddress);

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', 'openid profile email');
    authUrl.searchParams.set('state', state);

    // PKCE parameters (OAuth 2.1)
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    return authUrl.toString();
  }

  /**
   * Exchange Google OAuth2 code for tokens and user info
   */
  async exchangeGoogleCode(code: string, state: string): Promise<GoogleUserInfo> {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/auth/google/callback';

    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth not configured');
    }

    // CSRF Protection + PKCE: Validate state and get code_verifier
    const stateValidation = await this.validateAndConsumeState(state, 'google');
    if (!stateValidation.valid) {
      throw new Error('CSRF attack detected: Invalid or expired state parameter');
    }

    // Exchange code for access token with PKCE
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    });

    // Add PKCE code_verifier (OAuth 2.1)
    if (stateValidation.codeVerifier) {
      tokenParams.set('code_verifier', stateValidation.codeVerifier);
    }

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams,
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`Google token exchange failed: ${error}`);
    }

    const tokens = await tokenResponse.json();

    // Get user info from Google
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!userResponse.ok) {
      const error = await userResponse.text();
      throw new Error(`Google user info failed: ${error}`);
    }

    const userInfo = await userResponse.json();

    return {
      id: userInfo.id,
      email: userInfo.email,
      verified_email: userInfo.verified_email || false,
      name: userInfo.name,
      given_name: userInfo.given_name,
      family_name: userInfo.family_name,
      picture: userInfo.picture,
      locale: userInfo.locale,
    };
  }

  /**
   * Create or update user from OAuth info
   */
  async createOrUpdateUser(microsoftInfo: MicrosoftUserInfo): Promise<User>;
  async createOrUpdateUser(googleInfo: GoogleUserInfo): Promise<User>;
  async createOrUpdateUser(oauthInfo: MicrosoftUserInfo | GoogleUserInfo): Promise<User> {
    // Determine provider and extract email/data
    const isMicrosoft = 'userPrincipalName' in oauthInfo;
    const isGoogle = 'verified_email' in oauthInfo;

    let email: string;
    let name: string;
    let department: string | undefined;
    let provider: 'microsoft' | 'google';
    let providerId: string;

    if (isMicrosoft) {
      const msInfo = oauthInfo as MicrosoftUserInfo;
      email = msInfo.mail || msInfo.userPrincipalName;
      name = msInfo.displayName;
      department = msInfo.department;
      provider = 'microsoft';
      providerId = msInfo.id;
    } else if (isGoogle) {
      const googleInfo = oauthInfo as GoogleUserInfo;
      email = googleInfo.email;
      name = googleInfo.name;
      department = undefined; // Google doesn't provide department info by default
      provider = 'google';
      providerId = googleInfo.id;
    } else {
      throw new Error('Invalid OAuth provider info');
    }

    if (!email) {
      throw new Error(`No email found in ${provider} profile`);
    }

    try {
      // Check if user exists
      const existingUser = await this.getUserByEmail(email);

      if (existingUser) {
        // Update last login
        await this.updateLastLogin(existingUser.id);
        return existingUser;
      }

      // Create new user
      const userId = this.generateUserId();
      const createPayload: CreateUserPayload = {
        email,
        name,
        role: 'Employee', // Default role
        department,
        provider,
        provider_id: providerId,
      };

      const user = await this.createUser(userId, createPayload);
      LoggerService.logAuth('login', {
        userId: user.id,
        email: user.email,
        provider
      });
      LoggerService.logInfo('User created/updated successfully', {
        userId: user.id,
        email: user.email,
        role: user.role
      });
      return user;
    } catch (error) {
      LoggerService.logError(error instanceof Error ? error : new Error('Failed to create or update user'), {
        email,
        provider
      });
      throw new Error('Failed to create or update user');
    }
  }

  /**
   * Generate JWT access token
   */
  generateAccessToken(user: User): string {
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      user_id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn,
    });
  }

  /**
   * Generate refresh token
   */
  async generateRefreshToken(userId: string): Promise<RefreshToken> {
    const token = randomBytes(32).toString('hex');
    const tokenHash = await bcrypt.hash(token, 10);
    const tokenLookup = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + this.refreshExpiresIn);

    const refreshTokenPayload: CreateRefreshTokenPayload = {
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
      token_lookup: tokenLookup,
    };

    const refreshToken = await this.createRefreshToken(refreshTokenPayload);

    // Store plain token (for cookie/response)
    return {
      ...refreshToken,
      token_hash: token, // Return plain token, not hash
    };
  }

  /**
   * Verify JWT access token
   */
  verifyAccessToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, this.jwtSecret) as JWTPayload;
    } catch (error) {
      throw new Error('Invalid or expired access token');
    }
  }

  /**
   * Verify refresh token (optimized with token_lookup)
   */
  async verifyRefreshToken(token: string): Promise<User | null> {
    try {
      // Generate lookup key for fast query
      const tokenLookup = createHash('sha256').update(token).digest('hex');

      // Optimized query: lookup by SHA-256 hash first, then verify bcrypt
      const refreshTokensResult = await databaseService.query(
        `SELECT * FROM refresh_tokens
         WHERE token_lookup = $1
           AND expires_at > NOW()
           AND revoked = FALSE
         LIMIT 1`,
        [tokenLookup]
      );

      const refreshTokens = Array.isArray(refreshTokensResult) ? refreshTokensResult : refreshTokensResult.rows || [];

      if (refreshTokens.length === 0) {
        return null;
      }

      const storedToken = refreshTokens[0];

      // Verify bcrypt hash (only one comparison now instead of N)
      const isValid = await bcrypt.compare(token, storedToken.token_hash);
      if (!isValid) {
        return null;
      }

      // Get user
      const user = await this.getUserById(storedToken.user_id);
      return user;

    } catch (error) {
      LoggerService.logError(error instanceof Error ? error : new Error('Refresh token verification failed'), {
        tokenId: 'REDACTED'
      });
      return null;
    }
  }

  /**
   * Revoke refresh token (optimized with token_lookup)
   */
  async revokeRefreshToken(token: string): Promise<void> {
    try {
      const tokenLookup = createHash('sha256').update(token).digest('hex');

      await databaseService.query(
        `UPDATE refresh_tokens
         SET revoked = TRUE,
             revoked_at = NOW(),
             revoked_reason = 'Manual revocation'
         WHERE token_lookup = $1`,
        [tokenLookup]
      );
    } catch (error) {
      console.error('Error revoking refresh token:', error);
    }
  }

  /**
   * Rotate refresh token (revoke old, generate new)
   * Best Practice: Rotate tokens on every use to detect compromise
   */
  async rotateRefreshToken(oldToken: string, userId: string): Promise<RefreshToken | null> {
    try {
      const tokenLookup = createHash('sha256').update(oldToken).digest('hex');

      // Find and revoke old token
      const oldTokenResult = await databaseService.query(
        `UPDATE refresh_tokens
         SET revoked = TRUE,
             revoked_at = NOW(),
             revoked_reason = 'Token rotation'
         WHERE token_lookup = $1
           AND expires_at > NOW()
           AND revoked = FALSE
         RETURNING id`,
        [tokenLookup]
      );

      const oldTokenRecords = Array.isArray(oldTokenResult) ? oldTokenResult : oldTokenResult.rows || [];

      if (oldTokenRecords.length === 0) {
        // Token not found or already revoked - possible breach
        LoggerService.logWarning('Attempted rotation of invalid/revoked token', {
          userId,
          tokenLookup: tokenLookup.substring(0, 8) + '...' // Log partial for debugging
        });
        return null;
      }

      const oldTokenId = oldTokenRecords[0].id;

      // Generate new token
      const newToken = await this.generateRefreshToken(userId);

      // Link old token to new token (audit trail)
      await databaseService.query(
        `UPDATE refresh_tokens
         SET rotated_to = $1
         WHERE id = $2`,
        [newToken.id, oldTokenId]
      );

      LoggerService.logAuth('token_rotated', {
        userId,
        oldTokenId,
        newTokenId: newToken.id
      });

      return newToken;

    } catch (error) {
      LoggerService.logError(error instanceof Error ? error : new Error('Token rotation failed'), {
        userId
      });
      return null;
    }
  }

  /**
   * Create complete auth session
   */
  async createAuthSession(user: User): Promise<AuthSession> {
    const accessToken = this.generateAccessToken(user);
    const refreshToken = await this.generateRefreshToken(user.id);

    return {
      user,
      access_token: accessToken,
      refresh_token: refreshToken.token_hash, // Plain token
      expires_at: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    };
  }

  /**
   * Database methods
   */
  private async getUserByEmail(email: string): Promise<User | null> {
    try {
      const result = await databaseService.query(
        'SELECT * FROM users WHERE email = $1 AND is_active = true',
        [email]
      );
      const rows = Array.isArray(result) ? result : result.rows || [];
      return rows[0] || null;
    } catch (error) {
      console.error('Error getting user by email:', error);
      return null;
    }
  }

  /**
   * Get user by ID (includes inactive users for admin)
   */
  async getUserById(id: string, includeInactive: boolean = false): Promise<User | null> {
    try {
      const whereClause = includeInactive ? 'id = $1' : 'id = $1 AND is_active = true';
      const result = await databaseService.query(
        `SELECT * FROM users WHERE ${whereClause}`,
        [id]
      );
      const rows = Array.isArray(result) ? result : result.rows || [];
      return rows[0] || null;
    } catch (error) {
      console.error('Error getting user by ID:', error);
      return null;
    }
  }

  private async getUserByIdInternal(id: string): Promise<User | null> {
    return this.getUserById(id, false);
  }

  private async createUser(id: string, payload: CreateUserPayload): Promise<User> {
    const result = await databaseService.query(`
      INSERT INTO users (id, email, name, role, department, provider, provider_id, is_active, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW())
      RETURNING *
    `, [
      id,
      payload.email,
      payload.name,
      payload.role || 'Employee',
      payload.department,
      payload.provider,
      payload.provider_id,
    ]);

    const rows = Array.isArray(result) ? result : result.rows || [];
    return rows[0];
  }

  private async createRefreshToken(payload: CreateRefreshTokenPayload): Promise<RefreshToken> {
    const id = this.generateTokenId();
    const result = await databaseService.query(`
      INSERT INTO refresh_tokens (id, user_id, token_hash, token_lookup, expires_at, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING *
    `, [
      id,
      payload.user_id,
      payload.token_hash,
      payload.token_lookup,
      payload.expires_at,
    ]);

    const rows = Array.isArray(result) ? result : result.rows || [];
    return rows[0];
  }

  private async updateLastLogin(userId: string): Promise<void> {
    await databaseService.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [userId]
    );
  }

  /**
   * Utility methods
   */
  private generateUserId(): string {
    return randomUUID();
  }

  private generateTokenId(): string {
    return randomUUID();
  }

  /**
   * Generate PKCE code_verifier and code_challenge
   */
  private generatePKCE(): { codeVerifier: string; codeChallenge: string } {
    // Generate code_verifier (43-128 characters)
    const codeVerifier = base64url(randomBytes(32)); // 43 characters

    // Generate code_challenge = BASE64URL(SHA256(code_verifier))
    const hash = createHash('sha256').update(codeVerifier).digest();
    const codeChallenge = base64url(hash);

    return { codeVerifier, codeChallenge };
  }

  /**
   * Generate and store OAuth state parameter with PKCE (CSRF protection + OAuth 2.1)
   */
  async generateAndStoreState(provider: 'microsoft' | 'google', ipAddress?: string): Promise<{ state: string; codeChallenge: string }> {
    const state = randomBytes(32).toString('hex'); // 64 characters
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Generate PKCE parameters
    const { codeVerifier, codeChallenge } = this.generatePKCE();

    await databaseService.query(
      `INSERT INTO oauth_states (state, provider, expires_at, ip_address, code_verifier)
       VALUES ($1, $2, $3, $4, $5)`,
      [state, provider, expiresAt, ipAddress || null, codeVerifier]
    );

    LoggerService.logAuth('oauth_state_generated', {
      provider,
      ip: ipAddress,
    });

    return { state, codeChallenge };
  }

  /**
   * Validate and consume OAuth state parameter, return code_verifier for PKCE
   */
  async validateAndConsumeState(state: string, provider: 'microsoft' | 'google'): Promise<{ valid: boolean; codeVerifier?: string }> {
    if (!state || state.length !== 64) {
      LoggerService.logWarning('Invalid state format', { provider, stateLength: state?.length });
      return { valid: false };
    }

    try {
      // Find unused, non-expired state and return code_verifier
      const result = await databaseService.query(
        `UPDATE oauth_states
         SET used_at = NOW()
         WHERE state = $1
           AND provider = $2
           AND used_at IS NULL
           AND expires_at > NOW()
         RETURNING id, created_at, code_verifier`,
        [state, provider]
      );

      const rows = Array.isArray(result) ? result : result.rows || [];

      if (rows.length === 0) {
        // State not found, expired, or already used
        LoggerService.logWarning('OAuth state validation failed', {
          provider,
          reason: 'State not found, expired, or already used',
        });
        return { valid: false };
      }

      LoggerService.logAuth('oauth_state_validated', {
        provider,
        stateId: rows[0].id,
      });

      return { valid: true, codeVerifier: rows[0].code_verifier };
    } catch (error) {
      LoggerService.logError(error instanceof Error ? error : new Error('State validation error'), { provider });
      return { valid: false };
    }
  }

  private generateState(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Get user context for middleware
   */
  async getUserContext(userId: string): Promise<UserContext | null> {
    const user = await this.getUserByIdInternal(userId);
    if (!user) return null;

    return {
      user_id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
      is_active: user.is_active,
    };
  }

  /**
   * Admin User Management Methods
   */

  /**
   * Get all users (Admin only)
   */
  async getAllUsers(): Promise<User[]> {
    try {
      const result = await databaseService.query(`
        SELECT id, email, name, role, department, provider, is_active, created_at, last_login
        FROM users
        ORDER BY created_at DESC
      `);
      const rows = Array.isArray(result) ? result : result.rows || [];
      return rows;
    } catch (error) {
      console.error('Error getting all users:', error);
      throw new Error('Failed to fetch users');
    }
  }

  /**
   * Count active admin users
   */
  async countActiveAdmins(): Promise<number> {
    try {
      const result = await databaseService.query(`
        SELECT COUNT(*) as admin_count
        FROM users
        WHERE role = 'Admin' AND is_active = true
      `);

      const rows = Array.isArray(result) ? result : result.rows || [];
      const adminCount = rows[0]?.admin_count || 0;

      return parseInt(adminCount);
    } catch (error) {
      console.error('Error counting active admins:', error);
      throw new Error('Failed to count active admins');
    }
  }

  /**
   * Update user (Admin only)
   */
  async updateUser(userId: string, payload: UpdateUserPayload, adminUserId: string): Promise<User> {
    try {
      // First check if user exists (include inactive users for admin)
      const existingUser = await this.getUserById(userId, true);
      if (!existingUser) {
        throw new Error('User not found');
      }

      // Check if this would violate admin minimum requirement
      if (existingUser.role === 'Admin' && existingUser.is_active) {
        const currentAdminCount = await this.countActiveAdmins();

        // Check if changing role away from Admin or deactivating
        const wouldRemoveAdmin = (payload.role !== undefined && payload.role !== 'Admin') ||
                                (payload.is_active !== undefined && !payload.is_active);

        if (wouldRemoveAdmin && currentAdminCount <= 1) {
          throw new Error('Cannot modify the last active admin. At least one admin must remain in the system.');
        }
      }

      // Build dynamic update query
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (payload.name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(payload.name);
      }

      if (payload.role !== undefined) {
        updates.push(`role = $${paramIndex++}`);
        values.push(payload.role);
      }

      if (payload.department !== undefined) {
        updates.push(`department = $${paramIndex++}`);
        values.push(payload.department);
      }

      if (payload.is_active !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        values.push(payload.is_active);
      }

      if (updates.length === 0) {
        // No updates provided, return existing user
        return existingUser;
      }

      // Add userId to params
      values.push(userId);

      const result = await databaseService.query(`
        UPDATE users
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `, values);

      const rows = Array.isArray(result) ? result : result.rows || [];
      const updatedUser = rows[0];

      if (!updatedUser) {
        throw new Error('Failed to update user');
      }

      // Log audit trail
      await this.logAuditEntry(
        adminUserId,
        'user_update',
        'user',
        userId,
        'success',
        {
          updates: payload,
          target_user: existingUser.email
        }
      );

      console.log(`✅ User updated by admin: ${updatedUser.email} (${updatedUser.role})`);
      return updatedUser;

    } catch (error) {
      // Log failed audit trail
      await this.logAuditEntry(
        adminUserId,
        'user_update',
        'user',
        userId,
        'failure',
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          attempted_updates: payload
        }
      ).catch(console.error);

      console.error('Error updating user:', error);
      throw error instanceof Error ? error : new Error('Failed to update user');
    }
  }

  /**
   * Get user statistics (Admin only)
   */
  async getUserStatistics(): Promise<{
    totalUsers: number;
    activeUsers: number;
    usersByRole: Record<string, number>;
    usersByDepartment: Record<string, number>;
  }> {
    try {
      // Total and active users
      const countResult = await databaseService.query(`
        SELECT
          COUNT(*) as total_users,
          COUNT(*) FILTER (WHERE is_active = true) as active_users
        FROM users
      `);
      const countRows = Array.isArray(countResult) ? countResult : countResult.rows || [];
      const { total_users, active_users } = countRows[0] || { total_users: 0, active_users: 0 };

      // Users by role
      const roleResult = await databaseService.query(`
        SELECT role, COUNT(*) as count
        FROM users
        WHERE is_active = true
        GROUP BY role
      `);
      const roleRows = Array.isArray(roleResult) ? roleResult : roleResult.rows || [];
      const usersByRole = roleRows.reduce((acc: Record<string, number>, row) => {
        acc[row.role] = parseInt(row.count);
        return acc;
      }, {});

      // Users by department
      const deptResult = await databaseService.query(`
        SELECT department, COUNT(*) as count
        FROM users
        WHERE is_active = true AND department IS NOT NULL
        GROUP BY department
      `);
      const deptRows = Array.isArray(deptResult) ? deptResult : deptResult.rows || [];
      const usersByDepartment = deptRows.reduce((acc: Record<string, number>, row) => {
        acc[row.department] = parseInt(row.count);
        return acc;
      }, {});

      return {
        totalUsers: parseInt(total_users),
        activeUsers: parseInt(active_users),
        usersByRole,
        usersByDepartment,
      };

    } catch (error) {
      console.error('Error getting user statistics:', error);
      throw new Error('Failed to fetch user statistics');
    }
  }

  /**
   * Log audit entry for admin actions
   */
  private async logAuditEntry(
    userId: string,
    action: string,
    resourceType: string,
    resourceId: string,
    result: 'success' | 'failure' | 'denied',
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      await databaseService.query(`
        INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, result, metadata, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        randomUUID(),
        userId,
        action,
        resourceType,
        resourceId,
        result,
        JSON.stringify(metadata || {})
      ]);
    } catch (error) {
      console.error('Failed to log audit entry:', error);
      // Don't throw here to avoid breaking the main operation
    }
  }

  /**
   * Create audit log entry (public method for use in routes)
   * @param userId - User ID performing the action
   * @param userEmail - User email performing the action
   * @param action - Action being performed (e.g., 'login', 'logout', 'document_upload')
   * @param result - Result of the action ('success', 'failure', 'denied')
   * @param resourceType - Optional resource type (e.g., 'document', 'user')
   * @param resourceId - Optional resource ID
   * @param ipAddress - Optional IP address
   * @param userAgent - Optional user agent string
   * @param metadata - Optional additional metadata
   */
  async createAuditLog(params: {
    userId?: string;
    userEmail: string;
    action: string;
    result: 'success' | 'failure' | 'denied';
    resourceType?: string;
    resourceId?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      await databaseService.query(`
        INSERT INTO audit_logs (
          id, user_id, user_email, action, resource_type, resource_id,
          result, ip_address, user_agent, metadata, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      `, [
        randomUUID(),
        params.userId || null,
        params.userEmail,
        params.action,
        params.resourceType || null,
        params.resourceId || null,
        params.result,
        params.ipAddress || null,
        params.userAgent || null,
        params.metadata ? JSON.stringify(params.metadata) : '{}'
      ]);
    } catch (error) {
      console.error('Failed to create audit log:', error);
      // Don't throw here to avoid breaking the main operation
    }
  }

  /**
   * Get audit logs for admin review
   * @param limit Maximum number of logs to return (default: 100)
   * @param offset Number of logs to skip (default: 0)
   * @param daysBack Number of days to look back (default: 90)
   */
  async getAuditLogs(limit = 100, offset = 0, daysBack = 90): Promise<AuditLog[]> {
    try {
      const result = await databaseService.query(`
        SELECT
          al.id,
          al.user_id,
          u.email as user_email,
          al.action,
          al.resource_type,
          al.resource_id,
          al.result,
          al.ip_address,
          al.user_agent,
          al.metadata,
          al.created_at
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.created_at >= NOW() - INTERVAL '${daysBack} days'
        ORDER BY al.created_at DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset]);

      return result.rows.map(row => ({
        id: row.id,
        user_id: row.user_id,
        user_email: row.user_email || 'Unknown User',
        action: row.action,
        resource_type: row.resource_type,
        resource_id: row.resource_id,
        result: row.result as AuditResult,
        ip_address: row.ip_address,
        user_agent: row.user_agent,
        metadata: row.metadata,
        created_at: row.created_at
      }));
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      throw new Error('Failed to fetch audit logs');
    }
  }

  /**
   * Get audit log statistics for admin dashboard
   */
  async getAuditLogStats(): Promise<{
    totalLogs: number;
    successCount: number;
    failureCount: number;
    deniedCount: number;
    topActions: Array<{ action: string; count: number }>;
  }> {
    try {
      // Get total counts by result
      const countsResult = await databaseService.query(`
        SELECT
          result,
          COUNT(*) as count
        FROM audit_logs
        WHERE created_at >= NOW() - INTERVAL '90 days'
        GROUP BY result
      `);

      // Get top actions
      const actionsResult = await databaseService.query(`
        SELECT
          action,
          COUNT(*) as count
        FROM audit_logs
        WHERE created_at >= NOW() - INTERVAL '90 days'
        GROUP BY action
        ORDER BY count DESC
        LIMIT 5
      `);

      const stats = {
        totalLogs: 0,
        successCount: 0,
        failureCount: 0,
        deniedCount: 0,
        topActions: actionsResult.rows.map(row => ({
          action: row.action,
          count: parseInt(row.count)
        }))
      };

      // Calculate counts
      for (const row of countsResult.rows) {
        const count = parseInt(row.count);
        stats.totalLogs += count;

        switch (row.result) {
          case 'success':
            stats.successCount = count;
            break;
          case 'failure':
            stats.failureCount = count;
            break;
          case 'denied':
            stats.deniedCount = count;
            break;
        }
      }

      return stats;
    } catch (error) {
      console.error('Error fetching audit log statistics:', error);
      throw new Error('Failed to fetch audit log statistics');
    }
  }

  /**
   * Get audit logs for a specific user (Admin only)
   * @param userId User ID to filter logs for
   * @param limit Maximum number of logs to return (default: 100)
   * @param offset Number of logs to skip (default: 0)
   * @param daysBack Number of days to look back (default: 90)
   */
  async getUserAuditLogs(userId: string, limit = 100, offset = 0, daysBack = 90): Promise<{
    logs: AuditLog[];
    statistics: {
      totalLogs: number;
      successCount: number;
      failureCount: number;
      deniedCount: number;
      uploadCount: number;
      queryCount: number;
      loginCount: number;
      dateRange: {
        from: Date;
        to: Date;
      };
    };
  }> {
    try {
      // First verify user exists
      const userExists = await databaseService.query(`
        SELECT id FROM users WHERE id = $1
      `, [userId]);

      if (userExists.rows.length === 0) {
        throw new Error('User not found');
      }

      // Get user-specific logs
      const logsResult = await databaseService.query(`
        SELECT
          al.id,
          al.user_id,
          u.email as user_email,
          u.name as user_name,
          al.action,
          al.resource_type,
          al.resource_id,
          al.result,
          al.ip_address,
          al.user_agent,
          al.metadata,
          al.created_at
        FROM audit_logs al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.user_id = $1
        AND al.created_at >= NOW() - INTERVAL '${daysBack} days'
        ORDER BY al.created_at DESC
        LIMIT $2 OFFSET $3
      `, [userId, limit, offset]);

      // Get statistics for this user
      const statsResult = await databaseService.query(`
        SELECT
          result,
          action,
          COUNT(*) as count
        FROM audit_logs
        WHERE user_id = $1
        AND created_at >= NOW() - INTERVAL '${daysBack} days'
        GROUP BY result, action
      `, [userId]);

      // Calculate statistics
      const statistics = {
        totalLogs: 0,
        successCount: 0,
        failureCount: 0,
        deniedCount: 0,
        uploadCount: 0,
        queryCount: 0,
        loginCount: 0,
        dateRange: {
          from: new Date(Date.now() - (daysBack * 24 * 60 * 60 * 1000)),
          to: new Date()
        }
      };

      for (const row of statsResult.rows) {
        const count = parseInt(row.count);
        statistics.totalLogs += count;

        // Count by result
        switch (row.result) {
          case 'success':
            statistics.successCount += count;
            break;
          case 'failure':
            statistics.failureCount += count;
            break;
          case 'denied':
            statistics.deniedCount += count;
            break;
        }

        // Count by action type
        const action = row.action.toLowerCase();
        if (action.includes('upload') || action.includes('document')) {
          statistics.uploadCount += count;
        } else if (action.includes('query') || action.includes('rag') || action.includes('search')) {
          statistics.queryCount += count;
        } else if (action.includes('login') || action.includes('auth')) {
          statistics.loginCount += count;
        }
      }

      const logs: AuditLog[] = logsResult.rows.map(row => ({
        id: row.id,
        user_id: row.user_id,
        user_email: row.user_email || 'Unknown User',
        action: row.action,
        resource_type: row.resource_type,
        resource_id: row.resource_id,
        result: row.result as AuditResult,
        ip_address: row.ip_address,
        user_agent: row.user_agent,
        metadata: row.metadata,
        created_at: row.created_at
      }));

      return {
        logs,
        statistics
      };
    } catch (error) {
      console.error('Error fetching user audit logs:', error);
      throw new Error('Failed to fetch user audit logs');
    }
  }
}

// Export singleton instance
export const authService = new AuthService();