/**
 * Guardrails Service
 * Part of RAG V2 Phase 5: Query Intelligence & Observability
 *
 * Input validation, output validation, and safety checks
 */

export interface InputGuardrailsConfig {
  maxQueryLength: number;
  minQueryLength: number;
  blockedPatterns: RegExp[];
  maxQueriesPerMinute: number;
  enabled: boolean;
}

export interface OutputGuardrailsConfig {
  maxResponseLength: number;
  requireCitations: boolean;
  groundednessThreshold: number;
  blockedContentPatterns: RegExp[];
  enabled: boolean;
}

export interface InputValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  sanitizedQuery: string;
  rateLimited: boolean;
}

export interface OutputValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  finalResponse: string;
  groundedness: number;
  hasCitations: boolean;
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
    /javascript:/i,
    /data:.*base64/i,
    /eval\s*\(/i,
  ],
  maxQueriesPerMinute: 30,
  enabled: true,
};

const DEFAULT_OUTPUT_CONFIG: OutputGuardrailsConfig = {
  maxResponseLength: 4000,
  requireCitations: true,
  groundednessThreshold: 0.7,
  blockedContentPatterns: [
    /password.*(?:is|=|:)\s*.{3,}/i,
    /api[_-]?key.*(?:is|=|:)\s*.{10,}/i,
    /secret.*(?:is|=|:)\s*.{5,}/i,
    /token.*(?:is|=|:)\s*[A-Za-z0-9]{20,}/i,
    /private[_-]?key/i,
  ],
  enabled: true,
};

export class InputGuardrails {
  private rateLimits = new Map<string, number[]>();
  private config: InputGuardrailsConfig;

  constructor(config: Partial<InputGuardrailsConfig> = {}) {
    this.config = { ...DEFAULT_INPUT_CONFIG, ...config };
  }

  /**
   * Validate and sanitize input query
   */
  validate(query: string, userId: string): InputValidationResult {
    if (!this.config.enabled) {
      return {
        valid: true,
        errors: [],
        warnings: [],
        sanitizedQuery: query,
        rateLimited: false,
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    let rateLimited = false;

    // Length checks
    if (query.length > this.config.maxQueryLength) {
      errors.push(`Anfrage überschreitet ${this.config.maxQueryLength} Zeichen`);
    }
    if (query.length < this.config.minQueryLength) {
      errors.push(`Anfrage ist zu kurz (mindestens ${this.config.minQueryLength} Zeichen)`);
    }

    // Blocked patterns check
    for (const pattern of this.config.blockedPatterns) {
      if (pattern.test(query)) {
        errors.push('Anfrage enthält nicht erlaubte Inhalte');
        break;
      }
    }

    // Rate limiting
    if (!this.checkRateLimit(userId)) {
      errors.push('Rate Limit überschritten. Bitte warten Sie einen Moment.');
      rateLimited = true;
    }

    // Sanitize query
    const sanitizedQuery = this.sanitize(query);

    // Warning for potentially problematic queries
    if (this.detectPotentialInjection(query)) {
      warnings.push('Anfrage enthält ungewöhnliche Muster');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      sanitizedQuery,
      rateLimited,
    };
  }

  /**
   * Check rate limit for user
   */
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

    // Cleanup old entries periodically
    if (this.rateLimits.size > 10000) {
      this.cleanupRateLimits();
    }

    return true;
  }

  /**
   * Cleanup old rate limit entries
   */
  private cleanupRateLimits(): void {
    const now = Date.now();
    const windowMs = 60000;

    for (const [userId, timestamps] of this.rateLimits) {
      const recent = timestamps.filter(t => now - t < windowMs);
      if (recent.length === 0) {
        this.rateLimits.delete(userId);
      } else {
        this.rateLimits.set(userId, recent);
      }
    }
  }

  /**
   * Sanitize query by removing potentially harmful content
   */
  private sanitize(query: string): string {
    return query
      .trim()
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ')    // Normalize whitespace
      .replace(/[\x00-\x1F\x7F]/g, ''); // Remove control characters
  }

  /**
   * Detect potential prompt injection attempts
   */
  private detectPotentialInjection(query: string): boolean {
    const injectionPatterns = [
      /\[INST\]/i,
      /\[\/INST\]/i,
      /<<SYS>>/i,
      /<<\/SYS>>/i,
      /Human:/i,
      /Assistant:/i,
      /\bsystem\b.*\bprompt\b/i,
    ];

    return injectionPatterns.some(p => p.test(query));
  }

  /**
   * Reset rate limits (for testing)
   */
  resetRateLimits(): void {
    this.rateLimits.clear();
  }
}

export class OutputGuardrails {
  private config: OutputGuardrailsConfig;

