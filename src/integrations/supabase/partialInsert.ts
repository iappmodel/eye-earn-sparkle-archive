/**
 * Partial Inserts into Supabase.
 *
 * Tables and RLS must exist. This module provides type-safe partial inserts:
 * send only the columns you need; the rest use DB defaults. Unknown columns
 * are stripped so schema/RLS stay consistent.
 */

import type { PostgrestError } from "@supabase/supabase-js";
import { supabase } from "./client";
import type { Database, PartialInsertRow, PublicTableName, Tables, TablesInsert } from "./types";

const DEFAULT_RETRY_ATTEMPTS = 2;
const DEFAULT_RETRY_DELAY_MS = 500;

type PublicSchema = Database["public"];
type TableDef<T extends PublicTableName> = PublicSchema["Tables"][T];

/**
 * Sanitize payload: remove undefined so DB defaults apply; keep null and other values.
 * Type safety is enforced by PartialInsertRow<T>; Postgres will reject unknown columns.
 */
function sanitizePayload<T extends PublicTableName>(
  _tableName: T,
  row: PartialInsertRow<T>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === undefined) continue;
    out[k] = v;
  }
  if (Object.keys(out).length === 0) {
    throw new Error("Partial insert payload is empty after removing undefined. Provide at least one column.");
  }
  return out;
}

/**
 * Normalize Postgrest error into a message and code for callers.
 * Tables and RLS must exist; we surface "table missing" and "RLS" hints when possible.
 */
export function normalizeInsertError(error: PostgrestError | null): {
  message: string;
  code: string;
  hint: "table_missing" | "rls" | "constraint" | "unknown";
} {
  if (!error) return { message: "", code: "", hint: "unknown" };
  const msg = error.message ?? "";
  const code = error.code ?? "";
  let hint: "table_missing" | "rls" | "constraint" | "unknown" = "unknown";
  if (code === "42P01" || /relation.*does not exist/i.test(msg)) hint = "table_missing";
  else if (code === "42501" || /policy|permission denied|row-level security/i.test(msg)) hint = "rls";
  else if (code === "23505" || code === "23503" || /constraint|violates/i.test(msg)) hint = "constraint";
  return { message: msg, code, hint };
}

export type PartialInsertOptions<T extends PublicTableName> = {
  /** Columns to return after insert (e.g. `'id,created_at'` or `'*'`). Omit for no return. */
  returning?: "id" | "id,created_at" | "*" | (keyof TableDef<T>["Row"])[] | string;
  /** Retry on transient failures. Default 2. */
  retryAttempts?: number;
  /** Delay between retries (ms). Default 500. */
  retryDelayMs?: number;
};

export type PartialInsertResult<R = unknown> = {
  data: R | null;
  error: PostgrestError | null;
  normalizedError: ReturnType<typeof normalizeInsertError>;
};

/**
 * Insert a single row with partial columns. Tables and RLS must exist.
 */
export async function partialInsertOne<T extends PublicTableName>(
  tableName: T,
  row: PartialInsertRow<T>,
  options: PartialInsertOptions<T> = {}
): Promise<PartialInsertResult<Tables<T> | null>> {
  const { returning, retryAttempts = DEFAULT_RETRY_ATTEMPTS, retryDelayMs = DEFAULT_RETRY_DELAY_MS } = options;
  const payload = sanitizePayload(tableName, row);
  let lastError: PostgrestError | null = null;
  for (let attempt = 0; attempt <= retryAttempts; attempt++) {
    let q = supabase.from(tableName).insert(payload as any);
    if (returning) {
      const cols = Array.isArray(returning) ? returning.join(",") : returning;
      q = q.select(cols).single();
    }
    const { data, error } = await q;
    if (!error) {
      return { data: data as Tables<T> | null, error: null, normalizedError: normalizeInsertError(null) };
    }
    lastError = error;
    const { hint } = normalizeInsertError(error);
    if (hint === "table_missing" || hint === "rls" || hint === "constraint") break;
    if (attempt < retryAttempts) await new Promise((r) => setTimeout(r, retryDelayMs * (attempt + 1)));
  }
  return {
    data: null,
    error: lastError,
    normalizedError: normalizeInsertError(lastError),
  };
}

/**
 * Insert multiple rows in one request. Tables and RLS must exist.
 */
