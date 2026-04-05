/**
 * CardBuilder — Transforms Heartbeat results into Action Cards
 *
 * Generisch: Card-Typ, Icon, Title und Actions kommen aus der
 * Heartbeat-Definition — nicht hardcoded per Branche.
 */

import type { HeartbeatResult, DataQueryConfig } from '../heartbeat/HeartbeatEngine.js';

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

    // Build contextual actions based on heartbeat name and data
    const actions: ActionCardAction[] = buildActionsForResult(result, isArray ? count : 0);

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

/**
 * Build contextual Quick Actions based on the heartbeat name and result data.
 * These actions generate prompts that the Hive Mind will execute via Expert Agents.
 */
function buildActionsForResult(result: HeartbeatResult, count: number): ActionCardAction[] {
  const name = (result.name || '').toLowerCase();
  const actions: ActionCardAction[] = [];

  // Match by heartbeat name patterns (generic, not industry-specific)
  if (name.includes('rechnung') || name.includes('invoice') || name.includes('payment')) {
    if (count > 0) {
      actions.push({ label: 'Mahnung senden', prompt: `Erstelle Zahlungserinnerungen fuer die ${count} offenen Rechnungen` });
    }
    actions.push({ label: 'Analyse', prompt: `Analysiere die offenen Rechnungen und zeige Faelligkeiten` });
  } else if (name.includes('compliance') || name.includes('aueg') || name.includes('fristen') || name.includes('limit')) {
    actions.push({ label: 'Compliance-Bericht', prompt: `Erstelle einen vollstaendigen Compliance-Bericht` });
    if (count > 0) {
      actions.push({ label: 'Rotation planen', prompt: `Plane Rotationen fuer die ${count} betroffenen Einsaetze` });
    }
  } else if (name.includes('zertifizierung') || name.includes('certification')) {
    actions.push({ label: 'Mitarbeiter informieren', prompt: `Informiere die betroffenen Mitarbeiter ueber ablaufende Zertifizierungen` });
  } else if (name.includes('einsatz') || name.includes('assignment')) {
    actions.push({ label: 'Alle anzeigen', prompt: `Zeige mir alle aktiven Einsaetze mit Status` });
  } else if (name.includes('zeiterfassung') || name.includes('approval')) {
    actions.push({ label: 'Alle genehmigen', prompt: `Genehmige alle ausstehenden Zeiterfassungen` });
    actions.push({ label: 'Pruefen', prompt: `Zeige mir die ausstehenden Zeiterfassungen im Detail` });
  }

  // Always add a generic "Analysieren" action as fallback
  if (actions.length === 0) {
    actions.push({ label: 'Analysieren', prompt: `Analysiere die Ergebnisse von: ${result.name}` });
  }

  return actions;
}
