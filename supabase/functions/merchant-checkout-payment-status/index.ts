import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCorsHeadersStrict } from "../_shared/cors.ts";
import {
  HttpError,
  createServiceRoleClient,
  jsonResponse,
  loadCheckoutPaymentById,
  loadCheckoutPaymentBySession,
  readJson,
  requireUserId,
} from "../_shared/merchant_checkout.ts";

interface PaymentStatusBody {
  paymentId?: string;
  checkoutSessionId?: string;
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
    const body = await readJson<PaymentStatusBody>(req);

    const paymentId = typeof body?.paymentId === "string" ? body.paymentId.trim() : "";
    const checkoutSessionId = typeof body?.checkoutSessionId === "string" ? body.checkoutSessionId.trim() : "";

    if (!paymentId && !checkoutSessionId) {
      throw new HttpError(400, "Missing paymentId or checkoutSessionId");
    }

    const result = paymentId
      ? await loadCheckoutPaymentById({ supabase, userId, paymentId })
      : await loadCheckoutPaymentBySession({ supabase, userId, checkoutSessionId });

    if (!result) {
      return jsonResponse(headers, { found: false }, 404);
    }

    return jsonResponse(headers, {
      found: true,
      paymentId: result.paymentId,
      checkoutSessionId: result.checkoutSessionId,
      status: result.status,
      receipt: result.receipt,
      createdAt: result.createdAt,
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[merchant-checkout-payment-status]", error);
    return jsonResponse(headers, { error: message }, status);
  }
});
