/**
 * SkillContext - State management for the Skill System
 *
 * Manages skill state, SSE streaming for execution, and provides
 * CRUD + execute + vote actions.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import { httpClient } from '../lib/httpClient';
import { env } from '../lib/env';

// ============================================
// Types
// ============================================

export type SkillScope = 'personal' | 'team' | 'swarm';
export type SkillExecutionStatus = 'running' | 'completed' | 'failed';

export interface SkillDefinition {
  /** Markdown instruction body */
  content: string;
  /** Recommended tools */
  tools: string[];
  /** Version */
  version: string;
}

export interface Skill {
  id: string;
  name: string;
  slug: string;
  description?: string;
  definition: SkillDefinition;
  scope: SkillScope;
  department?: string;
  isVerified: boolean;
  upvotes: number;
  downvotes: number;
  adoptionCount: number;
  executionCount: number;
  avgDurationMs: number;
  isBuiltin: boolean;
  isActive: boolean;
  disableAutoInvocation: boolean;
  category?: string;
  tags: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface SkillContextValue {
  skills: Skill[];
  activeSkillId: string | null;
  isLoading: boolean;

  loadSkills: (filters?: { scope?: string; category?: string; search?: string }) => Promise<void>;
  createSkill: (data: { name: string; description?: string; definition: SkillDefinition; category?: string; tags?: string[] }) => Promise<Skill | null>;
  updateSkill: (id: string, data: Partial<{ disableAutoInvocation: boolean }>) => Promise<boolean>;
  deleteSkill: (id: string) => Promise<boolean>;
  shareSkill: (id: string, department?: string) => Promise<boolean>;
  voteSkill: (id: string, vote: -1 | 1, comment?: string) => Promise<boolean>;
  setActiveSkillId: (id: string | null) => void;
}

const SkillContext = createContext<SkillContextValue | null>(null);

// ============================================
// Provider
// ============================================

export function SkillProvider({ children }: { children: ReactNode }) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [activeSkillId, setActiveSkillId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Map snake_case API response to camelCase
  const mapSkill = (s: any): Skill => ({
    id: s.id,
    name: s.name,
    slug: s.slug,
    description: s.description,
    definition: s.definition,
    scope: s.scope,
    department: s.department,
    isVerified: s.isVerified ?? s.is_verified ?? false,
    upvotes: s.upvotes ?? 0,
    downvotes: s.downvotes ?? 0,
    adoptionCount: s.adoptionCount ?? s.adoption_count ?? 0,
    executionCount: s.executionCount ?? s.execution_count ?? 0,
    avgDurationMs: s.avgDurationMs ?? s.avg_duration_ms ?? 0,
    isBuiltin: s.isBuiltin ?? s.is_builtin ?? false,
    isActive: s.isActive ?? s.is_active ?? true,
    disableAutoInvocation: s.disableAutoInvocation ?? s.disable_auto_invocation ?? false,
    category: s.category,
    tags: s.tags || [],
    createdBy: s.createdBy ?? s.created_by,
    createdAt: s.createdAt ?? s.created_at,
    updatedAt: s.updatedAt ?? s.updated_at,
  });

  // Load skills
  const loadSkills = useCallback(async (filters?: { scope?: string; category?: string; search?: string }) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (filters?.scope) params.set('scope', filters.scope);
      if (filters?.category) params.set('category', filters.category);
      if (filters?.search) params.set('search', filters.search);

      const response = await httpClient.get(`${env.API_URL}/api/skills?${params}`);
      const data = await response.json();
      setSkills(data.skills.map(mapSkill));
    } catch (error) {
      console.error('[SkillContext] Failed to load skills:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Create skill
  const createSkill = useCallback(async (data: {
    name: string;
    description?: string;
    definition: SkillDefinition;
    category?: string;
    tags?: string[];
  }): Promise<Skill | null> => {
    try {
      const response = await httpClient.post(`${env.API_URL}/api/skills`, data);
      const result = await response.json();
      const skill = mapSkill(result.skill);
      setSkills(prev => [skill, ...prev]);
      return skill;
    } catch (error) {
      console.error('[SkillContext] Failed to create skill:', error);
      return null;
    }
  }, []);

  // Update skill
  const updateSkill = useCallback(async (id: string, data: Partial<{ disableAutoInvocation: boolean }>): Promise<boolean> => {
    try {
      const response = await httpClient.put(`${env.API_URL}/api/skills/${id}`, data);
      const result = await response.json();
      if (result.skill) {
        setSkills(prev => prev.map(s => s.id === id ? mapSkill(result.skill) : s));
      }
      return true;
    } catch (error) {
      console.error('[SkillContext] Failed to update skill:', error);
      return false;
    }
  }, []);

  // Delete skill
  const deleteSkill = useCallback(async (id: string): Promise<boolean> => {
    try {
      await httpClient.delete(`${env.API_URL}/api/skills/${id}`);
      setSkills(prev => prev.filter(s => s.id !== id));
      if (activeSkillId === id) setActiveSkillId(null);
      return true;
    } catch (error) {
      console.error('[SkillContext] Failed to delete skill:', error);
      return false;
    }
  }, [activeSkillId]);

  // Share skill
  const shareSkill = useCallback(async (id: string, department?: string): Promise<boolean> => {
    try {
      const response = await httpClient.post(`${env.API_URL}/api/skills/${id}/share`, { department });
      const result = await response.json();
      if (result.skill) {
        setSkills(prev => prev.map(s => s.id === id ? mapSkill(result.skill) : s));
      }
      return true;
    } catch (error) {
      console.error('[SkillContext] Failed to share skill:', error);
      return false;
    }
  }, []);

  // Vote on skill
  const voteSkill = useCallback(async (id: string, vote: -1 | 1, comment?: string): Promise<boolean> => {
    try {
      const response = await httpClient.post(`${env.API_URL}/api/skills/${id}/vote`, { vote, comment });
      const result = await response.json();
      setSkills(prev => prev.map(s =>
        s.id === id ? { ...s, upvotes: result.upvotes, downvotes: result.downvotes } : s
      ));
      return true;
    } catch (error) {
      console.error('[SkillContext] Failed to vote:', error);
      return false;
    }
  }, []);

  // Load skills on mount
  useEffect(() => {
    loadSkills();
  }, [loadSkills]);

  return (
    <SkillContext.Provider
      value={{
        skills,
        activeSkillId,
        isLoading,
        loadSkills,
        createSkill,
        updateSkill,
        deleteSkill,
        shareSkill,
        voteSkill,
        setActiveSkillId,
      }}
    >
      {children}
    </SkillContext.Provider>
  );
}

export function useSkill() {
  const context = useContext(SkillContext);
  if (!context) throw new Error('useSkill must be used within a SkillProvider');
  return context;
}
