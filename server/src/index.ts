import express, { type Request, type Response } from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import multer from 'multer'
import path from 'path'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { env } from './config/env.js'
import {
  errorHandler,
  asyncHandler,
  notFoundHandler,
  optionalAuth,
  authenticateToken,
  enforceHTTPS,
  securityHeaders,
  createRateLimiter,
  inputSanitization,
  secureCookies
} from './middleware/index.js'
import { ValidationError } from './errors/index.js'
import {
  chatRequestSchema,
  modelQuerySchema,
  validate,
  formatValidationErrors,
  type ChatRequest,
  type ModelQuery,
} from './validation/index.js'
import { type AuthenticatedRequest } from './types/auth.js'
import { ollamaService, documentService, ragService, rerankerService } from './services/index.js'
import { authService } from './services/AuthService.js'
import { processingJobService } from './services/ProcessingJobService.js'
import { quotaService } from './services/QuotaService.js'
import { documentEventService } from './services/DocumentEventService.js'
import authRoutes from './routes/auth.js'
import adminRoutes from './routes/admin.js'
import quotaRoutes from './routes/quota.js'
import settingsRoutes from './routes/settings.js'
import evaluationRoutes from './routes/evaluation.js'
import { createMonitoringRouter } from './routes/monitoring.js'
import { createRedisCacheFromEnv } from './services/cache/index.js'
import { databaseService } from './services/index.js'

const app = express()
const httpServer = createServer(app)

// ============================================
// Security Middleware (Applied First)
// ============================================

// HTTPS enforcement for production OAuth2 callbacks
app.use(enforceHTTPS)

// Comprehensive security headers
app.use(securityHeaders)

// Input sanitization against injection attacks
app.use(inputSanitization)

// Secure cookie configuration
app.use(secureCookies)

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
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
)

// Cookie parser middleware (must be before routes that use cookies)
app.use(cookieParser())

// JSON body parser
app.use(express.json())

// ============================================
// Authentication Routes (with Rate Limiting)
// ============================================

// Apply rate limiting to auth routes to prevent brute force attacks
const authRateLimiter = createRateLimiter({ maxAttempts: 10, windowMs: 15 * 60 * 1000 }) // 10 requests per 15 min
const adminRateLimiter = createRateLimiter({ maxAttempts: 100, windowMs: 15 * 60 * 1000 }) // 100 requests per 15 min
const generalRateLimiter = createRateLimiter({ maxAttempts: 200, windowMs: 15 * 60 * 1000 }) // 200 requests per 15 min

app.use('/api/auth', authRateLimiter, authRoutes)
app.use('/api/admin', adminRateLimiter, adminRoutes)
app.use('/api/quota', generalRateLimiter, quotaRoutes) // Higher limit for frequently accessed endpoints
app.use('/api/admin/settings', adminRateLimiter, settingsRoutes)
app.use('/api/evaluation', adminRateLimiter, evaluationRoutes) // RAG Evaluation Framework (Admin only)

// ============================================
// Monitoring Routes (Phase 6 - Production Hardening)
// ============================================
const redisCache = createRedisCacheFromEnv();
const monitoringRouter = createMonitoringRouter(
  databaseService,
  redisCache,
  ragService.getTracingService()
);
app.use('/api/monitoring', adminRateLimiter, monitoringRouter);

// Initialize Redis cache (non-blocking)
redisCache.initialize().catch((err: Error) => {
  console.warn('[Server] Redis cache initialization failed:', err.message);
});

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
    fileSize: 150 * 1024 * 1024, // 150MB
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

