import { io, Socket } from 'socket.io-client'
import { env } from './env'

// Server URL - configurable via environment variable
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ?? env.WS_URL

// Socket.io client instance (singleton)
let socket: Socket | null = null

// Socket event types for type safety
export interface ChatMessagePayload {
  conversationId: string
  message: string
}

export interface ChatMessageAck {
  conversationId: string
  status: 'received' | 'error'
  timestamp: string
  error?: string
}

export interface ChatStreamToken {
  conversationId: string
  token: string
}

export interface ChatStreamEvent {
  conversationId: string
}

// Processing event types for document upload status
export interface ProcessingJob {
  id: string
  documentId: string
  documentName: string  // Display name for the document
  filename?: string     // Internal filename (optional, for backwards compat)
  originalName?: string // Original uploaded filename (optional)
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  currentChunk?: number
  totalChunks?: number
  error?: string
  createdAt: string
  startedAt?: string
  completedAt?: string
}

export interface ProcessingUpdate {
  jobId: string
  documentId: string
  documentName?: string  // Display name for the document
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: number
  currentChunk?: number
  totalChunks?: number
  error?: string
  timestamp: string
}

export interface ProcessingEvent {
  type: 'job:created' | 'job:started' | 'job:progress' | 'job:completed' | 'job:failed'
  jobId: string
  data: ProcessingUpdate
}

export interface ActiveJobsPayload {
  jobs: ProcessingJob[]
  timestamp: string
}

// Document Real-time Event Types
export interface DocumentUploadedEvent {
  type: 'document:uploaded'
  document: {
    id: string
    filename: string
    originalName: string
    category: string
    tags: string[]
    size: number
    uploadedBy: string
    uploadedByEmail: string
    createdAt: string
  }
  affectedUsers: string[] // User IDs who can see this document
  timestamp: string
}

export interface DocumentDeletedEvent {
  type: 'document:deleted'
  document: {
    id: string
    filename: string
    originalName: string
  }
  deletedBy: string
  deletedByEmail: string
  affectedUsers: string[] // User IDs who had access to this document
  timestamp: string
}

export interface DocumentUpdatedEvent {
  type: 'document:updated'
  document: {
    id: string
    filename: string
    originalName: string
    category: string
    tags: string[]
    updatedFields: string[] // Which fields were updated
  }
  updatedBy: string
  updatedByEmail: string
  affectedUsers: string[] // User IDs who can see this document
  timestamp: string
}

export interface DocumentPermissionsChangedEvent {
  type: 'document:permissions_changed'
  document: {
    id: string
    filename: string
    originalName: string
    classification: string
    visibility: string
    specificUsers: string[]
  }
  changedBy: string
  changedByEmail: string
  addedUsers: string[]    // Users who gained access
  removedUsers: string[]  // Users who lost access
  timestamp: string
}

export interface DocumentsBulkDeletedEvent {
  type: 'documents:bulk_deleted'
  documents: Array<{
    id: string
    filename: string
    originalName: string
  }>
  deletedBy: string
  deletedByEmail: string
  affectedUsers: string[] // User IDs who had access to any of these documents
  timestamp: string
}

// Get or create socket connection
export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    })

    // Debug logging in development
    if (import.meta.env.DEV) {
      socket.on('connect', () => {
        console.log('🔌 Socket connected:', socket?.id)
      })

      socket.on('disconnect', (reason) => {
        console.log('🔌 Socket disconnected:', reason)
      })

      socket.on('connect_error', (error) => {
        console.error('❌ Socket connection error:', error.message)
      })
    }
  }

  return socket
}

// Connect to server
export function connectSocket(): void {
  const sock = getSocket()
  if (!sock.connected) {
    sock.connect()
  }
}

// Disconnect from server
export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect()
  }
}

// Check connection status
export function isSocketConnected(): boolean {
  return socket?.connected ?? false
}

// Send chat message
export function sendChatMessage(payload: ChatMessagePayload): void {
  const sock = getSocket()
  if (sock.connected) {
    sock.emit('chat:message', payload)
  } else {
    console.warn('Socket not connected. Message not sent.')
  }
}

// Subscribe to chat events
export function onChatMessageAck(callback: (data: ChatMessageAck) => void): () => void {
  const sock = getSocket()
  sock.on('chat:message:ack', callback)
  return () => sock.off('chat:message:ack', callback)
}

export function onChatStreamStart(callback: (data: ChatStreamEvent) => void): () => void {
  const sock = getSocket()
  sock.on('chat:stream:start', callback)
  return () => sock.off('chat:stream:start', callback)
}

export function onChatStreamToken(callback: (data: ChatStreamToken) => void): () => void {
  const sock = getSocket()
  sock.on('chat:stream:token', callback)
  return () => sock.off('chat:stream:token', callback)
}

export function onChatStreamEnd(callback: (data: ChatStreamEvent) => void): () => void {
  const sock = getSocket()
  sock.on('chat:stream:end', callback)
  return () => sock.off('chat:stream:end', callback)
}

// Processing event subscription functions
export function onProcessingUpdate(callback: (event: ProcessingEvent) => void): () => void {
  const sock = getSocket()
  sock.on('processing:update', callback)
  return () => sock.off('processing:update', callback)
}

export function onActiveJobs(callback: (data: ActiveJobsPayload) => void): () => void {
  const sock = getSocket()
  sock.on('processing:active_jobs', callback)
  return () => sock.off('processing:active_jobs', callback)
}

// Document Real-time Event Subscription Functions
export function onDocumentUploaded(callback: (event: DocumentUploadedEvent) => void): () => void {
  const sock = getSocket()
  sock.on('document:uploaded', callback)
  return () => sock.off('document:uploaded', callback)
}

export function onDocumentDeleted(callback: (event: DocumentDeletedEvent) => void): () => void {
  const sock = getSocket()
  sock.on('document:deleted', callback)
  return () => sock.off('document:deleted', callback)
}

export function onDocumentUpdated(callback: (event: DocumentUpdatedEvent) => void): () => void {
  const sock = getSocket()
  sock.on('document:updated', callback)
  return () => sock.off('document:updated', callback)
}

export function onDocumentPermissionsChanged(callback: (event: DocumentPermissionsChangedEvent) => void): () => void {
  const sock = getSocket()
  sock.on('document:permissions_changed', callback)
  return () => sock.off('document:permissions_changed', callback)
}

export function onDocumentsBulkDeleted(callback: (event: DocumentsBulkDeletedEvent) => void): () => void {
  const sock = getSocket()
  sock.on('documents:bulk_deleted', callback)
  return () => sock.off('documents:bulk_deleted', callback)
}

// Export socket instance for direct access if needed
export { socket }
