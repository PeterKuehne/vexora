/**
 * Create Skill Tool - Saves a new skill to the database
 *
 * Used by the Skill Creator workflow: after the agent drafts a skill,
 * it calls this tool to persist it. The skill is created as 'personal'
 * scope and can later be shared/promoted.
 */

import type { AgentTool, AgentUserContext, ToolResult } from '../types.js';
import { skillRegistry } from '../../skills/SkillRegistry.js';
import { skillValidator } from '../../skills/SkillValidator.js';

export const createSkillTool: AgentTool = {
  name: 'create_skill',
  description: 'Save a new skill to the database. Provide name, description (with trigger phrases), category, tags, the Markdown instruction body, recommended tools, and version. The skill is created as personal scope.',
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

      const definition = { content, tools, version: '1.0.0' };

      // Validate
      const validation = skillValidator.validateDefinition(definition);
      if (!validation.valid) {
        return {
          output: `Skill-Definition ungültig:\n${validation.errors.join('\n')}\n\nBitte korrigiere die Definition.`,
          error: 'validation failed',
        };
      }

      const skill = await skillRegistry.createSkill(
        { userId: context.userId, userRole: context.userRole, department: context.department },
        { name, description, definition, category, tags }
      );

      return {
        output: `Skill "${skill.name}" erfolgreich erstellt!\n\nSlug: ${skill.slug}\nScope: personal\nTools: ${tools.join(', ')}\nKategorie: ${category}\n\nDer Skill ist jetzt als persönlicher Skill verfügbar. Du kannst ihn mit load_skill("${skill.slug}") laden und testen.`,
        metadata: { skillId: skill.id, slug: skill.slug },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { output: `Fehler beim Erstellen des Skills: ${message}`, error: message };
    }
  },
};
