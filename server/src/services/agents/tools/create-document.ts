/**
 * Create Document Tool - Creates a new text document in the system
 */

import { z } from 'zod';
import type { AgentTool, AgentUserContext, ToolResult } from '../types.js';
import { databaseService } from '../../DatabaseService.js';
import { randomUUID } from 'crypto';

export const createDocumentTool: AgentTool = {
  name: 'create_document',
  description: 'Create a new text document in the system. The document will be owned by the current user and can be further processed by the document pipeline.',
  inputSchema: z.object({
    title: z.string().describe('The document title/filename'),
    content: z.string().describe('The document content (plain text or markdown)'),
    classification: z.enum(['public', 'internal', 'confidential', 'restricted']).optional().describe('Document classification level (default: "internal")'),
  }),
  parameters: {
    type: 'object',
    required: ['title', 'content'],
    properties: {
      title: {
        type: 'string',
        description: 'The document title/filename',
      },
      content: {
        type: 'string',
        description: 'The document content (plain text or markdown)',
      },
      classification: {
        type: 'string',
        description: 'Document classification level (default: "internal")',
        enum: ['public', 'internal', 'confidential', 'restricted'],
      },
    },
  },

  async execute(args: Record<string, unknown>, context: AgentUserContext): Promise<ToolResult> {
    try {
      const title = args.title as string;
      const content = args.content as string;
      const classification = (args.classification as string) || 'internal';
      const id = randomUUID();

      await databaseService.query(
        `INSERT INTO documents (id, original_name, mime_type, file_size, owner_id, classification, status, source_type, source_task_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'ready', 'agent', $7, NOW())`,
        [id, title, 'text/plain', Buffer.byteLength(content, 'utf8'), context.userId, classification, context.taskId || null]
      );

      return {
        output: `Dokument "${title}" erstellt (ID: ${id}, Klassifizierung: ${classification}).`,
        metadata: { documentId: id, title, classification },
      };
    } catch (error) {
      return {
        output: `Fehler beim Erstellen des Dokuments: ${error instanceof Error ? error.message : String(error)}`,
        error: String(error),
      };
    }
  },
};
