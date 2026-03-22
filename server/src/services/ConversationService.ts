/**
 * ConversationService - CRUD for conversations and messages
 *
 * Conversations are stored in PostgreSQL with RLS for user isolation.
 * Replaces LocalStorage-based conversation management.
 */

import { generateText } from 'ai';
import { databaseService } from './DatabaseService.js';
import { resolveModel } from './agents/ai-provider.js';

export interface Conversation {
  id: string;
  userId: string;
  tenantId?: string | null;
  title: string | null;
  model: string | null;
  isPinned: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
  lastMessage?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string | null;
  tokenCount?: number | null;
  sources?: any | null;
  thinkingContent?: string | null;
  createdAt: string;
}

export interface CreateConversationInput {
  title?: string;
  model?: string;
}

export interface CreateMessageInput {
  role: 'user' | 'assistant' | 'system';
  content: string;
  model?: string;
  tokenCount?: number;
  sources?: any;
  thinkingContent?: string;
}

class ConversationService {
  /**
   * Set user context for RLS
   */
  private async setUserContext(userId: string, role: string): Promise<void> {
    await databaseService.query(
      `SELECT set_config('app.user_id', $1, true), set_config('app.user_role', $2, true)`,
      [userId, role]
    );
  }

  /**
   * List conversations for a user (paginated)
   */
  async listConversations(
    userId: string,
    role: string,
    options?: { limit?: number; offset?: number; includeArchived?: boolean }
  ): Promise<{ conversations: Conversation[]; total: number }> {
    await this.setUserContext(userId, role);

    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    const archiveFilter = options?.includeArchived ? '' : 'AND c.is_archived = FALSE';

    const countResult = await databaseService.query(
      `SELECT COUNT(*) as total FROM conversations c WHERE 1=1 ${archiveFilter}`
    );
    const total = parseInt(countResult.rows[0]?.total ?? '0');

    const result = await databaseService.query(
      `SELECT
        c.id, c.user_id, c.tenant_id, c.title, c.model,
        c.is_pinned, c.is_archived, c.created_at, c.updated_at,
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count,
        (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message
      FROM conversations c
      WHERE 1=1 ${archiveFilter}
      ORDER BY c.is_pinned DESC, c.updated_at DESC
      LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const conversations: Conversation[] = result.rows.map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      tenantId: row.tenant_id,
      title: row.title,
      model: row.model,
      isPinned: row.is_pinned,
      isArchived: row.is_archived,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      messageCount: parseInt(row.message_count ?? '0'),
      lastMessage: row.last_message?.substring(0, 100),
    }));

    return { conversations, total };
  }

  /**
   * Get a single conversation with its messages
   */
  async getConversation(
    userId: string,
    role: string,
    conversationId: string
  ): Promise<{ conversation: Conversation; messages: Message[] } | null> {
    await this.setUserContext(userId, role);

    const convResult = await databaseService.query(
      `SELECT id, user_id, tenant_id, title, model, is_pinned, is_archived, created_at, updated_at
       FROM conversations WHERE id = $1`,
      [conversationId]
    );

    if (convResult.rows.length === 0) return null;

    const row = convResult.rows[0]!;
    const conversation: Conversation = {
      id: row.id,
      userId: row.user_id,
      tenantId: row.tenant_id,
      title: row.title,
      model: row.model,
      isPinned: row.is_pinned,
      isArchived: row.is_archived,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    const msgResult = await databaseService.query(
      `SELECT id, conversation_id, role, content, model, token_count, sources, thinking_content, created_at
       FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
      [conversationId]
    );

    const messages: Message[] = msgResult.rows.map((r: any) => ({
      id: r.id,
      conversationId: r.conversation_id,
      role: r.role,
      content: r.content,
      model: r.model,
      tokenCount: r.token_count,
      sources: r.sources,
      thinkingContent: r.thinking_content,
      createdAt: r.created_at,
    }));

    return { conversation, messages };
  }

