/**
 * API Client for Vexora Backend
 *
 * Handles communication with the Express backend,
 * including SSE streaming for chat responses.
 */

import { env } from './env';
import type { Message, MessageRole } from '../types/message';
import type { AuditLogEntry } from '../types/auth';

// ============================================
// Types
// ============================================

export interface ChatMessage {
  role: MessageRole;
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  top_p?: number;
  top_k?: number;
  num_predict?: number;
  stop?: string[];
}

export interface RAGOptions {
  enabled: boolean;
  query?: string;
  searchLimit?: number;
  searchThreshold?: number;
  hybridAlpha?: number; // 0 = pure BM25/keyword, 1 = pure vector/semantic
}

export interface ChatRequest {
  messages: ChatMessage[];
  model?: string | undefined;
  stream?: boolean | undefined;
  options?: ChatOptions | undefined;
  rag?: RAGOptions;
}

export interface RAGSource {
  documentId: string;
  documentName: string;
  content: string;
  pageNumber?: number;
  chunkIndex: number;
  score: number;
}

export interface StreamChunk {
  message?: {
    role: string;
    content: string;
  };
  done: boolean;
  done_reason?: string;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
  // RAG-specific fields
  type?: 'sources' | 'message';
  sources?: RAGSource[];
  hasRelevantSources?: boolean;
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onComplete: (fullResponse: string, metadata?: StreamMetadata) => void;
  onError: (error: Error, partialResponse?: string) => void;
  /** Optional callback for streaming progress updates */
  onProgress?: (progress: StreamProgress) => void;
  /** Optional callback for connection interruption */
  onConnectionInterrupted?: (partialResponse: string, metadata: Partial<StreamMetadata>) => void;
  /** Callback for RAG sources received */
  onSources?: (sources: RAGSource[], hasRelevantSources: boolean) => void;
}

export interface StreamMetadata {
  totalDuration?: number | undefined;
  promptTokens?: number | undefined;
  completionTokens?: number | undefined;
  tokensPerSecond?: number | undefined;
  streamDuration?: number | undefined;
}

export interface StreamProgress {
  /** Number of tokens received so far */
  tokenCount: number;
  /** Time elapsed since stream started (ms) */
  elapsedMs: number;
  /** Current tokens per second */
  tokensPerSecond: number;
}

// ============================================
// API Functions
// ============================================

/**
 * Send a chat request and stream the response
 *
 * Uses Server-Sent Events (SSE) to receive streaming tokens
 * from the Ollama API via our Express backend.
 */
