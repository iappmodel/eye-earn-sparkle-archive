import React, { useState, useMemo } from 'react';
import {
  MapPin,
  Coins,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Video,
  CheckCircle2,
  Zap,
  Compass,
} from 'lucide-react';
import { usePromoEarningsAnalytics, type PromoEarningsPeriod } from '@/hooks/usePromoEarningsAnalytics';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Progress } from './ui/progress';
import { useLocalization } from '@/contexts/LocalizationContext';

interface PromoEarningsSectionProps {
  /** Callback when user taps "Earn more" – e.g. open discovery map */
  onDiscover?: () => void;
  /** Compact mode for tighter layout */
  compact?: boolean;
}

const SOURCE_LABELS: Record<string, string> = {
  checkin: 'Check-ins',
  promo_view: 'Promo views',
  task_complete: 'Tasks',
};

export function PromoEarningsSection({ onDiscover, compact }: PromoEarningsSectionProps) {
  const { t } = useLocalization();
  const { user } = useAuth();
  const { data, loading, error, refetch } = usePromoEarningsAnalytics(user?.id);
  const [period, setPeriod] = useState<PromoEarningsPeriod>('7d');
  const [expanded, setExpanded] = useState(false);
  const [showChart, setShowChart] = useState(true);

  const periodTotal = useMemo(() => {
    switch (period) {
      case 'today':
        return data.byPeriod.today;
      case '7d':
        return data.byPeriod.week;
      case '30d':
        return data.byPeriod.month;
      default:
        return data.byPeriod.week;
    }
  }, [period, data]);

  const displayedItems = useMemo(() => {
    const now = Date.now();
    const cutoffs: Record<PromoEarningsPeriod, number> = {
      today: 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };
    const cutoff = now - cutoffs[period];
    return data.items.filter((it) => it.timestamp.getTime() >= cutoff).slice(0, expanded ? 20 : 5);
  }, [data.items, period, expanded]);

  const chartData = useMemo(() => {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 1;
    const buckets: { date: string; total: number; vicoin: number; icoin: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const dayItems = data.items.filter(
        (it) => it.timestamp >= d && it.timestamp < next
      );
      const vicoin = dayItems.filter((i) => i.coinType === 'vicoin').reduce((s, i) => s + i.amount, 0);
      const icoin = dayItems.filter((i) => i.coinType === 'icoin').reduce((s, i) => s + i.amount, 0);
      buckets.push({
        date: format(d, days <= 7 ? 'EEE' : 'MMM d'),
        total: vicoin + icoin,
        vicoin,
        icoin,
      });
    }
    return buckets;
  }, [data.items, period]);

  const sourceBreakdown = useMemo(() => {
    const total = data.bySource.checkin + data.bySource.promoView + data.bySource.taskComplete;
    if (total === 0) return [];
    return [
      { key: 'checkin', label: SOURCE_LABELS.checkin, value: data.bySource.checkin, pct: (data.bySource.checkin / total) * 100 },
      { key: 'promoView', label: SOURCE_LABELS.promo_view, value: data.bySource.promoView, pct: (data.bySource.promoView / total) * 100 },
      { key: 'taskComplete', label: SOURCE_LABELS.task_complete, value: data.bySource.taskComplete, pct: (data.bySource.taskComplete / total) * 100 },
    ].filter((s) => s.value > 0);
  }, [data.bySource]);

  const weekGoal = 500;
  const weekProgress = Math.min(100, (data.byPeriod.week / weekGoal) * 100);

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'checkin':
        return <MapPin className="w-3.5 h-3.5 text-amber-500" />;
      case 'promo_view':
        return <Video className="w-3.5 h-3.5 text-primary" />;
      case 'task_complete':
        return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
      default:
        return <Zap className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  if (loading && !data.items.length) {
    return (
      <div className="neu-card rounded-2xl p-4 animate-pulse">
        <div className="h-5 bg-muted rounded w-32 mb-3" />
        <div className="h-12 bg-muted rounded mb-2" />
        <div className="h-4 bg-muted rounded w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="neu-card rounded-2xl p-4">
        <p className="text-sm text-destructive mb-2">{error}</p>
        <button
          onClick={refetch}
          className="flex items-center gap-2 text-sm text-primary"
        >
          <RefreshCw className="w-4 h-4" />
          {t('common.retry')}
        </button>
      </div>
    );
  }

  return (
    <div className="neu-card rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-medium">{t('wallet.promoEarnings')}</span>
        </div>
        <button
          onClick={refetch}
          className="p-1 rounded-lg hover:bg-muted transition-colors"
          aria-label="Refresh"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Period tabs */}
      <div className="flex gap-1 p-1 neu-inset rounded-xl mb-4">
        {(['today', '7d', '30d'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              'flex-1 py-1.5 rounded-lg text-xs font-medium transition-all',
              period === p ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {p === 'today' ? t('wallet.today') : p === '7d' ? '7 Days' : '30 Days'}
          </button>
        ))}
      </div>

      {/* Summary */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl font-display font-bold">
          {periodTotal}
          <span className="text-base font-normal text-muted-foreground ml-1">coins</span>
        </span>
        {data.periodComparison && data.periodComparison.trend !== 'same' && (
          <span
            className={cn(
              'flex items-center gap-1 text-xs font-medium',
              data.periodComparison.trend === 'up' && 'text-emerald-600',
              data.periodComparison.trend === 'down' && 'text-destructive'
            )}
          >
            {data.periodComparison.trend === 'up' && <TrendingUp className="w-3.5 h-3.5" />}
            {data.periodComparison.trend === 'down' && <TrendingDown className="w-3.5 h-3.5" />}
            {data.periodComparison.trend === 'same' && <Minus className="w-3.5 h-3.5" />}
            {data.periodComparison.change !== 0 && (
              <span>{data.periodComparison.change > 0 ? '+' : ''}{data.periodComparison.change}% vs last week</span>
            )}
          </span>
        )}
      </div>

      {/* Vicoin / Icoin split */}
      {(data.totalVicoin > 0 || data.totalIcoin > 0) && (
        <div className="flex gap-4 mb-3 text-xs">
          {data.totalVicoin > 0 && (
            <span className="flex items-center gap-1 font-semibold text-vicoin">
              <Coins className="w-3 h-3" /> {data.totalVicoin} V
            </span>
          )}
          {data.totalIcoin > 0 && (
            <span className="flex items-center gap-1 font-semibold text-icoin">
              <Coins className="w-3 h-3" /> {data.totalIcoin} I
            </span>
          )}
        </div>
      )}

      {/* Weekly goal bar (when period is 7d or 30d) */}
      {(period === '7d' || period === '30d') && (
        <div className="mb-4">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Weekly goal ({data.byPeriod.week}/{weekGoal})</span>
          </div>
          <Progress value={weekProgress} className="h-1.5" />
        </div>
      )}

      {/* Source breakdown */}
      {sourceBreakdown.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2">By source</p>
          <div className="space-y-2">
            {sourceBreakdown.map((s) => (
              <div key={s.key} className="flex items-center gap-2">
                {getSourceIcon(s.key)}
                <div className="flex-1 min-w-0">
                  <Progress value={s.pct} className="h-1.5" />
                </div>
                <span className="text-xs font-medium w-14 text-right truncate">{s.value} coins</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mini chart */}
      {showChart && chartData.length > 1 && chartData.some((d) => d.total > 0) && (
        <div className="mb-4 h-24">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
              <defs>
                <linearGradient id="promoEarningsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value: number) => [`${value} coins`, 'Total']}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="hsl(var(--primary))"
                fill="url(#promoEarningsGradient)"
                strokeWidth={1.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Locations */}
      {data.locations.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-muted-foreground mb-2">
            <MapPin className="w-3 h-3 inline mr-1" />
            {data.locations.length} location{data.locations.length !== 1 ? 's' : ''} visited
          </p>
          <div className="flex flex-wrap gap-1">
            {data.locations.slice(0, 5).map((loc) => (
              <span
                key={loc.name}
                className="text-xs px-2 py-0.5 rounded-full neu-inset"
              >
                {loc.name}
              </span>
            ))}
            {data.locations.length > 5 && (
              <span className="text-xs text-muted-foreground">+{data.locations.length - 5} more</span>
            )}
          </div>
        </div>
      )}

      {/* Recent activity */}
      {displayedItems.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">Recent activity</p>
          <div className="space-y-1.5">
            {displayedItems.map((it) => (
              <div
                key={it.id}
                className="flex items-center gap-2 py-1.5 px-2 rounded-lg neu-inset"
              >
                {getSourceIcon(it.source)}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{it.label}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(it.timestamp, { addSuffix: true })}
                  </p>
                </div>
                <span
                  className={cn(
                    'text-xs font-display font-semibold',
                    it.coinType === 'vicoin' ? 'text-vicoin' : 'text-icoin'
                  )}
                >
                  +{it.amount} {it.coinType === 'vicoin' ? 'V' : 'I'}
                </span>
              </div>
            ))}
          </div>
          {data.items.length > 5 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-primary mt-2 w-full justify-center py-1"
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  {t('wallet.showLess')}
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  {t('wallet.showMoreCount', { count: data.items.length - 5 })}
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {!loading && data.items.length === 0 && (
        <div className="text-center py-6">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
            <MapPin className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium mb-1">{t('wallet.noPromoEarningsYet')}</p>
          <p className="text-xs text-muted-foreground mb-4">
            {t('wallet.noPromoEarningsHint')}
          </p>
          {onDiscover && (
            <button
              onClick={onDiscover}
              className="flex items-center gap-2 mx-auto px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium"
            >
              <Compass className="w-4 h-4" />
              {t('wallet.findPlacesToEarn')}
            </button>
          )}
        </div>
      )}

      {/* Earn more CTA (when there's data) */}
      {data.items.length > 0 && onDiscover && !compact && (
        <button
          onClick={onDiscover}
          className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl neu-button text-sm font-medium"
        >
          <Compass className="w-4 h-4" />
          {t('wallet.earnMoreNearby')}
        </button>
      )}
    </div>
  );
}
