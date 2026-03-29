/**
 * Run Script Tool — Executes Python scripts from skill directories via uv
 *
 * Enables deterministic operations: validation, benchmark aggregation,
 * report generation, description optimization. Scripts run in the skill's
 * directory with a 30s timeout.
 *
 * Security: Scripts must reside in the skill's scripts/ directory.
 * Uses `uv run` for automatic dependency management (no venv needed).
 */

import { z } from 'zod';
import { execFile } from 'child_process';
import { join, dirname, resolve, normalize } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { promisify } from 'util';
import type { AgentTool, AgentUserContext, ToolResult, ToolExecutionOptions } from '../types.js';
import { skillRegistry } from '../../skills/SkillRegistry.js';

const execFileAsync = promisify(execFile);

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..', '..', '..');

// Path to uv binary
const UV_PATH = process.env.UV_PATH || 'uv';

// Script execution limits
const TIMEOUT_MS = 30_000;
const MAX_BUFFER = 10 * 1024 * 1024; // 10MB

export const runScriptTool: AgentTool = {
  name: 'run_script',
  skillGated: 'skill-creator',
  description: 'Fuehrt ein Python-Script aus dem scripts/ Verzeichnis eines Skills aus. Nutze dies fuer Validierung (quick_validate.py), Benchmark-Aggregation (aggregate_benchmark.py), Report-Generierung (generate_report.py) und Beschreibungs-Optimierung (improve_description.py).',
  inputSchema: z.object({
    script: z.string().describe('Name des Scripts im scripts/ Verzeichnis (z.B. "quick_validate.py")'),
    skill_slug: z.string().describe('Slug des Skills dessen Script ausgefuehrt wird'),
    args: z.string().optional().describe('Zusaetzliche Kommandozeilen-Argumente'),
    input: z.string().optional().describe('Daten die via stdin an das Script uebergeben werden (z.B. JSON)'),
  }),
  parameters: {
    type: 'object',
    required: ['script', 'skill_slug'],
    properties: {
      script: { type: 'string', description: 'Script-Dateiname (z.B. "quick_validate.py")' },
      skill_slug: { type: 'string', description: 'Skill-Slug' },
      args: { type: 'string', description: 'CLI-Argumente' },
      input: { type: 'string', description: 'stdin-Daten (z.B. JSON)' },
    },
  },

  async execute(args: Record<string, unknown>, context: AgentUserContext, options?: ToolExecutionOptions): Promise<ToolResult> {
    const scriptName = args.script as string;
    const skillSlug = args.skill_slug as string;
    const cliArgs = (args.args as string | undefined)?.split(' ').filter(Boolean) || [];
    const stdinInput = args.input as string | undefined;

    if (!scriptName || !skillSlug) {
      return { output: 'Fehler: script und skill_slug sind erforderlich.', error: 'missing_fields' };
    }

    // Prevent path traversal
    if (scriptName.includes('..') || scriptName.includes('/')) {
      return { output: 'Fehler: Script-Name darf keine Pfad-Elemente enthalten.', error: 'invalid_script_name' };
    }

    // Resolve skill path
    const skill = await skillRegistry.getSkillBySlug(
      { userId: context.userId, userRole: context.userRole, department: context.department },
      skillSlug
    );

    let skillDir: string;

    if (skill?.filePath) {
      skillDir = resolve(PROJECT_ROOT, skill.filePath);
    } else {
      // Try built-in skills directory
      const builtinDir = join(PROJECT_ROOT, 'server', 'skills', skillSlug);
      if (existsSync(builtinDir)) {
        skillDir = builtinDir;
      } else {
        return { output: `Skill "${skillSlug}" nicht gefunden oder hat keinen Dateipfad.`, error: 'skill_not_found' };
      }
    }

    // Verify script exists in skill's scripts/ directory
    const scriptPath = join(skillDir, 'scripts', scriptName);
    const normalizedScript = normalize(scriptPath);

    if (!normalizedScript.startsWith(normalize(skillDir))) {
      return { output: 'Fehler: Script liegt ausserhalb des Skill-Verzeichnisses.', error: 'path_traversal' };
    }

    if (!existsSync(scriptPath)) {
      return {
        output: `Script "${scriptName}" nicht gefunden in ${skillDir}/scripts/. Verfuegbare Scripts koennen mit list_skills eingesehen werden.`,
        error: 'script_not_found',
      };
    }

    try {
      console.log(`[RunScript] Executing: uv run ${scriptPath} ${cliArgs.join(' ')}`);

      const childProcess = execFileAsync(UV_PATH, ['run', scriptPath, ...cliArgs], {
        timeout: TIMEOUT_MS,
        maxBuffer: MAX_BUFFER,
        cwd: skillDir,
        env: {
          ...process.env,
          SKILL_DIR: skillDir,
          SKILL_SLUG: skillSlug,
          PROJECT_ROOT,
        },
      });

      // Write stdin if provided
      if (stdinInput && childProcess.child?.stdin) {
        childProcess.child.stdin.write(stdinInput);
        childProcess.child.stdin.end();
      }

      const { stdout, stderr } = await childProcess;

      console.log(`[RunScript] Completed: ${scriptName} (${stdout.length} chars output)`);

      return {
        output: stdout || '(Keine Ausgabe)',
        error: stderr || undefined,
        metadata: {
          script: scriptName,
          skillSlug,
          exitCode: 0,
          outputLength: stdout.length,
        },
      };
    } catch (error: any) {
      const exitCode = error.code === 'ETIMEDOUT' ? -1 : (error.status || 1);
      const stdout = error.stdout || '';
      const stderr = error.stderr || error.message || String(error);

      console.error(`[RunScript] Failed: ${scriptName} (exit ${exitCode}): ${stderr.substring(0, 200)}`);

      if (error.code === 'ETIMEDOUT') {
        return {
          output: `Script-Timeout: ${scriptName} hat das Zeitlimit von ${TIMEOUT_MS / 1000}s ueberschritten.`,
          error: 'timeout',
          metadata: { script: scriptName, skillSlug, exitCode },
        };
      }

      return {
        output: stdout || `Script-Fehler: ${stderr.substring(0, 500)}`,
        error: stderr.substring(0, 1000),
        metadata: { script: scriptName, skillSlug, exitCode },
      };
    }
  },
};