export async function streamChat(
  messages: Message[],
  callbacks: StreamCallbacks,
  options?: {
    model?: string | undefined;
    chatOptions?: ChatOptions | undefined;
    signal?: AbortSignal | null | undefined;
    ragOptions?: RAGOptions;
  }
): Promise<void> {
  const { onToken, onComplete, onError, onProgress, onSources } = callbacks;
  const { model, chatOptions, signal, ragOptions } = options ?? {};

  // Convert Message[] to ChatMessage[] (API format)
  // Filter out messages with empty content (e.g., incomplete streaming messages)
  const chatMessages: ChatMessage[] = messages
    .filter((msg) => msg.content && msg.content.trim().length > 0)
    .map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

  const request: ChatRequest = {
    messages: chatMessages,
    model: model,
    stream: true,
    options: chatOptions,
    ...(ragOptions && { rag: ragOptions }),
  };

  // Variables to track response and metadata across try/catch blocks
  let fullResponse = '';
  let metadata: StreamMetadata = {};

  try {
    // Import httpClient dynamically to avoid circular dependencies
    const { httpClient } = await import('./httpClient');

    // Use httpClient for automatic token management
    const response = await httpClient.request(`${env.API_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: signal ?? null,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        (errorData as { message?: string }).message ||
        `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(errorMessage);
    }

    // Read the SSE stream
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Failed to get response stream reader');
    }

    const decoder = new TextDecoder();

    // Buffer for handling partial SSE chunks
    // SSE data can be split across multiple read() calls
    let buffer = '';

    // Progress tracking
    const streamStartTime = Date.now();
    let tokenCount = 0;

    let connectionInterrupted = false;
    let lastSuccessfulRead = Date.now();
    const CONNECTION_TIMEOUT = 30000; // 30 seconds timeout

    try {
      while (true) {
        try {
          const { done, value } = await reader.read();
          lastSuccessfulRead = Date.now();

          if (done) {
            break;
          }

          // Append decoded chunk to buffer
          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;

          // Process complete lines from buffer
          const lines = buffer.split('\n');
          // Keep the last incomplete line in buffer
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            // Skip empty lines (SSE uses double newlines as separators)
            if (!line.trim()) continue;

            // Skip SSE comments (lines starting with :)
            if (line.startsWith(':')) {
              continue;
            }

            // SSE format: "data: {...}"
            if (line.startsWith('data: ')) {
              const data = line.slice(6); // Remove "data: " prefix

              if (data === '[DONE]') {
                // Stream complete - calculate final stats
                const streamDuration = Date.now() - streamStartTime;
                const tokensPerSecond = streamDuration > 0
                  ? (tokenCount / streamDuration) * 1000
                  : 0;

                metadata.streamDuration = streamDuration;
                metadata.tokensPerSecond = Math.round(tokensPerSecond * 10) / 10;

                onComplete(fullResponse, metadata);
                return;
              }

              try {
                const parsed: StreamChunk = JSON.parse(data);

                // Handle RAG sources (received first)
                if (parsed.type === 'sources' && parsed.sources && onSources) {
                  onSources(parsed.sources, parsed.hasRelevantSources ?? false);
                }

                // Handle regular message content
                if (parsed.message?.content) {
                  const token = parsed.message.content;
                  fullResponse += token;
                  tokenCount++;

                  // Call token callback
                  onToken(token);

                  // Report progress if callback provided
                  if (onProgress) {
                    const elapsedMs = Date.now() - streamStartTime;
                    const tokensPerSecond = elapsedMs > 0
                      ? (tokenCount / elapsedMs) * 1000
                      : 0;

                    onProgress({
                      tokenCount,
                      elapsedMs,
                      tokensPerSecond: Math.round(tokensPerSecond * 10) / 10,
                    });
                  }
                }

                // Capture metadata from final chunk
                if (parsed.done) {
                  metadata = {
                    ...metadata,
                    totalDuration: parsed.total_duration,
                    promptTokens: parsed.prompt_eval_count,
                    completionTokens: parsed.eval_count,
                  };
                }
              } catch {
                // Skip malformed JSON (partial chunk will be handled on next read)
              }
            }
          }
        } catch (readError) {
          // Check if this is a connection interruption
          const timeSinceLastRead = Date.now() - lastSuccessfulRead;

          if (timeSinceLastRead > CONNECTION_TIMEOUT) {
            connectionInterrupted = true;

            // Call connection interrupted callback if partial response exists
            if (fullResponse.trim() && callbacks.onConnectionInterrupted) {
              const streamDuration = Date.now() - streamStartTime;
              const partialMetadata: Partial<StreamMetadata> = {
                streamDuration,
                tokensPerSecond: streamDuration > 0 ? (tokenCount / streamDuration) * 1000 : 0,
              };

              callbacks.onConnectionInterrupted(fullResponse, partialMetadata);
              return;
            }
          }

          // Re-throw the error for other error types
          throw readError;
        }
      }

      // Process any remaining buffer content
      if (buffer.trim() && buffer.startsWith('data: ')) {
        const data = buffer.slice(6);
        if (data !== '[DONE]') {
          try {
            const parsed: StreamChunk = JSON.parse(data);
            if (parsed.message?.content) {
              fullResponse += parsed.message.content;
              tokenCount++;
            }
          } catch {
            // Ignore incomplete final chunk
          }
        }
      }

      // Calculate final duration if we didn't get [DONE]
      const streamDuration = Date.now() - streamStartTime;
      const tokensPerSecond = streamDuration > 0
        ? (tokenCount / streamDuration) * 1000
        : 0;

      metadata.streamDuration = streamDuration;
      metadata.tokensPerSecond = Math.round(tokensPerSecond * 10) / 10;

      // If we get here without [DONE], check if connection was interrupted
      if (connectionInterrupted) {
        // Handle as connection interruption
        if (fullResponse.trim() && callbacks.onConnectionInterrupted) {
          callbacks.onConnectionInterrupted(fullResponse, metadata);
        } else {
          // No partial response, treat as error
          throw new Error('Connection interrupted with no partial response');
        }
      } else {
        // Normal completion without explicit [DONE]
        onComplete(fullResponse, metadata);
      }
    } finally {
      reader.releaseLock();
    }
  } catch (error) {
    if (error instanceof Error) {
      // Don't report abort errors as actual errors
      if (error.name === 'AbortError') {
        onComplete(fullResponse || '', metadata);
        return;
      }

      // Check if we have partial response to include with error
      const partialResponse = fullResponse && fullResponse.trim() ? fullResponse : undefined;
      onError(error, partialResponse);
    } else {
      // Check if we have partial response to include with error
      const partialResponse = fullResponse && fullResponse.trim() ? fullResponse : undefined;
      onError(new Error('Unknown error during chat stream'), partialResponse);
    }
  }
}

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

/**
 * Fetch available models from the backend
 */
export async function fetchModels(): Promise<{
  models: APIModel[];
  defaultModel: string;
}> {
  // Import httpClient dynamically to avoid circular dependencies
  const { api } = await import('./httpClient');

  // Use httpClient for automatic token management
  return api.get<{
    models: APIModel[];
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
  const response = await fetch(`${env.API_URL}/api/documents/${id}`);

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
