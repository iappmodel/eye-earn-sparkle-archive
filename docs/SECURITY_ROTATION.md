# Security: Key Rotation After .env Exposure

On **2026-02-18**, `.env` was removed from git history after it had been committed. If this repo was ever pushed to a remote or forked, treat these values as potentially exposed and rotate them.

## Keys That Were in Committed .env

The committed `.env` contained:

| Variable | Risk | Action |
|----------|------|--------|
| `VITE_SUPABASE_URL` | Low (public URL) | No rotation needed |
| `VITE_SUPABASE_PROJECT_ID` | Low (project identifier) | No rotation needed |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Medium (anon key in history) | **Rotate** |

## Rotation Steps

### 1. Rotate Supabase Anon Key

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project (`tjykxqhliywnmelyuscn`)
2. Go to **Project Settings** → **API**
3. Under **Project API keys**, click **Regenerate** for the `anon` / `public` key
4. Copy the new key
5. Update your local `.env`:
   ```
   VITE_SUPABASE_PUBLISHABLE_KEY="<new-anon-key>"
   ```
6. If any Supabase Edge Functions or CI/CD use the anon key, update those secrets too

### 2. Redeploy / Rebuild

- Rebuild and redeploy the app so the new anon key is used everywhere
- Any existing sessions may need to re-authenticate after the key change

### 3. (Optional) Rotate Service Role Key

The service role key was **not** in the committed `.env` (it lives in Supabase secrets). Rotate it only if you suspect broader exposure.

1. Supabase Dashboard → **Project Settings** → **API**
2. Regenerate the `service_role` key
3. Update Supabase Edge Function secrets:  
   `supabase secrets set SUPABASE_SERVICE_ROLE_KEY=<new-key>`

---

## What Was Done

- [x] Removed `.env` from git history (via `git filter-branch`)
- [x] Ensured `.env`, `.env.*` (with `!.env.example`) are in `.gitignore`
- [ ] **You must:** Rotate the Supabase anon key and update `.env`

## Force Push Required

Because history was rewritten, you need to force push:

```bash
git push --force-with-lease origin main
```

**Warning:** Coordinate with any collaborators. Force pushing rewrites remote history.
