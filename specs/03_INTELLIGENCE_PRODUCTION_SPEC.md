# Spec 3: Intelligence & Production

## RAG V2 Implementation - Part 3 of 3

**Version:** 1.1
**Last Updated:** 2026-02-04
**Phases:** 4-6
**Duration:** Weeks 8-15
**Prerequisites:** Spec 1 + Spec 2 completed
**Depends on:** Spec 1, Spec 2
**Blocks:** None (Final)

### Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.1 | 2026-02-04 | Updated Neo4j to 5.26 LTS, neo4j-driver to 6.x, added semantic entity resolution, improved hash functions, added community detection |
| 1.0 | - | Initial spec |

### Dependency Versions

| Package | Version | Notes |
|---------|---------|-------|
| Neo4j | 5.26-community (LTS) | Supported until Nov 2028 |
| neo4j-driver | ^6.0.1 | Breaking changes from v5 |
| ioredis | ^5.9.2 | Latest stable |
| APOC | 5.26.x | Must match Neo4j version |

---

## 1. Overview

This specification covers advanced intelligence and production-readiness:

1. **Entity Extraction** - Extract entities from documents
2. **Knowledge Graph** - Neo4j for entity relationships
3. **Graph Refinement** - Post-query graph traversal
4. **Query Router** - Automatic strategy selection
5. **Observability** - RAG pipeline tracing
6. **Guardrails** - Input/output validation
7. **Production Hardening** - Caching, monitoring, documentation

### Why This Comes Last

- Requires solid foundation (Spec 1) and quality data (Spec 2)
- Graph RAG adds complexity - needs stable base first
- Observability measures the complete system
- Production hardening is final step

### Success Criteria

| Metric | Target |
|--------|--------|
| Multi-hop Accuracy | ≥85% |
| Entity Resolution | ≥90% precision |
| Query Routing Accuracy | ≥85% |
| p95 Latency | <800ms |
| Error Rate | <1% |
| All Queries Traced | Yes |

---

## 2. Phase 4: Knowledge Graph (Weeks 8-11)

### 2.1 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    GRAPH RAG ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Document Ingestion                                           │
│      │                                                        │
│      ▼                                                        │
│  ┌─────────────┐     ┌─────────────┐                         │
│  │   Entity    │────▶│   Entity    │                         │
│  │  Extractor  │     │  Resolver   │                         │
│  └──────┬──────┘     └──────┬──────┘                         │
│         │                   │                                 │
│         ▼                   ▼                                 │
│  ┌─────────────────────────────────────┐                     │
│  │            Graph Service            │                     │
│  │  ┌─────────────────────────────┐   │                     │
│  │  │          Neo4j              │   │                     │
│  │  │  ┌────┐  ┌────┐  ┌────┐    │   │                     │
│  │  │  │Person│─│Org │─│Doc │    │   │                     │
│  │  │  └────┘  └────┘  └────┘    │   │                     │
│  │  └─────────────────────────────┘   │                     │
│  └──────────────────┬──────────────────┘                     │
│                     │                                         │
│  Query Time         │                                         │
│      │              │                                         │
│      ▼              ▼                                         │
│  ┌─────────────┐   ┌─────────────┐                           │
│  │   Hybrid    │──▶│   Graph     │                           │
│  │  Retrieval  │   │ Refinement  │                           │
│  └─────────────┘   └─────────────┘                           │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Neo4j Setup

> **Note:** We use Neo4j 5.26 LTS (Long Term Support) which is supported until November 2028.
> For the latest features, you can also use `neo4j:2025.12.0-community` (requires Java 21).

```yaml
# docker-compose.neo4j.yml
version: '3.8'

services:
  neo4j:
    image: neo4j:5.26-community  # LTS version - supported until Nov 2028
    container_name: vexora-neo4j
    ports:
      - "7474:7474"  # HTTP Browser
      - "7687:7687"  # Bolt Protocol
    environment:
      # IMPORTANT: Use Docker secrets in production instead of env vars
      NEO4J_AUTH: neo4j/${NEO4J_PASSWORD:-changeme}
      NEO4J_PLUGINS: '["apoc"]'
      # Memory settings - adjust based on your dataset size
      NEO4J_dbms_memory_heap_initial__size: 1G
      NEO4J_dbms_memory_heap_max__size: 4G
      NEO4J_dbms_memory_pagecache_size: 1G
      # Performance tuning
      NEO4J_dbms_memory_transaction_total_max: 512m
      NEO4J_db_tx__log_rotation_retention__policy: 2 days
    volumes:
      - neo4j_data:/data
      - neo4j_logs:/logs
      - neo4j_plugins:/plugins
    healthcheck:
      test: ["CMD", "cypher-shell", "-u", "neo4j", "-p", "${NEO4J_PASSWORD:-changeme}", "RETURN 1"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 30s
    deploy:
      resources:
        limits:
          memory: 6G
        reservations:
          memory: 2G

volumes:
  neo4j_data:
  neo4j_logs:
  neo4j_plugins:
```

### 2.2.1 APOC Version Compatibility

APOC version must match your Neo4j version. For Neo4j 5.26, use APOC 5.26.x:

```bash
# Verify APOC is loaded
cypher-shell -u neo4j -p $NEO4J_PASSWORD "RETURN apoc.version()"
```

### 2.3 TypeScript Types

```typescript
// File: server/src/types/graph.ts

export type EntityType =
  | 'PERSON'
  | 'ORGANIZATION'
  | 'PROJECT'
  | 'PRODUCT'
  | 'DOCUMENT'
  | 'TOPIC'
  | 'LOCATION'
  | 'DATE'
  | 'REGULATION';

export type RelationType =
  | 'WORKS_FOR'
  | 'MANAGES'
  | 'CREATED'
  | 'MENTIONS'
  | 'REFERENCES'
  | 'ABOUT'
  | 'PART_OF'
  | 'REPORTS_TO'
  | 'COLLABORATES_WITH'
  | 'APPROVED_BY';

export interface Entity {
  id: string;
  type: EntityType;
  text: string;
  canonicalForm: string;
  aliases: string[];
  confidence: number;
  occurrences: EntityOccurrence[];
  metadata: Record<string, any>;
}

export interface EntityOccurrence {
  documentId: string;
  chunkId: string;
  position: number;
  context: string;
}

export interface Relationship {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: RelationType;
  confidence: number;
  evidence: string;
  documentId: string;
  extractionMethod: 'pattern' | 'spacy' | 'llm';
}

export interface GraphNode {
  id: string;
  labels: string[];
  properties: Record<string, any>;
}

export interface GraphEdge {
  id: string;
  type: string;
  sourceId: string;
  targetId: string;
  properties: Record<string, any>;
}

export interface GraphTraversalRequest {
  startEntities: string[];
  strategy: 'neighborhood' | 'shortest_path' | 'community';
  maxDepth: number;
  maxNodes: number;
  relationshipTypes?: RelationType[];
}

export interface GraphTraversalResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  chunkIds: string[];
  naturalLanguageSummary: string;
}

export interface EntityResolutionConfig {
  similarityThreshold: number;
  useFuzzyMatch: boolean;
  useSemanticSimilarity: boolean;  // NEW: Use embedding-based similarity
  useLLMResolution: boolean;
  llmModel: string;
  embeddingModel: string;  // NEW: Model for semantic similarity
  batchSize: number;
  blockingEnabled: boolean;  // NEW: Enable blocking for large datasets
  blockingKeyFields: string[];  // NEW: Fields to use for blocking
}

// NEW: Community Detection for GraphRAG
export interface CommunityConfig {
  enabled: boolean;
  algorithm: 'louvain' | 'leiden';
  minCommunitySize: number;
  maxHierarchyLevels: number;
  generateSummaries: boolean;
}

export interface Community {
  id: string;
  level: number;
  parentId?: string;
  entityIds: string[];
  summary?: string;
  keywords: string[];
}
```

### 2.4 Entity Extractor

