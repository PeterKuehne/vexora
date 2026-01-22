/**
 * Security Middleware - HTTPS Enforcement, Security Headers, CSP, HSTS
 * Implements comprehensive security headers for production environment
 */

import express, { type Request, type Response, type NextFunction } from 'express'
import { env } from '../config/env.js'

/**
 * HTTPS Enforcement Middleware
 * Redirects HTTP to HTTPS in production for OAuth2 security
 */
export const enforceHTTPS = (req: Request, res: Response, next: NextFunction): void => {
  // Only enforce HTTPS in production
  if (!env.isProduction) {
    return next()
  }

  // Check if request is already HTTPS
  const isHTTPS = req.secure ||
                  req.headers['x-forwarded-proto'] === 'https' ||
                  req.headers['x-forwarded-ssl'] === 'on'

  // Redirect HTTP to HTTPS for OAuth2 callbacks
  if (!isHTTPS) {
    const redirectUrl = `https://${req.get('host')}${req.url}`
    res.redirect(301, redirectUrl)
    return
  }

  next()
}

/**
 * Comprehensive Security Headers Middleware
 * Implements defense against XSS, Clickjacking, CSRF, and other attacks
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Content Security Policy - Prevents XSS attacks
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://accounts.google.com https://login.microsoftonline.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https://avatars.githubusercontent.com https://lh3.googleusercontent.com https://graph.microsoft.com",
    "connect-src 'self' https://api.github.com https://login.microsoftonline.com https://graph.microsoft.com https://accounts.google.com",
    "frame-src 'none'",
    "object-src 'none'",
    "media-src 'self'",
    "worker-src 'self' blob:",
    "child-src 'self'",
    "form-action 'self' https://login.microsoftonline.com https://accounts.google.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "upgrade-insecure-requests"
  ]

  // Set CSP header
  res.setHeader('Content-Security-Policy', cspDirectives.join('; '))

  // HTTPS Strict Transport Security - Forces HTTPS for future requests
  if (env.isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  }

  // X-Frame-Options - Prevents clickjacking
  res.setHeader('X-Frame-Options', 'DENY')

  // X-Content-Type-Options - Prevents MIME-type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff')

  // X-XSS-Protection - Basic XSS protection (legacy browsers)
  res.setHeader('X-XSS-Protection', '1; mode=block')

  // Referrer-Policy - Controls referrer information sent
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Permissions-Policy - Controls browser features
  const permissionsPolicy = [
    'accelerometer=()',
    'ambient-light-sensor=()',
    'autoplay=()',
    'battery=()',
    'camera=()',
    'cross-origin-isolated=()',
    'display-capture=()',
    'document-domain=()',
    'encrypted-media=()',
    'execution-while-not-rendered=()',
    'execution-while-out-of-viewport=()',
    'fullscreen=()',
    'geolocation=()',
    'gyroscope=()',
    'keyboard-map=()',
    'magnetometer=()',
    'microphone=()',
    'midi=()',
    'navigation-override=()',
    'payment=()',
    'picture-in-picture=()',
    'publickey-credentials-get=()',
    'screen-wake-lock=()',
    'sync-xhr=()',
    'usb=()',
    'web-share=()',
    'xr-spatial-tracking=()'
  ]
  res.setHeader('Permissions-Policy', permissionsPolicy.join(', '))

  // X-Powered-By - Remove Express fingerprinting
  res.removeHeader('X-Powered-By')

  // X-Download-Options - Prevents IE from executing downloads
  res.setHeader('X-Download-Options', 'noopen')

  // X-Permitted-Cross-Domain-Policies - Restricts Flash cross-domain access
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none')

  // Cross-Origin-Embedder-Policy - Enables certain security features
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless')

  // Cross-Origin-Opener-Policy - Isolates browsing context
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')

  // Cross-Origin-Resource-Policy - Controls cross-origin resource sharing
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')

  next()
}

/**
 * Rate Limiting Configuration
 * Prevents brute force attacks on authentication endpoints
 */
export const createRateLimiter = () => {
  // In a production environment, you would use redis-based rate limiting
  // For now, we'll use a simple in-memory store
  const attempts = new Map<string, { count: number; resetTime: number }>()

  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown'
    const now = Date.now()
    const windowMs = 15 * 60 * 1000 // 15 minutes
    const maxAttempts = 10 // Max attempts per window

    // Clean up expired entries
    for (const [ip, data] of attempts.entries()) {
      if (now > data.resetTime) {
        attempts.delete(ip)
      }
    }

    // Get current attempts for this IP
    let clientData = attempts.get(clientIP)
    if (!clientData || now > clientData.resetTime) {
      clientData = { count: 0, resetTime: now + windowMs }
      attempts.set(clientIP, clientData)
    }

    // Increment attempt count
    clientData.count++

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', maxAttempts.toString())
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxAttempts - clientData.count).toString())
    res.setHeader('X-RateLimit-Reset', new Date(clientData.resetTime).toISOString())

    // Check if rate limit exceeded
    if (clientData.count > maxAttempts) {
      res.status(429).json({
        error: 'Too many requests',
        message: `Rate limit exceeded. Try again after ${new Date(clientData.resetTime).toISOString()}`,
        retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
      })
      return
    }

    next()
  }
}

/**
 * Input Sanitization Middleware
 * Validates and sanitizes input to prevent injection attacks
 */
export const inputSanitization = (req: Request, res: Response, next: NextFunction): void => {
  // Check for common injection patterns in URL params
  const dangerousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /onload=/gi,
    /onerror=/gi,
    /onclick=/gi,
    /onmouseover=/gi,
    /<iframe/gi,
    /<object/gi,
    /<embed/gi,
    /eval\(/gi,
    /expression\(/gi,
    /--/g, // SQL comment
    /;\s*(drop|delete|update|insert|create|alter|truncate|exec|execute)/gi
  ]

  // Check URL parameters
  const url = req.url
  for (const pattern of dangerousPatterns) {
    if (pattern.test(url)) {
      res.status(400).json({
        error: 'Invalid request',
        message: 'Request contains potentially dangerous content'
      })
      return
    }
  }

  // Recursively sanitize request body
  const sanitizeObject = (obj: any): any => {
    if (typeof obj === 'string') {
      // Check for dangerous patterns
      for (const pattern of dangerousPatterns) {
        if (pattern.test(obj)) {
          throw new Error('Potentially dangerous content detected')
        }
      }
      // Basic HTML entity encoding for critical characters
      return obj
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;')
    } else if (Array.isArray(obj)) {
      return obj.map(sanitizeObject)
    } else if (obj && typeof obj === 'object') {
      const sanitized: any = {}
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeObject(value)
      }
      return sanitized
    }
    return obj
  }

  try {
    if (req.body) {
      req.body = sanitizeObject(req.body)
    }
  } catch (error) {
    res.status(400).json({
      error: 'Invalid request',
      message: 'Request body contains potentially dangerous content'
    })
    return
  }

  next()
}

/**
 * Cookie Security Configuration
 * Ensures secure cookie settings for authentication tokens
 */
export const secureCookies = (req: Request, res: Response, next: NextFunction): void => {
  const originalCookie = res.cookie

  res.cookie = function(name: string, value: string, options: any = {}) {
    // Force secure settings for production
    if (env.isProduction) {
      options.secure = true
      options.sameSite = 'strict'
    } else {
      // Development settings
      options.secure = false
      options.sameSite = 'lax'
    }

    // Always set httpOnly for auth cookies
    if (name.includes('token') || name.includes('auth')) {
      options.httpOnly = true
    }

    return originalCookie.call(this, name, value, options)
  }

  next()
}