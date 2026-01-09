import express, { type Request, type Response } from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { env } from './config/env.js'

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
app.get('/api/health', async (_req: Request, res: Response) => {
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
})

// Root endpoint
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'Qwen Chat API',
    version: '0.1.0',
    environment: env.NODE_ENV,
    endpoints: {
      health: '/api/health',
      models: '/api/models',
      websocket: `ws://localhost:${env.PORT}`,
    },
  })
})

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

app.get('/api/models', async (_req: Request, res: Response) => {
  try {
    const ollamaResponse = await fetch(`${env.OLLAMA_API_URL}/api/tags`, {
      method: 'GET',
      signal: AbortSignal.timeout(10000), // 10 second timeout
    })

    if (!ollamaResponse.ok) {
      res.status(502).json({
        error: 'Failed to fetch models from Ollama',
        details: `Ollama returned HTTP ${ollamaResponse.status}`,
      })
      return
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    // Check if it's a connection error
    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('fetch failed')) {
      res.status(503).json({
        error: 'Ollama is not running',
        details: 'Please start Ollama with: ollama serve',
        url: env.OLLAMA_API_URL,
      })
      return
    }

    res.status(500).json({
      error: 'Failed to fetch models',
      details: errorMessage,
    })
  }
})

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

// Start server with HTTP server (for both Express and Socket.io)
httpServer.listen(env.PORT, () => {
  console.log(`🚀 Server running on http://localhost:${env.PORT}`)
  console.log(`📋 Health check: http://localhost:${env.PORT}/api/health`)
  console.log(`🔌 WebSocket ready on ws://localhost:${env.PORT}`)
})

export { io }
export default app
