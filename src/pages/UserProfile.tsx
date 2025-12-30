import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PublicProfile } from '@/components/PublicProfile';
import { supabase } from '@/integrations/supabase/client';

const UserProfile = () => {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);

  useEffect(() => {
    const resolveUser = async () => {
      if (!userId) return;

      // Check if it's a UUID or username
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);

      if (isUuid) {
        setResolvedUserId(userId);
      } else {
        // Look up by username
        const { data } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('username', userId)
          .single();

        if (data) {
          setResolvedUserId(data.user_id);
        }
      }
    };

    resolveUser();
  }, [userId]);

  if (!resolvedUserId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <PublicProfile
      userId={resolvedUserId}
      isOpen={true}
      onClose={() => navigate(-1)}
      onMessage={(id) => navigate(`/messages/${id}`)}
    />
  );
};

export default UserProfile;
