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
