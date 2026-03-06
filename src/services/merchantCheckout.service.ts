import { supabase } from '@/integrations/supabase/client';
import {
  calculateQuote,
  resolveMerchantCheckoutPlan,
  resolveTipSelectionMinor,
} from '@/features/merchantCheckout/mockResolver';
import type {
  CheckoutScreenId,
  MerchantCheckoutAccessibility,
  MerchantCheckoutDraftState,
  MerchantCheckoutPlan,
  MerchantCheckoutScenario,
  MerchantCheckoutUserPreferences,
  MerchantCheckoutWalletSnapshot,
  TipSelection,
} from '@/features/merchantCheckout/types';

type MerchantCheckoutAuthMethod = 'FACE_ID' | 'PIN';

interface CheckoutSessionRecord {
  checkoutSessionId: string;
  scenario: MerchantCheckoutScenario;
  plan: MerchantCheckoutPlan;
  draft: MerchantCheckoutDraftState;
  quote: ReturnType<typeof calculateQuote>['quote'];
  wallet: MerchantCheckoutWalletSnapshot;
  userPreferences: MerchantCheckoutUserPreferences;
  accessibility: MerchantCheckoutAccessibility;
  paymentId?: string;
  transactionId?: string;
}

export interface MerchantCheckoutResolveParams {
  scenario: MerchantCheckoutScenario;
  userPreferences: MerchantCheckoutUserPreferences;
  wallet: MerchantCheckoutWalletSnapshot;
  accessibility: MerchantCheckoutAccessibility;
}

export interface MerchantCheckoutResolveResult {
  checkoutSessionId: string;
  plan: MerchantCheckoutPlan;
  quote: ReturnType<typeof calculateQuote>['quote'];
  draft: MerchantCheckoutDraftState;
}

export interface MerchantCheckoutDraftParams {
  checkoutSessionId: string;
  draft: MerchantCheckoutDraftState;
  userPreferences: MerchantCheckoutUserPreferences;
  accessibility: MerchantCheckoutAccessibility;
}

export interface MerchantCheckoutDraftResult {
  checkoutSessionId: string;
  plan: MerchantCheckoutPlan;
  quote: ReturnType<typeof calculateQuote>['quote'];
  draft: MerchantCheckoutDraftState;
  autoConvertEligible: boolean;
}

export interface MerchantCheckoutConfirmParams {
  checkoutSessionId: string;
  authMethod: MerchantCheckoutAuthMethod;
  idempotencyKey?: string;
}

export interface MerchantCheckoutConfirmResult {
  checkoutSessionId: string;
  paymentId: string;
  status: 'SUCCEEDED';
  receipt: {
    transactionId: string;
    amountMinor: number;
    tipMinor: number;
    feesMinor: number;
    totalMinor: number;
    currencyCode: string;
    paidWith: 'ICOINS' | 'AUTO_CONVERT';
    merchantName: string;
    createdAt: string;
    authMethod: MerchantCheckoutAuthMethod;
  };
}

export interface MerchantCheckoutTipParams {
  checkoutSessionId: string;
  selection: TipSelection;
  idempotencyKey?: string;
}

export interface MerchantCheckoutTipResult {
  checkoutSessionId: string;
  success: boolean;
  tipAmountMinor: number;
  currencyCode: string;
  tipId?: string;
  transactionId?: string;
}

export interface MerchantCheckoutPaymentStatusResult {
  found: boolean;
  paymentId?: string;
  checkoutSessionId?: string;
  status?: 'SUCCEEDED' | 'PENDING' | 'FAILED';
  receipt?: MerchantCheckoutConfirmResult['receipt'];
  createdAt?: string;
}

export interface MerchantCheckoutFunnelBreakdownRow {
  key: string;
  started: number;
  resolved: number;
  confirmed: number;
  abandoned: number;
  started_to_confirmed: number;
}

