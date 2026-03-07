export const DEMO_SCENARIO_SEEN_KEY = 'i_demo_scenario_seen_v1';
export const DEMO_CONTROLS_KEY = 'i_demo_controls_v2';
export const DEMO_BALANCES_KEY = 'i_demo_balances_v1';
export const DEMO_SUBSCRIPTION_KEY = 'i_demo_subscription_v1';
export const DEMO_TRANSACTIONS_KEY = 'i_demo_transactions_v1';

export type DemoCoinType = 'vicoin' | 'icoin';
export type DemoCheckoutOutcome = 'completed' | 'pending' | 'reversed';
export type DemoSubscriptionTier = 'free' | 'pro' | 'creator';
export type DemoTransactionType = 'earned' | 'spent' | 'received' | 'sent' | 'withdrawn';

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
  timestamp: string;
  referenceId: string | null;
}

export const defaultDemoBalances: DemoBalances = {
  vicoins: 3200,
  icoins: 28,
};

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

export function getDemoBalances(): DemoBalances {
  const stored = readJSON<Partial<DemoBalances>>(DEMO_BALANCES_KEY);
  if (!stored) return defaultDemoBalances;
  return {
    vicoins: Number.isFinite(stored.vicoins) ? Math.max(0, Number(stored.vicoins)) : defaultDemoBalances.vicoins,
    icoins: Number.isFinite(stored.icoins) ? Math.max(0, Number(stored.icoins)) : defaultDemoBalances.icoins,
  };
}

export function setDemoBalances(next: DemoBalances): DemoBalances {
  const normalized: DemoBalances = {
    vicoins: Math.max(0, Math.floor(Number(next.vicoins) || 0)),
    icoins: Math.max(0, Math.floor(Number(next.icoins) || 0)),
  };
  writeJSON(DEMO_BALANCES_KEY, normalized);
  return normalized;
}

export function addDemoBalance(type: DemoCoinType, delta: number): DemoBalances {
  const current = getDemoBalances();
  const next = {
    ...current,
    [type === 'vicoin' ? 'vicoins' : 'icoins']:
      Math.max(0, (type === 'vicoin' ? current.vicoins : current.icoins) + Math.floor(delta)),
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
      amount: 120,
      coinType: 'vicoin',
      description: 'Promo reward: Coffee Spot',
      timestamp: new Date(now - 1000 * 60 * 45).toISOString(),
      referenceId: 'promo-coffee',
    },
    {
      id: 'demo-tx-2',
      type: 'earned',
      amount: 3,
      coinType: 'icoin',
      description: 'Task completion reward',
      timestamp: new Date(now - 1000 * 60 * 130).toISOString(),
      referenceId: 'task-daily',
    },
    {
      id: 'demo-tx-3',
      type: 'spent',
      amount: 40,
      coinType: 'vicoin',
      description: 'Merchant checkout',
      timestamp: new Date(now - 1000 * 60 * 260).toISOString(),
      referenceId: 'checkout-demo',
    },
  ];
}

export function getDemoTransactions(): DemoWalletTransaction[] {
  const stored = readJSON<DemoWalletTransaction[]>(DEMO_TRANSACTIONS_KEY);
  if (!stored || !Array.isArray(stored) || stored.length === 0) {
    const seed = getSeedTransactions();
    writeJSON(DEMO_TRANSACTIONS_KEY, seed);
    return seed;
  }
  return stored;
}

export function pushDemoTransaction(tx: Omit<DemoWalletTransaction, 'id' | 'timestamp'>): DemoWalletTransaction {
  const next: DemoWalletTransaction = {
    ...tx,
    id: createId('demo-tx'),
    timestamp: new Date().toISOString(),
  };
  const list = [next, ...getDemoTransactions()].slice(0, 400);
  writeJSON(DEMO_TRANSACTIONS_KEY, list);
  return next;
}

export function resetDemoTransactions(): void {
  writeJSON(DEMO_TRANSACTIONS_KEY, getSeedTransactions());
}
