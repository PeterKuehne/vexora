/**
 * SkillValidator - Validates Markdown-based skill definitions
 */

import { toolRegistry } from '../agents/ToolRegistry.js';
import type { SkillDefinition } from './types.js';

export class SkillValidator {
  /**
   * Validate a skill definition
   */
  validateDefinition(def: unknown): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!def || typeof def !== 'object') {
      return { valid: false, errors: ['Definition muss ein Objekt sein'] };
    }

    const d = def as Record<string, unknown>;

    // Content (Markdown body) is required
    if (!d.content || typeof d.content !== 'string' || (d.content as string).trim().length === 0) {
      errors.push('"content" (Markdown-Instruktionen) ist erforderlich');
    }

    // Version
    if (!d.version || typeof d.version !== 'string') {
      errors.push('"version" ist erforderlich');
    }

    // Tools array
    if (!Array.isArray(d.tools)) {
      errors.push('"tools" muss ein Array sein');
    } else {
      const registeredTools = toolRegistry.getToolNames();
      for (const toolName of d.tools) {
        if (typeof toolName !== 'string') {
          errors.push('Tool-Name muss ein String sein');
        } else if (!registeredTools.includes(toolName)) {
          errors.push(`Tool "${toolName}" ist nicht in der ToolRegistry registriert`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Generate a URL-safe slug from a name
   */
  generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[äÄ]/g, 'ae')
      .replace(/[öÖ]/g, 'oe')
      .replace(/[üÜ]/g, 'ue')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 100);
  }
}

export const skillValidator = new SkillValidator();
