import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCorsHeadersStrict } from "../_shared/cors.ts";
import {
  HttpError,
  createServiceRoleClient,
  jsonResponse,
  loadCheckoutSession,
  logCheckoutEvent,
  patchSessionDraft,
  readJson,
  requireUserId,
  saveCheckoutSession,
} from "../_shared/merchant_checkout.ts";
import type {
  MerchantCheckoutAccessibility,
  MerchantCheckoutDraftState,
  MerchantCheckoutUserPreferences,
} from "../../../src/features/merchantCheckout/types.ts";

interface DraftBody {
  checkoutSessionId: string;
  draft: MerchantCheckoutDraftState;
  userPreferences: MerchantCheckoutUserPreferences;
  accessibility: MerchantCheckoutAccessibility;
}

serve(async (req) => {
  const cors = getCorsHeadersStrict(req);
  if (!cors.ok) return cors.response;
  const headers = { ...cors.headers, "Content-Type": "application/json" };

  if (req.method === "OPTIONS") return new Response(null, { headers: cors.headers });
  if (req.method !== "POST") return jsonResponse(headers, { error: "Method not allowed" }, 405);

  try {
    const supabase = createServiceRoleClient();
    const userId = await requireUserId(supabase, req);
    const body = await readJson<DraftBody>(req);

    if (!body?.checkoutSessionId || !body?.draft || !body?.userPreferences || !body?.accessibility) {
      throw new HttpError(400, "Missing draft payload");
    }

    const current = await loadCheckoutSession(supabase, userId, body.checkoutSessionId);
    const { nextRecord, autoConvertEligible } = patchSessionDraft({
      record: current,
      draft: body.draft,
      userPreferences: body.userPreferences,
      accessibility: body.accessibility,
    });
    await saveCheckoutSession(supabase, userId, nextRecord);
    await logCheckoutEvent({
      supabase,
      payload: {
        userId,
        eventName: "checkout_draft_updated",
        checkoutSessionId: body.checkoutSessionId,
        entryType: nextRecord.scenario.entry.entryType,
        merchantId: nextRecord.scenario.merchant.id,
        merchantCategory: nextRecord.scenario.merchant.category,
        checkoutMode: nextRecord.plan.resolvedCheckoutMode,
        modeVisibility: nextRecord.plan.modeBadge.visible ? "VISIBLE" : "HIDDEN",
        tipMode: nextRecord.plan.tipPlan.mode,
        tipTiming: nextRecord.plan.tipPlan.timing,
        amountMinor: nextRecord.quote.amountMinor,
        tipAmountMinor: nextRecord.quote.tipMinor,
        currencyCode: nextRecord.quote.currencyCode,
        autoConvertUsed: nextRecord.draft.paymentSourceSelection === "AUTO_CONVERT",
        metadata: {
          currentScreen: nextRecord.plan.screens[0] ?? null,
          autoConvertEligible,
        },
      },
    });

    return jsonResponse(headers, {
      checkoutSessionId: body.checkoutSessionId,
      plan: nextRecord.plan,
      quote: nextRecord.quote,
      draft: nextRecord.draft,
      autoConvertEligible,
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[merchant-checkout-draft]", error);
    return jsonResponse(headers, { error: message }, status);
  }
});
