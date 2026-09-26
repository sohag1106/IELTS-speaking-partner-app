import pg from 'pg';
import { env } from '../env.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 10,
  // Neon requires TLS. If a Windows cert-store issue causes
  // "self-signed certificate" errors, uncomment the next line:
  // ssl: { rejectUnauthorized: false },
});

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params as unknown[]);
}
