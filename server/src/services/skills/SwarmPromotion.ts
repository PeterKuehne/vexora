/**
 * SwarmPromotion - Auto-promote/degrade skills based on community votes
 *
 * Promotion: Team → Swarm when adoption >= 5 AND vote ratio >= 0.8
 * Degradation: Swarm → Team when vote ratio < 0.6 AND total votes >= 10
 */

import { databaseService } from '../DatabaseService.js';

export class SwarmPromotion {
  private readonly PROMOTION_MIN_ADOPTION = 5;
  private readonly PROMOTION_MIN_RATIO = 0.8;
  private readonly DEGRADATION_MAX_RATIO = 0.6;
  private readonly DEGRADATION_MIN_VOTES = 10;

  /**
   * Check if a team skill should be promoted to swarm
   */
  async checkPromotion(skillId: string): Promise<boolean> {
    const result = await databaseService.query(
      `SELECT scope, adoption_count, upvotes, downvotes
       FROM skills WHERE id = $1`,
      [skillId]
    );

    if (result.rows.length === 0) return false;

    const skill = result.rows[0];
    if (skill.scope !== 'team') return false;

    const totalVotes = skill.upvotes + skill.downvotes;
    if (totalVotes === 0) return false;

    const ratio = skill.upvotes / totalVotes;

    if (
      skill.adoption_count >= this.PROMOTION_MIN_ADOPTION &&
      ratio >= this.PROMOTION_MIN_RATIO
    ) {
      await databaseService.query(
        `UPDATE skills SET scope = 'swarm', promoted_at = NOW(), is_verified = true WHERE id = $1`,
        [skillId]
      );
      console.log(`[SwarmPromotion] Skill ${skillId} promoted to swarm (adoption=${skill.adoption_count}, ratio=${ratio.toFixed(2)})`);
      return true;
    }

    return false;
  }

  /**
   * Check if a swarm skill should be degraded back to team
   */
  async checkDegradation(skillId: string): Promise<boolean> {
    const result = await databaseService.query(
      `SELECT scope, upvotes, downvotes, is_builtin, department
       FROM skills WHERE id = $1`,
      [skillId]
    );

    if (result.rows.length === 0) return false;

    const skill = result.rows[0];
    // Never degrade built-in skills
    if (skill.scope !== 'swarm' || skill.is_builtin) return false;

    const totalVotes = skill.upvotes + skill.downvotes;
    if (totalVotes < this.DEGRADATION_MIN_VOTES) return false;

    const ratio = skill.upvotes / totalVotes;

    if (ratio < this.DEGRADATION_MAX_RATIO) {
      await databaseService.query(
        `UPDATE skills SET scope = 'team', promoted_at = NULL, is_verified = false WHERE id = $1`,
        [skillId]
      );
      console.log(`[SwarmPromotion] Skill ${skillId} degraded to team (ratio=${ratio.toFixed(2)})`);
      return true;
    }

    return false;
  }
}

export const swarmPromotion = new SwarmPromotion();
