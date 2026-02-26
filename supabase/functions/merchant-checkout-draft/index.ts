import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCorsHeadersStrict } from "../_shared/cors.ts";
import {
  HttpError,
  createServiceRoleClient,
  jsonResponse,
  loadCheckoutSession,
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

