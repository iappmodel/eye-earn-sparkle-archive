import type {
  CheckoutScreenId,
  LabelLanguagePreference,
  MerchantCategory,
  MerchantCheckoutAccessibility,
  MerchantCheckoutDraftState,
  MerchantCheckoutEntryType,
  MerchantCheckoutMerchant,
  MerchantCheckoutOverrides,
  MerchantCheckoutPlan,
  MerchantCheckoutPolicyProfile,
  MerchantCheckoutQuote,
  MerchantCheckoutScenario,
  MerchantCheckoutUserPreferences,
  MerchantCheckoutWalletSnapshot,
  MerchantTipPreset,
  MerchantTipTiming,
  TipPromptLayout,
  TipSelection,
} from './types.ts';

const DEFAULT_EXCHANGE_RATE = {
  vicoinsPerIcoinMinorUnit: 1,
  conversionFeeMinor: 25,
};

const CATEGORY_POLICY_PROFILES: Record<MerchantCategory, MerchantCheckoutPolicyProfile> = {
  RESTAURANT: {
    profileType: 'FLEXIBLE',
    category: 'RESTAURANT',
    regionCode: 'US',
    forceReviewAmountThresholdMinor: 10000,
    forceReviewOnFirstTimeMerchant: false,
    forceReviewOnComplexConversion: false,
    tipCapsDefaultEnabled: false,
    maxTipPercent: null,
    maxTipFlatMinor: null,
  },
  CAFE: {
    profileType: 'FLEXIBLE',
    category: 'CAFE',
    regionCode: 'US',
    forceReviewAmountThresholdMinor: 7500,
    forceReviewOnFirstTimeMerchant: false,
    forceReviewOnComplexConversion: false,
    tipCapsDefaultEnabled: false,
    maxTipPercent: null,
    maxTipFlatMinor: null,
  },
  BAR_NIGHTLIFE: {
    profileType: 'FLEXIBLE',
    category: 'BAR_NIGHTLIFE',
    regionCode: 'US',
    forceReviewAmountThresholdMinor: 12000,
    forceReviewOnFirstTimeMerchant: false,
    forceReviewOnComplexConversion: false,
    tipCapsDefaultEnabled: false,
    maxTipPercent: null,
    maxTipFlatMinor: null,
  },
  RETAIL: {
    profileType: 'STRICT',
    category: 'RETAIL',
    regionCode: 'US',
    forceReviewAmountThresholdMinor: 15000,
    forceReviewOnFirstTimeMerchant: true,
    forceReviewOnComplexConversion: true,
    tipCapsDefaultEnabled: true,
    maxTipPercent: 25,
    maxTipFlatMinor: 5000,
  },
  SERVICES: {
    profileType: 'FLEXIBLE',
    category: 'SERVICES',
    regionCode: 'US',
    forceReviewAmountThresholdMinor: 20000,
    forceReviewOnFirstTimeMerchant: false,
    forceReviewOnComplexConversion: true,
    tipCapsDefaultEnabled: false,
    maxTipPercent: null,
    maxTipFlatMinor: null,
  },
  DELIVERY_COURIER: {
    profileType: 'FLEXIBLE',
    category: 'DELIVERY_COURIER',
    regionCode: 'US',
    forceReviewAmountThresholdMinor: 10000,
    forceReviewOnFirstTimeMerchant: false,
    forceReviewOnComplexConversion: false,
    tipCapsDefaultEnabled: false,
    maxTipPercent: null,
    maxTipFlatMinor: null,
  },
  TRANSPORTATION: {
    profileType: 'FLEXIBLE',
    category: 'TRANSPORTATION',
    regionCode: 'US',
    forceReviewAmountThresholdMinor: 10000,
    forceReviewOnFirstTimeMerchant: false,
    forceReviewOnComplexConversion: false,
    tipCapsDefaultEnabled: false,
    maxTipPercent: null,
    maxTipFlatMinor: null,
  },
  PROFESSIONAL_SERVICES: {
    profileType: 'STRICT',
    category: 'PROFESSIONAL_SERVICES',
    regionCode: 'US',
    forceReviewAmountThresholdMinor: 10000,
    forceReviewOnFirstTimeMerchant: true,
    forceReviewOnComplexConversion: true,
    tipCapsDefaultEnabled: true,
    maxTipPercent: 20,
    maxTipFlatMinor: 20000,
  },
  EVENTS_ENTERTAINMENT: {
    profileType: 'STRICT',
    category: 'EVENTS_ENTERTAINMENT',
    regionCode: 'US',
    forceReviewAmountThresholdMinor: 10000,
    forceReviewOnFirstTimeMerchant: true,
    forceReviewOnComplexConversion: true,
    tipCapsDefaultEnabled: true,
    maxTipPercent: 20,
    maxTipFlatMinor: 10000,
  },
  OTHER: {
    profileType: 'STRICT',
    category: 'OTHER',
    regionCode: 'US',
    forceReviewAmountThresholdMinor: 10000,
    forceReviewOnFirstTimeMerchant: true,
    forceReviewOnComplexConversion: true,
    tipCapsDefaultEnabled: true,
    maxTipPercent: 25,
    maxTipFlatMinor: 5000,
  },
};