export interface MerchantCheckoutFunnelResult {
  scope: 'SELF' | 'GLOBAL';
  windowHours: number;
  from: string;
  totals: {
    events: number;
    uniqueUsers?: number;
    uniqueMerchants?: number;
  };
  counts: Record<string, number>;
  conversion: {
    started_to_resolved: number;
    resolved_to_confirmed: number;
    started_to_confirmed: number;
    abandonment_rate: number;
  };
  topAbandonScreens: Array<{ screen: string; count: number }>;
  breakdown: {
    entryType: MerchantCheckoutFunnelBreakdownRow[];
    merchantId: MerchantCheckoutFunnelBreakdownRow[];
    merchantCategory: MerchantCheckoutFunnelBreakdownRow[];
    checkoutMode: MerchantCheckoutFunnelBreakdownRow[];
    tipTiming: MerchantCheckoutFunnelBreakdownRow[];
  };
}

export interface MerchantCheckoutClientEventParams {
  eventName:
    | 'checkout_started'
    | 'checkout_abandoned'
    | 'checkout_step_changed'
    | 'checkout_manual_entry_launched'
    | 'checkout_qr_scan_started'
    | 'checkout_qr_scan_succeeded'
    | 'checkout_qr_scan_failed';
  checkoutSessionId?: string;
  paymentId?: string;
  currentScreen?: CheckoutScreenId;
  metadata?: Record<string, unknown>;
}

export interface MerchantCheckoutPreferencesSnapshot {
  hasChosenLabelLanguage: boolean;
  labelLanguage: MerchantCheckoutUserPreferences['labelLanguage'];
  tipPromptLayoutGlobal: MerchantCheckoutUserPreferences['tipPromptLayoutGlobal'];
  tipPromptLayoutByCategory: MerchantCheckoutUserPreferences['tipPromptLayoutByCategory'];
  autoConvertPreferenceEnabled: boolean;
  version: number;
}

const sessions = new Map<string, CheckoutSessionRecord>();

function makeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`;
}

function shouldUseRemoteFunctions() {
  return import.meta.env.VITE_ENABLE_MERCHANT_CHECKOUT_EDGE === 'true';
}

async function safeInvoke<T>(fn: string, body: unknown): Promise<{ data: T | null; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke(fn, { body });
    if (error) {
      const ctx = (error as { context?: Response })?.context;
      let parsedMsg: string | undefined;
      if (ctx && typeof (ctx as Response).json === 'function') {
        try {
          const parsed = await (ctx as Response).clone().json().catch(() => null);
          parsedMsg = parsed?.error || parsed?.message;
        } catch {
          // ignore
        }
      }
      return { data: null, error: parsedMsg || (error as Error)?.message || `Function ${fn} failed` };
    }
    return { data: (data ?? null) as T | null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : String(err) };
  }
}

class MerchantCheckoutService {
  async trackClientEvent(params: MerchantCheckoutClientEventParams): Promise<void> {
    if (!shouldUseRemoteFunctions()) return;
    const remote = await safeInvoke<{ success: boolean }>('merchant-checkout-event', params);
    if (!remote.data) {
      console.warn('[merchantCheckout] client event tracking failed:', {
        eventName: params.eventName,
        error: remote.error,
      });
    }
  }

  async loadPreferences(): Promise<MerchantCheckoutPreferencesSnapshot | null> {
    if (!shouldUseRemoteFunctions()) return null;
    const remote = await safeInvoke<{ preferences: MerchantCheckoutPreferencesSnapshot }>(
      'merchant-checkout-preferences',
      { action: 'GET' }
    );
    if (remote.data?.preferences) return remote.data.preferences;
    console.warn('[merchantCheckout] preferences load remote failed, using local only:', remote.error);
    return null;
  }

  async savePreferences(params: {
    preferences: MerchantCheckoutPreferencesSnapshot;
    version?: number | null;
  }): Promise<{ version: number } | null> {
    if (!shouldUseRemoteFunctions()) return null;
    const remote = await safeInvoke<{ success: boolean; version: number }>('merchant-checkout-preferences', {
      action: 'PUT',
      preferences: params.preferences,
      version: params.version ?? params.preferences.version ?? null,
    });
    if (remote.data) return { version: remote.data.version };
    console.warn('[merchantCheckout] preferences save remote failed, keeping local only:', remote.error);
    return null;
  }

  async resolve(params: MerchantCheckoutResolveParams): Promise<MerchantCheckoutResolveResult> {
    if (shouldUseRemoteFunctions()) {
      const remote = await safeInvoke<MerchantCheckoutResolveResult>('merchant-checkout-resolve', params);
      if (remote.data) return remote.data;
      console.warn('[merchantCheckout] resolve remote failed, falling back to local:', remote.error);
    }

    const plan = resolveMerchantCheckoutPlan({
      scenario: params.scenario,
      userPreferences: params.userPreferences,
      wallet: params.wallet,
      accessibility: params.accessibility,
    });

    const draft: MerchantCheckoutDraftState = {
      enteredAmountMinor: params.scenario.entry.amountMinor,
      paymentSourceSelection: params.userPreferences.autoConvertPreferenceEnabled ? 'AUTO_CONVERT' : 'ICOINS',
      prePayTipSelection: { kind: 'NONE' },
    };

    const quoteCalc = calculateQuote({
      scenario: params.scenario,
      plan,
      draft,
      wallet: params.wallet,
    });

    const checkoutSessionId = makeId('chk');
    sessions.set(checkoutSessionId, {
      checkoutSessionId,
      scenario: params.scenario,
      plan,
      draft,
      quote: quoteCalc.quote,
      wallet: params.wallet,
      userPreferences: params.userPreferences,
      accessibility: params.accessibility,
    });

    return {
      checkoutSessionId,
      plan,
      quote: quoteCalc.quote,
      draft,
    };
  }

  async getPaymentStatus(params: {
    paymentId?: string;
    checkoutSessionId?: string;
  }): Promise<MerchantCheckoutPaymentStatusResult> {
    if (shouldUseRemoteFunctions()) {
      const remote = await safeInvoke<MerchantCheckoutPaymentStatusResult>('merchant-checkout-payment-status', params);
      if (remote.data) return remote.data;
      console.warn('[merchantCheckout] payment status remote failed, falling back to local:', remote.error);
    }

    const record = params.checkoutSessionId ? sessions.get(params.checkoutSessionId) : undefined;
    if (!record || !record.paymentId) return { found: false };
    return {
      found: true,
      paymentId: record.paymentId,
      checkoutSessionId: record.checkoutSessionId,
      status: 'SUCCEEDED',
      receipt: {
        transactionId: record.transactionId ?? makeId('txn'),
        amountMinor: record.quote.amountMinor,
        tipMinor: record.quote.tipMinor,
        feesMinor: record.quote.feesMinor + record.quote.conversionFeeMinor,
        totalMinor: record.quote.totalMinor,
        currencyCode: record.quote.currencyCode,
        paidWith: record.draft.paymentSourceSelection,
        merchantName: record.scenario.merchant.name,
        createdAt: new Date().toISOString(),
        authMethod: 'FACE_ID',
      },
      createdAt: new Date().toISOString(),
    };
  }

  async getCheckoutFunnel(params?: {
    windowHours?: number;
    scope?: 'SELF' | 'GLOBAL';
  }): Promise<MerchantCheckoutFunnelResult | null> {
    if (!shouldUseRemoteFunctions()) return null;
    const remote = await safeInvoke<MerchantCheckoutFunnelResult>('merchant-checkout-funnel', {
      windowHours: params?.windowHours,
      scope: params?.scope,
    });
    if (remote.data) return remote.data;
    console.warn('[merchantCheckout] funnel remote failed:', remote.error);
    return null;
  }

  async patchDraft(params: MerchantCheckoutDraftParams): Promise<MerchantCheckoutDraftResult> {
    if (shouldUseRemoteFunctions()) {
      const remote = await safeInvoke<MerchantCheckoutDraftResult>('merchant-checkout-draft', params);
      if (remote.data) return remote.data;
      console.warn('[merchantCheckout] patchDraft remote failed, falling back to local:', remote.error);
    }

    const record = sessions.get(params.checkoutSessionId);
    if (!record) throw new Error('Checkout session not found');

    const nextScenario: MerchantCheckoutScenario = {
      ...record.scenario,
      entry: {
        ...record.scenario.entry,
        amountMinor: params.draft.enteredAmountMinor ?? record.scenario.entry.amountMinor,
      },
    };

    const plan = resolveMerchantCheckoutPlan({
      scenario: nextScenario,
      userPreferences: params.userPreferences,
      wallet: record.wallet,
      accessibility: params.accessibility,
    });

    const quoteCalc = calculateQuote({
      scenario: nextScenario,
      plan,
      draft: params.draft,
      wallet: record.wallet,
    });

    const nextRecord: CheckoutSessionRecord = {
      ...record,
      scenario: nextScenario,
      plan,
      draft: params.draft,
      quote: quoteCalc.quote,
      userPreferences: params.userPreferences,
      accessibility: params.accessibility,
    };
    sessions.set(params.checkoutSessionId, nextRecord);

    return {
      checkoutSessionId: params.checkoutSessionId,
      plan,
      quote: quoteCalc.quote,
      draft: params.draft,
      autoConvertEligible: quoteCalc.autoConvertEligible,
    };
  }

  async confirm(params: MerchantCheckoutConfirmParams): Promise<MerchantCheckoutConfirmResult> {
    if (shouldUseRemoteFunctions()) {
      const remote = await safeInvoke<MerchantCheckoutConfirmResult>('merchant-checkout-confirm', params);
      if (remote.data) return remote.data;
      console.warn('[merchantCheckout] confirm remote failed, falling back to local:', remote.error);
    }

    const record = sessions.get(params.checkoutSessionId);
    if (!record) throw new Error('Checkout session not found');

    const paymentId = makeId('pay');
    const transactionId = makeId('txn');
    record.paymentId = paymentId;
    record.transactionId = transactionId;
    sessions.set(params.checkoutSessionId, record);

    return {
      checkoutSessionId: params.checkoutSessionId,
      paymentId,
      status: 'SUCCEEDED',
      receipt: {
        transactionId,
        amountMinor: record.quote.amountMinor,
        tipMinor: record.quote.tipMinor,
        feesMinor: record.quote.feesMinor + record.quote.conversionFeeMinor,
        totalMinor: record.quote.totalMinor,
        currencyCode: record.quote.currencyCode,
        paidWith: record.draft.paymentSourceSelection,
        merchantName: record.scenario.merchant.name,
        createdAt: new Date().toISOString(),
        authMethod: params.authMethod,
      },
    };
  }

  async submitPostPayTip(params: MerchantCheckoutTipParams): Promise<MerchantCheckoutTipResult> {
    if (shouldUseRemoteFunctions()) {
      const remote = await safeInvoke<MerchantCheckoutTipResult>('merchant-checkout-tip', params);
      if (remote.data) return remote.data;
      console.warn('[merchantCheckout] tip remote failed, falling back to local:', remote.error);
    }

    const record = sessions.get(params.checkoutSessionId);
    if (!record) throw new Error('Checkout session not found');

    const tipAmountMinor = resolveTipSelectionMinor(
      params.selection,
      record.plan.tipPlan.presets,
      record.quote.amountMinor
    );

    return {
      checkoutSessionId: params.checkoutSessionId,
      success: true,
      tipAmountMinor,
      currencyCode: record.quote.currencyCode,
      tipId: makeId('tip'),
      transactionId: makeId('txn'),
    };
  }
}

export const merchantCheckoutService = new MerchantCheckoutService();
