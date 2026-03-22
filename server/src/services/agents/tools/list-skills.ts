/**
 * List Skills Tool - Skill discovery
 *
 * Returns available skills with their descriptions.
 * The agent uses this when the system prompt skill summary
 * isn't sufficient, e.g. to search for skills by category.
 */

import type { AgentTool, AgentUserContext, ToolResult } from '../types.js';
import { skillRegistry } from '../../skills/SkillRegistry.js';

export const listSkillsTool: AgentTool = {
  name: 'list_skills',
  description: 'List available skills with descriptions. Use this to discover skills by category or search term. Skills are pre-built workflows — load one with load_skill to get its full instructions.',
  parameters: {
    type: 'object',
    required: [],
    properties: {
      category: {
        type: 'string',
        description: 'Optional: filter by specific category (e.g., "recherche", "zusammenfassung", "analyse", "meta"). Omit this parameter to list ALL skills.',
      },
      search: {
        type: 'string',
        description: 'Search skills by name or description',
      },
    },
  },

  async execute(args: Record<string, unknown>, context: AgentUserContext): Promise<ToolResult> {
    try {
      console.log('[ListSkillsTool] Querying with args:', JSON.stringify(args), 'context:', {
        userId: context.userId,
        userRole: context.userRole,
        department: context.department,
      });

      // Ignore generic category values that the LLM might hallucinate
      const category = args.category as string | undefined;
      const validCategory = category && !['all', 'alle', 'any', '*'].includes(category.toLowerCase())
        ? category
        : undefined;

      const { skills } = await skillRegistry.getSkills(
        {
          userId: context.userId,
          userRole: context.userRole,
          department: context.department,
        },
        {
          category: validCategory,
          search: args.search as string | undefined,
          limit: 20,
        }
      );

      console.log(`[ListSkillsTool] Found ${skills.length} skills`);

      if (skills.length === 0) {
        return { output: 'Keine Skills gefunden.', metadata: { count: 0 } };
      }

      const formatted = skills.map(skill => {
        const tools = skill.definition.tools.length > 0
          ? ` | Tools: ${skill.definition.tools.join(', ')}`
          : '';
        return `- **${skill.name}** [slug: ${skill.slug}]${tools}\n  ${skill.description || '(keine Beschreibung)'}`;
      });

      return {
        output: `${skills.length} Skills verfügbar:\n\n${formatted.join('\n\n')}\n\nNutze load_skill mit dem Slug um die vollständigen Instruktionen zu laden.`,
        metadata: { count: skills.length },
      };
    } catch (error) {
      return {
        output: `Fehler beim Laden der Skills: ${error instanceof Error ? error.message : String(error)}`,
        error: String(error),
      };
    }
  },
};
