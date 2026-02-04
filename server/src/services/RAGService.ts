/**
 * RAGService - Retrieval-Augmented Generation Service
 * RAG V2 Phase 2 - Supports hierarchical V2 chunks
 *
 * Combines vector search with chat completions to provide
 * context-aware responses with source citations.
 */

import { vectorService, type VectorSearchResponse } from './VectorService.js'
import { vectorServiceV2, type VectorSearchResponseV2 } from './VectorServiceV2.js'
import { ollamaService } from './OllamaService.js'
import { documentService } from './DocumentService.js'
import { type ChatMessage } from '../validation/index.js'
import { LoggerService } from './LoggerService.js'
import { rerankerService, type RerankerResult } from './rag/RerankerService.js'
import { GraphService, createGraphServiceFromEnv } from './graph/index.js'
import type { RefinedResult } from '../types/graph.js'
// Phase 5: Query Intelligence & Observability
import { QueryRouter, type QueryAnalysis, type RetrievalStrategy } from './rag/QueryRouter.js'
import { TracingService, type SpanName } from './observability/TracingService.js'
import { InputGuardrails, OutputGuardrails } from './guardrails/Guardrails.js'
import { DatabaseService } from './DatabaseService.js'

// V2 configuration
const USE_V2_SEARCH = process.env.RAG_VERSION === 'v2' || process.env.CHUNKING_VERSION === 'v2'

// ============================================
// Types
// ============================================

export interface RAGRequest {
  messages: ChatMessage[]
  model: string
  query: string
  searchLimit?: number
  searchThreshold?: number
  hybridAlpha?: number // 0 = pure BM25/keyword, 1 = pure vector/semantic
  // NEW: Reranking option (Phase 1)
  rerank?: boolean
  rerankTopK?: number
  // User context for permission-aware RAG
  userContext?: {
    userId: string
    userRole: string
    userDepartment?: string
  }
  // V2 options
  useV2?: boolean
  includeParentContext?: boolean
  // NEW: Graph RAG options (Phase 4)
  useGraph?: boolean
  graphMaxDepth?: number
  graphMaxNodes?: number
  // NEW: Document Expansion options (Research Improvement 2026)
  enableDocumentExpansion?: boolean
  maxDocumentsToExpand?: number
  maxChunksPerDocument?: number
  expansionThreshold?: number
}

export interface RAGSource {
  documentId: string
  documentName: string
  content: string
  pageNumber?: number
  chunkIndex: number
  score: number
}

export interface RAGResponse {
  message: string
  sources: RAGSource[]
  searchResults: VectorSearchResponse
  hasRelevantSources: boolean
  // NEW: Graph RAG info (Phase 4)
  graphEnriched?: boolean
  graphContext?: string
}

class RAGService {
  private graphService: GraphService | null = null;
  private graphInitialized = false;
  // Phase 5: Query Intelligence & Observability
  private queryRouter: QueryRouter;
  private tracingService: TracingService;
  private inputGuardrails: InputGuardrails;
  private outputGuardrails: OutputGuardrails;
  private observabilityEnabled = process.env.OBSERVABILITY_ENABLED !== 'false';
  private guardrailsEnabled = process.env.GUARDRAILS_ENABLED !== 'false';

  constructor() {
    this.queryRouter = new QueryRouter({
      enableGraph: process.env.GRAPH_ENABLED === 'true',
      enableTableFocus: true,
      defaultStrategy: 'hybrid',
    });
    this.tracingService = new TracingService(undefined, {
      enabled: this.observabilityEnabled,
      sampleRate: parseFloat(process.env.TRACE_SAMPLE_RATE || '1.0'),
      persistToDb: true,
      logToConsole: process.env.NODE_ENV === 'development',
    });
    this.inputGuardrails = new InputGuardrails({
      enabled: this.guardrailsEnabled,
      maxQueryLength: parseInt(process.env.MAX_QUERY_LENGTH || '2000'),
      maxQueriesPerMinute: parseInt(process.env.MAX_QUERIES_PER_MINUTE || '30'),
    });
    this.outputGuardrails = new OutputGuardrails({
      enabled: this.guardrailsEnabled,
      requireCitations: true,
      groundednessThreshold: parseFloat(process.env.GROUNDEDNESS_THRESHOLD || '0.7'),
    });
  }

