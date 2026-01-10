/**
 * Error Handler - Centralized Error Handling für API-Requests
 *
 * Provides utilities for handling network errors, categorizing them,
 * and providing user-friendly messages with retry capabilities.
 */

// ============================================
// Types
// ============================================

export type ErrorCategory =
  | 'network'      // Network/connection issues
  | 'timeout'      // Request timeout
  | 'server'       // Server errors (5xx)
  | 'client'       // Client errors (4xx)
  | 'auth'         // Authentication errors (401, 403)
  | 'validation'   // Validation errors (400)
  | 'not_found'    // Not found (404)
  | 'ollama'       // Ollama-specific errors
  | 'unknown';     // Unknown errors

export interface ParsedError {
  category: ErrorCategory;
  message: string;
  userMessage: string;
  isRetryable: boolean;
  statusCode?: number;
  originalError: unknown;
}

// ============================================
// Error Messages (German)
// ============================================

const USER_MESSAGES: Record<ErrorCategory, string> = {
  network: 'Netzwerkverbindung fehlgeschlagen. Bitte überprüfe deine Internetverbindung.',
  timeout: 'Die Anfrage hat zu lange gedauert. Bitte versuche es erneut.',
  server: 'Ein Serverfehler ist aufgetreten. Bitte versuche es später erneut.',
  client: 'Die Anfrage konnte nicht verarbeitet werden.',
  auth: 'Du bist nicht berechtigt, diese Aktion auszuführen.',
  validation: 'Die eingegebenen Daten sind ungültig.',
  not_found: 'Die angeforderte Ressource wurde nicht gefunden.',
  ollama: 'Ollama ist nicht erreichbar. Stelle sicher, dass der Server läuft.',
  unknown: 'Ein unerwarteter Fehler ist aufgetreten.',
};

/**
 * Categories that are considered retryable
 * Used in parseError to set the isRetryable flag
 */
export const RETRYABLE_CATEGORIES: readonly ErrorCategory[] = ['network', 'timeout', 'server', 'ollama'] as const;

// ============================================
// Error Parsing
// ============================================

/**
 * Parse an error and return structured error information
 */
export function parseError(error: unknown): ParsedError {
  // Handle AbortError (user cancelled)
  if (error instanceof DOMException && error.name === 'AbortError') {
    return {
      category: 'unknown',
      message: 'Request aborted',
      userMessage: 'Anfrage wurde abgebrochen.',
      isRetryable: false,
      originalError: error,
    };
  }

  // Handle TypeError (network errors, CORS, etc.)
  if (error instanceof TypeError) {
    const message = error.message.toLowerCase();

    // Network error patterns
    if (
      message.includes('failed to fetch') ||
      message.includes('network') ||
      message.includes('networkerror')
    ) {
      return {
        category: 'network',
        message: error.message,
        userMessage: USER_MESSAGES.network,
        isRetryable: true,
        originalError: error,
      };
    }

    // CORS errors often manifest as TypeErrors
    if (message.includes('cors') || message.includes('cross-origin')) {
      return {
        category: 'network',
        message: error.message,
        userMessage: 'CORS-Fehler: Der Server erlaubt keine Anfragen von dieser Domain.',
        isRetryable: false,
        originalError: error,
      };
    }
  }

  // Handle standard Error objects
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Timeout errors
    if (message.includes('timeout') || message.includes('timed out')) {
      return {
        category: 'timeout',
        message: error.message,
        userMessage: USER_MESSAGES.timeout,
        isRetryable: true,
        originalError: error,
      };
    }

    // Ollama-specific errors
    if (
      message.includes('ollama') ||
      message.includes('11434') ||
      message.includes('model not found')
    ) {
      return {
        category: 'ollama',
        message: error.message,
        userMessage: USER_MESSAGES.ollama,
        isRetryable: true,
        originalError: error,
      };
    }

    // HTTP status code errors (from our API client)
    const httpMatch = message.match(/http\s*(\d{3})/i);
    if (httpMatch) {
      const statusCode = parseInt(httpMatch[1], 10);
      return parseHttpStatusError(statusCode, error.message, error);
    }

    // Generic network error
    if (message.includes('network') || message.includes('connection')) {
      return {
        category: 'network',
        message: error.message,
        userMessage: USER_MESSAGES.network,
        isRetryable: true,
        originalError: error,
      };
    }

    // Default for Error objects
    return {
      category: 'unknown',
      message: error.message,
      userMessage: error.message || USER_MESSAGES.unknown,
      isRetryable: false,
      originalError: error,
    };
  }

  // Unknown error type
  return {
    category: 'unknown',
    message: String(error),
    userMessage: USER_MESSAGES.unknown,
    isRetryable: false,
    originalError: error,
  };
}

