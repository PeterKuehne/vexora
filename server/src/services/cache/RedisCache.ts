/**
 * Redis Cache Service
 * Part of RAG V2 Phase 6: Production Hardening
 *
 * Provides caching for:
 * - Embeddings (expensive to compute)
 * - Search results (reduce database load)
 * - Entity lookups (frequent graph queries)
 */

import Redis from 'ioredis';
import { createHash } from 'crypto';

export interface RedisCacheConfig {
  url: string;
  ttlSeconds: number;
  maxMemoryMB: number;
  keyPrefix: string;
  enabled: boolean;
}

export interface CacheStats {
  usedMemoryMB: number;
  hitRate: number;
  keys: number;
  connected: boolean;
}

const DEFAULT_CONFIG: RedisCacheConfig = {
  url: 'redis://localhost:6379',
  ttlSeconds: 3600, // 1 hour default
  maxMemoryMB: 512,
  keyPrefix: 'rag:',
  enabled: true,
};

export class RedisCache {
  private client: Redis | null = null;
  private config: RedisCacheConfig;
  private connected = false;

  constructor(config: Partial<RedisCacheConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize Redis connection
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      console.log('[RedisCache] Disabled by configuration');
      return;
    }

    try {
      this.client = new Redis(this.config.url, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => Math.min(times * 50, 2000),
        enableOfflineQueue: true,
        lazyConnect: true,
      });

      // Handle connection events
      this.client.on('error', (err: Error) => {
        console.error('[RedisCache] Connection error:', err.message);
        this.connected = false;
      });

      this.client.on('connect', () => {
        console.log('[RedisCache] Connected');
        this.connected = true;
      });

      this.client.on('close', () => {
        console.log('[RedisCache] Connection closed');
        this.connected = false;
      });

      // Attempt connection
      await this.client.connect();

      // Set memory limit
      await this.client.config('SET', 'maxmemory', `${this.config.maxMemoryMB}mb`);
      await this.client.config('SET', 'maxmemory-policy', 'allkeys-lru');

