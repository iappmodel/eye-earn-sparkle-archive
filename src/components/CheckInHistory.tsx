import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, MapPin, Clock, Coins, CheckCircle2, XCircle, AlertCircle, RefreshCw, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, subDays, isAfter } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

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

type StatusFilter = 'all' | 'verified' | 'failed';
type DateFilter = '7' | '30' | 'all';

interface CheckInHistoryProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Called when user taps "Discover nearby" in empty state */
  onDiscover?: () => void;
}

export function CheckInHistory({ trigger, open: controlledOpen, onOpenChange: controlledOnOpenChange, onDiscover }: CheckInHistoryProps) {
  const { user } = useAuth();
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [internalOpen, setInternalOpen] = useState(false);

  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? (controlledOnOpenChange || (() => {})) : setInternalOpen;

  const loadCheckIns = useCallback(async (isRefresh = false) => {
    if (!user?.id) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const { data, error } = await supabase
        .from('promotion_checkins')
        .select('*')
        .eq('user_id', user.id)
        .order('checked_in_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      setCheckIns(data || []);
    } catch (error) {
      console.error('Error loading check-ins:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (open && user?.id) {
      loadCheckIns();
    }
  }, [open, user?.id, loadCheckIns]);

  const filteredCheckIns = useMemo(() => {
    let list = checkIns;
    if (dateFilter !== 'all') {
      const since = subDays(new Date(), parseInt(dateFilter, 10));
      list = list.filter((c) => isAfter(new Date(c.checked_in_at), since));
    }
    if (statusFilter === 'verified') list = list.filter((c) => c.status === 'verified');
    if (statusFilter === 'failed') list = list.filter((c) => c.status === 'failed');
    return list;
  }, [checkIns, dateFilter, statusFilter]);

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

  const sheetContent = (
    <SheetContent side="bottom" className="h-[85vh] flex flex-col">
      <SheetHeader className="pb-2 flex-shrink-0">
        <div className="flex items-center justify-between w-full">
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Check-In History
          </SheetTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => loadCheckIns(true)}
            disabled={loading || refreshing}
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          </Button>
        </div>
      </SheetHeader>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3 mb-3 flex-shrink-0">
        <div className="bg-muted/50 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold">{checkIns.length}</div>
          <div className="text-xs text-muted-foreground">Total</div>
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
          <div className="text-xs text-muted-foreground">Earned</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-3 flex-shrink-0">
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        {(['all', 'verified', 'failed'] as StatusFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-medium transition',
              statusFilter === s
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted',
            )}
          >
            {s === 'all' ? 'All' : s === 'verified' ? 'Verified' : 'Failed'}
          </button>
        ))}
        <span className="text-muted-foreground text-xs mx-1">|</span>
        {(['7', '30', 'all'] as DateFilter[]).map((d) => (
          <button
            key={d}
            onClick={() => setDateFilter(d)}
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-medium transition',
              dateFilter === d
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted',
            )}
          >
            {d === 'all' ? 'All time' : `Last ${d} days`}
          </button>
        ))}
      </div>

      <ScrollArea className="flex-1 min-h-0">
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
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <MapPin className="h-10 w-10 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-1">No Check-ins Yet</h3>
            <p className="text-sm text-muted-foreground max-w-[280px] mb-6">
              Visit promotion locations and check in to earn rewards. Use the map to discover nearby spots!
            </p>
            {onDiscover && (
              <Button onClick={() => { setOpen(false); onDiscover(); }} className="gap-2">
                <MapPin className="h-4 w-4" />
                Discover Nearby
              </Button>
            )}
          </div>
        ) : filteredCheckIns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <p className="text-sm text-muted-foreground">No check-ins match the current filters.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => { setStatusFilter('all'); setDateFilter('all'); }}>
              Clear filters
            </Button>
          </div>
        ) : (
          <div className="space-y-3 pb-4">
            <p className="text-xs text-muted-foreground">Showing {filteredCheckIns.length} check-in{filteredCheckIns.length !== 1 ? 's' : ''}</p>
            {filteredCheckIns.map((checkIn) => (
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
  );

  if (isControlled) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        {sheetContent}
      </Sheet>
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || defaultTrigger}
      </SheetTrigger>
      {sheetContent}
    </Sheet>
  );
}
