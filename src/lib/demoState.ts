export const DEMO_SCENARIO_SEEN_KEY = 'i_demo_scenario_seen_v1';
export const DEMO_CONTROLS_KEY = 'i_demo_controls_v2';
export const DEMO_BALANCES_KEY = 'i_demo_balances_v1';
export const DEMO_SUBSCRIPTION_KEY = 'i_demo_subscription_v1';
export const DEMO_TRANSACTIONS_KEY = 'i_demo_transactions_v1';
export const DEMO_STATE_EVENT = 'i_demo_state_changed_v1';

export type DemoCoinType = 'vicoin' | 'icoin';
export type DemoCheckoutOutcome = 'completed' | 'pending' | 'reversed';
export type DemoSubscriptionTier = 'free' | 'pro' | 'creator';
export type DemoTransactionType = 'earned' | 'spent' | 'received' | 'sent' | 'withdrawn';
export type DemoTransactionStatus = 'pending' | 'completed' | 'reversed' | 'verification_required';
export type DemoStatusReason =
  | 'verification'
  | 'cooldown'
  | 'processing_window'
  | 'compliance_review'
  | 'fraud_review'
  | 'retry_available';

export interface DemoBalances {
  vicoins: number;
  icoins: number;
}

export interface DemoWalletTransaction {
  id: string;
  type: DemoTransactionType;
  amount: number;
  coinType: DemoCoinType;
  description: string;
  status: DemoTransactionStatus;
  statusReason?: DemoStatusReason;
  statusDetail?: string;
  nextStep?: string;
  etaLabel?: string;
  destinationLabel?: string;
  feeAmount?: number;
  transactionId: string;
  timestamp: string;
  updatedAt: string;
  referenceId: string | null;
}

export interface DemoPromoCampaign {
  id: string;
  brand: string;
  title: string;
  durationSeconds: number;
  rewardIcoins: number;
}

export const defaultDemoBalances: DemoBalances = {
  vicoins: 400,
  icoins: 12.4,
};

export const demoPromoCampaigns: DemoPromoCampaign[] = [
  {
    id: 'cmp-freshfizz-2026',
    brand: 'FreshFizz',
    title: 'FreshFizz Summer',
    durationSeconds: 24,
    rewardIcoins: 1,
  },
  {
    id: 'cmp-bluecup-bonus',
    brand: 'Blue Cup Coffee',
    title: 'Morning Boost',
    durationSeconds: 18,
    rewardIcoins: 0.75,
  },
  {
    id: 'cmp-wavepay-us',
    brand: 'WavePay',
    title: 'Checkout Confidence',
    durationSeconds: 20,
    rewardIcoins: 1.2,
  },
];

function hasWindow(): boolean {
  return typeof window !== 'undefined';
}

function readJSON<T>(key: string): T | null {
  if (!hasWindow()) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJSON<T>(key: string, value: T): void {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore private-mode quota/storage errors in demo mode.
  }
}

