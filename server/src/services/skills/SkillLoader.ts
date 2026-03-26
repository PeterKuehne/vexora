/**
 * SkillLoader - Filesystem operations for SKILL.md files
 *
 * Parses, validates, scans, and writes SKILL.md files following
 * the Anthropic Agent Skills Standard (YAML frontmatter + Markdown body).
 */

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync } from 'fs';
import { join, basename } from 'path';
import matter from 'gray-matter';

// ============================================
// Types
// ============================================

export interface SkillFile {
  /** Frontmatter: kebab-case identifier */
  name: string;
  /** Frontmatter: what the skill does + trigger phrases */
  description: string;
  /** Frontmatter: space-delimited tool names */
  allowedTools?: string;
  /** Frontmatter: string-to-string metadata */
  metadata?: Record<string, string>;
  /** Frontmatter: license identifier */
  license?: string;
  /** Frontmatter: compatibility info */
  compatibility?: string;
  /** Markdown body (the skill instructions) */
  body: string;
  /** Display name extracted from first # heading, or title-cased name */
  displayName: string;
}

// ============================================
// Validation
// ============================================

const ALLOWED_FRONTMATTER_KEYS = new Set([
  'name', 'description', 'allowed-tools', 'metadata', 'license', 'compatibility',
]);

const NAME_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const MAX_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 1024;

const RESERVED_WORDS = new Set([
  'skill', 'skills', 'system', 'admin', 'root', 'config', 'settings',
  'api', 'internal', 'test', 'debug',
]);

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate frontmatter data against the standard.
 */
export function validateFrontmatter(
  data: Record<string, unknown>,
  folderName?: string
): ValidationResult {
  const errors: string[] = [];

  // Check for unknown keys
  for (const key of Object.keys(data)) {
    if (!ALLOWED_FRONTMATTER_KEYS.has(key)) {
      errors.push(`Unknown frontmatter key: "${key}". Allowed: ${[...ALLOWED_FRONTMATTER_KEYS].join(', ')}`);
    }
  }

  // name: required, regex, no double hyphens, max length
  if (!data.name || typeof data.name !== 'string') {
    errors.push('Frontmatter "name" is required and must be a string');
  } else {
    const name = data.name as string;
    if (name.length > MAX_NAME_LENGTH) {
      errors.push(`Name exceeds ${MAX_NAME_LENGTH} characters`);
    }
    if (!NAME_REGEX.test(name)) {
      errors.push(`Name "${name}" must match ${NAME_REGEX} (lowercase alphanumeric + hyphens, no leading/trailing hyphens)`);
    }
    if (name.includes('--')) {
      errors.push('Name must not contain double hyphens (--)');
    }
    if (RESERVED_WORDS.has(name)) {
      errors.push(`Name "${name}" is a reserved word`);
    }
    // name must match folder name if provided
    if (folderName && name !== folderName) {
      errors.push(`Name "${name}" does not match folder name "${folderName}"`);
    }
  }

  // description: required, max length, no XML tags
  if (!data.description || typeof data.description !== 'string') {
    errors.push('Frontmatter "description" is required and must be a string');
  } else {
    const desc = data.description as string;
    if (desc.length > MAX_DESCRIPTION_LENGTH) {
      errors.push(`Description exceeds ${MAX_DESCRIPTION_LENGTH} characters`);
    }
    if (/<[^>]*>/.test(desc)) {
      errors.push('Description must not contain XML/HTML tags');
    }
  }

  // allowed-tools: optional string
  if (data['allowed-tools'] !== undefined && typeof data['allowed-tools'] !== 'string') {
    errors.push('"allowed-tools" must be a space-delimited string');
  }

  // metadata: optional, all values must be strings
  if (data.metadata !== undefined) {
    if (typeof data.metadata !== 'object' || data.metadata === null || Array.isArray(data.metadata)) {
      errors.push('"metadata" must be an object with string values');
    } else {
      for (const [k, v] of Object.entries(data.metadata as Record<string, unknown>)) {
        if (typeof v !== 'string') {
          errors.push(`metadata.${k} must be a string, got ${typeof v}`);
        }
      }
    }
  }

  // license: optional string
  if (data.license !== undefined && typeof data.license !== 'string') {
    errors.push('"license" must be a string');
  }

  // compatibility: optional string
  if (data.compatibility !== undefined && typeof data.compatibility !== 'string') {
    errors.push('"compatibility" must be a string');
  }

  return { valid: errors.length === 0, errors };
}