      console.log(`[RedisCache] Initialized with ${this.config.maxMemoryMB}MB max memory`);
    } catch (error) {
      console.error('[RedisCache] Failed to initialize:', error);
      this.client = null;
      this.connected = false;
    }
  }

  /**
   * Check if cache is available
   */
  isAvailable(): boolean {
    return this.config.enabled && this.connected && this.client !== null;
  }

  // ============================================
  // Embedding Cache
  // ============================================

  /**
   * Get cached embedding
   */
  async getEmbedding(text: string, model: string): Promise<number[] | null> {
    if (!this.isAvailable()) return null;

    try {
      const key = `${this.config.keyPrefix}emb:${model}:${this.hash(text)}`;
      const cached = await this.client!.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('[RedisCache] getEmbedding error:', error);
      return null;
    }
  }

  /**
   * Cache an embedding
   */
  async setEmbedding(text: string, model: string, embedding: number[]): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      const key = `${this.config.keyPrefix}emb:${model}:${this.hash(text)}`;
      await this.client!.setex(key, this.config.ttlSeconds, JSON.stringify(embedding));
    } catch (error) {
      console.error('[RedisCache] setEmbedding error:', error);
    }
  }

  /**
   * Batch get embeddings
   */
  async getEmbeddingsBatch(texts: string[], model: string): Promise<(number[] | null)[]> {
    if (!this.isAvailable()) return texts.map(() => null);

    try {
      const keys = texts.map(text => `${this.config.keyPrefix}emb:${model}:${this.hash(text)}`);
      const results = await this.client!.mget(...keys);
      return results.map(r => r ? JSON.parse(r) : null);
    } catch (error) {
      console.error('[RedisCache] getEmbeddingsBatch error:', error);
      return texts.map(() => null);
    }
  }

  /**
   * Batch set embeddings
   */
  async setEmbeddingsBatch(
    items: Array<{ text: string; embedding: number[] }>,
    model: string
  ): Promise<void> {
    if (!this.isAvailable() || items.length === 0) return;

    try {
      const pipeline = this.client!.pipeline();
      for (const item of items) {
        const key = `${this.config.keyPrefix}emb:${model}:${this.hash(item.text)}`;
        pipeline.setex(key, this.config.ttlSeconds, JSON.stringify(item.embedding));
      }
      await pipeline.exec();
    } catch (error) {
      console.error('[RedisCache] setEmbeddingsBatch error:', error);
    }
  }

  // ============================================
  // Search Results Cache
  // ============================================

  /**
   * Get cached search results
   */
  async getSearchResults(query: string, params: Record<string, unknown>): Promise<unknown | null> {
    if (!this.isAvailable()) return null;

    try {
      const key = `${this.config.keyPrefix}search:${this.hash(query + JSON.stringify(params))}`;
      const cached = await this.client!.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('[RedisCache] getSearchResults error:', error);
      return null;
    }
  }

  /**
   * Cache search results (shorter TTL)
   */
  async setSearchResults(
    query: string,
    params: Record<string, unknown>,
    results: unknown
  ): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      const key = `${this.config.keyPrefix}search:${this.hash(query + JSON.stringify(params))}`;
      // Shorter TTL for search results (5 minutes)
      await this.client!.setex(key, 300, JSON.stringify(results));
    } catch (error) {
      console.error('[RedisCache] setSearchResults error:', error);
    }
  }

  // ============================================
  // Entity Cache
  // ============================================

  /**
   * Get cached entities
   */
  async getEntities(texts: string[]): Promise<unknown[] | null> {
    if (!this.isAvailable()) return null;

    try {
      const key = `${this.config.keyPrefix}entities:${this.hash(texts.sort().join(','))}`;
      const cached = await this.client!.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('[RedisCache] getEntities error:', error);
      return null;
    }
  }

  /**
   * Cache entity lookup results (1 hour TTL)
   */
  async setEntities(texts: string[], entities: unknown[]): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      const key = `${this.config.keyPrefix}entities:${this.hash(texts.sort().join(','))}`;
      await this.client!.setex(key, 3600, JSON.stringify(entities));
    } catch (error) {
      console.error('[RedisCache] setEntities error:', error);
    }
  }

  // ============================================
  // Reranker Cache
  // ============================================

  /**
   * Get cached reranker results
   */
  async getRerankerResults(
    query: string,
    chunkIds: string[]
  ): Promise<{ scores: number[]; order: number[] } | null> {
    if (!this.isAvailable()) return null;

    try {
      const key = `${this.config.keyPrefix}rerank:${this.hash(query + chunkIds.join(','))}`;
      const cached = await this.client!.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      console.error('[RedisCache] getRerankerResults error:', error);
      return null;
    }
  }

  /**
   * Cache reranker results (10 minutes TTL)
   */
  async setRerankerResults(
    query: string,
    chunkIds: string[],
    results: { scores: number[]; order: number[] }
  ): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      const key = `${this.config.keyPrefix}rerank:${this.hash(query + chunkIds.join(','))}`;
      await this.client!.setex(key, 600, JSON.stringify(results));
    } catch (error) {
      console.error('[RedisCache] setRerankerResults error:', error);
    }
  }

  // ============================================
  // Utility Methods
  // ============================================

  /**
   * Cryptographically secure hash function
   * Using SHA-256 prevents collisions
   */
  private hash(text: string): string {
    return createHash('sha256')
      .update(text)
      .digest('hex')
      .substring(0, 16); // Truncate to 16 chars for reasonable key length
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    if (!this.isAvailable()) {
      return {
        usedMemoryMB: 0,
        hitRate: 0,
        keys: 0,
        connected: false,
      };
    }

    try {
      const info = await this.client!.info('memory');
      const usedMemory = parseInt(info.match(/used_memory:(\d+)/)?.[1] || '0');

      const stats = await this.client!.info('stats');
      const hits = parseInt(stats.match(/keyspace_hits:(\d+)/)?.[1] || '0');
      const misses = parseInt(stats.match(/keyspace_misses:(\d+)/)?.[1] || '0');

      const dbSize = await this.client!.dbsize();

      return {
        usedMemoryMB: usedMemory / 1024 / 1024,
        hitRate: hits + misses > 0 ? hits / (hits + misses) : 0,
        keys: dbSize,
        connected: this.connected,
      };
    } catch (error) {
      console.error('[RedisCache] getStats error:', error);
      return {
        usedMemoryMB: 0,
        hitRate: 0,
        keys: 0,
        connected: false,
      };
    }
  }

  /**
   * Clear all cache entries with prefix
   */
  async flush(): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      const keys = await this.client!.keys(`${this.config.keyPrefix}*`);
      if (keys.length > 0) {
        await this.client!.del(...keys);
      }
      console.log(`[RedisCache] Flushed ${keys.length} keys`);
    } catch (error) {
      console.error('[RedisCache] flush error:', error);
    }
  }

  /**
   * Clear embedding cache only
   */
  async flushEmbeddings(): Promise<void> {
    if (!this.isAvailable()) return;

    try {
      const keys = await this.client!.keys(`${this.config.keyPrefix}emb:*`);
      if (keys.length > 0) {
        await this.client!.del(...keys);
      }
      console.log(`[RedisCache] Flushed ${keys.length} embedding keys`);
    } catch (error) {
      console.error('[RedisCache] flushEmbeddings error:', error);
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; latencyMs: number }> {
    if (!this.isAvailable()) {
      return { healthy: false, latencyMs: 0 };
    }

    try {
      const start = Date.now();
      await this.client!.ping();
      const latencyMs = Date.now() - start;
      return { healthy: true, latencyMs };
    } catch (error) {
      return { healthy: false, latencyMs: 0 };
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.connected = false;
      console.log('[RedisCache] Connection closed');
    }
  }
}

/**
 * Create RedisCache from environment variables
 */
export function createRedisCacheFromEnv(): RedisCache {
  return new RedisCache({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    ttlSeconds: parseInt(process.env.REDIS_TTL_SECONDS || '3600'),
    maxMemoryMB: parseInt(process.env.REDIS_MAX_MEMORY_MB || '512'),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'rag:',
    enabled: process.env.REDIS_ENABLED !== 'false',
  });
}
