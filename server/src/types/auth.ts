/**
 * TypeScript types for Enterprise Authentication System
 */

// User role enumeration
export type UserRole = 'Employee' | 'Manager' | 'Admin';

// Authentication providers
export type AuthProvider = 'microsoft' | 'google';

// Document classification levels
export type DocumentClassification = 'public' | 'internal' | 'confidential' | 'restricted';

// Audit log result types
export type AuditResult = 'success' | 'failure' | 'denied';

// User interface
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department?: string;
  provider: AuthProvider;
  provider_id: string;
  is_active: boolean;
  created_at: Date;
  last_login?: Date;
}

// User creation payload (for new users from OAuth)
export interface CreateUserPayload {
  email: string;
  name: string;
  role?: UserRole; // Default to 'Employee'
  department?: string;
  provider: AuthProvider;
  provider_id: string;
}

// User update payload (for admin user management)
export interface UpdateUserPayload {
  name?: string;
  role?: UserRole;
  department?: string;
  is_active?: boolean;
}

// Refresh token interface
export interface RefreshToken {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  created_at: Date;
}

// JWT payload interface
export interface JWTPayload {
  user_id: string;
  email: string;
  name: string;
  role: UserRole;
  department?: string;
  iat: number;
  exp: number;
}

// Refresh token creation payload
export interface CreateRefreshTokenPayload {
  user_id: string;
  token_hash: string;
  expires_at: Date;
}

// Audit log interface
export interface AuditLog {
  id: string;
  user_id?: string;
  user_email: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  result: AuditResult;
  ip_address?: string;
  user_agent?: string;
  metadata?: Record<string, any>;
  created_at: Date;
}

// Audit log creation payload
export interface CreateAuditLogPayload {
  user_id?: string;
  user_email: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  result: AuditResult;
  ip_address?: string;
  user_agent?: string;
  metadata?: Record<string, any>;
}

// Enhanced Document interface (extends existing)
export interface EnterpriseDocument {
  id: string;
  filename: string;
  content: string;
  uploaded_at: Date;
  // Enterprise auth fields
  owner_id?: string;
  department?: string;
  classification: DocumentClassification;
  allowed_roles?: UserRole[];
  allowed_users?: string[]; // User IDs
}

// Document access context for RLS
export interface DocumentAccessContext {
  user_id: string;
  role: UserRole;
  department?: string;
}

// OAuth provider configuration
export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string[];
}

// Microsoft OAuth user info
export interface MicrosoftUserInfo {
  id: string;
  displayName: string;
  mail?: string;
  userPrincipalName: string;
  givenName?: string;
  surname?: string;
  jobTitle?: string;
  department?: string;
}

// Google OAuth user info
export interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  locale?: string;
}

// Authentication session
export interface AuthSession {
  user: User;
  access_token: string;
  refresh_token: string;
  expires_at: Date;
}

// Login result
export interface LoginResult {
  success: boolean;
  user?: User;
  access_token?: string;
  refresh_token?: string;
  error?: string;
}

// Permission check result
export interface PermissionResult {
  allowed: boolean;
  reason?: string;
}

// User context for middleware
export interface UserContext {
  user_id: string;
  email: string;
  name: string;
  role: UserRole;
  department?: string;
  is_active: boolean;
}

// API request with user context
export interface AuthenticatedRequest extends Request {
  user?: UserContext;
}

// Document classification constraints by role
export const CLASSIFICATION_CONSTRAINTS: Record<UserRole, DocumentClassification[]> = {
  'Employee': ['public', 'internal'],
  'Manager': ['public', 'internal', 'confidential'],
  'Admin': ['public', 'internal', 'confidential', 'restricted']
};

// Default document classification by role
export const DEFAULT_CLASSIFICATION: Record<UserRole, DocumentClassification> = {
  'Employee': 'internal',
  'Manager': 'internal',
  'Admin': 'internal'
};