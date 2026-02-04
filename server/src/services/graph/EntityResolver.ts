/**
 * Entity Resolver Service
 * Part of RAG V2 Phase 4: Intelligence & Production
 *
 * Resolves and merges similar entities using:
 * 1. Exact matching
 * 2. Alias matching
 * 3. Semantic similarity (embedding-based)
 * 4. Fuzzy matching (Levenshtein)
 * 5. Abbreviation detection
 */

import { v4 as uuidv4 } from 'uuid';
import {
  Entity,
  EntityResolutionConfig,
  DEFAULT_ENTITY_RESOLUTION_CONFIG,
} from '../../types/graph.js';

// Embedding cache to avoid redundant API calls
const embeddingCache = new Map<string, number[]>();

export interface EmbeddingService {
  embed: (text: string) => Promise<number[]>;
}

export interface ResolutionStats {
  original: number;
  afterMerge: number;
  mergedGroups: number;
  resolutionMethod: string;
}

export class EntityResolver {
  private config: EntityResolutionConfig;
  private embeddingService?: EmbeddingService;

  constructor(
    config: Partial<EntityResolutionConfig> = {},
    embeddingService?: EmbeddingService
  ) {
    this.config = { ...DEFAULT_ENTITY_RESOLUTION_CONFIG, ...config };
    this.embeddingService = embeddingService;
  }

  /**
   * Resolve and merge similar entities
   */
  async resolve(entities: Entity[]): Promise<{
    resolved: Entity[];
    mergeStats: ResolutionStats;
  }> {
    // Group by type first (entities of different types shouldn't be merged)
    const byType = new Map<string, Entity[]>();
    for (const entity of entities) {
      const group = byType.get(entity.type) || [];
      group.push(entity);
      byType.set(entity.type, group);
    }

    const resolved: Entity[] = [];
    let totalMerged = 0;

    for (const [_type, typeEntities] of byType) {
      // STEP 1: Blocking (for large datasets)
      // Group entities into blocks to reduce O(n²) comparisons
      const blocks = this.config.blockingEnabled
        ? this.createBlocks(typeEntities)
        : [typeEntities];

      for (const block of blocks) {
        // STEP 2: Find similar entities within block
        const groups = await this.groupSimilar(block);

        for (const group of groups) {
          if (group.length === 1) {
            resolved.push(group[0]);
          } else {
            // Merge group
            const merged = await this.mergeEntities(group);
            resolved.push(merged);
            totalMerged++;
          }
        }
      }
    }

    return {
      resolved,
      mergeStats: {
        original: entities.length,
        afterMerge: resolved.length,
        mergedGroups: totalMerged,
        resolutionMethod: this.config.useSemanticSimilarity ? 'semantic' : 'fuzzy',
      },
    };
  }

  /**
   * Blocking: Group entities into smaller blocks based on shared characteristics.
   * This reduces the number of pairwise comparisons from O(n²) to O(b * (n/b)²).
   */
  private createBlocks(entities: Entity[]): Entity[][] {
    const blocks = new Map<string, Entity[]>();

    for (const entity of entities) {
      // Create blocking key from first 3 chars of canonical form
      const blockKey = entity.canonicalForm.substring(0, 3).toLowerCase();
      const block = blocks.get(blockKey) || [];
      block.push(entity);
      blocks.set(blockKey, block);
    }

    return Array.from(blocks.values());
  }

  /**
   * Group similar entities within a block
   */
  private async groupSimilar(entities: Entity[]): Promise<Entity[][]> {
    const groups: Entity[][] = [];
    const assigned = new Set<string>();

    // Pre-compute embeddings if semantic similarity is enabled
    if (this.config.useSemanticSimilarity && this.embeddingService) {
      await this.precomputeEmbeddings(entities);
    }

    for (const entity of entities) {
      if (assigned.has(entity.id)) continue;

      const group = [entity];
      assigned.add(entity.id);

      for (const other of entities) {
        if (assigned.has(other.id)) continue;

        const similarity = await this.calculateSimilarity(entity, other);
        if (similarity >= this.config.similarityThreshold) {
          group.push(other);
          assigned.add(other.id);
        }
      }

      groups.push(group);
    }

    return groups;
  }