app.post('/api/chat', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
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
        // Extract user context for permission-aware RAG
        const userContext = req.user ? {
          userId: req.user.user_id,
          userRole: req.user.role,
          userDepartment: req.user.department,
        } : undefined;

        const ragResponse = await ragService.generateStreamingResponse({
          messages: chatRequest.messages,
          model: chatRequest.model || 'qwen3:8b',
          query: ragQuery,
          searchLimit: chatRequest.rag?.searchLimit || 5,
          searchThreshold: chatRequest.rag?.searchThreshold || 0.5,
          hybridAlpha: chatRequest.rag?.hybridAlpha ?? 0.5,
          userContext, // NEW: Pass user context for permission filtering
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
        // Extract user context for permission-aware RAG (non-streaming)
        const userContext = req.user ? {
          userId: req.user.user_id,
          userRole: req.user.role,
          userDepartment: req.user.department,
        } : undefined;

        const ragResponse = await ragService.generateResponse({
          messages: chatRequest.messages,
          model: chatRequest.model || 'qwen3:8b',
          query: ragQuery,
          searchLimit: chatRequest.rag?.searchLimit || 5,
          searchThreshold: chatRequest.rag?.searchThreshold || 0.5,
          hybridAlpha: chatRequest.rag?.hybridAlpha ?? 0.5,
          userContext, // NEW: Pass user context for permission filtering
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

// Upload document endpoint with permissions
app.post('/api/documents/upload', authenticateToken, upload.single('document'), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
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

  // Validate against user quota
  const user = req.user!;
  const quotaValidation = await quotaService.validateUpload(user.user_id, user.role, req.file.size);
  if (!quotaValidation.allowed) {
    throw new ValidationError(quotaValidation.reason || 'Quota-Limit erreicht', {
      field: 'quota',
      details: [quotaValidation.reason || 'Upload würde Speicher-Quota überschreiten'],
      metadata: {
        currentUsage: quotaValidation.currentUsage
      }
    })
  }

  // Extract permission metadata from request body
  const {
    classification = 'internal',
    visibility = 'department',
    specificUsers = [],
    department
  } = req.body;

  // Validate classification against user role
  const userRole = req.user?.role || 'Employee';
  const allowedClassifications: Record<string, string[]> = {
    'Employee': ['public', 'internal'],
    'Manager': ['public', 'internal', 'confidential'],
    'Admin': ['public', 'internal', 'confidential', 'restricted']
  };

  if (!allowedClassifications[userRole]?.includes(classification)) {
    throw new ValidationError(`Rolle "${userRole}" kann keine "${classification}" Dokumente erstellen`, {
      field: 'classification',
      details: [`Erlaubte Klassifizierungen für ${userRole}: ${allowedClassifications[userRole]?.join(', ')}`],
    });
  }

  // Generate document ID for async processing
  const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // Create processing job for async execution with permission metadata
  const job = processingJobService.createJob(
    documentId,
    req.file.filename,
    req.file.originalname,
    {
      // Permission metadata to be used during processing
      ownerId: req.user?.user_id || null,
      department: department || req.user?.department || null,
      classification,
      visibility,
      specificUsers: Array.isArray(specificUsers) ? specificUsers : [],
      allowedRoles: visibility === 'all_users' ? ['Employee', 'Manager', 'Admin'] : null,
      allowedUsers: visibility === 'specific_users' ? specificUsers : null
    }
  )

  // Create audit log for document upload
  await authService.createAuditLog({
    userId: req.user?.user_id,
    userEmail: req.user?.email || 'unknown',
    action: 'document_upload',
    result: 'success',
    resourceType: 'document',
    resourceId: documentId,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
    metadata: {
      filename: req.file.originalname,
      size: req.file.size,
      classification,
      visibility,
      department: department || req.user?.department
    }
  });

  res.status(202).json({
    success: true,
    jobId: job.id,
    documentId,
    status: 'pending',
    message: 'Dokument wird verarbeitet. Sie erhalten Updates über den Status.',
    permissions: {
      classification,
      visibility,
      owner: req.user?.name || 'Unbekannt',
      department: department || req.user?.department || null
    }
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

// Get all documents endpoint - with department filtering via RLS
app.get('/api/documents', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // Set user context for PostgreSQL RLS filtering
  await documentService.setUserContext(
    req.user?.user_id || '',
    req.user?.role || '',
    req.user?.department || ''
  )

  // Get documents filtered by RLS policies (department, role, permissions)
  const documents = await documentService.getAccessibleDocuments()

  // Cleanup user context
  await documentService.clearUserContext()

  res.json({
    documents,
    totalCount: documents.length,
  })
}))

// Get all unique tags endpoint (BEFORE :id route!)
app.get('/api/documents/tags', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const tags = await documentService.getAllTags()
  res.json({ tags })
}))

// Get document categories endpoint (BEFORE :id route!)
app.get('/api/documents/categories', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { DOCUMENT_CATEGORIES } = await import('./services/DocumentService.js')
  res.json({ categories: DOCUMENT_CATEGORIES })
}))

// Get single document endpoint - with department filtering via RLS
app.get('/api/documents/:id', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params

  // Set user context for PostgreSQL RLS filtering
  await documentService.setUserContext(
    req.user?.user_id || '',
    req.user?.role || '',
    req.user?.department || ''
  )

  // Get all accessible documents and filter by ID (RLS-aware)
  const allAccessibleDocuments = await documentService.getAccessibleDocuments()
  const document = allAccessibleDocuments.find(doc => doc.id === id)

  // Cleanup user context
  await documentService.clearUserContext()

  if (!document) {
    res.status(404).json({
      error: 'Dokument nicht gefunden oder nicht autorisiert',
      id,
    })
    return
  }

  res.json({ document })
}))