export async function partialInsertMany<T extends PublicTableName>(
  tableName: T,
  rows: PartialInsertRow<T>[],
  options: PartialInsertOptions<T> = {}
): Promise<PartialInsertResult<Tables<T>[]>> {
  const { returning, retryAttempts = DEFAULT_RETRY_ATTEMPTS, retryDelayMs = DEFAULT_RETRY_DELAY_MS } = options;
  const payloads = rows.map((row) => sanitizePayload(tableName, row));
  let lastError: PostgrestError | null = null;
  for (let attempt = 0; attempt <= retryAttempts; attempt++) {
    let q = supabase.from(tableName).insert(payloads as any);
    if (returning) {
      const cols = Array.isArray(returning) ? returning.join(",") : returning;
      q = q.select(cols);
    }
    const { data, error } = await q;
    if (!error) {
      return { data: (data ?? []) as Tables<T>[], error: null, normalizedError: normalizeInsertError(null) };
    }
    lastError = error;
    const { hint } = normalizeInsertError(error);
    if (hint === "table_missing" || hint === "rls" || hint === "constraint") break;
    if (attempt < retryAttempts) await new Promise((r) => setTimeout(r, retryDelayMs * (attempt + 1)));
  }
  return {
    data: null,
    error: lastError,
    normalizedError: normalizeInsertError(lastError),
  };
}

export type PartialUpsertOptions<T extends PublicTableName> = PartialInsertOptions<T> & {
  onConflict?: string;
  ignoreDuplicates?: boolean;
};

/**
 * Upsert one or more rows. Tables and RLS must exist.
 */
export async function partialUpsert<T extends PublicTableName>(
  tableName: T,
  rows: PartialInsertRow<T> | PartialInsertRow<T>[],
  options: PartialUpsertOptions<T> = {}
): Promise<PartialInsertResult<Tables<T> | Tables<T>[] | null>> {
  const {
    returning,
    onConflict,
    ignoreDuplicates = false,
    retryAttempts = DEFAULT_RETRY_ATTEMPTS,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  } = options;
  const arr = Array.isArray(rows) ? rows : [rows];
  if (arr.length === 0) {
    return {
      data: null,
      error: { message: "No rows to upsert", code: "PGRST000", details: null, hint: null } as PostgrestError,
      normalizedError: normalizeInsertError(null),
    };
  }
  const payloads = arr.map((row) => sanitizePayload(tableName, row));
  const single = arr.length === 1;
  let lastError: PostgrestError | null = null;
  for (let attempt = 0; attempt <= retryAttempts; attempt++) {
    let q = supabase.from(tableName).upsert(payloads as any, {
      onConflict: onConflict ?? undefined,
      ignoreDuplicates,
    });
    if (returning) {
      const cols = Array.isArray(returning) ? returning.join(",") : returning;
      q = single ? (q.select(cols).single() as any) : q.select(cols);
    }
    const { data, error } = await q;
    if (!error) {
      const result = single ? (data as Tables<T> | null) : (data ?? []) as Tables<T>[];
      return { data: result, error: null, normalizedError: normalizeInsertError(null) };
    }
    lastError = error;
    const { hint } = normalizeInsertError(error);
    if (hint === "table_missing" || hint === "rls" || hint === "constraint") break;
    if (attempt < retryAttempts) await new Promise((r) => setTimeout(r, retryDelayMs * (attempt + 1)));
  }
  return {
    data: null,
    error: lastError,
    normalizedError: normalizeInsertError(lastError),
  };
}

/**
 * Helper: throw if result has error, otherwise return data.
 */
export function assertPartialInsert<R>(result: PartialInsertResult<R>): R {
  if (result.error) {
    const e = result.normalizedError;
    const err = new Error(e.message || "Partial insert failed");
    (err as any).code = e.code;
    (err as any).hint = e.hint;
    throw err;
  }
  return result.data as R;
}

/** User-friendly message for normalized error (tables and RLS must exist). */
export function partialInsertErrorMessage(normalized: ReturnType<typeof normalizeInsertError>): string {
  if (!normalized.message) return "Insert failed.";
  switch (normalized.hint) {
    case "table_missing":
      return "Table does not exist. Run migrations and ensure the table is created.";
    case "rls":
      return "Permission denied. Check RLS policies and that you are authenticated.";
    case "constraint":
      return normalized.message;
    default:
      return normalized.message;
  }
}
