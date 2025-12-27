import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type AppRole = 'user' | 'creator' | 'moderator' | 'admin';

interface UseUserRoleReturn {
  role: AppRole;
  isLoading: boolean;
  isCreator: boolean;
  isModerator: boolean;
  isAdmin: boolean;
  hasRole: (role: AppRole) => boolean;
  refreshRole: () => Promise<void>;
}

export const useUserRole = (): UseUserRoleReturn => {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole>('user');
  const [isLoading, setIsLoading] = useState(true);

  const fetchRole = async () => {
    if (!user) {
      setRole('user');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('Error fetching role:', error);
      setRole('user');
    } else if (data) {
      setRole(data.role as AppRole);
    }
    
    setIsLoading(false);
  };

  useEffect(() => {
    fetchRole();
  }, [user?.id]);

  return {
    role,
    isLoading,
    isCreator: role === 'creator' || role === 'admin',
    isModerator: role === 'moderator' || role === 'admin',
    isAdmin: role === 'admin',
    hasRole: (checkRole: AppRole) => {
      if (role === 'admin') return true;
      if (role === 'moderator' && (checkRole === 'moderator' || checkRole === 'creator' || checkRole === 'user')) return true;
      if (role === 'creator' && (checkRole === 'creator' || checkRole === 'user')) return true;
      return role === checkRole;
    },
    refreshRole: fetchRole,
  };
};
