/**
 * OllamaProvider - Wraps existing OllamaService to implement LLMProvider interface
 */

import { ollamaService } from '../OllamaService.js';
import type {
  LLMProvider,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  LLMModel,
  HealthCheckResult,
  ToolCallMessage,
} from './LLMProvider.js';

export class OllamaProvider implements LLMProvider {
  readonly providerName = 'ollama';

  async chat(messages: ChatMessage[], model: string, options?: ChatOptions): Promise<ChatResponse> {
    const response = await ollamaService.chat({
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      model,
      think: options?.think,
      options: {
        temperature: options?.temperature,
        top_p: options?.topP,
        top_k: options?.topK,
        num_predict: options?.numPredict ?? options?.maxTokens,
        stop: options?.stop,
      },
      // Pass tools if provided (Ollama native tool calling)
      ...(options?.tools && { tools: options.tools as any }),
    });

    // Parse tool calls from Ollama response
    let toolCalls: ToolCallMessage[] | undefined;
    const rawToolCalls = (response.message as any).tool_calls;
    if (rawToolCalls && rawToolCalls.length > 0) {
      toolCalls = rawToolCalls.map((tc: any) => ({
        name: tc.function.name,
        arguments: typeof tc.function.arguments === 'string'
          ? JSON.parse(tc.function.arguments)
          : tc.function.arguments,
      }));
    }

    // Parse thinking content from Qwen3 <think> tags
    let content = response.message.content;
    let thinkingContent: string | undefined;
    const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
    if (thinkMatch) {
      thinkingContent = thinkMatch[1]!.trim();
      content = content.replace(/<think>[\s\S]*?<\/think>/, '').trim();
    }

    return {
      content,
      model: response.model,
      provider: 'ollama',
      inputTokens: response.prompt_eval_count,
      outputTokens: response.eval_count,
      totalDuration: response.total_duration,
      thinkingContent,
      toolCalls,
      stopReason: toolCalls ? 'tool_use' : 'end_turn',
    };
  }

  async chatStream(messages: ChatMessage[], model: string, options?: ChatOptions): Promise<AsyncIterable<string>> {
    const response = await ollamaService.chatStream({
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      model,
      options: {
        temperature: options?.temperature,
        top_p: options?.topP,
        top_k: options?.topK,
        num_predict: options?.numPredict ?? options?.maxTokens,
        stop: options?.stop,
      },
    });

    return this.streamToAsyncIterable(response);
  }

  async getModels(): Promise<LLMModel[]> {
    const result = await ollamaService.getModels({});

    return result.models.map(m => ({
      id: `ollama:${m.id}`,
      name: m.name,
      provider: 'ollama' as const,
      isCloud: false,
      contextWindow: 32768, // Default, could be refined per model
      family: m.family,
      parameterSize: m.parameterSize,
      quantization: m.quantization,
      sizeGB: m.sizeGB,
    }));
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const health = await ollamaService.healthCheck(5000);
    return {
      ok: health.status === 'ok',
      provider: 'ollama',
      error: health.error,
    };
  }

  /**
   * Get the raw Ollama streaming response (for backward compatibility with existing code)
   * Returns the raw Response object from Ollama API
   */
  async chatStreamRaw(messages: ChatMessage[], model: string, options?: ChatOptions): Promise<Response> {
    return ollamaService.chatStream({
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      model,
      options: {
        temperature: options?.temperature,
        top_p: options?.topP,
        top_k: options?.topK,
        num_predict: options?.numPredict ?? options?.maxTokens,
        stop: options?.stop,
      },
    });
  }

  private async *streamToAsyncIterable(response: Response): AsyncIterable<string> {
    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.message?.content) {
              yield parsed.message.content;
            }
            // Yield the full JSON for metadata (done, total_duration, etc.)
            if (parsed.done) {
              yield `\n__DONE__${JSON.stringify(parsed)}`;
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