function merchant(
  partial: Partial<MerchantCheckoutMerchant> & Pick<MerchantCheckoutMerchant, 'merchantId' | 'name' | 'category'>
): MerchantCheckoutMerchant {
  const defaultSettings = {
    mode: 'EXPRESS' as const,
    modeBadgeVisibility: 'VISIBLE' as const,
    customModeLabel: {
      enabled: true,
      text: 'Fast Checkout',
      languageTag: 'en',
      reviewState: 'APPROVED' as const,
      autoCheckStatus: 'PASS' as const,
    },
    tipConfig: {
      mode: 'OPTIONAL' as const,
      timing: 'POST_PAY' as const,
      presets: [
        { type: 'PERCENT' as const, value: 10, displayLabel: '10%' },
        { type: 'PERCENT' as const, value: 15, displayLabel: '15%' },
        { type: 'PERCENT' as const, value: 20, displayLabel: '20%' },
      ],
      customTipEnabled: true,
    },
  };

  return {
    regionCode: 'US',
    verified: true,
    ...partial,
    settings: {
      ...defaultSettings,
      ...partial.settings,
      tipConfig: {
        mode: 'OPTIONAL',
        timing: 'POST_PAY',
        presets: [],
        customTipEnabled: false,
        ...partial.settings?.tipConfig,
      },
    },
  };
}

