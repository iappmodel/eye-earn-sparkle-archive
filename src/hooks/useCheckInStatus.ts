/**
 * useCheckInStatus – check whether user can check in at a promotion (24h cooldown)
 * and optional standalone (quick) check-in status.
 */
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isDemoMode } from '@/lib/appMode';
import { useAuth } from '@/contexts/AuthContext';

const COOLDOWN_HOURS = 24;

export interface CheckInStatus {
  canCheckIn: boolean;
  lastCheckIn: { id: string; checked_in_at: string } | null;
  nextAvailableAt: Date | null;
  isLoading: boolean;
  error: string | null;
}

export function useCheckInStatus(promotionId: string | null, options?: { enabled?: boolean }) {
  const { user } = useAuth();
  const enabled = options?.enabled !== false;
  const [state, setState] = useState<CheckInStatus>({
    canCheckIn: true,
    lastCheckIn: null,
    nextAvailableAt: null,
    isLoading: true,
    error: null,
  });

  const refetch = useCallback(async () => {
    if (!user?.id || !enabled) {
      setState((s) => ({ ...s, isLoading: false }));
      return;
    }

    if (isDemoMode) {
      setState({
        canCheckIn: true,
        lastCheckIn: null,
        nextAvailableAt: null,
        isLoading: false,
        error: null,
      });
      return;
    }

    setState((s) => ({ ...s, isLoading: true, error: null }));

    try {
      const since = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000).toISOString();
      let query = supabase
        .from('promotion_checkins')
        .select('id, checked_in_at')
        .eq('user_id', user.id)
        .gte('checked_in_at', since)
        .order('checked_in_at', { ascending: false })
        .limit(1);

      if (promotionId) {
        query = query.eq('promotion_id', promotionId);
      } else {
        query = query.is('promotion_id', null);
      }

      const { data, error } = await query.maybeSingle();

      if (error) throw error;

      const lastCheckIn = data ?? null;
      const nextAvailableAt = lastCheckIn
        ? new Date(new Date(lastCheckIn.checked_in_at).getTime() + COOLDOWN_HOURS * 60 * 60 * 1000)
        : null;
      const canCheckIn = !lastCheckIn;

      setState({
        canCheckIn,
        lastCheckIn,
        nextAvailableAt,
        isLoading: false,
        error: null,
      });
    } catch (err: unknown) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Failed to load check-in status',
      }));
    }
  }, [user?.id, promotionId, enabled]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { ...state, refetch };
}
