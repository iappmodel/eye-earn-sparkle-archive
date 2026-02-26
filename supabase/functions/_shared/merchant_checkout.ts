import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  calculateQuote,
  resolveMerchantCheckoutPlan,
  resolveTipSelectionMinor,
} from "../../../src/features/merchantCheckout/mockResolver.ts";
import type {
  MerchantCheckoutAccessibility,
  MerchantCheckoutDraftState,
  MerchantCheckoutPlan,
  MerchantCheckoutScenario,
  MerchantCheckoutUserPreferences,
  MerchantCheckoutWalletSnapshot,
  TipSelection,
} from "../../../src/features/merchantCheckout/types.ts";

const SESSION_TTL_MS = 30 * 60 * 1000;

export interface MerchantCheckoutPreferencesRecord {
  hasChosenLabelLanguage: boolean;
  labelLanguage: MerchantCheckoutUserPreferences["labelLanguage"];
  tipPromptLayoutGlobal: MerchantCheckoutUserPreferences["tipPromptLayoutGlobal"];
  tipPromptLayoutByCategory: MerchantCheckoutUserPreferences["tipPromptLayoutByCategory"];
  autoConvertPreferenceEnabled: boolean;
  version: number;
}

export interface CheckoutSessionRecord {
  checkoutSessionId: string;
  scenario: MerchantCheckoutScenario;
  plan: MerchantCheckoutPlan;
  draft: MerchantCheckoutDraftState;
  quote: ReturnType<typeof calculateQuote>["quote"];
  wallet: MerchantCheckoutWalletSnapshot;
  userPreferences: MerchantCheckoutUserPreferences;
  accessibility: MerchantCheckoutAccessibility;
  paymentId?: string;
  transactionId?: string;
}

export function createServiceRoleClient() {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key);
}

export async function requireUserId(supabase: ReturnType<typeof createServiceRoleClient>, req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new HttpError(401, "Unauthorized");
  }
  const token = authHeader.slice("Bearer ".length);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    throw new HttpError(401, "Unauthorized");
  }
  return data.user.id;
}