export const MERCHANT_CHECKOUT_SCENARIOS: MerchantCheckoutScenario[] = [
  {
    id: 'qr-dynamic-cafe',
    title: 'In-store QR (Dynamic)',
    description: 'Cafe Sol includes amount in QR. Express checkout with visible merchant label.',
    merchant: merchant({
      merchantId: 'm_cafe_sol',
      name: 'Cafe Sol',
      category: 'CAFE',
      settings: {
        mode: 'EXPRESS',
        modeBadgeVisibility: 'VISIBLE',
        customModeLabel: {
          enabled: true,
          text: 'Quick Pay',
          languageTag: 'en',
          reviewState: 'LIVE_PENDING_MOD_REVIEW',
          autoCheckStatus: 'PASS',
        },
        tipConfig: {
          mode: 'OPTIONAL',
          timing: 'POST_PAY',
          presets: [
            { type: 'PERCENT', value: 10, displayLabel: '10%' },
            { type: 'PERCENT', value: 15, displayLabel: '15%' },
            { type: 'PERCENT', value: 20, displayLabel: '20%' },
          ],
          customTipEnabled: true,
        },
      },
    }),
    entry: {
      entryType: 'QR_DYNAMIC',
      amountMinor: 1250,
      currencyCode: 'USD',
      merchantId: 'm_cafe_sol',
    },
  },
  {
    id: 'qr-static-salon',
    title: 'In-store QR (Static)',
    description: 'Salon QR requires amount entry. Merchant prefers review before payment.',
    merchant: merchant({
      merchantId: 'm_nova_salon',
      name: 'Nova Salon',
      category: 'SERVICES',
      settings: {
        mode: 'REVIEW_REQUIRED',
        modeBadgeVisibility: 'VISIBLE',
        customModeLabel: {
          enabled: true,
          text: 'Review & Confirm',
          languageTag: 'en',
          reviewState: 'APPROVED',
          autoCheckStatus: 'PASS',
        },
        tipConfig: {
          mode: 'CHOICE_REQUIRED',
          timing: 'POST_PAY',
          presets: [
            { type: 'PERCENT', value: 15, displayLabel: '15%' },
            { type: 'PERCENT', value: 20, displayLabel: '20%' },
            { type: 'PERCENT', value: 25, displayLabel: '25%' },
          ],
          customTipEnabled: true,
        },
      },
    }),
    entry: {
      entryType: 'QR_STATIC',
      amountMinor: null,
      currencyCode: 'USD',
      merchantId: 'm_nova_salon',
    },
  },
  {
    id: 'online-retail-link',
    title: 'Online Checkout Link',
    description: 'Retail merchant hides badge and tips are off by default.',
    merchant: merchant({
      merchantId: 'm_market_hub',
      name: 'Market Hub',
      category: 'RETAIL',
      settings: {
        mode: 'EXPRESS',
        modeBadgeVisibility: 'HIDDEN',
        customModeLabel: {
          enabled: true,
          text: 'Pay Instantly',
          languageTag: 'en',
          reviewState: 'APPROVED',
          autoCheckStatus: 'PASS',
        },
        tipConfig: {
          mode: 'OFF',
          timing: 'POST_PAY',
          presets: [],
          customTipEnabled: false,
        },
      },
    }),
    entry: {
      entryType: 'ONLINE_CHECKOUT_LINK',
      amountMinor: 2899,
      currencyCode: 'USD',
      merchantId: 'm_market_hub',
    },
    firstTimeMerchant: true,
  },
  {
    id: 'request-restaurant-link',
    title: 'Merchant Request Link',
    description: 'Restaurant sends a pay request. Merchant keeps mode badge hidden.',
    merchant: merchant({
      merchantId: 'm_oak_table',
      name: 'Oak Table',
      category: 'RESTAURANT',
      settings: {
        mode: 'EXPRESS',
        modeBadgeVisibility: 'HIDDEN',
        customModeLabel: {
          enabled: true,
          text: 'Table Checkout',
          languageTag: 'en',
          reviewState: 'APPROVED',
          autoCheckStatus: 'PASS',
        },
        tipConfig: {
          mode: 'OPTIONAL',
          timing: 'POST_PAY',
          presets: [
            { type: 'PERCENT', value: 15, displayLabel: '15%' },
            { type: 'PERCENT', value: 18, displayLabel: '18%' },
            { type: 'PERCENT', value: 20, displayLabel: '20%' },
          ],
          customTipEnabled: true,
        },
      },
    }),
    entry: {
      entryType: 'MERCHANT_REQUEST_LINK',
      amountMinor: 4635,
      currencyCode: 'USD',
      merchantId: 'm_oak_table',
    },
  },
];

export function getMerchantCheckoutScenarios(entryType?: MerchantCheckoutEntryType | null) {
  if (!entryType) return MERCHANT_CHECKOUT_SCENARIOS;
  return MERCHANT_CHECKOUT_SCENARIOS.filter((s) => s.entry.entryType === entryType);
}

export function getPolicyProfileForMerchant(merchantData: MerchantCheckoutMerchant): MerchantCheckoutPolicyProfile {
  const profile = CATEGORY_POLICY_PROFILES[merchantData.category] ?? CATEGORY_POLICY_PROFILES.OTHER;
  return {
    ...profile,
    regionCode: merchantData.regionCode ?? profile.regionCode,
    category: merchantData.category,
  };
}

export interface ResolveMerchantCheckoutPlanArgs {
  scenario: MerchantCheckoutScenario;
  userPreferences: MerchantCheckoutUserPreferences;
  wallet: MerchantCheckoutWalletSnapshot;
  accessibility: MerchantCheckoutAccessibility;
  overrides?: MerchantCheckoutOverrides;
}

