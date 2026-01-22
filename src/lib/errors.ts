/**
 * Error Handling Utilities
 *
 * Centralizes error handling logic with user-friendly messages,
 * retry mechanisms, and consistent error categorization.
 */

// ============================================
// Error Types & Categories
// ============================================

export type ErrorCategory =
  | 'network'
  | 'auth'
  | 'validation'
  | 'server'
  | 'timeout'
  | 'file'
  | 'permission'
  | 'unknown';

export interface UserFriendlyError {
  category: ErrorCategory;
  title: string;
  message: string;
  technical?: string;
  retryable: boolean;
  retryAfter?: number; // seconds
}

// ============================================
// Error Categories & Messages
// ============================================

const ERROR_MESSAGES: Record<ErrorCategory, {
  title: string;
  messages: Record<string, string>;
  defaultMessage: string;
  retryable: boolean;
  retryAfter?: number;
}> = {
  network: {
    title: 'Verbindungsproblem',
    messages: {
      offline: 'Sie sind offline. Bitte überprüfen Sie Ihre Internetverbindung.',
      timeout: 'Die Anfrage ist abgelaufen. Bitte versuchen Sie es erneut.',
      connection_refused: 'Der Server ist momentan nicht erreichbar. Bitte versuchen Sie es später erneut.'
    },
    defaultMessage: 'Es gab ein Problem mit der Netzwerkverbindung. Bitte versuchen Sie es erneut.',
    retryable: true,
    retryAfter: 5
  },
  auth: {
    title: 'Authentifizierungsfehler',
    messages: {
      invalid_credentials: 'Ihre Anmeldedaten sind ungültig. Bitte loggen Sie sich erneut ein.',
      session_expired: 'Ihre Sitzung ist abgelaufen. Sie werden zur Anmeldeseite weitergeleitet.',
      unauthorized: 'Sie haben keine Berechtigung für diese Aktion.',
      forbidden: 'Der Zugriff auf diese Ressource ist nicht erlaubt.'
    },
    defaultMessage: 'Es gab ein Problem mit der Authentifizierung. Bitte loggen Sie sich erneut ein.',
    retryable: false
  },
  validation: {
    title: 'Eingabefehler',
    messages: {
      invalid_file_type: 'Dieser Dateityp wird nicht unterstützt. Erlaubt sind nur PDF-Dateien.',
      file_too_large: 'Die Datei ist zu groß. Maximale Dateigröße: 10 MB.',
      invalid_file_name: 'Der Dateiname enthält ungültige Zeichen.',
      missing_required_field: 'Bitte füllen Sie alle erforderlichen Felder aus.'
    },
    defaultMessage: 'Die eingegebenen Daten sind ungültig. Bitte überprüfen Sie Ihre Eingaben.',
    retryable: false
  },
  server: {
    title: 'Server-Problem',
    messages: {
      internal_error: 'Es ist ein interner Server-Fehler aufgetreten. Unser Team wurde benachrichtigt.',
      service_unavailable: 'Der Service ist temporär nicht verfügbar. Bitte versuchen Sie es später erneut.',
      maintenance: 'Der Service wird gerade gewartet. Bitte versuchen Sie es in wenigen Minuten erneut.',
      rate_limit: 'Zu viele Anfragen. Bitte warten Sie einen Moment und versuchen Sie es erneut.'
    },
    defaultMessage: 'Es gab ein Problem mit dem Server. Bitte versuchen Sie es später erneut.',
    retryable: true,
    retryAfter: 10
  },
  timeout: {
    title: 'Zeitüberschreitung',
    messages: {
      request_timeout: 'Die Anfrage dauert länger als erwartet. Bitte versuchen Sie es erneut.',
      upload_timeout: 'Der Upload dauert zu lange. Bitte versuchen Sie es mit einer kleineren Datei.',
      processing_timeout: 'Die Verarbeitung dauert länger als erwartet. Bitte überprüfen Sie den Status später.'
    },
    defaultMessage: 'Die Anfrage dauert zu lange. Bitte versuchen Sie es erneut.',
    retryable: true,
    retryAfter: 3
  },
  file: {
    title: 'Dateiproblem',
    messages: {
      corrupted: 'Die Datei ist beschädigt und kann nicht verarbeitet werden.',
      read_error: 'Die Datei konnte nicht gelesen werden. Bitte versuchen Sie es erneut.',
      processing_failed: 'Die Datei konnte nicht verarbeitet werden. Bitte überprüfen Sie das Dateiformat.',
      storage_full: 'Der Speicherplatz ist voll. Bitte löschen Sie einige Dateien und versuchen Sie es erneut.'
    },
    defaultMessage: 'Es gab ein Problem mit der Datei. Bitte überprüfen Sie die Datei und versuchen Sie es erneut.',
    retryable: false
  },
  permission: {
    title: 'Berechtigung fehlt',
    messages: {
      insufficient_permissions: 'Sie haben nicht die erforderlichen Berechtigungen für diese Aktion.',
      role_required: 'Diese Aktion erfordert eine höhere Berechtigung.',
      department_access: 'Sie haben keinen Zugriff auf Dokumente dieser Abteilung.',
      owner_only: 'Nur der Besitzer kann diese Aktion ausführen.'
    },
    defaultMessage: 'Sie haben nicht die erforderlichen Berechtigungen für diese Aktion.',
    retryable: false
  },
  unknown: {
    title: 'Unbekannter Fehler',
    messages: {},
    defaultMessage: 'Es ist ein unerwarteter Fehler aufgetreten. Bitte versuchen Sie es erneut.',
    retryable: true,
    retryAfter: 5
  }
};

