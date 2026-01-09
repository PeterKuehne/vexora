import express, { type Request, type Response } from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { env } from './config/env.js'
import { errorHandler, asyncHandler, notFoundHandler } from './middleware/index.js'
import {
  ValidationError,
  OllamaConnectionError,
  OllamaError,
  BadGatewayError,
} from './errors/index.js'

const app = express()
const httpServer = createServer(app)

// Socket.io setup with CORS
const io = new Server(httpServer, {
  cors: {
    origin: env.CORS_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
})

// Express CORS configuration
app.use(
  cors({
    origin: env.CORS_ORIGINS,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
)

// JSON body parser
app.use(express.json())

// Health check endpoint - checks backend and Ollama connectivity
app.get('/api/health', asyncHandler(async (_req: Request, res: Response) => {
  const healthStatus = {
    status: 'ok' as 'ok' | 'degraded' | 'error',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    services: {
      backend: {
        status: 'ok' as const,
        uptime: process.uptime(),
      },
      websocket: {
        status: 'ok' as const,
        connections: io.engine.clientsCount,
      },
      ollama: {
        status: 'unknown' as 'ok' | 'error' | 'unknown',
        url: env.OLLAMA_API_URL,
        default_model: env.OLLAMA_DEFAULT_MODEL,
        available_models: [] as string[],
        error: undefined as string | undefined,
      },
    },
  }

  // Check Ollama connectivity
  try {
    const ollamaResponse = await fetch(`${env.OLLAMA_API_URL}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    })

    if (ollamaResponse.ok) {
      const data = (await ollamaResponse.json()) as { models?: Array<{ name: string }> }
      healthStatus.services.ollama.status = 'ok'
      healthStatus.services.ollama.available_models =
        data.models?.map((m) => m.name) || []
    } else {
      healthStatus.services.ollama.status = 'error'
      healthStatus.services.ollama.error = `HTTP ${ollamaResponse.status}`
      healthStatus.status = 'degraded'
    }
  } catch (error) {
    healthStatus.services.ollama.status = 'error'
    healthStatus.services.ollama.error =
      error instanceof Error ? error.message : 'Connection failed'
    healthStatus.status = 'degraded'
  }

  // Set appropriate HTTP status
  const httpStatus = healthStatus.status === 'ok' ? 200 : 503
  res.status(httpStatus).json(healthStatus)
}))

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'Qwen Chat API',
    version: '0.1.0',
    environment: env.NODE_ENV,
    endpoints: {
      health: '/api/health',
      models: '/api/models',
      chat: '/api/chat',
      websocket: `ws://localhost:${env.PORT}`,
    },
  })
})

// ============================================
// Chat Completion Types
// ============================================

interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

interface ChatRequest {
  model?: string
  messages: ChatMessage[]
  stream?: boolean
  options?: {
    temperature?: number
    top_p?: number
    top_k?: number
    num_predict?: number
    stop?: string[]
  }
}

interface ChatRequestValidationResult {
  valid: boolean
  error?: string
}

function validateChatRequest(body: unknown): ChatRequestValidationResult {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be an object' }
  }

  const request = body as Record<string, unknown>

  // messages is required
  if (!request.messages || !Array.isArray(request.messages)) {
    return { valid: false, error: 'messages is required and must be an array' }
  }

  if (request.messages.length === 0) {
    return { valid: false, error: 'messages array cannot be empty' }
  }

  // Validate each message
  for (let i = 0; i < request.messages.length; i++) {
    const msg = request.messages[i] as Record<string, unknown>
    if (!msg || typeof msg !== 'object') {
      return { valid: false, error: `messages[${i}] must be an object` }
    }
    if (!msg.role || !['system', 'user', 'assistant'].includes(msg.role as string)) {
      return {
        valid: false,
        error: `messages[${i}].role must be 'system', 'user', or 'assistant'`,
      }
    }
    if (typeof msg.content !== 'string') {
      return { valid: false, error: `messages[${i}].content must be a string` }
    }
  }

  // model is optional (will use default)
  if (request.model !== undefined && typeof request.model !== 'string') {
    return { valid: false, error: 'model must be a string' }
  }

  // stream is optional boolean
  if (request.stream !== undefined && typeof request.stream !== 'boolean') {
    return { valid: false, error: 'stream must be a boolean' }
  }

  return { valid: true }
}

// POST /api/chat - Chat completion with Ollama (supports streaming)
app.post('/api/chat', asyncHandler(async (req: Request, res: Response) => {
  // Validate request body
  const validation = validateChatRequest(req.body)
  if (!validation.valid) {
    throw new ValidationError(validation.error || 'Invalid request', {
      field: 'body',
    })
  }

  const chatRequest = req.body as ChatRequest
  const model = chatRequest.model || env.OLLAMA_DEFAULT_MODEL
  const stream = chatRequest.stream !== false // Default to streaming

  // Prepare Ollama request
  const ollamaRequest = {
    model,
    messages: chatRequest.messages,
    stream,
    options: chatRequest.options || {},
  }

  try {
    const ollamaResponse = await fetch(`${env.OLLAMA_API_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ollamaRequest),
    })

    if (!ollamaResponse.ok) {
      const errorText = await ollamaResponse.text()
      let errorMessage = `Ollama error: HTTP ${ollamaResponse.status}`
      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.error) {
          errorMessage = errorJson.error
        }
      } catch {
        // Use status text if JSON parsing fails
      }
      const statusCode = ollamaResponse.status >= 500 ? 502 : ollamaResponse.status
      throw new OllamaError(errorMessage, statusCode, {
        ollamaStatus: ollamaResponse.status,
      })
    }

    if (stream) {
      // Set up streaming response with SSE headers
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.setHeader('X-Accel-Buffering', 'no') // Disable nginx buffering

      const reader = ollamaResponse.body?.getReader()
      if (!reader) {
        res.status(500).json({ error: 'Failed to get response stream' })
        return
      }

      const decoder = new TextDecoder()
      let clientDisconnected = false

      // Handle client disconnect - cancel the stream to Ollama
      req.on('close', () => {
        clientDisconnected = true
        reader.cancel().catch(() => {
          // Ignore cancel errors
        })
        console.log('🔌 Client disconnected, stream cancelled')
      })

      try {
        while (!clientDisconnected) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          // Ollama sends NDJSON (newline-delimited JSON)
          // Each line is a separate JSON object
          const lines = chunk.split('\n').filter((line) => line.trim())

          for (const line of lines) {
            if (clientDisconnected) break

            try {
              const parsed = JSON.parse(line)
              // Send as SSE format
              res.write(`data: ${JSON.stringify(parsed)}\n\n`)
            } catch {
              // Skip malformed JSON lines
            }
          }
        }

        // End the stream (only if client still connected)
        if (!clientDisconnected) {
          res.write('data: [DONE]\n\n')
          res.end()
        }
      } catch (streamError) {
        // Only log and respond if not caused by client disconnect
        if (!clientDisconnected) {
          console.error('Stream error:', streamError)
          res.write(
            `data: ${JSON.stringify({ error: 'Stream interrupted' })}\n\n`
          )
          res.end()
        }
      }
    } else {
      // Non-streaming response
      const data = await ollamaResponse.json()
      res.json(data)
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch failed')) {
      throw new OllamaConnectionError(env.OLLAMA_API_URL)
    }

    // Re-throw if already an AppError (e.g., OllamaError, ValidationError)
    throw error
  }
}))

// List available models from Ollama
interface OllamaModelDetails {
  parent_model?: string
  format: string
  family: string
  families?: string[]
  parameter_size: string
  quantization_level: string
}

interface OllamaModel {
  name: string
  model?: string
  modified_at: string
  size: number
  digest: string
  details: OllamaModelDetails
}

interface OllamaTagsResponse {
  models: OllamaModel[]
}

// Formatted model for API response
interface FormattedModel {
  id: string
  name: string
  family: string
  parameterSize: string
  quantization: string
  sizeGB: number
  modifiedAt: string
  isDefault: boolean
}

app.get('/api/models', asyncHandler(async (_req: Request, res: Response) => {
  const ollamaResponse = await fetch(`${env.OLLAMA_API_URL}/api/tags`, {
    method: 'GET',
    signal: AbortSignal.timeout(10000), // 10 second timeout
  }).catch((error) => {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch failed')) {
      throw new OllamaConnectionError(env.OLLAMA_API_URL)
    }
    throw error
  })

  if (!ollamaResponse.ok) {
    throw new BadGatewayError('Failed to fetch models from Ollama', {
      ollamaStatus: ollamaResponse.status,
    })
  }

  const data = (await ollamaResponse.json()) as OllamaTagsResponse

  // Format models for the frontend
  const models: FormattedModel[] = (data.models || []).map((model) => {
    const nameParts = model.name.split(':')
    return {
      id: model.name,
      name: nameParts[0] ?? model.name, // Base name without tag, fallback to full name
      family: model.details.family,
      parameterSize: model.details.parameter_size,
      quantization: model.details.quantization_level,
      sizeGB: Math.round((model.size / 1024 / 1024 / 1024) * 100) / 100, // Convert to GB with 2 decimals
      modifiedAt: model.modified_at,
      isDefault: model.name === env.OLLAMA_DEFAULT_MODEL,
    }
  })

  // Sort: default model first, then alphabetically
  models.sort((a, b) => {
    if (a.isDefault && !b.isDefault) return -1
    if (!a.isDefault && b.isDefault) return 1
    return a.id.localeCompare(b.id)
  })

  res.json({
    models,
    defaultModel: env.OLLAMA_DEFAULT_MODEL,
    totalCount: models.length,
  })
}))

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`)

  // Handle chat message - will be used for LLM streaming
  socket.on('chat:message', (data: { conversationId: string; message: string }) => {
    console.log(`💬 Message from ${socket.id}:`, data.message.substring(0, 50))

    // Acknowledge message received
    socket.emit('chat:message:ack', {
      conversationId: data.conversationId,
      status: 'received',
      timestamp: new Date().toISOString(),
    })

    // TODO: In future feature, this will connect to Ollama and stream response
    // For now, send a test response to verify the connection works
    socket.emit('chat:stream:start', { conversationId: data.conversationId })
    socket.emit('chat:stream:token', {
      conversationId: data.conversationId,
      token: 'Socket.io connection working!',
    })
    socket.emit('chat:stream:end', { conversationId: data.conversationId })
  })

  // Handle disconnect
  socket.on('disconnect', (reason) => {
    console.log(`🔌 Client disconnected: ${socket.id} (${reason})`)
  })

  // Handle errors
  socket.on('error', (error) => {
    console.error(`❌ Socket error for ${socket.id}:`, error)
  })
})

// ============================================
// Error Handling Middleware (must be last)
// ============================================

// 404 handler for undefined routes
app.use(notFoundHandler)

// Central error handler
app.use(errorHandler)

// Start server with HTTP server (for both Express and Socket.io)
httpServer.listen(env.PORT, () => {
  console.log(`🚀 Server running on http://localhost:${env.PORT}`)
  console.log(`📋 Health check: http://localhost:${env.PORT}/api/health`)
  console.log(`🔌 WebSocket ready on ws://localhost:${env.PORT}`)
})

export { io }
export default app
