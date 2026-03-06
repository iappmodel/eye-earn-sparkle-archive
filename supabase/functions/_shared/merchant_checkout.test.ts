import {
  assert,
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.190.0/testing/asserts.ts";

import {
  buildConfirmReceipt,
  buildTipResult,
  clampPreferences,
  getIdempotentCheckoutResponse,
  makeDefaults,
  patchSessionDraft,
  resolveSession,
  saveIdempotentCheckoutResponse,
} from "./merchant_checkout.ts";
import { getMerchantCheckoutScenarios } from "../../../src/features/merchantCheckout/mockResolver.ts";
import type {
  MerchantCheckoutAccessibility,
  MerchantCheckoutUserPreferences,
  MerchantCheckoutWalletSnapshot,
} from "../../../src/features/merchantCheckout/types.ts";

function makeWalletSnapshot(): MerchantCheckoutWalletSnapshot {
  return {
    icoinsAvailableMinor: 2_500,
    vicoinsAvailable: 20_000,
    exchangeRate: {
      vicoinsPerIcoinMinorUnit: 0.1,
      conversionFeeMinor: 25,
    },
  };
}

function makeAccessibility(): MerchantCheckoutAccessibility {
  return {
    screenReader: false,
    largeText: false,
    reducedMotion: false,
  };
}

function makePreferences(autoConvertPreferenceEnabled = false): MerchantCheckoutUserPreferences {
  return {
    labelLanguage: "TRANSLATED_FALLBACK",
    tipPromptLayoutGlobal: "AUTO",
    tipPromptLayoutByCategory: {},
    autoConvertPreferenceEnabled,
  };
}

Deno.test("merchant_checkout shared: defaults + clamp preferences", () => {
  const defaults = makeDefaults();
  assertEquals(defaults.hasChosenLabelLanguage, false);
  assertEquals(defaults.labelLanguage, "TRANSLATED_FALLBACK");
  assertEquals(defaults.tipPromptLayoutGlobal, "AUTO");
  assertEquals(defaults.version, 1);

  const clamped = clampPreferences({
    version: -9,
    tipPromptLayoutByCategory: null,
  } as unknown as Partial<ReturnType<typeof makeDefaults>>);

  assertEquals(clamped.version, 1);
  assertEquals(clamped.tipPromptLayoutByCategory, {});
});

Deno.test("merchant_checkout shared: resolveSession honors auto-convert preference", () => {
  const scenario = getMerchantCheckoutScenarios("QR_DYNAMIC")[0];
  const session = resolveSession({
    scenario,
    userPreferences: makePreferences(true),
    wallet: makeWalletSnapshot(),
    accessibility: makeAccessibility(),
  });

  assert(session.checkoutSessionId.startsWith("chk_"));
  assertEquals(session.draft.paymentSourceSelection, "AUTO_CONVERT");
  assertEquals(session.plan.screens[0], "PAYMENT_DETAILS");
  assertEquals(session.scenario.id, scenario.id);
});

Deno.test("merchant_checkout shared: patchSessionDraft updates static amount", () => {
  const scenario = getMerchantCheckoutScenarios("QR_STATIC")[0];
  const session = resolveSession({
    scenario,
    userPreferences: makePreferences(false),
    wallet: makeWalletSnapshot(),
    accessibility: makeAccessibility(),
  });

  const originalAmount = session.quote.amountMinor;
  const { nextRecord } = patchSessionDraft({
    record: session,
    draft: {
      ...session.draft,
      enteredAmountMinor: 1_234,
    },
    userPreferences: makePreferences(false),
    accessibility: makeAccessibility(),
  });

  assertEquals(nextRecord.scenario.entry.amountMinor, 1_234);
  assertEquals(nextRecord.quote.amountMinor, 1_234);
  assertNotEquals(nextRecord.quote.amountMinor, originalAmount);
});

Deno.test("merchant_checkout shared: buildConfirmReceipt reflects quote totals", () => {
  const scenario = getMerchantCheckoutScenarios("ONLINE_CHECKOUT_LINK")[0];
  const session = resolveSession({
    scenario,
    userPreferences: makePreferences(false),
    wallet: makeWalletSnapshot(),
    accessibility: makeAccessibility(),
  });

  const built = buildConfirmReceipt(session, "FACE_ID");
  assert(built.paymentId.startsWith("pay_"));
  assert(built.transactionId.startsWith("txn_"));
  assertEquals(built.receipt.amountMinor, session.quote.amountMinor);
  assertEquals(built.receipt.totalMinor, session.quote.totalMinor);
  assertEquals(built.receipt.authMethod, "FACE_ID");
});

Deno.test("merchant_checkout shared: buildTipResult none selection returns zero", () => {
  const scenario = getMerchantCheckoutScenarios("MERCHANT_REQUEST_LINK")[0];
  const session = resolveSession({
    scenario,
    userPreferences: makePreferences(false),
    wallet: makeWalletSnapshot(),
    accessibility: makeAccessibility(),
  });

  const result = buildTipResult(session, { kind: "NONE" });
  assertEquals(result.tipAmountMinor, 0);
  assert(result.tipId.startsWith("tip_"));
  assert(result.transactionId.startsWith("txn_"));
});

Deno.test("merchant_checkout shared: getIdempotentCheckoutResponse returns cached body", async () => {
  const supabase = {
    from: (_table: string) => ({
      select: (_cols: string) => ({
        eq: (_colA: string, _valA: unknown) => ({
          eq: (_colB: string, _valB: unknown) => ({
            eq: (_colC: string, _valC: unknown) => ({
              maybeSingle: async () => ({
                data: {
                  response_status: 200,
                  response_body: { checkoutSessionId: "chk_1", paymentId: "pay_1" },
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    }),
  } as any;

  const cached = await getIdempotentCheckoutResponse({
    supabase,
    userId: "user_1",
    scope: "confirm",
    idempotencyKey: "idem_1",
  });

  assert(cached !== null);
  assertEquals(cached?.responseStatus, 200);
  assertEquals(cached?.responseBody.paymentId, "pay_1");
});

Deno.test("merchant_checkout shared: saveIdempotentCheckoutResponse upserts key", async () => {
  let upsertPayload: Record<string, unknown> | null = null;
  const supabase = {
    from: (_table: string) => ({
      upsert: async (row: Record<string, unknown>) => {
        upsertPayload = row;
        return { data: null, error: null };
      },
    }),
  } as any;

  await saveIdempotentCheckoutResponse({
    supabase,
    userId: "user_1",
    scope: "tip",
    checkoutSessionId: "chk_1",
    idempotencyKey: "idem_2",
    responseStatus: 200,
    responseBody: { success: true, tipId: "tip_1" },
  });

  assert(upsertPayload !== null);
  assertEquals(upsertPayload?.scope, "tip");
  assertEquals(upsertPayload?.checkout_session_id, "chk_1");
  assertEquals(upsertPayload?.idempotency_key, "idem_2");
});
