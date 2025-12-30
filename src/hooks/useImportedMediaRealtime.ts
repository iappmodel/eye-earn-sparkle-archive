import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ImportedMedia {
  id: string;
  user_id: string;
  platform: string;
  original_url: string;
  media_type: string;
  title: string | null;
  description: string | null;
  thumbnail_url: string | null;
  duration: number | null;
  original_views: number | null;
  original_likes: number | null;
  imported_at: string;
  status: string;
}

interface UseImportedMediaRealtimeProps {
  onInsert?: (media: ImportedMedia) => void;
  onUpdate?: (media: ImportedMedia) => void;
  onDelete?: (id: string) => void;
}

export const useImportedMediaRealtime = ({
  onInsert,
  onUpdate,
  onDelete,
}: UseImportedMediaRealtimeProps = {}) => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    console.log('[Realtime] Subscribing to imported_media changes for user:', user.id);

    const channel = supabase
      .channel('imported-media-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'imported_media',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[Realtime] New media inserted:', payload.new);
          onInsert?.(payload.new as ImportedMedia);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'imported_media',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[Realtime] Media updated:', payload.new);
          onUpdate?.(payload.new as ImportedMedia);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'imported_media',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('[Realtime] Media deleted:', payload.old);
          onDelete?.((payload.old as ImportedMedia).id);
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Subscription status:', status);
      });

    return () => {
      console.log('[Realtime] Unsubscribing from imported_media changes');
      supabase.removeChannel(channel);
    };
  }, [user, onInsert, onUpdate, onDelete]);
};

export default useImportedMediaRealtime;
