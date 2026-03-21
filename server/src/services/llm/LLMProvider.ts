/**
 * LLM Provider Interface Definitions
 *
 * Common types and interfaces for all LLM providers (Ollama, Anthropic, etc.)
 */

export interface LLMProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** Anthropic: tool_use_id for tool results */
  toolUseId?: string;
  /** Tool calls made by the assistant (from LLM response) */
  toolCalls?: ToolCallMessage[];
}

export interface ToolCallMessage {
  id?: string;           // Anthropic tool_use_id
  name: string;
  arguments: Record<string, unknown>;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  topK?: number;
  think?: boolean;       // Qwen3 thinking mode
  stream?: boolean;
  stop?: string[];
  numPredict?: number;   // Ollama-specific
  /** Tool definitions (OpenAI/Ollama format) */
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }>;
  /** Anthropic tool definitions */
  anthropicTools?: Array<{
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
  }>;
}

export interface ChatResponse {
  content: string;
  model: string;
  provider: string;
  inputTokens?: number;
  outputTokens?: number;
  thinkingContent?: string;
  totalDuration?: number;
  /** Tool calls requested by the model */
  toolCalls?: ToolCallMessage[];
  /** Indicates the model wants to use tools (stop_reason = tool_use) */
  stopReason?: 'end_turn' | 'tool_use' | 'max_tokens' | 'stop_sequence';
}

export interface LLMModel {
  id: string;             // z.B. "anthropic:claude-sonnet-4-6"
  name: string;           // z.B. "Claude Sonnet 4.6"
  provider: 'ollama' | 'anthropic';
  isCloud: boolean;
  contextWindow: number;
  inputPricePerMTok?: number;   // nur Cloud
  outputPricePerMTok?: number;  // nur Cloud
  // Ollama-specific metadata
  family?: string;
  parameterSize?: string;
  quantization?: string;
  sizeGB?: number;
}

export interface HealthCheckResult {
  ok: boolean;
  provider: string;
  error?: string;
}

export interface LLMProvider {
  readonly providerName: string;
  chat(messages: ChatMessage[], model: string, options?: ChatOptions): Promise<ChatResponse>;
  chatStream(messages: ChatMessage[], model: string, options?: ChatOptions): Promise<AsyncIterable<string>>;
  getModels(): Promise<LLMModel[]>;
  healthCheck(): Promise<HealthCheckResult>;
}
