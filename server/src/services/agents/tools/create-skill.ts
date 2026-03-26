/**
 * Create Skill Tool - Saves a new skill as SKILL.md + DB pointer
 *
 * Used by the Skill Creator workflow: after the agent drafts a skill,
 * it calls this tool to persist it. The skill is created as 'personal'
 * scope and can later be shared/promoted.
 *
 * Writes SKILL.md to disk at server/user-skills/{tenant}/{slug}/
 * and creates a DB record with file_path pointing to it.
 */

import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { AgentTool, AgentUserContext, ToolResult } from '../types.js';
import { skillRegistry } from '../../skills/SkillRegistry.js';
import { skillValidator } from '../../skills/SkillValidator.js';
import { skillLoader } from '../../skills/SkillLoader.js';
import type { SkillFile } from '../../skills/SkillLoader.js';

export const createSkillTool: AgentTool = {
  name: 'create_skill',
  skillGated: 'skill-creator',
  description: 'Create a NEW skill. Only call this ONCE per skill — if the skill already exists, use update_skill instead. Provide name, description (with trigger phrases), Markdown instruction body, and recommended tools. Returns the slug for further operations (load_skill, update_skill, run_skill_test).',
  parameters: {
    type: 'object',
    required: ['name', 'description', 'content', 'tools'],
    properties: {
      name: {
        type: 'string',
        description: 'Skill name (kebab-case recommended, e.g. "data-analysis")',
      },
      description: {
        type: 'string',
        description: 'What the skill does AND when to trigger it. Include specific user phrases. Max 1024 chars. Example: "Analyzes CSV data and creates reports. Use when user says \'analyze data\', \'CSV report\', or \'Datenanalyse\'."',
      },
      content: {
        type: 'string',
        description: 'The full Markdown instruction body. Use imperative form, explain the why, include examples. Structure with ## headings for steps.',
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

      // Generate slug from name
      const slug = skillValidator.generateSlug(name);

      // Check for duplicate: does a skill with the same base slug already exist?
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

      // Create DB record with file_path pointer (no definition in DB)
      const skill = await skillRegistry.createSkill(
        { userId: context.userId, userRole: context.userRole, department: context.department },
        { name, description, filePath: skillDirRelative, category, tags }
      );

      return {
        output: `Skill "${skill.name}" erfolgreich erstellt!\n\nSlug: ${skill.slug}\nScope: personal\nTools: ${tools.join(', ')}\nKategorie: ${category}\nSKILL.md: ${skillDirRelative}/SKILL.md\n\nDer Skill ist jetzt als persönlicher Skill verfügbar. Du kannst ihn mit load_skill("${skill.slug}") laden und testen.`,
        metadata: { skillId: skill.id, slug: skill.slug },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { output: `Fehler beim Erstellen des Skills: ${message}`, error: message };
    }
  },
};
