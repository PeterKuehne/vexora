/**
 * System Settings Routes - Admin Configuration Management
 * Allows administrators to manage system-wide settings
 */

import express, { type Request, type Response } from 'express';
import { asyncHandler, authenticateToken } from '../middleware/index.js';
import { LoggerService } from '../services/LoggerService.js';
import type { AuthenticatedRequest } from '../types/auth.js';

const router = express.Router();

/**
 * Check if user has Admin role - required for ALL system settings operations
 */
const requireAdminRole = (req: AuthenticatedRequest, res: Response, next: any) => {
  if (!req.user || req.user.role !== 'Admin') {
    LoggerService.logAdmin('settings_access_denied', {
      userId: req.user?.user_id || 'anonymous',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      endpoint: req.originalUrl
    });

    return res.status(403).json({
      error: 'Access denied',
      code: 'INSUFFICIENT_PERMISSIONS',
      message: 'Admin role required for system settings operations'
    });
  }
  next();
};

/**
 * System Settings Interface
 * Represents configurable system parameters
 */
export interface SystemSettings {
  /** JWT Token Configuration */
  tokenSettings: {
    /** Access token lifetime in minutes */
    accessTokenLifetime: number;
    /** Refresh token lifetime in days */
    refreshTokenLifetime: number;
    /** Whether to enable token rotation */
    enableTokenRotation: boolean;
  };

  /** RAG Search Parameters */
  ragSettings: {
    /** Default search limit for document retrieval */
    defaultSearchLimit: number;
    /** Maximum search limit allowed */
    maxSearchLimit: number;
    /** Default similarity threshold */
    defaultSimilarityThreshold: number;
    /** Hybrid search alpha (0=keyword, 1=semantic) */
    defaultHybridAlpha: number;
  };

  /** Storage Quota Management */
  storageSettings: {
    /** Default user quota in MB */
    defaultUserQuotaMB: number;
    /** Maximum quota per user in MB */
    maxUserQuotaMB: number;
    /** Whether to enable quota enforcement */
    enableQuotaEnforcement: boolean;
  };

  /** OAuth2 Provider Configuration */
  oauthSettings: {
    /** Microsoft OAuth2 enabled */
    enableMicrosoftOAuth: boolean;
    /** Google OAuth2 enabled */
    enableGoogleOAuth: boolean;
    /** Session timeout in hours */
    sessionTimeoutHours: number;
  };

  /** System Performance */
  performanceSettings: {
    /** Maximum concurrent document processing jobs */
    maxConcurrentJobs: number;
    /** Request timeout in seconds */
    requestTimeoutSeconds: number;
    /** Enable request logging */
    enableRequestLogging: boolean;
  };
}

/**
 * Default System Settings
 * These are the baseline configuration values
 */
const DEFAULT_SETTINGS: SystemSettings = {
  tokenSettings: {
    accessTokenLifetime: 15, // 15 minutes
    refreshTokenLifetime: 7, // 7 days
    enableTokenRotation: true
  },
  ragSettings: {
    defaultSearchLimit: 5,
    maxSearchLimit: 20,
    defaultSimilarityThreshold: 0.7,
    defaultHybridAlpha: 0.5
  },
  storageSettings: {
    defaultUserQuotaMB: 100,
    maxUserQuotaMB: 1000,
    enableQuotaEnforcement: true
  },
  oauthSettings: {
    enableMicrosoftOAuth: true,
    enableGoogleOAuth: true,
    sessionTimeoutHours: 8
  },
  performanceSettings: {
    maxConcurrentJobs: 5,
    requestTimeoutSeconds: 30,
    enableRequestLogging: true
  }
};

// In-memory settings store (in production, this would be in a database)
let currentSettings: SystemSettings = { ...DEFAULT_SETTINGS };

/**
 * GET /api/admin/settings
 * Retrieve current system settings (Admin only)
 */
