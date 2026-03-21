/**
 * SQL Query Tool - Read-only SQL queries against the database
 *
 * Security: SELECT-only regex, 10s timeout, 1000 row limit
 */

import type { AgentTool, ToolResult } from '../types.js';
import { databaseService } from '../../DatabaseService.js';

// Strict regex: only allow SELECT statements (no subqueries with DML)
const SELECT_ONLY_REGEX = /^\s*SELECT\b/i;
const FORBIDDEN_KEYWORDS = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE|EXEC|EXECUTE|INTO\s+OUTFILE)\b/i;
const MAX_ROWS = 1000;
const QUERY_TIMEOUT_MS = 10000;

export const sqlQueryTool: AgentTool = {
  name: 'sql_query',
  description: 'Execute a read-only SQL SELECT query against the PostgreSQL database. Use this to analyze data, count records, or look up specific information. Only SELECT queries are allowed.',
  parameters: {
    type: 'object',
    required: ['query'],
    properties: {
      query: {
        type: 'string',
        description: 'A valid PostgreSQL SELECT query. Only SELECT is allowed. Max 1000 rows returned.',
      },
    },
  },
  requiredRoles: ['Manager', 'Admin'],

  async execute(args: Record<string, unknown>): Promise<ToolResult> {
    const query = (args.query as string).trim();

    // Security checks
    if (!SELECT_ONLY_REGEX.test(query)) {
      return {
        output: 'Nur SELECT-Abfragen sind erlaubt.',
        error: 'only_select_allowed',
      };
    }

    if (FORBIDDEN_KEYWORDS.test(query)) {
      return {
        output: 'Die Abfrage enthält verbotene Schlüsselwörter (INSERT, UPDATE, DELETE, DROP, etc.).',
        error: 'forbidden_keywords',
      };
    }

    try {
      // Add LIMIT if not present
      const limitedQuery = /\bLIMIT\b/i.test(query)
        ? query
        : `${query} LIMIT ${MAX_ROWS}`;

      // Execute with timeout
      const result = await Promise.race([
        databaseService.query(`SET statement_timeout = '${QUERY_TIMEOUT_MS}'; ${limitedQuery}`),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Query timeout (10s)')), QUERY_TIMEOUT_MS + 1000)
        ),
      ]);

      const rows = result.rows;
      if (rows.length === 0) {
        return { output: 'Keine Ergebnisse.' };
      }

      // Format as table
      const columns = Object.keys(rows[0]!);
      let output = `Ergebnis: ${rows.length} Zeilen\n\n`;
      output += columns.join(' | ') + '\n';
      output += columns.map(() => '---').join(' | ') + '\n';

      for (const row of rows.slice(0, MAX_ROWS)) {
        output += columns.map(col => {
          const val = (row as any)[col];
          if (val === null) return 'NULL';
          if (typeof val === 'object') return JSON.stringify(val).substring(0, 100);
          return String(val).substring(0, 100);
        }).join(' | ') + '\n';
      }

      if (rows.length >= MAX_ROWS) {
        output += `\n(Ergebnis auf ${MAX_ROWS} Zeilen begrenzt)`;
      }

      return {
        output,
        metadata: { rowCount: rows.length, columns },
      };
    } catch (error) {
      return {
        output: `SQL Fehler: ${error instanceof Error ? error.message : String(error)}`,
        error: String(error),
      };
    }
  },
};
