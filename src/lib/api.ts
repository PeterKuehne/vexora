/**
 * API Client for Cor7ex Backend
 *
 * Handles communication with the Express backend.
 */

import { env } from './env';
import type { AuditLogEntry } from '../types/auth';

/**
 * Model type returned by API
 */
export interface APIModel {
  id: string;
  name: string;
  family: string;
  parameterSize: string;
  quantization: string;
  sizeGB: number;
  isDefault: boolean;
}

export interface CloudModel {
  id: string;
  name: string;
  provider: string;
  isCloud: boolean;
  contextWindow: number;
  inputPricePerMTok?: number;
  outputPricePerMTok?: number;
}

/**
 * Fetch available models from the backend (Ollama + Cloud)
 */
export async function fetchModels(): Promise<{
  models: APIModel[];
  cloudModels: CloudModel[];
  defaultModel: string;
}> {
  // Import httpClient dynamically to avoid circular dependencies
  const { api } = await import('./httpClient');

  // Use httpClient for automatic token management
  return api.get<{
    models: APIModel[];
    cloudModels: CloudModel[];
    defaultModel: string;
  }>(`${env.API_URL}/api/models`, {
    skipAuth: true // Models endpoint doesn't require auth
  });
}

/**
 * Fetch available embedding models from the backend
 */
