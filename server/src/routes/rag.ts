/**
 * RAG Routes - Search and chat with document context
 */

import { Router, type Response } from 'express';
import { asyncHandler, authenticateToken } from '../middleware/index.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import { ragService, documentService } from '../services/index.js';
import { authService } from '../services/AuthService.js';

const router = Router();

// RAG search - search for relevant documents
router.post('/search', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { query, searchLimit = 5, searchThreshold = 0.1, hybridAlpha = 0.3 } = req.body

  if (!query || typeof query !== 'string') {
    res.status(400).json({
      error: 'Search query is required',
      code: 'MISSING_QUERY',
      message: 'Query field must be provided as a string'
    })
    return
  }

  try {
    const userContext = req.user ? {
      userId: req.user.user_id,
      userRole: req.user.role,
      userDepartment: req.user.department,
    } : undefined

    const ragResponse = await ragService.generateResponse({
      messages: [],
      model: 'qwen3:8b',
      query,
      searchLimit,
      searchThreshold,
      hybridAlpha,
      userContext,
    })

    res.json({
      success: true,
      query,
      sources: ragResponse.sources,
      searchResults: ragResponse.searchResults,
      hasRelevantSources: ragResponse.hasRelevantSources,
      userContext: {
        role: req.user!.role,
        department: req.user!.department,
      }
    })
  } catch (error) {
    console.error('RAG search failed:', error)
    res.status(500).json({
      error: 'RAG search failed',
      code: 'RAG_SEARCH_ERROR',
      message: 'Failed to search documents with RAG'
    })
  }
}))

// RAG chat - generate response with document context
router.post('/chat', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const {
    messages,
    query,
    model = 'qwen3:8b',
    searchLimit = 5,
    searchThreshold = 0.1,
    hybridAlpha = 0.3
  } = req.body

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({
      error: 'Messages array is required',
      code: 'MISSING_MESSAGES',
      message: 'Messages field must be provided as a non-empty array'
    })
    return
  }

  if (!query || typeof query !== 'string') {
    res.status(400).json({
      error: 'Query is required',
      code: 'MISSING_QUERY',
      message: 'Query field must be provided as a string'
    })
    return
  }

  try {
    const userContext = req.user ? {
      userId: req.user.user_id,
      userRole: req.user.role,
      userDepartment: req.user.department,
    } : undefined

    const ragResponse = await ragService.generateResponse({
      messages,
      model,
      query,
      searchLimit,
      searchThreshold,
      hybridAlpha,
      userContext,
    })

    await authService.createAuditLog({
      userId: req.user?.user_id,
      userEmail: req.user?.email || 'unknown',
      action: 'rag_query',
      result: 'success',
      resourceType: 'query',
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      metadata: {
        query: query.substring(0, 200),
        model,
        hasRelevantSources: ragResponse.hasRelevantSources,
        sourcesCount: ragResponse.sources?.length || 0
      }
    });

    res.json({
      success: true,
      message: ragResponse.message,
      sources: ragResponse.sources,
      searchResults: ragResponse.searchResults,
      hasRelevantSources: ragResponse.hasRelevantSources,
      userContext: {
        role: req.user!.role,
        department: req.user!.department,
      }
    })
  } catch (error) {
    console.error('RAG chat failed:', error)

    await authService.createAuditLog({
      userId: req.user?.user_id,
      userEmail: req.user?.email || 'unknown',
      action: 'rag_query',
      result: 'failure',
      resourceType: 'query',
      ipAddress: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      metadata: {
        query: query.substring(0, 200),
        model,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });

    res.status(500).json({
      error: 'RAG chat failed',
      code: 'RAG_CHAT_ERROR',
      message: 'Failed to generate RAG response'
    })
  }
}))

// A-RAG (Agentic RAG) endpoint - experimental tool-based retrieval
router.post('/agentic', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { query, model, maxIterations, includeThinking } = req.body;

  if (!query || typeof query !== 'string') {
    res.status(400).json({
      error: 'Query is required',
      code: 'VALIDATION_ERROR',
    });
    return;
  }

  try {
    const { agenticRAG } = await import('../services/rag/AgenticRAG.js');

    if (model || maxIterations !== undefined || includeThinking !== undefined) {
      agenticRAG.setConfig({
        ...(model && { model }),
        ...(maxIterations !== undefined && { maxIterations }),
        ...(includeThinking !== undefined && { includeThinking }),
      });
    }

    let allowedDocumentIds: string[] | undefined;
    const user = req.user;
    if (user) {
      await documentService.setUserContext(
        user.user_id,
        user.role,
        user.department
      );
      allowedDocumentIds = await documentService.getAccessibleDocumentIds();
    }

    console.log(`🤖 A-RAG request from ${user?.email}: ${query.substring(0, 100)}...`);

    const result = await agenticRAG.query(query, allowedDocumentIds);

    if (user) {
      await documentService.clearUserContext();
    }

    res.json({
      answer: result.answer,
      sources: result.sources.map(s => ({
        documentId: s.document.id,
        documentName: s.document.originalName,
        content: s.chunk.content.substring(0, 200) + '...',
        pageNumber: s.chunk.pageStart,
        score: s.score,
      })),
      toolCalls: result.toolCalls,
      iterations: result.iterations,
      thinking: result.thinking,
      model: agenticRAG.getConfig().model,
    });
  } catch (error) {
    console.error('A-RAG query failed:', error);
    res.status(500).json({
      error: 'A-RAG query failed',
      code: 'AGENTIC_RAG_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}))

export default router;
