/**
 * ParserClientService - Node.js Client for Python Parser Microservice
 * RAG V2 Phase 2 - Multi-Format Document Parsing
 *
 * Communicates with the Docling-based parser service running on Ubuntu server.
 */

import type {
  ParsedDocument,
  ParseOptions,
  ParseResponse,
  ParserHealthResponse,
  SupportedFormat,
} from '../../types/parsing.js';
import { getSupportedFormat } from '../../types/parsing.js';
import { readFile } from 'fs/promises';

// ============================================
// Configuration
// ============================================

export interface ParserClientConfig {
  /** Parser service URL */
  serviceUrl: string;
  /** Request timeout in ms */
  timeout: number;
  /** Whether the service is enabled */
  enabled: boolean;
  /** Retry count on failure */
  retries: number;
  /** Retry delay in ms */
  retryDelay: number;
}

const DEFAULT_CONFIG: ParserClientConfig = {
  serviceUrl: process.env.PARSER_SERVICE_URL || 'http://192.168.178.23:8002',
  timeout: parseInt(process.env.PARSER_TIMEOUT || '300000'), // 5 minutes
  enabled: process.env.PARSER_ENABLED !== 'false',
  retries: 2,
  retryDelay: 1000,
};

// ============================================
// Service Implementation
// ============================================

export class ParserClientService {
  private config: ParserClientConfig;
  private available: boolean = false;
  private lastHealthCheck: number = 0;
  private healthCheckInterval: number = 60000; // 1 minute

  constructor(config?: Partial<ParserClientConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if parser service is available
   */
  async checkHealth(): Promise<ParserHealthResponse> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.config.serviceUrl}/health`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const health: ParserHealthResponse = await response.json();
        this.available = health.ready;
        this.lastHealthCheck = Date.now();
        return health;
      }

      this.available = false;
      return {
        status: 'error',
        parser: 'unknown',
        version: '0.0.0',
        supportedFormats: [],
        ready: false,
      };
    } catch (error) {
      this.available = false;
      return {
        status: 'error',
        parser: 'unknown',
        version: '0.0.0',
        supportedFormats: [],
        ready: false,
      };
    }
  }

  /**
   * Initialize the service
   */
  async initialize(): Promise<void> {
    if (!this.config.enabled) {
      console.log('📄 Parser: Disabled by configuration');
      return;
    }

    const health = await this.checkHealth();
    if (health.ready) {
      console.log(`📄 Parser: Connected to ${this.config.serviceUrl}`);
      console.log(`   Supported formats: ${health.supportedFormats.join(', ')}`);
    } else {
      console.warn(`📄 Parser: Service not available at ${this.config.serviceUrl}`);
    }
  }

  /**
   * Check if service is available (with caching)
   */
  async isAvailable(): Promise<boolean> {
    // Re-check health if cache expired
    if (Date.now() - this.lastHealthCheck > this.healthCheckInterval) {
      await this.checkHealth();
    }
    return this.config.enabled && this.available;
  }

  /**
   * Parse a document from file path
   */
  async parseFile(
    filePath: string,
    options?: ParseOptions
  ): Promise<ParseResponse> {
    // Read file content
    const fileContent = await readFile(filePath);
    const filename = filePath.split('/').pop() || 'document';

    return this.parseBuffer(fileContent, filename, options);
  }

  /**
   * Parse a document from buffer
   */
  async parseBuffer(
    buffer: Buffer,
    filename: string,
    options?: ParseOptions
  ): Promise<ParseResponse> {
    // Check format support
    const format = getSupportedFormat(undefined, filename);
    if (!format) {
      return {
        success: false,
        error: `Unsupported file format: ${filename}`,
        processingTimeMs: 0,
      };
    }

    // Check service availability
    if (!(await this.isAvailable())) {
      // Try fallback for text-based formats
      if (format === 'txt' || format === 'md' || format === 'html') {
        return this.fallbackParse(buffer, filename, format);
      }

      return {
        success: false,
        error: 'Parser service not available',
        processingTimeMs: 0,
      };
    }

    // Convert buffer to base64
    const base64Content = buffer.toString('base64');

    // Parse with retry logic
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= this.config.retries; attempt++) {
      try {
        return await this.sendParseRequest(base64Content, filename, options);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`Parser attempt ${attempt + 1} failed:`, lastError.message);

        if (attempt < this.config.retries) {
          await this.delay(this.config.retryDelay * (attempt + 1));
        }
      }
    }

    // All retries failed - try fallback for text formats
    if (format === 'txt' || format === 'md' || format === 'html') {
      console.log('📄 Using fallback parser for text format');
      return this.fallbackParse(buffer, filename, format);
    }

    return {
      success: false,
      error: lastError?.message || 'Parser request failed after retries',
      processingTimeMs: 0,
    };
  }

  /**
   * Send parse request to service
   */
  private async sendParseRequest(
    base64Content: string,
    filename: string,
    options?: ParseOptions
  ): Promise<ParseResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(`${this.config.serviceUrl}/parse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileContent: base64Content,
          filename,
          options,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Parser API error ${response.status}: ${errorText}`);
      }

      const result: ParseResponse = await response.json();
      return result;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Fallback parser for simple text formats when service is unavailable
   */
  private fallbackParse(
    buffer: Buffer,
    filename: string,
    format: SupportedFormat
  ): ParseResponse {
    const startTime = Date.now();
    const content = buffer.toString('utf-8');

    try {
      const documentId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Simple paragraph splitting
      const paragraphs = content.split(/\n\n+/).filter((p) => p.trim());
      const blocks = paragraphs.map((text, index) => ({
        type: 'paragraph' as const,
        content: text.trim(),
        position: index,
        pageNumber: 1,
      }));

      const document: ParsedDocument = {
        documentId,
        metadata: {
          filename,
          format,
          fileSize: buffer.length,
          pageCount: 1,
          parsingDurationMs: Date.now() - startTime,
          parser: 'fallback',
        },
        blocks,
        fullText: content,
        outline: [],
        warnings: [
          {
            code: 'FALLBACK_PARSER',
            message: 'Used fallback parser - parser service unavailable',
            severity: 'warning',
          },
        ],
        success: true,
      };

      return {
        success: true,
        document,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: `Fallback parsing failed: ${error instanceof Error ? error.message : String(error)}`,
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Get supported formats
   */
  async getSupportedFormats(): Promise<SupportedFormat[]> {
    if (await this.isAvailable()) {
      try {
        const response = await fetch(`${this.config.serviceUrl}/formats`);
        if (response.ok) {
          const data = await response.json();
          return data.supportedFormats;
        }
      } catch {
        // Fall through to default
      }
    }

    // Default formats (text-based work with fallback)
    return ['txt', 'md', 'html'];
  }

  /**
   * Check if a format is supported
   */
  async isFormatSupported(filename: string): Promise<boolean> {
    const format = getSupportedFormat(undefined, filename);
    if (!format) return false;

    const supported = await this.getSupportedFormats();
    return supported.includes(format);
  }

  /**
   * Get configuration
   */
  getConfig(): ParserClientConfig {
    return { ...this.config };
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const parserClientService = new ParserClientService();
export default parserClientService;
