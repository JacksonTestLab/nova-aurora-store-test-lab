import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from './index.ts';
import * as schema from './schema.ts';
import { supabaseAdmin } from '../lib/supabase-server.ts';
import { normalizeUtcTimestamp } from '../utils/date.ts';

const TABLE_MAP = {
  users: schema.users,
  addresses: schema.addresses,
  categories: schema.categories,
  products: schema.products,
  coupons: schema.coupons,
  cash_registers: schema.cashRegisters,
  cash_movements: schema.cashMovements,
  orders: schema.orders,
  order_items: schema.orderItems,
  cart_items: schema.cartItems,
  favorites: schema.favorites,
  reviews: schema.reviews,
  financial_entries: schema.financialEntries,
  attachments: schema.attachments,
  audit_logs: schema.auditLogs,
  lab_settings: schema.labSettings,
} as const;

export type TableName = keyof typeof TABLE_MAP;

const TIMESTAMP_FIELDS = new Set([
  'lockedUntil',
  'createdAt',
  'expiresAt',
  'openedAt',
  'closedAt',
  'deliveredAt',
  'updatedAt',
]);

function normalizeRowTimestamps<T = any>(row: T): T {
  if (!row || typeof row !== 'object') return row;
  const out: Record<string, any> = { ...(row as any) };
  for (const key of Object.keys(out)) {
    if (TIMESTAMP_FIELDS.has(key) && out[key] !== null && out[key] !== undefined) {
      out[key] = normalizeUtcTimestamp(out[key]);
    }
  }
  return out as T;
}

export const isSupabaseRestBackend = (): boolean =>
  Boolean(supabaseAdmin) && !process.env.SUPABASE_DB_URL;

export const getActiveDatabaseMode = (): string => {
  if (process.env.SUPABASE_DB_URL) return 'supabase-postgres';
  if (supabaseAdmin) return 'supabase-rest';
  return 'postgres';
};

