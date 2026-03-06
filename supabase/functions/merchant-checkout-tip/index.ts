import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCorsHeadersStrict } from "../_shared/cors.ts";
import {
  HttpError,
  buildTipResult,
  createServiceRoleClient,
  getIdempotentCheckoutResponse,
  jsonResponse,
  loadCheckoutSession,
  logCheckoutEvent,
  readJson,
  requireUserId,
  saveCheckoutTip,
  saveIdempotentCheckoutResponse,
} from "../_shared/merchant_checkout.ts";
import type { TipSelection } from "../../../src/features/merchantCheckout/types.ts";

interface TipBody {
  checkoutSessionId: string;
  selection: TipSelection;
  idempotencyKey?: string;
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
    const body = await readJson<TipBody>(req);

    if (!body?.checkoutSessionId || !body?.selection) {
      throw new HttpError(400, "Missing tip payload");
    }

    const cached = await getIdempotentCheckoutResponse({
      supabase,
      userId,
      scope: "tip",
      idempotencyKey: body.idempotencyKey,
    });
    if (cached) {
      return jsonResponse(headers, cached.responseBody, cached.responseStatus);
    }

    const record = await loadCheckoutSession(supabase, userId, body.checkoutSessionId);
    const result = buildTipResult(record, body.selection);
    await logCheckoutEvent({
      supabase,
      payload: {
        userId,
        eventName: "checkout_tip_submitted",
        checkoutSessionId: body.checkoutSessionId,
        paymentId: record.paymentId ?? null,
        entryType: record.scenario.entry.entryType,
        merchantId: record.scenario.merchant.id,
        merchantCategory: record.scenario.merchant.category,
        checkoutMode: record.plan.resolvedCheckoutMode,
        modeVisibility: record.plan.modeBadge.visible ? "VISIBLE" : "HIDDEN",
        tipMode: record.plan.tipPlan.mode,
        tipTiming: record.plan.tipPlan.timing,
        amountMinor: record.quote.amountMinor,
        tipAmountMinor: result.tipAmountMinor,
        currencyCode: result.currencyCode,
        autoConvertUsed: record.draft.paymentSourceSelection === "AUTO_CONVERT",
        metadata: {
          selection: body.selection,
          idempotencyKeyPresent: typeof body.idempotencyKey === "string" && body.idempotencyKey.length > 0,
        },
      },
    });

    const responseBody = {
      checkoutSessionId: body.checkoutSessionId,
      success: true,
      tipAmountMinor: result.tipAmountMinor,
      currencyCode: result.currencyCode,
      tipId: result.tipId,
      transactionId: result.transactionId,
    } as const;
    await saveCheckoutTip({
      supabase,
      userId,
      checkoutSessionId: body.checkoutSessionId,
      paymentId: record.paymentId ?? null,
      tipId: result.tipId,
      status: "SUCCEEDED",
      tipAmountMinor: result.tipAmountMinor,
      currencyCode: result.currencyCode,
      response: responseBody as unknown as Record<string, unknown>,
    });
    await saveIdempotentCheckoutResponse({
      supabase,
      userId,
      scope: "tip",
      checkoutSessionId: body.checkoutSessionId,
      idempotencyKey: body.idempotencyKey,
      responseStatus: 200,
      responseBody: responseBody as unknown as Record<string, unknown>,
    });

    return jsonResponse(headers, responseBody);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[merchant-checkout-tip]", error);
    return jsonResponse(headers, { error: message }, status);
  }
});
