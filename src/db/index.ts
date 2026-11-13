import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, PoolConfig } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

const supabaseDbUrl = (process.env.SUPABASE_DB_URL || '').trim();
const sqlHost = (process.env.SQL_HOST || '').trim();
const isSupabaseHost =
  Boolean(supabaseDbUrl) ||
  sqlHost.includes('.supabase.co') ||
  sqlHost.includes('.supabase.com');

export const dbMode: 'supabase-postgres' | 'postgres' = isSupabaseHost
  ? 'supabase-postgres'
  : 'postgres';

export const createPool = () => {
  if (!global._postgresPool) {
    const config: PoolConfig = supabaseDbUrl
      ? {
          connectionString: supabaseDbUrl,
          ssl: { rejectUnauthorized: false },
          max: 10,
          connectionTimeoutMillis: 15000,
        }
      : {
          host: process.env.SQL_HOST,
          port: process.env.SQL_PORT ? Number(process.env.SQL_PORT) : undefined,
          user: process.env.SQL_USER,
          password: process.env.SQL_PASSWORD,
          database: process.env.SQL_DB_NAME,
          ...(isSupabaseHost ? { ssl: { rejectUnauthorized: false } } : {}),
          max: 10,
          connectionTimeoutMillis: 15000,
        };

    global._postgresPool = new Pool(config);

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();
export const db = drizzle(pool, { schema });
export { pool };
