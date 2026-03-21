import express, { type Request, type Response } from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { env } from './config/env.js'
import {
  errorHandler,
  asyncHandler,
  notFoundHandler,
  enforceHTTPS,
  securityHeaders,
  createRateLimiter,
  inputSanitization,
  secureCookies
} from './middleware/index.js'
import { ollamaService, ragService, rerankerService, databaseService } from './services/index.js'
import { processingJobService } from './services/ProcessingJobService.js'
import { documentEventService } from './services/DocumentEventService.js'
import { createRedisCacheFromEnv } from './services/cache/index.js'

// Route imports
import authRoutes from './routes/auth.js'
import adminRoutes from './routes/admin.js'
import quotaRoutes from './routes/quota.js'
import settingsRoutes from './routes/settings.js'
import evaluationRoutes from './routes/evaluation.js'
import { createMonitoringRouter } from './routes/monitoring.js'
import chatRoutes from './routes/chat.js'
import modelRoutes from './routes/models.js'
import documentRoutes from './routes/documents.js'
import ragRoutes from './routes/rag.js'
import ollamaRoutes from './routes/ollama.js'
import processingRoutes from './routes/processing.js'
import conversationRoutes from './routes/conversations.js'
import usageRoutes from './routes/usage.js'
import agentRoutes from './routes/agents.js'
import { llmRouter, PIIGuard } from './services/llm/index.js'
import { initializeAgentSystem } from './services/agents/index.js'

const app = express()
const httpServer = createServer(app)

// ============================================
// Security Middleware
// ============================================

app.use(enforceHTTPS)
app.use(securityHeaders)
app.use(inputSanitization)
app.use(secureCookies)

// Socket.io setup
const io = new Server(httpServer, {
  cors: {
    origin: env.CORS_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
})

// Express middleware
app.use(cors({
  origin: env.CORS_ORIGINS,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}))
app.use(cookieParser())
app.use(express.json())

// ============================================
// Rate Limiters
// ============================================

const authRateLimiter = createRateLimiter({ maxAttempts: 10, windowMs: 15 * 60 * 1000 })
const adminRateLimiter = createRateLimiter({ maxAttempts: 100, windowMs: 15 * 60 * 1000 })
const generalRateLimiter = createRateLimiter({ maxAttempts: 200, windowMs: 15 * 60 * 1000 })

// ============================================
// Routes
// ============================================

// Auth & Admin
app.use('/api/auth', authRateLimiter, authRoutes)
app.use('/api/admin', adminRateLimiter, adminRoutes)
app.use('/api/admin/settings', adminRateLimiter, settingsRoutes)
app.use('/api/quota', generalRateLimiter, quotaRoutes)
app.use('/api/evaluation', adminRateLimiter, evaluationRoutes)

// Monitoring
const redisCache = createRedisCacheFromEnv();
const monitoringRouter = createMonitoringRouter(databaseService, redisCache, ragService.getTracingService());
app.use('/api/monitoring', adminRateLimiter, monitoringRouter);

redisCache.initialize().catch((err: Error) => {
  console.warn('[Server] Redis cache initialization failed:', err.message);
});

// Core API
app.use('/api/chat', chatRoutes)
app.use('/api/models', modelRoutes)
app.use('/api/documents', documentRoutes)
app.use('/api/rag', ragRoutes)
app.use('/api/ollama', ollamaRoutes)
app.use('/api/processing', processingRoutes)
app.use('/api/conversations', conversationRoutes)
app.use('/api/admin/usage', adminRateLimiter, usageRoutes)
app.use('/api/agents', generalRateLimiter, agentRoutes)

// ============================================
// Health & Root
// ============================================

app.get('/api/health', asyncHandler(async (_req: Request, res: Response) => {
  const ollamaHealth = await ollamaService.healthCheck(5000)

  res.status(ollamaHealth.status === 'ok' ? 200 : 503).json({
    status: ollamaHealth.status === 'ok' ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    services: {
      backend: { status: 'ok' as const, uptime: process.uptime() },
      websocket: { status: 'ok' as const, connections: io.engine.clientsCount },
      ollama: {
        status: ollamaHealth.status,
        url: ollamaHealth.url,
        default_model: ollamaHealth.defaultModel,
        available_models: ollamaHealth.availableModels,
        error: ollamaHealth.error,
      },
    },
  })
}))

app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'Cor7ex API',
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
// Socket.io
// ============================================

processingJobService.on('processingUpdate', (event) => {
  io.emit('processing:update', event)
})

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
  socket.emit('processing:active_jobs', {
    jobs: processingJobService.getActiveJobs(),
    timestamp: new Date().toISOString(),
  })

  socket.on('chat:message', (data: { conversationId: string; message: string }) => {
    socket.emit('chat:message:ack', {
      conversationId: data.conversationId,
      status: 'received',
      timestamp: new Date().toISOString(),
    })
    socket.emit('chat:stream:start', { conversationId: data.conversationId })
    socket.emit('chat:stream:token', {
      conversationId: data.conversationId,
      token: 'Socket.io connection working!',
    })
    socket.emit('chat:stream:end', { conversationId: data.conversationId })
  })

  socket.on('disconnect', () => {})

  socket.on('error', (error) => {
    console.error(`❌ Socket error for ${socket.id}:`, error)
  })
})

// ============================================
// Error Handling (must be last)
// ============================================

app.use(notFoundHandler)
app.use(errorHandler)

// ============================================
// Start Server
// ============================================

httpServer.on('listening', async () => {
  console.log(`🚀 Server running on port ${env.PORT}`)

  // Initialize PII Guard for cloud LLM providers
  try {
    const piiGuard = new PIIGuard();
    const piiAvailable = await piiGuard.isAvailable();
    if (piiAvailable) {
      llmRouter.setPIIGuard(piiGuard);
      console.log('✅ PII Guard initialized (Presidio available)');
    } else {
      console.warn('⚠️  PII Guard: Presidio not available, cloud models will work without PII masking');
    }
  } catch (error) {
    console.warn('⚠️  PII Guard initialization failed:', error);
  }

  try {
    await rerankerService.initialize()
  } catch (error) {
    console.warn('⚠️  Reranker service initialization failed:', error)
  }

  try {
    await ragService.initialize(databaseService)
    console.log('✅ RAG service initialized (Graph RAG enabled:', process.env.GRAPH_ENABLED === 'true', ')')
  } catch (error) {
    console.warn('⚠️  RAG service initialization failed:', error)
  }

  // Initialize Agent System
  try {
    initializeAgentSystem()
    console.log('✅ Agent system initialized')
  } catch (error) {
    console.warn('⚠️  Agent system initialization failed:', error)
  }
})

httpServer.on('error', (err) => {
  console.error('❌ Server error:', err)
})

httpServer.listen(env.PORT)

export { io }
export default app
