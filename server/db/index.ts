import pg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;

// ═════════════════════════════════════════════════════════════════════════════
// FIREBASE SQL CONNECT / POSTGRESQL POOL CONFIGURATION
// ═════════════════════════════════════════════════════════════════════════════

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.FIREBASE_SQL_CONNECT_URL ||
  process.env.POSTGRES_PRISMA_URL;

const isProduction = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;

// Resolve SSL configuration
const sslConfig = isProduction || (connectionString && !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1'))
  ? { rejectUnauthorized: false }
  : false;

export const pool = new Pool(
  connectionString
    ? {
        connectionString,
        ssl: sslConfig,
        max: isProduction ? 10 : 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      }
    : {
        host: process.env.PGHOST || 'localhost',
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD || 'postgres',
        database: process.env.PGDATABASE || 'nexplay',
        port: Number(process.env.PGPORT) || 5432,
        ssl: sslConfig,
        max: 10,
      }
);

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

/**
 * Execute a parameterized query against the PostgreSQL pool.
 */
export async function query<T = any>(text: string, params?: any[]): Promise<pg.QueryResult<T>> {
  const start = Date.now();
  const res = await pool.query<T>(text, params);
  const duration = Date.now() - start;
  if (process.env.DEBUG_SQL === 'true') {
    console.log('[SQL]', { text, duration, rows: res.rowCount });
  }
  return res;
}

/**
 * Run a unit of work inside a managed PostgreSQL transaction.
 * Automatically BEGINs, COMMITs on success, or ROLLBACKs on exception.
 */
export async function withTransaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch((rbErr) => {
      console.error('Error during transaction rollback:', rbErr);
    });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Initialize all database tables and indexes from schema.sql.
 */
export async function initDatabaseSchema(): Promise<void> {
  try {
    const schemaPath = path.join(process.cwd(), 'server', 'db', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const ddl = fs.readFileSync(schemaPath, 'utf-8');
      await pool.query(ddl);
      console.log('✅ PostgreSQL Schema initialized successfully.');
    }
  } catch (error: any) {
    console.warn('PostgreSQL schema auto-initialization skipped or deferred:', error?.message);
  }
}

/**
 * Health check verification for SQL connectivity.
 */
export async function checkDatabaseHealth(): Promise<{ healthy: boolean; timestamp?: string; error?: string }> {
  try {
    const result = await pool.query('SELECT NOW() as now');
    return {
      healthy: true,
      timestamp: result.rows[0]?.now?.toISOString?.() || new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      healthy: false,
      error: error?.message || 'Database connection error',
    };
  }
}
