# XSS, CSRF, and Session Security

This doc summarizes how the app mitigates XSS/CSRF and session theft, and how to move to httpOnly cookies if you need persistent sessions without localStorage.

## Current posture

### Session storage: memory only (no localStorage)

- **Location:** `src/integrations/supabase/client.ts` uses a custom `memoryStorage` adapter (`src/integrations/supabase/memoryStorage.ts`).
- **Effect:** Supabase auth tokens are kept only in JavaScript memory. They are **not** written to `localStorage` or `sessionStorage`, so XSS cannot exfiltrate them from disk.
- **Tradeoff:** Users are logged out on tab close or full page refresh (no persistent session across reloads). If you need “remember me” across refreshes, use the httpOnly cookie approach below.

### CSP (Content-Security-Policy)

- **Location:** `index.html` meta tag.
- **Rules:** `default-src 'self'`; `script-src 'self'` (no inline scripts, no `unsafe-eval`); `style-src 'self' 'unsafe-inline'`; `connect-src` allows `https:` and `wss:` for Supabase/APIs.
- **Effect:** Reduces impact of XSS by blocking inline script execution and limiting script/style sources.

### Edge functions: origin allowlist (no wildcard CORS)

- **Location:** `supabase/functions/_shared/cors.ts`.
- **Behavior:**
  - **Never** uses `Access-Control-Allow-Origin: *`. Only explicitly allowlisted origins (from `CORS_ALLOWED_ORIGINS` or defaults) are accepted.
  - Wallet/reward endpoints use **strict CORS** (`getCorsHeadersStrict`): they **require** an `Origin` header and reject requests whose origin is not on the allowlist (403). So a page on a hostile origin cannot use a stolen token to call these APIs from the browser.
- **Bearer-auth endpoints** that use strict CORS include: `issue-reward`, `transfer-coins`, `tip-creator`, `request-payout`, `validate-attention`, `verify-checkin`, `manage-referral`, `track-interaction`, `export-user-data`, `get-personalized-feed`, `customer-portal`, `check-subscription`, `create-checkout`, `admin-users`. Others use `getCorsHeaders`, which still validates origin when present and rejects disallowed origins.

Set in Supabase Dashboard (Edge Function secrets / env):

- `CORS_ALLOWED_ORIGINS`: comma-separated list of your app origins (e.g. `https://app.yourdomain.com`, `http://localhost:8080`).
- For admin-only endpoints: `ADMIN_CORS_ORIGINS` and require `X-Admin-Client` when using `getCorsHeadersAdmin`.

### User-generated content and DOM

- **Comments / messages:** Rendered as React children (e.g. `CommentContent` with `text={comment.content}`), so React escapes by default—no raw HTML.
- **dangerouslySetInnerHTML:** Used only where necessary:
  - **Chart styles** (`src/components/ui/chart.tsx`): Injected CSS is built from app-controlled theme config; chart id and CSS color values are sanitized before injection.
  - **main.tsx error UI:** Error message is HTML-escaped before being inserted into the fallback DOM.
- **DiscoveryMap:** Marker popup HTML is built from server/UI state; style values come from a fixed `getMarkerStyle` (no user-controlled HTML).

**Guideline:** Do not use `dangerouslySetInnerHTML` for user-generated content. If you must, sanitize with a proper library (e.g. DOMPurify) and keep a strict CSP.

## Moving to httpOnly cookie sessions (recommended for persistence + XSS resistance)

To get both **session persistence** and **XSS-resistant** token storage:

1. **Supabase + cookies:** Use Supabase’s cookie-based auth so the refresh token (and optionally access token) live in **httpOnly, Secure, SameSite** cookies instead of JS-accessible storage. Options:
   - **Supabase Auth Helpers (SSR)** with a small backend or middleware that sets cookies (e.g. Next.js, or a Vite app behind a BFF that exchanges code/token for cookies).
   - Or a **custom BFF** that talks to Supabase Auth, sets httpOnly cookies, and proxies API requests with cookie → bearer token.

2. **Flow (high level):**
   - User signs in via Supabase (e.g. OAuth or email/password).
   - Your server or Edge Function receives the session (e.g. from callback or token exchange), sets an httpOnly cookie (e.g. `sb-access-token` / `sb-refresh-token` or a single session cookie).
   - Browser sends the cookie automatically; JS never reads it, so XSS cannot steal it.
   - For Edge Functions that currently expect `Authorization: Bearer <token>`: either keep using the anon key from the client and RLS, or add a small gateway that reads the cookie and forwards the bearer token to Supabase/Edge Functions.

3. **CSRF:** With cookies, protect state-changing and sensitive operations with CSRF tokens or SameSite cookies plus strict CORS/origin checks (which you already have). Prefer `SameSite=Strict` or `Lax` for auth cookies.

4. **Docs:** See [Supabase Auth with cookies](https://supabase.com/docs/guides/auth/auth-helpers/nextjs) (and adapt for your stack) and [Supabase SSR](https://supabase.com/docs/guides/auth/server-side-rendering) for patterns.

## Checklist

- [x] Auth tokens not in localStorage/sessionStorage (memory only).
- [x] Strict CSP in `index.html` (no inline scripts / unsafe-eval).
- [x] Edge CORS: allowlist only; strict CORS for wallet/reward endpoints.
- [x] User content rendered as text (React children); no raw user HTML.
- [x] All `dangerouslySetInnerHTML` usages documented and sanitized where they touch config/data.
- [ ] (Optional) Migrate to httpOnly cookie session model for persistence without exposing tokens to JS.
