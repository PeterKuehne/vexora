/**
 * Ollama API Types
 * TypeScript interfaces matching the official Ollama API specification
 * @see https://github.com/ollama/ollama/blob/main/docs/api.md
 */

// ============================================
// Model Types
// ============================================

/**
 * Model details from Ollama
 */
export interface OllamaModelDetails {
  /** Parent model (if any) */
  parent_model?: string;
  /** Format of the model (e.g., 'gguf') */
  format: string;
  /** Model family (e.g., 'qwen3', 'llama') */
  family: string;
  /** Model families this model belongs to */
  families?: string[];
  /** Parameter size (e.g., '8.2B') */
  parameter_size: string;
  /** Quantization level (e.g., 'Q4_K_M') */
  quantization_level: string;
}

/**
 * Ollama model info from /api/tags
 * Represents a locally available model
 */
export interface OllamaModel {
  /** Model name with tag (e.g., 'qwen3:8b') */
  name: string;
  /** Base model name without tag */
  model?: string;
  /** Last modification timestamp */
  modified_at: string;
  /** Model size in bytes */
  size: number;
  /** SHA256 digest of the model */
  digest: string;
  /** Detailed model information */
  details: OllamaModelDetails;
}

/**
 * Response from GET /api/tags
 * Lists all locally available models
 */
export interface OllamaTagsResponse {
  models: OllamaModel[];
}

// ============================================
// Chat Request Types
// ============================================

/**
 * Message in Ollama chat format
 */
export interface OllamaChatMessage {
  /** Role of the message sender */
  role: 'system' | 'user' | 'assistant';
  /** Message content */
  content: string;
  /** Optional images for multimodal models (base64 encoded) */
  images?: string[];
}

/**
 * Model generation options
 * @see https://github.com/ollama/ollama/blob/main/docs/modelfile.md#valid-parameters-and-values
 */
export interface OllamaGenerationOptions {
  /** Random seed for generation */
  seed?: number;
  /** Number of tokens to predict (-1 = infinite, -2 = fill context) */
  num_predict?: number;
  /** Top-K sampling (reduces probability of unlikely tokens) */
  top_k?: number;
  /** Nucleus sampling threshold */
  top_p?: number;
  /** Min-P sampling threshold */
  min_p?: number;
  /** Temperature for randomness (higher = more random) */
  temperature?: number;
  /** How strongly to penalize repetitions */
  repeat_penalty?: number;
  /** Presence penalty for new topics */
  presence_penalty?: number;
  /** Frequency penalty for token frequency */
  frequency_penalty?: number;
  /** Mirostat mode (0 = disabled, 1 = Mirostat, 2 = Mirostat 2.0) */
  mirostat?: 0 | 1 | 2;
  /** Mirostat target entropy */
  mirostat_tau?: number;
  /** Mirostat learning rate */
  mirostat_eta?: number;
  /** Penalize newline tokens */
  penalize_newline?: boolean;
  /** Stop sequences */
  stop?: string[];
  /** Context window size (overrides default) */
  num_ctx?: number;
  /** Number of batches for prompt processing */
  num_batch?: number;
  /** Number of GQA groups (for some models) */
  num_gqa?: number;
  /** Number of GPU layers to use */
  num_gpu?: number;
  /** Main GPU index */
  main_gpu?: number;
  /** Low VRAM mode */
  low_vram?: boolean;
  /** F16 key/value precision */
  f16_kv?: boolean;
  /** Use memory-mapped files */
  use_mmap?: boolean;
  /** Use memory locking */
  use_mlock?: boolean;
  /** Number of threads for generation */
  num_thread?: number;
}

/**
 * Chat completion request to POST /api/chat
 */
export interface OllamaChatRequest {
  /** Model name (e.g., 'qwen3:8b') */
  model: string;
  /** Array of messages in the conversation */
  messages: OllamaChatMessage[];
  /** Format of the response ('json' for JSON mode) */
  format?: 'json' | string;
  /** Generation options */
  options?: OllamaGenerationOptions;
  /** Whether to stream the response (default: true) */
  stream?: boolean;
  /** Keep the model loaded for this duration (e.g., '5m', '24h') */
  keep_alive?: string;
}

// ============================================
// Chat Response Types
// ============================================

/**
 * Chat completion response from POST /api/chat
 * When stream is false, returns the complete response
 */
