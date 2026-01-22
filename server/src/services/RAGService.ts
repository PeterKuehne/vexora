/**
 * RAGService - Retrieval-Augmented Generation Service
 *
 * Combines vector search with chat completions to provide
 * context-aware responses with source citations.
 */

import { vectorService, type VectorSearchResponse } from './VectorService.js'
import { ollamaService } from './OllamaService.js'
import { documentService } from './DocumentService.js'
import { type ChatMessage } from '../validation/index.js'
import { LoggerService } from './LoggerService.js'

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
  // NEW: User context for permission-aware RAG
  userContext?: {
    userId: string
    userRole: string
    userDepartment?: string
  }
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
}

class RAGService {
  /**
   * Generate RAG response with document context and source citations
   * NEW: Respects user permissions via PostgreSQL RLS integration
   */
  async generateResponse(request: RAGRequest): Promise<RAGResponse> {
    const {
      messages,
      model,
      query,
      searchLimit = 5,
      searchThreshold = 0.5,
      hybridAlpha = 0.5,
      userContext,
    } = request

    try {
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
      const searchResults = await vectorService.search({
        query,
        limit: searchLimit,
        threshold: searchThreshold,
        hybridAlpha,
        allowedDocumentIds, // NEW: Only search in allowed documents
      })

      // Step 3: Check if we found relevant sources
      const hasRelevantSources = searchResults.results.length > 0

      if (!hasRelevantSources) {
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

      // Step 4: Create context from search results
      const context = this.buildContext(searchResults)

      // Step 5: Create system prompt with context
      const systemPrompt = this.buildSystemPrompt(context)

      // Step 6: Prepare messages with RAG context
      const ragMessages: ChatMessage[] = [
        {
          role: 'system',
          content: systemPrompt,
        },
        ...messages,
      ]

      // Step 7: Get response from LLM
      const response = await ollamaService.chat({
        messages: ragMessages,
        model,
      })

      // Step 8: Extract sources for citation
      const sources: RAGSource[] = searchResults.results.map((result) => ({
        documentId: result.document.id,
        documentName: result.document.originalName,
        content: result.chunk.content.substring(0, 200) + '...', // Preview
        pageNumber: result.chunk.pageNumber,
        chunkIndex: result.chunk.chunkIndex,
        score: result.score,
      }))

      // Step 9: Cleanup user context (important for connection pooling)
      if (userContext) {
        await documentService.clearUserContext();
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
        message: response.message.content,
        sources,
        searchResults,
        hasRelevantSources: true,
      }
    } catch (error) {
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
      searchLimit = 5,
      searchThreshold = 0.5,
      hybridAlpha = 0.5,
      userContext,
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
      const searchResults = await vectorService.search({
        query,
        limit: searchLimit,
        threshold: searchThreshold,
        hybridAlpha,
        allowedDocumentIds,
      })

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
   */
  private buildSystemPrompt(context: string): string {
    return `Sie sind ein hilfsbereiter KI-Assistent, der Fragen basierend auf bereitgestellten Dokumenten beantwortet.

KONTEXT AUS DOKUMENTEN:
${context}

ANWEISUNGEN:
1. Beantworten Sie die Frage basierend auf den bereitgestellten Dokumenten
2. Zitieren Sie relevante Quellen in Ihrer Antwort (z.B. "Laut [Quelle 1: Dokumentname]...")
3. Wenn die Informationen in den Dokumenten nicht ausreichend sind, sagen Sie das ehrlich
4. Bleiben Sie bei den Fakten aus den Dokumenten und spekulieren Sie nicht
5. Antworten Sie auf Deutsch und in einem freundlichen, professionellen Ton

Die Antwort sollte eine direkte Beantwortung der Frage sein, gefolgt von relevanten Quellenangaben.`
  }

  /**
   * Health check for RAG service
   */
  async healthCheck(): Promise<{
    status: 'ok' | 'error'
    services: {
      vector: { status: 'ok' | 'error'; error?: string }
      ollama: { status: 'ok' | 'error'; error?: string }
    }
  }> {
    const vectorHealth = await vectorService.healthCheck()
    const ollamaHealth = await ollamaService.healthCheck(5000)

    return {
      status: vectorHealth.status === 'ok' && ollamaHealth.status === 'ok' ? 'ok' : 'error',
      services: {
        vector: vectorHealth,
        ollama: {
          status: ollamaHealth.status === 'unknown' ? 'error' : ollamaHealth.status,
          error: ollamaHealth.error,
        },
      },
    }
  }
}

export const ragService = new RAGService()