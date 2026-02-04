/**
 * HTTP Client with Automatic Token Management
 *
 * Provides automatic token refresh and retry logic for API calls.
 * Handles 401 responses by attempting token refresh and retrying the original request.
 * Automatically logs out on refresh token failure.
 */

import { env } from './env';

// Types
export interface HttpClientOptions {
  headers?: Record<string, string>;
  skipAuth?: boolean;
  retryOnUnauthorized?: boolean;
}

export interface RefreshTokenResponse {
  access_token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    department: string;
  };
}

/**
 * HTTP Client class with automatic token management
 */
class HttpClient {
  private isRefreshing = false;
  private refreshPromise: Promise<boolean | 'rate_limited'> | null = null;

  /**
   * Make an authenticated HTTP request with automatic token management
   */
  async request(
    url: string,
    options: RequestInit & HttpClientOptions = {}
  ): Promise<Response> {
    const { skipAuth = false, retryOnUnauthorized = true, headers = {}, ...fetchOptions } = options;

    // Prepare headers
    const requestHeaders = {
      'Content-Type': 'application/json',
      ...headers,
    };

    // Make initial request
    const response = await fetch(url, {
      ...fetchOptions,
      credentials: 'include', // Always include cookies for auth
      headers: requestHeaders,
    });

    // Handle 401 Unauthorized responses
    if (response.status === 401 && !skipAuth && retryOnUnauthorized) {
      const refreshResult = await this.handleUnauthorized();

      if (refreshResult === true) {
        // Retry original request after successful refresh
        return fetch(url, {
          ...fetchOptions,
          credentials: 'include',
          headers: requestHeaders,
        });
      } else if (refreshResult === 'rate_limited') {
        // Rate limited - don't logout, just return the 401 response
        console.warn('⚠️ Cannot refresh token due to rate limit - returning 401');
        return response;
      } else {
        // Genuine refresh failure - logout and throw
        await this.handleLogout();
        throw new Error('Session expired. Please log in again.');
      }
    }

    return response;
  }

  /**
   * Helper methods for common HTTP verbs
   */
  async get(url: string, options: HttpClientOptions = {}): Promise<Response> {
    return this.request(url, { method: 'GET', ...options });
  }

  async post(url: string, data?: any, options: HttpClientOptions = {}): Promise<Response> {
    return this.request(url, {
      method: 'POST',
      body: data ? JSON.stringify(data) : null,
      ...options,
    });
  }

  async put(url: string, data?: any, options: HttpClientOptions = {}): Promise<Response> {
    return this.request(url, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : null,
      ...options,
    });
  }

  async patch(url: string, data?: any, options: HttpClientOptions = {}): Promise<Response> {
    return this.request(url, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : null,
      ...options,
    });
  }

  async delete(url: string, options: HttpClientOptions = {}): Promise<Response> {
    return this.request(url, { method: 'DELETE', ...options });
  }

  /**
   * Handle 401 unauthorized response
   * Attempts token refresh and returns success/failure/'rate_limited'
   */
  private async handleUnauthorized(): Promise<boolean | 'rate_limited'> {
    // Prevent multiple simultaneous refresh attempts
    if (this.isRefreshing) {
      return this.refreshPromise || Promise.resolve(false);
    }

    this.isRefreshing = true;
    this.refreshPromise = this.attemptTokenRefresh();

    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  /**
   * Attempt to refresh access token using refresh token
   * Returns: true = success, false = auth failure, 'rate_limited' = temporary rate limit
   */
  private async attemptTokenRefresh(): Promise<boolean | 'rate_limited'> {
    try {
      console.log('🔄 Attempting token refresh...');

      const response = await fetch(`${env.API_URL}/api/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data: RefreshTokenResponse = await response.json();
        console.log('✅ Token refresh successful');

        // Dispatch custom event to notify AuthContext
        window.dispatchEvent(new CustomEvent('auth:token-refreshed', {
          detail: { user: data.user }
        }));

        return true;
      } else if (response.status === 429) {
        // Rate limit - don't logout, return special value
        console.warn('⚠️ Token refresh rate limited - will NOT logout user');
        const errorData = await response.json().catch(() => ({}));
        console.log('Rate limit info:', errorData);
        return 'rate_limited'; // Special return value - don't logout
      } else {
        // Other errors (401, 403, etc.) - genuine auth failure
        console.log('❌ Token refresh failed:', response.status);
        return false;
      }
    } catch (error) {
      console.error('❌ Token refresh error:', error);
      return false;
    }
  }

  /**
   * Handle logout (clear auth state)
   */
  private async handleLogout(): Promise<void> {
    try {
      // Call logout endpoint to clear server-side session
      await fetch(`${env.API_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout request failed:', error);
    }

    // Dispatch logout event to AuthContext
    window.dispatchEvent(new CustomEvent('auth:logout'));
  }
}

// Export singleton instance
export const httpClient = new HttpClient();

/**
 * Convenience function for making authenticated API calls
 * Uses the centralized httpClient with automatic token management
 */
export async function apiCall<T = any>(
  url: string,
  options: RequestInit & HttpClientOptions = {}
): Promise<T> {
  const response = await httpClient.request(url, options);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.message || `HTTP ${response.status}: ${response.statusText}`;
    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * Convenience functions for common HTTP operations
 */
export const api = {
  get: async <T = any>(url: string, options: HttpClientOptions = {}): Promise<T> => {
    const response = await httpClient.get(url, options);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(errorMessage);
    }
    return response.json();
  },

  post: async <T = any>(url: string, data?: any, options: HttpClientOptions = {}): Promise<T> => {
    const response = await httpClient.post(url, data, options);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(errorMessage);
    }
    return response.json();
  },

  put: async <T = any>(url: string, data?: any, options: HttpClientOptions = {}): Promise<T> => {
    const response = await httpClient.put(url, data, options);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(errorMessage);
    }
    return response.json();
  },

  patch: async <T = any>(url: string, data?: any, options: HttpClientOptions = {}): Promise<T> => {
    const response = await httpClient.patch(url, data, options);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(errorMessage);
    }
    return response.json();
  },

  delete: async <T = any>(url: string, options: HttpClientOptions = {}): Promise<T> => {
    const response = await httpClient.delete(url, options);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.message || errorData.error || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(errorMessage);
    }
    return response.json();
  },
};