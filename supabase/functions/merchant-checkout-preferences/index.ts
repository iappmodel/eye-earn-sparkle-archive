import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCorsHeadersStrict } from "../_shared/cors.ts";
import {
  HttpError,
  clampPreferences,
  createServiceRoleClient,
  jsonResponse,
  logCheckoutEvent,
  loadCheckoutPreferences,
  readJson,
  requireUserId,
  saveCheckoutPreferences,
} from "../_shared/merchant_checkout.ts";

type PreferencesAction = "GET" | "PUT";

interface PreferencesBody {
  action?: PreferencesAction;
  preferences?: unknown;
  version?: number | null;
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
    const body = await readJson<PreferencesBody>(req);
    const action = body?.action ?? "GET";

    if (action === "GET") {
      const prefs = await loadCheckoutPreferences(supabase, userId);
      await logCheckoutEvent({
        supabase,
        payload: {
          userId,
          eventName: "checkout_preferences_loaded",
          metadata: {
            hasChosenLabelLanguage: prefs.hasChosenLabelLanguage,
            version: prefs.version,
          },
        },
      });
      return jsonResponse(headers, { preferences: prefs });
    }

    if (action !== "PUT") throw new HttpError(400, "Invalid action");
    if (!body.preferences || typeof body.preferences !== "object") {
      throw new HttpError(400, "Missing preferences payload");
    }

    const saved = await saveCheckoutPreferences({
      supabase,
      userId,
      incoming: clampPreferences(body.preferences as Record<string, unknown>),
      expectedVersion: typeof body.version === "number" ? body.version : null,
    });
    await logCheckoutEvent({
      supabase,
      payload: {
        userId,
        eventName: "checkout_preferences_saved",
        metadata: {
          hasChosenLabelLanguage: saved.hasChosenLabelLanguage,
          labelLanguage: saved.labelLanguage,
          tipPromptLayoutGlobal: saved.tipPromptLayoutGlobal,
          categoryOverridesCount: Object.keys(saved.tipPromptLayoutByCategory ?? {}).length,
          autoConvertPreferenceEnabled: saved.autoConvertPreferenceEnabled,
          version: saved.version,
        },
      },
    });

    return jsonResponse(headers, {
      success: true,
      version: saved.version,
      preferences: saved,
    });
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Internal server error";
    if (message === "VERSION_CONFLICT") {
      return jsonResponse(headers, { error: "VERSION_CONFLICT" }, 409);
    }
    console.error("[merchant-checkout-preferences]", error);
    return jsonResponse(headers, { error: message }, status);
  }
});