  /**
   * Initialize the RAG service (call once at startup)
   */
  async initialize(db?: DatabaseService): Promise<void> {
    // Initialize Tracing Service with database
    if (db && this.observabilityEnabled) {
      this.tracingService = new TracingService(db, {
        enabled: true,
        sampleRate: parseFloat(process.env.TRACE_SAMPLE_RATE || '1.0'),
        persistToDb: true,
        logToConsole: process.env.NODE_ENV === 'development',
      });
      console.log('[RAGService] Tracing service initialized with database');
    }

    // Initialize Graph Service if enabled
    if (process.env.GRAPH_ENABLED === 'true') {
      try {
        this.graphService = createGraphServiceFromEnv(db);
        await this.graphService.initialize();
        this.graphInitialized = this.graphService.isReady();
        console.log(`[RAGService] Graph service initialized: ${this.graphInitialized}`);
      } catch (error) {
        console.error('[RAGService] Failed to initialize graph service:', error);
        this.graphInitialized = false;
      }
    }
  }

  /**
   * Get graph service instance (for document processing integration)
   */
  getGraphService(): GraphService | null {
    return this.graphService;
  }

  /**
   * Get tracing service instance (for monitoring API)
   */
  getTracingService(): TracingService {
    return this.tracingService;
  }

  /**
   * Get query router instance (for external use)
   */
  getQueryRouter(): QueryRouter {
    return this.queryRouter;
  }

