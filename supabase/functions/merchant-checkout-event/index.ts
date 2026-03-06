import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCorsHeadersStrict } from "../_shared/cors.ts";
import {
  HttpError,
  createServiceRoleClient,
  jsonResponse,
  loadCheckoutSession,
  logCheckoutEvent,
  readJson,
  requireUserId,
} from "../_shared/merchant_checkout.ts";

interface EventBody {
  eventName: string;
  checkoutSessionId?: string;
  paymentId?: string;
  currentScreen?: string;
  metadata?: Record<string, unknown>;
}

const ALLOWED_EVENT_NAMES = new Set([
  "checkout_started",
  "checkout_abandoned",
  "checkout_step_changed",
  "checkout_manual_entry_launched",
  "checkout_qr_scan_started",
  "checkout_qr_scan_succeeded",
  "checkout_qr_scan_failed",
]);

serve(async (req) => {
  const cors = getCorsHeadersStrict(req);
  if (!cors.ok) return cors.response;
  const headers = { ...cors.headers, "Content-Type": "application/json" };

  if (req.method === "OPTIONS") return new Response(null, { headers: cors.headers });
  if (req.method !== "POST") return jsonResponse(headers, { error: "Method not allowed" }, 405);

  try {
    const supabase = createServiceRoleClient();
    const userId = await requireUserId(supabase, req);
    const body = await readJson<EventBody>(req);

    if (!body?.eventName || typeof body.eventName !== "string") {
      throw new HttpError(400, "Missing eventName");
    }

    if (!ALLOWED_EVENT_NAMES.has(body.eventName)) {
      throw new HttpError(400, "Unsupported eventName");
    }

    let session = null;
    if (body.checkoutSessionId) {
      try {
        session = await loadCheckoutSession(supabase, userId, body.checkoutSessionId);
      } catch {
        // Best effort event enrichment only.
      }
    }

    await logCheckoutEvent({
      supabase,
      payload: {
        userId,
        eventName: body.eventName,
        checkoutSessionId: body.checkoutSessionId ?? null,
        paymentId: body.paymentId ?? session?.paymentId ?? null,
        entryType: session?.scenario.entry.entryType ?? null,
        merchantId: session?.scenario.merchant.id ?? null,
        merchantCategory: session?.scenario.merchant.category ?? null,
        checkoutMode: session?.plan.resolvedCheckoutMode ?? null,
        modeVisibility: session ? (session.plan.modeBadge.visible ? "VISIBLE" : "HIDDEN") : null,
        tipMode: session?.plan.tipPlan.mode ?? null,
        tipTiming: session?.plan.tipPlan.timing ?? null,
        autoConvertUsed: session ? session.draft.paymentSourceSelection === "AUTO_CONVERT" : null,
        amountMinor: session?.quote.amountMinor ?? null,
        tipAmountMinor: session?.quote.tipMinor ?? null,
        currencyCode: session?.quote.currencyCode ?? null,
        metadata: {
          ...(body.metadata ?? {}),
          currentScreen: body.currentScreen ?? null,
          source: "client",
        },
      },
    });

    return jsonResponse(headers, { success: true });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[merchant-checkout-event]", error);
    return jsonResponse(headers, { error: message }, status);
  }
});
