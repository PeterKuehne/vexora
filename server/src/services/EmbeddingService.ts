/**
 * EmbeddingService - Ollama Embedding Generation
 *
 * Handles text embedding generation using Ollama's embedding models
 * Uses /api/embed (supports batching, truncation, and dimensions control)
 * Default: nomic-embed-text-v2-moe (768 dimensions, multilingual MoE, 512 token context)
 */

import { env } from '../config/env.js';

export type EmbeddingType = 'query' | 'document';

export interface EmbeddingResponse {
  embedding: number[];
  model: string;
  dimensions: number;
}

class EmbeddingService {
  private readonly ollamaUrl: string;
  private readonly defaultModel: string = 'nomic-embed-text-v2-moe';

  constructor() {
    this.ollamaUrl = env.OLLAMA_API_URL || 'http://localhost:11434';
  }

  /**
   * Apply task prefix for nomic embedding models.
   * nomic-embed-text-v2-moe requires "search_query: " / "search_document: " prefixes.
   */
  private applyPrefix(text: string, model: string, type?: EmbeddingType): string {
    if (!type) return text;
    if (model.includes('nomic-embed-text')) {
      return type === 'query' ? `search_query: ${text}` : `search_document: ${text}`;
    }
    return text;
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string, model?: string, type?: EmbeddingType): Promise<EmbeddingResponse> {
    const embeddingModel = model || this.defaultModel;
    const prefixedText = this.applyPrefix(text, embeddingModel, type);

    try {
      const response = await fetch(`${this.ollamaUrl}/api/embed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: embeddingModel,
          input: prefixedText,
          truncate: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama embed API error: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.embeddings || !Array.isArray(data.embeddings) || data.embeddings.length === 0) {
        throw new Error('Invalid embedding response from Ollama');
      }

      return {
        embedding: data.embeddings[0],
        model: embeddingModel,
        dimensions: data.embeddings[0].length,
      };
    } catch (error) {
      console.error('❌ Failed to generate embedding:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   * Uses native /api/embed batch support (input as string[])
   */
  async generateEmbeddings(texts: string[], model?: string, type?: EmbeddingType): Promise<EmbeddingResponse[]> {
    const embeddingModel = model || this.defaultModel;

    // Process in batches of 50 (native batching is much more efficient)
    const batchSize = 50;
    const results: EmbeddingResponse[] = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize).map(t => this.applyPrefix(t, embeddingModel, type));

      try {
        const response = await fetch(`${this.ollamaUrl}/api/embed`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: embeddingModel,
            input: batch,
            truncate: true,
          }),
        });

        if (!response.ok) {
          throw new Error(`Ollama embed API error: ${response.statusText}`);
        }

        const data = await response.json();

        if (!data.embeddings || !Array.isArray(data.embeddings)) {
          throw new Error('Invalid batch embedding response from Ollama');
        }

        for (const embedding of data.embeddings) {
          results.push({
            embedding,
            model: embeddingModel,
            dimensions: embedding.length,
          });
        }
      } catch (error) {
        console.error(`❌ Failed to generate batch embeddings (batch ${i / batchSize + 1}):`, error);
        throw error;
      }
    }

    return results;
  }

  /**
   * Get embedding dimensions for a model
   */
  async getModelDimensions(model?: string): Promise<number> {
    const embeddingModel = model || this.defaultModel;

    try {
      // Generate a test embedding to get dimensions
      const testResponse = await this.generateEmbedding('test', embeddingModel);
      return testResponse.dimensions;
    } catch (error) {
      console.error('❌ Failed to get model dimensions:', error);
      // Default dimensions for common models
      if (embeddingModel.includes('nomic-embed-text')) {
        return 768;
      }
      throw error;
    }
  }

  /**
   * Check if embedding model is available
   */
  async isModelAvailable(model?: string): Promise<boolean> {
    const embeddingModel = model || this.defaultModel;

    try {
      const response = await fetch(`${this.ollamaUrl}/api/tags`);
      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      const models = data.models || [];

      return models.some((m: any) => m.name.includes(embeddingModel));
    } catch (error) {
      console.error('❌ Failed to check model availability:', error);
      return false;
    }
  }
}

export const embeddingService = new EmbeddingService();
export default embeddingService;