  /**
   * Generate RAG response with document context and source citations
   * NEW: Respects user permissions via PostgreSQL RLS integration
   * NEW: Optional graph enrichment for multi-hop queries (Phase 4)
   * NEW: Query routing, tracing, and guardrails (Phase 5)
   */
  async generateResponse(request: RAGRequest): Promise<RAGResponse> {
    const {
      messages,
      model,
      query,
      searchLimit = 20, // Increased to allow reranker to find best matches
      searchThreshold = 0.1, // Lowered to get more candidates for reranking
      hybridAlpha = 0.5,
      rerank = true, // Enable reranking by default for better results
      rerankTopK = 5,
      userContext,
    } = request

    // Phase 5: Start trace
    const userId = userContext?.userId || 'anonymous';
    const sessionId = request.messages[0]?.content?.substring(0, 32) || 'unknown';
    const traceId = this.tracingService.startTrace(userId, sessionId, query.length);

    try {
      // Phase 5: Input guardrails validation
      const guardrailsSpanId = traceId ? this.tracingService.startSpan(traceId, 'guardrails_input') : '';
      const inputValidation = this.inputGuardrails.validate(query, userId);

      if (traceId && guardrailsSpanId) {
        this.tracingService.endSpan(traceId, guardrailsSpanId, {
          valid: inputValidation.valid,
          warnings: inputValidation.warnings,
          sanitized: inputValidation.sanitizedQuery !== query,
        });
      }

      if (!inputValidation.valid) {
        if (traceId) {
          await this.tracingService.endTrace(traceId, false);
        }
        return {
          message: inputValidation.errors.join(' '),
          sources: [],
          searchResults: { results: [], totalResults: 0, query },
          hasRelevantSources: false,
        };
      }

      // Use sanitized query
      const sanitizedQuery = inputValidation.sanitizedQuery;

      // Phase 5: Query analysis and routing
      const analysisSpanId = traceId ? this.tracingService.startSpan(traceId, 'query_analysis') : '';
      const queryAnalysis = this.queryRouter.analyze(sanitizedQuery);

      if (traceId && analysisSpanId) {
        this.tracingService.endSpan(traceId, analysisSpanId, {
          queryType: queryAnalysis.queryType,
          strategy: queryAnalysis.suggestedStrategy,
          isMultiHop: queryAnalysis.isMultiHop,
          requiresGraph: queryAnalysis.requiresGraph,
          entities: queryAnalysis.entities,
          confidence: queryAnalysis.confidence,
        });
        this.tracingService.setTraceMetadata(traceId, {
          queryType: queryAnalysis.queryType,
          retrievalStrategy: queryAnalysis.suggestedStrategy,
        });
      }

      console.log(`🔀 Query routed: type=${queryAnalysis.queryType}, strategy=${queryAnalysis.suggestedStrategy}, entities=${queryAnalysis.entities.length}, levels=${queryAnalysis.recommendedLevelFilter.join(',')}`);

      // Override graph usage based on query analysis
      const useGraph = request.useGraph ?? (queryAnalysis.requiresGraph && this.graphInitialized);

      // Use query-type-based level filter from router
      const levelFilter = queryAnalysis.recommendedLevelFilter;

      // Step 1: Get accessible document IDs for this user (permission-aware)
      let allowedDocumentIds: string[] | undefined;

      if (userContext) {
        // Set user context for PostgreSQL RLS
        await documentService.setUserContext(
          userContext.userId,
          userContext.userRole,
          userContext.userDepartment
        );

        // Get documents this user can access (filtered by RLS policies)
        allowedDocumentIds = await documentService.getAccessibleDocumentIds();

        console.log(`🔐 RAG: User ${userContext.userRole} (${userContext.userDepartment}) has access to ${allowedDocumentIds.length} documents`);

        // If user has no accessible documents, return early
        if (allowedDocumentIds.length === 0) {
          return {
            message: 'Sie haben derzeit keine Berechtigung, Dokumente einzusehen. Bitte wenden Sie sich an Ihren Administrator.',
            sources: [],
            searchResults: { results: [], totalResults: 0, query },
            hasRelevantSources: false,
          };
        }
      } else {
        console.log('⚠️  RAG: No user context provided - searching all documents (not recommended for production)');
      }

      // Step 2: Search for relevant document chunks (permission-aware)
      // Use V2 search if enabled
      const useV2 = request.useV2 ?? USE_V2_SEARCH

      // Phase 5: Start vector search span
      const searchSpanId = traceId ? this.tracingService.startSpan(traceId, 'vector_search') : '';

      let searchResults: VectorSearchResponse

      if (useV2) {
        console.log(`🔍 Using V2 hierarchical search with levelFilter=${levelFilter.join(',')}`)
        const v2Results = await vectorServiceV2.search({
          query,
          limit: searchLimit,
          threshold: searchThreshold,
          hybridAlpha,
          allowedDocumentIds,
          levelFilter, // Use query-type-based level filter from QueryRouter
          includeParentContext: request.includeParentContext ?? false,
        })

        // Convert V2 results to V1 format for compatibility
        searchResults = {
          results: v2Results.results.map((r) => ({
            chunk: {
              id: r.chunk.id,
              documentId: r.chunk.documentId,
              content: r.chunk.content,
              pageNumber: r.chunk.pageStart,
              chunkIndex: r.chunk.chunkIndex,
              totalChunks: r.chunk.totalChunks,
            },
            score: r.score,
            document: r.document,
          })),
          totalResults: v2Results.totalResults,
          query: v2Results.query,
        }
      } else {
        searchResults = await vectorService.search({
          query,
          limit: searchLimit,
          threshold: searchThreshold,
          hybridAlpha,
          allowedDocumentIds,
        })
      }

      // Phase 5: End vector search span
      if (traceId && searchSpanId) {
        this.tracingService.endSpan(traceId, searchSpanId, {
          resultsCount: searchResults.results.length,
          totalResults: searchResults.totalResults,
          useV2,
        });
        this.tracingService.setTraceMetadata(traceId, {
          chunksRetrieved: searchResults.results.length,
        });
      }

      // Step 3: Check if we found relevant sources
      const hasRelevantSources = searchResults.results.length > 0

      // Step 3.5: Apply reranking if enabled (Phase 1)
      let rerankResult: RerankerResult | undefined;
      const rerankSpanId = (rerank && hasRelevantSources && rerankerService.isAvailable() && traceId)
        ? this.tracingService.startSpan(traceId, 'reranking')
        : '';

      if (rerank && hasRelevantSources && rerankerService.isAvailable()) {
        const chunks = searchResults.results.map((r) => ({
          id: `${r.chunk.documentId}:${r.chunk.chunkIndex}`,
          content: r.chunk.content,
          score: r.score,
          documentId: r.chunk.documentId,
          chunkIndex: r.chunk.chunkIndex,
          metadata: { pageNumber: r.chunk.pageNumber },
        }));

        console.log(`🔧 DEBUG: Sending ${chunks.length} chunks to reranker with topK=${rerankTopK}`);
        rerankResult = await rerankerService.rerank(query, chunks, rerankTopK);
        console.log(`🔧 DEBUG: Reranker returned ${rerankResult.chunks.length} chunks`);

        // Reorder searchResults based on reranking
        if (rerankResult.chunks.length > 0) {
          const rerankedResults = rerankResult.chunks.map((chunk) => {
            const original = searchResults.results.find(
              (r) => r.chunk.documentId === chunk.documentId && r.chunk.chunkIndex === chunk.chunkIndex
            );
            return original!;
          }).filter(Boolean);

          searchResults.results = rerankedResults;
          console.log(`🔄 Reranked ${rerankResult.chunks.length} results in ${rerankResult.processingTimeMs}ms`);
        }

        // Phase 5: End reranking span
        if (traceId && rerankSpanId) {
          this.tracingService.endSpan(traceId, rerankSpanId, {
            inputChunks: searchResults.results.length,
            outputChunks: rerankResult.chunks.length,
            processingTimeMs: rerankResult.processingTimeMs,
          });
        }
      }

      // Step 3.55: Document Expansion - Load all chunks from found documents
      // This ensures the LLM has complete document context, not just top-K chunks
      const enableExpansion = request.enableDocumentExpansion ?? true; // Enabled by default
      const maxDocumentsToExpand = request.maxDocumentsToExpand ?? 3;
      const maxChunksPerDocument = request.maxChunksPerDocument ?? 20;
      const expansionThreshold = request.expansionThreshold ?? 0.3;

      if (enableExpansion && hasRelevantSources && useV2) {
        try {
          // Get unique document IDs from search results that meet threshold
          const qualifiedDocIds = [...new Set(
            searchResults.results
              .filter(r => r.score >= expansionThreshold)
              .map(r => r.chunk.documentId)
          )].slice(0, maxDocumentsToExpand);

          if (qualifiedDocIds.length > 0) {
            // Fetch all chunks for these documents
            const expandedChunks = await vectorServiceV2.getChunksByDocumentIds(
              qualifiedDocIds,
              { maxChunksPerDocument, levelFilter: [2] } // Only paragraph-level for now
            );

            // Merge with existing results, avoiding duplicates
            const existingChunkIds = new Set(
              searchResults.results.map(r => `${r.chunk.documentId}:${r.chunk.chunkIndex}`)
            );

            const newChunks = expandedChunks.filter(
              c => !existingChunkIds.has(`${c.chunk.documentId}:${c.chunk.chunkIndex}`)
            );

            // Add expansion chunks with lower score (they weren't found by search)
            const expansionResults = newChunks.map(c => ({
              ...c,
              score: 0.1, // Mark as expansion chunk with low score
            }));

            // Combine: original results first, then expansion chunks sorted by document order
            searchResults.results = [
              ...searchResults.results,
              ...expansionResults,
            ];

            console.log(`📄 Document Expansion: Added ${newChunks.length} chunks from ${qualifiedDocIds.length} document(s)`);
          }
        } catch (expansionError) {
          console.warn('⚠️ Document expansion failed (continuing without):', expansionError);
        }
      }

      if (!hasRelevantSources) {
        if (traceId) {
          await this.tracingService.endTrace(traceId, false);
        }
        const noSourcesMessage = userContext
          ? 'Entschuldigung, ich habe keine relevanten Informationen in den für Sie zugänglichen Dokumenten zu Ihrer Frage gefunden. Möglicherweise benötigen Sie erweiterte Berechtigungen oder weitere Dokumente müssen hochgeladen werden.'
          : 'Entschuldigung, ich habe keine relevanten Informationen in den hochgeladenen Dokumenten zu Ihrer Frage gefunden. Bitte versuchen Sie eine andere Formulierung oder laden Sie weitere Dokumente hoch.';

        return {
          message: noSourcesMessage,
          sources: [],
          searchResults,
          hasRelevantSources: false,
        }
      }

      // Step 3.6: Graph enrichment for multi-hop queries (Phase 4)
      let graphRefinement: RefinedResult | undefined;
      let graphContextText = '';
      const graphSpanId = (useGraph && this.graphInitialized && this.graphService && traceId)
        ? this.tracingService.startSpan(traceId, 'graph_traversal')
        : '';

      if (useGraph && this.graphInitialized && this.graphService) {
        try {
          // Extract entities from query for graph lookup
          const queryEntities = this.extractQueryEntities(sanitizedQuery);

          graphRefinement = await this.graphService.refineRAGResults({
            query,
            queryEntities,
            topChunks: searchResults.results.map((r) => ({
              id: r.chunk.id,
              content: r.chunk.content,
              score: r.score,
            })),
            maxDepth: request.graphMaxDepth || 2,
            maxNodes: request.graphMaxNodes || 50,
          });

          if (graphRefinement.shouldUseGraph) {
            graphContextText = this.graphService.buildGraphContext(graphRefinement);
            console.log(`🕸️ Graph enrichment: Found ${graphRefinement.graphContext.nodes.length} related entities`);
          }

          // Phase 5: End graph traversal span
          if (traceId && graphSpanId) {
            this.tracingService.endSpan(traceId, graphSpanId, {
              shouldUseGraph: graphRefinement.shouldUseGraph,
              nodesFound: graphRefinement.graphContext.nodes.length,
              edgesFound: graphRefinement.graphContext.edges.length,
              additionalChunks: graphRefinement.additionalChunkIds.length,
            });
          }
        } catch (error) {
          console.error('⚠️ Graph enrichment failed (continuing without):', error);
          if (traceId && graphSpanId) {
            this.tracingService.endSpan(traceId, graphSpanId, {}, error instanceof Error ? error : new Error(String(error)));
          }
        }
      }

      // Step 4: Create context from search results
      const context = this.buildContext(searchResults)

      // Step 5: Create system prompt with context (including graph context if available)
      const systemPrompt = this.buildSystemPrompt(context, graphContextText)

      // Step 6: Prepare messages with RAG context
      const ragMessages: ChatMessage[] = [
        {
          role: 'system',
          content: systemPrompt,
        },
        ...messages,
      ]

      // Step 7: Get response from LLM
      // Phase 5: Start LLM generation span
      const llmSpanId = traceId ? this.tracingService.startSpan(traceId, 'llm_generation') : '';

      const response = await ollamaService.chat({
        messages: ragMessages,
        model,
      })

      // Phase 5: End LLM generation span
      if (traceId && llmSpanId) {
        this.tracingService.endSpan(traceId, llmSpanId, {
          model,
          responseLength: response.message.content.length,
        });
      }

      // Step 8: Extract sources for citation
      const sources: RAGSource[] = searchResults.results.map((result) => ({
        documentId: result.document.id,
        documentName: result.document.originalName,
        content: result.chunk.content.substring(0, 200) + '...', // Preview
        pageNumber: result.chunk.pageNumber,
        chunkIndex: result.chunk.chunkIndex,
        score: result.score,
      }))

      // Phase 5: Output guardrails validation
      const outputGuardrailsSpanId = traceId ? this.tracingService.startSpan(traceId, 'guardrails_output') : '';
      const contextTexts = searchResults.results.map(r => r.chunk.content);
      const outputValidation = await this.outputGuardrails.validate(
        response.message.content,
        contextTexts
      );

      if (traceId && outputGuardrailsSpanId) {
        this.tracingService.endSpan(traceId, outputGuardrailsSpanId, {
          valid: outputValidation.valid,
          warnings: outputValidation.warnings,
          groundedness: outputValidation.groundedness,
          hasCitations: outputValidation.hasCitations,
        });
      }

      // Use validated/sanitized response
      const finalMessage = outputValidation.finalResponse;

      // Step 9: Cleanup user context (important for connection pooling)
      if (userContext) {
        await documentService.clearUserContext();
      }

      // Phase 5: Set final trace metadata and end trace
      if (traceId) {
        this.tracingService.setTraceMetadata(traceId, {
          chunksUsed: sources.length,
        });
        await this.tracingService.endTrace(traceId, true, 0);
      }

      // Log successful RAG query (without content for privacy)
      LoggerService.logRAG('query', {
        userId: userContext?.userId,
        queryLength: query.length,
        resultsCount: sources.length,
        model: model,
        duration: undefined, // Could add timing if needed
        department: userContext?.userDepartment
      });

      return {
        message: finalMessage,
        sources,
        searchResults,
        hasRelevantSources: true,
        graphEnriched: graphRefinement?.shouldUseGraph || false,
        graphContext: graphContextText || undefined,
      }
    } catch (error) {
      // Phase 5: End trace on error
      if (traceId) {
        await this.tracingService.endTrace(traceId, false);
      }
      console.error('❌ RAG generation failed:', error)

      // Log RAG query error
      LoggerService.logError(error instanceof Error ? error : new Error('RAG query failed'), {
        userId: userContext?.userId,
        queryLength: query.length,
        model: model,
        department: userContext?.userDepartment
      });

      // Ensure user context is cleaned up even on error
      if (request.userContext) {
        try {
          await documentService.clearUserContext();
        } catch (cleanupError) {
          console.error('❌ Failed to cleanup user context:', cleanupError);
        }
      }

      throw error
    }
  }