export function resolveMerchantCheckoutPlan({
  scenario,
  userPreferences,
  wallet,
  accessibility,
  overrides,
}: ResolveMerchantCheckoutPlanArgs): MerchantCheckoutPlan {
  const profile = getPolicyProfileForMerchant(scenario.merchant);
  const amountMinor = scenario.entry.amountMinor ?? 0;

  const forceReview =
    overrides?.forceReview ||
    !!scenario.suspiciousPayload ||
    (!!profile.forceReviewOnFirstTimeMerchant && !!scenario.firstTimeMerchant) ||
    (profile.forceReviewAmountThresholdMinor !== null && amountMinor >= profile.forceReviewAmountThresholdMinor) ||
    (profile.forceReviewOnComplexConversion && amountMinor > wallet.icoinsAvailableMinor && amountMinor > 0);

  const resolvedCheckoutMode = forceReview ? 'REVIEW_REQUIRED' : scenario.merchant.settings.mode;

  const screens: CheckoutScreenId[] = [];
  if (scenario.entry.entryType === 'QR_STATIC' && scenario.entry.amountMinor == null) {
    screens.push('ENTER_AMOUNT');
  }
  screens.push('PAYMENT_DETAILS');
  if (resolvedCheckoutMode === 'REVIEW_REQUIRED') screens.push('REVIEW_PAYMENT');
  screens.push('AUTHENTICATE', 'RECEIPT');

  const tipPlan = resolveTipPlan({
    merchant: scenario.merchant,
    profile,
    userPreferences,
    accessibility,
    disableTips: !!overrides?.disableTips,
  });

  if (tipPlan.enabled && tipPlan.timing === 'POST_PAY') {
    screens.push('POST_PAY_TIP');
  }

  const modeBadge = resolveModeBadge({
    merchant: scenario.merchant,
    mode: resolvedCheckoutMode,
    labelLanguage: userPreferences.labelLanguage,
  });

  const paymentSourcePlan = resolvePaymentSourcePlan({
    amountMinor: scenario.entry.amountMinor,
    wallet,
    disableAutoConvert: !!overrides?.disableAutoConvert,
    requiresReview: resolvedCheckoutMode === 'REVIEW_REQUIRED',
  });

  return {
    resolvedCheckoutMode,
    screens,
    modeBadge,
    tipPlan,
    paymentSourcePlan,
    policyProfile: profile,
    analyticsDimensions: {
      entry_type: scenario.entry.entryType,
      qr_type:
        scenario.entry.entryType === 'QR_DYNAMIC'
          ? 'dynamic'
          : scenario.entry.entryType === 'QR_STATIC'
            ? 'static'
            : null,
      merchant_mode: resolvedCheckoutMode,
      mode_visibility: scenario.merchant.settings.modeBadgeVisibility,
      custom_label_used: modeBadge.labelSource === 'MERCHANT_CUSTOM_ORIGINAL',
      tip_mode: tipPlan.mode,
      tip_timing: tipPlan.timing,
      tip_caps_profile: profile.profileType.toLowerCase(),
      tip_prompt_rendered: tipPlan.promptLayoutResolved,
      auto_convert_offered: paymentSourcePlan.autoConvert.offered,
    },
  };
}

function resolveModeBadge(args: {
  merchant: MerchantCheckoutMerchant;
  mode: 'EXPRESS' | 'REVIEW_REQUIRED';
  labelLanguage: LabelLanguagePreference;
}) {
  const { merchant, mode, labelLanguage } = args;
  if (merchant.settings.modeBadgeVisibility === 'HIDDEN') {
    return {
      visible: false,
      labelText: null,
      labelSource: 'NONE' as const,
      showOnScreens: [] as CheckoutScreenId[],
    };
  }

  const customLabel = merchant.settings.customModeLabel;
  const customLabelUsable =
    !!customLabel &&
    customLabel.enabled &&
    customLabel.autoCheckStatus === 'PASS' &&
    customLabel.reviewState !== 'REJECTED_REVERTED' &&
    customLabel.reviewState !== 'SUSPENDED';

  if (labelLanguage === 'MERCHANT_ORIGINAL' && customLabelUsable) {
    return {
      visible: true,
      labelText: customLabel.text,
      labelSource: 'MERCHANT_CUSTOM_ORIGINAL' as const,
      showOnScreens: ['PAYMENT_DETAILS', 'REVIEW_PAYMENT'] as CheckoutScreenId[],
    };
  }

  return {
    visible: true,
    labelText: getPlatformFallbackModeLabel(mode),
    labelSource: 'PLATFORM_FALLBACK_TRANSLATED' as const,
    showOnScreens: ['PAYMENT_DETAILS', 'REVIEW_PAYMENT'] as CheckoutScreenId[],
  };
}

