/**
 * Query Router Service
 * Part of RAG V2 Phase 5: Query Intelligence & Observability
 *
 * Analyzes queries and selects optimal retrieval strategy
 */

import type { ChunkLevel } from '../../types/chunking.js';

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
  // NEW: Recommended level filter based on query type
  recommendedLevelFilter: ChunkLevel[];
}

export interface QueryRouterConfig {
  enableGraph: boolean;
  enableTableFocus: boolean;
  defaultStrategy: RetrievalStrategy;
}

const DEFAULT_CONFIG: QueryRouterConfig = {
  enableGraph: true,
  enableTableFocus: true,
  defaultStrategy: 'hybrid',
};

export class QueryRouter {
  private queryTypePatterns: Map<QueryType, RegExp[]>;
  private config: QueryRouterConfig;

  constructor(config: Partial<QueryRouterConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.queryTypePatterns = this.initializePatterns();
  }

  /**
   * Analyze a query and determine optimal retrieval strategy
   */
  analyze(query: string): QueryAnalysis {
    // 1. Classify query type
    const queryType = this.classifyQueryType(query);

    // 2. Extract entities
    const entities = this.extractQueryEntities(query);

    // 3. Detect multi-hop indicators
    const isMultiHop = this.detectMultiHop(query);

    // 4. Detect table need
    const requiresTable = this.config.enableTableFocus && this.detectTableNeed(query);

    // 5. Determine if graph is needed
    const requiresGraph = this.config.enableGraph && (
      isMultiHop ||
      entities.length > 1 ||
      queryType === 'relational'
    );

    // 6. Select strategy
    const suggestedStrategy = this.selectStrategy(queryType, requiresGraph, requiresTable);

    // 7. Calculate confidence
    const confidence = this.calculateConfidence(query, queryType);

    // 8. Determine recommended level filter based on query type
    const recommendedLevelFilter = this.getLevelFilterForQueryType(queryType, isMultiHop);

    return {
      queryType,
      entities,
      isMultiHop,
      requiresGraph,
      requiresTable,
      suggestedStrategy,
      confidence,
      recommendedLevelFilter,
    };
  }

  /**
   * Get recommended level filter based on query type
   * Level 0: Document summary
   * Level 1: Section summaries
   * Level 2: Paragraph-level chunks
   */
  private getLevelFilterForQueryType(queryType: QueryType, isMultiHop: boolean): ChunkLevel[] {
    // For overview/aggregation questions, include all levels
    if (queryType === 'aggregative') {
      return [0, 1, 2] as ChunkLevel[];
    }

    // For multi-hop or relational queries, include sections for context
    if (isMultiHop || queryType === 'relational') {
      return [1, 2] as ChunkLevel[];
    }

    // For comparative questions, sections help with structure
    if (queryType === 'comparative') {
      return [1, 2] as ChunkLevel[];
    }

    // For procedural questions (how-to), sections + paragraphs
    if (queryType === 'procedural') {
      return [1, 2] as ChunkLevel[];
    }

    // For factual and temporal questions, paragraph-level is usually sufficient
    // But include sections for better context
    return [1, 2] as ChunkLevel[];
  }

  /**
   * Initialize German language patterns for query classification
   */
  private initializePatterns(): Map<QueryType, RegExp[]> {
    return new Map([
      ['factual', [
        /was ist/i,
        /wer ist/i,
        /wo ist/i,
        /wann (wurde|ist|war)/i,
        /wie (heißt|lautet)/i,
        /welch(e|er|es)\s+\w+\s+ist/i,
        /definier/i,
        /erkläre?/i,
      ]],
      ['comparative', [
        /vergleich/i,
        /unterschied/i,
        /vs\.?/i,
        /im gegensatz/i,
        /besser als/i,
        /mehr als/i,
        /weniger als/i,
        /ähnlich wie/i,
        /gegenüberstellung/i,
      ]],
      ['procedural', [
        /wie (kann|mache|erstelle|beantrage|funktioniert)/i,
        /anleitung/i,
        /schritt/i,
        /prozess/i,
        /vorgehen/i,
        /ablauf/i,
        /workflow/i,
        /tutorial/i,
      ]],
      ['relational', [
        /wer (arbeitet|ist.*verantwortlich|leitet|gehört)/i,
        /welche.*abteilung/i,
        /zuständig/i,
        /berichtet an/i,
        /gehört zu/i,
        /verbunden mit/i,
        /zusammenhang/i,
        /beziehung zwischen/i,
      ]],
      ['aggregative', [
        /liste/i,
        /alle/i,
        /wie viele/i,
        /aufzählung/i,
        /übersicht/i,
        /zusammenfassung/i,
        /anzahl/i,
        /gesamt/i,
      ]],
      ['temporal', [
        /wann/i,
        /seit wann/i,
        /bis wann/i,
        /deadline/i,
        /zeitraum/i,
        /frist/i,
        /datum/i,
        /termin/i,
        /zeitlich/i,
      ]],
    ]);
  }

