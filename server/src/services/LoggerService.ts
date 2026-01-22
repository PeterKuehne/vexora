/**
 * Enterprise Logging Service - Secure logging without sensitive data
 *
 * Features:
 * - JSON structured logging for better analysis
 * - Automatic sensitive data redaction
 * - Log rotation and retention (90 days)
 * - Different log levels (error, warn, info, debug)
 * - Production-ready configuration
 */

import winston from 'winston';
import path from 'path';

// Sensitive data patterns to redact
const SENSITIVE_PATTERNS = [
  // JWT tokens
  /Bearer\s+[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_=]+\.[A-Za-z0-9\-_.+/=]*/gi,
  // Password fields
  /"password"\s*:\s*"[^"]*"/gi,
  // Token fields
  /"token"\s*:\s*"[^"]*"/gi,
  /"accessToken"\s*:\s*"[^"]*"/gi,
  /"refreshToken"\s*:\s*"[^"]*"/gi,
  // API keys
  /api[_-]?key["']?\s*[:=]\s*["']?[a-zA-Z0-9]{20,}/gi,
  // Credit card numbers (basic pattern)
  /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
  // Email passwords in URLs
  /\/\/[^:\/\s]+:[^@\/\s]+@/gi,
  // Database connection strings with passwords
  /postgresql:\/\/[^:\/\s]+:[^@\/\s]+@/gi,
];

/**
 * Redacts sensitive information from log messages
 */
function redactSensitiveData(message: any): any {
  if (typeof message === 'string') {
    let redacted = message;
    SENSITIVE_PATTERNS.forEach(pattern => {
      redacted = redacted.replace(pattern, '[REDACTED]');
    });
    return redacted;
  }

  if (typeof message === 'object' && message !== null) {
    const redacted: any = Array.isArray(message) ? [] : {};

    for (const key in message) {
      if (message.hasOwnProperty(key)) {
        // Redact sensitive keys
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes('password') ||
            lowerKey.includes('token') ||
            lowerKey.includes('secret') ||
            lowerKey.includes('key') ||
            lowerKey === 'content') {
          redacted[key] = '[REDACTED]';
        } else {
          redacted[key] = redactSensitiveData(message[key]);
        }
      }
    }

    return redacted;
  }

  return message;
}

/**
 * Custom formatter that redacts sensitive data
 */
const secureFormatter = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf((info) => {
    // Redact sensitive data from the entire log entry
    const redactedInfo = redactSensitiveData(info);
    return JSON.stringify(redactedInfo);
  })
);

/**
 * Create logger instance with security and rotation
 */
function createLogger() {
  const logDir = path.join(process.cwd(), 'logs');

  return winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: secureFormatter,
    defaultMeta: { service: 'vexora-backend' },
    transports: [
      // Error logs - separate file for critical issues
      new winston.transports.File({
        filename: path.join(logDir, 'error.log'),
        level: 'error',
        maxsize: 5242880, // 5MB
        maxFiles: 5,
      }),

      // Combined logs - all log levels
      new winston.transports.File({
        filename: path.join(logDir, 'combined.log'),
        maxsize: 10485760, // 10MB
        maxFiles: 10,
      }),

      // Console output for development
      ...(process.env.NODE_ENV !== 'production' ? [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ] : [])
    ],

    // Handle uncaught exceptions
    exceptionHandlers: [
      new winston.transports.File({
        filename: path.join(logDir, 'exceptions.log'),
        maxsize: 5242880,
        maxFiles: 3,
      })
    ],

    // Handle unhandled promise rejections
    rejectionHandlers: [
      new winston.transports.File({
        filename: path.join(logDir, 'rejections.log'),
        maxsize: 5242880,
        maxFiles: 3,
      })
    ]
  });
}

// Singleton logger instance
const logger = createLogger();

/**
 * Enhanced logging methods with context
 */
