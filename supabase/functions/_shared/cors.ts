/**
 * Explicit CORS handling for Supabase Edge Functions.
 * Never uses Access-Control-Allow-Origin: * — wildcard would allow any origin
 * to use bearer tokens (e.g. after XSS). Only allowlist origins are accepted.
 *
 * Set CORS_ALLOWED_ORIGINS (comma-separated) in Supabase dashboard to your real domains:
 *   - Production: https://app.yourdomain.com
 *   - Staging: https://staging.yourdomain.com
 *   - Local dev: http://localhost:3000, http://localhost:8080, http://127.0.0.1:8080
 * All other origins are rejected (403). Vary: Origin is always sent.
 */

/** Default allowlist when CORS_ALLOWED_ORIGINS is unset (localhost only). */
const DEFAULT_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:8080",
  "http://localhost:8081",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:8080",
  "http://127.0.0.1:8081",
];

/**
 * Allowed origins for CORS. Never includes "*" — explicit allowlist only.
 * Rejects any env value that is "*" or empty after trim.
 */
function getAllowedOrigins(): string[] {
  const env = Deno.env.get("CORS_ALLOWED_ORIGINS");
  if (!env?.trim()) return DEFAULT_ORIGINS;
  const list = env
    .split(",")
    .map((o) => o.trim())
    .filter((o) => o && o !== "*");
  return list.length > 0 ? list : DEFAULT_ORIGINS;
}

/** Never send wildcard; use a concrete origin or reject. */
function safeAllowOrigin(value: string): string {
  if (value === "*" || !value) return DEFAULT_ORIGINS[0];
  return value;
}

const COMMON_HEADERS = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, idempotency-key",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
} as const;

/** Allowlist for admin-only endpoints. Prefer ADMIN_CORS_ORIGINS (admin backend domain). */
function getAdminAllowedOrigins(): string[] {
  const env = Deno.env.get("ADMIN_CORS_ORIGINS");
  if (env?.trim()) {
    const list = env.split(",").map((o) => o.trim()).filter((o) => o && o !== "*");
    if (list.length > 0) return list;
  }
  return getAllowedOrigins();
}

const ADMIN_HEADERS = {
  ...COMMON_HEADERS,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-client",
} as const;

/**
 * Resolve CORS headers for a request.
 * - Origin in allowlist → echo it + Vary: Origin
 * - Origin present but invalid → return 403 (hostile origin)
 * - Origin missing → use first allowed origin (server-side/Postman; browser always sends Origin for cross-origin)
 */
export function getCorsHeaders(req: Request): {
  ok: true;
  headers: Record<string, string>;
} | {
  ok: false;
  response: Response;
} {
  const allowed = getAllowedOrigins();
  const origin = req.headers.get("Origin");

  if (origin) {
    const normalized = origin.replace(/\/$/, ""); // strip trailing slash for comparison
    const allowedSet = new Set(allowed.map((o) => o.replace(/\/$/, "")));
    if (!allowedSet.has(normalized)) {
      return {
        ok: false,
        response: new Response(
          JSON.stringify({ error: "CORS not allowed for this origin" }),
          {
            status: 403,
            headers: {
              "Content-Type": "application/json",
              "Vary": "Origin",
            },
          },
        ),
      };
    }
    return {
      ok: true,
      headers: {
        "Access-Control-Allow-Origin": safeAllowOrigin(normalized),
        "Vary": "Origin",
        ...COMMON_HEADERS,
      },
    };
  }

  // No Origin: allow (non-browser or same-origin). Use first allowed as fallback; never "*".
  return {
    ok: true,
    headers: {
      "Access-Control-Allow-Origin": safeAllowOrigin(allowed[0] ?? DEFAULT_ORIGINS[0]),
      "Vary": "Origin",
      ...COMMON_HEADERS,
    },
  };
}

const CORS_ORIGIN_REQUIRED_MSG = "CORS origin required for this endpoint";

/**
 * Strict CORS for wallet/reward endpoints: require Origin header; never use wildcard or fallback.
 * Use for all bearer-auth endpoints: issue-reward, transfer-coins, tip-creator, request-payout,
 * verify-checkin, validate-attention, manage-referral, track-interaction, export-user-data,
 * get-personalized-feed, customer-portal, check-subscription, create-checkout, admin-users.
 * (kyc-review uses getCorsHeadersAdmin instead.)
 */
export function getCorsHeadersStrict(req: Request): {
  ok: true;
  headers: Record<string, string>;
} | {
  ok: false;
  response: Response;
} {
  const origin = req.headers.get("Origin");
  if (!origin?.trim()) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: CORS_ORIGIN_REQUIRED_MSG }),
        {
          status: 403,
          headers: { "Content-Type": "application/json", "Vary": "Origin" },
        },
      ),
    };
  }
  const allowed = getAllowedOrigins();
  const normalized = origin.replace(/\/$/, "");
  const allowedSet = new Set(allowed.map((o) => o.replace(/\/$/, "")));
  if (!allowedSet.has(normalized)) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: "CORS not allowed for this origin" }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
            "Vary": "Origin",
          },
        },
      ),
    };
  }
  return {
    ok: true,
    headers: {
      "Access-Control-Allow-Origin": safeAllowOrigin(normalized),
      "Vary": "Origin",
      ...COMMON_HEADERS,
    },
  };
}

const X_ADMIN_CLIENT_REQUIRED_MSG = "X-Admin-Client header required (admin backend only)";

/**
 * Admin-only CORS: restrict to admin origin(s) and require X-Admin-Client header.
 * Set ADMIN_CORS_ORIGINS (comma-separated) to your admin backend domain(s); if unset, uses CORS_ALLOWED_ORIGINS.
 * Use for kyc-review and other admin-only endpoints that must not be called from the main app origin.
 * X-Admin-Client is not required for OPTIONS (preflight).
 */
export function getCorsHeadersAdmin(req: Request): {
  ok: true;
  headers: Record<string, string>;
} | {
  ok: false;
  response: Response;
} {
  const origin = req.headers.get("Origin");
  if (!origin?.trim()) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: CORS_ORIGIN_REQUIRED_MSG }),
        { status: 403, headers: { "Content-Type": "application/json", "Vary": "Origin" } },
      ),
    };
  }
  const allowed = getAdminAllowedOrigins();
  const normalized = origin.replace(/\/$/, "");
  const allowedSet = new Set(allowed.map((o) => o.replace(/\/$/, "")));
  if (!allowedSet.has(normalized)) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({ error: "CORS not allowed for this origin" }),
        { status: 403, headers: { "Content-Type": "application/json", "Vary": "Origin" } },
      ),
    };
  }
  if (req.method !== "OPTIONS") {
    const adminClient = req.headers.get("X-Admin-Client");
    if (!adminClient?.trim()) {
      return {
        ok: false,
        response: new Response(
          JSON.stringify({ error: X_ADMIN_CLIENT_REQUIRED_MSG }),
          { status: 403, headers: { "Content-Type": "application/json", "Vary": "Origin" } },
        ),
      };
    }
  }
  return {
    ok: true,
    headers: {
      "Access-Control-Allow-Origin": safeAllowOrigin(normalized),
      "Vary": "Origin",
      ...ADMIN_HEADERS,
    },
  };
}

/** Shorthand: get headers or throw 403 response for use in early return */
export function corsHeadersOrReject(req: Request): Record<string, string> {
  const result = getCorsHeaders(req);
  if (!result.ok) throw result.response;
  return result.headers;
}
