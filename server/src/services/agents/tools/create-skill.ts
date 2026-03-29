/**
 * Create Skill Tool - Saves a new skill as SKILL.md + DB pointer
 *
 * Used by the Skill Creator workflow: after the agent drafts a skill,
 * it calls this tool to persist it. The skill is created as 'personal'
 * scope and can later be shared/promoted.
 *
 * Writes SKILL.md to disk at server/user-skills/{tenant}/{slug}/
 * and optionally creates references/ files for progressive disclosure.
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync, writeFileSync } from 'fs';
import { z } from 'zod';
import type { AgentTool, AgentUserContext, ToolResult } from '../types.js';
import { skillRegistry } from '../../skills/SkillRegistry.js';
import { skillValidator } from '../../skills/SkillValidator.js';
import { skillLoader } from '../../skills/SkillLoader.js';
import type { SkillFile } from '../../skills/SkillLoader.js';

export const createSkillTool: AgentTool = {
  name: 'create_skill',
  skillGated: 'skill-creator',
  description: 'Create a NEW skill with SKILL.md and optional references/ files. Only call this ONCE per skill — if the skill already exists, use update_skill instead. Returns the slug for further operations (load_skill, update_skill, compare_skill).',
  inputSchema: z.object({
    name: z.string().describe('Skill name (kebab-case recommended, e.g. "auev-generator")'),
    description: z.string().describe('What the skill does AND when to trigger it. Include specific user phrases. Max 1024 chars.'),
    content: z.string().describe('The full Markdown instruction body for SKILL.md. Use imperative form, reference files from references/ where needed.'),
    tools: z.string().describe('JSON array of recommended tool names, e.g. ["rag_search", "read_chunk"]'),
    category: z.string().optional().describe('Category: recherche, zusammenfassung, analyse, vergleich, erstellung, meta'),
    tags: z.string().optional().describe('JSON array of tags, e.g. ["recherche", "report"]'),
    references: z.string().optional().describe('JSON object of reference files to create in references/ directory. Keys are filenames, values are file contents. Example: {"auev-vorlage.md": "# AUeV Vorlage\\n...", "checkliste.md": "# Checkliste\\n..."}'),
  }),
  parameters: {
    type: 'object',
    required: ['name', 'description', 'content', 'tools'],
    properties: {
      name: {
        type: 'string',
        description: 'Skill name (kebab-case recommended, e.g. "auev-generator")',
      },
      description: {
        type: 'string',
        description: 'What the skill does AND when to trigger it. Include specific user phrases. Max 1024 chars.',
      },
      content: {
        type: 'string',
        description: 'The full Markdown instruction body for SKILL.md. Reference bundled resources clearly: "Before generating, consult references/vorlage.md for the template structure."',
      },
      tools: {
        type: 'string',
        description: 'JSON array of recommended tool names, e.g. ["rag_search", "read_chunk"]',
      },
      category: {
        type: 'string',
        description: 'Category: recherche, zusammenfassung, analyse, vergleich, erstellung, meta',
      },
      tags: {
        type: 'string',
        description: 'JSON array of tags, e.g. ["recherche", "report"]',
      },
      references: {
        type: 'string',
        description: 'JSON object: {"filename.md": "file content", ...}. Creates files in references/ directory for progressive disclosure.',
      },
    },
  },

  async execute(args: Record<string, unknown>, context: AgentUserContext): Promise<ToolResult> {
    try {
      const name = args.name as string;
      const description = args.description as string;
      const content = args.content as string;
      const category = (args.category as string) || 'analyse';

      if (!name || !description || !content) {
        return { output: 'Fehler: name, description und content sind erforderlich.', error: 'missing fields' };
      }

      // Parse tools array
      let tools: string[];
      try {
        tools = typeof args.tools === 'string' ? JSON.parse(args.tools) : (args.tools as string[]) || [];
      } catch {
        tools = [];
      }

      // Parse tags array
      let tags: string[];
      try {
        tags = typeof args.tags === 'string' ? JSON.parse(args.tags) : (args.tags as string[]) || [];
      } catch {
        tags = [];
      }

      // Parse references
      let references: Record<string, string> = {};
      if (args.references) {
        try {
          references = typeof args.references === 'string'
            ? JSON.parse(args.references)
            : (args.references as Record<string, string>) || {};
        } catch {
          // Invalid JSON — skip references
        }
      }

      // Generate slug from name
      const slug = skillValidator.generateSlug(name);

      // Check for duplicate
      const ctx = { userId: context.userId, userRole: context.userRole, department: context.department };
      const { skills: existing } = await skillRegistry.getSkills(ctx, { search: name, limit: 10 });
      const duplicate = existing.find(s => s.slug.startsWith(slug));
      if (duplicate) {
        return {
          output: `Ein Skill mit ähnlichem Namen existiert bereits:\n\n- **${duplicate.name}** [slug: ${duplicate.slug}]\n\nNutze update_skill(slug: "${duplicate.slug}") um ihn zu aktualisieren, oder wähle einen anderen Namen.`,
          error: 'duplicate',
          metadata: { existingSkillId: duplicate.id, existingSlug: duplicate.slug },
        };
      }

      // Build SKILL.md content
      const skillFile: SkillFile = {
        name: slug,
        description,
        allowedTools: tools.join(' '),
        metadata: {
          version: '1.0.0',
          category,
          tags: tags.join(' '),
        },
        body: content,
        displayName: name,
      };

      // Write SKILL.md to disk
      const __dirname = dirname(fileURLToPath(import.meta.url));
      const projectRoot = join(__dirname, '..', '..', '..', '..', '..');
      const tenant = context.tenantId || 'default';
      const skillDirRelative = `server/user-skills/${tenant}/${slug}`;
      const skillDirAbsolute = join(projectRoot, skillDirRelative);

      skillLoader.writeSkillFile(skillDirAbsolute, skillFile);

      // Write references/ files (progressive disclosure — Level 3)
      const refFiles: string[] = [];
      if (Object.keys(references).length > 0) {
        const refsDir = join(skillDirAbsolute, 'references');
        mkdirSync(refsDir, { recursive: true });

        for (const [filename, fileContent] of Object.entries(references)) {
          // Sanitize filename
          const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '-');
          const filePath = join(refsDir, safeName);
          writeFileSync(filePath, fileContent, 'utf-8');
          refFiles.push(safeName);
          console.log(`[CreateSkill] Created reference: ${skillDirRelative}/references/${safeName}`);
        }
      }

      // Create DB record with file_path pointer
      const skill = await skillRegistry.createSkill(
        { userId: context.userId, userRole: context.userRole, department: context.department },
        { name, description, filePath: skillDirRelative, category, tags }
      );

      // Build output
      let output = `Skill "${skill.name}" erfolgreich erstellt!\n\nSlug: ${skill.slug}\nScope: personal\nTools: ${tools.join(', ')}\nKategorie: ${category}\nSKILL.md: ${skillDirRelative}/SKILL.md`;

      if (refFiles.length > 0) {
        output += `\nReferences: ${refFiles.map(f => `${skillDirRelative}/references/${f}`).join(', ')}`;
      }

      output += `\n\nDer Skill ist jetzt verfuegbar. Teste ihn mit compare_skill(prompt: "...", skill_slug: "${skill.slug}").`;

      return {
        output,
        metadata: { skillId: skill.id, slug: skill.slug, references: refFiles },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { output: `Fehler beim Erstellen des Skills: ${message}`, error: message };
    }
  },
};