export async function fetchEmbeddingModels(): Promise<{
  models: APIModel[];
  defaultModel: string | null;
  totalCount: number;
}> {
  const response = await fetch(`${env.API_URL}/api/models/embedding`);

  if (!response.ok) {
    throw new Error(`Failed to fetch embedding models: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Check backend health status
 */
export async function checkHealth(): Promise<{
  status: 'ok' | 'degraded' | 'error';
  services: {
    backend: { status: string };
    websocket: { status: string; connections: number };
    ollama: { status: string; available_models: string[] };
  };
}> {
  const response = await fetch(`${env.API_URL}/api/health`);

  if (!response.ok) {
    throw new Error(`Health check failed: ${response.statusText}`);
  }

  return response.json();
}

// ============================================
// Documents API
// ============================================

/**
 * Available document categories
 */
export const DOCUMENT_CATEGORIES = [
  'Allgemein',
  'Vertrag',
  'Rechnung',
  'Bericht',
  'Handbuch',
  'Präsentation',
  'Sonstiges',
] as const;

export type DocumentCategory = typeof DOCUMENT_CATEGORIES[number];

export interface DocumentMetadata {
  id: string;
  filename: string;
  originalName: string;
  size: number;
  type: 'pdf';
  uploadedAt: string;
  updatedAt?: string;
  pages: number;
  text?: string;
  category: DocumentCategory;
  tags: string[];
  metadata?: {
    classification?: 'public' | 'internal' | 'confidential' | 'restricted';
    visibility?: 'only_me' | 'department' | 'all_users' | 'specific_users';
    specificUsers?: string[];
    owner_id?: string;
    department?: string;
  };
}

export interface UploadProgress {
  progress: number; // 0-100
  loaded: number;   // bytes loaded
  total: number;    // total bytes
  phase: 'uploading' | 'processing';
}

/**
 * Upload response for new job-based system
 */
export interface UploadJobResponse {
  success: boolean;
  jobId: string;
  documentId: string;
  status: 'pending';
  message: string;
}

/**
 * Document permission metadata for upload
 */
export interface DocumentPermissions {
  classification: 'public' | 'internal' | 'confidential' | 'restricted';
  visibility: 'only_me' | 'department' | 'all_users' | 'specific_users';
  specificUsers?: string[];
  department?: string;
}

/**
 * Upload a PDF document with job-based async processing
 */
export async function uploadDocumentAsync(
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadJobResponse> {
  const formData = new FormData();
  formData.append('document', file);

  return uploadDocumentWithPermissions(file, {
    classification: 'internal',
    visibility: 'department'
  }, onProgress);
}

/**
 * Upload a PDF document with permissions and job-based async processing
 */
export async function uploadDocumentWithPermissions(
  file: File,
  permissions: DocumentPermissions,
  onProgress?: (progress: UploadProgress) => void
): Promise<UploadJobResponse> {
  const formData = new FormData();
  formData.append('document', file);
  formData.append('classification', permissions.classification);
  formData.append('visibility', permissions.visibility);

  if (permissions.specificUsers) {
    formData.append('specificUsers', JSON.stringify(permissions.specificUsers));
  }

  if (permissions.department) {
    formData.append('department', permissions.department);
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Track upload progress
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress({
          progress,
          loaded: event.loaded,
          total: event.total,
          phase: 'uploading',
        });
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response: UploadJobResponse = JSON.parse(xhr.responseText);
          resolve(response);
        } catch (error) {
          reject(new Error('Invalid response format'));
        }
      } else {
        try {
          const errorData = JSON.parse(xhr.responseText);
          reject(new Error(errorData.message || 'Upload failed'));
        } catch {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error occurred'));
    };

    xhr.ontimeout = () => {
      reject(new Error('Upload timed out'));
    };

    // Set timeout to 5 minutes
    xhr.timeout = 5 * 60 * 1000;

    xhr.open('POST', `${env.API_URL}/api/documents/upload`);
    xhr.withCredentials = true; // Include cookies for authentication
    xhr.send(formData);
  });
}

/**
 * Upload a PDF document with progress tracking (Legacy)
 */
export async function uploadDocument(
  file: File,
  onProgress?: (progress: UploadProgress) => void
): Promise<DocumentMetadata> {
  const formData = new FormData();
  formData.append('document', file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Track upload progress
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        const progress = Math.round((event.loaded / event.total) * 100);
        onProgress({
          progress,
          loaded: event.loaded,
          total: event.total,
          phase: 'uploading',
        });
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          // Notify processing phase
          if (onProgress) {
            onProgress({
              progress: 100,
              loaded: file.size,
              total: file.size,
              phase: 'processing',
            });
          }

          const response = JSON.parse(xhr.responseText);
          resolve(response.document);
        } catch (error) {
          reject(new Error('Failed to parse upload response'));
        }
      } else {
        try {
          const errorResponse = JSON.parse(xhr.responseText);
          reject(new Error(errorResponse.message || `Upload failed: ${xhr.statusText}`));
        } catch {
          reject(new Error(`Upload failed: ${xhr.statusText}`));
        }
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error during upload'));
    };

    xhr.open('POST', `${env.API_URL}/api/documents/upload`);
    xhr.send(formData);
  });
}

/**
 * Fetch all documents (requires authentication)
 */
export async function fetchDocuments(): Promise<{
  documents: DocumentMetadata[];
  totalCount: number;
}> {
  // Import httpClient dynamically to avoid circular dependencies
  const { api } = await import('./httpClient');

  // Use httpClient for automatic token management
  return api.get<{
    documents: DocumentMetadata[];
    totalCount: number;
  }>(`${env.API_URL}/api/documents`);
}

/**
 * Fetch single document by ID
 */
export async function fetchDocument(id: string): Promise<DocumentMetadata> {
  const response = await fetch(`${env.API_URL}/api/documents/${id}`, {
    credentials: 'include', // Send auth cookies
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Document not found');
    }
    throw new Error(`Failed to fetch document: ${response.statusText}`);
  }

  const data = await response.json();
  return data.document;
}

/**
 * Delete document by ID
 */
export async function deleteDocument(id: string): Promise<void> {
  const response = await fetch(`${env.API_URL}/api/documents/${id}`, {
    method: 'DELETE',
    credentials: 'include', // Send auth cookies
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Document not found');
    }
    throw new Error(`Failed to delete document: ${response.statusText}`);
  }
}

/**
 * Bulk delete response type
 */
export interface BulkDeleteResult {
  id: string;
  success: boolean;
  error?: string;
}

export interface BulkDeleteResponse {
  success: boolean;
  message: string;
  results: BulkDeleteResult[];
  deletedCount: number;
  failedCount: number;
}

/**
 * Bulk delete multiple documents by IDs
 */
export async function bulkDeleteDocuments(ids: string[]): Promise<BulkDeleteResponse> {
  const response = await fetch(`${env.API_URL}/api/documents/bulk-delete`, {
    method: 'POST',
    credentials: 'include', // Send auth cookies
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids }),
  });

  if (!response.ok) {
    throw new Error(`Failed to delete documents: ${response.statusText}`);
  }

  return response.json();
}

// ============================================
// Quota Management
// ============================================

/**
 * User quota usage information
 */
export interface UserQuotaUsage {
  userId: string;
  userRole: string;
  usedBytes: number;
  usedMB: number;
  limitBytes: number;
  limitMB: number;
  availableBytes: number;
  availableMB: number;
  usagePercent: number;
  isWarning: boolean;     // > 80%
  isCritical: boolean;    // > 95%
  isExceeded: boolean;    // >= 100%
}

/**
 * Quota validation result
 */
export interface QuotaValidationResult {
  allowed: boolean;
  reason?: string;
  currentUsage: UserQuotaUsage;
}

/**
 * Get current user's quota usage
 */
export async function getQuotaUsage(): Promise<UserQuotaUsage> {
  // Import httpClient dynamically to avoid circular dependencies
  const { api } = await import('./httpClient');

  const response = await api.get<{
    success: boolean;
    usage: UserQuotaUsage;
  }>(`${env.API_URL}/api/quota/me`);

  return response.usage;
}

/**
 * Validate if a file upload would exceed quota
 */
export async function validateFileUpload(fileSize: number): Promise<QuotaValidationResult> {
  // Import httpClient dynamically to avoid circular dependencies
  const { api } = await import('./httpClient');

  const response = await api.post<{
    success: boolean;
    validation: QuotaValidationResult;
  }>(`${env.API_URL}/api/quota/validate`, { fileSize });

  return response.validation;
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = Math.round((bytes / Math.pow(1024, i)) * 100) / 100;

  return `${size} ${sizes[i]}`;
}

// ============================================
// Admin User Management
// ============================================

/**
 * Admin user management types
 */
export interface UserManagementResponse {
  success: boolean;
  data: {
    users: User[];
    statistics: {
      totalUsers: number;
      activeUsers: number;
      usersByRole: Record<string, number>;
      usersByDepartment: Record<string, number>;
    };
    userContext: {
      userId: string;
      userRole: string;
      userDepartment?: string;
    };
  };
  timestamp: string;
}

export interface UserUpdateResponse {
  success: boolean;
  data: {
    user: User;
    userContext: {
      userId: string;
      userRole: string;
      userDepartment?: string;
    };
  };
  message: string;
  timestamp: string;
}

/**
 * Import and re-export User type from auth types
 */
import type { User, UserRole, AdminUpdateUserPayload } from '../types/auth';
export type { User, UserRole, AdminUpdateUserPayload };

/**
 * Fetch all users (Admin only)
 */
export async function fetchAllUsers(): Promise<UserManagementResponse> {
  // Import httpClient dynamically to avoid circular dependencies
  const { api } = await import('./httpClient');

  // Use httpClient for automatic token management and Admin auth
  return api.get<UserManagementResponse>(`${env.API_URL}/api/admin/users`);
}

/**
 * Fetch specific user by ID (Admin only)
 */
export async function fetchUserById(userId: string): Promise<{
  success: boolean;
  data: User;
  timestamp: string;
}> {
  // Import httpClient dynamically to avoid circular dependencies
  const { api } = await import('./httpClient');

  return api.get<{
    success: boolean;
    data: User;
    timestamp: string;
  }>(`${env.API_URL}/api/admin/users/${userId}`);
}

/**
 * Update user (Admin only)
 */
export async function updateUser(
  userId: string,
  updates: {
    name?: string;
    role?: 'Employee' | 'Manager' | 'Admin';
    department?: string;
    is_active?: boolean;
  }
): Promise<UserUpdateResponse> {
  // Import httpClient dynamically to avoid circular dependencies
  const { api } = await import('./httpClient');

  return api.put<UserUpdateResponse>(`${env.API_URL}/api/admin/users/${userId}`, updates);
}

/**
 * Fetch user statistics (Admin only)
 */
export async function fetchUserStatistics(): Promise<{
  success: boolean;
  data: {
    statistics: {
      totalUsers: number;
      activeUsers: number;
      usersByRole: Record<string, number>;
      usersByDepartment: Record<string, number>;
    };
    userContext: {
      userId: string;
      userRole: string;
      userDepartment?: string;
    };
  };
  timestamp: string;
}> {
  // Import httpClient dynamically to avoid circular dependencies
  const { api } = await import('./httpClient');

  return api.get<{
    success: boolean;
    data: {
      statistics: {
        totalUsers: number;
        activeUsers: number;
        usersByRole: Record<string, number>;
        usersByDepartment: Record<string, number>;
      };
      userContext: {
        userId: string;
        userRole: string;
        userDepartment?: string;
      };
    };
    timestamp: string;
  }>(`${env.API_URL}/api/admin/stats`);
}

/**
 * Get audit logs (Admin only)
 */
export async function fetchAuditLogs(
  limit = 100,
  offset = 0,
  daysBack = 90
): Promise<{
  success: true;
  data: {
    auditLogs: AuditLogEntry[];
    statistics: {
      totalLogs: number;
      successCount: number;
      failureCount: number;
      deniedCount: number;
      topActions: Array<{ action: string; count: number }>;
    };
    pagination: {
      limit: number;
      offset: number;
      daysBack: number;
      returned: number;
    };
    userContext: {
      userId: string;
      userRole: string;
      userDepartment?: string;
    };
  };
  timestamp: string;
}> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
    daysBack: daysBack.toString()
  });

  // Import httpClient dynamically to avoid circular dependencies
  const { api } = await import('./httpClient');

  return api.get<{
    success: true;
    data: {
      auditLogs: AuditLogEntry[];
      statistics: {
        totalLogs: number;
        successCount: number;
        failureCount: number;
        deniedCount: number;
        topActions: Array<{ action: string; count: number }>;
      };
      pagination: {
        limit: number;
        offset: number;
        daysBack: number;
        returned: number;
      };
      userContext: {
        userId: string;
        userRole: string;
        userDepartment?: string;
      };
    };
    timestamp: string;
  }>(`${env.API_URL}/api/admin/audit-logs?${params}`);
}

/**
 * Get audit logs for a specific user (Admin only)
 */
export async function fetchUserAuditLogs(
  userId: string,
  limit = 100,
  offset = 0,
  daysBack = 90
): Promise<{
  success: true;
  data: {
    targetUser: {
      id: string;
      email: string;
      name: string;
      role: string;
      department?: string;
      is_active: boolean;
    };
    auditLogs: AuditLogEntry[];
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
    pagination: {
      limit: number;
      offset: number;
      daysBack: number;
      returned: number;
    };
    userContext: {
      userId: string;
      userRole: string;
      userDepartment?: string;
    };
  };
  timestamp: string;
}> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
    daysBack: daysBack.toString()
  });

  // Import httpClient dynamically to avoid circular dependencies
  const { api } = await import('./httpClient');

  return api.get<{
    success: true;
    data: {
      targetUser: {
        id: string;
        email: string;
        name: string;
        role: string;
        department?: string;
        is_active: boolean;
      };
      auditLogs: AuditLogEntry[];
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
      pagination: {
        limit: number;
        offset: number;
        daysBack: number;
        returned: number;
      };
      userContext: {
        userId: string;
        userRole: string;
        userDepartment?: string;
      };
    };
    timestamp: string;
  }>(`${env.API_URL}/api/admin/audit-logs/user/${userId}?${params}`);
}

// ============================================
// Document Permission Management
// ============================================

/**
 * Update document permissions
 */
export interface UpdatePermissionsRequest {
  classification: 'public' | 'internal' | 'confidential' | 'restricted';
  visibility: 'only_me' | 'department' | 'all_users' | 'specific_users';
  specificUsers?: string[] | undefined;
}

export interface UpdatePermissionsResponse {
  success: boolean;
  message: string;
  document: {
    id: string;
    classification: string;
    visibility: string;
    specificUsers?: string[];
    updatedAt: string;
  };
}

export async function updateDocumentPermissions(
  documentId: string,
  permissions: UpdatePermissionsRequest
): Promise<UpdatePermissionsResponse> {
  // Import httpClient dynamically to avoid circular dependencies
  const { api } = await import('./httpClient');

  return api.patch<UpdatePermissionsResponse>(
    `${env.API_URL}/api/documents/${documentId}/permissions`,
    permissions
  );
}

// ============================================
// System Settings Management (Admin Only)
// ============================================

/**
 * System Settings Types - matching backend interface
 */
export interface SystemSettings {
  tokenSettings: {
    accessTokenLifetime: number;
    refreshTokenLifetime: number;
    enableTokenRotation: boolean;
  };
  ragSettings: {
    defaultSearchLimit: number;
    maxSearchLimit: number;
    defaultSimilarityThreshold: number;
    defaultHybridAlpha: number;
  };
  storageSettings: {
    defaultUserQuotaMB: number;
    maxUserQuotaMB: number;
    enableQuotaEnforcement: boolean;
  };
  oauthSettings: {
    enableMicrosoftOAuth: boolean;
    enableGoogleOAuth: boolean;
    sessionTimeoutHours: number;
  };
  performanceSettings: {
    maxConcurrentJobs: number;
    requestTimeoutSeconds: number;
    enableRequestLogging: boolean;
  };
}

export interface SystemSettingsResponse {
  success: boolean;
  data: {
    settings: SystemSettings;
    userContext: {
      userId: string;
      userRole: string;
      userDepartment?: string;
    };
  };
  timestamp: string;
}

export interface UpdateSettingsResponse {
  success: boolean;
  data: {
    settings: SystemSettings;
    userContext: {
      userId: string;
      userRole: string;
      userDepartment?: string;
    };
    applied: string[];
  };
  message: string;
  timestamp: string;
}

/**
 * Get current system settings (Admin only)
 */
export async function fetchSystemSettings(): Promise<SystemSettingsResponse> {
  // Import httpClient dynamically to avoid circular dependencies
  const { api } = await import('./httpClient');

  return api.get<SystemSettingsResponse>(`${env.API_URL}/api/admin/settings`);
}

/**
 * Update system settings (Admin only)
 */
export async function updateSystemSettings(
  settings: Partial<SystemSettings>
): Promise<UpdateSettingsResponse> {
  // Import httpClient dynamically to avoid circular dependencies
  const { api } = await import('./httpClient');

  return api.put<UpdateSettingsResponse>(
    `${env.API_URL}/api/admin/settings`,
    settings
  );
}

/**
 * Reset system settings to defaults (Admin only)
 */
export async function resetSystemSettings(): Promise<SystemSettingsResponse> {
  // Import httpClient dynamically to avoid circular dependencies
  const { api } = await import('./httpClient');

  return api.post<SystemSettingsResponse>(`${env.API_URL}/api/admin/settings/reset`);
}

