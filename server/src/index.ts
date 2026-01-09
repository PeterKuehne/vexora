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
      websocket: `ws://localhost:${env.PORT}`,
    },
  })
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
