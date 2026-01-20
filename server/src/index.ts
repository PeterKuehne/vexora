import express, { type Request, type Response } from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'path'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { env } from './config/env.js'
import { errorHandler, asyncHandler, notFoundHandler } from './middleware/index.js'
import { ValidationError } from './errors/index.js'
import {
  chatRequestSchema,
  modelQuerySchema,
  validate,
  formatValidationErrors,
  type ChatRequest,
  type ModelQuery,
} from './validation/index.js'
import { ollamaService, documentService } from './services/index.js'

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

// ============================================
// File Upload Configuration
// ============================================

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (_req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`)
  }
})

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
    files: 1,
  },
  fileFilter: (_req, file, cb) => {
    // Only allow PDF files
    if (file.mimetype === 'application/pdf') {
      cb(null, true)
    } else {
      cb(new Error('Nur PDF-Dateien sind erlaubt'), false)
    }
  }
})

// ============================================
// Health Check Endpoint
// ============================================

app.get('/api/health', asyncHandler(async (_req: Request, res: Response) => {
  // Use OllamaService for health check
  const ollamaHealth = await ollamaService.healthCheck(5000)

  const healthStatus = {
    status: ollamaHealth.status === 'ok' ? 'ok' : 'degraded' as 'ok' | 'degraded',
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
        status: ollamaHealth.status,
        url: ollamaHealth.url,
        default_model: ollamaHealth.defaultModel,
        available_models: ollamaHealth.availableModels,
        error: ollamaHealth.error,
      },
    },
  }

  // Set appropriate HTTP status
  const httpStatus = healthStatus.status === 'ok' ? 200 : 503
  res.status(httpStatus).json(healthStatus)
}))

// ============================================
// Root Endpoint
// ============================================

app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'Vexora API',
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
// Chat Endpoint
// ============================================

app.post('/api/chat', asyncHandler(async (req: Request, res: Response) => {
  // Validate request body with Zod schema
  const validation = validate(chatRequestSchema, req.body)
  if (!validation.success) {
    throw new ValidationError(formatValidationErrors(validation.errors), {
      field: 'body',
      details: validation.errors,
    })
  }

  const chatRequest: ChatRequest = validation.data
  const stream = chatRequest.stream // Zod sets default to true

  if (stream) {
    // Set up streaming response with SSE headers
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no') // Disable nginx buffering

    // Get streaming response from OllamaService
    const ollamaResponse = await ollamaService.chatStream({
      messages: chatRequest.messages,
      model: chatRequest.model,
      options: chatRequest.options,
    })

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
    // Non-streaming response using OllamaService
    const response = await ollamaService.chat({
      messages: chatRequest.messages,
      model: chatRequest.model,
      options: chatRequest.options,
    })
    res.json(response)
  }
}))

// ============================================
// Models Endpoint
// ============================================

app.get('/api/models', asyncHandler(async (req: Request, res: Response) => {
  // Validate query parameters (optional filters)
  const queryValidation = validate(modelQuerySchema, req.query)
  if (!queryValidation.success) {
    throw new ValidationError(formatValidationErrors(queryValidation.errors), {
      field: 'query',
      details: queryValidation.errors,
    })
  }
  const query: ModelQuery = queryValidation.data

  // Use OllamaService to get models
  const result = await ollamaService.getModels({
    search: query.search,
    family: query.family,
  })

  res.json({
    models: result.models,
    defaultModel: ollamaService.getDefaultModel(),
    totalCount: result.totalCount,
  })
}))

// ============================================
// Documents Endpoints
// ============================================

// Upload document endpoint
app.post('/api/documents/upload', upload.single('document'), asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw new ValidationError('Keine Datei hochgeladen', {
      field: 'document',
      details: ['Ein PDF-Dokument ist erforderlich'],
    })
  }

  // Validate file with DocumentService
  const fileValidation = documentService.validateFile(req.file)
  if (!fileValidation.valid) {
    throw new ValidationError(fileValidation.error || 'Datei-Validierung fehlgeschlagen', {
      field: 'document',
      details: [fileValidation.error || 'Unbekannter Validierungsfehler'],
    })
  }

  // Process PDF
  const result = await documentService.processPDF(req.file.path, {
    filename: req.file.filename,
    originalName: req.file.originalname,
    size: req.file.size,
    type: 'pdf',
  })

  if (!result.success) {
    throw new ValidationError(result.error || 'Fehler beim Verarbeiten der PDF', {
      field: 'processing',
      details: [result.error || 'Unbekannter Verarbeitungsfehler'],
    })
  }

  res.status(201).json({
    success: true,
    document: result.document,
    message: 'Dokument erfolgreich hochgeladen und verarbeitet',
  })
}))

// Get all documents endpoint
app.get('/api/documents', asyncHandler(async (_req: Request, res: Response) => {
  const documents = await documentService.getDocuments()

  res.json({
    documents,
    totalCount: documents.length,
  })
}))

// Get single document endpoint
app.get('/api/documents/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params
  const document = await documentService.getDocument(id)

  if (!document) {
    res.status(404).json({
      error: 'Dokument nicht gefunden',
      id,
    })
    return
  }

  res.json({ document })
}))

// Delete document endpoint
app.delete('/api/documents/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params
  const success = await documentService.deleteDocument(id)

  if (!success) {
    res.status(404).json({
      error: 'Dokument nicht gefunden',
      id,
    })
    return
  }

  res.json({
    success: true,
    message: 'Dokument erfolgreich gelöscht',
  })
}))

// ============================================
// Socket.io Connection Handling
// ============================================

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
