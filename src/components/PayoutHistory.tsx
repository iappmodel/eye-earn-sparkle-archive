import React, { useState, useEffect } from 'react';
import { ArrowDownToLine, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

interface PayoutRequest {
  id: string;
  amount: number;
  coin_type: string;
  status: string;
  fee: number | null;
  net_amount: number | null;
  reference_id: string | null;
  failure_reason: string | null;
  processed_at: string | null;
  created_at: string;
}

export const PayoutHistory: React.FC = () => {
  const { user } = useAuth();
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadPayouts();
    }
  }, [user]);

  const loadPayouts = async () => {
    try {
      const { data, error } = await supabase
        .from('payout_requests')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setPayouts((data || []) as PayoutRequest[]);
    } catch (error) {
      console.error('Error loading payouts:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-destructive" />;
      case 'processing': return <Clock className="w-4 h-4 text-yellow-500 animate-pulse" />;
      case 'pending': return <Clock className="w-4 h-4 text-muted-foreground" />;
      default: return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      completed: 'default',
      processing: 'secondary',
      pending: 'outline',
      failed: 'destructive',
      cancelled: 'outline',
    };
    return (
      <Badge variant={variants[status] || 'outline'} className="capitalize">
        {status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ArrowDownToLine className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold">Payout History</h3>
      </div>

      {payouts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            <ArrowDownToLine className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No payouts yet</p>
            <p className="text-sm">Your withdrawal history will appear here</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {payouts.map((payout) => (
            <Card key={payout.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      {getStatusIcon(payout.status)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">
                          {payout.amount.toLocaleString()} {payout.coin_type === 'vicoin' ? 'V' : 'I'}
                        </span>
                        {getStatusBadge(payout.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(payout.created_at), 'MMM d, yyyy • h:mm a')}
                      </p>
                      {payout.fee && payout.fee > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Fee: {payout.fee} • Net: {payout.net_amount}
                        </p>
                      )}
                      {payout.failure_reason && (
                        <p className="text-xs text-destructive mt-1">
                          {payout.failure_reason}
                        </p>
                      )}
                    </div>
                  </div>
                  {payout.reference_id && (
                    <span className="text-xs text-muted-foreground font-mono">
                      #{payout.reference_id.slice(-8)}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
