/**
 * React hook for type-safe partial inserts into Supabase.
 * Tables and RLS must exist. Use for single insert, bulk insert, or upsert with loading/error state.
 */

import { useCallback, useState } from "react";
import type { PublicTableName, PartialInsertRow, Tables } from "@/integrations/supabase/types";
import {
  partialInsertOne,
  partialInsertMany,
  partialUpsert,
  partialInsertErrorMessage,
  type PartialInsertOptions,
  type PartialInsertResult,
  type PartialUpsertOptions,
} from "@/integrations/supabase/partialInsert";

export type UsePartialInsertState<T> = {
  data: T | null;
  error: string | null;
  isInserting: boolean;
};

export type UsePartialInsertReturn<T extends PublicTableName, R = Tables<T> | null> = UsePartialInsertState<R> & {
  insertOne: (
    row: PartialInsertRow<T>,
    options?: PartialInsertOptions<T>
  ) => Promise<PartialInsertResult<R>>;
  insertMany: (
    rows: PartialInsertRow<T>[],
    options?: PartialInsertOptions<T>
  ) => Promise<PartialInsertResult<Tables<T>[]>>;
  upsert: (
    rows: PartialInsertRow<T> | PartialInsertRow<T>[],
    options?: PartialUpsertOptions<T>
  ) => Promise<PartialInsertResult<R | Tables<T>[]>>;
  reset: () => void;
};

/**
 * Hook for partial inserts (single, many, upsert) with loading and error state.
 * Tables and RLS must exist.
 */
export function usePartialInsert<T extends PublicTableName>(
  tableName: T
): UsePartialInsertReturn<T, Tables<T> | null> {
  const [data, setData] = useState<Tables<T> | Tables<T>[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInserting, setIsInserting] = useState(false);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsInserting(false);
  }, []);

  const insertOne = useCallback(
    async (row: PartialInsertRow<T>, options?: PartialInsertOptions<T>) => {
      setError(null);
      setIsInserting(true);
      try {
        const result = await partialInsertOne(tableName, row, options);
        if (result.error) {
          setError(partialInsertErrorMessage(result.normalizedError));
          return result as PartialInsertResult<Tables<T> | null>;
        }
        setData(result.data);
        return result as PartialInsertResult<Tables<T> | null>;
      } finally {
        setIsInserting(false);
      }
    },
    [tableName]
  );

  const insertMany = useCallback(
    async (rows: PartialInsertRow<T>[], options?: PartialInsertOptions<T>) => {
      setError(null);
      setIsInserting(true);
      try {
        const result = await partialInsertMany(tableName, rows, options);
        if (result.error) {
          setError(partialInsertErrorMessage(result.normalizedError));
          return result;
        }
        setData(result.data);
        return result;
      } finally {
        setIsInserting(false);
      }
    },
    [tableName]
  );

  const upsert = useCallback(
    async (
      rows: PartialInsertRow<T> | PartialInsertRow<T>[],
      options?: PartialUpsertOptions<T>
    ) => {
      setError(null);
      setIsInserting(true);
      try {
        const result = await partialUpsert(tableName, rows, options);
        if (result.error) {
          setError(partialInsertErrorMessage(result.normalizedError));
          return result as PartialInsertResult<Tables<T> | Tables<T>[] | null>;
        }
        setData(result.data);
        return result as PartialInsertResult<Tables<T> | Tables<T>[] | null>;
      } finally {
        setIsInserting(false);
      }
    },
    [tableName]
  );

  return {
    data: data as Tables<T> | null,
    error,
    isInserting,
    insertOne,
    insertMany,
    upsert,
    reset,
  };
}