// Delete document endpoint - with department filtering via RLS
app.delete('/api/documents/:id', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params

  // Set user context for PostgreSQL RLS filtering
  await documentService.setUserContext(
    req.user?.user_id || '',
    req.user?.role || '',
    req.user?.department || ''
  )

  // Check if user has access to this document before attempting deletion
  const allAccessibleDocuments = await documentService.getAccessibleDocuments()
  const hasAccess = allAccessibleDocuments.some(doc => doc.id === id)

  if (!hasAccess) {
    // Create audit log for denied access
    await authService.createAuditLog({
      userId: req.user?.user_id,
      userEmail: req.user?.email || 'unknown',
      action: 'document_delete',
      result: 'denied',
      resourceType: 'document',
      resourceId: id,
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      metadata: { reason: 'Access denied or document not found' }
    });

    // Cleanup user context
    await documentService.clearUserContext()

    res.status(404).json({
      error: 'Dokument nicht gefunden oder nicht autorisiert für Löschung',
      id,
    })
    return
  }

  // Get document details before deletion for real-time event
  const documentToDelete = allAccessibleDocuments.find(doc => doc.id === id)

  // User has access, proceed with deletion
  const success = await documentService.deleteDocument(id || '')

  // Emit real-time document deleted event
  if (success && documentToDelete) {
    documentEventService.emitDocumentDeleted({
      document: {
        id: documentToDelete.id,
        filename: documentToDelete.filename,
        originalName: documentToDelete.originalName || documentToDelete.filename
      },
      deletedBy: req.user?.user_id || 'unknown',
      deletedByEmail: req.user?.email || 'unknown@example.com',
      affectedUsers: [req.user?.user_id || 'unknown'] // For now, just the deleting user
    })

    // Create audit log for document deletion
    await authService.createAuditLog({
      userId: req.user?.user_id,
      userEmail: req.user?.email || 'unknown',
      action: 'document_delete',
      result: 'success',
      resourceType: 'document',
      resourceId: documentToDelete.id,
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      metadata: {
        filename: documentToDelete.originalName || documentToDelete.filename,
        classification: documentToDelete.metadata?.classification
      }
    });
  }

  // Cleanup user context
  await documentService.clearUserContext()

  if (!success) {
    res.status(500).json({
      error: 'Fehler beim Löschen des Dokuments',
      id,
    })
    return
  }

  res.json({
    success: true,
    message: 'Dokument erfolgreich gelöscht',
  })
}))

