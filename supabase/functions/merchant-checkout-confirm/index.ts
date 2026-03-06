import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCorsHeadersStrict } from "../_shared/cors.ts";
import {
  HttpError,
  buildConfirmReceipt,
  createServiceRoleClient,
  getIdempotentCheckoutResponse,
  jsonResponse,
  loadCheckoutSession,
  logCheckoutEvent,
  readJson,
  requireUserId,
  saveCheckoutPayment,
  saveIdempotentCheckoutResponse,
  saveCheckoutSession,
} from "../_shared/merchant_checkout.ts";

interface ConfirmBody {
  checkoutSessionId: string;
  authMethod: "FACE_ID" | "PIN";
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
    const body = await readJson<ConfirmBody>(req);

    if (!body?.checkoutSessionId || !body?.authMethod) {
      throw new HttpError(400, "Missing confirm payload");
    }
    if (body.authMethod !== "FACE_ID" && body.authMethod !== "PIN") {
      throw new HttpError(400, "Invalid auth method");
    }

    const cached = await getIdempotentCheckoutResponse({
      supabase,
      userId,
      scope: "confirm",
      idempotencyKey: body.idempotencyKey,
    });
    if (cached) {
      return jsonResponse(headers, cached.responseBody, cached.responseStatus);
    }

    const record = await loadCheckoutSession(supabase, userId, body.checkoutSessionId);
    const built = buildConfirmReceipt(record, body.authMethod);
    record.paymentId = built.paymentId;
    record.transactionId = built.transactionId;
    await saveCheckoutSession(supabase, userId, record);
    await saveCheckoutPayment({
      supabase,
      userId,
      checkoutSessionId: body.checkoutSessionId,
      paymentId: built.paymentId,
      merchantId: record.scenario.merchant.id,
      status: "SUCCEEDED",
      receipt: built.receipt as Record<string, unknown>,
    });
    await logCheckoutEvent({
      supabase,
      payload: {
        userId,
        eventName: "checkout_confirmed",
        checkoutSessionId: body.checkoutSessionId,
        paymentId: built.paymentId,
        entryType: record.scenario.entry.entryType,
        merchantId: record.scenario.merchant.id,
        merchantCategory: record.scenario.merchant.category,
        checkoutMode: record.plan.resolvedCheckoutMode,
        modeVisibility: record.plan.modeBadge.visible ? "VISIBLE" : "HIDDEN",
        tipMode: record.plan.tipPlan.mode,
        tipTiming: record.plan.tipPlan.timing,
        amountMinor: built.receipt.amountMinor,
        tipAmountMinor: built.receipt.tipMinor,
        currencyCode: built.receipt.currencyCode,
        autoConvertUsed: record.draft.paymentSourceSelection === "AUTO_CONVERT",
        metadata: {
          authMethod: body.authMethod,
          idempotencyKeyPresent: typeof body.idempotencyKey === "string" && body.idempotencyKey.length > 0,
        },
      },
    });

    const responseBody = {
      checkoutSessionId: body.checkoutSessionId,
      paymentId: built.paymentId,
      status: "SUCCEEDED",
      receipt: built.receipt,
    } as const;

    await saveIdempotentCheckoutResponse({
      supabase,
      userId,
      scope: "confirm",
      checkoutSessionId: body.checkoutSessionId,
      idempotencyKey: body.idempotencyKey,
      responseStatus: 200,
      responseBody: responseBody as unknown as Record<string, unknown>,
    });

    return jsonResponse(headers, responseBody);
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[merchant-checkout-confirm]", error);
    return jsonResponse(headers, { error: message }, status);
  }
});