function resolveTipPlan(args: {
  merchant: MerchantCheckoutMerchant;
  profile: MerchantCheckoutPolicyProfile;
  userPreferences: MerchantCheckoutUserPreferences;
  accessibility: MerchantCheckoutAccessibility;
  disableTips: boolean;
}) {
  if (args.disableTips || args.merchant.settings.tipConfig.mode === 'OFF') {
    return {
      enabled: false,
      mode: 'OFF' as const,
      timing: null,
      presets: [] as MerchantTipPreset[],
      customTipEnabled: false,
      includeNoTip: true as const,
      promptLayoutResolved: null,
      capsApplied: false,
    };
  }

  let presets = args.merchant.settings.tipConfig.presets.slice();
  let capsApplied = false;
  if (args.profile.tipCapsDefaultEnabled) {
    presets = presets.filter((preset) => {
      if (preset.type === 'PERCENT' && args.profile.maxTipPercent != null) {
        return preset.value <= args.profile.maxTipPercent;
      }
      if (preset.type === 'FLAT_MINOR' && args.profile.maxTipFlatMinor != null) {
        return preset.value <= args.profile.maxTipFlatMinor;
      }
      return true;
    });
    capsApplied = presets.length !== args.merchant.settings.tipConfig.presets.length;
  }

  return {
    enabled: true,
    mode: args.merchant.settings.tipConfig.mode,
    timing: args.merchant.settings.tipConfig.timing,
    presets,
    customTipEnabled: args.merchant.settings.tipConfig.customTipEnabled,
    includeNoTip: true as const,
    promptLayoutResolved:
      args.merchant.settings.tipConfig.timing === 'POST_PAY'
        ? resolveTipPromptLayout(args.merchant.category, args.userPreferences, args.accessibility)
        : null,
    capsApplied,
  };
}

export function resolveTipPromptLayout(
  category: MerchantCategory,
  userPreferences: MerchantCheckoutUserPreferences,
  accessibility: MerchantCheckoutAccessibility
): TipPromptLayout {
  if (accessibility.screenReader || accessibility.largeText) return 'FULL_SCREEN';
  return userPreferences.tipPromptLayoutByCategory[category] ?? userPreferences.tipPromptLayoutGlobal ?? 'AUTO';
}

function resolvePaymentSourcePlan(args: {
  amountMinor: number | null;
  wallet: MerchantCheckoutWalletSnapshot;
  disableAutoConvert: boolean;
  requiresReview: boolean;
}) {
  const amountMinor = args.amountMinor ?? 0;
  const shortfall = Math.max(0, amountMinor - args.wallet.icoinsAvailableMinor);
  if (args.disableAutoConvert || !amountMinor || shortfall <= 0) {
    return {
      defaultSource: 'ICOINS' as const,
      autoConvert: {
        offered: false,
        eligible: false,
        requiresReviewDetails: false,
        ctaLabel: null,
        vicoinsNeeded: null,
        icoinsNeededMinor: null,
        conversionFeeMinor: null,
      },
    };
  }

  const fee = args.wallet.exchangeRate.conversionFeeMinor;
  const vicoinsNeeded = calcVicoinsNeeded(shortfall, args.wallet.exchangeRate.vicoinsPerIcoinMinorUnit, fee);
  const eligible = args.wallet.vicoinsAvailable >= vicoinsNeeded;
  return {
    defaultSource: 'ICOINS' as const,
    autoConvert: {
      offered: true,
      eligible,
      requiresReviewDetails: args.requiresReview,
      ctaLabel: eligible ? 'Auto-convert and pay' : 'Review conversion details',
      vicoinsNeeded,
      icoinsNeededMinor: shortfall,
      conversionFeeMinor: fee,
    },
  };
}