// Update document endpoint (category/tags) - with department filtering via RLS
app.patch('/api/documents/:id', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const { category, tags } = req.body

  // Set user context for PostgreSQL RLS filtering
  await documentService.setUserContext(
    req.user?.user_id || '',
    req.user?.role || '',
    req.user?.department || ''
  )

  // Check if user has access to this document before attempting update
  const allAccessibleDocuments = await documentService.getAccessibleDocuments()
  const hasAccess = allAccessibleDocuments.some(doc => doc.id === id)

  if (!hasAccess) {
    // Cleanup user context
    await documentService.clearUserContext()

    res.status(404).json({
      error: 'Dokument nicht gefunden oder nicht autorisiert für Bearbeitung',
      id,
    })
    return
  }

  // User has access, proceed with update
  const document = await documentService.updateDocument(id || '', { category, tags })

  // Cleanup user context
  await documentService.clearUserContext()

  if (!document) {
    res.status(500).json({
      error: 'Fehler beim Aktualisieren des Dokuments',
      id,
    })
    return
  }

  res.json({
    success: true,
    document,
  })
}))

// Update document permissions endpoint
app.patch('/api/documents/:id/permissions', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { id } = req.params
  const { classification, visibility, specificUsers } = req.body

  // Validate required fields
  if (!classification || !visibility) {
    res.status(400).json({
      error: 'classification and visibility are required',
      code: 'MISSING_REQUIRED_FIELDS'
    })
    return
  }

  // Validate classification values
  const validClassifications = ['public', 'internal', 'confidential', 'restricted']
  if (!validClassifications.includes(classification)) {
    res.status(400).json({
      error: 'Invalid classification value',
      code: 'INVALID_CLASSIFICATION',
      allowedValues: validClassifications
    })
    return
  }

  // Validate visibility values
  const validVisibilities = ['only_me', 'department', 'all_users', 'specific_users']
  if (!validVisibilities.includes(visibility)) {
    res.status(400).json({
      error: 'Invalid visibility value',
      code: 'INVALID_VISIBILITY',
      allowedValues: validVisibilities
    })
    return
  }

  // Set user context for PostgreSQL RLS filtering
  await documentService.setUserContext(
    req.user?.user_id || '',
    req.user?.role || '',
    req.user?.department || ''
  )

  try {
    // Check if user has permission to edit this document (owner or admin)
    const allAccessibleDocuments = await documentService.getAccessibleDocuments()
    const document = allAccessibleDocuments.find(doc => doc.id === id)

    if (!document) {
      await documentService.clearUserContext()
      res.status(404).json({
        error: 'Dokument nicht gefunden oder nicht autorisiert für Bearbeitung',
        code: 'DOCUMENT_NOT_FOUND'
      })
      return
    }

    // Check permission to edit (owner, admin, or manager as fallback for legacy documents)
    const isOwner = document.metadata?.owner_id === req.user?.user_id
    const isAdmin = req.user?.role === 'Admin'
    const isManagerForLegacyDoc = req.user?.role === 'Manager' && !document.metadata?.owner_id

    if (!isOwner && !isAdmin && !isManagerForLegacyDoc) {
      await documentService.clearUserContext()
      res.status(403).json({
        error: 'Nur der Dokumentenbesitzer oder Administrator können Berechtigungen ändern',
        code: 'PERMISSION_DENIED'
      })
      return
    }

    // Role-based classification validation
    const userRole = req.user?.role || ''
    const roleLevel = userRole === 'Admin' ? 3 : userRole === 'Manager' ? 2 : 1

    const classificationLevels: Record<string, number> = {
      'public': 1,
      'internal': 1,
      'confidential': 2,
      'restricted': 3
    }

    const requiredLevel = classificationLevels[classification] || 1

    if (roleLevel < requiredLevel) {
      await documentService.clearUserContext()
      res.status(403).json({
        error: `Ihre Rolle (${userRole}) erlaubt keine ${classification} Klassifizierung`,
        code: 'INSUFFICIENT_ROLE_LEVEL',
        allowedClassifications: Object.keys(classificationLevels).filter(c => classificationLevels[c] <= roleLevel)
      })
      return
    }

    // Update document permissions
    const updatedDocument = await documentService.updateDocumentPermissions(id, {
      classification,
      visibility,
      specificUsers: specificUsers || []
    })

    await documentService.clearUserContext()

    if (!updatedDocument) {
      res.status(500).json({
        error: 'Fehler beim Aktualisieren der Dokumentenberechtigungen',
        code: 'UPDATE_FAILED'
      })
      return
    }

    res.json({
      success: true,
      message: 'Dokumentenberechtigungen erfolgreich aktualisiert',
      document: {
        id: updatedDocument.id,
        classification: updatedDocument.metadata?.classification,
        visibility: updatedDocument.metadata?.visibility,
        specificUsers: updatedDocument.metadata?.specificUsers,
        updatedAt: updatedDocument.updatedAt
      }
    })

  } catch (error) {
    await documentService.clearUserContext()
    console.error('Error updating document permissions:', error)
    res.status(500).json({
      error: 'Interner Server-Fehler beim Aktualisieren der Berechtigungen',
      code: 'INTERNAL_SERVER_ERROR'
    })
  }
}))

