/**
 * GoldenDatasetService - Manages golden dataset for RAG evaluation
 * Part of: Spec 1 - Foundation (Phase 0)
 */

import { databaseService } from '../DatabaseService.js';
import {
  GoldenQuery,
  GoldenDataset,
  DatasetStatistics,
  QueryCategory,
  Difficulty,
  CreateGoldenQueryRequest,
  UpdateGoldenQueryRequest,
} from '../../types/evaluation.js';

export class GoldenDatasetService {
  /**
   * Create a new golden query
   */
  async createQuery(
    request: CreateGoldenQueryRequest,
    createdBy?: string
  ): Promise<GoldenQuery> {
    const result = await databaseService.query(
      `INSERT INTO golden_dataset
       (query, expected_answer, relevant_document_ids, relevant_chunk_ids,
        category, difficulty, key_facts, forbidden_content, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        request.query,
        request.expectedAnswer,
        request.relevantDocumentIds,
        request.relevantChunkIds || [],
        request.category,
        request.difficulty || 'medium',
        request.keyFacts || [],
        request.forbiddenContent || [],
        createdBy || null,
      ]
    );
    return this.mapToGoldenQuery(result.rows[0]);
  }

  /**
   * Get all golden queries
   */
  async getAll(): Promise<GoldenQuery[]> {
    const result = await databaseService.query(
      'SELECT * FROM golden_dataset ORDER BY category, created_at'
    );
    return result.rows.map(this.mapToGoldenQuery);
  }

  /**
   * Get a single query by ID
   */
  async getById(id: string): Promise<GoldenQuery | null> {
    const result = await databaseService.query(
      'SELECT * FROM golden_dataset WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) return null;
    return this.mapToGoldenQuery(result.rows[0]);
  }

  /**
   * Get queries by category
   */
  async getByCategory(category: QueryCategory): Promise<GoldenQuery[]> {
    const result = await databaseService.query(
      'SELECT * FROM golden_dataset WHERE category = $1 ORDER BY created_at',
      [category]
    );
    return result.rows.map(this.mapToGoldenQuery);
  }

  /**
   * Get queries by difficulty
   */
  async getByDifficulty(difficulty: Difficulty): Promise<GoldenQuery[]> {
    const result = await databaseService.query(
      'SELECT * FROM golden_dataset WHERE difficulty = $1 ORDER BY created_at',
      [difficulty]
    );
    return result.rows.map(this.mapToGoldenQuery);
  }

  /**
   * Get full dataset with statistics
   */
  async getDataset(): Promise<GoldenDataset> {
    const queries = await this.getAll();
    const statistics = this.calculateStatistics(queries);

    return {
      version: '1.0',
      queries,
      statistics,
    };
  }

  /**
   * Update a golden query
   */
  async updateQuery(id: string, updates: UpdateGoldenQueryRequest): Promise<GoldenQuery> {
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    const fieldMapping: Record<string, string> = {
      query: 'query',
      expectedAnswer: 'expected_answer',
      relevantDocumentIds: 'relevant_document_ids',
      relevantChunkIds: 'relevant_chunk_ids',
      category: 'category',
      difficulty: 'difficulty',
      keyFacts: 'key_facts',
      forbiddenContent: 'forbidden_content',
      verifiedBy: 'verified_by',
    };

    for (const [key, value] of Object.entries(updates)) {
      const dbKey = fieldMapping[key];
      if (dbKey && value !== undefined) {
        setClauses.push(`${dbKey} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(id);

    const result = await databaseService.query(
      `UPDATE golden_dataset SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new Error('Query not found');
    }

    return this.mapToGoldenQuery(result.rows[0]);
  }

  /**
   * Delete a golden query
   */
  async deleteQuery(id: string): Promise<void> {
    const result = await databaseService.query(
      'DELETE FROM golden_dataset WHERE id = $1 RETURNING id',
      [id]
    );
    if (result.rows.length === 0) {
      throw new Error('Query not found');
    }
  }

  /**
   * Update cached evaluation results for a query
   */
  async updateEvaluationResults(
    queryId: string,
    precisionAt5: number,
    recallAt20: number,
    groundedness: number
  ): Promise<void> {
    await databaseService.query(
      `UPDATE golden_dataset
       SET last_evaluated_at = NOW(),
           last_precision_at_5 = $2,
           last_recall_at_20 = $3,
           last_groundedness = $4
       WHERE id = $1`,
      [queryId, precisionAt5, recallAt20, groundedness]
    );
  }

  /**
   * Bulk import queries
   */
  async bulkImport(
    queries: CreateGoldenQueryRequest[],
    createdBy?: string
  ): Promise<{ imported: number; errors: string[] }> {
    const errors: string[] = [];
    let imported = 0;

    for (const query of queries) {
      try {
        await this.createQuery(query, createdBy);
        imported++;
      } catch (error) {
        errors.push(`Failed to import query "${query.query.substring(0, 50)}...": ${error}`);
      }
    }

    return { imported, errors };
  }

  /**
   * Get count by category
   */
  async getCountByCategory(): Promise<Record<QueryCategory, number>> {
    const result = await databaseService.query(
      `SELECT category, COUNT(*) as count FROM golden_dataset GROUP BY category`
    );

    const counts: Record<QueryCategory, number> = {
      factual: 0,
      comparative: 0,
      procedural: 0,
      relational: 0,
      aggregative: 0,
      multi_hop: 0,
    };

    for (const row of result.rows) {
      counts[row.category as QueryCategory] = parseInt(row.count, 10);
    }

    return counts;
  }

  /**
   * Calculate dataset statistics
   */
  private calculateStatistics(queries: GoldenQuery[]): DatasetStatistics {
    const byCategory: Record<QueryCategory, number> = {
      factual: 0,
      comparative: 0,
      procedural: 0,
      relational: 0,
      aggregative: 0,
      multi_hop: 0,
    };

    const byDifficulty: Record<Difficulty, number> = {
      easy: 0,
      medium: 0,
      hard: 0,
    };

    let totalDocs = 0;
    let totalChunks = 0;

    for (const query of queries) {
      byCategory[query.category]++;
      byDifficulty[query.difficulty]++;
      totalDocs += query.relevantDocumentIds.length;
      totalChunks += query.relevantChunkIds.length;
    }

    return {
      totalQueries: queries.length,
      byCategory,
      byDifficulty,
      avgRelevantDocs: queries.length > 0 ? totalDocs / queries.length : 0,
      avgRelevantChunks: queries.length > 0 ? totalChunks / queries.length : 0,
    };
  }

  /**
   * Map database row to GoldenQuery type
   */
  private mapToGoldenQuery(row: Record<string, unknown>): GoldenQuery {
    return {
      id: row.id as string,
      query: row.query as string,
      expectedAnswer: row.expected_answer as string,
      relevantDocumentIds: (row.relevant_document_ids as string[]) || [],
      relevantChunkIds: (row.relevant_chunk_ids as string[]) || [],
      category: row.category as QueryCategory,
      difficulty: row.difficulty as Difficulty,
      keyFacts: (row.key_facts as string[]) || [],
      forbiddenContent: (row.forbidden_content as string[]) || [],
      createdBy: row.created_by as string | undefined,
      verifiedBy: row.verified_by as string | undefined,
      createdAt: new Date(row.created_at as string),
      updatedAt: new Date(row.updated_at as string),
      lastEvaluatedAt: row.last_evaluated_at
        ? new Date(row.last_evaluated_at as string)
        : undefined,
      lastPrecisionAt5: row.last_precision_at_5
        ? parseFloat(row.last_precision_at_5 as string)
        : undefined,
      lastRecallAt20: row.last_recall_at_20
        ? parseFloat(row.last_recall_at_20 as string)
        : undefined,
      lastGroundedness: row.last_groundedness
        ? parseFloat(row.last_groundedness as string)
        : undefined,
    };
  }
}

// Export singleton instance
export const goldenDatasetService = new GoldenDatasetService();
export default goldenDatasetService;
