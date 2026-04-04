/**
 * Heartbeat API Client
 */

import { httpClient } from './httpClient';
import { env } from './env';

const BASE = `${env.API_URL}/api/heartbeat`;

export interface HeartbeatDefinition {
  id: string;
  tenantId: string | null;
  userId: string | null;
  name: string;
  description: string | null;
  cron: string;
  type: 'data' | 'agent';
  level: 'company' | 'user' | 'learned';
  config: Record<string, unknown>;
  roles: string[];
  icon: string;
  priority: 'critical' | 'warning' | 'info';
  enabled: boolean;
  source: 'builtin' | 'custom';
  lastRunAt: string | null;
  lastResultSummary: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HeartbeatBriefing {
  hasBriefing: boolean;
  text: string;
  resultCount: number;
  results: Array<{
    id: string;
    name: string;
    icon: string;
    priority: string;
    data: unknown;
    createdAt: string;
  }>;
}

export interface HeartbeatInput {
  name: string;
  description?: string;
  cron: string;
  type?: 'data' | 'agent';
  level?: 'company' | 'user' | 'learned';
  config: Record<string, unknown>;
  roles?: string[];
  icon?: string;
  priority?: 'critical' | 'warning' | 'info';
}

export async function fetchBriefing(): Promise<HeartbeatBriefing> {
  const res = await httpClient.get(`${BASE}/briefing`);
  return res.json();
}

export async function fetchHeartbeatDefinitions(): Promise<HeartbeatDefinition[]> {
  const res = await httpClient.get(`${BASE}/definitions`);
  return res.json();
}

export async function createHeartbeatDefinition(data: HeartbeatInput): Promise<HeartbeatDefinition> {
  const res = await httpClient.post(`${BASE}/definitions`, data);
  return res.json();
}

export async function updateHeartbeatDefinition(id: string, data: Partial<HeartbeatInput> & { enabled?: boolean }): Promise<HeartbeatDefinition> {
  const res = await httpClient.put(`${BASE}/definitions/${id}`, data);
  return res.json();
}

export async function toggleHeartbeatDefinition(id: string): Promise<HeartbeatDefinition> {
  const res = await httpClient.request(`${BASE}/definitions/${id}/toggle`, { method: 'PATCH' });
  return res.json();
}

export async function deleteHeartbeatDefinition(id: string): Promise<void> {
  await httpClient.request(`${BASE}/definitions/${id}`, { method: 'DELETE' });
}

export async function runHeartbeat(id: string): Promise<{ executed: boolean; hasResult: boolean; result: unknown }> {
  const res = await httpClient.post(`${BASE}/definitions/${id}/run`, {});
  return res.json();
}