```typescript
// File: server/src/services/graph/EntityExtractor.ts

import { Entity, EntityType, EntityOccurrence, Relationship, RelationType } from '../../types/graph';
import { ContentBlock } from '../../types/parsing';
import { v4 as uuidv4 } from 'uuid';

interface ExtractionConfig {
  useLLM: boolean;
  llmModel: string;
  confidence Threshold: number;
}

export class EntityExtractor {
  private patterns: Map<EntityType, RegExp[]>;

  constructor(private config: ExtractionConfig) {
    this.patterns = this.initializePatterns();
  }

  async extract(
    documentId: string,
    blocks: ContentBlock[]
  ): Promise<{
    entities: Entity[];
    relationships: Relationship[];
  }> {
    const entities: Entity[] = [];
    const relationships: Relationship[] = [];

    for (const block of blocks) {
      // Pattern-based extraction
      const patternEntities = this.extractWithPatterns(documentId, block);
      entities.push(...patternEntities);

      // LLM-based extraction for complex cases
      if (this.config.useLLM) {
        const llmEntities = await this.extractWithLLM(documentId, block);
        entities.push(...llmEntities.entities);
        relationships.push(...llmEntities.relationships);
      }
    }

    // Extract relationships from co-occurrences
    const cooccurrenceRels = this.extractCooccurrenceRelationships(entities, blocks);
    relationships.push(...cooccurrenceRels);

    return { entities, relationships };
  }

  private initializePatterns(): Map<EntityType, RegExp[]> {
    return new Map([
      ['PERSON', [
        /(?:Herr|Frau|Dr\.|Prof\.)\s+([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)+)/g,
        /([A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)+)(?:\s+(?:CEO|CTO|CFO|Manager|Leiter|Direktor))/g,
      ]],
      ['ORGANIZATION', [
        /([A-ZÄÖÜ][a-zäöüß]*(?:\s+[A-ZÄÖÜ][a-zäöüß]*)*)\s+(?:GmbH|AG|KG|OHG|e\.V\.|Inc\.|Ltd\.)/g,
        /(?:Firma|Unternehmen|Abteilung)\s+([A-ZÄÖÜ][a-zäöüß\s]+)/g,
      ]],
      ['PROJECT', [
        /Projekt\s+([A-ZÄÖÜ][a-zäöüß\-\s]+)/gi,
        /(?:Projektnummer|Projekt-ID):\s*([A-Z0-9\-]+)/gi,
      ]],
      ['PRODUCT', [
        /Produkt\s+([A-ZÄÖÜ][a-zäöüß\-\s]+)/gi,
        /(?:SKU|Artikelnummer):\s*([A-Z0-9\-]+)/gi,
      ]],
      ['DATE', [
        /(\d{1,2}\.\d{1,2}\.\d{4})/g,
        /(\d{4}-\d{2}-\d{2})/g,
        /(Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+\d{4}/gi,
      ]],
      ['REGULATION', [
        /(DSGVO|GDPR|ISO\s*\d+|DIN\s*\d+)/gi,
        /(?:Gesetz|Verordnung|Richtlinie)\s+([A-ZÄÖÜ][a-zäöüß\s]+)/gi,
      ]],
    ]);
  }

  private extractWithPatterns(
    documentId: string,
    block: ContentBlock
  ): Entity[] {
    const entities: Entity[] = [];
    const text = block.content;

    for (const [entityType, patterns] of this.patterns) {
      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(text)) !== null) {
          const entityText = match[1] || match[0];

          // Check if entity already exists
          const existing = entities.find(
            e => e.type === entityType &&
                 (e.text === entityText || e.aliases.includes(entityText))
          );

          if (existing) {
            existing.occurrences.push({
              documentId,
              chunkId: block.id,
              position: match.index,
              context: text.substring(
                Math.max(0, match.index - 50),
                Math.min(text.length, match.index + entityText.length + 50)
              ),
            });
          } else {
            entities.push({
              id: uuidv4(),
              type: entityType,
              text: entityText,
              canonicalForm: this.normalize(entityText),
              aliases: [],
              confidence: 0.8,
              occurrences: [{
                documentId,
                chunkId: block.id,
                position: match.index,
                context: text.substring(
                  Math.max(0, match.index - 50),
                  Math.min(text.length, match.index + entityText.length + 50)
                ),
              }],
              metadata: {},
            });
          }
        }
      }
    }

    return entities;
  }

  private async extractWithLLM(
    documentId: string,
    block: ContentBlock
  ): Promise<{
    entities: Entity[];
    relationships: Relationship[];
  }> {
    // Use Ollama for entity/relationship extraction
    const prompt = `
Extrahiere Entitäten und Beziehungen aus folgendem Text.

Text:
${block.content}

Antworte im JSON-Format:
{
  "entities": [
    {"type": "PERSON|ORGANIZATION|PROJECT|PRODUCT", "text": "...", "confidence": 0.9}
  ],
  "relationships": [
    {"source": "...", "target": "...", "type": "WORKS_FOR|MANAGES|...", "evidence": "..."}
  ]
}
`;

    try {
      const response = await fetch(`${process.env.OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.config.llmModel,
          prompt,
          format: 'json',
          stream: false,
        }),
      });

      const result = await response.json();
      const parsed = JSON.parse(result.response);

      const entities: Entity[] = (parsed.entities || []).map((e: any) => ({
        id: uuidv4(),
        type: e.type as EntityType,
        text: e.text,
        canonicalForm: this.normalize(e.text),
        aliases: [],
        confidence: e.confidence || 0.7,
        occurrences: [{
          documentId,
          chunkId: block.id,
          position: block.content.indexOf(e.text),
          context: e.text,
        }],
        metadata: { extractionMethod: 'llm' },
      }));

      const relationships: Relationship[] = (parsed.relationships || []).map((r: any) => ({
        id: uuidv4(),
        sourceEntityId: '', // Will be resolved later
        targetEntityId: '',
        type: r.type as RelationType,
        confidence: 0.7,
        evidence: r.evidence,
        documentId,
        extractionMethod: 'llm' as const,
      }));

      return { entities, relationships };

    } catch (error) {
      console.error('LLM extraction failed:', error);
      return { entities: [], relationships: [] };
    }
  }

  private extractCooccurrenceRelationships(
    entities: Entity[],
    blocks: ContentBlock[]
  ): Relationship[] {
    const relationships: Relationship[] = [];

    // Find entities that appear in the same block
    for (const block of blocks) {
      const blockEntities = entities.filter(e =>
        e.occurrences.some(o => o.chunkId === block.id)
      );

      // Create relationships for co-occurring entities
      for (let i = 0; i < blockEntities.length; i++) {
        for (let j = i + 1; j < blockEntities.length; j++) {
          const e1 = blockEntities[i];
          const e2 = blockEntities[j];

          // Infer relationship type based on entity types
          const relType = this.inferRelationshipType(e1.type, e2.type);

          if (relType) {
            relationships.push({
              id: uuidv4(),
              sourceEntityId: e1.id,
              targetEntityId: e2.id,
              type: relType,
              confidence: 0.5,
              evidence: block.content.substring(0, 200),
              documentId: e1.occurrences[0].documentId,
              extractionMethod: 'pattern',
            });
          }
        }
      }
    }

    return relationships;
  }

  private inferRelationshipType(
    type1: EntityType,
    type2: EntityType
  ): RelationType | null {
    const rules: Record<string, RelationType> = {
      'PERSON-ORGANIZATION': 'WORKS_FOR',
      'PERSON-PROJECT': 'MANAGES',
      'DOCUMENT-TOPIC': 'ABOUT',
      'PROJECT-PRODUCT': 'PART_OF',
      'PERSON-PERSON': 'COLLABORATES_WITH',
    };

    const key1 = `${type1}-${type2}`;
    const key2 = `${type2}-${type1}`;

    return rules[key1] || rules[key2] || null;
  }

  private normalize(text: string): string {
    return text
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s]/g, '');
  }
}
```

### 2.5 Entity Resolver (with Semantic Similarity)

> **Best Practice (2025):** Modern entity resolution combines fuzzy matching with
> embedding-based semantic similarity for higher accuracy. See:
> [Semantic Entity Resolution](https://blog.graphlet.ai/the-rise-of-semantic-entity-resolution-45c48d5eb00a)

```typescript
// File: server/src/services/graph/EntityResolver.ts

import { Entity, EntityResolutionConfig } from '../../types/graph';
import { v4 as uuidv4 } from 'uuid';

// Embedding cache to avoid redundant API calls
const embeddingCache = new Map<string, number[]>();

export class EntityResolver {
  constructor(
    private config: EntityResolutionConfig,
    private embeddingService?: { embed: (text: string) => Promise<number[]> }
  ) {}

