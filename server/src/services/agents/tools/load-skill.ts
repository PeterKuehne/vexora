/**
 * Load Skill Tool - Progressive Disclosure Level 2
 *
 * When the agent decides a skill is relevant (based on Level 1 descriptions
 * in the system prompt), it calls this tool to load the full Markdown
 * instructions. The agent then follows the instructions using its existing tools.
 *
 * This mirrors Anthropic's Skill tool in Claude Code:
 * - Level 1: name + description always in system prompt
 * - Level 2: load_skill returns the full instruction body
 * - Level 3: agent uses tools (rag_search, etc.) as instructed
 */

import type { AgentTool, AgentUserContext, ToolResult } from '../types.js';
import { skillRegistry } from '../../skills/SkillRegistry.js';

export const loadSkillTool: AgentTool = {
  name: 'load_skill',
  description: 'Load the full instructions of a skill by its slug. Use this when you identify a skill from the system prompt that matches the user\'s request. Returns the complete Markdown instructions that you should follow step by step.',
  parameters: {
    type: 'object',
    required: ['slug'],
    properties: {
      slug: {
        type: 'string',
        description: 'The skill slug (shown in the system prompt skill list)',
      },
    },
  },

  async execute(args: Record<string, unknown>, context: AgentUserContext): Promise<ToolResult> {
    try {
      const slug = args.slug as string;
      if (!slug) {
        return { output: 'Fehler: slug ist erforderlich.', error: 'missing slug' };
      }

      const skill = await skillRegistry.getSkillBySlug(
        { userId: context.userId, userRole: context.userRole, department: context.department },
        slug
      );

      if (!skill) {
        return {
          output: `Skill "${slug}" nicht gefunden. Verfügbare Skills sind im System-Prompt aufgelistet.`,
          error: 'skill not found',
        };
      }

      // Track that this skill was loaded (increment execution count)
      await skillRegistry.recordExecution(skill.id, null, context.userId, { loaded: true });

      // Return the full Markdown instructions
      const header = `# ${skill.name}\n\n`;
      const toolHint = skill.definition.tools.length > 0
        ? `**Empfohlene Tools:** ${skill.definition.tools.join(', ')}\n\n`
        : '';

      return {
        output: header + toolHint + skill.definition.content,
        metadata: {
          skillName: skill.name,
          skillSlug: slug,
          skillId: skill.id,
          tools: skill.definition.tools,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        output: `Fehler beim Laden des Skills: ${message}`,
        error: message,
      };
    }
  },
};
