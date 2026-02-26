import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCorsHeadersStrict } from "../_shared/cors.ts";
import {
  HttpError,
  buildTipResult,
  createServiceRoleClient,
  jsonResponse,
  loadCheckoutSession,
  readJson,
  requireUserId,
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

    const record = await loadCheckoutSession(supabase, userId, body.checkoutSessionId);
    const result = buildTipResult(record, body.selection);

    return jsonResponse(headers, {
      checkoutSessionId: body.checkoutSessionId,
      success: true,
      tipAmountMinor: result.tipAmountMinor,
      currencyCode: result.currencyCode,
      tipId: result.tipId,
      transactionId: result.transactionId,
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[merchant-checkout-tip]", error);
    return jsonResponse(headers, { error: message }, status);
  }
});

