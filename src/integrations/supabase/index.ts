/**
 * Supabase integration: client, types, and partial insert API.
 *
 * Partial inserts: tables and RLS must exist. Use partialInsertOne, partialInsertMany,
 * or partialUpsert for type-safe partial inserts.
 */

export { supabase } from "./client";
export type {
  Database,
  Tables,
  TablesInsert,
  TablesUpdate,
  PublicTableName,
  PartialInsertRow,
} from "./types";
export {
  partialInsertOne,
  partialInsertMany,
  partialUpsert,
  normalizeInsertError,
  assertPartialInsert,
  partialInsertErrorMessage,
} from "./partialInsert";
export type {
  PartialInsertOptions,
  PartialInsertResult,
  PartialUpsertOptions,
} from "./partialInsert";
