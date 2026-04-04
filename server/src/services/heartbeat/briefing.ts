/**
 * Briefing Generator — Summarizes heartbeat results into a natural morning briefing
 *
 * One LLM call combines all undelivered heartbeat results into a
 * cohesive, personalized briefing for the user.
 */

import { generateText } from 'ai';
import { resolveModel } from '../agents/ai-provider.js';
import { memoryService } from '../memory/index.js';
import type { HeartbeatResult } from './HeartbeatEngine.js';

export interface Briefing {
  hasBriefing: boolean;
  text: string;
  results: HeartbeatResult[];
  resultIds: string[];
}

/**
 * Generate a briefing from heartbeat results
 */
export async function generateBriefing(
  results: HeartbeatResult[],
  userName: string,
  userId: string,
): Promise<Briefing> {
  if (results.length === 0) {
    return { hasBriefing: false, text: '', results: [], resultIds: [] };
  }

  // Load user memory for personalization
  let userMemory = '';
  if (memoryService.isAvailable) {
    try {
      const ctx = await memoryService.loadHiveMindContext('Briefing Praeferenzen', userId);
      userMemory = ctx.userMemory;
    } catch {
      // Non-critical
    }
  }

  // Build LLM prompt
  const resultsText = results.map(r => {
    const data = typeof r.data === 'string' ? r.data : JSON.stringify(r.data, null, 2);
    const truncated = data.length > 500 ? data.substring(0, 500) + '...' : data;
    return `- [${r.priority?.toUpperCase() || 'INFO'}] ${r.icon || '📋'} **${r.name || 'Check'}**: ${r.description || ''}\n  Daten: ${truncated}`;
  }).join('\n');

  const prompt = `Du bist der Hive Mind. Erstelle ein kurzes Morgen-Briefing fuer ${userName}.

Heartbeat-Ergebnisse (proaktive Pruefungen):
${resultsText}

${userMemory ? `User-Praeferenzen:\n${userMemory}\n` : ''}
Regeln:
- Kritische Punkte zuerst (warning vor info)
- Erkenne Zusammenhaenge zwischen den Ergebnissen
- Maximal 5-8 Saetze, praegnant und handlungsorientiert
- Nenne konkrete Zahlen
- Biete an Details zu zeigen
- Antworte auf Deutsch
- Beginne mit "Guten Morgen ${userName}."`;

  try {
    const result = await generateText({
      model: resolveModel('gpt-oss-120b'),
      prompt,
      maxOutputTokens: 500,
      temperature: 0.3,
    });

    return {
      hasBriefing: true,
      text: result.text,
      results,
      resultIds: results.map(r => r.id),
    };
  } catch (error) {
    // Fallback: simple text without LLM
    const fallbackText = `Guten Morgen ${userName}. ${results.length} neue Meldung${results.length > 1 ? 'en' : ''} aus den Hintergrund-Pruefungen:\n\n` +
      results.map(r => `${r.icon || '📋'} **${r.name}**: ${r.description || 'Ergebnis vorhanden'}`).join('\n');

    return {
      hasBriefing: true,
      text: fallbackText,
      results,
      resultIds: results.map(r => r.id),
    };
  }
}