  /**
   * Generate streaming RAG response with permission-aware filtering
   */
  async generateStreamingResponse(request: RAGRequest): Promise<{
    stream: ReadableStream
    sources: RAGSource[]
    searchResults: VectorSearchResponse
    hasRelevantSources: boolean
  }> {
    const {
      messages,
      model,
      query,
      searchLimit = 20, // Increased to allow reranker to find best matches
      searchThreshold = 0.1, // Lowered to get more candidates for reranking
      hybridAlpha = 0.5,
      userContext,
      rerank = true, // Enable reranking by default
      rerankTopK = 5,
    } = request

    try {
      // Step 1: Get accessible document IDs for this user (same permission logic as generateResponse)
      let allowedDocumentIds: string[] | undefined;

      if (userContext) {
        await documentService.setUserContext(
          userContext.userId,
          userContext.userRole,
          userContext.userDepartment
        );

        allowedDocumentIds = await documentService.getAccessibleDocumentIds();

        if (allowedDocumentIds.length === 0) {
          const noAccessStream = new ReadableStream({
            start(controller) {
              const message = 'Sie haben derzeit keine Berechtigung, Dokumente einzusehen. Bitte wenden Sie sich an Ihren Administrator.';
              const chunk = JSON.stringify({
                message: { content: message },
                done: false,
              });
              controller.enqueue(new TextEncoder().encode(chunk + '\n'));

              const doneChunk = JSON.stringify({ done: true });
              controller.enqueue(new TextEncoder().encode(doneChunk + '\n'));
              controller.close();
            },
          });

          return {
            stream: noAccessStream,
            sources: [],
            searchResults: { results: [], totalResults: 0, query },
            hasRelevantSources: false,
          };
        }
      }

      // Step 2: Search for relevant document chunks (permission-aware)
      // Use V2 search if enabled
      const useV2 = request.useV2 ?? USE_V2_SEARCH

      // Query analysis for optimal level filter (same as non-streaming)
      const queryAnalysis = this.queryRouter.analyze(query);
      const levelFilter = queryAnalysis.recommendedLevelFilter;
      console.log(`🔀 Streaming Query routed: type=${queryAnalysis.queryType}, levels=${levelFilter.join(',')}`);

      let searchResults: VectorSearchResponse

      if (useV2) {
        console.log(`🔍 Using V2 hierarchical search (streaming) with levelFilter=${levelFilter.join(',')}`)
        const v2Results = await vectorServiceV2.search({
          query,
          limit: searchLimit,
          threshold: searchThreshold,
          hybridAlpha,
          allowedDocumentIds,
          levelFilter, // Use query-type-based level filter from QueryRouter
          includeParentContext: request.includeParentContext ?? false,
        })

        searchResults = {
          results: v2Results.results.map((r) => ({
            chunk: {
              id: r.chunk.id,
              documentId: r.chunk.documentId,
              content: r.chunk.content,
              pageNumber: r.chunk.pageStart,
              chunkIndex: r.chunk.chunkIndex,
              totalChunks: r.chunk.totalChunks,
            },
            score: r.score,
            document: r.document,
          })),
          totalResults: v2Results.totalResults,
          query: v2Results.query,
        }
      } else {
        searchResults = await vectorService.search({
          query,
          limit: searchLimit,
          threshold: searchThreshold,
          hybridAlpha,
          allowedDocumentIds,
        })
      }

      // Apply reranking if enabled (same as non-streaming version)
      if (rerank && searchResults.results.length > 0 && rerankerService.isAvailable()) {
        const chunks = searchResults.results.map((r) => ({
          id: r.chunk.id,
          documentId: r.chunk.documentId,
          chunkIndex: r.chunk.chunkIndex,
          content: r.chunk.content,
          score: r.score,
        }));

        console.log(`🔧 DEBUG Streaming: Sending ${chunks.length} chunks to reranker with topK=${rerankTopK}`);
        const rerankResult = await rerankerService.rerank(query, chunks, rerankTopK);
        console.log(`🔧 DEBUG Streaming: Reranker returned ${rerankResult.chunks.length} chunks`);

        if (rerankResult.chunks.length > 0) {
          const rerankedResults = rerankResult.chunks.map((chunk) => {
            const original = searchResults.results.find(
              (r) => r.chunk.documentId === chunk.documentId && r.chunk.chunkIndex === chunk.chunkIndex
            );
            return original!;
          }).filter(Boolean);
          searchResults.results = rerankedResults;
          console.log(`🔄 Streaming: Reranked ${rerankResult.chunks.length} results in ${rerankResult.processingTimeMs}ms`);
        }
      }

      // Document Expansion for Streaming (same logic as non-streaming)
      const enableExpansion = request.enableDocumentExpansion ?? true;
      const maxDocumentsToExpand = request.maxDocumentsToExpand ?? 3;
      const maxChunksPerDocument = request.maxChunksPerDocument ?? 20;
      const expansionThreshold = request.expansionThreshold ?? 0.3;

      if (enableExpansion && searchResults.results.length > 0 && useV2) {
        try {
          const qualifiedDocIds = [...new Set(
            searchResults.results
              .filter(r => r.score >= expansionThreshold)
              .map(r => r.chunk.documentId)
          )].slice(0, maxDocumentsToExpand);

          if (qualifiedDocIds.length > 0) {
            const expandedChunks = await vectorServiceV2.getChunksByDocumentIds(
              qualifiedDocIds,
              { maxChunksPerDocument, levelFilter: [2] }
            );

            const existingChunkIds = new Set(
              searchResults.results.map(r => `${r.chunk.documentId}:${r.chunk.chunkIndex}`)
            );

            const newChunks = expandedChunks.filter(
              c => !existingChunkIds.has(`${c.chunk.documentId}:${c.chunk.chunkIndex}`)
            );

            const expansionResults = newChunks.map(c => ({
              ...c,
              score: 0.1,
            }));

            searchResults.results = [...searchResults.results, ...expansionResults];
            console.log(`📄 Streaming Document Expansion: Added ${newChunks.length} chunks from ${qualifiedDocIds.length} document(s)`);
          }
        } catch (expansionError) {
          console.warn('⚠️ Streaming document expansion failed:', expansionError);
        }
      }

      const hasRelevantSources = searchResults.results.length > 0

      if (!hasRelevantSources) {
        // Create a stream for the "no sources found" message
        const noSourcesMessage = userContext
          ? 'Entschuldigung, ich habe keine relevanten Informationen in den für Sie zugänglichen Dokumenten zu Ihrer Frage gefunden.'
          : 'Entschuldigung, ich habe keine relevanten Informationen in den hochgeladenen Dokumenten zu Ihrer Frage gefunden.'

        const stream = new ReadableStream({
          start(controller) {
            // Send the message as a single chunk
            const chunk = JSON.stringify({
              message: { content: noSourcesMessage },
              done: false,
            })
            controller.enqueue(new TextEncoder().encode(chunk + '\n'))

            // End the stream
            const doneChunk = JSON.stringify({ done: true })
            controller.enqueue(new TextEncoder().encode(doneChunk + '\n'))
            controller.close()
          },
        })

        return {
          stream,
          sources: [],
          searchResults,
          hasRelevantSources: false,
        }
      }

      // Step 2: Build context and system prompt
      const context = this.buildContext(searchResults)
      const systemPrompt = this.buildSystemPrompt(context)

      // Step 3: Prepare messages with RAG context
      const ragMessages: ChatMessage[] = [
        {
          role: 'system',
          content: systemPrompt,
        },
        ...messages,
      ]

      // Step 4: Get streaming response from LLM
      const ollamaResponse = await ollamaService.chatStream({
        messages: ragMessages,
        model,
      })

      // Step 5: Extract sources for citation
      const sources: RAGSource[] = searchResults.results.map((result) => ({
        documentId: result.document.id,
        documentName: result.document.originalName,
        content: result.chunk.content.substring(0, 200) + '...', // Preview
        pageNumber: result.chunk.pageNumber,
        chunkIndex: result.chunk.chunkIndex,
        score: result.score,
      }))

      // Step 6: Wrap the original stream to cleanup user context when done
      let wrappedStream = ollamaResponse.body || new ReadableStream();

      if (userContext) {
        const originalStream = wrappedStream;
        wrappedStream = new ReadableStream({
          start(controller) {
            const reader = originalStream.getReader();

            const pump = async (): Promise<void> => {
              try {
                while (true) {
                  const { done, value } = await reader.read();

                  if (done) {
                    // Cleanup user context when stream ends
                    try {
                      await documentService.clearUserContext();
                      console.log('🧹 Cleaned up user context after streaming RAG completion');
                    } catch (cleanupError) {
                      console.error('❌ Failed to cleanup user context after streaming:', cleanupError);
                    }
                    controller.close();
                    break;
                  }

                  controller.enqueue(value);
                }
              } catch (error) {
                // Cleanup user context on error too
                try {
                  await documentService.clearUserContext();
                } catch (cleanupError) {
                  console.error('❌ Failed to cleanup user context after streaming error:', cleanupError);
                }
                controller.error(error);
              }
            };

            pump();
          },
        });
      }

      return {
        stream: wrappedStream,
        sources,
        searchResults,
        hasRelevantSources: true,
      }
    } catch (error) {
      console.error('❌ RAG streaming generation failed:', error)

      // Ensure user context cleanup on initialization error
      if (request.userContext) {
        try {
          await documentService.clearUserContext();
        } catch (cleanupError) {
          console.error('❌ Failed to cleanup user context on streaming init error:', cleanupError);
        }
      }

      throw error
    }
  }

