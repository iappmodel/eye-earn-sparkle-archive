import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCorsHeadersStrict } from "../_shared/cors.ts";
import {
  HttpError,
  buildConfirmReceipt,
  createServiceRoleClient,
  jsonResponse,
  loadCheckoutSession,
  readJson,
  requireUserId,
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

    const record = await loadCheckoutSession(supabase, userId, body.checkoutSessionId);
    const built = buildConfirmReceipt(record, body.authMethod);
    record.paymentId = built.paymentId;
    record.transactionId = built.transactionId;
    await saveCheckoutSession(supabase, userId, record);

    return jsonResponse(headers, {
      checkoutSessionId: body.checkoutSessionId,
      paymentId: built.paymentId,
      status: "SUCCEEDED",
      receipt: built.receipt,
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[merchant-checkout-confirm]", error);
    return jsonResponse(headers, { error: message }, status);
  }
});

