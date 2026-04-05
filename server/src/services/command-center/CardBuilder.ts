/**
 * CardBuilder — Transforms Heartbeat results into Action Cards
 *
 * Generisch: Card-Typ, Icon, Title und Actions kommen aus der
 * Heartbeat-Definition — nicht hardcoded per Branche.
 */

import type { HeartbeatResult } from '../heartbeat/HeartbeatEngine.js';

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

/**
 * Build Action Cards from Heartbeat results.
 *
 * Each Heartbeat result becomes one Action Card.
 * The actions are derived from the heartbeat name and data shape.
 */
export function buildCards(results: HeartbeatResult[]): ActionCard[] {
  return results.map(result => {
    const data = result.data;
    const isArray = Array.isArray(data);
    const count = isArray ? (data as unknown[]).length : 1;

    // Build summary from data
    let summary: string;
    if (isArray && count === 0) {
      summary = 'Keine Ergebnisse';
    } else if (isArray) {
      summary = `${count} Ergebnis${count !== 1 ? 'se' : ''}`;
    } else if (typeof data === 'object' && data !== null) {
      // Try to extract meaningful summary from object
      const obj = data as Record<string, unknown>;
      const parts: string[] = [];
      if (obj.totalOutstanding) parts.push(`${obj.totalOutstanding} EUR ausstehend`);
      if (obj.totalRevenue) parts.push(`${obj.totalRevenue} EUR Umsatz`);
      if (obj.totalIncome) parts.push(`${obj.totalIncome} EUR Einnahmen`);
      summary = parts.length > 0 ? parts.join(', ') : 'Ergebnis vorhanden';
    } else {
      summary = String(data);
    }

    // Build generic actions based on heartbeat name
    const actions: ActionCardAction[] = [
      {
        label: 'Details',
        prompt: `Zeige mir Details zu: ${result.name || 'Heartbeat-Ergebnis'}`,
      },
    ];

    return {
      id: result.id,
      icon: result.icon || '📋',
      title: result.name || 'Check',
      summary,
      priority: (result.priority as ActionCard['priority']) || 'info',
      details: data,
      actions,
      heartbeatId: result.heartbeatId,
      createdAt: result.createdAt instanceof Date ? result.createdAt.toISOString() : String(result.createdAt),
    };
  });
}
