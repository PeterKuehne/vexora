/**
 * Intent Detection for Intelligent RAG Activation
 *
 * Determines whether a user query is:
 * - Smalltalk: General conversation that doesn't need document search
 * - Business: Company-specific questions that benefit from RAG
 */

export interface IntentAnalysis {
  /** Type of intent detected */
  intent: 'smalltalk' | 'business' | 'ambiguous';
  /** Confidence score 0-1 */
  confidence: number;
  /** Reasoning for intent classification */
  reasoning?: string;
  /** Whether RAG should be activated for this query */
  shouldActivateRAG: boolean;
}

// Smalltalk patterns - queries that don't need document search
const SMALLTALK_PATTERNS = [
  // Greetings
  /^(hi|hello|hey|hallo|guten\s+(tag|morgen|abend)|moin|servus)\b/i,
  // How are you
  /(wie\s+geht'?s?|how\s+are\s+you|was\s+machst\s+du)/i,
  // Weather talk
  /(wetter|weather|regen|rain|sonne|sun)/i,
  // General questions about AI/assistant
  /(wer\s+bist\s+du|who\s+are\s+you|was\s+kannst\s+du|what\s+can\s+you)/i,
  // Small talk about time
  /(welcher\s+tag|what\s+day|wie\s+spät|what\s+time)/i,
  // Thank you / goodbye
  /(danke|thank\s+you|tschüss|bye|auf\s+wiedersehen)/i,
  // Math or general knowledge
  /(rechne|calculate|was\s+ist\s+\d+|what\s+is\s+\d+)/i,
];

// Business/Company patterns - queries that likely need document search
const BUSINESS_PATTERNS = [
  // Company-specific terms
  /(unser(e|en?)|our\s+(company|strategy|policy|process))/i,
  // Business processes
  /(workflow|prozess|verfahren|procedure|policy|richtlinie)/i,
  // Strategy and planning
  /(strategie|strategy|planning|planung|ziel|goal)/i,
  // Pricing and costs
  /(preis|pricing|kosten|cost|budget|finanz)/i,
  // Products and services
  /(produkt|product|service|dienstleistung|angebot|offer)/i,
  // Team and organization
  /(team|mitarbeiter|employee|abteilung|department|rolle|role)/i,
  // Documents and reports
  /(dokument|document|bericht|report|analyse|analysis)/i,
  // Company policies
  /(richtlinie|guideline|regel|rule|compliance|vorschrift)/i,
  // Customer-related
  /(kunde|customer|client|klient|support|service)/i,
  // Project-related
  /(projekt|project|milestone|deadline|termin)/i,
];

// Keywords that indicate document search might be helpful
const DOCUMENT_KEYWORDS = [
  'erkläre', 'explain', 'wie', 'how', 'was ist', 'what is',
  'beschreibe', 'describe', 'zeige', 'show', 'beispiel', 'example',
  'details', 'übersicht', 'overview', 'zusammenfassung', 'summary'
];

/**
 * Analyze user query to determine intent and RAG activation recommendation
 */
export function analyzeIntent(query: string): IntentAnalysis {
  if (!query || query.trim().length === 0) {
    return {
      intent: 'ambiguous',
      confidence: 0,
      reasoning: 'Empty query',
      shouldActivateRAG: false
    };
  }

  const normalizedQuery = query.trim().toLowerCase();

  // Check for smalltalk patterns
  const smalltalkMatches = SMALLTALK_PATTERNS.filter(pattern =>
    pattern.test(normalizedQuery)
  );

  // Check for business patterns
  const businessMatches = BUSINESS_PATTERNS.filter(pattern =>
    pattern.test(normalizedQuery)
  );

  // Check for document-search-helpful keywords
  const documentKeywordMatches = DOCUMENT_KEYWORDS.filter(keyword =>
    normalizedQuery.includes(keyword.toLowerCase())
  );

  // Simple heuristic scoring
  let smalltalkScore = smalltalkMatches.length;
  let businessScore = businessMatches.length + (documentKeywordMatches.length * 0.5);

  // Boost business score for longer queries (more likely to be specific questions)
  if (normalizedQuery.length > 50) {
    businessScore += 0.5;
  }

  // Boost smalltalk score for very short queries
  if (normalizedQuery.length < 10) {
    smalltalkScore += 0.5;
  }

  // Determine intent based on scores
  let intent: 'smalltalk' | 'business' | 'ambiguous';
  let confidence: number;
  let shouldActivateRAG: boolean;
  let reasoning: string;

  if (smalltalkScore > businessScore && smalltalkScore > 0) {
    intent = 'smalltalk';
    confidence = Math.min(smalltalkScore / 2, 1); // Normalize to 0-1
    shouldActivateRAG = false;
    reasoning = `Detected smalltalk patterns: ${smalltalkMatches.length}`;
  } else if (businessScore > smalltalkScore && businessScore > 0) {
    intent = 'business';
    confidence = Math.min(businessScore / 2, 1); // Normalize to 0-1
    shouldActivateRAG = true;
    reasoning = `Detected business patterns: ${businessMatches.length}, document keywords: ${documentKeywordMatches.length}`;
  } else {
    intent = 'ambiguous';
    confidence = 0.5;
    // Default to RAG for ambiguous cases - better to have too much info than too little
    shouldActivateRAG = true;
    reasoning = 'Ambiguous query, defaulting to RAG activation for safety';
  }

  return {
    intent,
    confidence,
    reasoning,
    shouldActivateRAG
  };
}

/**
 * Quick check if a query should activate RAG
 * Convenience function for simple use cases
 */
export function shouldActivateRAG(query: string): boolean {
  const analysis = analyzeIntent(query);
  return analysis.shouldActivateRAG;
}