/**
 * Parse HTTP status code errors
 */
function parseHttpStatusError(
  statusCode: number,
  message: string,
  originalError: unknown
): ParsedError {
  if (statusCode === 400) {
    return {
      category: 'validation',
      message,
      userMessage: message || USER_MESSAGES.validation,
      isRetryable: false,
      statusCode,
      originalError,
    };
  }

  if (statusCode === 401 || statusCode === 403) {
    return {
      category: 'auth',
      message,
      userMessage: USER_MESSAGES.auth,
      isRetryable: false,
      statusCode,
      originalError,
    };
  }

  if (statusCode === 404) {
    return {
      category: 'not_found',
      message,
      userMessage: USER_MESSAGES.not_found,
      isRetryable: false,
      statusCode,
      originalError,
    };
  }

  if (statusCode === 408) {
    return {
      category: 'timeout',
      message,
      userMessage: USER_MESSAGES.timeout,
      isRetryable: true,
      statusCode,
      originalError,
    };
  }

  if (statusCode >= 500 && statusCode < 600) {
    // Check for Ollama-specific 503
    if (statusCode === 503 && message.toLowerCase().includes('ollama')) {
      return {
        category: 'ollama',
        message,
        userMessage: USER_MESSAGES.ollama,
        isRetryable: true,
        statusCode,
        originalError,
      };
    }

    return {
      category: 'server',
      message,
      userMessage: USER_MESSAGES.server,
      isRetryable: true,
      statusCode,
      originalError,
    };
  }

  if (statusCode >= 400 && statusCode < 500) {
    return {
      category: 'client',
      message,
      userMessage: message || USER_MESSAGES.client,
      isRetryable: false,
      statusCode,
      originalError,
    };
  }

  return {
    category: 'unknown',
    message,
    userMessage: USER_MESSAGES.unknown,
    isRetryable: false,
    statusCode,
    originalError,
  };
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  const parsed = parseError(error);
  return parsed.isRetryable;
}

/**
 * Check if an error is a network error
 */
export function isNetworkError(error: unknown): boolean {
  const parsed = parseError(error);
  return parsed.category === 'network' || parsed.category === 'timeout';
}

/**
 * Check if an error is an Ollama error
 */
export function isOllamaError(error: unknown): boolean {
  const parsed = parseError(error);
  return parsed.category === 'ollama';
}

/**
 * Get a user-friendly error message
 */
export function getUserFriendlyMessage(error: unknown): string {
  const parsed = parseError(error);
  return parsed.userMessage;
}

// ============================================
// Retry Logic
// ============================================

export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Initial delay in ms */
  initialDelay?: number;
  /** Maximum delay in ms */
  maxDelay?: number;
  /** Multiplier for exponential backoff */
  backoffMultiplier?: number;
  /** Callback for each retry attempt */
  onRetry?: (attempt: number, error: ParsedError) => void;
  /** AbortSignal to cancel retries */
  signal?: AbortSignal;
}

const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, 'onRetry' | 'signal'>> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
};

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: unknown;
  let delay = opts.initialDelay;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    // Check if aborted
    if (opts.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const parsed = parseError(error);

      // Don't retry non-retryable errors
      if (!parsed.isRetryable || attempt >= opts.maxRetries) {
        throw error;
      }

      // Notify about retry
      if (opts.onRetry) {
        opts.onRetry(attempt + 1, parsed);
      }

      // Wait before retry (with jitter)
      const jitter = Math.random() * 200;
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, delay + jitter);

        // Handle abort during wait
        if (opts.signal) {
          opts.signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }
      });

      // Increase delay for next attempt (exponential backoff)
      delay = Math.min(delay * opts.backoffMultiplier, opts.maxDelay);
    }
  }

  throw lastError;
}
