/**
 * AnthropicProvider - Claude API via @anthropic-ai/sdk
 *
 * Supports native tool_use for agent tool calling.
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  LLMProvider,
  ChatMessage,
  ChatOptions,
  ChatResponse,
  LLMModel,
  HealthCheckResult,
  ToolCallMessage,
} from './LLMProvider.js';

// Available Claude models with pricing
const ANTHROPIC_MODELS: LLMModel[] = [
  {
    id: 'anthropic:claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    isCloud: true,
    contextWindow: 200000,
    inputPricePerMTok: 3.0,
    outputPricePerMTok: 15.0,
  },
  {
    id: 'anthropic:claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    isCloud: true,
    contextWindow: 200000,
    inputPricePerMTok: 0.80,
    outputPricePerMTok: 4.0,
  },
];

export class AnthropicProvider implements LLMProvider {
  readonly providerName = 'anthropic';
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async chat(messages: ChatMessage[], model: string, options?: ChatOptions): Promise<ChatResponse> {
    const { systemPrompt, conversationMessages } = this.prepareMessages(messages);

    const response = await this.client.messages.create({
      model,
      max_tokens: options?.maxTokens ?? 4096,
      ...(systemPrompt && { system: systemPrompt }),
      messages: this.toAnthropicMessages(conversationMessages),
      ...(options?.anthropicTools && { tools: options.anthropicTools as any }),
      ...(options?.temperature !== undefined && { temperature: options.temperature }),
      ...(options?.topP !== undefined && { top_p: options.topP }),
      ...(options?.topK !== undefined && { top_k: options.topK }),
      ...(options?.stop && { stop_sequences: options.stop }),
    });

    // Extract text content from response
    const content = response.content
      .filter(block => block.type === 'text')
      .map(block => (block as { type: 'text'; text: string }).text)
      .join('');

    // Extract tool calls from response
    const toolCalls: ToolCallMessage[] = response.content
      .filter(block => block.type === 'tool_use')
      .map(block => {
        const toolBlock = block as { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> };
        return {
          id: toolBlock.id,
          name: toolBlock.name,
          arguments: toolBlock.input,
        };
      });

    return {
      content,
      model: response.model,
      provider: 'anthropic',
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      stopReason: response.stop_reason === 'tool_use' ? 'tool_use' : 'end_turn',
    };
  }

  async chatStream(messages: ChatMessage[], model: string, options?: ChatOptions): Promise<AsyncIterable<string>> {
    const { systemPrompt, conversationMessages } = this.prepareMessages(messages);

    const stream = this.client.messages.stream({
      model,
      max_tokens: options?.maxTokens ?? 4096,
      ...(systemPrompt && { system: systemPrompt }),
      messages: this.toAnthropicMessages(conversationMessages),
      ...(options?.temperature !== undefined && { temperature: options.temperature }),
      ...(options?.topP !== undefined && { top_p: options.topP }),
      ...(options?.topK !== undefined && { top_k: options.topK }),
      ...(options?.stop && { stop_sequences: options.stop }),
    });

    return this.anthropicStreamToAsyncIterable(stream);
  }

  async getModels(): Promise<LLMModel[]> {
    return ANTHROPIC_MODELS;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    try {
      await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }],
      });
      return { ok: true, provider: 'anthropic' };
    } catch (error) {
      return {
        ok: false,
        provider: 'anthropic',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Convert ChatMessage[] to Anthropic message format.
   * Handles tool_use and tool_result content blocks.
   */
  private toAnthropicMessages(messages: ChatMessage[]): Anthropic.MessageParam[] {
    const result: Anthropic.MessageParam[] = [];

    for (const msg of messages) {
      if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
        // Assistant message with tool calls → content blocks
        const content: any[] = [];
        if (msg.content) {
          content.push({ type: 'text', text: msg.content });
        }
        for (const tc of msg.toolCalls) {
          content.push({
            type: 'tool_use',
            id: tc.id || `tool_${Date.now()}`,
            name: tc.name,
            input: tc.arguments,
          });
        }
        result.push({ role: 'assistant', content });
      } else if (msg.role === 'tool') {
        // Tool result → user message with tool_result content block
        result.push({
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: msg.toolUseId || '',
            content: msg.content,
          }] as any,
        });
      } else if (msg.role === 'user' || msg.role === 'assistant') {
        result.push({
          role: msg.role,
          content: msg.content,
        });
      }
      // Skip 'system' messages (handled separately)
    }

    // Anthropic requires starting with user message
    if (result.length > 0 && result[0]!.role === 'assistant') {
      result.unshift({ role: 'user', content: '.' });
    }

    return result;
  }

  private prepareMessages(messages: ChatMessage[]): {
    systemPrompt: string | undefined;
    conversationMessages: ChatMessage[];
  } {
    const systemMessages = messages.filter(m => m.role === 'system');
    const conversationMessages = messages.filter(m => m.role !== 'system');

    const systemPrompt = systemMessages.length > 0
      ? systemMessages.map(m => m.content).join('\n\n')
      : undefined;

    return { systemPrompt, conversationMessages };
  }

  private async *anthropicStreamToAsyncIterable(
    stream: ReturnType<Anthropic['messages']['stream']>
  ): AsyncIterable<string> {
    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        const delta = event.delta as { type: string; text?: string };
        if (delta.type === 'text_delta' && delta.text) {
          yield delta.text;
        }
      }
      if (event.type === 'message_stop') {
        const finalMessage = await stream.finalMessage();
        yield `\n__DONE__${JSON.stringify({
          done: true,
          model: finalMessage.model,
          inputTokens: finalMessage.usage.input_tokens,
          outputTokens: finalMessage.usage.output_tokens,
        })}`;
      }
    }
  }
}