  /**
   * Build context string from search results
   */
  private buildContext(searchResults: VectorSearchResponse): string {
    return searchResults.results
      .map((result, index) => {
        return `[Quelle ${index + 1}: ${result.document.originalName}]\n${result.chunk.content}\n`
      })
      .join('\n')
  }

  /**
   * Build system prompt with document context
   * NEW: Supports optional graph context for multi-hop queries (Phase 4)
   */
  private buildSystemPrompt(context: string, graphContext?: string): string {
    let prompt = `Sie sind ein hilfsbereiter KI-Assistent, der Fragen basierend auf bereitgestellten Dokumenten beantwortet.

KONTEXT AUS DOKUMENTEN:
${context}
`;

    // Add graph context if available
    if (graphContext) {
      prompt += `
${graphContext}
`;
    }

    prompt += `
ANWEISUNGEN:
1. Beantworten Sie die Frage basierend auf den bereitgestellten Dokumenten
2. Zitieren Sie relevante Quellen in Ihrer Antwort (z.B. "Laut [Quelle 1: Dokumentname]...")
3. Wenn die Informationen in den Dokumenten nicht ausreichend sind, sagen Sie das ehrlich
4. Bleiben Sie bei den Fakten aus den Dokumenten und spekulieren Sie nicht
5. Antworten Sie auf Deutsch und in einem freundlichen, professionellen Ton
6. Nutzen Sie Informationen aus dem Wissensgraph, um Zusammenhänge zwischen Personen, Organisationen und Projekten zu erklären

Die Antwort sollte eine direkte Beantwortung der Frage sein, gefolgt von relevanten Quellenangaben.`;

    return prompt;
  }

