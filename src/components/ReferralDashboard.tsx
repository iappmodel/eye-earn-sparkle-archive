import React from 'react';
import { Users, Copy, Share2, Gift, TrendingUp, Link, CheckCircle, Clock, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useReferral } from '@/hooks/useReferral';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { format } from 'date-fns';

interface ReferralDashboardProps {
  className?: string;
  compact?: boolean;
}

export const ReferralDashboard: React.FC<ReferralDashboardProps> = ({ className, compact = false }) => {
  const { 
    referralCode, 
    referrals, 
    totalReferrals, 
    totalEarnings, 
    isLoading: loading, 
    copyReferralLink, 
    shareReferralLink 
  } = useReferral();

  if (loading) {
    return (
      <div className={cn('space-y-4', className)}>
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (compact) {
    return (
      <div className={cn('p-4 rounded-2xl bg-gradient-to-r from-primary/10 to-icoin/10 border border-primary/20', className)}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-bold">{totalReferrals} Referrals</p>
            <p className="text-sm text-muted-foreground">
              {totalEarnings.toFixed(2)} coins earned
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={shareReferralLink}>
            <Share2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Referral Code Card */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-icoin/20 border border-primary/30">
        <div className="flex items-center gap-2 mb-4">
          <Link className="w-5 h-5 text-primary" />
          <h3 className="font-bold">Your Referral Code</h3>
        </div>
        
        <div className="flex items-center gap-3 p-3 rounded-xl bg-background/80 border border-border mb-4">
          <code className="flex-1 font-mono text-lg font-bold tracking-wider">
            {referralCode?.code || 'Loading...'}
          </code>
          <Button size="sm" variant="ghost" onClick={copyReferralLink}>
            <Copy className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex gap-2">
          <Button className="flex-1 gap-2" onClick={copyReferralLink}>
            <Copy className="w-4 h-4" />
            Copy Link
          </Button>
          <Button variant="outline" className="flex-1 gap-2" onClick={shareReferralLink}>
            <Share2 className="w-4 h-4" />
            Share
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <Users className="w-4 h-4" />
            <span className="text-xs">Total Referrals</span>
          </div>
          <p className="text-2xl font-bold">{totalReferrals}</p>
        </div>
        
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <DollarSign className="w-4 h-4" />
            <span className="text-xs">Total Earnings</span>
          </div>
          <p className="text-2xl font-bold text-primary">{totalEarnings.toFixed(2)}</p>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <CheckCircle className="w-4 h-4" />
            <span className="text-xs">Active Referrals</span>
          </div>
          <p className="text-2xl font-bold text-green-500">
            {referrals.filter(r => r.status === 'active').length}
          </p>
        </div>

        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-2 text-muted-foreground mb-2">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs">Commission Rate</span>
          </div>
          <p className="text-2xl font-bold text-icoin">10%</p>
        </div>
      </div>

      {/* How it works */}
      <div className="p-4 rounded-xl bg-secondary/30 border border-border">
        <h4 className="font-medium mb-3 flex items-center gap-2">
          <Gift className="w-4 h-4 text-primary" />
          How Referrals Work
        </h4>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>1. Share your unique referral code with friends</p>
          <p>2. They sign up using your code</p>
          <p>3. You earn 10% of their rewards for 90 days</p>
          <p>4. They also get a welcome bonus!</p>
        </div>
      </div>

      {/* Referral History */}
      {referrals.length > 0 && (
        <div className="space-y-3">
          <h4 className="font-medium">Recent Referrals</h4>
          <div className="space-y-2">
            {referrals.slice(0, 5).map((referral) => (
              <div
                key={referral.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border"
              >
                <Avatar className="h-10 w-10">
                  <AvatarFallback>
                    <Users className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium text-sm">Referred User</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(referral.created_at), 'MMM d, yyyy')}
                  </p>
                </div>
                <div className="text-right">
                  <p className={cn(
                    'text-xs font-medium px-2 py-1 rounded-full',
                    referral.status === 'active' 
                      ? 'bg-green-500/20 text-green-500' 
                      : 'bg-muted text-muted-foreground'
                  )}>
                    {referral.status}
                  </p>
                  <p className="text-xs text-primary mt-1">
                    +{referral.earnings_shared.toFixed(2)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {referrals.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No referrals yet</p>
          <p className="text-sm">Share your code to start earning!</p>
        </div>
      )}
    </div>
  );
};

export default ReferralDashboard;
