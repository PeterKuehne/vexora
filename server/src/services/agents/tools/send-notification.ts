/**
 * Send Notification Tool - Sends a real-time notification via Socket.io
 */

import { z } from 'zod';
import type { AgentTool, AgentUserContext, ToolResult } from '../types.js';

export const sendNotificationTool: AgentTool = {
  name: 'send_notification',
  description: 'Send a notification to the current user session. Use this to alert the user about important findings, completed analyses, or required actions.',
  inputSchema: z.object({
    message: z.string().describe('The notification message to display to the user'),
    type: z.enum(['info', 'success', 'warning', 'error']).optional().describe('Notification type (default: "info")'),
  }),
  parameters: {
    type: 'object',
    required: ['message'],
    properties: {
      message: {
        type: 'string',
        description: 'The notification message to display to the user',
      },
      type: {
        type: 'string',
        description: 'Notification type (default: "info")',
        enum: ['info', 'success', 'warning', 'error'],
      },
    },
  },

  async execute(args: Record<string, unknown>, context: AgentUserContext): Promise<ToolResult> {
    try {
      const message = args.message as string;
      const type = (args.type as string) || 'info';

      // Dynamic import to get the io instance
      const { io } = await import('../../../index.js');

      io.emit('agent:notification', {
        userId: context.userId,
        message,
        type,
        timestamp: new Date().toISOString(),
      });

      return {
        output: `Benachrichtigung gesendet: "${message}"`,
        metadata: { type },
      };
    } catch (error) {
      return {
        output: `Benachrichtigung konnte nicht gesendet werden: ${error instanceof Error ? error.message : String(error)}`,
        error: String(error),
      };
    }
  },
};
