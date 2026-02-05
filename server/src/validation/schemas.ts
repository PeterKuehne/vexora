/**
 * Zod 4 Schemas for API Request Validation
 *
 * Provides type-safe validation for all API endpoints
 */

import { z } from 'zod'

// ============================================
// Chat Message Schema
// ============================================

export const chatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant'], {
    error: "role must be 'system', 'user', or 'assistant'",
  }),
  content: z.string({
    error: 'content must be a string',
  }).min(1, 'content cannot be empty'),
})

export type ChatMessage = z.infer<typeof chatMessageSchema>

// ============================================
// Generation Options Schema
// ============================================

export const generationOptionsSchema = z
  .object({
    temperature: z
      .number()
      .min(0, 'temperature must be >= 0')
      .max(2, 'temperature must be <= 2')
      .optional(),
    top_p: z
      .number()
      .min(0, 'top_p must be >= 0')
      .max(1, 'top_p must be <= 1')
      .optional(),
    top_k: z
      .number()
      .int('top_k must be an integer')
      .min(1, 'top_k must be >= 1')
      .max(100, 'top_k must be <= 100')
      .optional(),
    num_predict: z
      .number()
      .int('num_predict must be an integer')
      .min(-1, 'num_predict must be >= -1')
      .max(4096, 'num_predict must be <= 4096')
      .optional(),
    stop: z.array(z.string()).max(4, 'stop can have max 4 sequences').optional(),
  })
  .optional()

export type GenerationOptions = z.infer<typeof generationOptionsSchema>

// ============================================
// Chat Request Schema
// ============================================

/**
 * Model name validation regex:
 * - Starts with lowercase letter
 * - Can contain lowercase letters, numbers, hyphens, underscores
 * - Optional version tag after colon (e.g., :8b, :latest, :1.0.0)
 */
const modelNameRegex = /^[a-z][a-z0-9_-]*(?::[a-z0-9._-]+)?$/i

export const chatRequestSchema = z.object({
  model: z
    .string()
    .regex(modelNameRegex, {
      message:
        'Invalid model name format. Use format like "qwen3:8b" or "llama3.2:latest"',
    })
    .optional(),
  messages: z
    .array(chatMessageSchema, {
      error: 'messages must be an array',
    })
    .min(1, 'messages array cannot be empty')
    .max(100, 'messages array cannot exceed 100 messages'),
  stream: z.boolean().optional().default(true),
  options: generationOptionsSchema,
  // RAG options
  rag: z.object({
    enabled: z.boolean(),
    query: z.string().min(1, 'RAG query cannot be empty').optional(),
    searchLimit: z.number().int().min(1).max(20).optional().default(5),
    searchThreshold: z.number().min(0).max(1).optional().default(0.1), // 0.1 for more reranking candidates
    hybridAlpha: z.number().min(0).max(1).optional().default(0.3), // 0 = BM25, 1 = Vector (0.3 optimized for German texts)
  }).optional(),
})

export type ChatRequest = z.infer<typeof chatRequestSchema>

// ============================================
// Model Query Schema
// ============================================

export const modelQuerySchema = z.object({
  search: z.string().max(100, 'search query too long').optional(),
  family: z.string().max(50, 'family name too long').optional(),
})

export type ModelQuery = z.infer<typeof modelQuerySchema>

// ============================================
// Validation Helper
// ============================================

export interface ValidationResult<T> {
  success: true
  data: T
}

export interface ValidationErrorResult {
  success: false
  errors: Array<{
    path: string
    message: string
  }>
}

export type ValidateResult<T> = ValidationResult<T> | ValidationErrorResult

/**
 * Validates data against a Zod schema and returns a structured result
 */
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidateResult<T> {
  const result = schema.safeParse(data)

  if (result.success) {
    return {
      success: true,
      data: result.data,
    }
  }

  // Zod 4 uses result.error.issues
  const issues = result.error.issues ?? []

  return {
    success: false,
    errors: issues.map((issue) => ({
      path: issue.path.join('.') || 'root',
      message: issue.message,
    })),
  }
}

/**
 * Formats validation errors into a human-readable string
 */
export function formatValidationErrors(
  errors: Array<{ path: string; message: string }>
): string {
  if (errors.length === 1) {
    const err = errors[0]
    return err?.path && err.path !== 'root'
      ? `${err.path}: ${err.message}`
      : err?.message ?? 'Validation failed'
  }

  return errors
    .map((err) =>
      err.path && err.path !== 'root' ? `${err.path}: ${err.message}` : err.message
    )
    .join('; ')
}