  async resolve(entities: Entity[]): Promise<{
    resolved: Entity[];
    mergeStats: {
      original: number;
      afterMerge: number;
      mergedGroups: number;
    };
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

    for (const [type, typeEntities] of byType) {
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
      .filter(e => !embeddingCache.has(e.canonicalForm))
      .map(e => e.canonicalForm);

    if (textsToEmbed.length === 0) return;

    // Batch embed (in chunks of batchSize)
    for (let i = 0; i < textsToEmbed.length; i += this.config.batchSize) {
      const batch = textsToEmbed.slice(i, i + this.config.batchSize);
      const embeddings = await Promise.all(
        batch.map(text => this.embeddingService!.embed(text))
      );
      batch.forEach((text, idx) => embeddingCache.set(text, embeddings[idx]));
    }
  }

  /**
   * Calculate similarity using multiple strategies:
   * 1. Exact match
   * 2. Alias match
   * 3. Semantic similarity (embedding cosine distance) - NEW
   * 4. Fuzzy match (Levenshtein)
   * 5. Abbreviation detection
   */
  private async calculateSimilarity(e1: Entity, e2: Entity): Promise<number> {
    // 1. Exact match
    if (e1.canonicalForm === e2.canonicalForm) return 1.0;

    // 2. Alias match
    if (e1.aliases.includes(e2.text) || e2.aliases.includes(e1.text)) return 0.95;

    // 3. Semantic similarity (embeddings) - RECOMMENDED
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
      const fuzzyScore = 1 - (levenshtein / maxLen);

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

  private levenshteinDistance(s1: string, s2: string): number {
    const m = s1.length;
    const n = s2.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

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

  private isAbbreviation(short: string, long: string): boolean {
    if (short.length >= long.length) return false;

    const words = long.split(/\s+/);
    const initials = words.map(w => w[0]?.toUpperCase()).join('');

    return short.toUpperCase() === initials;
  }

  private async mergeEntities(entities: Entity[]): Promise<Entity> {
    // Find the most common/confident canonical form
    const forms = entities.map(e => ({ form: e.canonicalForm, confidence: e.confidence }));
    forms.sort((a, b) => b.confidence - a.confidence);

    // Collect all aliases
    const allAliases = new Set<string>();
    for (const e of entities) {
      allAliases.add(e.text);
      e.aliases.forEach(a => allAliases.add(a));
    }

    // Merge occurrences
    const allOccurrences = entities.flatMap(e => e.occurrences);

    // Calculate merged confidence
    const avgConfidence = entities.reduce((s, e) => s + e.confidence, 0) / entities.length;

    return {
      id: uuidv4(),
      type: entities[0].type,
      text: entities[0].text, // Use first entity's text
      canonicalForm: forms[0].form,
      aliases: Array.from(allAliases).filter(a => a !== forms[0].form),
      confidence: Math.min(1, avgConfidence + 0.1), // Boost confidence for merged
      occurrences: allOccurrences,
      metadata: {
        mergedFrom: entities.map(e => e.id),
        mergeCount: entities.length,
        resolutionMethod: this.config.useSemanticSimilarity ? 'semantic' : 'fuzzy',
      },
    };
  }
}
```

### 2.6 Neo4j Graph Service

> **Note:** Updated for neo4j-driver 6.x API. Key changes from v5:
> - Default export changed
> - Session creation requires database parameter
> - Integer handling improved

```typescript
// File: server/src/services/graph/Neo4jService.ts

// neo4j-driver 6.x uses default export
import neo4j from 'neo4j-driver';
import type { Driver, Session } from 'neo4j-driver';
import { Entity, Relationship, GraphNode, GraphEdge, GraphTraversalRequest, GraphTraversalResult, Community } from '../../types/graph';

export class Neo4jService {
  private driver: Driver | null = null;
  private initialized = false;
  private database: string;

  constructor(
    private uri: string,
    private username: string,
    private password: string,
    database: string = 'neo4j'
  ) {
    this.database = database;
  }

  async initialize(): Promise<void> {
    // neo4j-driver 6.x connection
    this.driver = neo4j.driver(
      this.uri,
      neo4j.auth.basic(this.username, this.password),
      {
        // Connection pool settings
        maxConnectionPoolSize: 50,
        connectionAcquisitionTimeout: 30000,
        // Logging
        logging: {
          level: 'info',
          logger: (level, message) => console.log(`[Neo4j ${level}] ${message}`),
        },
      }
    );

    // Verify connection with server info
    const serverInfo = await this.driver.getServerInfo();
    console.log(`Neo4j connected: ${serverInfo.address} (${serverInfo.agent})`);

    // Create session with explicit database
    const session = this.driver.session({ database: this.database });
    try {
      await session.run('RETURN 1');
      this.initialized = true;

      // Create indexes
      await this.createIndexes(session);
    } finally {
      await session.close();
    }
  }

  /**
   * Get a session with proper database context (neo4j-driver 6.x)
   */
  private getSession(): Session {
    if (!this.driver) throw new Error('Driver not initialized');
    return this.driver.session({ database: this.database });
  }

  private async createIndexes(session: Session): Promise<void> {
    const indexes = [
      'CREATE INDEX entity_id IF NOT EXISTS FOR (e:Entity) ON (e.id)',
      'CREATE INDEX entity_canonical IF NOT EXISTS FOR (e:Entity) ON (e.canonicalForm)',
      'CREATE INDEX document_id IF NOT EXISTS FOR (d:Document) ON (d.id)',
      'CREATE INDEX chunk_id IF NOT EXISTS FOR (c:Chunk) ON (c.id)',
    ];

    for (const index of indexes) {
      try {
        await session.run(index);
      } catch (error) {
        // Index might already exist
      }
    }
  }

  async storeEntity(entity: Entity): Promise<void> {
    const session = this.getSession();
    try {
      await session.run(
        `
        MERGE (e:Entity:${entity.type} {id: $id})
        SET e.text = $text,
            e.canonicalForm = $canonicalForm,
            e.aliases = $aliases,
            e.confidence = $confidence
        `,
        {
          id: entity.id,
          text: entity.text,
          canonicalForm: entity.canonicalForm,
          aliases: entity.aliases,
          confidence: entity.confidence,
        }
      );

      // Link to documents and chunks
      for (const occurrence of entity.occurrences) {
        await session.run(
          `
          MATCH (e:Entity {id: $entityId})
          MERGE (d:Document {id: $documentId})
          MERGE (c:Chunk {id: $chunkId})
          MERGE (e)-[:MENTIONED_IN]->(c)
          MERGE (c)-[:PART_OF]->(d)
          `,
          {
            entityId: entity.id,
            documentId: occurrence.documentId,
            chunkId: occurrence.chunkId,
          }
        );
      }
    } finally {
      await session.close();
    }
  }

  async storeRelationship(rel: Relationship): Promise<void> {
    const session = this.getSession();
    try {
      await session.run(
        `
        MATCH (source:Entity {id: $sourceId})
        MATCH (target:Entity {id: $targetId})
        MERGE (source)-[r:${rel.type} {id: $relId}]->(target)
        SET r.confidence = $confidence,
            r.evidence = $evidence,
            r.documentId = $documentId
        `,
        {
          sourceId: rel.sourceEntityId,
          targetId: rel.targetEntityId,
          relId: rel.id,
          confidence: rel.confidence,
          evidence: rel.evidence,
          documentId: rel.documentId,
        }
      );
    } finally {
      await session.close();
    }
  }

  async traverse(request: GraphTraversalRequest): Promise<GraphTraversalResult> {
    const session = this.getSession();
    try {
      let query: string;
      let params: Record<string, any>;

      switch (request.strategy) {
        case 'neighborhood':
          // Updated for APOC 5.x: use expandConfig instead of deprecated subgraphAll
          query = `
            MATCH (start:Entity)
            WHERE start.canonicalForm IN $startEntities OR start.text IN $startEntities
            CALL apoc.path.expandConfig(start, {
              maxLevel: $maxDepth,
              limit: $maxNodes,
              uniqueness: 'NODE_GLOBAL'
              ${request.relationshipTypes ? `, relationshipFilter: '${request.relationshipTypes.join('|')}'` : ''}
            })
            YIELD path
            WITH collect(path) AS paths
            WITH apoc.coll.toSet(apoc.coll.flatten([p IN paths | nodes(p)])) AS nodes,
                 apoc.coll.toSet(apoc.coll.flatten([p IN paths | relationships(p)])) AS relationships
            RETURN nodes, relationships
          `;
          params = {
            startEntities: request.startEntities,
            maxDepth: request.maxDepth,
            maxNodes: request.maxNodes,
          };
          break;

        case 'shortest_path':
          if (request.startEntities.length < 2) {
            return { nodes: [], edges: [], chunkIds: [], naturalLanguageSummary: '' };
          }
          query = `
            MATCH (start:Entity), (end:Entity)
            WHERE start.canonicalForm = $start AND end.canonicalForm = $end
            MATCH path = shortestPath((start)-[*..${request.maxDepth}]-(end))
            RETURN nodes(path) as nodes, relationships(path) as relationships
          `;
          params = {
            start: request.startEntities[0],
            end: request.startEntities[1],
          };
          break;

        default:
          query = `
            MATCH (e:Entity)-[r]-(connected)
            WHERE e.canonicalForm IN $startEntities
            RETURN e, r, connected
            LIMIT $maxNodes
          `;
          params = {
            startEntities: request.startEntities,
            maxNodes: request.maxNodes,
          };
      }

      const result = await session.run(query, params);

      // Extract nodes and edges
      const nodes: GraphNode[] = [];
      const edges: GraphEdge[] = [];
      const chunkIds = new Set<string>();
      const nodeIds = new Set<string>();

      for (const record of result.records) {
        const recordNodes = record.get('nodes') || [];
        const recordRels = record.get('relationships') || [];

        for (const node of recordNodes) {
          if (!nodeIds.has(node.identity.toString())) {
            nodeIds.add(node.identity.toString());
            nodes.push({
              id: node.properties.id,
              labels: node.labels,
              properties: node.properties,
            });
          }
        }

        for (const rel of recordRels) {
          edges.push({
            id: rel.properties?.id || rel.identity.toString(),
            type: rel.type,
            sourceId: rel.start.toString(),
            targetId: rel.end.toString(),
            properties: rel.properties || {},
          });
        }
      }

      // Get chunk IDs for entities
      for (const node of nodes) {
        if (node.labels.includes('Chunk')) {
          chunkIds.add(node.properties.id);
        }
      }

      // Generate summary
      const summary = this.generateSummary(nodes, edges);

      return {
        nodes,
        edges,
        chunkIds: Array.from(chunkIds),
        naturalLanguageSummary: summary,
      };

    } finally {
      await session.close();
    }
  }

  async findEntitiesByText(texts: string[]): Promise<Entity[]> {
    const session = this.getSession();
    try {
      const result = await session.run(
        `
        MATCH (e:Entity)
        WHERE e.canonicalForm IN $texts OR e.text IN $texts
           OR ANY(alias IN e.aliases WHERE alias IN $texts)
        RETURN e
        `,
        { texts: texts.map(t => t.toLowerCase()) }
      );

      return result.records.map(record => {
        const node = record.get('e');
        return {
          id: node.properties.id,
          type: node.labels.find((l: string) => l !== 'Entity') as any,
          text: node.properties.text,
          canonicalForm: node.properties.canonicalForm,
          aliases: node.properties.aliases || [],
          confidence: node.properties.confidence,
          occurrences: [],
          metadata: {},
        };
      });
    } finally {
      await session.close();
    }
  }

  async deleteDocumentEntities(documentId: string): Promise<void> {
    const session = this.getSession();
    try {
      await session.run(
        `
        MATCH (d:Document {id: $documentId})<-[:PART_OF]-(c:Chunk)
        MATCH (c)<-[:MENTIONED_IN]-(e:Entity)
        DETACH DELETE c
        WITH e
        WHERE NOT (e)-[:MENTIONED_IN]->()
        DETACH DELETE e
        `,
        { documentId }
      );
    } finally {
      await session.close();
    }
  }

  private generateSummary(nodes: GraphNode[], edges: GraphEdge[]): string {
    const entityCount = nodes.filter(n => n.labels.includes('Entity')).length;
    const relCount = edges.length;

    const entityTypes = new Set(
      nodes.filter(n => n.labels.includes('Entity')).flatMap(n => n.labels)
    );
    entityTypes.delete('Entity');

    const relTypes = new Set(edges.map(e => e.type));

    return `Graph mit ${entityCount} Entitäten (${Array.from(entityTypes).join(', ')}) und ${relCount} Beziehungen (${Array.from(relTypes).join(', ')}).`;
  }

  async close(): Promise<void> {
    await this.driver.close();
  }
}
```

### 2.7 Graph Refinement Service

```typescript
// File: server/src/services/graph/GraphRefinement.ts

import { Neo4jService } from './Neo4jService';
import { GraphTraversalResult } from '../../types/graph';

interface RefinementRequest {
  query: string;
  queryEntities: string[];
  topChunks: Array<{ id: string; content: string; score: number }>;
  maxDepth: number;
  maxNodes: number;
}

interface RefinedResult {
  additionalChunkIds: string[];
  graphContext: GraphTraversalResult;
  shouldUseGraph: boolean;
}

export class GraphRefinement {
  constructor(private neo4jService: Neo4jService) {}

  async refine(request: RefinementRequest): Promise<RefinedResult> {
    // 1. Extract entities from top chunks
    const chunkEntities = this.extractEntitiesFromChunks(request.topChunks);

    // 2. Combine with query entities
    const allEntities = [...new Set([...request.queryEntities, ...chunkEntities])];

    if (allEntities.length === 0) {
      return {
        additionalChunkIds: [],
        graphContext: { nodes: [], edges: [], chunkIds: [], naturalLanguageSummary: '' },
        shouldUseGraph: false,
      };
    }

    // 3. Traverse graph
    const graphResult = await this.neo4jService.traverse({
      startEntities: allEntities,
      strategy: 'neighborhood',
      maxDepth: request.maxDepth,
      maxNodes: request.maxNodes,
    });

    // 4. Find additional chunks not in original results
    const existingChunkIds = new Set(request.topChunks.map(c => c.id));
    const additionalChunkIds = graphResult.chunkIds.filter(id => !existingChunkIds.has(id));

    // 5. Determine if graph context is useful
    const shouldUseGraph = graphResult.nodes.length > 2 ||
                          additionalChunkIds.length > 0 ||
                          request.queryEntities.length > 1;

    return {
      additionalChunkIds,
      graphContext: graphResult,
      shouldUseGraph,
    };
  }

  private extractEntitiesFromChunks(chunks: Array<{ content: string }>): string[] {
    const entities: string[] = [];

    // Simple extraction - look for capitalized phrases
    for (const chunk of chunks) {
      const matches = chunk.content.match(/[A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)+/g);
      if (matches) {
        entities.push(...matches);
      }
    }

    return [...new Set(entities)];
  }
}
```

### 2.8 Community Detection (Optional - GraphRAG Enhancement)

> **Why Community Detection?** Microsoft's GraphRAG research shows that hierarchical
> community structures improve multi-hop query accuracy from ~43% to ~91%.
> See: [Microsoft GraphRAG](https://microsoft.github.io/graphrag/)

```typescript
// File: server/src/services/graph/CommunityDetection.ts

import { Neo4jService } from './Neo4jService';
import { Community, CommunityConfig } from '../../types/graph';

export class CommunityDetection {
  constructor(
    private neo4jService: Neo4jService,
    private config: CommunityConfig
  ) {}

  /**
   * Detect communities using Graph Data Science library.
   * Requires: Neo4j GDS plugin installed.
   */
  async detectCommunities(): Promise<Community[]> {
    if (!this.config.enabled) return [];

    const session = (this.neo4jService as any).getSession();
    try {
      // Create in-memory graph projection
      await session.run(`
        CALL gds.graph.project(
          'entity-graph',
          'Entity',
          {
            WORKS_FOR: { orientation: 'UNDIRECTED' },
            MANAGES: { orientation: 'UNDIRECTED' },
            COLLABORATES_WITH: { orientation: 'UNDIRECTED' },
            PART_OF: { orientation: 'UNDIRECTED' }
          }
        )
      `);

      // Run community detection (Louvain or Leiden)
      const algorithmQuery = this.config.algorithm === 'leiden'
        ? `CALL gds.leiden.write('entity-graph', {
             writeProperty: 'communityId',
             includeIntermediateCommunities: true,
             maxLevels: $maxLevels
           })`
        : `CALL gds.louvain.write('entity-graph', {
             writeProperty: 'communityId',
             includeIntermediateCommunities: true,
             maxLevels: $maxLevels
           })`;

      await session.run(algorithmQuery, {
        maxLevels: this.config.maxHierarchyLevels,
      });

      // Fetch detected communities
      const result = await session.run(`
        MATCH (e:Entity)
        WHERE e.communityId IS NOT NULL
        WITH e.communityId AS communityId, collect(e.id) AS entityIds
        WHERE size(entityIds) >= $minSize
        RETURN communityId, entityIds
        ORDER BY size(entityIds) DESC
      `, { minSize: this.config.minCommunitySize });

      const communities: Community[] = result.records.map((record, idx) => ({
        id: `community_${idx}`,
        level: 0,
        entityIds: record.get('entityIds'),
        keywords: [],
        summary: undefined,
      }));

      // Generate summaries if enabled
      if (this.config.generateSummaries) {
        await this.generateCommunitySummaries(communities);
      }

      // Cleanup graph projection
      await session.run(`CALL gds.graph.drop('entity-graph')`);

      return communities;
    } finally {
      await session.close();
    }
  }

  /**
   * Generate natural language summaries for communities using LLM.
   * This enables "global" queries across the knowledge graph.
   */
  private async generateCommunitySummaries(communities: Community[]): Promise<void> {
    for (const community of communities) {
      // Fetch entity details
      const session = (this.neo4jService as any).getSession();
      try {
        const result = await session.run(`
          MATCH (e:Entity)
          WHERE e.id IN $entityIds
          RETURN e.text AS text, e.type AS type
        `, { entityIds: community.entityIds });

        const entities = result.records.map(r => ({
          text: r.get('text'),
          type: r.get('type'),
        }));

        // Extract keywords (most common entity types)
        const typeCounts = new Map<string, number>();
        entities.forEach(e => {
          typeCounts.set(e.type, (typeCounts.get(e.type) || 0) + 1);
        });
        community.keywords = Array.from(typeCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([type]) => type);

        // Generate summary via LLM (optional - can be expensive)
        // community.summary = await this.llmSummarize(entities);
      } finally {
        await session.close();
      }
    }
  }
}
```

**Installation Note:** Community detection requires Neo4j Graph Data Science (GDS) library:

```yaml
# Add to docker-compose.neo4j.yml
environment:
  NEO4J_PLUGINS: '["apoc", "graph-data-science"]'
```

---

## 3. Phase 5: Query Intelligence & Observability (Weeks 12-13)

### 3.1 Query Router

```typescript
// File: server/src/services/rag/QueryRouter.ts

import { EntityExtractor } from '../graph/EntityExtractor';

export type QueryType =
  | 'factual'
  | 'comparative'
  | 'procedural'
  | 'relational'
  | 'aggregative'
  | 'temporal';

export type RetrievalStrategy =
  | 'vector_only'
  | 'hybrid'
  | 'hybrid_with_graph'
  | 'table_focused'
  | 'multi_index';

export interface QueryAnalysis {
  queryType: QueryType;
  entities: string[];
  isMultiHop: boolean;
  requiresGraph: boolean;
  requiresTable: boolean;
  suggestedStrategy: RetrievalStrategy;
  confidence: number;
}

export class QueryRouter {
  private queryTypePatterns: Map<QueryType, RegExp[]>;

  constructor() {
    this.queryTypePatterns = this.initializePatterns();
  }

  analyze(query: string): QueryAnalysis {
    // 1. Classify query type
    const queryType = this.classifyQueryType(query);

    // 2. Extract entities
    const entities = this.extractQueryEntities(query);

    // 3. Detect multi-hop indicators
    const isMultiHop = this.detectMultiHop(query);

    // 4. Detect table need
    const requiresTable = this.detectTableNeed(query);

    // 5. Determine if graph is needed
    const requiresGraph = isMultiHop || entities.length > 1 || queryType === 'relational';

    // 6. Select strategy
    const suggestedStrategy = this.selectStrategy(queryType, requiresGraph, requiresTable);

    // 7. Calculate confidence
    const confidence = this.calculateConfidence(query, queryType);

    return {
      queryType,
      entities,
      isMultiHop,
      requiresGraph,
      requiresTable,
      suggestedStrategy,
      confidence,
    };
  }

  private initializePatterns(): Map<QueryType, RegExp[]> {
    return new Map([
      ['factual', [
        /was ist/i,
        /wer ist/i,
        /wo ist/i,
        /wann (wurde|ist|war)/i,
        /wie (heißt|lautet)/i,
      ]],
      ['comparative', [
        /vergleich/i,
        /unterschied/i,
        /vs\.?/i,
        /im gegensatz/i,
        /besser als/i,
        /mehr als/i,
      ]],
      ['procedural', [
        /wie (kann|mache|erstelle|beantrage)/i,
        /anleitung/i,
        /schritt/i,
        /prozess/i,
        /vorgehen/i,
      ]],
      ['relational', [
        /wer (arbeitet|ist.*verantwortlich|leitet)/i,
        /welche.*abteilung/i,
        /zuständig/i,
        /berichtet an/i,
        /gehört zu/i,
      ]],
      ['aggregative', [
        /liste/i,
        /alle/i,
        /wie viele/i,
        /aufzählung/i,
        /übersicht/i,
      ]],
      ['temporal', [
        /wann/i,
        /seit wann/i,
        /bis wann/i,
        /deadline/i,
        /zeitraum/i,
      ]],
    ]);
  }

  private classifyQueryType(query: string): QueryType {
    for (const [type, patterns] of this.queryTypePatterns) {
      if (patterns.some(p => p.test(query))) {
        return type;
      }
    }
    return 'factual'; // Default
  }

  private extractQueryEntities(query: string): string[] {
    const entities: string[] = [];

    // Look for capitalized phrases (potential entities)
    const matches = query.match(/[A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)*/g);
    if (matches) {
      entities.push(...matches);
    }

    // Look for quoted terms
    const quoted = query.match(/"([^"]+)"/g);
    if (quoted) {
      entities.push(...quoted.map(q => q.replace(/"/g, '')));
    }

    return [...new Set(entities)];
  }

  private detectMultiHop(query: string): boolean {
    const multiHopIndicators = [
      /wer.*das.*projekt.*leitet/i,
      /welche.*dokumente.*von.*erstellt/i,
      /alle.*die.*arbeiten/i,
      /.*und dessen.*/i,
      /.*die.*wiederum.*/i,
      /verbunden mit/i,
      /im zusammenhang mit/i,
    ];

    return multiHopIndicators.some(p => p.test(query));
  }

  private detectTableNeed(query: string): boolean {
    const tableIndicators = [
      /tabelle/i,
      /liste.*mit/i,
      /übersicht/i,
      /vergleich/i,
      /alle.*aufgelistet/i,
      /prozent|%/i,
      /zahlen|daten/i,
    ];

    return tableIndicators.some(p => p.test(query));
  }

  private selectStrategy(
    queryType: QueryType,
    requiresGraph: boolean,
    requiresTable: boolean
  ): RetrievalStrategy {
    if (requiresGraph) {
      return 'hybrid_with_graph';
    }

    if (requiresTable) {
      return 'table_focused';
    }

    if (queryType === 'aggregative') {
      return 'multi_index';
    }

    return 'hybrid';
  }

  private calculateConfidence(query: string, queryType: QueryType): number {
    // Base confidence
    let confidence = 0.7;

    // Boost for clear query patterns
    const patterns = this.queryTypePatterns.get(queryType) || [];
    const matchCount = patterns.filter(p => p.test(query)).length;
    confidence += matchCount * 0.05;

    // Boost for longer, more specific queries
    if (query.length > 50) confidence += 0.05;
    if (query.length > 100) confidence += 0.05;

    return Math.min(1, confidence);
  }
}
```

### 3.2 Tracing Service

```typescript
// File: server/src/services/observability/TracingService.ts

import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../DatabaseService';

export type SpanName =
  | 'query_analysis'
  | 'embedding_generation'
  | 'vector_search'
  | 'graph_traversal'
  | 'reranking'
  | 'context_compression'
  | 'llm_generation'
  | 'guardrails';

interface RAGSpan {
  spanId: string;
  parentSpanId?: string;
  name: SpanName;
  startTime: number;
  endTime?: number;
  metadata: Record<string, any>;
  status: 'running' | 'ok' | 'error';
  errorMessage?: string;
}

interface RAGTrace {
  traceId: string;
  timestamp: Date;
  userIdHash: string;
  sessionId: string;
  queryLength: number;
  queryType?: string;
  spans: RAGSpan[];
  success: boolean;
  totalLatencyMs: number;
  tokensUsed: number;
}

export class TracingService {
  private traces = new Map<string, RAGTrace>();

  constructor(private db: DatabaseService) {}

  startTrace(userId: string, sessionId: string, queryLength: number): string {
    const traceId = uuidv4();

    this.traces.set(traceId, {
      traceId,
      timestamp: new Date(),
      userIdHash: this.hashUserId(userId),
      sessionId,
      queryLength,
      spans: [],
      success: false,
      totalLatencyMs: 0,
      tokensUsed: 0,
    });

    return traceId;
  }

  startSpan(traceId: string, name: SpanName, parentSpanId?: string): string {
    const trace = this.traces.get(traceId);
    if (!trace) throw new Error('Trace not found');

    const spanId = uuidv4();

    trace.spans.push({
      spanId,
      parentSpanId,
      name,
      startTime: Date.now(),
      metadata: {},
      status: 'running',
    });

    return spanId;
  }

  endSpan(
    traceId: string,
    spanId: string,
    metadata: Record<string, any>,
    error?: Error
  ): void {
    const trace = this.traces.get(traceId);
    if (!trace) return;

    const span = trace.spans.find(s => s.spanId === spanId);
    if (!span) return;

    span.endTime = Date.now();
    span.metadata = metadata;

    if (error) {
      span.status = 'error';
      span.errorMessage = error.message;
    } else {
      span.status = 'ok';
    }
  }

  async endTrace(traceId: string, success: boolean, tokensUsed: number = 0): Promise<RAGTrace> {
    const trace = this.traces.get(traceId);
    if (!trace) throw new Error('Trace not found');

    trace.success = success;
    trace.tokensUsed = tokensUsed;
    trace.totalLatencyMs = trace.spans.reduce((sum, span) => {
      if (span.endTime) {
        return sum + (span.endTime - span.startTime);
      }
      return sum;
    }, 0);

    // Persist to database
    await this.persistTrace(trace);

    this.traces.delete(traceId);

    return trace;
  }

  private async persistTrace(trace: RAGTrace): Promise<void> {
    await this.db.query(
      `INSERT INTO rag_traces
       (trace_id, timestamp, user_id_hash, session_id, query_length,
        query_type, success, total_latency_ms, tokens_used, spans)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        trace.traceId,
        trace.timestamp,
        trace.userIdHash,
        trace.sessionId,
        trace.queryLength,
        trace.queryType,
        trace.success,
        trace.totalLatencyMs,
        trace.tokensUsed,
        JSON.stringify(trace.spans),
      ]
    );
  }

  /**
   * Hash user ID for privacy using SHA-256.
   * This ensures user IDs cannot be reversed from traces.
   */
  private hashUserId(userId: string): string {
    const { createHash } = require('crypto');
    return createHash('sha256')
      .update(userId)
      .digest('hex')
      .substring(0, 16);
  }

  async getTraceStats(hours: number = 24): Promise<{
    totalTraces: number;
    successRate: number;
    avgLatency: number;
    p95Latency: number;
    spanBreakdown: Record<SpanName, { avgLatency: number; errorRate: number }>;
  }> {
    const result = await this.db.query(
      `SELECT
         COUNT(*) as total,
         AVG(CASE WHEN success THEN 1 ELSE 0 END) as success_rate,
         AVG(total_latency_ms) as avg_latency,
         PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY total_latency_ms) as p95_latency,
         spans
       FROM rag_traces
       WHERE timestamp > NOW() - INTERVAL '${hours} hours'`
    );

    // Calculate span breakdown
    const spanStats: Record<string, { total: number; latency: number; errors: number }> = {};

    for (const row of result.rows) {
      const spans = row.spans || [];
      for (const span of spans) {
        if (!spanStats[span.name]) {
          spanStats[span.name] = { total: 0, latency: 0, errors: 0 };
        }
        spanStats[span.name].total++;
        spanStats[span.name].latency += (span.endTime || span.startTime) - span.startTime;
        if (span.status === 'error') spanStats[span.name].errors++;
      }
    }

    const spanBreakdown: Record<string, { avgLatency: number; errorRate: number }> = {};
    for (const [name, stats] of Object.entries(spanStats)) {
      spanBreakdown[name] = {
        avgLatency: stats.total > 0 ? stats.latency / stats.total : 0,
        errorRate: stats.total > 0 ? stats.errors / stats.total : 0,
      };
    }

    return {
      totalTraces: parseInt(result.rows[0]?.total) || 0,
      successRate: parseFloat(result.rows[0]?.success_rate) || 0,
      avgLatency: parseFloat(result.rows[0]?.avg_latency) || 0,
      p95Latency: parseFloat(result.rows[0]?.p95_latency) || 0,
      spanBreakdown: spanBreakdown as any,
    };
  }
}
```

### 3.3 Guardrails

```typescript
// File: server/src/services/guardrails/Guardrails.ts

interface InputGuardrailsConfig {
  maxQueryLength: number;
  minQueryLength: number;
  blockedPatterns: RegExp[];
  maxQueriesPerMinute: number;
}

interface OutputGuardrailsConfig {
  maxResponseLength: number;
  requireCitations: boolean;
  groundednessThreshold: number;
  blockedContentPatterns: RegExp[];
}

const DEFAULT_INPUT_CONFIG: InputGuardrailsConfig = {
  maxQueryLength: 2000,
  minQueryLength: 3,
  blockedPatterns: [
    /ignore.*instructions/i,
    /forget.*everything/i,
    /system.*prompt/i,
    /you.*are.*now/i,
    /<script>/i,
  ],
  maxQueriesPerMinute: 10,
};

const DEFAULT_OUTPUT_CONFIG: OutputGuardrailsConfig = {
  maxResponseLength: 4000,
  requireCitations: true,
  groundednessThreshold: 0.7,
  blockedContentPatterns: [
    /password.*is/i,
    /api.*key.*:/i,
    /secret.*:/i,
  ],
};

export class InputGuardrails {
  private rateLimits = new Map<string, number[]>();

  constructor(private config: InputGuardrailsConfig = DEFAULT_INPUT_CONFIG) {}

  validate(query: string, userId: string): {
    valid: boolean;
    errors: string[];
    warnings: string[];
    sanitizedQuery: string;
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Length check
    if (query.length > this.config.maxQueryLength) {
      errors.push(`Query exceeds ${this.config.maxQueryLength} characters`);
    }
    if (query.length < this.config.minQueryLength) {
      errors.push(`Query is too short (min ${this.config.minQueryLength})`);
    }

    // Blocked patterns
    for (const pattern of this.config.blockedPatterns) {
      if (pattern.test(query)) {
        errors.push('Query contains blocked content');
        break;
      }
    }

    // Rate limiting
    if (!this.checkRateLimit(userId)) {
      errors.push('Rate limit exceeded');
    }

    // Sanitize
    const sanitizedQuery = this.sanitize(query);

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      sanitizedQuery,
    };
  }

  private checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const windowMs = 60000; // 1 minute

    const timestamps = this.rateLimits.get(userId) || [];
    const recent = timestamps.filter(t => now - t < windowMs);

    if (recent.length >= this.config.maxQueriesPerMinute) {
      return false;
    }

    recent.push(now);
    this.rateLimits.set(userId, recent);

    return true;
  }

  private sanitize(query: string): string {
    return query
      .trim()
      .replace(/<[^>]*>/g, '') // Remove HTML
      .replace(/\s+/g, ' ');   // Normalize whitespace
  }
}

export class OutputGuardrails {
  constructor(private config: OutputGuardrailsConfig = DEFAULT_OUTPUT_CONFIG) {}

  async validate(
    response: string,
    context: string[]
  ): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
    finalResponse: string;
    groundedness: number;
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    let finalResponse = response;

    // Length check
    const tokenCount = response.split(/\s+/).length;
    if (tokenCount > this.config.maxResponseLength) {
      finalResponse = response.split(/\s+/).slice(0, this.config.maxResponseLength).join(' ');
      warnings.push('Response truncated');
    }

    // Citation check
    if (this.config.requireCitations) {
      const hasCitations = /\[Quelle:/.test(response);
      if (!hasCitations) {
        warnings.push('Response missing citations');
      }
    }

    // Blocked content
    for (const pattern of this.config.blockedContentPatterns) {
      if (pattern.test(response)) {
        finalResponse = finalResponse.replace(pattern, '[REDACTED]');
        warnings.push('Sensitive content redacted');
      }
    }

    // Groundedness check
    const groundedness = this.calculateGroundedness(response, context);
    if (groundedness < this.config.groundednessThreshold) {
      warnings.push(`Low groundedness: ${(groundedness * 100).toFixed(0)}%`);
      finalResponse += '\n\n*Hinweis: Diese Antwort konnte nicht vollständig durch Dokumente belegt werden.*';
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      finalResponse,
      groundedness,
    };
  }

  /**
   * Calculate groundedness score using optimized Set-based matching.
   * Performance: O(n + m) instead of O(n * m) with naive string.includes()
   */
  private calculateGroundedness(response: string, context: string[]): number {
    // Build a Set of context words for O(1) lookup
    const contextWords = new Set<string>();
    for (const chunk of context) {
      const words = chunk.toLowerCase().split(/\s+/).filter(w => w.length > 4);
      words.forEach(w => contextWords.add(w));
    }

    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 20);
    if (sentences.length === 0) return 1;

    let groundedCount = 0;
    for (const sentence of sentences) {
      const words = sentence.toLowerCase().split(/\s+/).filter(w => w.length > 4);
      if (words.length === 0) {
        groundedCount++;  // Short sentences are considered grounded
        continue;
      }

      // O(1) lookup per word
      const matchCount = words.filter(w => contextWords.has(w)).length;
      if (matchCount >= words.length * 0.5) {
        groundedCount++;
      }
    }

    return groundedCount / sentences.length;
  }
}
```

---

## 4. Phase 6: Production Hardening (Weeks 14-15)

### 4.1 Redis Caching

> **Package:** ioredis ^5.9.2 (latest stable as of Feb 2026)

```typescript
// File: server/src/services/cache/RedisCache.ts

import Redis from 'ioredis';
import { createHash } from 'crypto';  // Use crypto for secure hashing

interface CacheConfig {
  url: string;
  ttlSeconds: number;
  maxMemoryMB: number;
  keyPrefix?: string;  // NEW: Namespace keys to avoid collisions
}

export class RedisCache {
  private client: Redis;
  private config: CacheConfig;

  constructor(config: CacheConfig) {
    this.config = {
      keyPrefix: 'rag:',
      ...config,
    };
    this.client = new Redis(config.url, {
      // Connection settings
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 50, 2000),
      // Enable offline queue for resilience
      enableOfflineQueue: true,
    });

    // Handle connection events
    this.client.on('error', (err) => console.error('Redis error:', err));
    this.client.on('connect', () => console.log('Redis connected'));
  }

  // Cache embeddings
  async getEmbedding(text: string, model: string): Promise<number[] | null> {
    const key = `emb:${model}:${this.hash(text)}`;
    const cached = await this.client.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async setEmbedding(text: string, model: string, embedding: number[]): Promise<void> {
    const key = `emb:${model}:${this.hash(text)}`;
    await this.client.setex(key, this.config.ttlSeconds, JSON.stringify(embedding));
  }

  // Cache search results
  async getSearchResults(query: string, params: string): Promise<any | null> {
    const key = `search:${this.hash(query + params)}`;
    const cached = await this.client.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async setSearchResults(query: string, params: string, results: any): Promise<void> {
    const key = `search:${this.hash(query + params)}`;
    await this.client.setex(key, 300, JSON.stringify(results)); // 5 min TTL
  }

  // Cache entity lookups
  async getEntities(texts: string[]): Promise<any[] | null> {
    const key = `entities:${this.hash(texts.join(','))}`;
    const cached = await this.client.get(key);
    return cached ? JSON.parse(cached) : null;
  }

  async setEntities(texts: string[], entities: any[]): Promise<void> {
    const key = `entities:${this.hash(texts.join(','))}`;
    await this.client.setex(key, 3600, JSON.stringify(entities)); // 1 hour TTL
  }

  /**
   * Cryptographically secure hash function.
   * Using SHA-256 prevents collisions that could occur with simple hashing.
   */
  private hash(text: string): string {
    return createHash('sha256')
      .update(text)
      .digest('hex')
      .substring(0, 16);  // Truncate to 16 chars for reasonable key length
  }

  async getStats(): Promise<{
    usedMemoryMB: number;
    hitRate: number;
    keys: number;
  }> {
    const info = await this.client.info('memory');
    const usedMemory = parseInt(info.match(/used_memory:(\d+)/)?.[1] || '0');

    const stats = await this.client.info('stats');
    const hits = parseInt(stats.match(/keyspace_hits:(\d+)/)?.[1] || '0');
    const misses = parseInt(stats.match(/keyspace_misses:(\d+)/)?.[1] || '0');

    const dbSize = await this.client.dbsize();

    return {
      usedMemoryMB: usedMemory / 1024 / 1024,
      hitRate: hits + misses > 0 ? hits / (hits + misses) : 0,
      keys: dbSize,
    };
  }

  async flush(): Promise<void> {
    await this.client.flushdb();
  }

  async close(): Promise<void> {
    await this.client.quit();
  }
}
```

### 4.2 Monitoring Dashboard Data

```typescript
// File: server/src/services/monitoring/MonitoringService.ts

import { DatabaseService } from '../DatabaseService';
import { TracingService } from '../observability/TracingService';
import { RedisCache } from '../cache/RedisCache';

interface DashboardMetrics {
  // Real-time
  currentQPS: number;
  avgLatencyLast5Min: number;
  errorRateLast5Min: number;

  // Daily
  totalQueries: number;
  avgLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  errorRate: number;

  // Quality
  avgPrecisionAt5: number;
  avgGroundedness: number;

  // By component
  componentLatencies: Record<string, number>;

  // System
  cacheHitRate: number;
  cacheMemoryMB: number;
}

export class MonitoringService {
  constructor(
    private db: DatabaseService,
    private tracingService: TracingService,
    private cache: RedisCache
  ) {}

  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const [traceStats, latencyStats, qualityStats, cacheStats] = await Promise.all([
      this.tracingService.getTraceStats(24),
      this.getLatencyStats(),
      this.getQualityStats(),
      this.cache.getStats(),
    ]);

    return {
      currentQPS: await this.getCurrentQPS(),
      avgLatencyLast5Min: await this.getAvgLatency(5),
      errorRateLast5Min: await this.getErrorRate(5),

      totalQueries: traceStats.totalTraces,
      avgLatency: traceStats.avgLatency,
      p50Latency: latencyStats.p50,
      p95Latency: traceStats.p95Latency,
      p99Latency: latencyStats.p99,
      errorRate: 1 - traceStats.successRate,

      avgPrecisionAt5: qualityStats.avgPrecision,
      avgGroundedness: qualityStats.avgGroundedness,

      componentLatencies: Object.fromEntries(
        Object.entries(traceStats.spanBreakdown).map(([k, v]) => [k, v.avgLatency])
      ),

      cacheHitRate: cacheStats.hitRate,
      cacheMemoryMB: cacheStats.usedMemoryMB,
    };
  }

  private async getCurrentQPS(): Promise<number> {
    const result = await this.db.query(
      `SELECT COUNT(*) / 60.0 as qps
       FROM rag_traces
       WHERE timestamp > NOW() - INTERVAL '1 minute'`
    );
    return parseFloat(result.rows[0]?.qps) || 0;
  }

  private async getAvgLatency(minutes: number): Promise<number> {
    const result = await this.db.query(
      `SELECT AVG(total_latency_ms) as avg
       FROM rag_traces
       WHERE timestamp > NOW() - INTERVAL '${minutes} minutes'`
    );
    return parseFloat(result.rows[0]?.avg) || 0;
  }

  private async getErrorRate(minutes: number): Promise<number> {
    const result = await this.db.query(
      `SELECT
         COUNT(*) FILTER (WHERE NOT success) * 1.0 / NULLIF(COUNT(*), 0) as rate
       FROM rag_traces
       WHERE timestamp > NOW() - INTERVAL '${minutes} minutes'`
    );
    return parseFloat(result.rows[0]?.rate) || 0;
  }

  private async getLatencyStats(): Promise<{ p50: number; p99: number }> {
    const result = await this.db.query(
      `SELECT
         PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY total_latency_ms) as p50,
         PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY total_latency_ms) as p99
       FROM rag_traces
       WHERE timestamp > NOW() - INTERVAL '24 hours'`
    );
    return {
      p50: parseFloat(result.rows[0]?.p50) || 0,
      p99: parseFloat(result.rows[0]?.p99) || 0,
    };
  }

  private async getQualityStats(): Promise<{ avgPrecision: number; avgGroundedness: number }> {
    const result = await this.db.query(
      `SELECT
         AVG(last_precision_at_5) as avg_precision,
         AVG(last_groundedness) as avg_groundedness
       FROM golden_dataset
       WHERE last_evaluated_at > NOW() - INTERVAL '7 days'`
    );
    return {
      avgPrecision: parseFloat(result.rows[0]?.avg_precision) || 0,
      avgGroundedness: parseFloat(result.rows[0]?.avg_groundedness) || 0,
    };
  }
}
```

### 4.3 Database Migrations

```sql
-- File: server/src/migrations/006_observability.sql

-- Traces table
CREATE TABLE rag_traces (
  id SERIAL PRIMARY KEY,
  trace_id UUID NOT NULL UNIQUE,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  user_id_hash VARCHAR(32) NOT NULL,
  session_id VARCHAR(100),
  query_length INTEGER NOT NULL,
  query_type VARCHAR(50),
  success BOOLEAN NOT NULL,
  total_latency_ms INTEGER NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  spans JSONB NOT NULL DEFAULT '[]'
);

CREATE INDEX idx_traces_timestamp ON rag_traces(timestamp DESC);
CREATE INDEX idx_traces_user ON rag_traces(user_id_hash);
CREATE INDEX idx_traces_success ON rag_traces(success);

-- Alerts table
CREATE TABLE monitoring_alerts (
  id SERIAL PRIMARY KEY,
  alert_type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_by UUID REFERENCES users(id),
  acknowledged_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Entity storage (for graph)
CREATE TABLE entities (
  id UUID PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  text TEXT NOT NULL,
  canonical_form TEXT NOT NULL,
  aliases TEXT[] DEFAULT '{}',
  confidence DECIMAL(4,3) NOT NULL,
  metadata JSONB,
  neo4j_synced BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_entities_type ON entities(type);
CREATE INDEX idx_entities_canonical ON entities(canonical_form);

-- Entity occurrences
CREATE TABLE entity_occurrences (
  id SERIAL PRIMARY KEY,
  entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  chunk_id TEXT NOT NULL,
  position INTEGER,
  context TEXT
);

CREATE INDEX idx_occurrences_entity ON entity_occurrences(entity_id);
CREATE INDEX idx_occurrences_document ON entity_occurrences(document_id);

-- Relationships
CREATE TABLE entity_relationships (
  id UUID PRIMARY KEY,
  source_entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  target_entity_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  confidence DECIMAL(4,3) NOT NULL,
  evidence TEXT,
  document_id UUID REFERENCES documents(id),
  extraction_method VARCHAR(20),
  neo4j_synced BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_relationships_source ON entity_relationships(source_entity_id);
CREATE INDEX idx_relationships_target ON entity_relationships(target_entity_id);
```

---

## 5. Implementation Checklist

### Phase 4: Knowledge Graph

- [x] Set up Neo4j 5.26 LTS (Docker) ✓ Deployed on Ubuntu 192.168.178.23
- [x] Verify APOC 5.26.x plugin loaded ✓ Verified
- [x] Create types: `server/src/types/graph.ts` ✓
- [x] Implement `EntityExtractor` ✓ server/src/services/graph/EntityExtractor.ts
- [x] Implement `EntityResolver` with semantic similarity ✓ server/src/services/graph/EntityResolver.ts
- [ ] Set up embedding service for entity resolution (optional - works without)
- [x] Implement `Neo4jService` (neo4j-driver 6.x) ✓ server/src/services/graph/Neo4jService.ts
- [x] Implement `GraphRefinement` ✓ server/src/services/graph/GraphRefinement.ts
- [ ] (Optional) Install GDS plugin for community detection
- [ ] (Optional) Implement `CommunityDetection`
- [x] Integrate into RAG pipeline ✓ RAGService.ts updated
- [x] Run migration `007_graph_entities.sql` ✓ Executed on PostgreSQL
- [ ] Extract entities from existing documents
- [ ] Evaluate multi-hop accuracy

### Phase 5: Query Intelligence & Observability

- [x] Implement `QueryRouter` ✓ server/src/services/rag/QueryRouter.ts
- [x] Implement `TracingService` with crypto hashing ✓ server/src/services/observability/TracingService.ts
- [x] Implement `InputGuardrails` ✓ server/src/services/guardrails/Guardrails.ts
- [x] Implement `OutputGuardrails` with optimized groundedness ✓ server/src/services/guardrails/Guardrails.ts
- [x] Integrate tracing into RAG pipeline ✓ RAGService.ts updated
- [x] Integrate guardrails into RAG pipeline ✓ RAGService.ts updated
- [ ] Create monitoring API endpoints
- [x] Test guardrails (no false positives) ✓ test-phase5-services.ts passed

### Phase 6: Production Hardening

- [x] Implement `RedisCache` (ioredis ^5.9.2) ✓ server/src/services/cache/RedisCache.ts
- [x] Verify SHA-256 hashing for cache keys ✓ Uses crypto.createHash('sha256')
- [x] Implement `MonitoringService` ✓ server/src/services/monitoring/MonitoringService.ts
- [x] Add caching to embedding generation ✓ RedisCache.getEmbedding/setEmbedding
- [x] Add caching to search results ✓ RedisCache.getSearchResults/setSearchResults
- [x] Create monitoring dashboard API ✓ server/src/routes/monitoring.ts
- [ ] Load testing (target: p95 < 800ms)
- [ ] Security review (secrets, SQL injection)
- [ ] Documentation
- [ ] Final evaluation run

---

## 6. Final Validation

### Success Metrics Check

```
After completing all phases, validate:

□ Multi-hop Accuracy ≥85%
  Run evaluation on multi_hop category queries

□ Entity Resolution ≥90% precision
  Manual review of merged entities

□ Query Routing ≥85% accuracy
  Test with categorized queries

□ p95 Latency <800ms
  Check monitoring dashboard

□ Error Rate <1%
  Check trace success rate

□ All Queries Traced
  Verify trace count matches query count

□ Cache Hit Rate >50%
  Check Redis stats after warm-up
```

### Final Evaluation Report

```
RAG V2 Final Evaluation
=======================

Comparison: V1 Baseline → V2 Final

| Metric          | V1      | V2      | Improvement |
|-----------------|---------|---------|-------------|
| Precision@5     | 60%     | 85%+    | +25%        |
| Recall@20       | 70%     | 90%+    | +20%        |
| Multi-hop       | 40%     | 85%+    | +45%        |
| Groundedness    | ?       | 95%+    | N/A         |
| p95 Latency     | 500ms   | <800ms  | OK          |
| Format Support  | 1       | 6+      | +5          |

Graph RAG Impact:
- Relational queries improved by X%
- Multi-hop queries improved by X%
- Entity coverage: X entities, X relationships

Observability:
- X% of queries traced
- Average latency breakdown by component
- Cache hit rate: X%
```

---

## 7. Rollback Plan

### If Issues Occur

1. **Graph Issues:**
   - Set `RAG_ENABLE_GRAPH=false`
   - System continues with hybrid search only

2. **Guardrails False Positives:**
   - Increase thresholds in config
   - Add admin bypass flag

3. **Performance Issues:**
   - Reduce cache TTL
   - Disable graph refinement
   - Reduce reranker candidates

4. **Complete Rollback:**
   - Deploy V1 code
   - Keep V2 data (compatible)
   - Re-evaluate issues

---

## 8. Post-Implementation

### Ongoing Tasks

1. **Golden Dataset Maintenance:**
   - Add new queries monthly
   - Update expected answers
   - Remove outdated queries

2. **Entity Graph Maintenance:**
   - Review merged entities
   - Add manual relationships
   - Clean up low-confidence entities

3. **Monitoring:**
   - Weekly quality reviews
   - Monthly performance reports
   - Alert response procedures

4. **User Feedback:**
   - Implement feedback mechanism
   - Track query satisfaction
   - Iterate on problem areas

---

**Spec Status:** Ready for Implementation
**Estimated Duration:** 8 weeks
**Dependencies:** Spec 1 + Spec 2
**Blocks:** None (Final spec)

---

## Summary

This is the final spec in the RAG V2 implementation series:

| Spec | Focus | Weeks | Key Deliverables |
|------|-------|-------|------------------|
| **1** | Foundation | 0-2 | Evaluation + Reranking |
| **2** | Documents | 3-7 | Multi-format + Chunking |
| **3** | Intelligence | 8-15 | Graph + Observability + Production |

After completing all three specs, you will have a production-ready RAG system with:
- 6+ document formats
- Semantic chunking with hierarchy
- Knowledge graph for relationships (Neo4j 5.26 LTS)
- **Semantic entity resolution** (embedding-based)
- **Community detection** (optional, for global queries)
- Query routing
- Full observability (crypto-secure hashing)
- Input/output guardrails (optimized groundedness)
- Caching and monitoring (ioredis 5.9.2)

---

## References

- [Neo4j Supported Versions](https://neo4j.com/developer/kb/neo4j-supported-versions/)
- [neo4j-driver 6.x npm](https://www.npmjs.com/package/neo4j-driver)
- [ioredis npm](https://www.npmjs.com/package/ioredis)
- [Microsoft GraphRAG](https://microsoft.github.io/graphrag/)
- [Semantic Entity Resolution](https://blog.graphlet.ai/the-rise-of-semantic-entity-resolution-45c48d5eb00a)
- [Neo4j APOC Documentation](https://neo4j.com/docs/apoc/current/)