  /**
   * Classify query type based on patterns
   */
  private classifyQueryType(query: string): QueryType {
    const scores: Map<QueryType, number> = new Map();

    for (const [type, patterns] of this.queryTypePatterns) {
      const matchCount = patterns.filter(p => p.test(query)).length;
      if (matchCount > 0) {
        scores.set(type, matchCount);
      }
    }

    if (scores.size === 0) {
      return 'factual'; // Default
    }

    // Return type with highest score
    let maxType: QueryType = 'factual';
    let maxScore = 0;
    for (const [type, score] of scores) {
      if (score > maxScore) {
        maxScore = score;
        maxType = type;
      }
    }

    return maxType;
  }

  /**
   * Extract potential entities from query
   */
  private extractQueryEntities(query: string): string[] {
    const entities: string[] = [];

    // Look for capitalized phrases (potential entities)
    const capitalizedMatches = query.match(/[A-ZÄÖÜ][a-zäöüß]+(?:\s+[A-ZÄÖÜ][a-zäöüß]+)*/g);
    if (capitalizedMatches) {
      entities.push(...capitalizedMatches);
    }

    // Look for quoted terms
    const quotedMatches = query.match(/"([^"]+)"/g);
    if (quotedMatches) {
      entities.push(...quotedMatches.map(q => q.replace(/"/g, '')));
    }

    // Look for German company patterns
    const companyMatches = query.match(/[A-ZÄÖÜ][a-zäöüß]*(?:\s+[A-ZÄÖÜ][a-zäöüß]*)*\s+(?:GmbH|AG|KG|e\.V\.)/g);
    if (companyMatches) {
      entities.push(...companyMatches);
    }

    // Look for project patterns
    const projectMatches = query.match(/Projekt\s+[A-Za-zÄÖÜäöüß\-]+/gi);
    if (projectMatches) {
      entities.push(...projectMatches);
    }

    return [...new Set(entities)];
  }

  /**
   * Detect if query requires multi-hop reasoning
   */
  private detectMultiHop(query: string): boolean {
    const multiHopIndicators = [
      /wer.*das.*projekt.*leitet/i,
      /welche.*dokumente.*von.*erstellt/i,
      /alle.*die.*arbeiten/i,
      /.*und dessen.*/i,
      /.*die.*wiederum.*/i,
      /verbunden mit/i,
      /im zusammenhang mit/i,
      /über.*hinweg/i,
      /durch.*verknüpft/i,
      /indirekt/i,
      /transitiv/i,
    ];

    return multiHopIndicators.some(p => p.test(query));
  }

  /**
   * Detect if query likely needs table data
   */
  private detectTableNeed(query: string): boolean {
    const tableIndicators = [
      /tabelle/i,
      /liste.*mit/i,
      /übersicht/i,
      /vergleich/i,
      /alle.*aufgelistet/i,
      /prozent|%/i,
      /zahlen|daten/i,
      /statistik/i,
      /kennzahl/i,
      /budget/i,
      /kosten/i,
      /umsatz/i,
    ];

    return tableIndicators.some(p => p.test(query));
  }

  /**
   * Select optimal retrieval strategy
   */
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

    // Simple factual queries can use vector only
    if (queryType === 'factual') {
      return 'hybrid';
    }

    return this.config.defaultStrategy;
  }

  /**
   * Calculate confidence in query classification
   */
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

    // Penalty for very short queries
    if (query.length < 20) confidence -= 0.1;

    // Penalty for question words only
    if (query.split(/\s+/).length < 4) confidence -= 0.1;

    return Math.max(0.3, Math.min(1, confidence));
  }

  /**
   * Get strategy description for logging
   */
  getStrategyDescription(strategy: RetrievalStrategy): string {
    const descriptions: Record<RetrievalStrategy, string> = {
      vector_only: 'Vector similarity search only',
      hybrid: 'Hybrid search (vector + keyword)',
      hybrid_with_graph: 'Hybrid search with knowledge graph traversal',
      table_focused: 'Focus on table/structured data',
      multi_index: 'Search across multiple indices',
    };
    return descriptions[strategy];
  }
}

export const queryRouter = new QueryRouter();