export function jsonResponse(
  headers: Record<string, string>,
  body: unknown,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return await req.json() as T;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function makeId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 14)}`;
}

export function makeDefaults(): MerchantCheckoutPreferencesRecord {
  return {
    hasChosenLabelLanguage: false,
    labelLanguage: "TRANSLATED_FALLBACK",
    tipPromptLayoutGlobal: "AUTO",
    tipPromptLayoutByCategory: {},
    autoConvertPreferenceEnabled: false,
    version: 1,
  };
}

export function clampPreferences(input: Partial<MerchantCheckoutPreferencesRecord> | null | undefined) {
  const defaults = makeDefaults();
  const merged = {
    ...defaults,
    ...(input ?? {}),
  } as MerchantCheckoutPreferencesRecord;
  return {
    ...merged,
    tipPromptLayoutByCategory:
      typeof merged.tipPromptLayoutByCategory === "object" && merged.tipPromptLayoutByCategory
        ? merged.tipPromptLayoutByCategory
        : {},
    version: Number.isFinite(merged.version) && merged.version > 0 ? Math.floor(merged.version) : defaults.version,
  };
}

export function resolveSession(args: {
  scenario: MerchantCheckoutScenario;
  userPreferences: MerchantCheckoutUserPreferences;
  wallet: MerchantCheckoutWalletSnapshot;
  accessibility: MerchantCheckoutAccessibility;
}): CheckoutSessionRecord {
  const plan = resolveMerchantCheckoutPlan({
    scenario: args.scenario,
    userPreferences: args.userPreferences,
    wallet: args.wallet,
    accessibility: args.accessibility,
  });

  const draft: MerchantCheckoutDraftState = {
    enteredAmountMinor: args.scenario.entry.amountMinor,
    paymentSourceSelection: args.userPreferences.autoConvertPreferenceEnabled ? "AUTO_CONVERT" : "ICOINS",
    prePayTipSelection: { kind: "NONE" },
  };

  const quoteCalc = calculateQuote({
    scenario: args.scenario,
    plan,
    draft,
    wallet: args.wallet,
  });

  return {
    checkoutSessionId: makeId("chk"),
    scenario: args.scenario,
    plan,
    draft,
    quote: quoteCalc.quote,
    wallet: args.wallet,
    userPreferences: args.userPreferences,
    accessibility: args.accessibility,
  };
}

export function patchSessionDraft(args: {
  record: CheckoutSessionRecord;
  draft: MerchantCheckoutDraftState;
  userPreferences: MerchantCheckoutUserPreferences;
  accessibility: MerchantCheckoutAccessibility;
}) {
  const nextScenario: MerchantCheckoutScenario = {
    ...args.record.scenario,
    entry: {
      ...args.record.scenario.entry,
      amountMinor: args.draft.enteredAmountMinor ?? args.record.scenario.entry.amountMinor,
    },
  };

  const nextPlan = resolveMerchantCheckoutPlan({
    scenario: nextScenario,
    userPreferences: args.userPreferences,
    wallet: args.record.wallet,
    accessibility: args.accessibility,
  });

  const quoteCalc = calculateQuote({
    scenario: nextScenario,
    plan: nextPlan,
    draft: args.draft,
    wallet: args.record.wallet,
  });

  const nextRecord: CheckoutSessionRecord = {
    ...args.record,
    scenario: nextScenario,
    plan: nextPlan,
    draft: args.draft,
    quote: quoteCalc.quote,
    userPreferences: args.userPreferences,
    accessibility: args.accessibility,
  };

  return { nextRecord, autoConvertEligible: quoteCalc.autoConvertEligible };
}

export function buildConfirmReceipt(record: CheckoutSessionRecord, authMethod: "FACE_ID" | "PIN") {
  const paymentId = makeId("pay");
  const transactionId = makeId("txn");
  const receipt = {
    transactionId,
    amountMinor: record.quote.amountMinor,
    tipMinor: record.quote.tipMinor,
    feesMinor: record.quote.feesMinor + record.quote.conversionFeeMinor,
    totalMinor: record.quote.totalMinor,
    currencyCode: record.quote.currencyCode,
    paidWith: record.draft.paymentSourceSelection,
    merchantName: record.scenario.merchant.name,
    createdAt: new Date().toISOString(),
    authMethod,
  } as const;
  return { paymentId, transactionId, receipt };
}

export function buildTipResult(record: CheckoutSessionRecord, selection: TipSelection) {
  const tipAmountMinor = resolveTipSelectionMinor(
    selection,
    record.plan.tipPlan.presets,
    record.quote.amountMinor,
  );
  return {
    tipAmountMinor,
    currencyCode: record.quote.currencyCode,
    tipId: makeId("tip"),
    transactionId: makeId("txn"),
  };
}

export async function saveCheckoutSession(
  supabase: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  record: CheckoutSessionRecord,
) {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const { error } = await supabase.from("merchant_checkout_sessions").upsert({
    id: record.checkoutSessionId,
    user_id: userId,
    session_data: record,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new HttpError(500, error.message || "Failed to save checkout session");
  return expiresAt;
}

export async function loadCheckoutSession(
  supabase: ReturnType<typeof createServiceRoleClient>,
  userId: string,
  checkoutSessionId: string,
) {
  const { data, error } = await supabase
    .from("merchant_checkout_sessions")
    .select("session_data, expires_at")
    .eq("id", checkoutSessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new HttpError(500, error.message || "Failed to load checkout session");
  if (!data?.session_data) throw new HttpError(404, "Checkout session not found");

  const expiresAt = new Date(String(data.expires_at ?? 0)).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    throw new HttpError(410, "Checkout session expired");
  }

  return data.session_data as CheckoutSessionRecord;
}

export async function loadCheckoutPreferences(
  supabase: ReturnType<typeof createServiceRoleClient>,
  userId: string,
) {
  const { data, error } = await supabase
    .from("merchant_checkout_preferences")
    .select(
      "has_chosen_label_language, label_language, tip_prompt_layout_global, tip_prompt_layout_by_category, auto_convert_preference_enabled, version",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new HttpError(500, error.message || "Failed to load checkout preferences");
  if (!data) return makeDefaults();
  return clampPreferences({
    hasChosenLabelLanguage: Boolean(data.has_chosen_label_language),
    labelLanguage: data.label_language as MerchantCheckoutPreferencesRecord["labelLanguage"],
    tipPromptLayoutGlobal: data.tip_prompt_layout_global as MerchantCheckoutPreferencesRecord["tipPromptLayoutGlobal"],
    tipPromptLayoutByCategory: (data.tip_prompt_layout_by_category ?? {}) as MerchantCheckoutPreferencesRecord["tipPromptLayoutByCategory"],
    autoConvertPreferenceEnabled: Boolean(data.auto_convert_preference_enabled),
    version: Number(data.version ?? 1),
  });
}

export async function saveCheckoutPreferences(args: {
  supabase: ReturnType<typeof createServiceRoleClient>;
  userId: string;
  incoming: MerchantCheckoutPreferencesRecord;
  expectedVersion?: number | null;
}) {
  const { supabase, userId } = args;
  const incoming = clampPreferences(args.incoming);
  const { data: currentRow, error: currentError } = await supabase
    .from("merchant_checkout_preferences")
    .select("version")
    .eq("user_id", userId)
    .maybeSingle();
  if (currentError) throw new HttpError(500, currentError.message || "Failed to load checkout preferences");

  const rowExists = !!currentRow;
  const currentVersion = rowExists ? Number(currentRow.version ?? 1) : 1;
  if (typeof args.expectedVersion === "number" && currentVersion !== args.expectedVersion) {
    throw new HttpError(409, "VERSION_CONFLICT");
  }

  const nextVersion = rowExists ? currentVersion + 1 : 1;
  const nowIso = new Date().toISOString();
  const row = {
    user_id: userId,
    has_chosen_label_language: incoming.hasChosenLabelLanguage,
    label_language: incoming.labelLanguage,
    tip_prompt_layout_global: incoming.tipPromptLayoutGlobal,
    tip_prompt_layout_by_category: incoming.tipPromptLayoutByCategory,
    auto_convert_preference_enabled: incoming.autoConvertPreferenceEnabled,
    version: nextVersion,
    updated_at: nowIso,
  };

  const { error } = await supabase.from("merchant_checkout_preferences").upsert(row);
  if (error) throw new HttpError(500, error.message || "Failed to save checkout preferences");

  return {
    ...incoming,
    version: nextVersion,
  };
}
