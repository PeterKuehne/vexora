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
import { ollamaService, documentService, ragService } from './services/index.js'
import { processingJobService } from './services/ProcessingJobService.js'
import authRoutes from './routes/auth.js'

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
// Authentication Routes
// ============================================

app.use('/api/auth', authRoutes)

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
      cb(new Error('Nur PDF-Dateien sind erlaubt'))
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
  const ragEnabled = chatRequest.rag?.enabled === true

  // Determine the query for RAG search
  const ragQuery = ragEnabled
    ? (chatRequest.rag?.query || chatRequest.messages[chatRequest.messages.length - 1]?.content || '')
    : ''

  if (stream) {
    // Set up streaming response with SSE headers
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no') // Disable nginx buffering

    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
    let clientDisconnected = false

    // Handle client disconnect - cancel any active streams
    // Use 'close' event on response, not request
    res.on('close', () => {
      // Only mark as disconnected if response wasn't normally finished
      if (!res.writableEnded) {
        clientDisconnected = true
        reader?.cancel().catch(() => {
          // Ignore cancel errors
        })
      }
    })

    if (ragEnabled && ragQuery) {
      // RAG-enabled streaming response
      try {
        const ragResponse = await ragService.generateStreamingResponse({
          messages: chatRequest.messages,
          model: chatRequest.model || 'qwen3:8b',
          query: ragQuery,
          searchLimit: chatRequest.rag?.searchLimit || 5,
          searchThreshold: chatRequest.rag?.searchThreshold || 0.5,
          hybridAlpha: chatRequest.rag?.hybridAlpha ?? 0.5,
        })

        // Send sources first (as metadata)
        if (!clientDisconnected) {
          const sourcesMetadata = {
            type: 'sources',
            sources: ragResponse.sources,
            hasRelevantSources: ragResponse.hasRelevantSources,
          }
          res.write(`data: ${JSON.stringify(sourcesMetadata)}\n\n`)
        }

        reader = ragResponse.stream.getReader()
        if (!reader) {
          res.status(500).json({ error: 'Failed to get RAG response stream' })
          return
        }

        const decoder = new TextDecoder()

        try {
          while (!clientDisconnected) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
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
          if (!clientDisconnected) {
            console.error('RAG stream error:', streamError)
            res.write(
              `data: ${JSON.stringify({ error: 'RAG stream interrupted' })}\n\n`
            )
            res.end()
          }
        }
      } catch (ragError) {
        if (!clientDisconnected) {
          console.error('RAG generation failed, falling back to standard chat:', ragError)
          res.write(
            `data: ${JSON.stringify({ error: 'RAG nicht verfügbar, verwende Standard-Chat' })}\n\n`
          )
          res.end()
        }
      }
    } else {
      // Standard streaming response (non-RAG)
      let keepAliveInterval: NodeJS.Timeout | null = null;

      try {
        // Send initial "stream started" event immediately to keep connection alive
        const streamStartTime = Date.now();
        if (!clientDisconnected) {
          res.write(`: stream started\n\n`);
          // Force flush by writing an empty buffer which triggers actual send
          if (typeof (res as any).flush === 'function') {
            (res as any).flush();
          }
        }

        // Start a keep-alive interval to prevent client timeout
        // while waiting for Ollama to load the model and start streaming
        // Use 500ms interval to ensure frequent updates
        keepAliveInterval = setInterval(() => {
          if (!clientDisconnected) {
            res.write(`: keep-alive\n\n`);
            // Force flush
            if (typeof (res as any).flush === 'function') {
              (res as any).flush();
            }
          }
        }, 500); // Send keep-alive every 500ms (more frequent)

        const ollamaResponse = await ollamaService.chatStream({
          messages: chatRequest.messages,
          model: chatRequest.model,
          options: chatRequest.options,
        });

        // Stop keep-alive once we have the response
        if (keepAliveInterval) {
          clearInterval(keepAliveInterval);
          keepAliveInterval = null;
        }

        reader = ollamaResponse.body?.getReader()
        if (!reader) {
          res.status(500).json({ error: 'Failed to get response stream' })
          return
        }

        const decoder = new TextDecoder()

        try {
          while (!clientDisconnected) {
            const { done, value } = await reader.read()
            if (done) {
              break;
            }

            const chunk = decoder.decode(value, { stream: true })

            const lines = chunk.split('\n').filter((line) => line.trim())

            for (const line of lines) {
              if (clientDisconnected) break

              try {
                const parsed = JSON.parse(line)
                res.write(`data: ${JSON.stringify(parsed)}\n\n`)
              } catch {
                // Skip malformed JSON lines
              }
            }
          }

          if (!clientDisconnected) {
            res.write('data: [DONE]\n\n')
            res.end()
          }
        } catch (streamError) {
          if (!clientDisconnected) {
            console.error('Stream error:', streamError)
            res.write(
              `data: ${JSON.stringify({ error: 'Stream interrupted' })}\n\n`
            )
            res.end()
          }
        }
      } catch (ollamaError) {
        // Stop keep-alive interval if still running
        if (keepAliveInterval) {
          clearInterval(keepAliveInterval);
          keepAliveInterval = null;
        }

        if (!clientDisconnected) {
          console.error('Ollama stream failed:', ollamaError)
          res.status(500).json({ error: 'Failed to get chat response' })
        }
      }
    }
  } else {
    // Non-streaming response
    if (ragEnabled && ragQuery) {
      // RAG-enabled non-streaming response
      try {
        const ragResponse = await ragService.generateResponse({
          messages: chatRequest.messages,
          model: chatRequest.model || 'qwen3:8b',
          query: ragQuery,
          searchLimit: chatRequest.rag?.searchLimit || 5,
          searchThreshold: chatRequest.rag?.searchThreshold || 0.5,
          hybridAlpha: chatRequest.rag?.hybridAlpha ?? 0.5,
        })

        res.json({
          message: { content: ragResponse.message },
          sources: ragResponse.sources,
          hasRelevantSources: ragResponse.hasRelevantSources,
          type: 'rag',
        })
      } catch (ragError) {
        console.error('RAG generation failed:', ragError)
        res.status(500).json({ error: 'RAG generation failed' })
      }
    } else {
      // Standard non-streaming response
      try {
        const response = await ollamaService.chat({
          messages: chatRequest.messages,
          model: chatRequest.model,
          options: chatRequest.options,
        })
        res.json(response)
      } catch (ollamaError) {
        console.error('Ollama chat failed:', ollamaError)
        res.status(500).json({ error: 'Chat generation failed' })
      }
    }
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
// Embedding Models Endpoint
// ============================================

app.get('/api/models/embedding', asyncHandler(async (_req: Request, res: Response) => {
  // Get all models and filter for embedding models
  const result = await ollamaService.getModels({})

  // Filter for embedding models (models with 'embed' in name or specific families)
  const embeddingModels = result.models.filter((model) => {
    const nameLC = model.id.toLowerCase()
    const familyLC = model.family.toLowerCase()

    // Common embedding model patterns
    return (
      nameLC.includes('embed') ||
      nameLC.includes('nomic') ||
      nameLC.includes('mxbai') ||
      nameLC.includes('bge') ||
      nameLC.includes('gte') ||
      nameLC.includes('e5') ||
      familyLC === 'bert' ||
      familyLC === 'nomic-bert'
    )
  })

  // Default embedding model
  const defaultEmbedding = embeddingModels.find(m => m.id.includes('nomic-embed'))
    || embeddingModels[0]
    || null

  res.json({
    models: embeddingModels,
    defaultModel: defaultEmbedding?.id || null,
    totalCount: embeddingModels.length,
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

  // Generate document ID for async processing
  const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // Create processing job for async execution
  const job = processingJobService.createJob(
    documentId,
    req.file.filename,
    req.file.originalname
  )

  // TODO: In a production system, we would store the file reference and process it
  // For now, we'll simulate the processing with the job system

  res.status(202).json({
    success: true,
    jobId: job.id,
    documentId,
    status: 'pending',
    message: 'Dokument wird verarbeitet. Sie erhalten Updates über den Status.',
  })
}))

// Get processing job status
app.get('/api/processing/:jobId', asyncHandler(async (req: Request, res: Response) => {
  const { jobId } = req.params
  const job = processingJobService.getJob(jobId || '')

  if (!job) {
    throw new ValidationError('Processing Job nicht gefunden', {
      field: 'jobId',
      details: ['Der angegebene Job existiert nicht'],
    })
  }

  res.json({
    success: true,
    job,
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

// Get all unique tags endpoint (BEFORE :id route!)
app.get('/api/documents/tags', asyncHandler(async (_req: Request, res: Response) => {
  const tags = await documentService.getAllTags()
  res.json({ tags })
}))

// Get document categories endpoint (BEFORE :id route!)
app.get('/api/documents/categories', asyncHandler(async (_req: Request, res: Response) => {
  const { DOCUMENT_CATEGORIES } = await import('./services/DocumentService.js')
  res.json({ categories: DOCUMENT_CATEGORIES })
}))

// Get single document endpoint
app.get('/api/documents/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params
  const document = await documentService.getDocument(id || '')

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
  const success = await documentService.deleteDocument(id || '')

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

// Update document endpoint (category/tags)
app.patch('/api/documents/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params
  const { category, tags } = req.body

  const document = await documentService.updateDocument(id || '', { category, tags })

  if (!document) {
    res.status(404).json({
      error: 'Dokument nicht gefunden',
      id,
    })
    return
  }

  res.json({
    success: true,
    document,
  })
}))

// Bulk delete documents endpoint
app.post('/api/documents/bulk-delete', asyncHandler(async (req: Request, res: Response) => {
  const { ids } = req.body

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({
      error: 'IDs-Array ist erforderlich',
    })
    return
  }

  const results: { id: string; success: boolean; error?: string }[] = []
  let successCount = 0
  let failCount = 0

  for (const id of ids) {
    try {
      const success = await documentService.deleteDocument(id)
      if (success) {
        results.push({ id, success: true })
        successCount++
      } else {
        results.push({ id, success: false, error: 'Dokument nicht gefunden' })
        failCount++
      }
    } catch (error) {
      results.push({ id, success: false, error: error instanceof Error ? error.message : 'Unbekannter Fehler' })
      failCount++
    }
  }

  res.json({
    success: failCount === 0,
    message: `${successCount} Dokument(e) gelöscht${failCount > 0 ? `, ${failCount} fehlgeschlagen` : ''}`,
    results,
    deletedCount: successCount,
    failedCount: failCount,
  })
}))

// ============================================
// Socket.io Connection Handling
// ============================================

// ============================================
// Processing Job Events
// ============================================

// Listen for processing updates and broadcast to connected clients
processingJobService.on('processingUpdate', (event) => {
  io.emit('processing:update', event)
})

io.on('connection', (socket) => {
  // Send active jobs to newly connected client
  socket.emit('processing:active_jobs', {
    jobs: processingJobService.getActiveJobs(),
    timestamp: new Date().toISOString(),
  })

  // Handle chat message - will be used for LLM streaming
  socket.on('chat:message', (data: { conversationId: string; message: string }) => {
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
  socket.on('disconnect', () => {
    // Client disconnected
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
  // Server started
})

export { io }
export default app
