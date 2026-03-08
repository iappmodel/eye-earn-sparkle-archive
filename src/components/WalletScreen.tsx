import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  X,
  ArrowUpRight,
  ArrowDownLeft,
  CreditCard,
  Building2,
  TrendingUp,
  RefreshCw,
  Wallet,
  Crown,
  Zap,
  MapPin,
  Coins,
  Eye,
  EyeOff,
  Download,
  Share2,
  ChevronDown,
  Check,
  AlertCircle,
  Search,
  Loader2,
  Bitcoin,
  ArrowDownToLine,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  Copy,
  ArrowUpDown,
  BarChart3,
} from 'lucide-react';
import { SwipeDismissOverlay } from './SwipeDismissOverlay';
import { CoinDisplay } from './CoinDisplay';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useLocalization } from '@/contexts/LocalizationContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useWallet } from '@/hooks/useWallet';
import { useReferral } from '@/hooks/useReferral';
import { usePayout } from '@/hooks/usePayout';
import {
  MIN_PAYOUT_VICOIN,
  MAX_PAYOUT_VICOIN,
  MIN_PAYOUT_ICOIN,
  MAX_PAYOUT_ICOIN,
  type PayoutMethod,
  type CoinType,
} from '@/services/payout.service';
import { useTransactions } from '@/hooks/useTransactions';
import {
  rewardsService,
  WalletTransaction,
  type TransactionSortField,
  type TransactionSortOrder,
  type TransferCoinsDirection,
} from '@/services/rewards.service';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { subscriptionService, SUBSCRIPTION_TIERS } from '@/services/subscription.service';
import { Progress } from './ui/progress';
import { toast } from 'sonner';
import { PromoEarningsSection } from './PromoEarningsSection';
import { PaymentMethodManager } from './PaymentMethodManager';
import { WalletReadyToPayCard } from '@/features/merchantCheckout/WalletReadyToPayCard';
import { CheckoutFunnelCard } from '@/features/merchantCheckout/CheckoutFunnelCard';
import { MerchantCheckoutSheet } from '@/features/merchantCheckout/MerchantCheckoutSheet';
import { DemoModeBadge } from '@/components/demo/DemoModeBadge';
import { isDemoMode } from '@/lib/appMode';

interface DailyLimits {
  icoin_earned: number;
  vicoin_earned: number;
  promo_views: number;
  icoin_limit: number;
  vicoin_limit: number;
  promo_limit: number;
}

interface WalletScreenProps {
  isOpen: boolean;
  onClose: () => void;
  /** Optional: allow parent to pass balance (e.g. for SSR). If not passed, useWallet() is used. */
  vicoins?: number;
  icoins?: number;
  /** Optional: callback when user taps "Earn more" in Promo Earnings – e.g. open discovery map */
  onDiscover?: () => void;
  /** Optional: tab to select when wallet opens (e.g. 'subscription' when returning from Stripe). */
  initialTab?: WalletTab;
  /** Demo controls: settlement outcome to show in checkout receipt timeline. */
  demoCheckoutOutcome?: 'completed' | 'pending' | 'reversed';
  /** Optional guided-tour command from parent scenario walkthrough. */
  tourCommand?: WalletTourCommand | null;
  onTourCommandHandled?: (id: string) => void;
}

export interface WalletTourCommand {
  id: string;
  action: 'open_overview' | 'open_payout' | 'open_checkout';
  scenarioId?: string;
}

type WalletTab = 'overview' | 'transactions' | 'subscription' | 'payout' | 'checkout';

const TX_TYPE_OPTIONS: { value: WalletTransaction['type'] | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'earned', label: 'Earned' },
  { value: 'received', label: 'Received' },
  { value: 'spent', label: 'Spent' },
  { value: 'sent', label: 'Sent' },
  { value: 'withdrawn', label: 'Withdrawn' },
];

const EXCHANGE_RATE = 10;
const ICOIN_MIN = 100;
const ICOIN_MAX = 100000;
const VICOIN_MIN = 1;
const VICOIN_MAX = 10000;
const CONVERT_PRESETS_ICOIN = [100, 500, 1000, 5000] as const;
const CONVERT_PRESETS_VICOIN = [1, 5, 10, 50, 100] as const;
const TX_PAGE_SIZE = 20;
const MIN_WITHDRAW_VICOIN = 500;
const MIN_WITHDRAW_ICOIN = 1000;

type DateRangeKey = 'all' | 'today' | 'week' | 'month';
const DATE_RANGE_OPTIONS: { value: DateRangeKey; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
];

const TX_SORT_OPTIONS: { sortBy: TransactionSortField; sortOrder: TransactionSortOrder; label: string }[] = [
  { sortBy: 'created_at', sortOrder: 'desc', label: 'Newest first' },
  { sortBy: 'created_at', sortOrder: 'asc', label: 'Oldest first' },
  { sortBy: 'amount', sortOrder: 'desc', label: 'Amount (high → low)' },
  { sortBy: 'amount', sortOrder: 'asc', label: 'Amount (low → high)' },
];

type DateGroupKey = 'today' | 'yesterday' | 'thisWeek' | 'older';
function getDateGroup(timestamp: Date): DateGroupKey {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 6);
  const t = timestamp instanceof Date ? timestamp : new Date(timestamp);
  if (t >= todayStart) return 'today';
  if (t >= yesterdayStart) return 'yesterday';
  if (t >= weekStart) return 'thisWeek';
  return 'older';
}

const DATE_GROUP_LABELS: Record<DateGroupKey, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  thisWeek: 'This week',
  older: 'Older',
};

function groupTransactionsByDate(transactions: WalletTransaction[]): { group: DateGroupKey; label: string; items: WalletTransaction[] }[] {
  const map = new Map<DateGroupKey, WalletTransaction[]>();
  for (const tx of transactions) {
    const group = getDateGroup(tx.timestamp);
    if (!map.has(group)) map.set(group, []);
    map.get(group)!.push(tx);
  }
  const order: DateGroupKey[] = ['today', 'yesterday', 'thisWeek', 'older'];
  return order.filter((k) => map.has(k)).map((group) => ({ group, label: DATE_GROUP_LABELS[group], items: map.get(group)! }));
}

function getDateRangeBounds(key: DateRangeKey): { dateFrom?: Date; dateTo?: Date } {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (key === 'all') return {};
  if (key === 'today') return { dateFrom: todayStart, dateTo: now };
  if (key === 'week') {
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 6);
    return { dateFrom: weekStart, dateTo: now };
  }
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  return { dateFrom: monthStart, dateTo: now };
}