router.get('/', authenticateToken, requireAdminRole, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    LoggerService.logAdmin('settings_retrieved', {
      userId: req.user!.user_id,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    const userContext = {
      userId: req.user!.user_id,
      userRole: req.user!.role,
      userDepartment: req.user!.department
    };

    res.json({
      success: true,
      data: {
        settings: currentSettings,
        userContext
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    LoggerService.logError(error as Error, {
      context: 'settings_retrieval',
      userId: req.user!.user_id
    });

    res.status(500).json({
      error: 'Internal server error',
      code: 'SETTINGS_FETCH_FAILED',
      message: 'Failed to fetch system settings'
    });
  }
}));

/**
 * PUT /api/admin/settings
 * Update system settings (Admin only)
 */
router.put('/', authenticateToken, requireAdminRole, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const updatedSettings = req.body as Partial<SystemSettings>;

    if (!updatedSettings || typeof updatedSettings !== 'object') {
      return res.status(400).json({
        error: 'Bad request',
        code: 'INVALID_SETTINGS_PAYLOAD',
        message: 'Settings payload is required'
      });
    }

    // Validate settings ranges and constraints
    const validationErrors = validateSystemSettings(updatedSettings);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        code: 'INVALID_SETTINGS',
        message: 'Settings validation failed',
        details: validationErrors
      });
    }

    // Create previous settings backup for auditing
    const previousSettings = { ...currentSettings };

    // Merge with current settings (partial update)
    currentSettings = {
      ...currentSettings,
      ...updatedSettings,
      // Deep merge nested objects
      tokenSettings: { ...currentSettings.tokenSettings, ...(updatedSettings.tokenSettings || {}) },
      ragSettings: { ...currentSettings.ragSettings, ...(updatedSettings.ragSettings || {}) },
      storageSettings: { ...currentSettings.storageSettings, ...(updatedSettings.storageSettings || {}) },
      oauthSettings: { ...currentSettings.oauthSettings, ...(updatedSettings.oauthSettings || {}) },
      performanceSettings: { ...currentSettings.performanceSettings, ...(updatedSettings.performanceSettings || {}) }
    };

    // Log configuration changes for audit trail
    LoggerService.logAdmin('settings_updated', {
      userId: req.user!.user_id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      changes: calculateSettingsChanges(previousSettings, currentSettings),
      settingsCount: Object.keys(updatedSettings).length
    });

    const userContext = {
      userId: req.user!.user_id,
      userRole: req.user!.role,
      userDepartment: req.user!.department
    };

    res.json({
      success: true,
      data: {
        settings: currentSettings,
        userContext,
        applied: Object.keys(updatedSettings)
      },
      message: 'System settings updated successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    LoggerService.logError(error as Error, {
      context: 'settings_update',
      userId: req.user!.user_id
    });

    res.status(500).json({
      error: 'Internal server error',
      code: 'SETTINGS_UPDATE_FAILED',
      message: 'Failed to update system settings'
    });
  }
}));

/**
 * POST /api/admin/settings/reset
 * Reset system settings to defaults (Admin only)
 */
router.post('/reset', authenticateToken, requireAdminRole, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  try {
    const previousSettings = { ...currentSettings };
    currentSettings = { ...DEFAULT_SETTINGS };

    LoggerService.logAdmin('settings_reset', {
      userId: req.user!.user_id,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      resetFromSettings: Object.keys(previousSettings)
    });

    const userContext = {
      userId: req.user!.user_id,
      userRole: req.user!.role,
      userDepartment: req.user!.department
    };

    res.json({
      success: true,
      data: {
        settings: currentSettings,
        userContext
      },
      message: 'System settings reset to defaults',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    LoggerService.logError(error as Error, {
      context: 'settings_reset',
      userId: req.user!.user_id
    });

    res.status(500).json({
      error: 'Internal server error',
      code: 'SETTINGS_RESET_FAILED',
      message: 'Failed to reset system settings'
    });
  }
}));

/**
 * Validate system settings for security and consistency
 */
