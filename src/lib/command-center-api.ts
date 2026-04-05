/**
 * Command Center API Client
 */

import { httpClient } from './httpClient';
import { env } from './env';

export interface ActionCardAction {
  label: string;
  prompt: string;
}

export interface ActionCard {
  id: string;
  icon: string;
  title: string;
  summary: string;
  priority: 'critical' | 'warning' | 'info';
  details?: unknown;
  actions: ActionCardAction[];
  heartbeatId: string;
  createdAt: string;
}

export interface CommandCenterHome {
  briefing: {
    text: string;
    generatedAt: string;
  } | null;
  cards: ActionCard[];
  stats: {
    heartbeatResults: number;
    recentTaskCount: number;
  };
  recentTasks: Array<{
    id: string;
    query: string;
    status: string;
    createdAt: string;
  }>;
}

export async function fetchHomeData(): Promise<CommandCenterHome> {
  const res = await httpClient.get(`${env.API_URL}/api/command-center/home`);
  return res.json();
}
