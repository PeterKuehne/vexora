/**
 * Chat Routes - Main LLM chat endpoint with streaming and RAG support
 */

import { Router, type Response } from 'express';
import { asyncHandler, authenticateToken } from '../middleware/index.js';
import { ValidationError } from '../errors/index.js';
import {
  chatRequestSchema,
  validate,
  formatValidationErrors,
  type ChatRequest,
} from '../validation/index.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import { ollamaService, ragService } from '../services/index.js';
import { llmRouter } from '../services/llm/index.js';

const router = Router();

router.post('/', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  // Validate request body with Zod schema
  const validation = validate(chatRequestSchema, req.body)
  if (!validation.success) {
    throw new ValidationError(formatValidationErrors(validation.errors), {
      field: 'body',
      details: validation.errors,
    })
  }

  const chatRequest: ChatRequest = validation.data
  const stream = chatRequest.stream // Zod sets default to true
  const ragEnabled = chatRequest.rag?.enabled === true

  // Determine the query for RAG search
  const ragQuery = ragEnabled
    ? (chatRequest.rag?.query || chatRequest.messages[chatRequest.messages.length - 1]?.content || '')
    : ''

  if (stream) {
    // Set up streaming response with SSE headers
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no') // Disable nginx buffering

    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
    let clientDisconnected = false

    // Handle client disconnect - cancel any active streams
    res.on('close', () => {
      if (!res.writableEnded) {
        clientDisconnected = true
        reader?.cancel().catch(() => {
          // Ignore cancel errors
        })
      }
    })

    if (ragEnabled && ragQuery) {
      // RAG-enabled streaming response
      try {
        // Extract user context for permission-aware RAG
        const userContext = req.user ? {
          userId: req.user.user_id,
          userRole: req.user.role,
          userDepartment: req.user.department,
        } : undefined;

        const ragResponse = await ragService.generateStreamingResponse({
          messages: chatRequest.messages,
          model: chatRequest.model || 'qwen3:8b',
          query: ragQuery,
          searchLimit: chatRequest.rag?.searchLimit || 5,
          searchThreshold: chatRequest.rag?.searchThreshold ?? 0.1,
          hybridAlpha: chatRequest.rag?.hybridAlpha ?? 0.3,
          userContext,
        })

        // Send sources first (as metadata)
        if (!clientDisconnected) {
          const sourcesMetadata = {
            type: 'sources',
            sources: ragResponse.sources,
            hasRelevantSources: ragResponse.hasRelevantSources,
          }
          res.write(`data: ${JSON.stringify(sourcesMetadata)}\n\n`)
        }

        reader = ragResponse.stream.getReader()
        if (!reader) {
          res.status(500).json({ error: 'Failed to get RAG response stream' })
          return
        }

        const decoder = new TextDecoder()

        try {
          while (!clientDisconnected) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n').filter((line) => line.trim())

            for (const line of lines) {
              if (clientDisconnected) break

              try {
                const parsed = JSON.parse(line)
                res.write(`data: ${JSON.stringify(parsed)}\n\n`)
              } catch {
                // Skip malformed JSON lines
              }
            }
          }

          if (!clientDisconnected) {
            res.write('data: [DONE]\n\n')
            res.end()
          }
        } catch (streamError) {
          if (!clientDisconnected) {
            console.error('RAG stream error:', streamError)
            res.write(
              `data: ${JSON.stringify({ error: 'RAG stream interrupted' })}\n\n`
            )
            res.end()
          }
        }
      } catch (ragError) {
        if (!clientDisconnected) {
          console.error('RAG generation failed, falling back to standard chat:', ragError)
          res.write(
            `data: ${JSON.stringify({ error: 'RAG nicht verfügbar, verwende Standard-Chat' })}\n\n`
          )
          res.end()
        }
      }
    } else {
      // Standard streaming response (non-RAG)
      const modelId = chatRequest.model || 'qwen3:8b';
      const { provider } = llmRouter.parseModel(modelId);
      const isCloudModel = provider !== 'ollama';

      if (isCloudModel) {
        // Cloud model streaming (Anthropic) via AsyncIterable
        try {
          const messages = chatRequest.messages.map(m => ({
            role: m.role as 'system' | 'user' | 'assistant',
            content: m.content,
          }));

          const stream = await llmRouter.chatStream(messages, modelId, {
            temperature: chatRequest.options?.temperature,
            topP: chatRequest.options?.top_p,
            topK: chatRequest.options?.top_k,
            maxTokens: chatRequest.options?.num_predict,
          });

          for await (const chunk of stream) {
            if (clientDisconnected) break;

            if (chunk.startsWith('\n__DONE__')) {
              const metadata = JSON.parse(chunk.substring(8));
              res.write(`data: ${JSON.stringify(metadata)}\n\n`);
            } else {
              res.write(`data: ${JSON.stringify({ message: { content: chunk }, done: false })}\n\n`);
            }
          }

          if (!clientDisconnected) {
            res.write('data: [DONE]\n\n');
            res.end();
          }
        } catch (error) {
          if (!clientDisconnected) {
            console.error('Cloud stream failed:', error);
            res.write(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : 'Stream failed' })}\n\n`);
            res.end();
          }
        }
      } else {
        // Ollama streaming (existing SSE logic with keep-alive)
        let keepAliveInterval: NodeJS.Timeout | null = null;

        try {
          if (!clientDisconnected) {
            res.write(`: stream started\n\n`);
            if (typeof (res as any).flush === 'function') {
              (res as any).flush();
            }
          }

          keepAliveInterval = setInterval(() => {
            if (!clientDisconnected) {
              res.write(`: keep-alive\n\n`);
              if (typeof (res as any).flush === 'function') {
                (res as any).flush();
              }
            }
          }, 500);

          const ollamaResponse = await ollamaService.chatStream({
            messages: chatRequest.messages,
            model: chatRequest.model,
            options: chatRequest.options,
          });

          if (keepAliveInterval) {
            clearInterval(keepAliveInterval);
            keepAliveInterval = null;
          }

          reader = ollamaResponse.body?.getReader()
          if (!reader) {
            res.status(500).json({ error: 'Failed to get response stream' })
            return
          }

          const decoder = new TextDecoder()

          try {
            while (!clientDisconnected) {
              const { done, value } = await reader.read()
              if (done) break;

              const chunk = decoder.decode(value, { stream: true })
              const lines = chunk.split('\n').filter((line) => line.trim())

              for (const line of lines) {
                if (clientDisconnected) break

                try {
                  const parsed = JSON.parse(line)
                  res.write(`data: ${JSON.stringify(parsed)}\n\n`)
                } catch {
                  // Skip malformed JSON lines
                }
              }
            }

            if (!clientDisconnected) {
              res.write('data: [DONE]\n\n')
              res.end()
            }
          } catch (streamError) {
            if (!clientDisconnected) {
              console.error('Stream error:', streamError)
              res.write(`data: ${JSON.stringify({ error: 'Stream interrupted' })}\n\n`)
              res.end()
            }
          }
        } catch (ollamaError) {
          if (keepAliveInterval) {
            clearInterval(keepAliveInterval);
            keepAliveInterval = null;
          }

          if (!clientDisconnected) {
            console.error('Ollama stream failed:', ollamaError)
            res.status(500).json({ error: 'Failed to get chat response' })
          }
        }
      }
    }
  } else {
    // Non-streaming response
    if (ragEnabled && ragQuery) {
      try {
        const userContext = req.user ? {
          userId: req.user.user_id,
          userRole: req.user.role,
          userDepartment: req.user.department,
        } : undefined;

        const ragResponse = await ragService.generateResponse({
          messages: chatRequest.messages,
          model: chatRequest.model || 'qwen3:8b',
          query: ragQuery,
          searchLimit: chatRequest.rag?.searchLimit || 5,
          searchThreshold: chatRequest.rag?.searchThreshold ?? 0.1,
          hybridAlpha: chatRequest.rag?.hybridAlpha ?? 0.3,
          userContext,
        })

        res.json({
          message: { content: ragResponse.message },
          sources: ragResponse.sources,
          hasRelevantSources: ragResponse.hasRelevantSources,
          type: 'rag',
        })
      } catch (ragError) {
        console.error('RAG generation failed:', ragError)
        res.status(500).json({ error: 'RAG generation failed' })
      }
    } else {
      try {
        const messages = chatRequest.messages.map(m => ({
          role: m.role as 'system' | 'user' | 'assistant',
          content: m.content,
        }));
        const response = await llmRouter.chat(messages, chatRequest.model || 'qwen3:8b', {
          temperature: chatRequest.options?.temperature,
          topP: chatRequest.options?.top_p,
          topK: chatRequest.options?.top_k,
          maxTokens: chatRequest.options?.num_predict,
        })
        // Return in Ollama-compatible format for backward compat
        res.json({
          model: response.model,
          message: { role: 'assistant', content: response.content },
          done: true,
          prompt_eval_count: response.inputTokens,
          eval_count: response.outputTokens,
          total_duration: response.totalDuration,
        })
      } catch (chatError) {
        console.error('Chat failed:', chatError)
        res.status(500).json({ error: chatError instanceof Error ? chatError.message : 'Chat generation failed' })
      }
    }
  }
}))

export default router;