function validateSystemSettings(settings: Partial<SystemSettings>): string[] {
  const errors: string[] = [];

  if (settings.tokenSettings) {
    const { accessTokenLifetime, refreshTokenLifetime } = settings.tokenSettings;

    if (accessTokenLifetime !== undefined) {
      if (accessTokenLifetime < 5 || accessTokenLifetime > 60) {
        errors.push('Access token lifetime must be between 5 and 60 minutes');
      }
    }

    if (refreshTokenLifetime !== undefined) {
      if (refreshTokenLifetime < 1 || refreshTokenLifetime > 30) {
        errors.push('Refresh token lifetime must be between 1 and 30 days');
      }
    }
  }

  if (settings.ragSettings) {
    const { defaultSearchLimit, maxSearchLimit, defaultSimilarityThreshold, defaultHybridAlpha } = settings.ragSettings;

    if (defaultSearchLimit !== undefined) {
      if (defaultSearchLimit < 1 || defaultSearchLimit > 50) {
        errors.push('Default search limit must be between 1 and 50');
      }
    }

    if (maxSearchLimit !== undefined) {
      if (maxSearchLimit < 5 || maxSearchLimit > 100) {
        errors.push('Maximum search limit must be between 5 and 100');
      }
    }

    if (defaultSimilarityThreshold !== undefined) {
      if (defaultSimilarityThreshold < 0 || defaultSimilarityThreshold > 1) {
        errors.push('Similarity threshold must be between 0 and 1');
      }
    }

    if (defaultHybridAlpha !== undefined) {
      if (defaultHybridAlpha < 0 || defaultHybridAlpha > 1) {
        errors.push('Hybrid alpha must be between 0 and 1');
      }
    }
  }

  if (settings.storageSettings) {
    const { defaultUserQuotaMB, maxUserQuotaMB } = settings.storageSettings;

    if (defaultUserQuotaMB !== undefined) {
      if (defaultUserQuotaMB < 10 || defaultUserQuotaMB > 10000) {
        errors.push('Default user quota must be between 10 MB and 10 GB');
      }
    }

    if (maxUserQuotaMB !== undefined) {
      if (maxUserQuotaMB < 50 || maxUserQuotaMB > 50000) {
        errors.push('Maximum user quota must be between 50 MB and 50 GB');
      }
    }
  }

  if (settings.oauthSettings) {
    const { sessionTimeoutHours } = settings.oauthSettings;

    if (sessionTimeoutHours !== undefined) {
      if (sessionTimeoutHours < 1 || sessionTimeoutHours > 72) {
        errors.push('Session timeout must be between 1 and 72 hours');
      }
    }
  }

  if (settings.performanceSettings) {
    const { maxConcurrentJobs, requestTimeoutSeconds } = settings.performanceSettings;

    if (maxConcurrentJobs !== undefined) {
      if (maxConcurrentJobs < 1 || maxConcurrentJobs > 20) {
        errors.push('Maximum concurrent jobs must be between 1 and 20');
      }
    }

    if (requestTimeoutSeconds !== undefined) {
      if (requestTimeoutSeconds < 10 || requestTimeoutSeconds > 300) {
        errors.push('Request timeout must be between 10 and 300 seconds');
      }
    }
  }

  return errors;
}

/**
 * Calculate which settings changed for audit logging
 */
function calculateSettingsChanges(before: SystemSettings, after: SystemSettings): Record<string, { from: any, to: any }> {
  const changes: Record<string, { from: any, to: any }> = {};

  // Deep comparison of nested settings objects
  const sections = ['tokenSettings', 'ragSettings', 'storageSettings', 'oauthSettings', 'performanceSettings'] as const;

  for (const section of sections) {
    const beforeSection = before[section];
    const afterSection = after[section];

    for (const key in afterSection) {
      const beforeValue = (beforeSection as any)[key];
      const afterValue = (afterSection as any)[key];

      if (beforeValue !== afterValue) {
        changes[`${section}.${key}`] = { from: beforeValue, to: afterValue };
      }
    }
  }

  return changes;
}

export default router;