/**
 * Conversations Routes - CRUD for server-side conversation storage
 */

import { Router, type Response } from 'express';
import { asyncHandler, authenticateToken } from '../middleware/index.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import { conversationService } from '../services/ConversationService.js';

const router = Router();

// List conversations (paginated)
router.get('/', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;
  const includeArchived = req.query.includeArchived === 'true';

  const result = await conversationService.listConversations(
    req.user!.user_id,
    req.user!.role,
    { limit, offset, includeArchived }
  );

  res.json({
    success: true,
    conversations: result.conversations,
    total: result.total,
    limit,
    offset,
  });
}))

// Create new conversation
router.post('/', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { title, model } = req.body;

  const conversation = await conversationService.createConversation(
    req.user!.user_id,
    req.user!.role,
    { title, model }
  );

  res.status(201).json({
    success: true,
    conversation,
  });
}))

// Get conversation with messages
router.get('/:id', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await conversationService.getConversation(
    req.user!.user_id,
    req.user!.role,
    req.params.id!
  );

  if (!result) {
    res.status(404).json({
      error: 'Konversation nicht gefunden',
      code: 'CONVERSATION_NOT_FOUND',
    });
    return;
  }

  res.json({
    success: true,
    conversation: result.conversation,
    messages: result.messages,
  });
}))

// Update conversation (title, pin, archive)
router.patch('/:id', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { title, isPinned, isArchived, model } = req.body;

  const conversation = await conversationService.updateConversation(
    req.user!.user_id,
    req.user!.role,
    req.params.id!,
    { title, isPinned, isArchived, model }
  );

  if (!conversation) {
    res.status(404).json({
      error: 'Konversation nicht gefunden',
      code: 'CONVERSATION_NOT_FOUND',
    });
    return;
  }

  res.json({
    success: true,
    conversation,
  });
}))

// Delete conversation
router.delete('/:id', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const deleted = await conversationService.deleteConversation(
    req.user!.user_id,
    req.user!.role,
    req.params.id!
  );

  if (!deleted) {
    res.status(404).json({
      error: 'Konversation nicht gefunden',
      code: 'CONVERSATION_NOT_FOUND',
    });
    return;
  }

  res.json({
    success: true,
    message: 'Konversation gelöscht',
  });
}))

// Get messages for a conversation (paginated)
router.get('/:id/messages', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 100;
  const offset = parseInt(req.query.offset as string) || 0;

  const result = await conversationService.getMessages(
    req.user!.user_id,
    req.user!.role,
    req.params.id!,
    { limit, offset }
  );

  res.json({
    success: true,
    messages: result.messages,
    total: result.total,
    limit,
    offset,
  });
}))

// Add message to conversation
router.post('/:id/messages', authenticateToken, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { role, content, model, tokenCount, sources, thinkingContent } = req.body;

  if (!role || !content) {
    res.status(400).json({
      error: 'role und content sind erforderlich',
      code: 'MISSING_REQUIRED_FIELDS',
    });
    return;
  }

  const message = await conversationService.addMessage(
    req.user!.user_id,
    req.user!.role,
    req.params.id!,
    { role, content, model, tokenCount, sources, thinkingContent }
  );

  res.status(201).json({
    success: true,
    message,
  });
}))

export default router;
