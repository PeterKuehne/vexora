/**
 * Frontend TypeScript types for Enterprise Authentication System
 */

// Re-export common types that are shared between frontend and backend
export type UserRole = 'Employee' | 'Manager' | 'Admin';
export type AuthProvider = 'microsoft' | 'google';
export type DocumentClassification = 'public' | 'internal' | 'confidential' | 'restricted';

// User interface (simplified for frontend)
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  department?: string;
  provider: AuthProvider;
  is_active: boolean;
  created_at: string; // ISO string on frontend
  last_login?: string; // ISO string on frontend
}

// Authentication state
export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  loading: boolean;
  error: string | null;
}

// Login credentials for OAuth flow
export interface LoginCredentials {
  provider: AuthProvider;
  code?: string; // OAuth authorization code
  state?: string; // CSRF protection
}

// Login response from API
export interface LoginResponse {
  success: boolean;
  user?: User;
  access_token?: string;
  refresh_token?: string;
  error?: string;
}

// Token refresh response
export interface RefreshResponse {
  success: boolean;
  access_token?: string;
  error?: string;
}

// User profile update payload
export interface UpdateProfilePayload {
  name?: string;
}

// Admin user management payloads
export interface AdminUpdateUserPayload {
  name?: string;
  role?: UserRole;
  department?: string;
  is_active?: boolean;
}

// Document with enterprise permissions (frontend view)
export interface EnterpriseDocument {
  id: string;
  filename: string;
  uploaded_at: string; // ISO string
  owner_id?: string;
  owner_name?: string; // Populated by API
  department?: string;
  classification: DocumentClassification;
  allowed_roles?: UserRole[];
  allowed_users?: string[];
  // Document content is loaded separately for performance
}

// Document upload payload with permissions
export interface DocumentUploadPayload {
  file: File;
  department?: string;
  classification?: DocumentClassification;
  allowed_roles?: UserRole[];
  allowed_users?: string[];
}

// Permission check utilities for UI
export interface DocumentPermissions {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canChangePermissions: boolean;
}

// OAuth URLs for SSO buttons
export interface OAuthUrls {
  microsoft: string;
  google: string;
}

// User management (admin only)
export interface UserManagementData {
  users: User[];
  totalUsers: number;
  activeUsers: number;
  usersByRole: Record<UserRole, number>;
  usersByDepartment: Record<string, number>;
}

// Audit log entry (admin view)
export interface AuditLogEntry {
  id: string;
  user_email: string;
  action: string;
  resource_type?: string;
  resource_id?: string;
  result: 'success' | 'failure' | 'denied';
  ip_address?: string;
  created_at: string; // ISO string
  metadata?: Record<string, any>;
}

// Route protection types
export interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: UserRole;
  fallback?: React.ReactNode;
}

// Department options for forms
export const DEPARTMENT_OPTIONS = [
  'Engineering',
  'Marketing',
  'Sales',
  'HR',
  'Finance',
  'Operations',
  'IT',
  'Legal',
  'Customer Success'
] as const;

export type Department = typeof DEPARTMENT_OPTIONS[number];

// Classification level descriptions for UI
export const CLASSIFICATION_DESCRIPTIONS: Record<DocumentClassification, string> = {
  'public': 'Accessible to all users and external parties',
  'internal': 'Accessible to all company employees',
  'confidential': 'Accessible to managers and above in relevant departments',
  'restricted': 'Accessible only to admins and specifically authorized users'
};

// Role descriptions for admin UI
export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  'Employee': 'Can access own documents and public/internal documents',
  'Manager': 'Can access department documents and manage team permissions',
  'Admin': 'Full system access including user management and all documents'
};

// Permission matrix for quick reference
export const ROLE_PERMISSIONS = {
  'Employee': {
    canViewPublicDocs: true,
    canViewInternalDocs: true,
    canViewConfidentialDocs: false,
    canViewRestrictedDocs: false,
    canUploadDocs: true,
    canManageUsers: false,
    canViewAuditLogs: false,
    maxClassification: 'internal' as DocumentClassification
  },
  'Manager': {
    canViewPublicDocs: true,
    canViewInternalDocs: true,
    canViewConfidentialDocs: true,
    canViewRestrictedDocs: false,
    canUploadDocs: true,
    canManageUsers: false,
    canViewAuditLogs: false,
    maxClassification: 'confidential' as DocumentClassification
  },
  'Admin': {
    canViewPublicDocs: true,
    canViewInternalDocs: true,
    canViewConfidentialDocs: true,
    canViewRestrictedDocs: true,
    canUploadDocs: true,
    canManageUsers: true,
    canViewAuditLogs: true,
    maxClassification: 'restricted' as DocumentClassification
  }
} as const;

// Helper function types
export type CheckPermission = (action: string, resource?: any) => boolean;
export type GetDocumentPermissions = (document: EnterpriseDocument, user: User) => DocumentPermissions;