// ============================================
// Display Name Extraction
// ============================================

/**
 * Extract display name from first # heading in body.
 * Fallback: title-case the name field.
 */
function extractDisplayName(body: string, name: string): string {
  const match = body.match(/^#\s+(.+)$/m);
  if (match?.[1]) {
    return match[1].trim();
  }
  // Title-case fallback: "research-report" → "Research Report"
  return name
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ============================================
// Core Functions
// ============================================

/**
 * Parse a SKILL.md file. Returns SkillFile with frontmatter + body.
 */
export function parseSkillFile(filePath: string): SkillFile {
  const raw = readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);

  const body = content.trim();
  const name = data.name as string;
  const displayName = extractDisplayName(body, name || '');

  return {
    name,
    description: data.description as string,
    allowedTools: data['allowed-tools'] as string | undefined,
    metadata: data.metadata as Record<string, string> | undefined,
    license: data.license as string | undefined,
    compatibility: data.compatibility as string | undefined,
    body,
    displayName,
  };
}

/**
 * Scan a directory for subdirectories containing SKILL.md files.
 * Returns array of { folderName, filePath, skillFile }.
 */
export function scanSkillDirectory(dirPath: string): Array<{
  folderName: string;
  filePath: string;
  skillFile: SkillFile;
}> {
  if (!existsSync(dirPath)) {
    return [];
  }

  const results: Array<{ folderName: string; filePath: string; skillFile: SkillFile }> = [];

  const entries = readdirSync(dirPath);
  for (const entry of entries) {
    const entryPath = join(dirPath, entry);
    const skillMdPath = join(entryPath, 'SKILL.md');

    try {
      const stat = statSync(entryPath);
      if (stat.isDirectory() && existsSync(skillMdPath)) {
        const skillFile = parseSkillFile(skillMdPath);
        results.push({
          folderName: entry,
          filePath: skillMdPath,
          skillFile,
        });
      }
    } catch {
      // Skip entries that can't be read
    }
  }

  return results;
}

/**
 * Write a SKILL.md file with YAML frontmatter.
 */
export function writeSkillFile(dirPath: string, skill: SkillFile): string {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }

  const frontmatter: Record<string, unknown> = {
    name: skill.name,
    description: skill.description,
  };

  if (skill.allowedTools) {
    frontmatter['allowed-tools'] = skill.allowedTools;
  }
  if (skill.metadata && Object.keys(skill.metadata).length > 0) {
    frontmatter.metadata = skill.metadata;
  }
  if (skill.license) {
    frontmatter.license = skill.license;
  }
  if (skill.compatibility) {
    frontmatter.compatibility = skill.compatibility;
  }

  const content = matter.stringify(skill.body + '\n', frontmatter);
  const filePath = join(dirPath, 'SKILL.md');
  writeFileSync(filePath, content, 'utf-8');

  return filePath;
}

/**
 * List reference files in a skill's references/ directory.
 */
export function listReferences(skillDirPath: string): string[] {
  const refsDir = join(skillDirPath, 'references');
  if (!existsSync(refsDir)) {
    return [];
  }

  try {
    return readdirSync(refsDir).filter(f => {
      const stat = statSync(join(refsDir, f));
      return stat.isFile();
    });
  } catch {
    return [];
  }
}

/**
 * Read a specific reference file from a skill's references/ directory.
 */
export function readReference(skillDirPath: string, refName: string): string | null {
  const refPath = join(skillDirPath, 'references', refName);
  if (!existsSync(refPath)) {
    return null;
  }

  try {
    return readFileSync(refPath, 'utf-8');
  } catch {
    return null;
  }
}

// Singleton-style exports for convenience
export const skillLoader = {
  parseSkillFile,
  validateFrontmatter,
  scanSkillDirectory,
  writeSkillFile,
  listReferences,
  readReference,
};
