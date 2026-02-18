/**
 * Wallet Reconciliation Service – Admin-only client for wallet audit.
 * Calls the wallet-reconciliation edge function.
 */
import { supabase } from '@/integrations/supabase/client';

export interface ReconciliationRow {
  user_id: string;
  currency: string;
  ledger_sum: number;
  profile_balance: number;
  discrepancy: number;
  ledger_count: number;
  username: string | null;
  display_name: string | null;
}

export interface ReconciliationResponse {
  rows: ReconciliationRow[];
  discrepancy_count: number;
  total_rows: number;
}

export interface LedgerEntry {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  currency: string;
  ref_id: string;
  metadata: Record<string, unknown> | null;
  row_hash: string | null;
  created_at: string;
  username: string | null;
  display_name: string | null;
}

export interface LedgerEntriesResponse {
  entries: LedgerEntry[];
  total_count: number;
  limit: number;
  offset: number;
}

export interface ReconciliationParams {
  user_id?: string;
  limit?: number;
}

export interface LedgerEntriesParams {
  user_id?: string;
  type?: string;
  currency?: string;
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
}

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const { data, error } = await supabase.functions.invoke('wallet-reconciliation', {
    body,
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) throw new Error(error.message ?? 'Wallet reconciliation API failed');
  if (data?.error) throw new Error(data.error as string);
  return data as T;
}

export const walletReconciliationService = {
  async getReconciliation(params: ReconciliationParams = {}): Promise<ReconciliationResponse> {
    return invoke<ReconciliationResponse>({
      action: 'reconciliation',
      user_id: params.user_id ?? undefined,
      limit: params.limit ?? 100,
    });
  },

  async getLedgerEntries(params: LedgerEntriesParams = {}): Promise<LedgerEntriesResponse> {
    return invoke<LedgerEntriesResponse>({
      action: 'ledger_entries',
      user_id: params.user_id ?? undefined,
      type: params.type ?? undefined,
      currency: params.currency ?? undefined,
      since: params.since ?? undefined,
      until: params.until ?? undefined,
      limit: params.limit ?? 50,
      offset: params.offset ?? 0,
    });
  },
};