function createId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}-${uuid}`;
}

function roundTo2(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizeAmount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, roundTo2(Number(value)));
}

function notifyDemoStateChanged(reason: string): void {
  if (!hasWindow()) return;
  try {
    window.dispatchEvent(
      new CustomEvent(DEMO_STATE_EVENT, {
        detail: { reason, at: Date.now() },
      })
    );
    window.dispatchEvent(new Event('storage'));
  } catch {
    // no-op
  }
}

function createExternalTransactionId(type: DemoTransactionType): string {
  const suffix = Math.floor(Math.random() * 90000 + 10000);
  if (type === 'earned') return `PRM-${suffix}`;
  if (type === 'withdrawn') return `WDL-${suffix}`;
  if (type === 'received' || type === 'sent') return `CNV-${suffix}`;
  if (type === 'spent') return `PAY-${suffix}`;
  return `TXN-${suffix}`;
}

export function getDemoBalances(): DemoBalances {
  const stored = readJSON<Partial<DemoBalances>>(DEMO_BALANCES_KEY);
  if (!stored) return defaultDemoBalances;
  return {
    vicoins: Number.isFinite(stored.vicoins) ? normalizeAmount(Number(stored.vicoins)) : defaultDemoBalances.vicoins,
    icoins: Number.isFinite(stored.icoins) ? normalizeAmount(Number(stored.icoins)) : defaultDemoBalances.icoins,
  };
}

export function setDemoBalances(next: DemoBalances): DemoBalances {
  const normalized: DemoBalances = {
    vicoins: normalizeAmount(Number(next.vicoins) || 0),
    icoins: normalizeAmount(Number(next.icoins) || 0),
  };
  writeJSON(DEMO_BALANCES_KEY, normalized);
  notifyDemoStateChanged('balances_updated');
  return normalized;
}

export function addDemoBalance(type: DemoCoinType, delta: number): DemoBalances {
  const current = getDemoBalances();
  const next = {
    ...current,
    [type === 'vicoin' ? 'vicoins' : 'icoins']:
      normalizeAmount((type === 'vicoin' ? current.vicoins : current.icoins) + delta),
  };
  return setDemoBalances(next);
}

export function getDemoCheckoutOutcome(): DemoCheckoutOutcome {
  const controls = readJSON<{ checkoutOutcome?: DemoCheckoutOutcome }>(DEMO_CONTROLS_KEY);
  const outcome = controls?.checkoutOutcome;
  if (outcome === 'pending' || outcome === 'reversed' || outcome === 'completed') return outcome;
  return 'completed';
}

export function getDemoSubscriptionTier(): DemoSubscriptionTier {
  const stored = readJSON<{ tier?: DemoSubscriptionTier }>(DEMO_SUBSCRIPTION_KEY);
  const tier = stored?.tier;
  if (tier === 'pro' || tier === 'creator' || tier === 'free') return tier;
  return 'free';
}

export function setDemoSubscriptionTier(tier: DemoSubscriptionTier): void {
  writeJSON(DEMO_SUBSCRIPTION_KEY, { tier });
}

function getSeedTransactions(): DemoWalletTransaction[] {
  const now = Date.now();
  return [
    {
      id: 'demo-tx-1',
      type: 'earned',
      amount: 1,
      coinType: 'icoin',
      status: 'verification_required',
      statusReason: 'verification',
      statusDetail: 'Eye-tracking verification in progress.',
      nextStep: 'Expected completion in a few seconds.',
      etaLabel: '2-5 sec',
      destinationLabel: 'Wallet rewards',
      transactionId: 'PRM-84921',
      timestamp: new Date(now - 1000 * 45).toISOString(),
      updatedAt: new Date(now - 1000 * 45).toISOString(),
      referenceId: 'cmp-freshfizz-2026',
    },
    {
      id: 'demo-tx-2',
      type: 'spent',
      amount: 2.5,
      coinType: 'icoin',
      status: 'completed',
      destinationLabel: 'Blue Cup Coffee',
      description: 'Coffee payment',
      transactionId: 'PAY-19302',
      timestamp: new Date(now - 1000 * 60 * 24).toISOString(),
      updatedAt: new Date(now - 1000 * 60 * 24).toISOString(),
      referenceId: 'merchant-blue-cup',
    },
    {
      id: 'demo-tx-3',
      type: 'received',
      amount: 4.9,
      coinType: 'icoin',
      status: 'completed',
      description: 'Conversion settled',
      transactionId: 'CNV-48291',
      timestamp: new Date(now - 1000 * 60 * 90).toISOString(),
      updatedAt: new Date(now - 1000 * 60 * 90).toISOString(),
      referenceId: 'convert-v-to-i',
    },
    {
      id: 'demo-tx-4',
      type: 'withdrawn',
      amount: 10,
      coinType: 'icoin',
      status: 'completed',
      feeAmount: 0.25,
      destinationLabel: 'Linked Bank •••2481',
      etaLabel: 'Same day',
      description: 'Withdrawal to linked bank',
      transactionId: 'WDL-19482',
      timestamp: new Date(now - 1000 * 60 * 180).toISOString(),
      updatedAt: new Date(now - 1000 * 60 * 175).toISOString(),
      referenceId: 'payout-demo-completed',
    },
    {
      id: 'demo-tx-5',
      type: 'withdrawn',
      amount: 12,
      coinType: 'icoin',
      status: 'reversed',
      statusReason: 'retry_available',
      statusDetail: 'Instant payout failed due to destination timeout.',
      nextStep: 'Retry with standard transfer or contact support.',
      destinationLabel: 'PayPal (Demo)',
      description: 'Payout retry required',
      transactionId: 'WDL-19483',
      timestamp: new Date(now - 1000 * 60 * 320).toISOString(),
      updatedAt: new Date(now - 1000 * 60 * 318).toISOString(),
      referenceId: 'payout-demo-retry',
    },
  ];
}

function normalizeDemoTransaction(raw: Partial<DemoWalletTransaction>): DemoWalletTransaction {
  const nowIso = new Date().toISOString();
  const type: DemoTransactionType = raw.type ?? 'earned';
  return {
    id: raw.id ?? createId('demo-tx'),
    type,
    amount: Number.isFinite(raw.amount) ? Number(raw.amount) : 0,
    coinType: raw.coinType === 'vicoin' ? 'vicoin' : 'icoin',
    description: raw.description ?? 'Demo transaction',
    status: raw.status ?? 'completed',
    statusReason: raw.statusReason,
    statusDetail: raw.statusDetail,
    nextStep: raw.nextStep,
    etaLabel: raw.etaLabel,
    destinationLabel: raw.destinationLabel,
    feeAmount: Number.isFinite(raw.feeAmount) ? Number(raw.feeAmount) : undefined,
    transactionId: raw.transactionId ?? createExternalTransactionId(type),
    timestamp: raw.timestamp ?? nowIso,
    updatedAt: raw.updatedAt ?? raw.timestamp ?? nowIso,
    referenceId: raw.referenceId ?? null,
  };
}

export function getDemoTransactions(): DemoWalletTransaction[] {
  const stored = readJSON<Partial<DemoWalletTransaction>[]>(DEMO_TRANSACTIONS_KEY);
  if (!stored || !Array.isArray(stored) || stored.length === 0) {
    const seed = getSeedTransactions();
    writeJSON(DEMO_TRANSACTIONS_KEY, seed);
    return seed;
  }
  const normalized = stored.map(normalizeDemoTransaction);
  // Keep storage aligned with current contract once normalized.
  writeJSON(DEMO_TRANSACTIONS_KEY, normalized);
  return normalized;
}

export function getDemoPendingBalances(): { pendingVicoin: number; pendingIcoin: number } {
  const list = getDemoTransactions();
  let pendingVicoin = 0;
  let pendingIcoin = 0;
  for (const tx of list) {
    if (tx.status !== 'pending' && tx.status !== 'verification_required') continue;
    const isCredit = tx.type === 'earned' || tx.type === 'received';
    if (!isCredit) continue;
    if (tx.coinType === 'vicoin') pendingVicoin += tx.amount;
    if (tx.coinType === 'icoin') pendingIcoin += tx.amount;
  }
  return {
    pendingVicoin: roundTo2(pendingVicoin),
    pendingIcoin: roundTo2(pendingIcoin),
  };
}

export function pushDemoTransaction(
  tx: Omit<DemoWalletTransaction, 'id' | 'timestamp' | 'updatedAt' | 'status' | 'transactionId'> & {
    status?: DemoTransactionStatus;
    transactionId?: string;
  }
): DemoWalletTransaction {
  const nowIso = new Date().toISOString();
  const next: DemoWalletTransaction = {
    ...tx,
    id: createId('demo-tx'),
    status: tx.status ?? 'completed',
    transactionId: tx.transactionId ?? createExternalTransactionId(tx.type),
    timestamp: nowIso,
    updatedAt: nowIso,
  };
  const list = [next, ...getDemoTransactions()].slice(0, 400);
  writeJSON(DEMO_TRANSACTIONS_KEY, list);
  notifyDemoStateChanged('transaction_added');
  return next;
}

export function updateDemoTransaction(
  id: string,
  updater: (current: DemoWalletTransaction) => DemoWalletTransaction
): DemoWalletTransaction | null {
  const list = getDemoTransactions();
  const idx = list.findIndex((tx) => tx.id === id);
  if (idx < 0) return null;
  const current = list[idx];
  const updatedRaw = updater(current);
  const updated: DemoWalletTransaction = {
    ...updatedRaw,
    id: current.id,
    timestamp: current.timestamp,
    updatedAt: new Date().toISOString(),
  };
  const next = [...list];
  next[idx] = updated;
  writeJSON(DEMO_TRANSACTIONS_KEY, next);
  notifyDemoStateChanged('transaction_updated');
  return updated;
}

export function setDemoTransactionStatus(
  id: string,
  status: DemoTransactionStatus,
  patch?: Partial<Pick<DemoWalletTransaction, 'statusReason' | 'statusDetail' | 'nextStep' | 'etaLabel'>>
): DemoWalletTransaction | null {
  return updateDemoTransaction(id, (current) => ({
    ...current,
    status,
    statusReason: patch?.statusReason ?? current.statusReason,
    statusDetail: patch?.statusDetail ?? current.statusDetail,
    nextStep: patch?.nextStep ?? current.nextStep,
    etaLabel: patch?.etaLabel ?? current.etaLabel,
  }));
}

export function resetDemoTransactions(): void {
  writeJSON(DEMO_TRANSACTIONS_KEY, getSeedTransactions());
  notifyDemoStateChanged('transactions_reset');
}