// ---------------------------------------------------------------------------
// Export transactions as CSV
// ---------------------------------------------------------------------------
function exportTransactionsToCsv(transactions: WalletTransaction[]) {
  const headers = ['Date', 'Type', 'Coin', 'Amount', 'Description'];
  const rows = transactions.map((tx) => [
    new Date(tx.timestamp).toISOString(),
    tx.type,
    tx.coinType,
    tx.amount,
    `"${(tx.description || '').replace(/"/g, '""')}"`,
  ]);
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wallet-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export const WalletScreen: React.FC<WalletScreenProps> = ({
  isOpen,
  onClose,
  vicoins: vicoinsProp,
  icoins: icoinsProp,
  onDiscover,
  initialTab,
  demoCheckoutOutcome = 'completed',
  tourCommand = null,
  onTourCommandHandled,
}) => {
  const { user, profile } = useAuth();
  const { locale } = useLocalization();
  const { canAccessAdmin } = useUserRole();
  const {
    vicoins: vicoinsFromHook,
    icoins: icoinsFromHook,
    summary,
    summaryLoading,
    refresh: refreshWallet,
    isReady,
  } = useWallet();
  const { copyReferralLink, referralCode } = useReferral();

  const vicoins = vicoinsProp ?? vicoinsFromHook;
  const icoins = icoinsProp ?? icoinsFromHook;

  const { subscription, refreshSubscription } = useAuth();
  const [dailyLimits, setDailyLimits] = useState<DailyLimits | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<WalletTab>('overview');
  const [transferDirection, setTransferDirection] = useState<TransferCoinsDirection>('icoin_to_vicoin');
  const [transferAmount, setTransferAmount] = useState<string>('');
  const [isTransferring, setIsTransferring] = useState(false);
  const [balanceMasked, setBalanceMasked] = useState(false);
  const [txTypeFilter, setTxTypeFilter] = useState<WalletTransaction['type'] | 'all'>('all');
  const [txCoinFilter, setTxCoinFilter] = useState<'vicoin' | 'icoin' | 'all'>('all');
  const [txDateRange, setTxDateRange] = useState<DateRangeKey>('all');
  const [txAmountMin, setTxAmountMin] = useState('');
  const [txAmountMax, setTxAmountMax] = useState('');
  const [txSearch, setTxSearch] = useState('');
  const [txSearchDebounced, setTxSearchDebounced] = useState('');
  const [showConvertConfirm, setShowConvertConfirm] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [merchantCheckoutOpen, setMerchantCheckoutOpen] = useState(false);
  const [merchantCheckoutLaunchMode, setMerchantCheckoutLaunchMode] = useState<'scan' | 'link' | null>(null);
  const [merchantCheckoutAutoScenarioId, setMerchantCheckoutAutoScenarioId] = useState<string | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setTxSearchDebounced(txSearch), 400);
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [txSearch]);

  useEffect(() => {
    if (!isOpen || !initialTab) return;
    if (initialTab === 'checkout' && !canAccessAdmin) {
      setActiveTab('overview');
      return;
    }
    setActiveTab(initialTab);
  }, [canAccessAdmin, isOpen, initialTab]);

  useEffect(() => {
    if (!canAccessAdmin && activeTab === 'checkout') {
      setActiveTab('overview');
    }
  }, [canAccessAdmin, activeTab]);

  useEffect(() => {
    if (!isOpen || !tourCommand) return;
    if (tourCommand.action === 'open_overview') {
      setActiveTab('overview');
    } else if (tourCommand.action === 'open_payout') {
      setActiveTab('payout');
    } else if (tourCommand.action === 'open_checkout') {
      setActiveTab('overview');
      setMerchantCheckoutAutoScenarioId(tourCommand.scenarioId ?? null);
      setMerchantCheckoutLaunchMode('link');
      setMerchantCheckoutOpen(true);
    }
    onTourCommandHandled?.(tourCommand.id);
  }, [isOpen, onTourCommandHandled, tourCommand]);

  const txFilters = useMemo(() => {
    const f: {
      type?: WalletTransaction['type'];
      coinType?: 'vicoin' | 'icoin';
      dateFrom?: Date;
      dateTo?: Date;
      search?: string;
      amountMin?: number;
      amountMax?: number;
    } = {};
    if (txTypeFilter !== 'all') f.type = txTypeFilter;
    if (txCoinFilter !== 'all') f.coinType = txCoinFilter;
    const range = getDateRangeBounds(txDateRange);
    if (range.dateFrom) f.dateFrom = range.dateFrom;
    if (range.dateTo) f.dateTo = range.dateTo;
    if (txSearchDebounced.trim()) f.search = txSearchDebounced.trim();
    const minNum = parseInt(txAmountMin, 10);
    const maxNum = parseInt(txAmountMax, 10);
    if (!Number.isNaN(minNum) && minNum >= 0) f.amountMin = minNum;
    if (!Number.isNaN(maxNum) && maxNum >= 0) f.amountMax = maxNum;
    return f;
  }, [txTypeFilter, txCoinFilter, txDateRange, txSearchDebounced, txAmountMin, txAmountMax]);

  const {
    transactions,
    totalCount: txTotalCount,
    hasMore: hasMoreTx,
    isLoading: txLoading,
    isLoadingMore: txLoadingMore,
    error: txError,
    refresh: refreshTransactions,
    loadMore: loadMoreTransactions,
    setSort,
    sortBy: txSortBy,
    sortOrder: txSortOrder,
    periodSummary: txPeriodSummary,
  } = useTransactions({
    userId: user?.id,
    filters: txFilters,
    pageSize: TX_PAGE_SIZE,
    enabled: isOpen && !!user?.id,
    subscribeRealtime: true,
  });

  const [selectedTransaction, setSelectedTransaction] = useState<WalletTransaction | null>(null);
  const [copiedField, setCopiedField] = useState<'id' | 'reference' | null>(null);
  const [balanceSegment, setBalanceSegment] = useState<'available' | 'pending'>('available');
  const convertSectionRef = useRef<HTMLDivElement | null>(null);

  const kycStatus = profile?.kyc_status ?? null;
  const kycVerified = kycStatus === 'verified' || kycStatus === 'approved';
  const canWithdraw = kycVerified;

  const {
    paymentMethods,
    payoutHistory,
    loadPaymentMethods,
    loadPayoutHistory,
    requestPayout,
    getPayoutFee,
    loadingMethods,
    loadingHistory,
    requesting,
    error: payoutError,
    clearError: clearPayoutError,
  } = usePayout();

  const [payoutCoinType, setPayoutCoinType] = useState<CoinType>('vicoin');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutMethod, setPayoutMethod] = useState<PayoutMethod>('paypal');
  const [payoutPaymentMethodId, setPayoutPaymentMethodId] = useState<string | null>(null);
  const [showPaymentMethodSheet, setShowPaymentMethodSheet] = useState(false);

  useEffect(() => {
    if (isOpen && activeTab === 'payout') {
      loadPaymentMethods();
      loadPayoutHistory();
    }
  }, [isOpen, activeTab, loadPaymentMethods, loadPayoutHistory]);

  useEffect(() => {
    if (paymentMethods.length > 0) {
      const firstId = paymentMethods[0].id;
      const inList = payoutPaymentMethodId && paymentMethods.some((pm) => pm.id === payoutPaymentMethodId);
      if (!inList) setPayoutPaymentMethodId(firstId);
    }
  }, [paymentMethods, payoutPaymentMethodId]);

  const payoutMin = payoutCoinType === 'vicoin' ? MIN_PAYOUT_VICOIN : MIN_PAYOUT_ICOIN;
  const payoutMax = payoutCoinType === 'vicoin' ? MAX_PAYOUT_VICOIN : MAX_PAYOUT_ICOIN;
  const availableBalance = payoutCoinType === 'vicoin' ? vicoins : icoins;
  const payoutAmountNum = Math.floor(Number(payoutAmount)) || 0;
  const payoutFeeResult = payoutAmountNum >= payoutMin ? getPayoutFee(payoutAmountNum) : { fee: 0, netAmount: 0 };
  const canSubmitPayout =
    canWithdraw &&
    payoutAmountNum >= payoutMin &&
    payoutAmountNum <= payoutMax &&
    payoutAmountNum <= availableBalance &&
    (paymentMethods.length > 0 ? !!payoutPaymentMethodId : true) &&
    !requesting;

  const handleRequestPayout = async () => {
    if (!canSubmitPayout) return;
    clearPayoutError();
    const result = await requestPayout({
      amount: payoutAmountNum,
      coinType: payoutCoinType,
      method: payoutMethod,
      paymentMethodId: payoutPaymentMethodId || (paymentMethods[0]?.id ?? null),
    });
    if (result.success) {
      toast.success(
        `Payout requested: ${result.net_amount ?? payoutAmountNum} ${payoutCoinType === 'vicoin' ? 'V' : 'I'} (est. ${result.estimated_arrival ?? '3–5 days'})`
      );
      setPayoutAmount('');
      refreshWallet();
      loadPayoutHistory();
    } else if (result.error) {
      toast.error(result.error);
    }
  };

  const loadWalletData = useCallback(async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const [limits] = await Promise.all([
        rewardsService.getDailyLimits(user.id),
        refreshSubscription(),
      ]);
      if (limits) setDailyLimits(limits);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('[Wallet] Load error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, refreshSubscription]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await Promise.all([refreshWallet({ includeSummary: true }), loadWalletData(), refreshTransactions()]);
    setIsRefreshing(false);
    toast.success('Wallet updated');
  }, [refreshWallet, loadWalletData, refreshTransactions]);

  useEffect(() => {
    if (isOpen && user?.id) {
      loadWalletData();
    }
  }, [isOpen, user?.id, loadWalletData]);

  useEffect(() => {
    const handler = () => {
      if (user?.id) {
        refreshWallet();
        loadWalletData();
        refreshTransactions();
      }
    };
    window.addEventListener('walletBalanceChanged', handler);
    return () => window.removeEventListener('walletBalanceChanged', handler);
  }, [user?.id, refreshWallet, loadWalletData, refreshTransactions]);

  const handleSubscribe = async (tier: 'pro' | 'creator') => {
    const result = await subscriptionService.createCheckout(tier);
    if (result.url) window.open(result.url, '_blank');
    else if (result.error) toast.error(result.error);
  };

  const handleManageSubscription = async () => {
    const result = await subscriptionService.openCustomerPortal();
    if (result.url) window.open(result.url, '_blank');
    else if (result.error) toast.error(result.error);
  };

  const getTransferLimits = useCallback(
    (dir: TransferCoinsDirection) =>
      dir === 'icoin_to_vicoin'
        ? { min: ICOIN_MIN, max: Math.min(ICOIN_MAX, icoins), step: 10, sourceBalance: icoins }
        : { min: VICOIN_MIN, max: Math.min(VICOIN_MAX, vicoins), step: 1, sourceBalance: vicoins },
    [icoins, vicoins]
  );

  const getPreviewReceived = useCallback(
    (dir: TransferCoinsDirection, amount: number) =>
      dir === 'icoin_to_vicoin' ? Math.floor(amount / EXCHANGE_RATE) : amount * EXCHANGE_RATE,
    []
  );

  const validateTransferAmount = useCallback(
    (dir: TransferCoinsDirection, value: number): string | null => {
      const limits = getTransferLimits(dir);
      if (!value || value < limits.min) {
        return dir === 'icoin_to_vicoin'
          ? `Minimum is ${ICOIN_MIN} Icoins`
          : `Minimum is ${VICOIN_MIN} Vicoin`;
      }
      if (value > limits.max) {
        return dir === 'icoin_to_vicoin'
          ? `Maximum is ${limits.max} Icoins (your balance)`
          : `Maximum is ${limits.max} Vicoins (your balance)`;
      }
      if (dir === 'icoin_to_vicoin' && value % EXCHANGE_RATE !== 0) {
        return `Amount must be divisible by ${EXCHANGE_RATE}`;
      }
      return null;
    },
    [getTransferLimits]
  );

  const handleTransfer = async () => {
    const amount = parseInt(transferAmount, 10);
    if (!Number.isInteger(amount) || amount <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    const err = validateTransferAmount(transferDirection, amount);
    if (err) {
      toast.error(err);
      return;
    }

    setIsTransferring(true);
    try {
      const result = await rewardsService.transferCoins(transferDirection, amount);

      if (result.success) {
        const r = result as TransferCoinsResponse;
        const sourceName = transferDirection === 'icoin_to_vicoin' ? 'Icoins' : 'Vicoins';
        const targetName = transferDirection === 'icoin_to_vicoin' ? 'Vicoins' : 'Icoins';
        toast.success(
          `Converted ${r.source_spent} ${sourceName} → ${r.target_received} ${targetName}!`
        );
        setTransferAmount('');
        setShowConvertConfirm(false);
        await refreshWallet();
        await loadWalletData();
      } else {
        toast.error(result.error || 'Transfer failed');
      }
    } catch (error) {
      console.error('[Wallet] Transfer error:', error);
      toast.error('Transfer failed');
    } finally {
      setIsTransferring(false);
    }
  };

  const openConvertConfirm = () => {
    const amount = parseInt(transferAmount, 10);
    const err = validateTransferAmount(transferDirection, amount);
    if (err) {
      toast.error(err);
      return;
    }
    setShowConvertConfirm(true);
  };

  const getTransactionIcon = (type: WalletTransaction['type']) => {
    switch (type) {
      case 'earned':
      case 'received':
        return <ArrowDownLeft className="w-4 h-4 text-primary" />;
      case 'spent':
      case 'sent':
      case 'withdrawn':
        return <ArrowUpRight className="w-4 h-4 text-destructive" />;
    }
  };


  const handleExportCsv = () => {
    if (transactions.length === 0) {
      toast.info('No transactions to export');
      return;
    }
    setIsExporting(true);
    try {
      exportTransactionsToCsv(transactions);
      toast.success('Export downloaded');
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyTxField = useCallback(async (value: string, field: 'id' | 'reference') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  }, []);

  const groupedTransactions = useMemo(
    () => groupTransactionsByDate(transactions),
    [transactions]
  );

  const pendingIcoin = useMemo(() => {
    if (summary?.pending_icoin != null) return summary.pending_icoin;
    return transactions
      .filter((tx) => (tx.status === 'pending' || tx.status === 'verification_required') && tx.coinType === 'icoin')
      .filter((tx) => tx.type === 'earned' || tx.type === 'received')
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [summary?.pending_icoin, transactions]);

  const pendingVicoin = useMemo(() => {
    if (summary?.pending_vicoin != null) return summary.pending_vicoin;
    return transactions
      .filter((tx) => (tx.status === 'pending' || tx.status === 'verification_required') && tx.coinType === 'vicoin')
      .filter((tx) => tx.type === 'earned' || tx.type === 'received')
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [summary?.pending_vicoin, transactions]);

  const pendingValue = pendingIcoin + pendingVicoin / EXCHANGE_RATE;
  const availableValue = icoins + vicoins / EXCHANGE_RATE;
  const totalWalletValue = availableValue + pendingValue;
  const recentActivity = useMemo(() => transactions.slice(0, 4), [transactions]);

  const getTransactionStatusChip = useCallback((tx: WalletTransaction) => {
    const status = tx.status ?? 'completed';
    if (status === 'verification_required') {
      return {
        icon: <Clock className="w-3.5 h-3.5" />,
        className: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
        label: 'Verification Required',
      };
    }
    if (status === 'pending') {
      return {
        icon: <Clock className="w-3.5 h-3.5" />,
        className: 'border-sky-500/40 bg-sky-500/10 text-sky-200',
        label: 'Pending',
      };
    }
    if (status === 'reversed' || status === 'failed') {
      return {
        icon: <XCircle className="w-3.5 h-3.5" />,
        className: 'border-red-500/40 bg-red-500/10 text-red-300',
        label: 'Reversed',
      };
    }
    return {
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
      className: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
      label: 'Completed',
    };
  }, []);

  const handleCopyReferral = () => {
    if (!referralCode) {
      toast.info('Referral link is loading…');
      return;
    }
    copyReferralLink();
  };

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: Wallet },
    { id: 'transactions' as const, label: 'History', icon: RefreshCw },
    { id: 'subscription' as const, label: 'Plans', icon: Crown },
    { id: 'payout' as const, label: 'Payout', icon: CreditCard },
    ...(canAccessAdmin
      ? [
          { id: 'checkout' as const, label: 'Checkout', icon: BarChart3 },
        ]
      : []),
  ];

  return (
    <SwipeDismissOverlay isOpen={isOpen} onClose={onClose}>
      <div
        className="max-w-md mx-auto min-h-full flex flex-col p-4 sm:p-6 overflow-y-auto"
        style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold">Wallet</h1>
            {isDemoMode && <DemoModeBadge />}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setBalanceMasked((m) => !m)}
              className="h-10 w-10 rounded-xl"
              title={balanceMasked ? 'Show balance' : 'Hide balance'}
              aria-label={balanceMasked ? 'Show balance' : 'Hide balance'}
            >
              {balanceMasked ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-10 w-10 rounded-xl disabled:opacity-50"
              title="Refresh"
              aria-label="Refresh wallet"
            >
              <RefreshCw className={cn('w-5 h-5', isRefreshing && 'animate-spin')} />
            </Button>
            <Button type="button" variant="outline" size="icon" onClick={onClose} className="h-10 w-10 rounded-xl">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
        {lastUpdated && (
          <p className="text-xs text-muted-foreground mb-2">
            Updated {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <Button
              type="button"
              variant={activeTab === tab.id ? 'default' : 'outline'}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'h-auto whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-all',
                activeTab === tab.id ? 'bg-primary text-primary-foreground' : ''
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </Button>
          ))}
        </div>

        {isLoading && !transactions.length ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Total Balance</p>
                    {isDemoMode && <DemoModeBadge className="text-[9px] px-2 py-0.5 min-h-[20px]" />}
                  </div>
                  <p className="mt-2 text-3xl font-display font-bold text-slate-100">
                    {balanceMasked ? '••••' : totalWalletValue.toFixed(2)}
                  </p>
                  <div className="mt-4 inline-flex rounded-xl border border-white/10 bg-slate-900/70 p-1">
                    <button
                      type="button"
                      onClick={() => setBalanceSegment('available')}
                      className={cn(
                        'min-h-[44px] px-3 rounded-lg text-xs font-medium transition-colors',
                        balanceSegment === 'available'
                          ? 'bg-slate-100 text-slate-900'
                          : 'text-slate-300 hover:bg-white/5'
                      )}
                    >
                      Available {balanceMasked ? '••' : availableValue.toFixed(2)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setBalanceSegment('pending')}
                      className={cn(
                        'min-h-[44px] px-3 rounded-lg text-xs font-medium transition-colors',
                        balanceSegment === 'pending'
                          ? 'bg-amber-300 text-slate-900'
                          : 'text-slate-300 hover:bg-white/5'
                      )}
                    >
                      Pending {balanceMasked ? '••' : pendingValue.toFixed(2)}
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-300">Icoins</span>
                        <span className="text-lg font-semibold text-slate-100">{balanceMasked ? '•••' : icoins.toFixed(2)}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">Spendable balance</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-300">Vicoins</span>
                        <span className="text-lg font-semibold text-slate-100">{balanceMasked ? '•••' : vicoins.toFixed(2)}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">Platform rewards and boosts</p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <Button
                      type="button"
                      onClick={() => setActiveTab('payout')}
                      className="min-h-[52px] rounded-xl bg-slate-100 text-slate-900 hover:bg-white font-semibold"
                    >
                      Withdraw
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setActiveTab('overview');
                        window.setTimeout(() => {
                          convertSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 30);
                      }}
                      className="min-h-[52px] rounded-xl border-white/20 bg-slate-900/60 text-slate-100 hover:bg-slate-800/80 font-semibold"
                    >
                      Convert
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setMerchantCheckoutLaunchMode('link');
                        setMerchantCheckoutAutoScenarioId(locale === 'pt' ? 'qr-dynamic-cafe' : 'online-retail-link');
                        setMerchantCheckoutOpen(true);
                      }}
                      className="min-h-[52px] rounded-xl border-white/20 bg-slate-900/60 text-slate-100 hover:bg-slate-800/80 font-semibold"
                    >
                      Pay
                    </Button>
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/60 p-3 text-xs text-slate-300 space-y-1">
                    <p className="font-medium text-slate-100">Limits & Fees</p>
                    <p>Withdraw min {locale === 'pt' ? 'R$ 10,00' : '$10.00'} · Instant fee 1.5% (demo)</p>
                    <p>{locale === 'pt' ? 'Pix: instant (limites podem aplicar)' : 'ACH: 1-3 business days · Instant transfer available'}</p>
                  </div>
                </section>

                <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-100">Recent Activity</h3>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setActiveTab('transactions')}
                      className="h-8 px-2 text-xs text-slate-300 hover:text-white"
                    >
                      See all
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {recentActivity.map((tx) => {
                      const statusChip = getTransactionStatusChip(tx);
                      return (
                        <Button
                          type="button"
                          key={tx.id}
                          variant="outline"
                          onClick={() => setSelectedTransaction(tx)}
                          className="w-full h-auto min-h-[44px] rounded-2xl border-white/10 bg-slate-900/70 px-3 py-3 justify-between"
                        >
                          <div className="text-left">
                            <p className="text-sm font-medium text-slate-100">{tx.description}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {typeof tx.timestamp === 'object' && 'toLocaleTimeString' in tx.timestamp
                                ? tx.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={cn(
                              'text-sm font-semibold',
                              tx.type === 'earned' || tx.type === 'received' ? 'text-emerald-300' : 'text-slate-100'
                            )}>
                              {tx.type === 'earned' || tx.type === 'received' ? '+' : '-'}
                              {tx.amount.toFixed(2)}
                            </p>
                            <span className={cn(
                              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] mt-1',
                              statusChip.className
                            )}>
                              {statusChip.icon}
                              {statusChip.label}
                            </span>
                          </div>
                        </Button>
                      );
                    })}
                  </div>
                </section>

                {/* Balance hero – optional mask */}
                <div className="grid grid-cols-2 gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setBalanceMasked((m) => !m)}
                    className="h-auto w-full justify-start rounded-3xl p-5 text-left"
                  >
                    <CoinDisplay
                      type="vicoin"
                      amount={balanceMasked ? 0 : vicoins}
                      size="lg"
                    />
                    {balanceMasked && (
                      <p className="text-xs text-muted-foreground mt-1">Tap to reveal</p>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setBalanceMasked((m) => !m)}
                    className="h-auto w-full justify-start rounded-3xl p-5 text-left"
                  >
                    <CoinDisplay
                      type="icoin"
                      amount={balanceMasked ? 0 : icoins}
                      size="lg"
                    />
                    {balanceMasked && (
                      <p className="text-xs text-muted-foreground mt-1">Tap to reveal</p>
                    )}
                  </Button>
                </div>

                <WalletReadyToPayCard
                  icoins={icoins}
                  vicoins={vicoins}
                  onScanToPay={() => {
                    setMerchantCheckoutLaunchMode('scan');
                    setMerchantCheckoutOpen(true);
                  }}
                  onPasteCheckoutLink={() => {
                    setMerchantCheckoutLaunchMode('link');
                    setMerchantCheckoutOpen(true);
                  }}
                />

                {/* Lifetime stats from summary */}
                {summary && !summaryLoading && (summary.total_earned > 0 || summary.total_withdrawn > 0) && (
                  <div className="neu-inset rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">All-time</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Total earned</p>
                        <p className="font-display font-semibold text-primary">
                          {summary.total_earned.toLocaleString()} coins
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total withdrawn</p>
                        <p className="font-display font-semibold">
                          {summary.total_withdrawn.toLocaleString()} coins
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Current Plan Badge */}
                {subscription && (
                  <div
                    className={cn(
                      'neu-card rounded-2xl p-4 border-2',
                      subscription.tier === 'creator' && 'border-icoin',
                      subscription.tier === 'pro' && 'border-primary',
                      subscription.tier === 'free' && 'border-muted'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'w-10 h-10 rounded-full flex items-center justify-center',
                            subscription.tier === 'creator' && 'bg-icoin/20',
                            subscription.tier === 'pro' && 'bg-primary/20',
                            subscription.tier === 'free' && 'bg-muted'
                          )}
                        >
                          <Crown
                            className={cn(
                              'w-5 h-5',
                              subscription.tier === 'creator' && 'text-icoin',
                              subscription.tier === 'pro' && 'text-primary',
                              subscription.tier === 'free' && 'text-muted-foreground'
                            )}
                          />
                        </div>
                        <div>
                          <p className="font-semibold">{subscription.tier_name} Plan</p>
                          <p className="text-xs text-muted-foreground">
                            {subscription.reward_multiplier}x reward multiplier
                          </p>
                          {subscription.trial_end && (
                            <p className="text-xs text-primary mt-0.5">
                              Trial ends {new Date(subscription.trial_end).toLocaleDateString(undefined, { dateStyle: 'short' })}
                            </p>
                          )}
                          {subscription.subscription_end && !subscription.trial_end && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Next billing {new Date(subscription.subscription_end).toLocaleDateString(undefined, { dateStyle: 'short' })}
                            </p>
                          )}
                          {subscription.cancel_at_period_end && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Won&apos;t renew</p>
                          )}
                        </div>
                      </div>
                      {subscription.subscribed && (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={handleManageSubscription}
                          className="h-auto p-0 text-sm text-primary underline"
                        >
                          Manage
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Daily Progress */}
                {dailyLimits && (
                  <div className="neu-inset rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">Daily Progress</span>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>Icoins</span>
                          <span>
                            {dailyLimits.icoin_earned}/{dailyLimits.icoin_limit}
                          </span>
                        </div>
                        <Progress
                          value={(dailyLimits.icoin_earned / dailyLimits.icoin_limit) * 100}
                          className="h-2"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>Vicoins</span>
                          <span>
                            {dailyLimits.vicoin_earned}/{dailyLimits.vicoin_limit}
                          </span>
                        </div>
                        <Progress
                          value={(dailyLimits.vicoin_earned / dailyLimits.vicoin_limit) * 100}
                          className="h-2"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <PromoEarningsSection onDiscover={onDiscover} />

                {/* Transfer Vicoin ↔ Icoin — bidirectional with presets and preview */}
                <div ref={convertSectionRef} className="neu-card rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <RefreshCw className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">Transfer Vicoin ↔ Icoin</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Rate: 10 Icoins = 1 Vicoin (both directions)
                  </p>

                  {/* Direction tabs */}
                  <div className="flex rounded-xl overflow-hidden neu-inset p-0.5 mb-3">
                    <Button
                      type="button"
                      variant={transferDirection === 'icoin_to_vicoin' ? 'default' : 'ghost'}
                      onClick={() => {
                        setTransferDirection('icoin_to_vicoin');
                        setTransferAmount('');
                        setShowConvertConfirm(false);
                      }}
                      className={cn(
                        'h-auto flex-1 rounded-lg py-2 text-sm font-medium transition-colors',
                        transferDirection === 'icoin_to_vicoin'
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted/50'
                      )}
                    >
                      I → V
                    </Button>
                    <Button
                      type="button"
                      variant={transferDirection === 'vicoin_to_icoin' ? 'default' : 'ghost'}
                      onClick={() => {
                        setTransferDirection('vicoin_to_icoin');
                        setTransferAmount('');
                        setShowConvertConfirm(false);
                      }}
                      className={cn(
                        'h-auto flex-1 rounded-lg py-2 text-sm font-medium transition-colors',
                        transferDirection === 'vicoin_to_icoin'
                          ? 'bg-primary text-primary-foreground'
                          : 'text-muted-foreground hover:bg-muted/50'
                      )}
                    >
                      V → I
                    </Button>
                  </div>

                  {/* Balances */}
                  <div className="flex justify-between text-xs text-muted-foreground mb-2">
                    <span>
                      Icoins: {balanceMasked ? '•••' : icoins.toLocaleString()}
                    </span>
                    <span>
                      Vicoins: {balanceMasked ? '•••' : vicoins.toLocaleString()}
                    </span>
                  </div>

                  {/* Quick amounts */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {(transferDirection === 'icoin_to_vicoin'
                      ? CONVERT_PRESETS_ICOIN
                      : CONVERT_PRESETS_VICOIN
                    ).map((preset) => (
                      <Button
                        key={preset}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setTransferAmount(String(preset))}
                        className={cn(
                          'h-auto rounded-xl px-3 py-1.5 text-sm font-medium',
                          transferAmount === String(preset) && 'ring-2 ring-primary'
                        )}
                      >
                        {preset}
                      </Button>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setTransferAmount(
                          String(
                            transferDirection === 'icoin_to_vicoin'
                              ? Math.min(icoins, ICOIN_MAX)
                              : Math.min(vicoins, VICOIN_MAX)
                          )
                        )
                      }
                      className="h-auto rounded-xl px-3 py-1.5 text-sm font-medium"
                    >
                      Max
                    </Button>
                  </div>

                  <div className="flex gap-2 flex-wrap items-center">
                    <Input
                      type="number"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                      placeholder={
                        transferDirection === 'icoin_to_vicoin'
                          ? 'Enter Icoins (min 100, step 10)'
                          : 'Enter Vicoins (min 1)'
                      }
                      className="min-w-[120px] flex-1 bg-transparent text-sm"
                      min={transferDirection === 'icoin_to_vicoin' ? ICOIN_MIN : VICOIN_MIN}
                      step={transferDirection === 'icoin_to_vicoin' ? 10 : 1}
                    />
                    {!showConvertConfirm ? (
                      <Button
                        type="button"
                        onClick={openConvertConfirm}
                        disabled={
                          isTransferring ||
                          !transferAmount ||
                          !!validateTransferAmount(
                            transferDirection,
                            parseInt(transferAmount, 10)
                          )
                        }
                        className="h-auto rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                      >
                        Convert
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowConvertConfirm(false)}
                          className="h-auto rounded-xl px-3 py-2 text-sm"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          onClick={handleTransfer}
                          disabled={isTransferring}
                          className="h-auto rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                        >
                          {isTransferring ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Check className="w-4 h-4" />
                          )}
                          Confirm
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Live preview */}
                  {transferAmount && parseInt(transferAmount, 10) > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      You&apos;ll receive{' '}
                      <span className="font-semibold text-foreground">
                        {getPreviewReceived(
                          transferDirection,
                          parseInt(transferAmount, 10) || 0
                        ).toLocaleString()}{' '}
                        {transferDirection === 'icoin_to_vicoin' ? 'Vicoins' : 'Icoins'}
                      </span>
                    </p>
                  )}
                </div>

                {/* Quick actions */}
                <div className="neu-card rounded-2xl p-4">
                  <span className="text-sm font-medium block mb-3">Quick actions</span>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCopyReferral}
                      disabled={!referralCode}
                      className="h-auto rounded-xl px-4 py-2 text-sm disabled:opacity-50"
                    >
                      <Share2 className="w-4 h-4" />
                      {referralCode ? 'Share referral' : 'Loading…'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Checkout Analytics Tab (admin/moderator only) */}
            {activeTab === 'checkout' && canAccessAdmin && (
              <div className="space-y-4">
                <div className="neu-inset rounded-2xl p-4">
                  <p className="text-sm font-medium">Checkout Analytics</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Monitor completion rate, abandonment, and merchant/category funnel performance.
                  </p>
                </div>
                <CheckoutFunnelCard />
              </div>
            )}

            {/* Transactions Tab */}
            {activeTab === 'transactions' && (
              <div className="flex-1 space-y-4">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    type="text"
                    value={txSearch}
                    onChange={(e) => setTxSearch(e.target.value)}
                    placeholder="Search transactions..."
                    className="w-full bg-transparent py-2.5 pl-10 pr-3 text-sm"
                  />
                </div>
                {/* Filters row */}
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={txTypeFilter} onValueChange={(value) => setTxTypeFilter(value as WalletTransaction['type'] | 'all')}>
                    <SelectTrigger className="h-10 min-w-[120px] rounded-xl bg-transparent text-sm">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      {TX_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={txCoinFilter} onValueChange={(value) => setTxCoinFilter(value as 'vicoin' | 'icoin' | 'all')}>
                    <SelectTrigger className="h-10 min-w-[120px] rounded-xl bg-transparent text-sm">
                      <SelectValue placeholder="Coin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All coins</SelectItem>
                      <SelectItem value="vicoin">Vicoin</SelectItem>
                      <SelectItem value="icoin">Icoin</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={txDateRange} onValueChange={(value) => setTxDateRange(value as DateRangeKey)}>
                    <SelectTrigger className="h-10 min-w-[130px] rounded-xl bg-transparent text-sm">
                      <SelectValue placeholder="Date range" />
                    </SelectTrigger>
                    <SelectContent>
                      {DATE_RANGE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      min={0}
                      placeholder="Min"
                      value={txAmountMin}
                      onChange={(e) => setTxAmountMin(e.target.value)}
                      className="h-10 w-16 bg-transparent px-2 py-2 text-sm"
                    />
                    <span className="text-muted-foreground text-xs">–</span>
                    <Input
                      type="number"
                      min={0}
                      placeholder="Max"
                      value={txAmountMax}
                      onChange={(e) => setTxAmountMax(e.target.value)}
                      className="h-10 w-16 bg-transparent px-2 py-2 text-sm"
                    />
                  </div>
                  <Select
                    value={`${txSortBy}-${txSortOrder}`}
                    onValueChange={(value) => {
                      const opt = TX_SORT_OPTIONS.find((o) => `${o.sortBy}-${o.sortOrder}` === value);
                      if (opt) setSort(opt.sortBy, opt.sortOrder);
                    }}
                  >
                    <SelectTrigger className="h-10 min-w-[150px] rounded-xl bg-transparent text-sm">
                      <SelectValue placeholder="Sort by" />
                    </SelectTrigger>
                    <SelectContent>
                      {TX_SORT_OPTIONS.map((opt, i) => (
                        <SelectItem key={i} value={`${opt.sortBy}-${opt.sortOrder}`}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleExportCsv}
                    disabled={isExporting || transactions.length === 0}
                    className="ml-auto h-auto rounded-xl px-3 py-2 text-sm"
                  >
                    <Download className="w-4 h-4" />
                    Export CSV
                  </Button>
                </div>
                {/* Period summary when date range is set */}
                {txPeriodSummary && txPeriodSummary.count > 0 && txDateRange !== 'all' && (
                  <div className="neu-inset rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <ArrowUpDown className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">Period summary</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {(txPeriodSummary.earnedVicoin > 0 || txPeriodSummary.earnedIcoin > 0) && (
                        <div>
                          <span className="text-muted-foreground">Earned: </span>
                          <span className="font-medium text-primary">
                            +{txPeriodSummary.earnedVicoin + txPeriodSummary.earnedIcoin} (V: {txPeriodSummary.earnedVicoin}, I: {txPeriodSummary.earnedIcoin})
                          </span>
                        </div>
                      )}
                      {(txPeriodSummary.spentVicoin > 0 || txPeriodSummary.spentIcoin > 0) && (
                        <div>
                          <span className="text-muted-foreground">Spent: </span>
                          <span className="font-medium text-destructive">
                            -{txPeriodSummary.spentVicoin + txPeriodSummary.spentIcoin}
                          </span>
                        </div>
                      )}
                      {(txPeriodSummary.receivedVicoin > 0 || txPeriodSummary.receivedIcoin > 0) && (
                        <div>
                          <span className="text-muted-foreground">Received: </span>
                          <span className="font-medium">+{txPeriodSummary.receivedVicoin + txPeriodSummary.receivedIcoin}</span>
                        </div>
                      )}
                      {(txPeriodSummary.sentVicoin > 0 || txPeriodSummary.sentIcoin > 0) && (
                        <div>
                          <span className="text-muted-foreground">Sent: </span>
                          <span className="font-medium">-{txPeriodSummary.sentVicoin + txPeriodSummary.sentIcoin}</span>
                        </div>
                      )}
                      <div className="col-span-2 text-muted-foreground">
                        {txPeriodSummary.count} transaction{txPeriodSummary.count !== 1 ? 's' : ''} in period
                      </div>
                    </div>
                  </div>
                )}
                {txError && (
                  <p className="text-sm text-destructive">{txError}</p>
                )}
                {txLoading && transactions.length === 0 ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex items-center gap-4 p-4 neu-inset rounded-2xl animate-pulse">
                        <div className="w-10 h-10 rounded-full bg-muted" />
                        <div className="flex-1 space-y-2">
                          <div className="h-4 bg-muted rounded w-3/4" />
                          <div className="h-3 bg-muted rounded w-1/3" />
                        </div>
                        <div className="h-5 bg-muted rounded w-12" />
                      </div>
                    ))}
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <div className="w-16 h-16 rounded-full neu-button flex items-center justify-center mx-auto mb-4">
                      <RefreshCw className="w-8 h-8 opacity-50" />
                    </div>
                    <p className="font-medium">No transactions found</p>
                    <p className="text-sm mt-1">
                      {txSearch || txTypeFilter !== 'all' || txCoinFilter !== 'all' || txDateRange !== 'all' || txAmountMin || txAmountMax
                        ? 'Try adjusting your filters'
                        : 'Start watching content to earn rewards!'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-xs text-muted-foreground">
                      {txTotalCount} transaction{txTotalCount !== 1 ? 's' : ''}
                    </p>
                    {groupedTransactions.map(({ group, label, items }) => (
                      <div key={group}>
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 px-1">
                          {label}
                        </h3>
                        <div className="space-y-2">
                          {items.map((tx) => (
                            <Button
                              type="button"
                              variant="outline"
                              key={tx.id}
                              onClick={() => setSelectedTransaction(tx)}
                              className="h-auto w-full items-center justify-start gap-4 rounded-2xl p-4 text-left transition hover:opacity-90 active:scale-[0.99]"
                            >
                              <div className="w-10 h-10 rounded-full neu-button flex items-center justify-center shrink-0">
                                {getTransactionIcon(tx.type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm truncate">{tx.description}</p>
                                <p className="text-xs text-muted-foreground">
                                  {typeof tx.timestamp === 'object' && 'toLocaleTimeString' in tx.timestamp
                                    ? tx.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                    : new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  {' · '}
                                  {typeof tx.timestamp === 'object' && 'toLocaleDateString' in tx.timestamp
                                    ? tx.timestamp.toLocaleDateString()
                                    : new Date(tx.timestamp).toLocaleDateString()}
                                </p>
                                <span className={cn(
                                  'mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]',
                                  getTransactionStatusChip(tx).className
                                )}>
                                  {getTransactionStatusChip(tx).icon}
                                  {getTransactionStatusChip(tx).label}
                                </span>
                              </div>
                              <div
                                className={cn(
                                  'font-display font-semibold whitespace-nowrap shrink-0',
                                  tx.type === 'earned' || tx.type === 'received' ? 'text-primary' : 'text-destructive'
                                )}
                              >
                                {tx.type === 'earned' || tx.type === 'received' ? '+' : '-'}
                                {tx.amount}
                                <span className="text-xs ml-1">{tx.coinType === 'icoin' ? 'i' : 'v'}</span>
                              </div>
                            </Button>
                          ))}
                        </div>
                      </div>
                    ))}
                    {hasMoreTx && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={loadMoreTransactions}
                        disabled={txLoadingMore}
                        className="h-auto w-full rounded-2xl py-3 text-sm font-medium"
                      >
                        {txLoadingMore ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <ChevronDown className="w-4 h-4" />
                            Load more
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Subscription Tab */}
            {activeTab === 'subscription' && (
              <div className="space-y-4">
                {Object.entries(SUBSCRIPTION_TIERS).map(([key, tier]) => {
                  const isCurrentPlan = subscription?.tier === key;
                  const tierKey = key as 'free' | 'pro' | 'creator';

                  return (
                    <div
                      key={key}
                      className={cn(
                        'neu-card rounded-2xl p-5 border-2 transition-all',
                        isCurrentPlan && 'border-primary',
                        !isCurrentPlan && 'border-transparent'
                      )}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-display font-bold text-lg">{tier.name}</h3>
                            {isCurrentPlan && (
                              <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                                Your Plan
                              </span>
                            )}
                          </div>
                          <p className="text-2xl font-bold mt-1">
                            ${tier.price}
                            {tier.price > 0 && (
                              <span className="text-sm font-normal text-muted-foreground">/mo</span>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 text-sm">
                          <Zap className="w-4 h-4 text-primary" />
                          <span>{tier.reward_multiplier}x</span>
                        </div>
                      </div>

                      <ul className="space-y-2 mb-4">
                        {tier.features.map((feature, i) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                            {feature}
                          </li>
                        ))}
                      </ul>

                      {!isCurrentPlan && tierKey !== 'free' && (
                        <Button
                          type="button"
                          onClick={() => handleSubscribe(tierKey)}
                          className="h-auto w-full rounded-xl bg-primary py-3 font-medium text-primary-foreground"
                        >
                          Upgrade to {tier.name}
                        </Button>
                      )}

                      {isCurrentPlan && subscription?.subscribed && (
                        <>
                          {(subscription.trial_end || subscription.subscription_end || subscription.cancel_at_period_end) && (
                            <div className="rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground space-y-1 mb-3">
                              {subscription.trial_end && (
                                <p>Trial ends {new Date(subscription.trial_end).toLocaleDateString(undefined, { dateStyle: 'medium' })}</p>
                              )}
                              {subscription.subscription_end && !subscription.trial_end && (
                                <p>Next billing: {new Date(subscription.subscription_end).toLocaleDateString(undefined, { dateStyle: 'medium' })}</p>
                              )}
                              {subscription.cancel_at_period_end && (
                                <p className="text-amber-600 dark:text-amber-400">Subscription will not renew</p>
                              )}
                            </div>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleManageSubscription}
                            className="h-auto w-full rounded-xl py-3 font-medium"
                          >
                            Manage Subscription
                          </Button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Payout Tab – full request flow + history */}
            {activeTab === 'payout' && (
              <div className="space-y-6">
                <div className="neu-card rounded-2xl p-5">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h3 className="font-semibold">Payout Requirements</h3>
                    {isDemoMode && <DemoModeBadge className="text-[9px] px-2 py-0.5 min-h-[20px]" />}
                  </div>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Minimum {MIN_PAYOUT_VICOIN} Vicoins or {MIN_PAYOUT_ICOIN} Icoins</li>
                    <li>• Fee: 2% (min 10, max 500 coins)</li>
                    <li>• KYC verification required</li>
                    <li>• Processing: 1–5 business days depending on method</li>
                  </ul>
                  {isDemoMode && (
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-200">
                      <span className="rounded-lg border border-white/10 bg-slate-900/70 px-2 py-1">KYC (Simulated)</span>
                      <span className="rounded-lg border border-white/10 bg-slate-900/70 px-2 py-1">Payout Confirmation (Simulated)</span>
                    </div>
                  )}
                </div>

                {/* KYC status */}
                <div className="neu-card rounded-2xl p-4 flex items-center gap-3">
                  {kycVerified ? (
                    <>
                      <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                        <Check className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">Identity verified</p>
                        <p className="text-xs text-muted-foreground">You can request payouts</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <AlertCircle className="w-5 h-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="font-medium">Verification required</p>
                        <p className="text-xs text-muted-foreground">
                          Complete KYC in your profile to enable withdrawals
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* Coin type & amount */}
                <div className="neu-card rounded-2xl p-4 space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Withdraw as</label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={payoutCoinType === 'vicoin' ? 'default' : 'outline'}
                        onClick={() => setPayoutCoinType('vicoin')}
                        className={cn(
                          'h-auto flex-1 rounded-xl py-2.5 text-sm font-medium',
                          payoutCoinType === 'vicoin' ? 'bg-primary text-primary-foreground' : 'neu-button'
                        )}
                      >
                        Vicoins (V)
                      </Button>
                      <Button
                        type="button"
                        variant={payoutCoinType === 'icoin' ? 'default' : 'outline'}
                        onClick={() => setPayoutCoinType('icoin')}
                        className={cn(
                          'h-auto flex-1 rounded-xl py-2.5 text-sm font-medium',
                          payoutCoinType === 'icoin' ? 'bg-primary text-primary-foreground' : 'neu-button'
                        )}
                      >
                        Icoins (I)
                      </Button>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Amount</label>
                    <div className="flex gap-2 items-center">
                      <Input
                        type="number"
                        inputMode="numeric"
                        value={payoutAmount}
                        onChange={(e) => setPayoutAmount(e.target.value.replace(/\D/g, '').slice(0, 8))}
                        placeholder={`${payoutMin}–${payoutMax}`}
                        min={payoutMin}
                        max={Math.min(payoutMax, availableBalance)}
                        className="flex-1 bg-transparent px-4 py-3 text-sm"
                      />
                      <span className="text-sm text-muted-foreground w-6">
                        {payoutCoinType === 'vicoin' ? 'V' : 'I'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Available: {availableBalance} {payoutCoinType === 'vicoin' ? 'V' : 'I'}
                      {payoutAmountNum >= payoutMin && (
                        <span className="ml-2">
                          • Fee: {payoutFeeResult.fee} → Net: {payoutFeeResult.netAmount}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Payout method: Bank / PayPal / Crypto */}
                <div className="neu-card rounded-2xl p-4">
                  <label className="text-sm font-medium mb-2 block">Payout method</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        { id: 'paypal' as const, label: 'PayPal', icon: CreditCard },
                        { id: 'bank' as const, label: 'Bank', icon: Building2 },
                        { id: 'crypto' as const, label: 'Crypto', icon: Bitcoin },
                      ] as const
                    ).map(({ id, label, icon: Icon }) => (
                      <Button
                        key={id}
                        type="button"
                        variant={payoutMethod === id ? 'default' : 'outline'}
                        onClick={() => setPayoutMethod(id)}
                        className={cn(
                          'h-auto flex flex-col items-center gap-1 rounded-xl py-3 text-xs font-medium',
                          payoutMethod === id ? 'bg-primary text-primary-foreground' : 'neu-button'
                        )}
                      >
                        <Icon className="w-5 h-5" />
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Payment method (saved) */}
                <div className="neu-card rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium">Destination</label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPaymentMethodSheet(true)}
                      className="h-auto p-0 text-xs text-primary"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add / manage
                    </Button>
                  </div>
                  {loadingMethods ? (
                    <div className="py-4 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : paymentMethods.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">
                      Add a payment method to receive payouts. You can still request; we&apos;ll use your profile contact.
                    </p>
                  ) : (
                    <Select
                      value={payoutPaymentMethodId ?? paymentMethods[0]?.id ?? undefined}
                      onValueChange={(value) => setPayoutPaymentMethodId(value || null)}
                    >
                      <SelectTrigger className="h-12 w-full rounded-xl bg-transparent px-4 text-sm">
                        <SelectValue placeholder="Select destination" />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentMethods.map((pm) => (
                          <SelectItem key={pm.id} value={pm.id}>
                            {pm.nickname || pm.method_type}{' '}
                            {pm.details?.account_last4
                              ? `••${pm.details.account_last4}`
                              : pm.details?.email
                                ? `(${pm.details.email})`
                                : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {payoutError && (
                  <p className="text-sm text-destructive text-center">{payoutError}</p>
                )}

                <Button
                  type="button"
                  disabled={!canSubmitPayout}
                  onClick={handleRequestPayout}
                  title={
                    !canWithdraw
                      ? 'Complete KYC to withdraw'
                      : paymentMethods.length && !payoutPaymentMethodId
                        ? 'Select a destination'
                        : payoutAmountNum > availableBalance
                          ? 'Insufficient balance'
                          : undefined
                  }
                  className="h-auto w-full rounded-2xl bg-primary py-4 font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {requesting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Requesting…
                    </>
                  ) : (
                    <>
                      <ArrowDownToLine className="w-5 h-5" />
                      Request payout
                    </>
                  )}
                </Button>
                {isDemoMode && (
                  <p className="text-xs -mt-3 text-muted-foreground">
                    Simulated payout confirmation. Timeline outcome is controlled in Demo Controls.
                  </p>
                )}

                {!canWithdraw && (
                  <p className="text-xs text-center text-muted-foreground">
                    Complete KYC verification in your profile to enable payouts
                  </p>
                )}

                {/* Payout history */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold flex items-center gap-2">
                      <ArrowDownToLine className="w-4 h-4" />
                      Payout history
                    </h3>
                    {loadingHistory ? (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => loadPayoutHistory()}
                        className="h-auto p-0 text-xs text-primary"
                      >
                        Refresh
                      </Button>
                    )}
                  </div>
                  {payoutHistory.length === 0 ? (
                    <div className="neu-card rounded-2xl p-6 text-center text-muted-foreground text-sm">
                      No payouts yet. Your withdrawal history will appear here.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {payoutHistory.slice(0, 10).map((p) => {
                        const statusIcon =
                          p.status === 'completed' ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          ) : p.status === 'failed' ? (
                            <XCircle className="w-4 h-4 text-destructive" />
                          ) : (
                            <Clock className="w-4 h-4 text-amber-500 animate-pulse" />
                          );
                        return (
                          <div
                            key={p.id}
                            className="flex items-center justify-between p-3 rounded-xl neu-inset"
                          >
                            <div className="flex items-center gap-3">
                              {statusIcon}
                              <div>
                                <p className="font-medium text-sm">
                                  {p.amount.toLocaleString()} {p.coin_type === 'vicoin' ? 'V' : 'I'}
                                  {p.fee != null && p.fee > 0 && (
                                    <span className="text-muted-foreground font-normal ml-1">
                                      (net {p.net_amount})
                                    </span>
                                  )}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {new Date(p.created_at).toLocaleDateString()} • {p.status}
                                </p>
                              </div>
                            </div>
                            {p.reference_id && (
                              <span className="text-xs text-muted-foreground font-mono">
                                #{p.reference_id.slice(-8)}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {showPaymentMethodSheet && (
                  <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
                    <div className="bg-background w-full max-h-[90vh] rounded-t-2xl sm:rounded-2xl p-4 overflow-y-auto">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold">Payment methods</h3>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => setShowPaymentMethodSheet(false)}
                          className="h-10 w-10 rounded-xl"
                        >
                          <X className="w-5 h-5" />
                        </Button>
                      </div>
                      <PaymentMethodManager />
                      <Button
                        type="button"
                        onClick={() => {
                          loadPaymentMethods();
                          setShowPaymentMethodSheet(false);
                        }}
                        className="mt-4 h-auto w-full rounded-xl bg-primary py-3 font-medium text-primary-foreground"
                      >
                        Done
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <MerchantCheckoutSheet
        open={merchantCheckoutOpen}
        onClose={() => {
          setMerchantCheckoutOpen(false);
          setMerchantCheckoutLaunchMode(null);
          setMerchantCheckoutAutoScenarioId(null);
        }}
        icoins={icoins}
        vicoins={vicoins}
        launchMode={merchantCheckoutLaunchMode}
        autoStartScenarioId={merchantCheckoutAutoScenarioId}
        demoSettlementOutcome={demoCheckoutOutcome}
      />

      {/* Transaction detail sheet */}
      <Sheet open={!!selectedTransaction} onOpenChange={(open) => !open && setSelectedTransaction(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto">
          {selectedTransaction && (
            <>
              <SheetHeader className="pb-4">
                <SheetTitle className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full neu-button flex items-center justify-center">
                    {getTransactionIcon(selectedTransaction.type)}
                  </div>
                  <span>
                    {selectedTransaction.type.charAt(0).toUpperCase() + selectedTransaction.type.slice(1)} ·{' '}
                    {selectedTransaction.type === 'earned' || selectedTransaction.type === 'received' ? '+' : '-'}
                    {selectedTransaction.amount} {selectedTransaction.coinType === 'icoin' ? 'Icoin' : 'Vicoin'}
                  </span>
                </SheetTitle>
                <SheetDescription className="pt-2">
                  <span className={cn(
                    'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]',
                    getTransactionStatusChip(selectedTransaction).className
                  )}>
                    {getTransactionStatusChip(selectedTransaction).icon}
                    {getTransactionStatusChip(selectedTransaction).label}
                  </span>
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-muted-foreground mb-1">Description</p>
                  <p className="font-medium">{selectedTransaction.description}</p>
                </div>
                {(selectedTransaction.status === 'pending' || selectedTransaction.status === 'verification_required') && (
                  <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
                    <p className="font-medium text-amber-300">Pending details</p>
                    <p className="text-xs text-slate-200">
                      {selectedTransaction.statusDetail ?? 'This transaction is still being verified and processed.'}
                    </p>
                    <div className="grid grid-cols-1 gap-1 text-xs text-slate-300">
                      <p>
                        Reason: {selectedTransaction.statusReason ? selectedTransaction.statusReason.replace(/_/g, ' ') : 'processing window'}
                      </p>
                      <p>
                        Next step: {selectedTransaction.nextStep ?? 'No action required while checks complete.'}
                      </p>
                      {selectedTransaction.etaLabel && <p>ETA: {selectedTransaction.etaLabel}</p>}
                    </div>
                  </div>
                )}
                {(selectedTransaction.status === 'reversed' || selectedTransaction.status === 'failed') && (
                  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 space-y-2">
                    <p className="font-medium text-red-300">Reversal details</p>
                    <p className="text-xs text-slate-200">
                      {selectedTransaction.statusDetail ?? 'This transaction was reversed.'}
                    </p>
                    <p className="text-xs text-slate-300">
                      Next step: {selectedTransaction.nextStep ?? 'Retry or contact support.'}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground mb-1">Date & time</p>
                  <p className="font-medium">
                    {typeof selectedTransaction.timestamp === 'object' && 'toLocaleString' in selectedTransaction.timestamp
                      ? selectedTransaction.timestamp.toLocaleString()
                      : new Date(selectedTransaction.timestamp).toLocaleString()}
                  </p>
                </div>
                {selectedTransaction.referenceId && (
                  <div>
                    <p className="text-muted-foreground mb-1">Reference</p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs font-mono bg-muted px-2 py-1 rounded truncate flex-1">
                        {selectedTransaction.referenceId}
                      </code>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => handleCopyTxField(selectedTransaction.referenceId!, 'reference')}
                        className="h-9 w-9 shrink-0 rounded-xl"
                        title="Copy reference"
                      >
                        {copiedField === 'reference' ? (
                          <Check className="w-4 h-4 text-primary" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground mb-1">Transaction ID</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono bg-muted px-2 py-1 rounded truncate flex-1">
                      {selectedTransaction.transactionId}
                    </code>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => handleCopyTxField(selectedTransaction.transactionId, 'id')}
                      className="h-9 w-9 shrink-0 rounded-xl"
                      title="Copy ID"
                    >
                      {copiedField === 'id' ? (
                        <Check className="w-4 h-4 text-primary" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </SwipeDismissOverlay>
  );
};
