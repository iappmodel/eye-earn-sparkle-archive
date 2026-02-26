export type MerchantCheckoutEntryType =
  | 'QR_DYNAMIC'
  | 'QR_STATIC'
  | 'ONLINE_CHECKOUT_LINK'
  | 'MERCHANT_REQUEST_LINK';

export type MerchantCheckoutMode = 'EXPRESS' | 'REVIEW_REQUIRED';
export type MerchantModeBadgeVisibility = 'VISIBLE' | 'HIDDEN';
export type MerchantTipMode = 'OFF' | 'OPTIONAL' | 'CHOICE_REQUIRED';
export type MerchantTipTiming = 'PRE_PAY' | 'POST_PAY';
export type TipPresetType = 'PERCENT' | 'FLAT_MINOR';
export type TipPromptLayout = 'AUTO' | 'BOTTOM_SHEET' | 'FULL_SCREEN';
export type LabelLanguagePreference = 'MERCHANT_ORIGINAL' | 'TRANSLATED_FALLBACK';
export type PolicyProfileType = 'STRICT' | 'FLEXIBLE' | 'OPEN';

export type MerchantCategory =
  | 'RESTAURANT'
  | 'CAFE'
  | 'BAR_NIGHTLIFE'
  | 'RETAIL'
  | 'SERVICES'
  | 'DELIVERY_COURIER'
  | 'TRANSPORTATION'
  | 'PROFESSIONAL_SERVICES'
  | 'EVENTS_ENTERTAINMENT'
  | 'OTHER';

export type CheckoutScreenId =
  | 'ENTER_AMOUNT'
  | 'PAYMENT_DETAILS'
  | 'REVIEW_PAYMENT'
  | 'AUTHENTICATE'
  | 'RECEIPT'
  | 'POST_PAY_TIP';

export type TipSelection =
  | { kind: 'NONE' }
  | { kind: 'PRESET'; presetIndex: number }
  | { kind: 'CUSTOM'; amountMinor: number };

export interface MerchantTipPreset {
  type: TipPresetType;
  value: number;
  displayLabel: string;
}

export interface MerchantTipConfig {
  mode: MerchantTipMode;
  timing: MerchantTipTiming;
  presets: MerchantTipPreset[];
  customTipEnabled: boolean;
}

export interface MerchantCustomLabel {
  enabled: boolean;
  text: string;
  languageTag: string;
  reviewState: 'APPROVED' | 'LIVE_PENDING_MOD_REVIEW' | 'REJECTED_REVERTED' | 'SUSPENDED';
  autoCheckStatus: 'PASS' | 'FAIL';
}

export interface MerchantCheckoutSettings {
  mode: MerchantCheckoutMode;
  modeBadgeVisibility: MerchantModeBadgeVisibility;
  customModeLabel?: MerchantCustomLabel;
  tipConfig: MerchantTipConfig;
}

export interface MerchantCheckoutMerchant {
  merchantId: string;
  name: string;
  category: MerchantCategory;
  regionCode: string;
  verified: boolean;
  settings: MerchantCheckoutSettings;
}

export interface MerchantCheckoutEntry {
  entryType: MerchantCheckoutEntryType;
  amountMinor: number | null;
  currencyCode: string;
  merchantId: string;
}

export interface MerchantCheckoutScenario {
  id: string;
  title: string;
  description: string;
  merchant: MerchantCheckoutMerchant;
  entry: MerchantCheckoutEntry;
  firstTimeMerchant?: boolean;
  suspiciousPayload?: boolean;
}

export interface MerchantCheckoutUserPreferences {
  labelLanguage: LabelLanguagePreference;
  tipPromptLayoutGlobal: TipPromptLayout;
  tipPromptLayoutByCategory: Partial<Record<MerchantCategory, TipPromptLayout>>;
  autoConvertPreferenceEnabled: boolean;
}

export interface MerchantCheckoutAccessibility {
  screenReader: boolean;
  largeText: boolean;
  reducedMotion: boolean;
}

export interface MerchantCheckoutWalletSnapshot {
  icoinsAvailableMinor: number;
  vicoinsAvailable: number;
  exchangeRate: {
    vicoinsPerIcoinMinorUnit: number;
    conversionFeeMinor: number;
  };
}

export interface MerchantCheckoutPolicyProfile {
  profileType: PolicyProfileType;
  category: MerchantCategory;
  regionCode: string;
  forceReviewAmountThresholdMinor: number | null;
  forceReviewOnFirstTimeMerchant: boolean;
  forceReviewOnComplexConversion: boolean;
  tipCapsDefaultEnabled: boolean;
  maxTipPercent: number | null;
  maxTipFlatMinor: number | null;
}

export interface MerchantCheckoutOverrides {
  forceReview?: boolean;
  disableTips?: boolean;
  disableAutoConvert?: boolean;
}

export interface ResolvedModeBadge {
  visible: boolean;
  labelText: string | null;
  labelSource: 'MERCHANT_CUSTOM_ORIGINAL' | 'PLATFORM_FALLBACK_TRANSLATED' | 'NONE';
  showOnScreens: CheckoutScreenId[];
}

export interface ResolvedTipPlan {
  enabled: boolean;
  mode: MerchantTipMode;
  timing: MerchantTipTiming | null;
  presets: MerchantTipPreset[];
  customTipEnabled: boolean;
  includeNoTip: true;
  promptLayoutResolved: TipPromptLayout | null;
  capsApplied: boolean;
}

export interface ResolvedAutoConvertPlan {
  offered: boolean;
  eligible: boolean;
  requiresReviewDetails: boolean;
  ctaLabel: string | null;
  vicoinsNeeded: number | null;
  icoinsNeededMinor: number | null;
  conversionFeeMinor: number | null;
}

export interface ResolvedPaymentSourcePlan {
  defaultSource: 'ICOINS';
  autoConvert: ResolvedAutoConvertPlan;
}

export interface MerchantCheckoutPlan {
  resolvedCheckoutMode: MerchantCheckoutMode;
  screens: CheckoutScreenId[];
  modeBadge: ResolvedModeBadge;
  tipPlan: ResolvedTipPlan;
  paymentSourcePlan: ResolvedPaymentSourcePlan;
  policyProfile: MerchantCheckoutPolicyProfile;
  analyticsDimensions: Record<string, string | number | boolean | null>;
}

export interface MerchantCheckoutQuote {
  amountMinor: number;
  tipMinor: number;
  feesMinor: number;
  totalMinor: number;
  currencyCode: string;
  conversionFeeMinor: number;
  autoConvertShortfallMinor: number;
  autoConvertVicoinsNeeded: number;
}

export interface MerchantCheckoutDraftState {
  enteredAmountMinor: number | null;
  paymentSourceSelection: 'ICOINS' | 'AUTO_CONVERT';
  prePayTipSelection: TipSelection;
}

export type TipInteractionEventKind = 'UNCHANGED' | 'CHANGED' | 'SKIPPED';