export function calcVicoinsNeeded(
  icoinsShortfallMinor: number,
  vicoinsPerIcoinMinorUnit: number = DEFAULT_EXCHANGE_RATE.vicoinsPerIcoinMinorUnit,
  conversionFeeMinor: number = DEFAULT_EXCHANGE_RATE.conversionFeeMinor
) {
  return Math.ceil((icoinsShortfallMinor + conversionFeeMinor) * vicoinsPerIcoinMinorUnit);
}

export function calculateQuote(args: {
  scenario: MerchantCheckoutScenario;
  plan: MerchantCheckoutPlan;
  draft: MerchantCheckoutDraftState;
  wallet: MerchantCheckoutWalletSnapshot;
}) {
  const amountMinor = Math.max(0, args.draft.enteredAmountMinor ?? args.scenario.entry.amountMinor ?? 0);
  const prePayTipMinor =
    args.plan.tipPlan.enabled && args.plan.tipPlan.timing === 'PRE_PAY'
      ? resolveTipSelectionMinor(args.draft.prePayTipSelection, args.plan.tipPlan.presets, amountMinor)
      : 0;
  const feesMinor = 0;
  const totalMinor = amountMinor + prePayTipMinor + feesMinor;
  const shortfall = Math.max(0, totalMinor - args.wallet.icoinsAvailableMinor);
  const conversionFeeMinor =
    args.draft.paymentSourceSelection === 'AUTO_CONVERT' && shortfall > 0
      ? args.wallet.exchangeRate.conversionFeeMinor
      : 0;
  const autoConvertVicoinsNeeded =
    args.draft.paymentSourceSelection === 'AUTO_CONVERT' && shortfall > 0
      ? calcVicoinsNeeded(
          shortfall,
          args.wallet.exchangeRate.vicoinsPerIcoinMinorUnit,
          args.wallet.exchangeRate.conversionFeeMinor
        )
      : 0;

  const finalTotalMinor = totalMinor + conversionFeeMinor;
  const quote: MerchantCheckoutQuote = {
    amountMinor,
    tipMinor: prePayTipMinor,
    feesMinor,
    totalMinor: finalTotalMinor,
    currencyCode: args.scenario.entry.currencyCode,
    conversionFeeMinor,
    autoConvertShortfallMinor: shortfall,
    autoConvertVicoinsNeeded,
  };

  const autoConvertEligible = autoConvertVicoinsNeeded > 0 ? args.wallet.vicoinsAvailable >= autoConvertVicoinsNeeded : true;

  return { quote, autoConvertEligible };
}

export function resolveTipSelectionMinor(
  selection: TipSelection,
  presets: MerchantTipPreset[],
  amountMinor: number
) {
  if (selection.kind === 'NONE') return 0;
  if (selection.kind === 'CUSTOM') return Math.max(0, Math.floor(selection.amountMinor));
  const preset = presets[selection.presetIndex];
  if (!preset) return 0;
  if (preset.type === 'PERCENT') return Math.round((amountMinor * preset.value) / 100);
  return Math.max(0, Math.floor(preset.value));
}

export function getPlatformFallbackModeLabel(mode: 'EXPRESS' | 'REVIEW_REQUIRED') {
  return mode === 'EXPRESS' ? 'Fast Checkout' : 'Review Before Pay';
}

export function formatCurrencyMinor(amountMinor: number, currencyCode = 'USD') {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currencyCode,
  }).format(amountMinor / 100);
}

export function getScenarioById(id: string) {
  return MERCHANT_CHECKOUT_SCENARIOS.find((s) => s.id === id) ?? null;
}