// ============================================
// Error Processing Functions
// ============================================

/**
 * Converts any error to a user-friendly error object
 */
export function processError(error: unknown): UserFriendlyError {
  // Network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return createUserFriendlyError('network', 'connection_refused', String(error));
  }

  // API errors with structured response
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Check for specific error patterns
    if (message.includes('timeout') || message.includes('aborted')) {
      return createUserFriendlyError('timeout', 'request_timeout', error.message);
    }

    if (message.includes('401') || message.includes('unauthorized')) {
      return createUserFriendlyError('auth', 'unauthorized', error.message);
    }

    if (message.includes('403') || message.includes('forbidden')) {
      return createUserFriendlyError('auth', 'forbidden', error.message);
    }

    if (message.includes('404')) {
      return createUserFriendlyError('server', 'service_unavailable', error.message);
    }

    if (message.includes('429')) {
      return createUserFriendlyError('server', 'rate_limit', error.message);
    }

    if (message.includes('500') || message.includes('502') || message.includes('503')) {
      return createUserFriendlyError('server', 'service_unavailable', error.message);
    }

    if (message.includes('file') && message.includes('type')) {
      return createUserFriendlyError('validation', 'invalid_file_type', error.message);
    }

    if (message.includes('size') && message.includes('large')) {
      return createUserFriendlyError('validation', 'file_too_large', error.message);
    }
  }

  // Check if offline
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return createUserFriendlyError('network', 'offline');
  }

  // Default unknown error
  return createUserFriendlyError('unknown', '', String(error));
}

/**
 * Creates a user-friendly error object
 */
function createUserFriendlyError(
  category: ErrorCategory,
  messageKey: string,
  technical?: string
): UserFriendlyError {
  const config = ERROR_MESSAGES[category];
  const message = config.messages[messageKey] || config.defaultMessage;

  return {
    category,
    title: config.title,
    message,
    ...(technical !== undefined && { technical }),
    retryable: config.retryable,
    ...(config.retryAfter !== undefined && { retryAfter: config.retryAfter })
  };
}

// ============================================
// File Validation
// ============================================

export interface FileValidationResult {
  valid: boolean;
  error?: UserFriendlyError;
}

/**
 * Validates file for upload
 */
export function validateFile(file: File): FileValidationResult {
  const MAX_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_TYPES = ['application/pdf'];

  // Check file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: createUserFriendlyError('validation', 'invalid_file_type')
    };
  }

  // Check file size
  if (file.size > MAX_SIZE) {
    return {
      valid: false,
      error: createUserFriendlyError('validation', 'file_too_large')
    };
  }

  // Check file name
  const invalidChars = /[<>:"/\\|?*]/;
  if (invalidChars.test(file.name)) {
    return {
      valid: false,
      error: createUserFriendlyError('validation', 'invalid_file_name')
    };
  }

  return { valid: true };
}

// ============================================
// Retry Logic
// ============================================

export interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number; // milliseconds
  maxDelay?: number; // milliseconds
  backoffFactor?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

/**
 * Exponential backoff retry function
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    backoffFactor = 2,
    onRetry
  } = options;

  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt === maxAttempts) {
        break;
      }

      // Check if error is retryable
      const userFriendlyError = processError(error);
      if (!userFriendlyError.retryable) {
        break;
      }

      // Calculate delay
      const delay = Math.min(baseDelay * Math.pow(backoffFactor, attempt - 1), maxDelay);

      // Call retry callback
      if (onRetry) {
        onRetry(attempt, lastError);
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

export default {
  processError,
  validateFile,
  retryWithBackoff
};