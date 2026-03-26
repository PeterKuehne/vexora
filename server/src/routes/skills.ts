/**
 * Skill Routes - API endpoints for skill management
 *
 * Skills are Markdown instructions that the agent loads on demand.
 * This API handles CRUD, voting, sharing. Execution happens through
 * the agent (load_skill tool), not through these routes.
 */

import { Router, type Request, type Response } from 'express';
import { authenticateToken } from '../middleware/index.js';
import type { AuthenticatedRequest } from '../types/auth.js';
import { skillRegistry, skillValidator } from '../services/skills/index.js';
import type { SkillUserContext } from '../services/skills/types.js';

const router = Router();

/**
 * Helper: Extract SkillUserContext from authenticated request
 */
function getUserContext(req: AuthenticatedRequest): SkillUserContext {
  if (!req.user) throw new Error('Nicht authentifiziert');
  return {
    userId: req.user.user_id,
    userRole: req.user.role,
    department: req.user.department,
  };
}

// ============================================
// GET /api/skills - List skills
// ============================================

router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const context = getUserContext(authReq);

    const scope = req.query.scope as string | undefined;
    const category = req.query.category as string | undefined;
    const search = req.query.search as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const result = await skillRegistry.getSkills(context, {
      scope: scope as any,
      category,
      search,
      limit,
      offset,
    });

    // Build virtual definition for skills that use filesystem (SKILL.md)
    const skillsWithDefinition = await Promise.all(
      result.skills.map(async (skill) => {
        if (!skill.definition && skill.filePath) {
          try {
            const content = await skillRegistry.getSkillContent(skill);
            return {
              ...skill,
              definition: {
                content: content.body,
                tools: content.tools,
                version: content.version,
              },
            };
          } catch {
            return skill;
          }
        }
        return skill;
      })
    );

    res.json({
      skills: skillsWithDefinition,
      total: result.total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[SkillRoute] GET / error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Skills' });
  }
});

// ============================================
// GET /api/skills/suggestions - Skill suggestions
// ============================================

router.get('/suggestions', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const context = getUserContext(authReq);
    const query = req.query.q as string | undefined;

    const skills = await skillRegistry.getSuggestions(context, query);
    res.json({ skills });
  } catch (error) {
    console.error('[SkillRoute] GET /suggestions error:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Vorschläge' });
  }
});

// ============================================
// POST /api/skills - Create skill
// ============================================

router.post('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const context = getUserContext(authReq);
    const { name, description, definition, category, tags } = req.body;

    if (!name || !definition) {
      res.status(400).json({ error: 'name und definition sind erforderlich' });
      return;
    }

    // Validate definition
    const validation = skillValidator.validateDefinition(definition);
    if (!validation.valid) {
      res.status(400).json({ error: 'Ungültige Skill-Definition', details: validation.errors });
      return;
    }

    const skill = await skillRegistry.createSkill(context, {
      name,
      description,
      definition,
      category,
      tags,
    });

    res.status(201).json({ skill });
  } catch (error) {
    console.error('[SkillRoute] POST / error:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen des Skills' });
  }
});

// ============================================
// PUT /api/skills/:id - Update skill
// ============================================

router.put('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const context = getUserContext(authReq);
    const { name, description, definition, category, tags, disableAutoInvocation } = req.body;

    if (definition) {
      const validation = skillValidator.validateDefinition(definition);
      if (!validation.valid) {
        res.status(400).json({ error: 'Ungültige Skill-Definition', details: validation.errors });
        return;
      }
    }

    const skill = await skillRegistry.updateSkill(context, req.params.id!, {
      name,
      description,
      definition,
      category,
      tags,
      disableAutoInvocation,
    });

    if (!skill) {
      res.status(404).json({ error: 'Skill nicht gefunden' });
      return;
    }

    res.json({ skill });
  } catch (error) {
    console.error('[SkillRoute] PUT /:id error:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Skills' });
  }
});

// ============================================
// DELETE /api/skills/:id - Delete skill
// ============================================

router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const context = getUserContext(authReq);

    const deleted = await skillRegistry.deleteSkill(context, req.params.id!);

    if (!deleted) {
      res.status(404).json({ error: 'Skill nicht gefunden' });
      return;
    }

    res.json({ status: 'deleted' });
  } catch (error) {
    console.error('[SkillRoute] DELETE /:id error:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Skills' });
  }
});

// ============================================
// POST /api/skills/:id/share - Share to team
// ============================================

router.post('/:id/share', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const context = getUserContext(authReq);
    const { department } = req.body;

    const targetDepartment = department || context.department;
    if (!targetDepartment) {
      res.status(400).json({ error: 'department ist erforderlich' });
      return;
    }

    const skill = await skillRegistry.shareSkill(context, req.params.id!, targetDepartment);

    if (!skill) {
      res.status(404).json({ error: 'Skill nicht gefunden oder bereits geteilt' });
      return;
    }

    res.json({ skill });
  } catch (error) {
    console.error('[SkillRoute] POST /:id/share error:', error);
    res.status(500).json({ error: 'Fehler beim Teilen des Skills' });
  }
});

// ============================================
// POST /api/skills/:id/vote - Vote on skill
// ============================================

router.post('/:id/vote', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const context = getUserContext(authReq);
    const { vote, comment } = req.body;

    if (vote !== 1 && vote !== -1) {
      res.status(400).json({ error: 'vote muss 1 oder -1 sein' });
      return;
    }

    const result = await skillRegistry.vote(context, req.params.id!, vote, comment);
    res.json(result);
  } catch (error) {
    console.error('[SkillRoute] POST /:id/vote error:', error);
    res.status(500).json({ error: 'Fehler beim Abstimmen' });
  }
});

export default router;