export interface OllamaChatResponse {
  /** Model that generated the response */
  model: string;
  /** Timestamp of when response was created */
  created_at: string;
  /** The assistant's response message */
  message: OllamaChatMessage;
  /** Whether generation is complete */
  done: boolean;
  /** Reason for completion (only when done=true) */
  done_reason?: 'stop' | 'length' | 'load';
  /** Total generation duration in nanoseconds */
  total_duration?: number;
  /** Time spent loading the model in nanoseconds */
  load_duration?: number;
  /** Number of tokens in the prompt */
  prompt_eval_count?: number;
  /** Time spent evaluating prompt in nanoseconds */
  prompt_eval_duration?: number;
  /** Number of generated tokens */
  eval_count?: number;
  /** Time spent generating in nanoseconds */
  eval_duration?: number;
}

/**
 * Streaming chunk response from POST /api/chat when stream=true
 * Intermediate chunks have done=false
 */
export interface OllamaChatStreamChunk {
  /** Model that generated the response */
  model: string;
  /** Timestamp of this chunk */
  created_at: string;
  /** Partial message (contains delta content) */
  message: OllamaChatMessage;
  /** Whether this is the final chunk */
  done: boolean;
}

/**
 * Final streaming chunk with statistics (done=true)
 */
export interface OllamaChatStreamFinal extends OllamaChatResponse {
  done: true;
}

// ============================================
// Generate Request/Response Types (legacy)
// ============================================

/**
 * Generate completion request to POST /api/generate
 * Legacy endpoint - prefer /api/chat for chat completions
 */
export interface OllamaGenerateRequest {
  /** Model name */
  model: string;
  /** Prompt text */
  prompt: string;
  /** Optional suffix for fill-in-the-middle */
  suffix?: string;
  /** Optional images for multimodal (base64) */
  images?: string[];
  /** Format ('json' for JSON mode) */
  format?: 'json' | string;
  /** Generation options */
  options?: OllamaGenerationOptions;
  /** System prompt */
  system?: string;
  /** Raw mode (no template) */
  raw?: boolean;
  /** Whether to stream */
  stream?: boolean;
  /** Keep alive duration */
  keep_alive?: string;
}

/**
 * Generate completion response from POST /api/generate
 */
export interface OllamaGenerateResponse {
  /** Model used */
  model: string;
  /** Timestamp */
  created_at: string;
  /** Generated text response */
  response: string;
  /** Whether generation is complete */
  done: boolean;
  /** Reason for completion */
  done_reason?: 'stop' | 'length' | 'load';
  /** Context array for follow-up requests */
  context?: number[];
  /** Statistics (same as chat response) */
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

// ============================================
// Model Management Types
// ============================================

/**
 * Request to pull a model from registry
 */
export interface OllamaPullRequest {
  /** Model name to pull */
  name: string;
  /** Allow insecure connections */
  insecure?: boolean;
  /** Stream progress updates */
  stream?: boolean;
}

/**
 * Pull progress response
 */
export interface OllamaPullResponse {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
}

/**
 * Show model information request
 */
export interface OllamaShowRequest {
  /** Model name to get info for */
  name: string;
}

/**
 * Show model information response
 */
export interface OllamaShowResponse {
  /** License information */
  license?: string;
  /** Model file content */
  modelfile?: string;
  /** Model parameters */
  parameters?: string;
  /** Template string */
  template?: string;
  /** Model details */
  details: OllamaModelDetails;
  /** Model information */
  model_info?: Record<string, unknown>;
}

// ============================================
// Error Types
// ============================================

/**
 * Error response from Ollama API
 */
export interface OllamaErrorResponse {
  error: string;
}

// ============================================
// Utility Types
// ============================================

/**
 * Type guard to check if response is an error
 */
export function isOllamaError(
  response: unknown
): response is OllamaErrorResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'error' in response &&
    typeof (response as OllamaErrorResponse).error === 'string'
  );
}

/**
 * Calculate tokens per second from response
 */
export function calculateTokensPerSecond(
  response: OllamaChatResponse | OllamaGenerateResponse
): number | null {
  if (response.eval_count && response.eval_duration) {
    // eval_duration is in nanoseconds
    return response.eval_count / (response.eval_duration / 1e9);
  }
  return null;
}
