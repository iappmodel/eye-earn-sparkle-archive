import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Shield } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface AdminRouteProps {
  children: React.ReactNode;
}

/**
 * Protects admin routes: only users with admin or moderator role can access.
 * Shows loading state while role is being fetched, then either renders children
 * or shows access denied and redirects to home.
 */
const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { canAccessAdmin, isLoading, role } = useUserRole();
  const navigate = useNavigate();
  const { toast } = useToast();
  const hasToasted = useRef(false);

  useEffect(() => {
    if (isLoading || canAccessAdmin) return;
    if (hasToasted.current) return;
    hasToasted.current = true;
    toast({
      title: 'Access denied',
      description: 'You need admin or moderator privileges to view this page.',
      variant: 'destructive',
    });
  }, [canAccessAdmin, isLoading, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-card border flex items-center justify-center">
            <Shield className="w-8 h-8 text-muted-foreground" />
          </div>
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Checking permissions…</p>
        </div>
      </div>
    );
  }

  if (!canAccessAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Shield className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-4">
              You don&apos;t have permission to access the admin dashboard. Your role: <strong className="capitalize">{role}</strong>.
            </p>
            <Button onClick={() => navigate('/', { replace: true })}>
              Go to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};

export default AdminRoute;