function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`);
}

function snakeToCamel(key: string): string {
  return key.replace(/_([a-z])/g, (_m, p1) => p1.toUpperCase());
}

function toSnakeRecord(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined) continue;
    out[camelToSnake(k)] = v instanceof Date ? v.toISOString() : v;
  }
  return out;
}

function toCamelRecord<T = any>(row: Record<string, any> | null | undefined): T {
  if (!row) return row as T;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    out[snakeToCamel(k)] = v;
  }
  return normalizeRowTimestamps<T>(out as T);
}

function buildDrizzleWhere(table: any, filters: Record<string, any>) {
  const clauses = Object.entries(filters)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => eq(table[k], v));
  if (clauses.length === 0) return undefined;
  return clauses.length === 1 ? clauses[0] : and(...clauses);
}

export const repo = {
  async countRows(tableName: TableName): Promise<number> {
    if (isSupabaseRestBackend() && supabaseAdmin) {
      const { count, error } = await supabaseAdmin
        .from(tableName)
        .select('*', { count: 'exact', head: true });
      if (error) throw new Error(error.message);
      return count || 0;
    }
    const table: any = TABLE_MAP[tableName];
    const rows = await db.select().from(table);
    return rows.length;
  },

  async listAll<T = any>(
    tableName: TableName,
    options?: { orderBy?: string; desc?: boolean; limit?: number; selectCols?: string[] }
  ): Promise<T[]> {
    if (isSupabaseRestBackend() && supabaseAdmin) {
      const cols = options?.selectCols
        ? options.selectCols.map(camelToSnake).join(',')
        : '*';
      let query = supabaseAdmin.from(tableName).select(cols);
      if (options?.orderBy) {
        query = query.order(camelToSnake(options.orderBy), {
          ascending: !options.desc,
        });
      }
      if (options?.limit) {
        query = query.limit(options.limit);
      }
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data || []).map((r: any) => toCamelRecord<T>(r));
    }

    const table: any = TABLE_MAP[tableName];
    let q: any;
    if (options?.selectCols) {
      const projection: Record<string, any> = {};
      for (const c of options.selectCols) projection[c] = table[c];
      q = db.select(projection).from(table);
    } else {
      q = db.select().from(table);
    }
    if (options?.orderBy && table[options.orderBy]) {
      q = q.orderBy(options.desc ? desc(table[options.orderBy]) : asc(table[options.orderBy]));
    }
    if (options?.limit) {
      q = q.limit(options.limit);
    }
    return ((await q) as T[]).map((r) => normalizeRowTimestamps<T>(r));
  },

  async findWhere<T = any>(
    tableName: TableName,
    filters: Record<string, any>,
    options?: { orderBy?: string; desc?: boolean; limit?: number }
  ): Promise<T[]> {
    if (isSupabaseRestBackend() && supabaseAdmin) {
      let query = supabaseAdmin.from(tableName).select('*').match(toSnakeRecord(filters));
      if (options?.orderBy) {
        query = query.order(camelToSnake(options.orderBy), {
          ascending: !options.desc,
        });
      }
      if (options?.limit) {
        query = query.limit(options.limit);
      }
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return (data || []).map((r: any) => toCamelRecord<T>(r));
    }

    const table: any = TABLE_MAP[tableName];
    const whereClause = buildDrizzleWhere(table, filters);
    let q: any = whereClause ? db.select().from(table).where(whereClause) : db.select().from(table);
    if (options?.orderBy && table[options.orderBy]) {
      q = q.orderBy(options.desc ? desc(table[options.orderBy]) : asc(table[options.orderBy]));
    }
    if (options?.limit) {
      q = q.limit(options.limit);
    }
    return ((await q) as T[]).map((r) => normalizeRowTimestamps<T>(r));
  },

  async findOneWhere<T = any>(
    tableName: TableName,
    filters: Record<string, any>
  ): Promise<T | null> {
    const rows = await this.findWhere<T>(tableName, filters, { limit: 1 });
    return rows[0] || null;
  },

  async findIn<T = any>(
    tableName: TableName,
    col: string,
    values: any[]
  ): Promise<T[]> {
    if (!values || values.length === 0) return [];
    if (isSupabaseRestBackend() && supabaseAdmin) {
      const { data, error } = await supabaseAdmin
        .from(tableName)
        .select('*')
        .in(camelToSnake(col), values);
      if (error) throw new Error(error.message);
      return (data || []).map((r: any) => toCamelRecord<T>(r));
    }

    const table: any = TABLE_MAP[tableName];
    return ((await db.select().from(table).where(inArray(table[col], values))) as T[]).map((r) =>
      normalizeRowTimestamps<T>(r)
    );
  },

  async insertRow<T = any>(tableName: TableName, data: Record<string, any>): Promise<T> {
    if (isSupabaseRestBackend() && supabaseAdmin) {
      const { data: inserted, error } = await supabaseAdmin
        .from(tableName)
        .insert(toSnakeRecord(data))
        .select()
        .single();
      if (error) throw new Error(error.message);
      return toCamelRecord<T>(inserted);
    }

    const table: any = TABLE_MAP[tableName];
    const rows = (await db.insert(table).values(data).returning()) as any[];
    return normalizeRowTimestamps<T>(rows[0] as T);
  },

  async insertMany<T = any>(tableName: TableName, rows: Record<string, any>[]): Promise<T[]> {
    if (rows.length === 0) return [];
    if (isSupabaseRestBackend() && supabaseAdmin) {
      const { data: inserted, error } = await supabaseAdmin
        .from(tableName)
        .insert(rows.map(toSnakeRecord))
        .select();
      if (error) throw new Error(error.message);
      return (inserted || []).map((r: any) => toCamelRecord<T>(r));
    }

    const table: any = TABLE_MAP[tableName];
    return ((await db.insert(table).values(rows).returning()) as T[]).map((r) =>
      normalizeRowTimestamps<T>(r)
    );
  },

  async upsertRow<T = any>(
    tableName: TableName,
    data: Record<string, any>,
    conflictCol: string
  ): Promise<T> {
    if (isSupabaseRestBackend() && supabaseAdmin) {
      const { data: upserted, error } = await supabaseAdmin
        .from(tableName)
        .upsert(toSnakeRecord(data), { onConflict: camelToSnake(conflictCol) })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return toCamelRecord<T>(upserted);
    }

    const table: any = TABLE_MAP[tableName];
    const rows = (await db
      .insert(table)
      .values(data)
      .onConflictDoUpdate({
        target: table[conflictCol],
        set: data,
      })
      .returning()) as any[];
    return rows[0] as T;
  },

  async updateWhere<T = any>(
    tableName: TableName,
    filters: Record<string, any>,
    data: Record<string, any>
  ): Promise<T[]> {
    if (isSupabaseRestBackend() && supabaseAdmin) {
      const { data: updated, error } = await supabaseAdmin
        .from(tableName)
        .update(toSnakeRecord(data))
        .match(toSnakeRecord(filters))
        .select();
      if (error) throw new Error(error.message);
      return (updated || []).map((r: any) => toCamelRecord<T>(r));
    }

    const table: any = TABLE_MAP[tableName];
    const whereClause = buildDrizzleWhere(table, filters);
    if (!whereClause) throw new Error('updateWhere requires at least one filter');
    return (await db.update(table).set(data).where(whereClause).returning()) as T[];
  },

  async deleteWhere<T = any>(
    tableName: TableName,
    filters: Record<string, any>
  ): Promise<T[]> {
    if (isSupabaseRestBackend() && supabaseAdmin) {
      const { data: deleted, error } = await supabaseAdmin
        .from(tableName)
        .delete()
        .match(toSnakeRecord(filters))
        .select();
      if (error) throw new Error(error.message);
      return (deleted || []).map((r: any) => toCamelRecord<T>(r));
    }

    const table: any = TABLE_MAP[tableName];
    const whereClause = buildDrizzleWhere(table, filters);
    if (!whereClause) throw new Error('deleteWhere requires at least one filter');
    return (await db.delete(table).where(whereClause).returning()) as T[];
  },

  async deleteAll(tableName: TableName): Promise<void> {
    if (isSupabaseRestBackend() && supabaseAdmin) {
      const filterCol = tableName === 'lab_settings' ? 'key' : 'id';
      const filterVal = tableName === 'lab_settings' ? '__nonexistent__' : -1;
      const { error } = await supabaseAdmin.from(tableName).delete().neq(filterCol, filterVal);
      if (error) throw new Error(error.message);
      return;
    }

    const table: any = TABLE_MAP[tableName];
    await db.delete(table);
  },

  async deleteAllExcept(tableName: TableName, keepIds: number[]): Promise<void> {
    if (!keepIds || keepIds.length === 0) {
      return this.deleteAll(tableName);
    }
    if (isSupabaseRestBackend() && supabaseAdmin) {
      const { error } = await supabaseAdmin
        .from(tableName)
        .delete()
        .not('id', 'in', `(${keepIds.join(',')})`);
      if (error) throw new Error(error.message);
      return;
    }

    const table: any = TABLE_MAP[tableName];
    const all = (await db.select({ id: table.id }).from(table)) as Array<{ id: number }>;
    const toDelete = all.map((r) => r.id).filter((id) => !keepIds.includes(id));
    if (toDelete.length > 0) {
      await db.delete(table).where(inArray(table.id, toDelete));
    }
  },

  async runInTransaction<T>(fn: () => Promise<T>): Promise<T> {
    if (isSupabaseRestBackend() && supabaseAdmin) {
      // Supabase REST does not expose cross-request SQL transactions; callers handle snapshot/rollback
      return fn();
    }
    return db.transaction(async () => fn());
  },

  async adjustNumericColumn(
    tableName: 'products' | 'coupons',
    id: number,
    col: 'stock' | 'usedCount',
    delta: number
  ): Promise<void> {
    if (isSupabaseRestBackend() && supabaseAdmin) {
      const current = await this.findOneWhere(tableName, { id });
      if (!current) return;
      const nextVal = Math.max(0, Number(current[col] || 0) + delta);
      await this.updateWhere(tableName, { id }, { [col]: nextVal });
      return;
    }

    const table: any = TABLE_MAP[tableName];
    await db
      .update(table)
      .set({ [col]: sql`${table[col]} + ${delta}` })
      .where(eq(table.id, id));
  },
};
