/**
 * Settings Types
 * Defines the structure for app and model settings
 */

/**
 * Theme options
 */
export type Theme = 'light' | 'dark' | 'system';

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
