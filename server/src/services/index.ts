/**
 * Services barrel export
 */

export {
  OllamaService,
  ollamaService,
  type OllamaModel,
  type OllamaModelDetails,
  type OllamaTagsResponse,
  type FormattedModel,
  type OllamaHealthStatus,
  type OllamaChatMessage,
  type OllamaChatOptions,
  type OllamaChatRequest,
  type OllamaChatResponse,
  type OllamaChatStreamChunk,
} from './OllamaService.js'

export {
  documentService,
  type DocumentMetadata,
  type ProcessingResult,
  type DocumentUploadRequest,
  documentUploadSchema,
} from './DocumentService.js'

export {
  vectorService,
  type DocumentChunk,
  type SearchResult,
  type VectorSearchRequest,
  type VectorSearchResponse,
} from './VectorService.js'

export {
  ragService,
  type RAGRequest,
  type RAGSource,
  type RAGResponse,
} from './RAGService.js'

export {
  databaseService,
} from './DatabaseService.js'

export {
  embeddingService,
  type EmbeddingResponse,
} from './EmbeddingService.js'

export {
  authService,
  AuthService,
} from './AuthService.js'
