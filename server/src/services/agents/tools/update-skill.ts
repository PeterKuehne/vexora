/**
 * Update Skill Tool - Updates an existing skill in the database
 *
 * Used during the skill iteration loop: after testing and getting feedback,
 * the agent updates the skill's content, description, or other fields.
 */

import type { AgentTool, AgentUserContext, ToolResult } from '../types.js';
import { skillRegistry } from '../../skills/SkillRegistry.js';
import { skillValidator } from '../../skills/SkillValidator.js';

export const updateSkillTool: AgentTool = {
  name: 'update_skill',
  description: 'Update an existing skill. Use this during the iterate-and-improve loop after testing a skill and receiving feedback. You can update content, description, tools, or any other field.',
  parameters: {
    type: 'object',
    required: ['slug'],
    properties: {
      slug: {
        type: 'string',
        description: 'The skill slug to update (from list_skills or create_skill output)',
      },
      name: {
        type: 'string',
        description: 'New name (optional)',
      },
      description: {
        type: 'string',
        description: 'New description with trigger phrases (optional)',
      },
      content: {
        type: 'string',
        description: 'New Markdown instruction body (optional)',
      },
      tools: {
        type: 'string',
        description: 'New JSON array of recommended tool names (optional)',
      },
      category: {
        type: 'string',
        description: 'New category (optional)',
      },
      tags: {
        type: 'string',
        description: 'New JSON array of tags (optional)',
      },
    },
  },

  async execute(args: Record<string, unknown>, context: AgentUserContext): Promise<ToolResult> {
    try {
      const slug = args.slug as string;
      if (!slug) {
        return { output: 'Fehler: slug ist erforderlich.', error: 'missing slug' };
      }

      // Find skill by slug
      const ctx = { userId: context.userId, userRole: context.userRole, department: context.department };
      const skill = await skillRegistry.getSkillBySlug(ctx, slug);

      if (!skill) {
        return { output: `Skill "${slug}" nicht gefunden.`, error: 'not found' };
      }

      // Build update data
      const updateData: Record<string, any> = {};

      if (args.name) updateData.name = args.name;
      if (args.description) updateData.description = args.description;
      if (args.category) updateData.category = args.category;

      if (args.tags) {
        try {
          updateData.tags = typeof args.tags === 'string' ? JSON.parse(args.tags) : args.tags;
        } catch { /* ignore */ }
      }

      // Update definition if content or tools changed
      if (args.content || args.tools) {
        const newContent = (args.content as string) || skill.definition.content;
        let newTools = skill.definition.tools;
        if (args.tools) {
          try {
            newTools = typeof args.tools === 'string' ? JSON.parse(args.tools) : args.tools;
          } catch { /* keep existing */ }
        }

        const newDefinition = {
          content: newContent,
          tools: newTools,
          version: skill.definition.version,
        };

        const validation = skillValidator.validateDefinition(newDefinition);
        if (!validation.valid) {
          return {
            output: `Definition ungültig:\n${validation.errors.join('\n')}`,
            error: 'validation failed',
          };
        }

        updateData.definition = newDefinition;
      }

      if (Object.keys(updateData).length === 0) {
        return { output: 'Keine Änderungen angegeben.', error: 'no changes' };
      }

      const updated = await skillRegistry.updateSkill(ctx, skill.id, updateData);

      if (!updated) {
        return { output: 'Skill konnte nicht aktualisiert werden (keine Berechtigung?).', error: 'update failed' };
      }

      return {
        output: `Skill "${updated.name}" erfolgreich aktualisiert!\n\nGeänderte Felder: ${Object.keys(updateData).join(', ')}\nSlug: ${updated.slug}`,
        metadata: { skillId: updated.id, slug: updated.slug },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { output: `Fehler beim Aktualisieren: ${message}`, error: message };
    }
  },
};
