import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCorsHeadersStrict } from "../_shared/cors.ts";
import {
  HttpError,
  createServiceRoleClient,
  jsonResponse,
  readJson,
  requireUserId,
} from "../_shared/merchant_checkout.ts";

interface FunnelBody {
  windowHours?: number;
  scope?: "SELF" | "GLOBAL" | string;
}

interface CheckoutEventRow {
  user_id: string;
  event_name: string;
  created_at: string;
  entry_type: string | null;
  merchant_id: string | null;
  merchant_category: string | null;
  checkout_mode: string | null;
  tip_timing: string | null;
  metadata: Record<string, unknown> | null;
}

interface FunnelBreakdownRow {
  key: string;
  started: number;
  resolved: number;
  confirmed: number;
  abandoned: number;
  started_to_confirmed: number;
}

const DEFAULT_WINDOW_HOURS = 24 * 7;
const MAX_WINDOW_HOURS = 24 * 90;

function safeRate(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Number((numerator / denominator).toFixed(4));
}

function updateBreakdownBucket(
  map: Map<string, { started: number; resolved: number; confirmed: number; abandoned: number }>,
  key: string,
  eventName: string,
) {
  const prev = map.get(key) ?? { started: 0, resolved: 0, confirmed: 0, abandoned: 0 };
  if (eventName === "checkout_started") prev.started += 1;
  if (eventName === "checkout_resolved") prev.resolved += 1;
  if (eventName === "checkout_confirmed") prev.confirmed += 1;
  if (eventName === "checkout_abandoned") prev.abandoned += 1;
  map.set(key, prev);
}

function toBreakdownRows(
  map: Map<string, { started: number; resolved: number; confirmed: number; abandoned: number }>,
): FunnelBreakdownRow[] {
  return Array.from(map.entries())
    .map(([key, value]) => ({
      key,
      started: value.started,
      resolved: value.resolved,
      confirmed: value.confirmed,
      abandoned: value.abandoned,
      started_to_confirmed: safeRate(value.confirmed, value.started),
    }))
    .sort((a, b) => {
      if (b.started !== a.started) return b.started - a.started;
      return b.confirmed - a.confirmed;
    })
    .slice(0, 10);
}

async function checkAdminOrModerator(
  supabase: ReturnType<typeof createServiceRoleClient>,
  userId: string,
) {
  const { data: isAdmin, error: adminError } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (adminError) throw new HttpError(500, adminError.message || "Failed to verify admin role");
  if (isAdmin) return true;

  const { data: isModerator, error: modError } = await supabase.rpc("has_role", { _user_id: userId, _role: "moderator" });
  if (modError) throw new HttpError(500, modError.message || "Failed to verify moderator role");
  return Boolean(isModerator);
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
    const body = await readJson<FunnelBody>(req);
    const rawScope = typeof body?.scope === "string" ? body.scope.toUpperCase() : "SELF";
    const requestedScope = rawScope === "GLOBAL" ? "GLOBAL" : "SELF";
    let scope: "SELF" | "GLOBAL" = "SELF";

    if (requestedScope === "GLOBAL") {
      const allowed = await checkAdminOrModerator(supabase, userId);
      if (!allowed) throw new HttpError(403, "Forbidden: admin or moderator role required for GLOBAL scope");
      scope = "GLOBAL";
    }

    const rawWindowHours = Number(body?.windowHours ?? DEFAULT_WINDOW_HOURS);
    const windowHours = Number.isFinite(rawWindowHours)
      ? Math.min(MAX_WINDOW_HOURS, Math.max(1, Math.floor(rawWindowHours)))
      : DEFAULT_WINDOW_HOURS;

    const sinceIso = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();

    let query = supabase
      .from("merchant_checkout_events")
      .select("user_id, event_name, created_at, entry_type, merchant_id, merchant_category, checkout_mode, tip_timing, metadata")
      .gte("created_at", sinceIso);

    if (scope === "SELF") {
      query = query.eq("user_id", userId);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) throw new HttpError(500, error.message || "Failed to load checkout funnel events");

    const rows = (data ?? []) as CheckoutEventRow[];

    const counts: Record<string, number> = {
      checkout_started: 0,
      checkout_resolved: 0,
      checkout_confirmed: 0,
      checkout_tip_submitted: 0,
      checkout_abandoned: 0,
      checkout_qr_scan_started: 0,
      checkout_qr_scan_succeeded: 0,
      checkout_qr_scan_failed: 0,
      checkout_manual_entry_launched: 0,
      checkout_step_changed: 0,
    };

    const abandonedByScreen: Record<string, number> = {};
    const byEntryType = new Map<string, { started: number; resolved: number; confirmed: number; abandoned: number }>();
    const byMerchantId = new Map<string, { started: number; resolved: number; confirmed: number; abandoned: number }>();
    const byMerchantCategory = new Map<string, { started: number; resolved: number; confirmed: number; abandoned: number }>();
    const byCheckoutMode = new Map<string, { started: number; resolved: number; confirmed: number; abandoned: number }>();
    const byTipTiming = new Map<string, { started: number; resolved: number; confirmed: number; abandoned: number }>();
    const uniqueUsers = new Set<string>();
    const uniqueMerchants = new Set<string>();

    for (const row of rows) {
      const eventName = row.event_name;
      counts[eventName] = (counts[eventName] ?? 0) + 1;
      uniqueUsers.add(String(row.user_id));
      if (row.merchant_id) uniqueMerchants.add(String(row.merchant_id));
      updateBreakdownBucket(byEntryType, String(row.entry_type ?? "UNKNOWN"), eventName);
      updateBreakdownBucket(byMerchantId, String(row.merchant_id ?? "UNKNOWN"), eventName);
      updateBreakdownBucket(byMerchantCategory, String(row.merchant_category ?? "UNKNOWN"), eventName);
      updateBreakdownBucket(byCheckoutMode, String(row.checkout_mode ?? "UNKNOWN"), eventName);
      updateBreakdownBucket(byTipTiming, String(row.tip_timing ?? "UNKNOWN"), eventName);

      if (eventName === "checkout_abandoned") {
        const screen = String((row.metadata ?? {})["currentScreen"] ?? "UNKNOWN");
        abandonedByScreen[screen] = (abandonedByScreen[screen] ?? 0) + 1;
      }
    }

    const started = counts.checkout_started ?? 0;
    const resolved = counts.checkout_resolved ?? 0;
    const confirmed = counts.checkout_confirmed ?? 0;
    const abandoned = counts.checkout_abandoned ?? 0;

    const conversion = {
      started_to_resolved: safeRate(resolved, started),
      resolved_to_confirmed: safeRate(confirmed, resolved),
      started_to_confirmed: safeRate(confirmed, started),
      abandonment_rate: safeRate(abandoned, started),
    };

    const topAbandonScreens = Object.entries(abandonedByScreen)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([screen, count]) => ({ screen, count }));

    return jsonResponse(headers, {
      scope,
      windowHours,
      from: sinceIso,
      totals: {
        events: rows.length,
        uniqueUsers: uniqueUsers.size,
        uniqueMerchants: uniqueMerchants.size,
      },
      counts,
      conversion,
      topAbandonScreens,
      breakdown: {
        entryType: toBreakdownRows(byEntryType),
        merchantId: toBreakdownRows(byMerchantId),
        merchantCategory: toBreakdownRows(byMerchantCategory),
        checkoutMode: toBreakdownRows(byCheckoutMode),
        tipTiming: toBreakdownRows(byTipTiming),
      },
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("[merchant-checkout-funnel]", error);
    return jsonResponse(headers, { error: message }, status);
  }
});
