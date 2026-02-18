import React, { useState, useEffect, useCallback } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Coins,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Download,
  Loader2,
  Search,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { format } from 'date-fns';
import { walletReconciliationService } from '@/services/walletReconciliation.service';
import type { ReconciliationRow, LedgerEntry } from '@/services/walletReconciliation.service';

const CURRENCIES = ['vicoin', 'icoin'];
const LEDGER_TYPES = [
  'reward', 'checkin', 'promo_view', 'tip_in', 'tip_out', 'payout',
  'convert_in', 'convert_out', 'transfer_in', 'transfer_out',
];

const WalletReconciliationPanel: React.FC = () => {
  const { isAdmin } = useUserRole();
  const [recon, setRecon] = useState<ReconciliationRow[]>([]);
  const [discrepancyCount, setDiscrepancyCount] = useState(0);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [isLoadingRecon, setIsLoadingRecon] = useState(true);
  const [isLoadingLedger, setIsLoadingLedger] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [view, setView] = useState<'reconciliation' | 'ledger'>('reconciliation');
  const [userIdFilter, setUserIdFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [currencyFilter, setCurrencyFilter] = useState<string>('all');
  const [ledgerPage, setLedgerPage] = useState(0);
  const [expandedRef, setExpandedRef] = useState<string | null>(null);
  const PAGE_SIZE = 30;

  const fetchReconciliation = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoadingRecon(true);
    try {
      const res = await walletReconciliationService.getReconciliation({
        user_id: userIdFilter.trim() || undefined,
        limit: 500,
      });
      setRecon(res.rows);
      setDiscrepancyCount(res.discrepancy_count);
    } catch (e) {
      console.error('Reconciliation fetch failed:', e);
    } finally {
      setIsLoadingRecon(false);
    }
  }, [isAdmin, userIdFilter]);

  const fetchLedgerEntries = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoadingLedger(true);
    try {
      const res = await walletReconciliationService.getLedgerEntries({
        user_id: userIdFilter.trim() || undefined,
        type: typeFilter === 'all' ? undefined : typeFilter,
        currency: currencyFilter === 'all' ? undefined : currencyFilter,
        limit: PAGE_SIZE,
        offset: ledgerPage * PAGE_SIZE,
      });
      setLedgerEntries(res.entries);
      setLedgerTotal(res.total_count);
    } catch (e) {
      console.error('Ledger fetch failed:', e);
    } finally {
      setIsLoadingLedger(false);
    }
  }, [isAdmin, userIdFilter, typeFilter, currencyFilter, ledgerPage]);

  useEffect(() => {
    if (view === 'reconciliation') {
      fetchReconciliation();
    } else {
      fetchLedgerEntries();
    }
  }, [view, fetchReconciliation, fetchLedgerEntries]);

  const handleExport = async () => {
    if (!isAdmin) return;
    setIsExporting(true);
    try {
      const res = await walletReconciliationService.getReconciliation({
        user_id: userIdFilter.trim() || undefined,
        limit: 5000,
      });
      const header = 'User ID,Username,Display Name,Currency,Ledger Sum,Profile Balance,Discrepancy,Ledger Count\n';
      const rows = res.rows.map(
        (r) =>
          `${r.user_id},${(r.username || '').replace(/,/g, ';')},${(r.display_name || '').replace(/,/g, ';')},${r.currency},${r.ledger_sum},${r.profile_balance},${r.discrepancy},${r.ledger_count}`
      ).join('\n');
      const csv = header + rows;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wallet-reconciliation-${format(new Date(), 'yyyy-MM-dd-HHmm')}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export failed:', e);
    } finally {
      setIsExporting(false);
    }
  };

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-center">Admin access required.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Coins className="w-5 h-5" />
          Wallet Reconciliation
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={view === 'reconciliation' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('reconciliation')}
          >
            Reconciliation
          </Button>
          <Button
            variant={view === 'ledger' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setView('ledger')}
          >
            Ledger Audit
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Filter by User ID"
                value={userIdFilter}
                onChange={(e) => setUserIdFilter(e.target.value)}
                className="pl-9"
              />
            </div>
            {view === 'ledger' && (
              <>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All types</SelectItem>
                    {LEDGER_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={view === 'reconciliation' ? fetchReconciliation : fetchLedgerEntries}
              disabled={view === 'reconciliation' ? isLoadingRecon : isLoadingLedger}
            >
              {(view === 'reconciliation' ? isLoadingRecon : isLoadingLedger) ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
            {view === 'reconciliation' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={isExporting}
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {view === 'reconciliation' ? (
            <>
              {discrepancyCount > 0 && (
                <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-destructive/10 text-destructive">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    {discrepancyCount} user/currency pair{discrepancyCount !== 1 ? 's' : ''} with
                    ledger vs profile mismatch
                  </span>
                </div>
              )}
              {discrepancyCount === 0 && recon.length > 0 && (
                <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-green-500/10 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>All balances reconcile</span>
                </div>
              )}
              {isLoadingRecon ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Currency</TableHead>
                        <TableHead className="text-right">Ledger Sum</TableHead>
                        <TableHead className="text-right">Profile</TableHead>
                        <TableHead className="text-right">Discrepancy</TableHead>
                        <TableHead className="text-right">Entries</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recon.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            No data
                          </TableCell>
                        </TableRow>
                      ) : (
                        recon.map((r) => (
                          <TableRow key={`${r.user_id}-${r.currency}`}>
                            <TableCell>
                              <div className="font-mono text-xs text-muted-foreground">
                                {r.user_id.slice(0, 8)}…
                              </div>
                              <div className="text-sm">{r.display_name || r.username || '—'}</div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{r.currency}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">{r.ledger_sum.toLocaleString()}</TableCell>
                            <TableCell className="text-right font-mono">{r.profile_balance.toLocaleString()}</TableCell>
                            <TableCell className="text-right">
                              {r.discrepancy !== 0 ? (
                                <Badge variant="destructive">{r.discrepancy}</Badge>
                              ) : (
                                <span className="text-muted-foreground">0</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">{r.ledger_count}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          ) : (
            <>
              {isLoadingLedger ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8" />
                        <TableHead>Time</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Currency</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Ref ID</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ledgerEntries.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            No ledger entries
                          </TableCell>
                        </TableRow>
                      ) : (
                        ledgerEntries.map((e) => {
                          const isExpanded = expandedRef === e.id;
                          return (
                            <React.Fragment key={e.id}>
                              <TableRow
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => setExpandedRef(isExpanded ? null : e.id)}
                              >
                                <TableCell>
                                  {isExpanded ? (
                                    <ChevronUp className="w-4 h-4" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4" />
                                  )}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {format(new Date(e.created_at), 'yyyy-MM-dd HH:mm')}
                                </TableCell>
                                <TableCell>
                                  <div className="text-xs font-mono text-muted-foreground">
                                    {e.user_id.slice(0, 8)}…
                                  </div>
                                  <div className="text-sm">{e.display_name || e.username || '—'}</div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">{e.type}</Badge>
                                </TableCell>
                                <TableCell>{e.currency}</TableCell>
                                <TableCell className={`text-right font-mono ${e.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {e.amount >= 0 ? '+' : ''}{e.amount}
                                </TableCell>
                                <TableCell className="font-mono text-xs max-w-[120px] truncate" title={e.ref_id}>
                                  {e.ref_id}
                                </TableCell>
                              </TableRow>
                              {isExpanded && (
                                <TableRow>
                                  <TableCell colSpan={7} className="bg-muted/30">
                                    <div className="text-xs space-y-1 py-2">
                                      {e.metadata && Object.keys(e.metadata).length > 0 && (
                                        <div>
                                          <span className="font-medium">Metadata:</span>{' '}
                                          <code className="break-all">{JSON.stringify(e.metadata)}</code>
                                        </div>
                                      )}
                                      {e.row_hash && (
                                        <div>
                                          <span className="font-medium">Row hash:</span>{' '}
                                          <code className="break-all text-muted-foreground">{e.row_hash}</code>
                                        </div>
                                      )}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                  {ledgerTotal > PAGE_SIZE && (
                    <div className="flex items-center justify-between mt-4">
                      <span className="text-sm text-muted-foreground">
                        {ledgerPage * PAGE_SIZE + 1}–{Math.min((ledgerPage + 1) * PAGE_SIZE, ledgerTotal)} of {ledgerTotal}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={ledgerPage === 0}
                          onClick={() => setLedgerPage((p) => Math.max(0, p - 1))}
                        >
                          Previous
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={(ledgerPage + 1) * PAGE_SIZE >= ledgerTotal}
                          onClick={() => setLedgerPage((p) => p + 1)}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WalletReconciliationPanel;
