/**
 * Fetches the current user's content flags and user reports (as reporter) for "My reports" UI.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface MyContentFlag {
  id: string;
  content_id: string;
  content_type: string;
  reason: string;
  status: string;
  action_taken: string | null;
  created_at: string;
}

export interface MyUserReport {
  id: string;
  reported_user_id: string;
  reason: string;
  status: string;
  action_taken: string | null;
  created_at: string;
}

export function useMyReports() {
  const { user } = useAuth();
  const [contentFlags, setContentFlags] = useState<MyContentFlag[]>([]);
  const [userReports, setUserReports] = useState<MyUserReport[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) {
      setContentFlags([]);
      setUserReports([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [flagsRes, reportsRes] = await Promise.all([
      supabase
        .from('content_flags')
        .select('id, content_id, content_type, reason, status, action_taken, created_at')
        .eq('flagged_by', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('user_reports')
        .select('id, reported_user_id, reason, status, action_taken, created_at')
        .eq('reported_by', user.id)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);
    setContentFlags((flagsRes.data ?? []) as MyContentFlag[]);
    setUserReports((reportsRes.data ?? []) as MyUserReport[]);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return {
    contentFlags,
    userReports,
    loading,
    refresh: fetch,
  };
}
