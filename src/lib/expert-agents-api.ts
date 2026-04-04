/**
 * Expert Agents API Client
 */

import { httpClient } from './httpClient';
import { env } from './env';

const BASE = `${env.API_URL}/api/expert-agents`;

export interface ExpertAgentRecord {
  id: string;
  tenantId: string | null;
  name: string;
  description: string;
  avatarUrl: string | null;
  isActive: boolean;
  model: string;
  maxSteps: number;
  roles: string[];
  rules: string[];
  tools: string[];
  instructions: string;
  source: 'builtin' | 'custom';
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ToolInfo {
  name: string;
  description: string;
  source: string;
  category: string;
}

export interface ExpertAgentInput {
  name: string;
  description: string;
  avatarUrl?: string;
  model?: string;
  maxSteps?: number;
  roles?: string[];
  rules?: string[];
  tools: string[];
  instructions: string;
}

export async function fetchExpertAgents(): Promise<ExpertAgentRecord[]> {
  const res = await httpClient.get(BASE);
  return res.json();
}

export async function fetchExpertAgent(id: string): Promise<ExpertAgentRecord> {
  const res = await httpClient.get(`${BASE}/${id}`);
  return res.json();
}

export async function fetchAvailableTools(): Promise<ToolInfo[]> {
  const res = await httpClient.get(`${BASE}/available-tools`);
  return res.json();
}

export async function createExpertAgent(data: ExpertAgentInput): Promise<ExpertAgentRecord> {
  const res = await httpClient.post(BASE, data);
  return res.json();
}

export async function updateExpertAgent(id: string, data: Partial<ExpertAgentInput> & { isActive?: boolean }): Promise<ExpertAgentRecord> {
  const res = await httpClient.put(`${BASE}/${id}`, data);
  return res.json();
}

export async function toggleExpertAgent(id: string): Promise<ExpertAgentRecord> {
  const res = await httpClient.request(`${BASE}/${id}/toggle`, { method: 'PATCH' });
  return res.json();
}

export async function deleteExpertAgent(id: string): Promise<void> {
  await httpClient.request(`${BASE}/${id}`, { method: 'DELETE' });
}
