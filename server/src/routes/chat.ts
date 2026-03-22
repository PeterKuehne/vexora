/**
 * Chat Routes - Main LLM chat endpoint with streaming and RAG support
 *
 * Migrated to Vercel AI SDK 6 for LLM calls.
 * RAG streaming still uses the RAGService pipeline.
 */

import { Router, type Response } from 'express';
import { generateText, streamText } from 'ai';
import { asyncHandler, authenticateToken } from '../middleware/index.js';
import { ValidationError } from '../errors/index.js';
import {
  chatRequestSchema,
  validate,
  formatValidationErrors,
  type ChatRequest,
} from '../validation/index.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import { ragService } from '../services/index.js';
import { resolveModel, parseModelString, isCloudModel } from '../services/agents/ai-provider.js';
import { createGuardedModel } from '../services/agents/ai-middleware.js';

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

    let clientDisconnected = false

    // Handle client disconnect - cancel any active streams
    res.on('close', () => {
      if (!res.writableEnded) {
        clientDisconnected = true
      }
    })

    if (ragEnabled && ragQuery) {
      // RAG-enabled streaming response (still uses RAGService pipeline)
      try {
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

        const reader = ragResponse.stream.getReader()
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
      // Standard streaming response (non-RAG) — AI SDK streamText
      const modelId = chatRequest.model || 'qwen3:8b';

      try {
        // Resolve model with PII guard for cloud models
        const baseModel = resolveModel(modelId);
        const model = createGuardedModel(baseModel, isCloudModel(modelId));

        // Extract system messages and conversation messages
        const systemMessages = chatRequest.messages.filter(m => m.role === 'system');
        const conversationMessages = chatRequest.messages.filter(m => m.role !== 'system');
        const systemPrompt = systemMessages.length > 0
          ? systemMessages.map(m => m.content).join('\n\n')
          : undefined;

        const abortController = new AbortController();
        res.on('close', () => abortController.abort());

        const result = streamText({
          model,
          system: systemPrompt,
          messages: conversationMessages.map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
          temperature: chatRequest.options?.temperature,
          topP: chatRequest.options?.top_p,
          topK: chatRequest.options?.top_k,
          maxOutputTokens: chatRequest.options?.num_predict,
          abortSignal: abortController.signal,
        });

        // Stream text chunks in the existing SSE format
        for await (const chunk of result.textStream) {
          if (clientDisconnected) break;
          res.write(`data: ${JSON.stringify({ message: { content: chunk }, done: false })}\n\n`);
        }

        if (!clientDisconnected) {
          // Send final metadata
          const usage = await result.usage;
          const finishReason = await result.finishReason;
          res.write(`data: ${JSON.stringify({
            done: true,
            model: modelId,
            inputTokens: usage?.inputTokens,
            outputTokens: usage?.outputTokens,
            finishReason,
          })}\n\n`);
          res.write('data: [DONE]\n\n');
          res.end();
        }
      } catch (error) {
        if (!clientDisconnected) {
          console.error('Stream failed:', error);
          res.write(`data: ${JSON.stringify({ error: error instanceof Error ? error.message : 'Stream failed' })}\n\n`);
          res.end();
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
        const modelId = chatRequest.model || 'qwen3:8b';
        const baseModel = resolveModel(modelId);
        const model = createGuardedModel(baseModel, isCloudModel(modelId));

        const systemMessages = chatRequest.messages.filter(m => m.role === 'system');
        const conversationMessages = chatRequest.messages.filter(m => m.role !== 'system');
        const systemPrompt = systemMessages.length > 0
          ? systemMessages.map(m => m.content).join('\n\n')
          : undefined;

        const result = await generateText({
          model,
          system: systemPrompt,
          messages: conversationMessages.map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
          temperature: chatRequest.options?.temperature,
          topP: chatRequest.options?.top_p,
          topK: chatRequest.options?.top_k,
          maxOutputTokens: chatRequest.options?.num_predict,
        });

        // Return in Ollama-compatible format for backward compat
        res.json({
          model: modelId,
          message: { role: 'assistant', content: result.text },
          done: true,
          prompt_eval_count: result.usage?.inputTokens,
          eval_count: result.usage?.outputTokens,
        })
      } catch (chatError) {
        console.error('Chat failed:', chatError)
        res.status(500).json({ error: chatError instanceof Error ? chatError.message : 'Chat generation failed' })
      }
    }
  }
}))

export default router;