function parseAmountToMinor(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  if (/^\d+$/.test(value)) {
    const intVal = Number.parseInt(value, 10);
    return Number.isFinite(intVal) ? intVal : null;
  }
  const normalized = value.replace(/[$,\s]/g, '');
  const floatVal = Number.parseFloat(normalized);
  if (!Number.isFinite(floatVal)) return null;
  return Math.max(0, Math.round(floatVal * 100));
}

function normalizeEntryType(raw: string | null | undefined): MerchantCheckoutEntryType | null {
  if (!raw) return null;
  const normalized = raw.trim().toUpperCase().replace(/[-\s]/g, '_');
  if (normalized === 'QR' || normalized === 'QR_CODE') return 'QR_DYNAMIC';
  if (normalized === 'QR_DYNAMIC') return 'QR_DYNAMIC';
  if (normalized === 'QR_STATIC') return 'QR_STATIC';
  if (normalized === 'ONLINE_CHECKOUT_LINK' || normalized === 'ONLINE_LINK') return 'ONLINE_CHECKOUT_LINK';
  if (normalized === 'MERCHANT_REQUEST_LINK' || normalized === 'REQUEST_LINK') return 'MERCHANT_REQUEST_LINK';
  return null;
}

function pickScenarioIdFromHints(hints: {
  scenarioId?: string | null;
  merchantId?: string | null;
  normalizedRaw?: string;
}): string | null {
  if (hints.scenarioId && getScenarioById(hints.scenarioId)) return hints.scenarioId;

  if (hints.merchantId) {
    const direct = MERCHANT_CHECKOUT_SCENARIOS.find((s) => s.merchant.merchantId === hints.merchantId);
    if (direct) return direct.id;
  }

  const normalized = hints.normalizedRaw ?? '';
  if (!normalized) return null;
  if (normalized.includes('cafe') || normalized.includes('sol')) return 'qr-dynamic-cafe';
  if (normalized.includes('salon') || normalized.includes('nova')) return 'qr-static-salon';
  if (normalized.includes('retail') || normalized.includes('market') || normalized.includes('hub')) return 'online-retail-link';
  if (normalized.includes('request') || normalized.includes('oak') || normalized.includes('table')) return 'request-restaurant-link';
  if (normalized.includes('qr')) return 'qr-dynamic-cafe';
  return null;
}

export interface ParsedMerchantCheckoutEntryInput {
  type: MerchantCheckoutEntryType | null;
  scenarioId: string | null;
  merchantId: string | null;
  amountMinor: number | null;
  currencyCode: string | null;
  source: 'URL' | 'CUSTOM_SCHEME' | 'JSON' | 'KV' | 'TOKEN' | 'UNKNOWN';
}

