import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Download, RefreshCw, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { merchantCheckoutService } from '@/services/merchantCheckout.service';
import { useUserRole } from '@/hooks/useUserRole';
import type {
  MerchantCheckoutFunnelBreakdownRow,
  MerchantCheckoutFunnelResult,
} from '@/services/merchantCheckout.service';

const WINDOW_OPTIONS = [
  { label: '24h', hours: 24 },
  { label: '7d', hours: 24 * 7 },
  { label: '30d', hours: 24 * 30 },
] as const;

const SCOPE_OPTIONS = [
  { label: 'My data', scope: 'SELF' as const },
  { label: 'Global', scope: 'GLOBAL' as const },
] as const;

function toPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function escapeCsvCell(value: string | number) {
  const asText = String(value ?? '');
  if (/["\n,]/.test(asText)) {
    return `"${asText.replace(/"/g, '""')}"`;
  }
  return asText;
}

function buildFunnelCsv(funnel: MerchantCheckoutFunnelResult) {
  const lines: string[] = [];
  lines.push(
    [
      'section',
      'key',
      'started',
      'resolved',
      'confirmed',
      'abandoned',
      'started_to_confirmed',
      'window_hours',
      'scope',
      'from',
      'generated_at',
    ].join(',')
  );

  const nowIso = new Date().toISOString();
  const base = ['', '', '', '', '', '', '', funnel.windowHours, funnel.scope, funnel.from, nowIso];
  const pushLine = (values: Array<string | number>) => {
    lines.push(values.map(escapeCsvCell).join(','));
  };

  pushLine([
    'totals',
    'events',
    funnel.totals.events,
    '',
    '',
    '',
    '',
    base[7] as number,
    base[8] as string,
    base[9] as string,
    base[10] as string,
  ]);
  pushLine([
    'totals',
    'unique_users',
    funnel.totals.uniqueUsers ?? 0,
    '',
    '',
    '',
    '',
    base[7] as number,
    base[8] as string,
    base[9] as string,
    base[10] as string,
  ]);
  pushLine([
    'totals',
    'unique_merchants',
    funnel.totals.uniqueMerchants ?? 0,
    '',
    '',
    '',
    '',
    base[7] as number,
    base[8] as string,
    base[9] as string,
    base[10] as string,
  ]);

  const appendBreakdown = (section: string, rows: MerchantCheckoutFunnelBreakdownRow[]) => {
    rows.forEach((row) =>
      pushLine([
        section,
        row.key,
        row.started,
        row.resolved,
        row.confirmed,
        row.abandoned,
        row.started_to_confirmed,
        base[7] as number,
        base[8] as string,
        base[9] as string,
        base[10] as string,
      ])
    );
  };

  appendBreakdown('entry_type', funnel.breakdown.entryType ?? []);
  appendBreakdown('merchant_id', funnel.breakdown.merchantId ?? []);
  appendBreakdown('merchant_category', funnel.breakdown.merchantCategory ?? []);
  appendBreakdown('checkout_mode', funnel.breakdown.checkoutMode ?? []);
  appendBreakdown('tip_timing', funnel.breakdown.tipTiming ?? []);

  return lines.join('\n');
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function BreakdownTable(props: {
  title: string;
  rows: MerchantCheckoutFunnelBreakdownRow[];
  emptyLabel?: string;
}) {
  const { title, rows, emptyLabel = 'No events in this window.' } = props;
  return (
    <div className="rounded-2xl border border-border/60 p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{title}</p>
      {!rows.length ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[540px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 pr-2 font-medium">Key</th>
                <th className="pb-2 pr-2 font-medium">Started</th>
                <th className="pb-2 pr-2 font-medium">Confirmed</th>
                <th className="pb-2 pr-2 font-medium">Abandoned</th>
                <th className="pb-2 font-medium">Start-&gt;Confirm</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.key} className="border-t border-border/50">
                  <td className="py-2 pr-2 font-medium">{row.key}</td>
                  <td className="py-2 pr-2">{row.started.toLocaleString()}</td>
                  <td className="py-2 pr-2">{row.confirmed.toLocaleString()}</td>
                  <td className="py-2 pr-2">{row.abandoned.toLocaleString()}</td>
                  <td className="py-2">{toPercent(row.started_to_confirmed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function CheckoutFunnelCard() {
  const { canAccessAdmin } = useUserRole();
  const [windowHours, setWindowHours] = useState<number>(24 * 7);
  const [scope, setScope] = useState<'SELF' | 'GLOBAL'>('SELF');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [funnel, setFunnel] = useState<MerchantCheckoutFunnelResult | null>(null);

  useEffect(() => {
    if (!canAccessAdmin && scope !== 'SELF') {
      setScope('SELF');
    }
  }, [canAccessAdmin, scope]);

  const loadFunnel = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);
      try {
        const data = await merchantCheckoutService.getCheckoutFunnel({
          windowHours,
          scope,
        });
        setFunnel(data);
        if (!data) {
          setError('Checkout funnel analytics is unavailable in local mode. Enable remote edge functions to view live metrics.');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load checkout funnel');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [scope, windowHours]
  );

  useEffect(() => {
    void loadFunnel(false);
  }, [loadFunnel]);

  const counts = funnel?.counts ?? {};
  const started = Number(counts.checkout_started ?? 0);
  const resolved = Number(counts.checkout_resolved ?? 0);
  const confirmed = Number(counts.checkout_confirmed ?? 0);
  const abandoned = Number(counts.checkout_abandoned ?? 0);

  const summaryRows = useMemo(() => {
    const rows: Array<{ label: string; value: number }> = [
      { label: 'Started', value: started },
      { label: 'Resolved', value: resolved },
      { label: 'Confirmed', value: confirmed },
      { label: 'Abandoned', value: abandoned },
    ];
    if (funnel?.totals.uniqueUsers) rows.push({ label: 'Unique users', value: funnel.totals.uniqueUsers });
    if (funnel?.totals.uniqueMerchants) rows.push({ label: 'Unique merchants', value: funnel.totals.uniqueMerchants });
    return rows;
  }, [abandoned, confirmed, funnel?.totals.uniqueMerchants, funnel?.totals.uniqueUsers, resolved, started]);

  const handleExportCsv = useCallback(() => {
    if (!funnel || !canAccessAdmin) return;
    setIsExporting(true);
    try {
      const csv = buildFunnelCsv(funnel);
      downloadCsv(
        `checkout-funnel-${funnel.scope.toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`,
        csv
      );
    } finally {
      setIsExporting(false);
    }
  }, [canAccessAdmin, funnel]);

  return (
    <section className="neu-card rounded-3xl p-4 sm:p-5 space-y-4" aria-labelledby="checkout-funnel-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="checkout-funnel-title" className="font-semibold text-base">
              Checkout Funnel
            </h2>
            <Badge variant="secondary" className="rounded-full">
              Live
            </Badge>
            <Badge variant="outline" className="rounded-full">
              {funnel?.scope ?? scope}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Completion and abandonment trends for merchant checkout.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canAccessAdmin && (
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={handleExportCsv}
              disabled={!funnel || isExporting || isLoading || isRefreshing}
              aria-label="Export checkout funnel CSV"
            >
              <Download className={cn('w-4 h-4 mr-2', isExporting && 'animate-pulse')} />
              Export CSV
            </Button>
          )}
          <Button
            variant="outline"
            size="icon"
            className="rounded-xl"
            onClick={() => void loadFunnel(true)}
            disabled={isRefreshing || isLoading}
            aria-label="Refresh checkout funnel"
          >
            <RefreshCw className={cn('w-4 h-4', (isRefreshing || isLoading) && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {canAccessAdmin && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Checkout funnel scope">
          {SCOPE_OPTIONS.map((option) => (
            <button
              key={option.scope}
              type="button"
              className={cn(
                'h-10 px-3 rounded-xl text-sm font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                scope === option.scope
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border/70 bg-muted/30 hover:bg-muted/50'
              )}
              onClick={() => setScope(option.scope)}
              aria-pressed={scope === option.scope}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2" role="group" aria-label="Checkout funnel time window">
        {WINDOW_OPTIONS.map((option) => (
          <button
            key={option.hours}
            type="button"
            className={cn(
              'h-10 px-3 rounded-xl text-sm font-medium border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
              windowHours === option.hours
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border/70 bg-muted/30 hover:bg-muted/50'
            )}
            onClick={() => setWindowHours(option.hours)}
            aria-pressed={windowHours === option.hours}
          >
            {option.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {summaryRows.map((row) => (
          <div key={row.label} className="rounded-2xl bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground mb-1">{row.label}</p>
            <p className="font-semibold text-base">{row.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <div className="rounded-xl border border-border/60 p-3 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
            <BarChart3 className="w-3.5 h-3.5" />
            Started -&gt; Resolved
          </div>
          <p className="font-semibold text-primary">{toPercent(funnel?.conversion.started_to_resolved ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-border/60 p-3 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
            <TrendingUp className="w-3.5 h-3.5" />
            Resolved -&gt; Confirmed
          </div>
          <p className="font-semibold text-primary">{toPercent(funnel?.conversion.resolved_to_confirmed ?? 0)}</p>
        </div>
        <div className="rounded-xl border border-border/60 p-3 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
            <AlertTriangle className="w-3.5 h-3.5" />
            Abandonment Rate
          </div>
          <p className="font-semibold text-destructive">{toPercent(funnel?.conversion.abandonment_rate ?? 0)}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-border/60 p-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Top abandon screens</p>
        {!funnel?.topAbandonScreens?.length ? (
          <p className="text-sm text-muted-foreground">No abandonment events in this window.</p>
        ) : (
          <div className="space-y-2">
            {funnel.topAbandonScreens.map((item) => (
              <div key={item.screen} className="flex items-center justify-between text-sm">
                <span className="font-medium">{item.screen}</span>
                <span className="text-muted-foreground">{item.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {canAccessAdmin && (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Admin breakdowns</p>
          <BreakdownTable title="By Merchant Category" rows={funnel?.breakdown.merchantCategory ?? []} />
          <BreakdownTable title="By Merchant ID" rows={funnel?.breakdown.merchantId ?? []} />
          <BreakdownTable title="By Entry Type" rows={funnel?.breakdown.entryType ?? []} />
          <BreakdownTable title="By Checkout Mode" rows={funnel?.breakdown.checkoutMode ?? []} />
          <BreakdownTable title="By Tip Timing" rows={funnel?.breakdown.tipTiming ?? []} />
        </div>
      )}
    </section>
  );
}
