/**
 * RerankerService - Node.js client for Python Reranker Microservice
 * Phase 1 - RAG V2 Implementation
 *
 * Model: BGE-reranker-v2-m3 (Multilingual)
 */

export interface RerankerConfig {
  serviceUrl: string;
  topK: number;
  enabled: boolean;
  timeout: number;
}

export interface ScoredChunk {
  id: string;
  content: string;
  score: number;
  documentId: string;
  chunkIndex: number;
  metadata?: Record<string, unknown>;
}

export interface RerankedChunk extends ScoredChunk {
  rerankerScore: number;
  originalRank: number;
  newRank: number;
}

export interface RerankerResult {
  chunks: RerankedChunk[];
  processingTimeMs: number;
  modelUsed: string;
}

interface RerankApiResponse {
  results: Array<{
    index: number;
    score: number;
    document: string;
  }>;
  processing_time_ms: number;
  model: string;
}

interface HealthResponse {
  status: string;
  model: string;
  ready: boolean;
}

export class RerankerService {
  private config: RerankerConfig;
  private available: boolean = false;

  constructor(config?: Partial<RerankerConfig>) {
    this.config = {
      serviceUrl: config?.serviceUrl || process.env.RERANKER_SERVICE_URL || 'http://localhost:8001',
      topK: config?.topK || parseInt(process.env.RERANKER_TOP_K || '5'),
      enabled: config?.enabled ?? (process.env.RERANKER_ENABLED === 'true'),
      timeout: config?.timeout || 30000, // 30s for up to 20 documents
    };
  }

  /**
   * Check if reranker service is available
   */
  async checkHealth(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${this.config.serviceUrl}/health`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const health: HealthResponse = await response.json();
        this.available = health.ready;
        return health.ready;
      }
      return false;
    } catch {
      this.available = false;
      return false;
    }
  }

  /**
   * Initialize the service - check availability
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      console.log('Reranker: Disabled by configuration');
      return;
    }

    const healthy = await this.checkHealth();
    if (healthy) {
      console.log(`Reranker: Connected to ${this.config.serviceUrl}`);
    } else {
      console.warn(`Reranker: Service not available at ${this.config.serviceUrl}`);
    }
  }

  /**
   * Rerank chunks based on query relevance
   */
  async rerank(query: string, chunks: ScoredChunk[], topK?: number): Promise<RerankerResult> {
    // If disabled or unavailable, return original order
    if (!this.config.enabled || !this.available) {
      return {
        chunks: chunks.slice(0, topK || this.config.topK).map((c, i) => ({
          ...c,
          rerankerScore: c.score,
          originalRank: i,
          newRank: i,
        })),
        processingTimeMs: 0,
        modelUsed: 'none',
      };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

      const response = await fetch(`${this.config.serviceUrl}/rerank`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          documents: chunks.map(c => c.content),
          top_k: topK || this.config.topK,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Reranker API error: ${response.status}`);
      }

      const data: RerankApiResponse = await response.json();
      console.log(`🔧 DEBUG RerankerService: API returned ${data.results.length} results`);

      // Map results back to chunks with reranker scores
      const rerankedChunks: RerankedChunk[] = data.results.map((result, newRank) => {
        const originalChunk = chunks[result.index];
        return {
          ...originalChunk,
          rerankerScore: result.score,
          originalRank: result.index,
          newRank,
        };
      });

      return {
        chunks: rerankedChunks,
        processingTimeMs: data.processing_time_ms,
        modelUsed: data.model,
      };
    } catch (error) {
      console.error('Reranker error:', error);
      // Fallback to original order on error
      return {
        chunks: chunks.slice(0, topK || this.config.topK).map((c, i) => ({
          ...c,
          rerankerScore: c.score,
          originalRank: i,
          newRank: i,
        })),
        processingTimeMs: 0,
        modelUsed: 'fallback',
      };
    }
  }

  /**
   * Check if reranking is enabled and available
   */
  isAvailable(): boolean {
    return this.config.enabled && this.available;
  }

  /**
   * Get current configuration
   */
  getConfig(): RerankerConfig {
    return { ...this.config };
  }
}

// Singleton instance
export const rerankerService = new RerankerService();
