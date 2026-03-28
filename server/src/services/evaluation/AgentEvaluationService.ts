/**
 * AgentEvaluationService - Benchmarks agent strategies (hybrid, cloud-only, local-only)
 *
 * Runs golden dataset queries through different agent pipeline strategies
 * and measures quality, cost, latency, and tool reliability.
 */

import { databaseService } from '../DatabaseService.js';
import { goldenDatasetService } from './GoldenDatasetService.js';
import { agentExecutor } from '../agents/AgentExecutor.js';
import { agentPersistence } from '../agents/AgentPersistence.js';
import { queryClassifier } from '../agents/QueryClassifier.js';
import { env } from '../../config/env.js';
import type { AgentUserContext, AgentStrategy } from '../agents/types.js';

export interface AgentEvalConfig {
  strategy: AgentStrategy;
  localModel?: string;
  cloudModel?: string;
  goldenQueryIds?: string[];
  timeoutPerQuery?: number;
}

interface AgentEvalRunResult {
  id: string;
  strategy: AgentStrategy;
  status: string;
  queryCount: number;
  avgKeyFactsCovered: number | null;
  avgGroundedness: number | null;
  hallucinationRate: number | null;
  ragUsageRate: number | null;
  toolReliabilityRate: number | null;
  avgLatencyMs: number | null;
  totalCostEur: number | null;
  createdAt: Date;
  completedAt: Date | null;
}

interface AgentEvalQueryResult {
  goldenQueryId: string;
  classificationComplexity: string | null;
  classificationReason: string | null;
  skipPreSearch: boolean;
  answer: string;
  keyFactsCovered: number;
  hallucinationDetected: boolean;
  groundedness: number;
  usedRag: boolean;
  ragResultCount: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostEur: number;
  classificationMs: number;
  preSearchMs: number;
  generationMs: number;
  totalMs: number;
  toolCallsAttempted: number;
  toolCallsSucceeded: number;
  expectedToolUsed: boolean;
  agentTaskId: string | null;
}

export class AgentEvaluationService {
  /**
   * Start an evaluation run for a given strategy
   */
  async startRun(config: AgentEvalConfig): Promise<string> {
    const result = await databaseService.query(
      `INSERT INTO agent_evaluation_runs (strategy, config, status)
       VALUES ($1, $2, 'pending')
       RETURNING id`,
      [config.strategy, JSON.stringify(config)]
    );

    const runId = result.rows[0].id;

    // Run in background
    this.executeRun(runId, config).catch((error) => {
      console.error(`[AgentEval] Run ${runId} failed:`, error);
      this.markFailed(runId, error instanceof Error ? error.message : String(error));
    });

    return runId;
  }

  /**
   * Run a full benchmark: all three strategies sequentially
   */
  async startBenchmark(baseConfig?: Partial<AgentEvalConfig>): Promise<{ hybrid: string; cloudOnly: string; localOnly: string }> {
    const strategies: AgentStrategy[] = ['hybrid', 'cloud-only', 'local-only'];
    const runIds: Record<string, string> = {};

    for (const strategy of strategies) {
      runIds[strategy] = await this.startRun({ ...baseConfig, strategy });
    }

    return {
      hybrid: runIds['hybrid']!,
      cloudOnly: runIds['cloud-only']!,
      localOnly: runIds['local-only']!,
    };
  }

  /**
   * Get run status and aggregated metrics
   */
  async getRun(runId: string): Promise<AgentEvalRunResult | null> {
    const result = await databaseService.query(
      'SELECT * FROM agent_evaluation_runs WHERE id = $1',
      [runId]
    );

    if (result.rows.length === 0) return null;
    return this.mapRun(result.rows[0]);
  }

  /**
   * List all runs
   */
  async listRuns(limit: number = 20): Promise<AgentEvalRunResult[]> {
    const result = await databaseService.query(
      'SELECT * FROM agent_evaluation_runs ORDER BY created_at DESC LIMIT $1',
      [limit]
    );
    return result.rows.map(this.mapRun);
  }

  /**
   * Get detailed results for a run
   */
  async getResults(runId: string): Promise<AgentEvalQueryResult[]> {
    const result = await databaseService.query(
      'SELECT * FROM agent_evaluation_results WHERE run_id = $1 ORDER BY created_at',
      [runId]
    );
    return result.rows.map(this.mapResult);
  }

