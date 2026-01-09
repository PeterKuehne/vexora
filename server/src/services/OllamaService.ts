/**
 * OllamaService - Centralized service for all Ollama API interactions
 *
 * Provides methods for:
 * - Health checks
 * - Listing available models
 * - Chat completions (streaming and non-streaming)
 */

import { env } from '../config/env.js'
import { OllamaConnectionError, OllamaError, BadGatewayError } from '../errors/index.js'

// ============================================
// Types
// ============================================

export interface OllamaModelDetails {
  parent_model?: string
  format: string
  family: string
  families?: string[]
  parameter_size: string
  quantization_level: string
}

export interface OllamaModel {
  name: string
  model?: string
  modified_at: string
  size: number
  digest: string
  details: OllamaModelDetails
}

export interface OllamaTagsResponse {
  models: OllamaModel[]
}

export interface FormattedModel {
  id: string
  name: string
  family: string
  parameterSize: string
  quantization: string
  sizeGB: number
  modifiedAt: string
  isDefault: boolean
}

export interface OllamaHealthStatus {
  status: 'ok' | 'error' | 'unknown'
  url: string
  defaultModel: string
  availableModels: string[]
  error?: string
}

export interface OllamaChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface OllamaChatOptions {
  temperature?: number
  top_p?: number
  top_k?: number
  num_predict?: number
  stop?: string[]
}

export interface OllamaChatRequest {
  model: string
  messages: OllamaChatMessage[]
  stream?: boolean
  options?: OllamaChatOptions
}

export interface OllamaChatResponse {
  model: string
  created_at: string
  message: {
    role: 'assistant'
    content: string
  }
  done: boolean
  done_reason?: string
  total_duration?: number
  load_duration?: number
  prompt_eval_count?: number
  prompt_eval_duration?: number
  eval_count?: number
  eval_duration?: number
}

export interface OllamaChatStreamChunk {
  model: string
  created_at: string
  message: {
    role: 'assistant'
    content: string
  }
  done: boolean
  done_reason?: string
  total_duration?: number
  load_duration?: number
  prompt_eval_count?: number
  prompt_eval_duration?: number
  eval_count?: number
  eval_duration?: number
}

// ============================================
// OllamaService Class
// ============================================

export class OllamaService {
  private baseUrl: string
  private defaultModel: string
  private defaultTimeout: number

