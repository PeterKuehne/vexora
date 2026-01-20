/**
 * Custom Error Types for the Vexora API
 *
 * These error classes provide structured error handling with:
 * - HTTP status codes
 * - Error codes for client-side handling
 * - Optional details for debugging
 */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'BAD_GATEWAY'
  | 'OLLAMA_ERROR'
  | 'OLLAMA_CONNECTION_ERROR'
  | 'STREAM_ERROR'

/**
 * Base application error class
 * All custom errors should extend this class
 */
export class AppError extends Error {
  public readonly statusCode: number
  public readonly code: ErrorCode
  public readonly isOperational: boolean
  public readonly details?: unknown

  constructor(
    message: string,
    statusCode: number = 500,
    code: ErrorCode = 'INTERNAL_ERROR',
    details?: unknown
  ) {
    super(message)
    this.statusCode = statusCode
    this.code = code
    this.isOperational = true // Operational errors are expected errors
    this.details = details

    // Maintain proper stack trace (only in V8 engines)
    Error.captureStackTrace(this, this.constructor)
    Object.setPrototypeOf(this, AppError.prototype)
  }

  toJSON(): Record<string, unknown> {
    const result: Record<string, unknown> = {
      error: this.message,
      code: this.code,
      statusCode: this.statusCode,
    }
    if (this.details !== undefined) {
      result.details = this.details
    }
    return result
  }
}

/**
 * 400 Bad Request - Validation errors
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details)
    Object.setPrototypeOf(this, ValidationError.prototype)
  }
}

/**
 * 404 Not Found
 */
export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND')
    Object.setPrototypeOf(this, NotFoundError.prototype)
  }
}

/**
 * 401 Unauthorized
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED')
    Object.setPrototypeOf(this, UnauthorizedError.prototype)
  }
}

/**
 * 403 Forbidden
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN')
    Object.setPrototypeOf(this, ForbiddenError.prototype)
  }
}

/**
 * 409 Conflict
 */
export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 409, 'CONFLICT', details)
    Object.setPrototypeOf(this, ConflictError.prototype)
  }
}

/**
 * 503 Service Unavailable - External service down
 */
export class ServiceUnavailableError extends AppError {
  constructor(service: string, details?: unknown) {
    super(`${service} is not available`, 503, 'SERVICE_UNAVAILABLE', details)
    Object.setPrototypeOf(this, ServiceUnavailableError.prototype)
  }
}

/**
 * 502 Bad Gateway - External service error
 */
export class BadGatewayError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 502, 'BAD_GATEWAY', details)
    Object.setPrototypeOf(this, BadGatewayError.prototype)
  }
}

/**
 * Ollama-specific connection error
 */
export class OllamaConnectionError extends AppError {
  constructor(url: string) {
    super('Ollama is not running', 503, 'OLLAMA_CONNECTION_ERROR', {
      url,
      help: 'Please start Ollama with: ollama serve',
    })
    Object.setPrototypeOf(this, OllamaConnectionError.prototype)
  }
}

/**
 * Ollama API error
 */
export class OllamaError extends AppError {
  constructor(message: string, statusCode: number = 502, details?: unknown) {
    super(message, statusCode, 'OLLAMA_ERROR', details)
    Object.setPrototypeOf(this, OllamaError.prototype)
  }
}

/**
 * Streaming error
 */
export class StreamError extends AppError {
  constructor(message: string = 'Stream interrupted', details?: unknown) {
    super(message, 500, 'STREAM_ERROR', details)
    Object.setPrototypeOf(this, StreamError.prototype)
  }
}

/**
 * Type guard to check if error is an AppError
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}

/**
 * Helper to convert unknown errors to AppError
 */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) {
    return error
  }

  if (error instanceof Error) {
    // Check for common error patterns
    if (error.message.includes('ECONNREFUSED')) {
      return new ServiceUnavailableError('External service', {
        originalError: error.message,
      })
    }

    return new AppError(error.message, 500, 'INTERNAL_ERROR', {
      originalError: error.message,
      stack: error.stack,
    })
  }

  return new AppError('An unexpected error occurred', 500, 'INTERNAL_ERROR', {
    originalError: String(error),
  })
}
