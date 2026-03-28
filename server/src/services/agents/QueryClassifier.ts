/**
 * QueryClassifier — Determines query complexity for hybrid agent pipeline.
 *
 * Pure synchronous heuristics (~0ms). Decides:
 * - simple: Answer with local model (Qwen) + pre-fetched RAG context
 * - complex: Delegate to cloud model (gpt-oss) with full tool autonomy
 *
 * Does NOT decide whether to use RAG — simple queries always get pre-search
 * unless skipPreSearch is true (translations, math, etc.)
 */

import type { ClassificationResult } from './types.js';

// ── Complex markers (regex) — multi-step tasks requiring tool autonomy ──

const COMPLEX_MARKERS = [
  'analysiere', 'vergleiche', 'erstelle.*bericht',
  'erstelle.*report', 'erstelle.*skill', 'fasse.*zusammen', 'risikobericht',
  'überblick über', 'zusammenhang zwischen',
  'zeitraum', 'entwicklung von', 'trend',
  'recherche', 'recherchiere', 'skill.*erstellen', 'skill.*bauen',
  'vertrag.*prüfen', 'vertrag.*analysieren', 'vertragsanalyse',
  'erstelle.*dokument', 'erstelle.*zusammenfassung',
  'vergleich.*zwischen', 'gegenüberstellung',
];

// ── Company keywords — indicate enterprise knowledge queries ──

const COMPANY_KEYWORDS = [
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

// ── Skip-pre-search markers — queries that don't need RAG ──

const SKIP_PRE_SEARCH_MARKERS = [
  'übersetze', 'übersetz', 'translate',
  'berechne', 'rechne', 'konvertiere',
  'was ist ein', 'was ist eine', 'was sind',
  'definiere', 'definition von',
  'wie funktioniert',             // generic "how does X work"
  'schreibe mir eine email',
  'schreibe mir eine nachricht',
  'formuliere',
];

/**
 * Classify a query as simple or complex.
 * Simple queries get pre-fetched RAG context + local model.
 * Complex queries go to cloud model with tool autonomy.
 */
export function classify(query: string): ClassificationResult {
  const lower = query.toLowerCase();

  // 1. Check for complex patterns (regex) — these need cloud model with tools
  for (const pattern of COMPLEX_MARKERS) {
    if (new RegExp(pattern, 'i').test(lower)) {
      return {
        complexity: 'complex',
        skipPreSearch: false,
        reason: `Komplexitäts-Marker: "${pattern}"`,
      };
    }
  }

  // 2. Long queries with company keywords → likely complex
  if (lower.length > 200 && COMPANY_KEYWORDS.some(k => lower.includes(k))) {
    return {
      complexity: 'complex',
      skipPreSearch: false,
      reason: 'Lange Query mit Firmenbezug',
    };
  }

  // 3. Check for skip-pre-search markers (translations, math, definitions)
  //    Only skip if there's no company reference
  const hasCompanyRef = COMPANY_KEYWORDS.some(k => lower.includes(k));
  if (!hasCompanyRef) {
    for (const marker of SKIP_PRE_SEARCH_MARKERS) {
      if (lower.includes(marker)) {
        return {
          complexity: 'simple',
          skipPreSearch: true,
          reason: `Kein RAG nötig: "${marker}"`,
        };
      }
    }
  }

  // 4. Default: simple with pre-search
  //    The search-first pipeline will provide RAG context automatically
  return {
    complexity: 'simple',
    skipPreSearch: false,
    reason: 'Standard (Pre-Search + lokales Modell)',
  };
}

// Singleton-style export for consistency with QueryRouter
export const queryClassifier = { classify };
