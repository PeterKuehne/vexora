/**
 * EmbeddingService - Ollama Embedding Generation
 *
 * Handles text embedding generation using Ollama's embedding models
 * Default: nomic-embed-text (768 dimensions)
 */

import { env } from '../config/env.js';

export interface EmbeddingResponse {
  embedding: number[];
  model: string;
  dimensions: number;
}

class EmbeddingService {
  private readonly ollamaUrl: string;
  private readonly defaultModel: string = 'nomic-embed-text';

  constructor() {
    this.ollamaUrl = env.OLLAMA_API_URL || 'http://localhost:11434';
  }

  /**
   * Generate embedding for a single text
   */
  async generateEmbedding(text: string, model?: string): Promise<EmbeddingResponse> {
    const embeddingModel = model || this.defaultModel;

    try {
      const response = await fetch(`${this.ollamaUrl}/api/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: embeddingModel,
          prompt: text,
        }),
      });

      if (!response.ok) {
        throw new Error(`Ollama embeddings API error: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.embedding || !Array.isArray(data.embedding)) {
        throw new Error('Invalid embedding response from Ollama');
      }

      return {
        embedding: data.embedding,
        model: embeddingModel,
        dimensions: data.embedding.length,
      };
    } catch (error) {
      console.error('❌ Failed to generate embedding:', error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   * More efficient than calling generateEmbedding multiple times
   */
  async generateEmbeddings(texts: string[], model?: string): Promise<EmbeddingResponse[]> {
    const results: EmbeddingResponse[] = [];

    // Process in parallel batches of 10
    const batchSize = 10;
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchPromises = batch.map(text => this.generateEmbedding(text, model));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
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
