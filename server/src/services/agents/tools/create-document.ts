/**
 * Create Document Tool - Creates a text document and processes it through
 * the full document pipeline (parsing → chunking → Weaviate embedding).
 *
 * The document becomes searchable via rag_search after processing completes.
 */

import { z } from 'zod';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { AgentTool, AgentUserContext, ToolResult } from '../types.js';
import { processingJobService } from '../../ProcessingJobService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..', '..', '..');
const UPLOADS_DIR = join(PROJECT_ROOT, 'uploads');

export const createDocumentTool: AgentTool = {
  name: 'create_document',
  description: 'Erstellt ein neues Dokument im System. Das Dokument wird gespeichert, indexiert und ist anschliessend per rag_search durchsuchbar.',
  inputSchema: z.object({
    title: z.string().describe('Dokumenttitel/Dateiname (z.B. "AUeV_Mueller_Maria_2024.md")'),
    content: z.string().describe('Dokumentinhalt (Markdown oder Text)'),
    classification: z.enum(['public', 'internal', 'confidential', 'restricted']).optional().describe('Klassifizierung (default: "internal")'),
  }),
  parameters: {
    type: 'object',
    required: ['title', 'content'],
    properties: {
      title: { type: 'string', description: 'Dokumenttitel/Dateiname' },
      content: { type: 'string', description: 'Dokumentinhalt (Markdown oder Text)' },
      classification: {
        type: 'string',
        description: 'Klassifizierung (default: "internal")',
        enum: ['public', 'internal', 'confidential', 'restricted'],
      },
    },
  },

  async execute(args: Record<string, unknown>, context: AgentUserContext): Promise<ToolResult> {
    try {
      const title = args.title as string;
      const content = args.content as string;
      const classification = (args.classification as string) || 'internal';

      if (!title || !content) {
        return { output: 'Fehler: title und content sind erforderlich.', error: 'missing_fields' };
      }

      // Generate unique IDs (same pattern as upload handler)
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 11);
      const documentId = `doc_${timestamp}_${randomStr}`;

      // Ensure title ends with .md
      const filename = title.endsWith('.md') ? title : `${title}.md`;

      // Write content to uploads/ directory (same location as uploaded files)
      const diskFilename = `${timestamp}-${Math.floor(Math.random() * 1000000000)}.md`;
      const filePath = join(UPLOADS_DIR, diskFilename);

      writeFileSync(filePath, content, 'utf-8');
      console.log(`[CreateDocument] Saved ${content.length} chars to ${filePath}`);

      // Create processing job — triggers the full pipeline:
      // Parse → Chunk → Embed → Weaviate → PostgreSQL
      const job = processingJobService.createJob(
        documentId,
        diskFilename,
        filename,
        {
          ownerId: context.userId,
          department: context.department || null,
          classification,
          visibility: classification === 'confidential' || classification === 'restricted'
            ? 'only_me'
            : 'department',
          specificUsers: [],
          allowedRoles: null,
          allowedUsers: null,
        }
      );

      console.log(`[CreateDocument] Processing job created: ${job.id} for document ${documentId}`);

      return {
        output: `Dokument "${filename}" wird verarbeitet (Job: ${job.id}).\n\nDokument-ID: ${documentId}\nKlassifizierung: ${classification}\nStatus: Wird indexiert — nach wenigen Sekunden per rag_search durchsuchbar.`,
        metadata: {
          documentId,
          jobId: job.id,
          title: filename,
          classification,
          contentLength: content.length,
        },
      };
    } catch (error) {
      return {
        output: `Fehler beim Erstellen des Dokuments: ${error instanceof Error ? error.message : String(error)}`,
        error: String(error),
      };
    }
  },
};
