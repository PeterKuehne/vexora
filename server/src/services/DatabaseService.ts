import { Pool, PoolClient, QueryResult } from 'pg';
import { env } from '../config/env.js';

/**
 * DatabaseService - PostgreSQL connection pool and query helpers
 */

class DatabaseService {
  private pool: Pool | null = null;

  /**
   * Initialize database connection pool
   */
  async initialize(): Promise<void> {
    if (this.pool) {
      return; // Already initialized
    }

    try {
      this.pool = new Pool({
        host: env.POSTGRES_HOST || 'localhost',
        port: env.POSTGRES_PORT || 5432,
        database: env.POSTGRES_DB || 'vexora',
        user: env.POSTGRES_USER || 'vexora',
        password: env.POSTGRES_PASSWORD || 'vexora_dev_password',
        max: 20, // Maximum number of clients in the pool
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      });

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();

      console.log('✅ PostgreSQL connection pool initialized');
    } catch (error) {
      console.error('❌ Failed to initialize PostgreSQL connection:', error);
      throw error;
    }
  }

  /**
   * Get a client from the pool
   */
  async getClient(): Promise<PoolClient> {
    if (!this.pool) {
      await this.initialize();
    }
    return this.pool!.connect();
  }

  /**
   * Execute a query
   */
  async query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    if (!this.pool) {
      await this.initialize();
    }
    return this.pool!.query<T>(text, params);
  }

  /**
   * Execute a query with a transaction
   */
  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.getClient();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ status: 'ok' | 'error'; error?: string }> {
    try {
      if (!this.pool) {
        await this.initialize();
      }
      await this.pool!.query('SELECT 1');
      return { status: 'ok' };
    } catch (error) {
      return {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }
}

// Export singleton instance
export const databaseService = new DatabaseService();
export default databaseService;