  /**
   * Create a new conversation
   */
  async createConversation(
    userId: string,
    role: string,
    input?: CreateConversationInput
  ): Promise<Conversation> {
    await this.setUserContext(userId, role);

    const result = await databaseService.query(
      `INSERT INTO conversations (user_id, title, model)
       VALUES ($1, $2, $3)
       RETURNING id, user_id, tenant_id, title, model, is_pinned, is_archived, created_at, updated_at`,
      [userId, input?.title || null, input?.model || null]
    );

    const row = result.rows[0]!;
    return {
      id: row.id,
      userId: row.user_id,
      tenantId: row.tenant_id,
      title: row.title,
      model: row.model,
      isPinned: row.is_pinned,
      isArchived: row.is_archived,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Update conversation (title, pin, archive)
   */
  async updateConversation(
    userId: string,
    role: string,
    conversationId: string,
    updates: { title?: string; isPinned?: boolean; isArchived?: boolean; model?: string }
  ): Promise<Conversation | null> {
    await this.setUserContext(userId, role);

    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.title !== undefined) {
      setClauses.push(`title = $${paramIndex++}`);
      values.push(updates.title);
    }
    if (updates.isPinned !== undefined) {
      setClauses.push(`is_pinned = $${paramIndex++}`);
      values.push(updates.isPinned);
    }
    if (updates.isArchived !== undefined) {
      setClauses.push(`is_archived = $${paramIndex++}`);
      values.push(updates.isArchived);
    }
    if (updates.model !== undefined) {
      setClauses.push(`model = $${paramIndex++}`);
      values.push(updates.model);
    }

    if (setClauses.length === 0) return null;

    values.push(conversationId);

    const result = await databaseService.query(
      `UPDATE conversations SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, user_id, tenant_id, title, model, is_pinned, is_archived, created_at, updated_at`,
      values
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0]!;
    return {
      id: row.id,
      userId: row.user_id,
      tenantId: row.tenant_id,
      title: row.title,
      model: row.model,
      isPinned: row.is_pinned,
      isArchived: row.is_archived,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Delete a conversation and all its messages
   */
  async deleteConversation(userId: string, role: string, conversationId: string): Promise<boolean> {
    await this.setUserContext(userId, role);

    const result = await databaseService.query(
      `DELETE FROM conversations WHERE id = $1 RETURNING id`,
      [conversationId]
    );

    return result.rows.length > 0;
  }

  /**
   * Get messages for a conversation (paginated)
   */
  async getMessages(
    userId: string,
    role: string,
    conversationId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<{ messages: Message[]; total: number }> {
    await this.setUserContext(userId, role);

    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;

    const countResult = await databaseService.query(
      `SELECT COUNT(*) as total FROM messages WHERE conversation_id = $1`,
      [conversationId]
    );
    const total = parseInt(countResult.rows[0]?.total ?? '0');

    const result = await databaseService.query(
      `SELECT id, conversation_id, role, content, model, token_count, sources, thinking_content, created_at
       FROM messages WHERE conversation_id = $1
       ORDER BY created_at ASC
       LIMIT $2 OFFSET $3`,
      [conversationId, limit, offset]
    );

    const messages: Message[] = result.rows.map((r: any) => ({
      id: r.id,
      conversationId: r.conversation_id,
      role: r.role,
      content: r.content,
      model: r.model,
      tokenCount: r.token_count,
      sources: r.sources,
      thinkingContent: r.thinking_content,
      createdAt: r.created_at,
    }));

    return { messages, total };
  }

  /**
   * Add a message to a conversation
   */
  async addMessage(
    userId: string,
    role: string,
    conversationId: string,
    input: CreateMessageInput
  ): Promise<Message> {
    await this.setUserContext(userId, role);

    const result = await databaseService.query(
      `INSERT INTO messages (conversation_id, role, content, model, token_count, sources, thinking_content)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, conversation_id, role, content, model, token_count, sources, thinking_content, created_at`,
      [
        conversationId,
        input.role,
        input.content,
        input.model || null,
        input.tokenCount || null,
        input.sources ? JSON.stringify(input.sources) : null,
        input.thinkingContent || null,
      ]
    );

    // Update conversation's updated_at timestamp
    await databaseService.query(
      `UPDATE conversations SET updated_at = NOW() WHERE id = $1`,
      [conversationId]
    );

    // Auto-generate title after first user message if title is null
    if (input.role === 'user') {
      const convResult = await databaseService.query(
        `SELECT title FROM conversations WHERE id = $1`,
        [conversationId]
      );
      if (!convResult.rows[0]?.title) {
        this.generateTitle(userId, role, conversationId, input.content).catch(err => {
          console.warn('[ConversationService] Title generation failed:', err);
        });
      }
    }

    const row = result.rows[0]!;
    return {
      id: row.id,
      conversationId: row.conversation_id,
      role: row.role,
      content: row.content,
      model: row.model,
      tokenCount: row.token_count,
      sources: row.sources,
      thinkingContent: row.thinking_content,
      createdAt: row.created_at,
    };
  }

  /**
   * Auto-generate a short title for a conversation based on the first user message
   */
  private async generateTitle(userId: string, role: string, conversationId: string, firstMessage: string): Promise<void> {
    try {
      const response = await generateText({
        model: resolveModel('qwen3:8b'),
        system: 'Generiere einen kurzen Titel (max 6 Wörter) für diese Konversation basierend auf der ersten Nachricht. Antworte NUR mit dem Titel, keine Erklärung.',
        prompt: firstMessage.substring(0, 500),
        maxOutputTokens: 30,
        temperature: 0.3,
        providerOptions: { ollama: { think: false } },
      });

      const title = response.text.replace(/<think>[\s\S]*?<\/think>/g, '').trim().replace(/^["']|["']$/g, '');

      if (title && title.length > 0 && title.length < 100) {
        await this.setUserContext(userId, role);
        await databaseService.query(
          `UPDATE conversations SET title = $1 WHERE id = $2`,
          [title, conversationId]
        );
      }
    } catch (error) {
      // Silently fail - title generation is not critical
      console.warn('[ConversationService] Auto-title generation failed:', error);
    }
  }
}

export const conversationService = new ConversationService();
