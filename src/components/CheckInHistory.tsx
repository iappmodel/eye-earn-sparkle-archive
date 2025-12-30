import React, { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, MapPin, Clock, Coins, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';

interface CheckIn {
  id: string;
  business_name: string;
  checked_in_at: string;
  status: string;
  reward_amount: number | null;
  reward_type: string | null;
  reward_claimed: boolean;
  distance_meters: number;
  latitude: number;
  longitude: number;
}

interface CheckInHistoryProps {
  trigger?: React.ReactNode;
}

export function CheckInHistory({ trigger }: CheckInHistoryProps) {
  const { user } = useAuth();
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open && user?.id) {
      loadCheckIns();
    }
  }, [open, user?.id]);

  const loadCheckIns = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('promotion_checkins')
        .select('*')
        .eq('user_id', user.id)
        .order('checked_in_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setCheckIns(data || []);
    } catch (error) {
      console.error('Error loading check-ins:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string, rewardClaimed: boolean) => {
    if (status === 'verified' && rewardClaimed) {
      return <Badge variant="default" className="bg-green-500">Rewarded</Badge>;
    }
    if (status === 'verified') {
      return <Badge variant="secondary">Verified</Badge>;
    }
    if (status === 'failed') {
      return <Badge variant="destructive">Failed</Badge>;
    }
    return <Badge variant="outline">Pending</Badge>;
  };

  const totalEarned = checkIns
    .filter(c => c.reward_claimed && c.reward_amount)
    .reduce((sum, c) => sum + (c.reward_amount || 0), 0);

  const defaultTrigger = (
    <Button variant="outline" size="sm" className="gap-2">
      <History className="h-4 w-4" />
      History
    </Button>
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || defaultTrigger}
      </SheetTrigger>
      <SheetContent side="bottom" className="h-[85vh]">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Check-In History
          </SheetTitle>
        </SheetHeader>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold">{checkIns.length}</div>
            <div className="text-xs text-muted-foreground">Total Check-ins</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-500">
              {checkIns.filter(c => c.status === 'verified').length}
            </div>
            <div className="text-xs text-muted-foreground">Verified</div>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-primary flex items-center justify-center gap-1">
              <Coins className="h-4 w-4" />
              {totalEarned}
            </div>
            <div className="text-xs text-muted-foreground">Coins Earned</div>
          </div>
        </div>

        <ScrollArea className="h-[calc(85vh-200px)]">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex gap-3 p-3 border rounded-lg">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : checkIns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <MapPin className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold mb-1">No Check-ins Yet</h3>
              <p className="text-sm text-muted-foreground max-w-[250px]">
                Visit promotion locations and check in to start earning rewards!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {checkIns.map((checkIn) => (
                <div
                  key={checkIn.id}
                  className="flex gap-3 p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                    {getStatusIcon(checkIn.status)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-medium truncate">{checkIn.business_name}</h4>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <Clock className="h-3 w-3" />
                          {format(new Date(checkIn.checked_in_at), 'MMM d, yyyy • h:mm a')}
                        </div>
                      </div>
                      {getStatusBadge(checkIn.status, checkIn.reward_claimed)}
                    </div>
                    
                    <div className="flex items-center gap-3 mt-2 text-sm">
                      {checkIn.reward_claimed && checkIn.reward_amount ? (
                        <span className="text-green-600 font-medium flex items-center gap-1">
                          <Coins className="h-3.5 w-3.5" />
                          +{checkIn.reward_amount} {checkIn.reward_type}
                        </span>
                      ) : checkIn.status === 'verified' ? (
                        <span className="text-muted-foreground">Reward pending</span>
                      ) : null}
                      <span className="text-muted-foreground">
                        <MapPin className="h-3 w-3 inline mr-1" />
                        {Math.round(checkIn.distance_meters)}m away
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