  // ── Private: Execution ──

  private async executeRun(runId: string, config: AgentEvalConfig): Promise<void> {
    await databaseService.query(
      `UPDATE agent_evaluation_runs SET status = 'running', started_at = NOW() WHERE id = $1`,
      [runId]
    );

    // Load golden dataset
    let queries = await goldenDatasetService.getAll();

    if (config.goldenQueryIds?.length) {
      const ids = new Set(config.goldenQueryIds);
      queries = queries.filter((q: { id: string }) => ids.has(q.id));
    }

    if (queries.length === 0) {
      throw new Error('Kein Golden Dataset vorhanden — bitte erst Queries anlegen');
    }

    console.log(`[AgentEval] Starting run ${runId}: strategy=${config.strategy}, queries=${queries.length}`);

    // Create a synthetic admin context for evaluation (all documents visible)
    const evalContext: AgentUserContext = {
      userId: 'eval-system',
      userRole: 'Admin',
      department: 'System',
    };

    const timeout = config.timeoutPerQuery || 60000;
    const results: AgentEvalQueryResult[] = [];

    for (const goldenQuery of queries) {
      try {
        const result = await this.evaluateQuery(goldenQuery, config, evalContext, timeout);
        results.push(result);

        // Persist individual result
        await this.persistResult(runId, result);

        console.log(`[AgentEval] ${config.strategy} | "${goldenQuery.query.substring(0, 40)}..." → groundedness=${result.groundedness.toFixed(2)}, cost=${result.estimatedCostEur.toFixed(4)}€, ${result.totalMs}ms`);
      } catch (error) {
        console.error(`[AgentEval] Query failed: "${goldenQuery.query.substring(0, 40)}..."`, error);
        // Persist failed result with zeros
        const failedResult: AgentEvalQueryResult = {
          goldenQueryId: goldenQuery.id,
          classificationComplexity: null,
          classificationReason: null,
          skipPreSearch: false,
          answer: `ERROR: ${error instanceof Error ? error.message : String(error)}`,
          keyFactsCovered: 0,
          hallucinationDetected: false,
          groundedness: 0,
          usedRag: false,
          ragResultCount: 0,
          model: '',
          inputTokens: 0,
          outputTokens: 0,
          estimatedCostEur: 0,
          classificationMs: 0,
          preSearchMs: 0,
          generationMs: 0,
          totalMs: 0,
          toolCallsAttempted: 0,
          toolCallsSucceeded: 0,
          expectedToolUsed: false,
          agentTaskId: null,
        };
        results.push(failedResult);
        await this.persistResult(runId, failedResult);
      }
    }

    // Calculate aggregates
    const aggregates = this.calculateAggregates(results);

    await databaseService.query(
      `UPDATE agent_evaluation_runs SET
        status = 'completed',
        completed_at = NOW(),
        query_count = $2,
        avg_key_facts_covered = $3,
        avg_groundedness = $4,
        hallucination_rate = $5,
        rag_usage_rate = $6,
        tool_reliability_rate = $7,
        avg_latency_ms = $8,
        total_cost_eur = $9
       WHERE id = $1`,
      [
        runId,
        results.length,
        aggregates.avgKeyFactsCovered,
        aggregates.avgGroundedness,
        aggregates.hallucinationRate,
        aggregates.ragUsageRate,
        aggregates.toolReliabilityRate,
        aggregates.avgLatencyMs,
        aggregates.totalCostEur,
      ]
    );

    console.log(`[AgentEval] Run ${runId} completed: ${results.length} queries, groundedness=${aggregates.avgGroundedness?.toFixed(2)}, cost=${aggregates.totalCostEur?.toFixed(4)}€`);
  }

