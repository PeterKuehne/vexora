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

export {
  rerankerService,
  RerankerService,
  type RerankerConfig,
  type RerankedChunk,
  type RerankerResult,
} from './rag/RerankerService.js'

// V2 Services (RAG V2 Phase 2)
export {
  vectorServiceV2,
  type DocumentChunkV2,
  type SearchResultV2,
  type VectorSearchRequestV2,
  type VectorSearchResponseV2,
} from './VectorServiceV2.js'

export {
  parserClientService,
  ParserClientService,
  type ParserClientConfig,
} from './parsing/index.js'

export {
  chunkingPipeline,
  ChunkingPipeline,
  createChunkingPipeline,
  semanticChunker,
  SemanticChunker,
  tableChunker,
  TableChunker,
  hierarchicalIndexer,
  HierarchicalIndexer,
} from './chunking/index.js'