// Bulk delete documents endpoint
app.post('/api/documents/bulk-delete', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
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
// RAG Endpoints
// ============================================

// RAG search endpoint - search for relevant documents
app.post('/api/rag/search', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { query, searchLimit = 5, searchThreshold = 0.5, hybridAlpha = 0.5 } = req.body

  if (!query || typeof query !== 'string') {
    res.status(400).json({
      error: 'Search query is required',
      code: 'MISSING_QUERY',
      message: 'Query field must be provided as a string'
    })
    return
  }

  try {
    // Extract user context for permission-aware search
    const userContext = req.user ? {
      userId: req.user.user_id,
      userRole: req.user.role,
      userDepartment: req.user.department,
    } : undefined

    const ragResponse = await ragService.generateResponse({
      messages: [], // Empty messages for search-only
      model: 'qwen3:8b',
      query,
      searchLimit,
      searchThreshold,
      hybridAlpha,
      userContext,
    })

    res.json({
      success: true,
      query,
      sources: ragResponse.sources,
      searchResults: ragResponse.searchResults,
      hasRelevantSources: ragResponse.hasRelevantSources,
      userContext: {
        role: req.user.role,
        department: req.user.department,
      }
    })
  } catch (error) {
    console.error('RAG search failed:', error)
    res.status(500).json({
      error: 'RAG search failed',
      code: 'RAG_SEARCH_ERROR',
      message: 'Failed to search documents with RAG'
    })
  }
}))

// RAG chat endpoint - generate response with document context
app.post('/api/rag/chat', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const {
    messages,
    query,
    model = 'qwen3:8b',
    searchLimit = 5,
    searchThreshold = 0.5,
    hybridAlpha = 0.5
  } = req.body

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({
      error: 'Messages array is required',
      code: 'MISSING_MESSAGES',
      message: 'Messages field must be provided as a non-empty array'
    })
    return
  }

  if (!query || typeof query !== 'string') {
    res.status(400).json({
      error: 'Query is required',
      code: 'MISSING_QUERY',
      message: 'Query field must be provided as a string'
    })
    return
  }

  try {
    // Extract user context for permission-aware RAG
    const userContext = req.user ? {
      userId: req.user.user_id,
      userRole: req.user.role,
      userDepartment: req.user.department,
    } : undefined

    const ragResponse = await ragService.generateResponse({
      messages,
      model,
      query,
      searchLimit,
      searchThreshold,
      hybridAlpha,
      userContext,
    })

    // Create audit log for RAG query
    await authService.createAuditLog({
      userId: req.user?.user_id,
      userEmail: req.user?.email || 'unknown',
      action: 'rag_query',
      result: 'success',
      resourceType: 'query',
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      metadata: {
        query: query.substring(0, 200), // Truncate for privacy
        model,
        hasRelevantSources: ragResponse.hasRelevantSources,
        sourcesCount: ragResponse.sources?.length || 0
      }
    });

    res.json({
      success: true,
      message: ragResponse.message,
      sources: ragResponse.sources,
      searchResults: ragResponse.searchResults,
      hasRelevantSources: ragResponse.hasRelevantSources,
      userContext: {
        role: req.user.role,
        department: req.user.department,
      }
    })
  } catch (error) {
    console.error('RAG chat failed:', error)

    // Create audit log for failed RAG query
    await authService.createAuditLog({
      userId: req.user?.user_id,
      userEmail: req.user?.email || 'unknown',
      action: 'rag_query',
      result: 'failure',
      resourceType: 'query',
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      metadata: {
        query: query.substring(0, 200),
        model,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });

    res.status(500).json({
      error: 'RAG chat failed',
      code: 'RAG_CHAT_ERROR',
      message: 'Failed to generate RAG response'
    })
  }
}))