  /**
   * Extract potential entities from a query for graph lookup
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
      entities.push(...quotedMatches.map((q) => q.replace(/"/g, '')));
    }

    return [...new Set(entities)].filter((e) => e.length >= 2 && e.length <= 50);
  }

  /**
   * Health check for RAG service
   * NEW: Includes graph service status (Phase 4)
   */
  async healthCheck(): Promise<{
    status: 'ok' | 'error'
    services: {
      vector: { status: 'ok' | 'error'; error?: string }
      ollama: { status: 'ok' | 'error'; error?: string }
      graph?: { status: 'ok' | 'error' | 'disabled'; version?: string }
    }
  }> {
    const vectorHealth = await vectorService.healthCheck()
    const ollamaHealth = await ollamaService.healthCheck(5000)

    // Graph health check
    let graphHealth: { status: 'ok' | 'error' | 'disabled'; version?: string } = { status: 'disabled' };
    if (this.graphService) {
      const health = await this.graphService.healthCheck();
      graphHealth = {
        status: health.initialized && health.neo4j?.healthy ? 'ok' : health.enabled ? 'error' : 'disabled',
        version: health.neo4j?.version,
      };
    }

    return {
      status: vectorHealth.status === 'ok' && ollamaHealth.status === 'ok' ? 'ok' : 'error',
      services: {
        vector: vectorHealth,
        ollama: {
          status: ollamaHealth.status === 'unknown' ? 'error' : ollamaHealth.status,
          error: ollamaHealth.error,
        },
        graph: graphHealth,
      },
    }
  }
}

export const ragService = new RAGService()