  private async evaluateQuery(
    goldenQuery: { id: string; query: string; expectedAnswer: string; keyFacts: string[]; forbiddenContent: string[] },
    config: AgentEvalConfig,
    context: AgentUserContext,
    timeout: number
  ): Promise<AgentEvalQueryResult> {
    const totalStart = Date.now();

    // Classification (only for hybrid strategy)
    let classificationMs = 0;
    let classification = null;
    if (config.strategy === 'hybrid') {
      const classStart = Date.now();
      classification = queryClassifier.classify(goldenQuery.query);
      classificationMs = Date.now() - classStart;
    }

    // Execute based on strategy
    const genStart = Date.now();
    let task;

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), timeout);

    try {
      switch (config.strategy) {
        case 'hybrid':
          task = await agentExecutor.executeHybrid(
            goldenQuery.query,
            context,
            classification!,
            { signal: abortController.signal }
          );
          break;

        case 'cloud-only':
          task = await agentExecutor.execute(goldenQuery.query, context, {
            model: config.cloudModel || env.CLOUD_MODEL,
            routingDecision: 'rag',
            signal: abortController.signal,
          });
          break;

        case 'local-only':
          task = await agentExecutor.execute(goldenQuery.query, context, {
            model: config.localModel || env.LOCAL_MODEL,
            routingDecision: 'direct',
            signal: abortController.signal,
          });
          break;
      }
    } finally {
      clearTimeout(timeoutId);
    }

    const generationMs = Date.now() - genStart;
    const totalMs = Date.now() - totalStart;

    // Extract answer
    const answer = task.result?.answer || '';

    // Get steps to analyze tool usage
    const taskDetail = await agentPersistence.getTaskWithSteps(
      { ...context, userId: task.userId } as AgentUserContext,
      task.id
    );
    const steps = taskDetail?.steps || [];

    const toolCallsAttempted = steps.length;
    const toolCallsSucceeded = steps.filter(s => !s.toolOutput?.startsWith('Fehler') && !s.toolOutput?.startsWith('ERROR')).length;
    const usedRag = steps.some(s => s.toolName === 'rag_search') || (config.strategy === 'hybrid' && classification?.complexity === 'simple' && !classification?.skipPreSearch);
    const ragSteps = steps.filter(s => s.toolName === 'rag_search');
    const ragResultCount = ragSteps.length > 0 ? (ragSteps[0]?.toolOutput?.match(/Gefunden: (\d+)/)?.[1] ?? '0') : '0';

    // Quality metrics — keyword-based (same pattern as existing EvaluationService)
    const lowerAnswer = answer.toLowerCase();
    const keyFactsFound = goldenQuery.keyFacts.filter(fact =>
      lowerAnswer.includes(fact.toLowerCase())
    ).length;
    const keyFactsCovered = goldenQuery.keyFacts.length > 0
      ? keyFactsFound / goldenQuery.keyFacts.length
      : 1;

    const hallucinationDetected = goldenQuery.forbiddenContent.some(forbidden =>
      lowerAnswer.includes(forbidden.toLowerCase())
    );

    // Simple groundedness: if answer references source documents, it's grounded
    const groundedness = usedRag && answer.length > 50 && !hallucinationDetected
      ? Math.min(keyFactsCovered + 0.3, 1.0)
      : keyFactsCovered * 0.5;

    // Expected tool usage: did the strategy use RAG when the golden query has relevant docs?
    const needsRag = goldenQuery.expectedAnswer.length > 0;
    const expectedToolUsed = !needsRag || usedRag;

    return {
      goldenQueryId: goldenQuery.id,
      classificationComplexity: classification?.complexity || null,
      classificationReason: classification?.reason || null,
      skipPreSearch: classification?.skipPreSearch || false,
      answer,
      keyFactsCovered,
      hallucinationDetected,
      groundedness,
      usedRag,
      ragResultCount: parseInt(String(ragResultCount)) || 0,
      model: task.model,
      inputTokens: task.inputTokens,
      outputTokens: task.outputTokens,
      estimatedCostEur: 0, // Will be calculated from tokens
      classificationMs,
      preSearchMs: 0, // Captured inside executeHybrid, not easily extractable — use totalMs - generationMs
      generationMs,
      totalMs,
      toolCallsAttempted,
      toolCallsSucceeded,
      expectedToolUsed,
      agentTaskId: task.id,
    };
  }

  private calculateAggregates(results: AgentEvalQueryResult[]) {
    const valid = results.filter(r => r.answer && !r.answer.startsWith('ERROR'));
    const n = valid.length || 1;

    return {
      avgKeyFactsCovered: valid.reduce((sum, r) => sum + r.keyFactsCovered, 0) / n,
      avgGroundedness: valid.reduce((sum, r) => sum + r.groundedness, 0) / n,
      hallucinationRate: valid.filter(r => r.hallucinationDetected).length / n,
      ragUsageRate: valid.filter(r => r.usedRag).length / n,
      toolReliabilityRate: valid.filter(r => r.expectedToolUsed).length / n,
      avgLatencyMs: Math.round(valid.reduce((sum, r) => sum + r.totalMs, 0) / n),
      totalCostEur: valid.reduce((sum, r) => sum + r.estimatedCostEur, 0),
    };
  }

  private async persistResult(runId: string, r: AgentEvalQueryResult): Promise<void> {
    await databaseService.query(
      `INSERT INTO agent_evaluation_results (
        run_id, golden_query_id,
        classification_complexity, classification_reason, skip_pre_search,
        answer, key_facts_covered, hallucination_detected, groundedness,
        used_rag, rag_result_count,
        model, input_tokens, output_tokens, estimated_cost_eur,
        classification_ms, pre_search_ms, generation_ms, total_ms,
        tool_calls_attempted, tool_calls_succeeded, expected_tool_used,
        agent_task_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23)`,
      [
        runId, r.goldenQueryId,
        r.classificationComplexity, r.classificationReason, r.skipPreSearch,
        r.answer?.substring(0, 5000), r.keyFactsCovered, r.hallucinationDetected, r.groundedness,
        r.usedRag, r.ragResultCount,
        r.model, r.inputTokens, r.outputTokens, r.estimatedCostEur,
        r.classificationMs, r.preSearchMs, r.generationMs, r.totalMs,
        r.toolCallsAttempted, r.toolCallsSucceeded, r.expectedToolUsed,
        r.agentTaskId,
      ]
    );
  }

  private async markFailed(runId: string, errorMessage: string): Promise<void> {
    await databaseService.query(
      `UPDATE agent_evaluation_runs SET status = 'failed', error_message = $2, completed_at = NOW() WHERE id = $1`,
      [runId, errorMessage]
    );
  }

  // ── Mappers ──

  private mapRun(row: Record<string, unknown>): AgentEvalRunResult {
    return {
      id: row.id as string,
      strategy: row.strategy as AgentStrategy,
      status: row.status as string,
      queryCount: (row.query_count as number) || 0,
      avgKeyFactsCovered: row.avg_key_facts_covered as number | null,
      avgGroundedness: row.avg_groundedness as number | null,
      hallucinationRate: row.hallucination_rate as number | null,
      ragUsageRate: row.rag_usage_rate as number | null,
      toolReliabilityRate: row.tool_reliability_rate as number | null,
      avgLatencyMs: row.avg_latency_ms as number | null,
      totalCostEur: row.total_cost_eur as number | null,
      createdAt: row.created_at as Date,
      completedAt: row.completed_at as Date | null,
    };
  }

  private mapResult(row: Record<string, unknown>): AgentEvalQueryResult {
    return {
      goldenQueryId: row.golden_query_id as string,
      classificationComplexity: row.classification_complexity as string | null,
      classificationReason: row.classification_reason as string | null,
      skipPreSearch: row.skip_pre_search as boolean,
      answer: row.answer as string,
      keyFactsCovered: row.key_facts_covered as number,
      hallucinationDetected: row.hallucination_detected as boolean,
      groundedness: row.groundedness as number,
      usedRag: row.used_rag as boolean,
      ragResultCount: row.rag_result_count as number,
      model: row.model as string,
      inputTokens: row.input_tokens as number,
      outputTokens: row.output_tokens as number,
      estimatedCostEur: row.estimated_cost_eur as number,
      classificationMs: row.classification_ms as number,
      preSearchMs: row.pre_search_ms as number,
      generationMs: row.generation_ms as number,
      totalMs: row.total_ms as number,
      toolCallsAttempted: row.tool_calls_attempted as number,
      toolCallsSucceeded: row.tool_calls_succeeded as number,
      expectedToolUsed: row.expected_tool_used as boolean,
      agentTaskId: row.agent_task_id as string | null,
    };
  }
}

export const agentEvaluationService = new AgentEvaluationService();