  constructor(
    baseUrl: string = env.OLLAMA_API_URL,
    defaultModel: string = env.OLLAMA_DEFAULT_MODEL,
    defaultTimeout: number = 30000
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, '') // Remove trailing slash
    this.defaultModel = defaultModel
    this.defaultTimeout = defaultTimeout
  }

  // ============================================
  // Health Check
  // ============================================

  /**
   * Check Ollama connectivity and get available models
   * @param timeout - Timeout in milliseconds (default: 5000)
   * @returns Health status with available models
   */
  async healthCheck(timeout: number = 5000): Promise<OllamaHealthStatus> {
    const healthStatus: OllamaHealthStatus = {
      status: 'unknown',
      url: this.baseUrl,
      defaultModel: this.defaultModel,
      availableModels: [],
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(timeout),
      })

      if (response.ok) {
        const data = (await response.json()) as OllamaTagsResponse
        healthStatus.status = 'ok'
        healthStatus.availableModels = data.models?.map((m) => m.name) || []
      } else {
        healthStatus.status = 'error'
        healthStatus.error = `HTTP ${response.status}`
      }
    } catch (error) {
      healthStatus.status = 'error'
      healthStatus.error = error instanceof Error ? error.message : 'Connection failed'
    }

    return healthStatus
  }

  // ============================================
  // Get Models
  // ============================================

  /**
   * List all available models from Ollama
   * @param options - Filter options
   * @returns Formatted list of models
   */
  async getModels(options?: {
    search?: string
    family?: string
    timeout?: number
  }): Promise<{ models: FormattedModel[]; totalCount: number }> {
    const timeout = options?.timeout ?? 10000

    let response: Response
    try {
      response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(timeout),
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch failed')) {
        throw new OllamaConnectionError(this.baseUrl)
      }
      throw error
    }

    if (!response.ok) {
      throw new BadGatewayError('Failed to fetch models from Ollama', {
        ollamaStatus: response.status,
      })
    }

    const data = (await response.json()) as OllamaTagsResponse

    // Format models for the frontend
    let models: FormattedModel[] = (data.models || []).map((model) => {
      const nameParts = model.name.split(':')
      return {
        id: model.name,
        name: nameParts[0] ?? model.name,
        family: model.details.family,
        parameterSize: model.details.parameter_size,
        quantization: model.details.quantization_level,
        sizeGB: Math.round((model.size / 1024 / 1024 / 1024) * 100) / 100,
        modifiedAt: model.modified_at,
        isDefault: model.name === this.defaultModel,
      }
    })

    // Apply filters
    if (options?.search) {
      const searchLower = options.search.toLowerCase()
      models = models.filter(
        (m) =>
          m.id.toLowerCase().includes(searchLower) ||
          m.name.toLowerCase().includes(searchLower)
      )
    }

    if (options?.family) {
      const familyLower = options.family.toLowerCase()
      models = models.filter((m) => m.family.toLowerCase() === familyLower)
    }

    // Sort: default model first, then alphabetically
    models.sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1
      if (!a.isDefault && b.isDefault) return 1
      return a.id.localeCompare(b.id)
    })

    return {
      models,
      totalCount: models.length,
    }
  }

  // ============================================
  // Chat (Non-Streaming)
  // ============================================

  /**
   * Send a chat message and get a complete response (non-streaming)
   * @param request - Chat request with messages
   * @returns Complete chat response
   */
  async chat(request: {
    messages: OllamaChatMessage[]
    model?: string
    options?: OllamaChatOptions
  }): Promise<OllamaChatResponse> {
    const model = request.model ?? this.defaultModel

    const ollamaRequest: OllamaChatRequest = {
      model,
      messages: request.messages,
      stream: false,
      options: request.options,
    }

    let response: Response
    try {
      response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ollamaRequest),
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch failed')) {
        throw new OllamaConnectionError(this.baseUrl)
      }
      throw error
    }

    if (!response.ok) {
      await this.handleErrorResponse(response)
    }

    return (await response.json()) as OllamaChatResponse
  }

  // ============================================
  // Chat Stream
  // ============================================

  /**
   * Send a chat message and get a streaming response
   * @param request - Chat request with messages
   * @returns Response object with readable stream body
   */
  async chatStream(request: {
    messages: OllamaChatMessage[]
    model?: string
    options?: OllamaChatOptions
  }): Promise<Response> {
    const model = request.model ?? this.defaultModel

    const ollamaRequest: OllamaChatRequest = {
      model,
      messages: request.messages,
      stream: true,
      options: request.options,
    }

    let response: Response
    try {
      response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ollamaRequest),
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch failed')) {
        throw new OllamaConnectionError(this.baseUrl)
      }
      throw error
    }

    if (!response.ok) {
      await this.handleErrorResponse(response)
    }

    return response
  }

  // ============================================
  // Helper Methods
  // ============================================

  /**
   * Handle error responses from Ollama API
   */
  private async handleErrorResponse(response: Response): Promise<never> {
    const errorText = await response.text()
    let errorMessage = `Ollama error: HTTP ${response.status}`

    try {
      const errorJson = JSON.parse(errorText)
      if (errorJson.error) {
        errorMessage = errorJson.error
      }
    } catch {
      // Use status text if JSON parsing fails
    }

    const statusCode = response.status >= 500 ? 502 : response.status
    throw new OllamaError(errorMessage, statusCode, {
      ollamaStatus: response.status,
    })
  }

  /**
   * Get the default model name
   */
  getDefaultModel(): string {
    return this.defaultModel
  }

  /**
   * Get the base URL
   */
  getBaseUrl(): string {
    return this.baseUrl
  }
}

// ============================================
// Singleton Instance
// ============================================

/**
 * Default OllamaService instance using environment configuration
 */
export const ollamaService = new OllamaService()

export default ollamaService
