/**
 * CommandCenterService — Aggregates all data for the Command Center home view
 *
 * One API call returns: Briefing + Action Cards + Quick Stats + Recent Tasks.
 * All data sources are queried in parallel for speed.
 */

import { databaseService } from '../DatabaseService.js';
import { heartbeatEngine } from '../heartbeat/index.js';
import { generateBriefing } from '../heartbeat/briefing.js';
import { buildCards, type ActionCard } from './CardBuilder.js';

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

class CommandCenterServiceImpl {

  /**
   * Get all data for the Command Center home view.
   * Queries are run in parallel for speed.
   */
  async getHomeData(
    userId: string,
    userName: string,
    userRole: string,
    tenantId?: string,
  ): Promise<CommandCenterHome> {

    // Run all queries in parallel
    const [heartbeatResults, recentTasks] = await Promise.all([
      heartbeatEngine.getUndeliveredResults(userId, userRole, tenantId).catch(() => []),
      this.getRecentTasks(userId).catch(() => []),
    ]);

    // Build Action Cards from heartbeat results
    const cards = buildCards(heartbeatResults);

    // Generate briefing if there are results
    let briefing: CommandCenterHome['briefing'] = null;
    if (heartbeatResults.length > 0) {
      try {
        const briefingResult = await generateBriefing(heartbeatResults, userName, userId);
        if (briefingResult.hasBriefing) {
          briefing = {
            text: briefingResult.text,
            generatedAt: new Date().toISOString(),
          };
        }

        // Mark as delivered
        await heartbeatEngine.markDelivered(briefingResult.resultIds);
      } catch (error) {
        console.warn(`[CommandCenter] Briefing generation failed: ${error}`);
      }
    }

    return {
      briefing,
      cards,
      stats: {
        heartbeatResults: heartbeatResults.length,
        recentTaskCount: recentTasks.length,
      },
      recentTasks,
    };
  }

  /**
   * Get recent agent tasks for the user (last 5)
   */
  private async getRecentTasks(userId: string): Promise<CommandCenterHome['recentTasks']> {
    const result = await databaseService.query(
      `SELECT id, query, status, created_at
       FROM agent_tasks
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 5`,
      [userId]
    );

    return result.rows.map((row: any) => ({
      id: row.id,
      query: row.query,
      status: row.status,
      createdAt: row.created_at,
    }));
  }
}

export const commandCenterService = new CommandCenterServiceImpl();