  /**
   * Pre-compute embeddings for all entities in batch for efficiency.
   */
  private async precomputeEmbeddings(entities: Entity[]): Promise<void> {
    const textsToEmbed = entities
      .filter((e) => !embeddingCache.has(e.canonicalForm))
      .map((e) => e.canonicalForm);

    if (textsToEmbed.length === 0 || !this.embeddingService) return;

    // Batch embed (in chunks of batchSize)
    for (let i = 0; i < textsToEmbed.length; i += this.config.batchSize) {
      const batch = textsToEmbed.slice(i, i + this.config.batchSize);
      const embeddings = await Promise.all(
        batch.map((text) => this.embeddingService!.embed(text))
      );
      batch.forEach((text, idx) => embeddingCache.set(text, embeddings[idx]));
    }
  }

  /**
   * Calculate similarity using multiple strategies:
   * 1. Exact match
   * 2. Alias match
   * 3. Semantic similarity (embedding cosine distance)
   * 4. Fuzzy match (Levenshtein)
   * 5. Abbreviation detection
   */
  private async calculateSimilarity(e1: Entity, e2: Entity): Promise<number> {
    // 1. Exact match
    if (e1.canonicalForm === e2.canonicalForm) return 1.0;

    // 2. Alias match
    if (e1.aliases.includes(e2.text) || e2.aliases.includes(e1.text)) return 0.95;

    // 3. Semantic similarity (embeddings)
    if (this.config.useSemanticSimilarity && this.embeddingService) {
      const emb1 = embeddingCache.get(e1.canonicalForm);
      const emb2 = embeddingCache.get(e2.canonicalForm);

      if (emb1 && emb2) {
        const cosineSim = this.cosineSimilarity(emb1, emb2);
        // High semantic similarity is a strong signal
        if (cosineSim >= 0.85) return cosineSim;
      }
    }

    // 4. Fuzzy match (Levenshtein)
    if (this.config.useFuzzyMatch) {
      const levenshtein = this.levenshteinDistance(e1.canonicalForm, e2.canonicalForm);
      const maxLen = Math.max(e1.canonicalForm.length, e2.canonicalForm.length);
      const fuzzyScore = 1 - levenshtein / maxLen;

      if (fuzzyScore >= 0.8) return fuzzyScore;
    }

    // 5. Abbreviation detection
    if (this.isAbbreviation(e1.text, e2.text) || this.isAbbreviation(e2.text, e1.text)) {
      return 0.85;
    }

    return 0;
  }

  /**
   * Cosine similarity between two embedding vectors.
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  /**
   * Levenshtein distance for fuzzy matching
   */
  private levenshteinDistance(s1: string, s2: string): number {
    const m = s1.length;
    const n = s2.length;
    const dp: number[][] = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (s1[i - 1] === s2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
      }
    }

    return dp[m][n];
  }

  /**
   * Check if short string is an abbreviation of long string
   */
  private isAbbreviation(short: string, long: string): boolean {
    if (short.length >= long.length) return false;

    const words = long.split(/\s+/);
    const initials = words.map((w) => w[0]?.toUpperCase()).join('');

    return short.toUpperCase() === initials;
  }

  /**
   * Merge multiple entities into one canonical entity
   */
  private async mergeEntities(entities: Entity[]): Promise<Entity> {
    // Find the most common/confident canonical form
    const forms = entities.map((e) => ({ form: e.canonicalForm, confidence: e.confidence }));
    forms.sort((a, b) => b.confidence - a.confidence);

    // Collect all aliases
    const allAliases = new Set<string>();
    for (const e of entities) {
      allAliases.add(e.text);
      e.aliases.forEach((a) => allAliases.add(a));
    }

    // Merge occurrences
    const allOccurrences = entities.flatMap((e) => e.occurrences);

    // Calculate merged confidence
    const avgConfidence = entities.reduce((s, e) => s + e.confidence, 0) / entities.length;

    // Use the text with highest confidence
    const bestEntity = entities.reduce((best, e) =>
      e.confidence > best.confidence ? e : best
    );

    return {
      id: uuidv4(),
      type: entities[0].type,
      text: bestEntity.text,
      canonicalForm: forms[0].form,
      aliases: Array.from(allAliases).filter((a) => a !== forms[0].form),
      confidence: Math.min(1, avgConfidence + 0.1), // Boost confidence for merged
      occurrences: allOccurrences,
      metadata: {
        mergedFrom: entities.map((e) => e.id),
        mergeCount: entities.length,
        resolutionMethod: this.config.useSemanticSimilarity ? 'semantic' : 'fuzzy',
      },
    };
  }

  /**
   * Clear the embedding cache
   */
  clearCache(): void {
    embeddingCache.clear();
  }

  /**
   * Get cache stats
   */
  getCacheStats(): { size: number } {
    return { size: embeddingCache.size };
  }
}
