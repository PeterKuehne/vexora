/**
 * Graph Refinement Service
 * Part of RAG V2 Phase 4: Intelligence & Production
 *
 * Post-query graph traversal to enrich RAG results with
 * related entities and their associated chunks.
 */

import { Neo4jService } from './Neo4jService.js';
import {
  GraphTraversalResult,
  RefinementRequest,
  RefinedResult,
} from '../../types/graph.js';

export interface GraphRefinementConfig {
  enabled: boolean;
  defaultMaxDepth: number;
  defaultMaxNodes: number;
  minEntitiesForGraph: number;
  minChunkScoreForEntityExtraction: number;
}

export const DEFAULT_GRAPH_REFINEMENT_CONFIG: GraphRefinementConfig = {
  enabled: true,
  defaultMaxDepth: 2,
  defaultMaxNodes: 50,
  minEntitiesForGraph: 1,
  minChunkScoreForEntityExtraction: 0.5,
};

export class GraphRefinement {
  private config: GraphRefinementConfig;

  constructor(
    private neo4jService: Neo4jService,
    config: Partial<GraphRefinementConfig> = {}
  ) {
    this.config = { ...DEFAULT_GRAPH_REFINEMENT_CONFIG, ...config };
  }

  /**
   * Refine RAG results by traversing the knowledge graph
   */
  async refine(request: RefinementRequest): Promise<RefinedResult> {
    if (!this.config.enabled) {
      return {
        additionalChunkIds: [],
        graphContext: { nodes: [], edges: [], chunkIds: [], naturalLanguageSummary: '' },
        shouldUseGraph: false,
      };
    }

    // 1. Extract entities from top chunks
    const chunkEntities = this.extractEntitiesFromChunks(
      request.topChunks.filter((c) => c.score >= this.config.minChunkScoreForEntityExtraction)
    );

    // 2. Combine with query entities
    const allEntities = [...new Set([...request.queryEntities, ...chunkEntities])];

    if (allEntities.length < this.config.minEntitiesForGraph) {
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
      maxDepth: request.maxDepth || this.config.defaultMaxDepth,
      maxNodes: request.maxNodes || this.config.defaultMaxNodes,
    });

    // 4. Find additional chunks not in original results
    const existingChunkIds = new Set(request.topChunks.map((c) => c.id));
    const additionalChunkIds = graphResult.chunkIds.filter((id) => !existingChunkIds.has(id));

    // 5. Determine if graph context is useful
    const shouldUseGraph =
      graphResult.nodes.length > 2 ||
      additionalChunkIds.length > 0 ||
      request.queryEntities.length > 1;

    return {
      additionalChunkIds,
      graphContext: graphResult,
      shouldUseGraph,
    };
  }

  /**
   * Extract entities from chunks (simple extraction for refinement)
   */
  private extractEntitiesFromChunks(
    chunks: Array<{ content: string }>
  ): string[] {
    const entities: string[] = [];

    // Simple extraction - look for capitalized phrases (potential entities)
    for (const chunk of chunks) {
      // German/English capitalized phrases
      const matches = chunk.content.match(
        /[A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)+/g
      );
      if (matches) {
        entities.push(...matches);
      }

      // Look for quoted terms
      const quoted = chunk.content.match(/"([^"]+)"/g);
      if (quoted) {
        entities.push(...quoted.map((q) => q.replace(/"/g, '')));
      }

      // Look for terms in backticks (code/technical terms)
      const backticked = chunk.content.match(/`([^`]+)`/g);
      if (backticked) {
        entities.push(...backticked.map((b) => b.replace(/`/g, '')));
      }
    }

    // Deduplicate and filter
    return [...new Set(entities)].filter(
      (e) => e.length >= 3 && e.length <= 50
    );
  }

  /**
   * Build context string from graph traversal result
   */
  buildGraphContext(result: GraphTraversalResult): string {
    if (result.nodes.length === 0) {
      return '';
    }

    const lines: string[] = ['### Verwandte Informationen aus dem Wissensgraph:\n'];

    // Group nodes by type
    const nodesByType = new Map<string, typeof result.nodes>();
    for (const node of result.nodes) {
      const type = node.labels.find((l) => l !== 'Entity') || 'Unknown';
      const group = nodesByType.get(type) || [];
      group.push(node);
      nodesByType.set(type, group);
    }

    // Format each type group
    for (const [type, nodes] of nodesByType) {
      if (type === 'Chunk' || type === 'Document') continue;

      lines.push(`**${this.translateType(type)}:**`);
      for (const node of nodes.slice(0, 5)) {
        const text = (node.properties.text as string) || node.id;
        lines.push(`- ${text}`);
      }
      lines.push('');
    }

    // Format relationships
    if (result.edges.length > 0) {
      lines.push('**Beziehungen:**');
      const seenRelations = new Set<string>();

      for (const edge of result.edges.slice(0, 10)) {
        const sourceNode = result.nodes.find(
          (n) => n.id === edge.sourceId || n.properties?.id === edge.sourceId
        );
        const targetNode = result.nodes.find(
          (n) => n.id === edge.targetId || n.properties?.id === edge.targetId
        );

        if (sourceNode && targetNode) {
          const sourceText = (sourceNode.properties.text as string) || sourceNode.id;
          const targetText = (targetNode.properties.text as string) || targetNode.id;
          const relText = `${sourceText} → ${this.translateRelation(edge.type)} → ${targetText}`;

          if (!seenRelations.has(relText)) {
            lines.push(`- ${relText}`);
            seenRelations.add(relText);
          }
        }
      }
    }

    return lines.join('\n');
  }

  /**
   * Translate entity type to German
   */
  private translateType(type: string): string {
    const translations: Record<string, string> = {
      PERSON: 'Personen',
      ORGANIZATION: 'Organisationen',
      PROJECT: 'Projekte',
      PRODUCT: 'Produkte',
      DOCUMENT: 'Dokumente',
      TOPIC: 'Themen',
      LOCATION: 'Orte',
      DATE: 'Daten',
      REGULATION: 'Vorschriften',
    };
    return translations[type] || type;
  }

  /**
   * Translate relationship type to German
   */
  private translateRelation(type: string): string {
    const translations: Record<string, string> = {
      WORKS_FOR: 'arbeitet für',
      MANAGES: 'leitet',
      CREATED: 'erstellt',
      MENTIONS: 'erwähnt',
      REFERENCES: 'referenziert',
      ABOUT: 'handelt von',
      PART_OF: 'gehört zu',
      REPORTS_TO: 'berichtet an',
      COLLABORATES_WITH: 'arbeitet zusammen mit',
      APPROVED_BY: 'genehmigt von',
      MENTIONED_IN: 'erwähnt in',
    };
    return translations[type] || type;
  }

  /**
   * Check if graph refinement should be used for a query
   */
  shouldUseGraphRefinement(query: string, entityCount: number): boolean {
    if (!this.config.enabled) return false;

    // Multi-hop indicators
    const multiHopIndicators = [
      /wer.*das.*projekt.*leitet/i,
      /welche.*dokumente.*von.*erstellt/i,
      /alle.*die.*arbeiten/i,
      /.*und dessen.*/i,
      /.*die.*wiederum.*/i,
      /verbunden mit/i,
      /im zusammenhang mit/i,
      /beziehung zwischen/i,
      /zusammenhang/i,
    ];

    const isMultiHop = multiHopIndicators.some((p) => p.test(query));
    const hasMultipleEntities = entityCount > 1;

    return isMultiHop || hasMultipleEntities;
  }
}