export function parseMerchantCheckoutEntryInput(raw: string): ParsedMerchantCheckoutEntryInput {
  const input = raw.trim();
  const normalized = input.toLowerCase();
  if (!input) {
    return {
      type: null,
      scenarioId: null,
      merchantId: null,
      amountMinor: null,
      currencyCode: null,
      source: 'UNKNOWN',
    };
  }

  if (input.startsWith('{') && input.endsWith('}')) {
    try {
      const parsed = JSON.parse(input) as Record<string, unknown>;
      const scenarioId = typeof parsed.scenarioId === 'string' ? parsed.scenarioId : typeof parsed.scenario === 'string' ? parsed.scenario : null;
      const merchantId =
        typeof parsed.merchantId === 'string'
          ? parsed.merchantId
          : typeof parsed.merchant === 'string'
            ? parsed.merchant
            : null;
      const amountMinor =
        typeof parsed.amountMinor === 'number'
          ? Math.round(parsed.amountMinor)
          : parseAmountToMinor(typeof parsed.amount === 'string' ? parsed.amount : parsed.amount != null ? String(parsed.amount) : null);
      const type = normalizeEntryType(
        typeof parsed.entryType === 'string'
          ? parsed.entryType
          : typeof parsed.type === 'string'
            ? parsed.type
            : null
      );
      const currencyCode =
        typeof parsed.currencyCode === 'string'
          ? parsed.currencyCode.toUpperCase()
          : typeof parsed.currency === 'string'
            ? parsed.currency.toUpperCase()
            : null;
      return {
        type,
        scenarioId: pickScenarioIdFromHints({ scenarioId, merchantId, normalizedRaw: normalized }),
        merchantId,
        amountMinor,
        currencyCode,
        source: 'JSON',
      };
    } catch {
      // fall through to other parsers
    }
  }

  try {
    const asUrl = new URL(input);
    const params = asUrl.searchParams;
    const scenarioId = params.get('scenarioId') ?? params.get('scenario');
    const merchantId = params.get('merchantId') ?? params.get('merchant');
    const type = normalizeEntryType(params.get('entryType') ?? params.get('type'));
    const amountMinor =
      parseAmountToMinor(params.get('amountMinor')) ??
      parseAmountToMinor(params.get('amount'));
    const currencyCode = (params.get('currencyCode') ?? params.get('currency'))?.toUpperCase() ?? null;

    return {
      type,
      scenarioId: pickScenarioIdFromHints({ scenarioId, merchantId, normalizedRaw: normalized }),
      merchantId,
      amountMinor,
      currencyCode,
      source: asUrl.protocol === 'http:' || asUrl.protocol === 'https:' ? 'URL' : 'CUSTOM_SCHEME',
    };
  } catch {
    // not a URL
  }

  if (normalized.includes('merchant=') || normalized.includes('merchantid=') || normalized.includes('amount=')) {
    const parts = input.split(/[;&\n]+/).map((p) => p.trim()).filter(Boolean);
    const kv = new Map<string, string>();
    for (const part of parts) {
      const [rawKey, ...rest] = part.split('=');
      if (!rawKey || rest.length === 0) continue;
      kv.set(rawKey.trim().toLowerCase(), rest.join('=').trim());
    }
    const scenarioId = kv.get('scenarioid') ?? kv.get('scenario') ?? null;
    const merchantId = kv.get('merchantid') ?? kv.get('merchant') ?? null;
    const type = normalizeEntryType(kv.get('entrytype') ?? kv.get('type') ?? null);
    const amountMinor = parseAmountToMinor(kv.get('amountminor') ?? kv.get('amount') ?? null);
    const currencyCode = (kv.get('currencycode') ?? kv.get('currency') ?? null)?.toUpperCase() ?? null;
    return {
      type,
      scenarioId: pickScenarioIdFromHints({ scenarioId, merchantId, normalizedRaw: normalized }),
      merchantId,
      amountMinor,
      currencyCode,
      source: 'KV',
    };
  }

  const scenarioId = pickScenarioIdFromHints({ normalizedRaw: normalized });
  return {
    type:
      normalized.includes('request')
        ? 'MERCHANT_REQUEST_LINK'
        : normalized.includes('static')
          ? 'QR_STATIC'
          : normalized.includes('online') || normalized.includes('link')
            ? 'ONLINE_CHECKOUT_LINK'
            : normalized.includes('qr')
              ? 'QR_DYNAMIC'
              : null,
    scenarioId,
    merchantId: null,
    amountMinor: null,
    currencyCode: null,
    source: 'TOKEN',
  };
}

export function buildScenarioFromParsedEntryInput(raw: string): MerchantCheckoutScenario | null {
  const parsed = parseMerchantCheckoutEntryInput(raw);
  const base = parsed.scenarioId ? getScenarioById(parsed.scenarioId) : null;
  if (!base) return null;

  return {
    ...base,
    entry: {
      ...base.entry,
      entryType: parsed.type ?? base.entry.entryType,
      amountMinor: parsed.amountMinor != null ? parsed.amountMinor : base.entry.amountMinor,
      currencyCode: parsed.currencyCode ?? base.entry.currencyCode,
      merchantId: parsed.merchantId ?? base.entry.merchantId,
    },
  };
}

export function parseDemoEntryInput(raw: string): { type: MerchantCheckoutEntryType | null; scenarioId: string | null } {
  const parsed = parseMerchantCheckoutEntryInput(raw);
  return {
    type: parsed.type,
    scenarioId: parsed.scenarioId,
  };
}
