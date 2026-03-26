/**
 * QueryRouter - Cascading 3-stage query classification
 *
 * Determines whether a query needs RAG (knowledge base) or can be answered directly,
 * and whether to use a local or cloud model.
 *
 * Stage 1: Keyword heuristics (0ms, no GPU)
 * Stage 2: Embedding similarity against KB (10ms, local)
 * Stage 3: LLM classification (200ms, local — fallback only)
 */

import { env } from '../../config/env.js';

export interface RoutingResult {
  route: 'direct' | 'rag' | 'rag-complex';
  model: 'local' | 'cloud';
  confidence: number;
  reason: string;
}

// ── Stage 1: Keyword Heuristics ──

/** German words/phrases indicating company-internal knowledge */
const RAG_KEYWORDS = [
  'unser', 'unsere', 'unserem', 'unseren',
  'vertrag', 'verträge', 'vertragsbedingung',
  'mitarbeiter', 'kollege', 'kollegin', 'ansprechpartner',
  'abteilung', 'team',
  'kunde', 'kunden', 'kundeneinrichtung',
  'einsatz', 'einsätze', 'einsatzplan',
  'gehalt', 'vergütung', 'stundenlohn',
  'quartal', 'quartalszahlen', 'umsatz', 'bilanz',
  'richtlinie', 'policy', 'regelung', 'vorschrift',
  'protokoll', 'bericht', 'report',
  'dokument', 'datei', 'upload',
  'samaritano', 'cor7ex',
];

/** Phrases indicating complex multi-step analysis */
const COMPLEX_MARKERS = [
  'analysiere', 'vergleiche', 'erstelle.*bericht',
  'erstelle.*report', 'erstelle.*skill', 'fasse.*zusammen', 'risikobericht',
  'überblick über', 'zusammenhang zwischen',
  'zeitraum', 'entwicklung von', 'trend',
  'recherche', 'recherchiere', 'skill.*erstellen', 'skill.*bauen',
  'vertrag.*prüfen', 'vertrag.*analysieren', 'vertragsanalyse',
];

/** Phrases indicating direct answering (no RAG needed) */
const DIRECT_MARKERS = [
  'was ist ein', 'was ist eine', 'was sind',
  'erkläre', 'erklär mir', 'definiere', 'definition von',
  'wie funktioniert', 'was bedeutet',
  'schreibe', 'formuliere', 'übersetze', 'übersetz',
  'berechne', 'rechne', 'konvertiere',
  'hilf mir', 'kannst du',
];

function heuristicRoute(query: string): RoutingResult | null {
  const lower = query.toLowerCase();

  // Check for complex patterns first (regex)
  for (const pattern of COMPLEX_MARKERS) {
    if (new RegExp(pattern, 'i').test(lower)) {
      return { route: 'rag-complex', model: 'cloud', confidence: 0.8, reason: `Komplexitäts-Marker: "${pattern}"` };
    }
  }

  // Long queries with company keywords → likely complex
  if (lower.length > 200 && RAG_KEYWORDS.some(k => lower.includes(k))) {
    return { route: 'rag-complex', model: 'cloud', confidence: 0.7, reason: 'Lange Query mit Firmenbezug' };
  }

  // Direct answer patterns
  for (const marker of DIRECT_MARKERS) {
    if (lower.includes(marker)) {
      // Unless it also mentions company-specific terms
      const hasCompanyRef = RAG_KEYWORDS.some(k => lower.includes(k));
      if (!hasCompanyRef) {
        return { route: 'direct', model: 'local', confidence: 0.85, reason: `Direkt-Marker: "${marker}"` };
      }
    }
  }

  // Company-specific keywords → RAG
  const matchedKeywords = RAG_KEYWORDS.filter(k => lower.includes(k));
  if (matchedKeywords.length >= 2) {
    return { route: 'rag', model: 'local', confidence: 0.85, reason: `Firmenbezug: ${matchedKeywords.slice(0, 3).join(', ')}` };
  }
  if (matchedKeywords.length === 1) {
    return { route: 'rag', model: 'local', confidence: 0.65, reason: `Firmenbezug: ${matchedKeywords[0]}` };
  }

  return null; // Unclear → proceed to Stage 2
}

// ── Stage 2: Embedding Similarity ──

async function embeddingRoute(query: string): Promise<RoutingResult | null> {
  try {
    // Use the existing Weaviate vector search to check if KB has relevant content
    const { default: weaviate } = await import('weaviate-client');
    const client = await weaviate.connectToLocal({
      host: new URL(env.WEAVIATE_URL).hostname,
      port: parseInt(new URL(env.WEAVIATE_URL).port) || 8080,
      grpcPort: 50051,
    });

    const collection = client.collections.get('DocumentChunksV2');
    const result = await collection.query.nearText(query, {
      limit: 1,
      returnMetadata: ['distance'],
    });

    await client.close();

    if (result.objects.length === 0) {
      return { route: 'direct', model: 'local', confidence: 0.6, reason: 'Keine KB-Treffer' };
    }

    const distance = result.objects[0]?.metadata?.distance ?? 1.0;
    // Weaviate distance: 0 = identical, 2 = opposite. Convert to similarity.
    const similarity = 1 - (distance / 2);

    if (similarity > env.ROUTING_EMBEDDING_THRESHOLD) {
      return { route: 'rag', model: 'local', confidence: similarity, reason: `KB-Similarity: ${similarity.toFixed(2)}` };
    }
    if (similarity < 0.3) {
      return { route: 'direct', model: 'local', confidence: 0.7, reason: `KB-Similarity gering: ${similarity.toFixed(2)}` };
    }

    return null; // Ambiguous → Stage 3
  } catch (error) {
    console.warn('[QueryRouter] Embedding check failed, skipping:', (error as Error).message);
    return null;
  }
}

// ── Public API ──

export class QueryRouter {
  /**
   * Route a query through the cascade: Heuristic → Embedding → Default.
   * Stage 3 (LLM classification) is deferred — default to RAG for ambiguous queries.
   */
  async route(query: string): Promise<RoutingResult> {
    // Stage 1: Keyword heuristics
    const heuristic = heuristicRoute(query);
    if (heuristic && heuristic.confidence >= 0.7) {
      console.log(`[QueryRouter] Stage 1 (heuristic): ${heuristic.route}/${heuristic.model} — ${heuristic.reason}`);
      return heuristic;
    }

    // Stage 2: Embedding similarity
    const embedding = await embeddingRoute(query);
    if (embedding) {
      console.log(`[QueryRouter] Stage 2 (embedding): ${embedding.route}/${embedding.model} — ${embedding.reason}`);
      return embedding;
    }

    // Default: search locally (safer than direct — might miss relevant docs)
    const fallback: RoutingResult = {
      route: 'rag',
      model: 'local',
      confidence: 0.5,
      reason: 'Default (ambiguous query)',
    };
    console.log(`[QueryRouter] Fallback: ${fallback.route}/${fallback.model}`);
    return fallback;
  }
}

export const queryRouter = new QueryRouter();
