/**
 * RAGService - Retrieval-Augmented Generation Service
 *
 * Combines vector search with chat completions to provide
 * context-aware responses with source citations.
 */

import { vectorService, type VectorSearchResponse } from './VectorService.js'
import { ollamaService } from './OllamaService.js'
import { type ChatMessage } from '../validation/index.js'

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
   */
  async generateResponse(request: RAGRequest): Promise<RAGResponse> {
    const {
      messages,
      model,
      query,
      searchLimit = 5,
      searchThreshold = 0.5,
      hybridAlpha = 0.5,
    } = request

    try {
      // Step 1: Search for relevant document chunks
      const searchResults = await vectorService.search({
        query,
        limit: searchLimit,
        threshold: searchThreshold,
        hybridAlpha,
      })

      // Step 2: Check if we found relevant sources
      const hasRelevantSources = searchResults.results.length > 0

      if (!hasRelevantSources) {
        // No relevant documents found - return standard response
        return {
          message: 'Entschuldigung, ich habe keine relevanten Informationen in den hochgeladenen Dokumenten zu Ihrer Frage gefunden. Bitte versuchen Sie eine andere Formulierung oder laden Sie weitere Dokumente hoch.',
          sources: [],
          searchResults,
          hasRelevantSources: false,
        }
      }

      // Step 3: Create context from search results
      const context = this.buildContext(searchResults)

      // Step 4: Create system prompt with context
      const systemPrompt = this.buildSystemPrompt(context)

      // Step 5: Prepare messages with RAG context
      const ragMessages: ChatMessage[] = [
        {
          role: 'system',
          content: systemPrompt,
        },
        ...messages,
      ]

      // Step 6: Get response from LLM
      const response = await ollamaService.chat({
        messages: ragMessages,
        model,
      })

      // Step 7: Extract sources for citation
      const sources: RAGSource[] = searchResults.results.map((result) => ({
        documentId: result.document.id,
        documentName: result.document.originalName,
        content: result.chunk.content.substring(0, 200) + '...', // Preview
        pageNumber: result.chunk.pageNumber,
        chunkIndex: result.chunk.chunkIndex,
        score: result.score,
      }))

      return {
        message: response.message.content,
        sources,
        searchResults,
        hasRelevantSources: true,
      }
    } catch (error) {
      console.error('❌ RAG generation failed:', error)
      throw error
    }
  }

  /**
   * Generate streaming RAG response
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
    } = request

    try {
      // Step 1: Search for relevant document chunks (same as above)
      const searchResults = await vectorService.search({
        query,
        limit: searchLimit,
        threshold: searchThreshold,
        hybridAlpha,
      })

      const hasRelevantSources = searchResults.results.length > 0

      if (!hasRelevantSources) {
        // Create a stream for the "no sources found" message
        const noSourcesMessage = 'Entschuldigung, ich habe keine relevanten Informationen in den hochgeladenen Dokumenten zu Ihrer Frage gefunden.'

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

      return {
        stream: ollamaResponse.body || new ReadableStream(),
        sources,
        searchResults,
        hasRelevantSources: true,
      }
    } catch (error) {
      console.error('❌ RAG streaming generation failed:', error)
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