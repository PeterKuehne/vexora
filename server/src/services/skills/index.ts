/**
 * Skill System - Barrel export and initialization
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { skillRegistry } from './SkillRegistry.js';
import { databaseService } from '../DatabaseService.js';

export { skillRegistry } from './SkillRegistry.js';
export { skillValidator } from './SkillValidator.js';
export { swarmPromotion } from './SwarmPromotion.js';
export type {
  Skill,
  SkillDefinition,
  SkillScope,
  SkillExecution,
  SkillVote,
  SkillUserContext,
  SkillQueryOptions,
  SkillExecutionStatus,
} from './types.js';

/**
 * Load built-in skill definitions from JSON files
 */
function loadBuiltinSkills(): Array<{
  slug: string;
  name: string;
  description: string;
  definition: any;
  category: string;
  tags: string[];
}> {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const builtinDir = join(__dirname, 'builtin');

  const files = ['skill-creator.json', 'document-summary.json', 'research-report.json'];

  return files.map(file => {
    const content = readFileSync(join(builtinDir, file), 'utf-8');
    return JSON.parse(content);
  });
}

/**
 * Initialize the skill system - seed built-in skills
 */
export async function initializeSkillSystem(): Promise<void> {
  try {
    // Find or create a system user for built-in skills
    const systemUser = await databaseService.query(
      `SELECT id FROM users WHERE email = 'system@cor7ex.ai' LIMIT 1`
    );

    let systemUserId: string;

    if (systemUser.rows.length > 0) {
      systemUserId = systemUser.rows[0].id;
    } else {
      // Use the first admin user as fallback
      const adminUser = await databaseService.query(
        `SELECT id FROM users WHERE role = 'Admin' ORDER BY created_at ASC LIMIT 1`
      );

      if (adminUser.rows.length === 0) {
        console.warn('[SkillSystem] No admin user found, skipping built-in skill seeding');
        return;
      }

      systemUserId = adminUser.rows[0].id;
    }

    const builtinSkills = loadBuiltinSkills();
    await skillRegistry.seedBuiltinSkills(builtinSkills, systemUserId);

    console.log('[SkillSystem] Skill system initialized');
  } catch (error) {
    // Don't fail server startup if skill seeding fails (table might not exist yet)
    console.warn('[SkillSystem] Initialization warning:', error instanceof Error ? error.message : error);
  }
}