// ============================================
// Ollama Endpoints
// ============================================

// Ollama models endpoint - protected version of /api/models
app.get('/api/ollama/models', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // Validate query parameters (optional filters)
  const queryValidation = validate(modelQuerySchema, req.query)
  if (!queryValidation.success) {
    throw new ValidationError(formatValidationErrors(queryValidation.errors), {
      field: 'query',
      details: queryValidation.errors,
    })
  }
  const query: ModelQuery = queryValidation.data

  try {
    // Use OllamaService to get models
    const result = await ollamaService.getModels({
      search: query.search,
      family: query.family,
    })

    res.json({
      success: true,
      models: result.models,
      defaultModel: ollamaService.getDefaultModel(),
      totalCount: result.totalCount,
      userContext: {
        role: req.user.role,
        department: req.user.department,
      }
    })
  } catch (error) {
    console.error('Ollama models failed:', error)
    res.status(500).json({
      error: 'Failed to get models',
      code: 'OLLAMA_MODELS_ERROR',
      message: 'Failed to retrieve Ollama models'
    })
  }
}))

// Ollama health endpoint - protected version for monitoring
app.get('/api/ollama/health', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const ollamaHealth = await ollamaService.healthCheck(5000)

    const healthStatus = {
      success: true,
      status: ollamaHealth.status,
      url: ollamaHealth.url,
      defaultModel: ollamaHealth.defaultModel,
      availableModels: ollamaHealth.availableModels,
      error: ollamaHealth.error,
      userContext: {
        role: req.user.role,
        department: req.user.department,
      }
    }

    // Set appropriate HTTP status
    const httpStatus = ollamaHealth.status === 'ok' ? 200 : 503
    res.status(httpStatus).json(healthStatus)
  } catch (error) {
    console.error('Ollama health check failed:', error)
    res.status(500).json({
      error: 'Health check failed',
      code: 'OLLAMA_HEALTH_ERROR',
      message: 'Failed to check Ollama health'
    })
  }
}))

// Ollama chat endpoint - direct protected access to Ollama
app.post('/api/ollama/chat', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { messages, model, options } = req.body

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({
      error: 'Messages array is required',
      code: 'MISSING_MESSAGES',
      message: 'Messages field must be provided as a non-empty array'
    })
    return
  }

  try {
    const response = await ollamaService.chat({
      messages,
      model: model || 'qwen3:8b',
      options,
    })

    res.json({
      success: true,
      ...response,
      userContext: {
        role: req.user.role,
        department: req.user.department,
      }
    })
  } catch (error) {
    console.error('Ollama chat failed:', error)
    res.status(500).json({
      error: 'Ollama chat failed',
      code: 'OLLAMA_CHAT_ERROR',
      message: 'Failed to get Ollama chat response'
    })
  }
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

// Listen for document events and broadcast to connected clients
documentEventService.on('document:uploaded', (event) => {
  io.emit('document:uploaded', event)
})

documentEventService.on('document:deleted', (event) => {
  io.emit('document:deleted', event)
})

documentEventService.on('document:updated', (event) => {
  io.emit('document:updated', event)
})

documentEventService.on('document:permissions_changed', (event) => {
  io.emit('document:permissions_changed', event)
})

documentEventService.on('documents:bulk_deleted', (event) => {
  io.emit('documents:bulk_deleted', event)
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
httpServer.listen(env.PORT, async () => {
  console.log(`🚀 Server running on port ${env.PORT}`)

  // Initialize reranker service (Phase 1 - RAG V2)
  try {
    await rerankerService.initialize()
  } catch (error) {
    console.warn('⚠️  Reranker service initialization failed:', error)
  }
})

export { io }
export default app
