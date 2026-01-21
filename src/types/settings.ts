/**
 * Settings Types
 * Defines the structure for app and model settings
 */

/**
 * Theme options
 */
export type Theme = 'light' | 'dark' | 'system';

/**
 * Model Profile - predefined configurations for different hardware
 */
export interface ModelProfile {
  /** Profile identifier */
  id: string;
  /** Display name for UI */
  name: string;
  /** Description of the profile */
  description: string;
  /** Recommended LLM model */
  llmModel: string;
  /** Recommended embedding model */
  embeddingModel: string;
  /** Recommended temperature */
  temperature: number;
  /** Recommended max tokens */
  maxTokens: number;
  /** Estimated VRAM usage in GB */
  estimatedVRAM: number;
}

/**
 * Predefined model profiles for different hardware configurations
 */
export const MODEL_PROFILES: ModelProfile[] = [
  {
    id: 'macbook-8gb',
    name: 'MacBook 8GB',
    description: 'Leichtgewichtige Modelle für 8GB RAM',
    llmModel: 'llama3.2:latest',
    embeddingModel: 'nomic-embed-text:latest',
    temperature: 0.7,
    maxTokens: 2048,
    estimatedVRAM: 4,
  },
  {
    id: 'macbook-16gb',
    name: 'MacBook 16GB',
    description: 'Ausgewogene Modelle für 16GB RAM',
    llmModel: 'qwen3:8b',
    embeddingModel: 'nomic-embed-text:latest',
    temperature: 0.7,
    maxTokens: 4096,
    estimatedVRAM: 8,
  },
  {
    id: 'workstation-32gb',
    name: 'Workstation 32GB',
    description: 'Größere Modelle für 32GB+ RAM',
    llmModel: 'qwen3:8b',
    embeddingModel: 'nomic-embed-text:latest',
    temperature: 0.7,
    maxTokens: 8192,
    estimatedVRAM: 12,
  },
  {
    id: 'custom',
    name: 'Benutzerdefiniert',
    description: 'Manuelle Modell-Auswahl',
    llmModel: '',
    embeddingModel: '',
    temperature: 0.7,
    maxTokens: 4096,
    estimatedVRAM: 0,
  },
];

/**
 * Font size options
 */
export type FontSize = 'small' | 'medium' | 'large';

/**
 * Application settings stored in localStorage
 */
export interface AppSettings {
  /** Current theme setting */
  theme: Theme;
  /** Font size for messages */
  fontSize: FontSize;
  /** Whether to send message on Enter (vs Shift+Enter) */
  sendOnEnter: boolean;
  /** Whether to show timestamps on messages */
  showTimestamps: boolean;
  /** Default model for new conversations */
  defaultModel: string;
  /** Embedding model for RAG document indexing */
  embeddingModel: string;
  /** Whether to enable streaming responses */
  enableStreaming: boolean;
  /** Whether to show markdown preview in input */
  showMarkdownPreview: boolean;
  /** Whether sidebar is collapsed (for persistence) */
  sidebarCollapsed: boolean;
  /** Whether to automatically save conversations */
  autoSave: boolean;
  /** System prompt to prepend to all conversations */
  systemPrompt?: string;
  /** Selected model profile ID */
  modelProfile: string;
  /** Hybrid search alpha (0.0 = keyword/BM25, 1.0 = semantic/vector) */
  hybridSearchAlpha: number;
  /** Number of top-K chunks to retrieve for RAG (1-10) */
  ragTopK: number;
}

/**
 * Default settings values
 */
export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  fontSize: 'medium',
  sendOnEnter: true,
  showTimestamps: true,
  defaultModel: 'qwen3:8b',
  embeddingModel: 'nomic-embed-text:latest',
  enableStreaming: true,
  showMarkdownPreview: false,
  sidebarCollapsed: false,
  autoSave: true,
  systemPrompt: '',
  modelProfile: 'custom',
  hybridSearchAlpha: 0.5, // Default: balanced hybrid search
  ragTopK: 5, // Default: retrieve top 5 chunks for RAG
};

/**
 * Model configuration for the model selector
 */
export interface ModelConfig {
  /** Model identifier (e.g., 'qwen3:8b') */
  name: string;
  /** Display name for UI (e.g., 'Qwen 3 8B') */
  displayName: string;
  /** Maximum context length in tokens */
  contextLength: number;
  /** Default temperature (0-2) */
  temperature: number;
  /** Default top_p value (0-1) */
  topP: number;
  /** Optional description */
  description?: string;
}

/**
 * Generation parameters for chat completions
 */
export interface GenerationParams {
  /** Model to use */
  model: string;
  /** Sampling temperature (0-2) */
  temperature: number;
  /** Top-p (nucleus) sampling (0-1) */
  topP: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Stop sequences */
  stopSequences?: string[];
  /** Whether to stream the response */
  stream: boolean;
}

/**
 * Default generation parameters
 */
export const DEFAULT_GENERATION_PARAMS: GenerationParams = {
  model: 'qwen3:8b',
  temperature: 0.7,
  topP: 0.9,
  maxTokens: 4096,
  stream: true,
};