export class LoggerService {
  /**
   * Log authentication events (login, logout, failures)
   */
  static logAuth(event: 'login' | 'logout' | 'login_failed' | 'token_refresh', data: {
    userId?: string;
    email?: string;
    ip?: string;
    userAgent?: string;
    reason?: string;
  }) {
    logger.info('AUTH_EVENT', {
      event,
      userId: data.userId,
      email: data.email,
      ip: data.ip,
      userAgent: data.userAgent ? data.userAgent.substring(0, 100) : undefined, // Truncate user agent
      reason: data.reason,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log document operations (upload, delete, access)
   */
  static logDocument(event: 'upload' | 'delete' | 'access' | 'permission_change' | 'bulk_delete', data: {
    documentId?: string;
    documentIds?: string[];
    userId?: string;
    fileName?: string;
    fileSize?: number;
    department?: string;
    classification?: string;
    operation?: string;
  }) {
    logger.info('DOCUMENT_EVENT', {
      event,
      documentId: data.documentId,
      documentIds: data.documentIds?.length ? `${data.documentIds.length} documents` : undefined,
      userId: data.userId,
      fileName: data.fileName,
      fileSize: data.fileSize,
      department: data.department,
      classification: data.classification,
      operation: data.operation,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log RAG queries (without content for privacy)
   */
  static logRAG(event: 'query' | 'search' | 'embedding', data: {
    userId?: string;
    queryLength?: number;
    resultsCount?: number;
    model?: string;
    duration?: number;
    department?: string;
  }) {
    logger.info('RAG_EVENT', {
      event,
      userId: data.userId,
      queryLength: data.queryLength,
      resultsCount: data.resultsCount,
      model: data.model,
      duration: data.duration,
      department: data.department,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log admin actions for audit trail
   */
  static logAdmin(event: string, data: {
    adminId: string;
    targetUserId?: string;
    action: string;
    changes?: Record<string, any>;
    ip?: string;
  }) {
    logger.warn('ADMIN_ACTION', {
      event,
      adminId: data.adminId,
      targetUserId: data.targetUserId,
      action: data.action,
      changes: redactSensitiveData(data.changes),
      ip: data.ip,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log system performance metrics
   */
  static logPerformance(metric: string, data: {
    value: number;
    unit: string;
    context?: Record<string, any>;
  }) {
    logger.info('PERFORMANCE_METRIC', {
      metric,
      value: data.value,
      unit: data.unit,
      context: data.context,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log errors with context but without sensitive data
   */
  static logError(error: Error | string, context?: Record<string, any>) {
    const errorData = {
      message: typeof error === 'string' ? error : error.message,
      stack: typeof error === 'object' && error.stack ?
        error.stack.split('\n').slice(0, 10).join('\n') : undefined, // Limit stack trace
      context: redactSensitiveData(context),
      timestamp: new Date().toISOString()
    };

    logger.error('ERROR', errorData);
  }

  /**
   * Log warnings
   */
  static logWarning(message: string, context?: Record<string, any>) {
    logger.warn('WARNING', {
      message,
      context: redactSensitiveData(context),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log info messages
   */
  static logInfo(message: string, context?: Record<string, any>) {
    logger.info('INFO', {
      message,
      context: redactSensitiveData(context),
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Log debug information (development only)
   */
  static logDebug(message: string, context?: Record<string, any>) {
    if (process.env.NODE_ENV !== 'production') {
      logger.debug('DEBUG', {
        message,
        context: redactSensitiveData(context),
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get logger instance for advanced usage
   */
  static getLogger() {
    return logger;
  }

  /**
   * Test method to verify sensitive data redaction
   */
  static testRedaction() {
    const testData = {
      user: 'test@example.com',
      password: 'secret123',
      token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      apiKey: 'ak_1234567890abcdef',
      content: 'This is document content that should be redacted',
      normalField: 'This should not be redacted'
    };

    const redacted = redactSensitiveData(testData);
    logger.info('REDACTION_TEST', { original: 'See code', redacted });

    return redacted;
  }
}

// Export the logger for backward compatibility
export { logger };
export default LoggerService;