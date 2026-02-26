import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCorsHeadersStrict } from "../_shared/cors.ts";
import {
  HttpError,
  createServiceRoleClient,
  jsonResponse,
  readJson,
  requireUserId,
  resolveSession,
  saveCheckoutSession,
} from "../_shared/merchant_checkout.ts";
import type {
  MerchantCheckoutAccessibility,
  MerchantCheckoutScenario,
  MerchantCheckoutUserPreferences,
  MerchantCheckoutWalletSnapshot,
} from "../../../src/features/merchantCheckout/types.ts";

interface ResolveBody {
  scenario: MerchantCheckoutScenario;
  userPreferences: MerchantCheckoutUserPreferences;
  wallet: MerchantCheckoutWalletSnapshot;
  accessibility: MerchantCheckoutAccessibility;
}

// Keep this entrypoint intentionally minimal; auth and resolver logic live in _shared.

serve(async (req) => {
  const cors = getCorsHeadersStrict(req);
  if (!cors.ok) return cors.response;
  const headers = { ...cors.headers, "Content-Type": "application/json" };

  if (req.method === "OPTIONS") return new Response(null, { headers: cors.headers });
  if (req.method !== "POST") return jsonResponse(headers, { error: "Method not allowed" }, 405);

  try {
    const supabase = createServiceRoleClient();
    const userId = await requireUserId(supabase, req);
    const body = await readJson<ResolveBody>(req);

    if (!body?.scenario || !body?.wallet || !body?.userPreferences || !body?.accessibility) {
      throw new HttpError(400, "Missing resolve payload");
    }

    const record = resolveSession({
      scenario: body.scenario,
      userPreferences: body.userPreferences,
      wallet: body.wallet,
      accessibility: body.accessibility,
    });
    const expiresAt = await saveCheckoutSession(supabase, userId, record);

    return jsonResponse(headers, {
      checkoutSessionId: record.checkoutSessionId,
      plan: record.plan,
      quote: record.quote,
      draft: record.draft,
      expiresAt,
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[merchant-checkout-resolve]", error);
    return jsonResponse(headers, { error: message }, status);
  }
});