  constructor(config: Partial<OutputGuardrailsConfig> = {}) {
    this.config = { ...DEFAULT_OUTPUT_CONFIG, ...config };
  }

  /**
   * Validate and sanitize output response
   */
  async validate(
    response: string,
    context: string[]
  ): Promise<OutputValidationResult> {
    if (!this.config.enabled) {
      return {
        valid: true,
        errors: [],
        warnings: [],
        finalResponse: response,
        groundedness: 1,
        hasCitations: true,
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    let finalResponse = response;

    // Length check and truncation
    const wordCount = response.split(/\s+/).length;
    if (wordCount > this.config.maxResponseLength) {
      finalResponse = response.split(/\s+/).slice(0, this.config.maxResponseLength).join(' ');
      warnings.push('Antwort wurde gekürzt');
    }

    // Citation check
    const hasCitations = this.hasCitations(response);
    if (this.config.requireCitations && !hasCitations) {
      warnings.push('Antwort enthält keine Quellenangaben');
    }

    // Blocked content check and redaction
    for (const pattern of this.config.blockedContentPatterns) {
      if (pattern.test(finalResponse)) {
        finalResponse = finalResponse.replace(pattern, '[REDACTED]');
        warnings.push('Sensible Inhalte wurden entfernt');
      }
    }

    // Groundedness check
    const groundedness = this.calculateGroundedness(response, context);
    if (groundedness < this.config.groundednessThreshold) {
      warnings.push(`Niedrige Belegbarkeit: ${(groundedness * 100).toFixed(0)}%`);
      if (groundedness < 0.5) {
        finalResponse += '\n\n*Hinweis: Diese Antwort konnte nicht vollständig durch Dokumente belegt werden.*';
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      finalResponse,
      groundedness,
      hasCitations,
    };
  }

  /**
   * Check if response contains citations
   */
  private hasCitations(response: string): boolean {
    const citationPatterns = [
      /\[Quelle:/i,
      /\[Dokument:/i,
      /Laut.*Dokument/i,
      /Gemäß.*Dokument/i,
      /Im Dokument.*steht/i,
      /\(\d{4}\)/,  // Year citations
      /\[\d+\]/,     // Numbered citations
    ];

    return citationPatterns.some(p => p.test(response));
  }

  /**
   * Calculate groundedness score using optimized Set-based matching
   * Performance: O(n + m) instead of O(n * m) with naive string.includes()
   */
  private calculateGroundedness(response: string, context: string[]): number {
    if (context.length === 0) return 0;

    // Build a Set of context words for O(1) lookup
    const contextWords = new Set<string>();
    for (const chunk of context) {
      const words = chunk
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 4) // Skip short/common words
        .map(w => w.replace(/[^\wäöüß]/g, '')); // Normalize
      words.forEach(w => contextWords.add(w));
    }

    // Split response into sentences
    const sentences = response
      .split(/[.!?]+/)
      .filter(s => s.trim().length > 20);

    if (sentences.length === 0) return 1; // Short responses are considered grounded

    let groundedCount = 0;
    for (const sentence of sentences) {
      const words = sentence
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 4)
        .map(w => w.replace(/[^\wäöüß]/g, ''));

      if (words.length === 0) {
        groundedCount++; // Short sentences are considered grounded
        continue;
      }

      // O(1) lookup per word
      const matchCount = words.filter(w => contextWords.has(w)).length;
      const matchRatio = matchCount / words.length;

      // Sentence is grounded if ≥50% of words match context
      if (matchRatio >= 0.5) {
        groundedCount++;
      }
    }

    return groundedCount / sentences.length;
  }

  /**
   * Add citation to response if missing
   */
  addCitation(response: string, documentName: string): string {
    if (this.hasCitations(response)) {
      return response;
    }
    return `${response}\n\n[Quelle: ${documentName}]`;
  }
}

// Export singleton instances with default config
export const inputGuardrails = new InputGuardrails();
export const outputGuardrails = new OutputGuardrails();
