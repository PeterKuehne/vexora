import type { Request, Response, NextFunction, ErrorRequestHandler } from 'express'
import { AppError, isAppError, toAppError } from '../errors/index.js'
import { env } from '../config/env.js'

/**
 * Error response structure sent to clients
 */
interface ErrorResponse {
  error: string
  code: string
  statusCode: number
  details?: unknown
  stack?: string
  timestamp: string
  path: string
  method: string
}

/**
 * Log error with structured format
 */
function logError(error: AppError, req: Request): void {
  const level = error.statusCode >= 500 ? 'error' : 'warn'
  const logEntry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    code: error.code,
    statusCode: error.statusCode,
    message: error.message,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent'),
  }

  if (error.details) {
    logEntry.details = error.details
  }
  if (error.statusCode >= 500 && error.stack) {
    logEntry.stack = error.stack
  }

  // In production, use structured JSON logging
  // In development, use more readable format
  if (env.NODE_ENV === 'production') {
    console.error(JSON.stringify(logEntry))
  } else {
    const emoji = error.statusCode >= 500 ? '❌' : '⚠️'
    console.error(
      `${emoji} [${level.toUpperCase()}] ${error.code}: ${error.message}`
    )
    console.error(`   Path: ${req.method} ${req.path}`)
    if (error.details) {
      console.error(`   Details:`, error.details)
    }
    if (error.statusCode >= 500 && error.stack) {
      console.error(`   Stack:`, error.stack)
    }
  }
}

/**
 * Central error handling middleware for Express
 *
 * This middleware should be registered LAST, after all routes.
 * It catches all errors thrown or passed via next(error).
 *
 * Features:
 * - Converts unknown errors to AppError
 * - Logs errors with appropriate severity
 * - Returns consistent JSON error responses
 * - Hides stack traces in production
 */
export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Convert to AppError for consistent handling
  const error = isAppError(err) ? err : toAppError(err)

  // Log the error
  logError(error, req)

  // Build error response
  const response: ErrorResponse = {
    error: error.message,
    code: error.code,
    statusCode: error.statusCode,
    timestamp: new Date().toISOString(),
    path: req.path,
    method: req.method,
  }

  // Include details if available (useful for validation errors)
  if (error.details) {
    response.details = error.details
  }

  // Include stack trace only in development
  if (env.NODE_ENV === 'development' && error.stack) {
    response.stack = error.stack
  }

  // Send response
  res.status(error.statusCode).json(response)
}

/**
 * Async handler wrapper
 *
 * Wraps async route handlers to catch errors and pass them to the error middleware.
 * This eliminates the need for try/catch in every route handler.
 *
 * Usage:
 * app.get('/api/endpoint', asyncHandler(async (req, res) => {
 *   // async code that might throw
 * }))
 */
export function asyncHandler<T>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<T>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

/**
 * 404 Not Found handler
 *
 * This middleware should be registered after all routes but before errorHandler.
 * It catches requests that don't match any route.
 */
export function notFoundHandler(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const error = new AppError(
    `Route not found: ${req.method} ${req.path}`,
    404,
    'NOT_FOUND'
  )
  next(error)
}
