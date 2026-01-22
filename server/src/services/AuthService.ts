/**
 * AuthService - Microsoft & Google OAuth2, JWT Token Management and User Management
 * Implements Enterprise Authentication with RBAC
 */

import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
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

export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn = '15m'; // 15 minutes
  private readonly refreshExpiresIn = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
    if (!this.jwtSecret || this.jwtSecret === 'dev-secret-change-in-production') {
      console.warn('⚠️ Using default JWT secret. Set JWT_SECRET in production!');
    }
  }

  /**
   * Create Microsoft OAuth2 authorization URL
   */
  createMicrosoftAuthUrl(): string {
    const clientId = process.env.MICROSOFT_CLIENT_ID;
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:3001/api/auth/microsoft/callback';

    if (!clientId) {
      throw new Error('Microsoft OAuth not configured: MICROSOFT_CLIENT_ID missing');
    }

    const authUrl = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', 'openid profile email User.Read');
    authUrl.searchParams.set('state', this.generateState());

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

    // Exchange code for access token
    const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    });

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
   * Create Google OAuth2 authorization URL
   */
  createGoogleAuthUrl(): string {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/api/auth/google/callback';

    if (!clientId) {
      throw new Error('Google OAuth not configured: GOOGLE_CLIENT_ID missing');
    }

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', 'openid profile email');
    authUrl.searchParams.set('state', this.generateState());

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

    // Exchange code for access token
    const tokenUrl = 'https://oauth2.googleapis.com/token';
    const tokenParams = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    });

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
      console.log(`✅ Created new user: ${email} (${user.role})`);
      return user;
    } catch (error) {
      console.error('Error creating/updating user:', error);
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
    const expiresAt = new Date(Date.now() + this.refreshExpiresIn);

    const refreshTokenPayload: CreateRefreshTokenPayload = {
      user_id: userId,
      token_hash: tokenHash,
      expires_at: expiresAt,
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
   * Verify refresh token
   */
  async verifyRefreshToken(token: string): Promise<User | null> {
    try {
      const refreshTokensResult = await databaseService.query(
        'SELECT * FROM refresh_tokens WHERE expires_at > NOW() ORDER BY created_at DESC'
      );

      const refreshTokens = Array.isArray(refreshTokensResult) ? refreshTokensResult : refreshTokensResult.rows || [];

      for (const storedToken of refreshTokens) {
        const isValid = await bcrypt.compare(token, storedToken.token_hash);
        if (isValid) {
          const user = await this.getUserById(storedToken.user_id);
          return user;
        }
      }

      return null;
    } catch (error) {
      console.error('Error verifying refresh token:', error);
      return null;
    }
  }

  /**
   * Revoke refresh token
   */
  async revokeRefreshToken(token: string): Promise<void> {
    try {
      const refreshTokensResult = await databaseService.query(
        'SELECT id, token_hash FROM refresh_tokens'
      );

      const refreshTokens = Array.isArray(refreshTokensResult) ? refreshTokensResult : refreshTokensResult.rows || [];

      for (const storedToken of refreshTokens) {
        const isValid = await bcrypt.compare(token, storedToken.token_hash);
        if (isValid) {
          await databaseService.query(
            'DELETE FROM refresh_tokens WHERE id = $1',
            [storedToken.id]
          );
          break;
        }
      }
    } catch (error) {
      console.error('Error revoking refresh token:', error);
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

  private async getUserById(id: string): Promise<User | null> {
    try {
      const result = await databaseService.query(
        'SELECT * FROM users WHERE id = $1 AND is_active = true',
        [id]
      );
      const rows = Array.isArray(result) ? result : result.rows || [];
      return rows[0] || null;
    } catch (error) {
      console.error('Error getting user by ID:', error);
      return null;
    }
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
      INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      RETURNING *
    `, [
      id,
      payload.user_id,
      payload.token_hash,
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
    return `user_${Date.now()}_${randomBytes(8).toString('hex')}`;
  }

  private generateTokenId(): string {
    return `token_${Date.now()}_${randomBytes(8).toString('hex')}`;
  }

  private generateState(): string {
    return randomBytes(16).toString('hex');
  }

  /**
   * Get user context for middleware
   */
  async getUserContext(userId: string): Promise<UserContext | null> {
    const user = await this.getUserById(userId);
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
}

// Export singleton instance
export const authService = new AuthService();