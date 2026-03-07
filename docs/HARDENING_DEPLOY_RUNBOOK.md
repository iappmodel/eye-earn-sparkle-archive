# Hardening Deploy Runbook

This runbook is for deploying the reward/security hardening work and validating it in production.

## 1) Prerequisites

- Supabase CLI authenticated and linked to the target project:
  - `supabase login`
  - `supabase link --project-ref <YOUR_PROJECT_REF>`
- App deps installed:
  - `pnpm install`
- Deno available (for function tests):
  - `deno --version`

## 2) Verify Before Deploy

Run function tests:

```bash
pnpm test:functions
```

Expected: all passing.

## 3) Apply Database Migrations

Preferred (full repo sync):

```bash
supabase db push
```

This applies all pending local migrations in timestamp order.

### Hardening migration set (reference)

If you need to review/apply the hardening subset explicitly, these are the core files:

- `supabase/migrations/20260224103000_profiles_public_view_and_private_rls.sql`
- `supabase/migrations/20260224104500_reward_idempotency_request_payout_scope.sql`
- `supabase/migrations/20260224110000_attention_sessions_expiry.sql`
- `supabase/migrations/20260224112000_restrict_reward_payout_rpcs_to_service_role.sql`
- `supabase/migrations/20260224112001_grant_check_reward_rate_limit.sql`
- `supabase/migrations/20260224112002_restrict_issue_reward_atomic.sql`
- `supabase/migrations/20260224112004_grant_issue_reward_atomic.sql`
- `supabase/migrations/20260224112005_restrict_redeem_attention_reward.sql`
- `supabase/migrations/20260224112006_grant_redeem_attention_reward.sql`
- `supabase/migrations/20260224112007_restrict_atomic_request_payout.sql`
- `supabase/migrations/20260224112008_grant_atomic_request_payout.sql`
- `supabase/migrations/20260224113000_atomic_send_coin_gift.sql`
- `supabase/migrations/20260224115000_redeem_attention_reward_enforce_session_expiry.sql`
- `supabase/migrations/20260224120500_lock_down_coin_gifts_insert_to_server.sql`
- `supabase/migrations/20260224122000_reward_idempotency_send_coin_gift_scope.sql`
- `supabase/migrations/20260224123500_lock_down_reward_and_attention_sessions_rls.sql`
- `supabase/migrations/20260224130000_lock_down_user_achievements_insert.sql`
- `supabase/migrations/20260224131500_lock_down_promotion_checkins_writes.sql`
- `supabase/migrations/20260224133000_reward_idempotency_submit_promotion_review_scope.sql`
- `supabase/migrations/20260224133500_lock_down_promotion_reviews_insert.sql`
- `supabase/migrations/20260224134500_lock_down_promotion_claims_writes.sql`
- `supabase/migrations/20260224140000_finalize_promotion_checkin_reward_atomic.sql`
- `supabase/migrations/20260224141500_lock_down_user_levels_writes.sql`
- `supabase/migrations/20260224143000_lock_down_user_tasks_writes.sql`
- `supabase/migrations/20260224144500_lock_down_content_interactions_writes.sql`
- `supabase/migrations/20260224145000_lock_down_user_preferences_writes.sql`
- `supabase/migrations/20260224150000_content_interactions_action_cooldown_timestamps.sql`
- `supabase/migrations/20260224151500_interaction_event_nonces.sql`
- `supabase/migrations/20260224153000_reward_idempotency_track_interaction_scope.sql`
- `supabase/migrations/20260224154500_cleanup_interaction_event_nonces_rpc.sql`
- `supabase/migrations/20260224160000_cleanup_interaction_event_nonces_global_rpc.sql`
- `supabase/migrations/20260224161500_schedule_interaction_event_nonces_cleanup_cron.sql`
- `supabase/migrations/20260224163000_track_interaction_health_stats_rpc.sql`

## 4) Deploy Edge Functions

Deploy in this order (dependency-aware):

```bash
supabase functions deploy validate-attention
supabase functions deploy issue-reward
supabase functions deploy request-payout
supabase functions deploy send-coin-gift
supabase functions deploy submit-promotion-review
supabase functions deploy verify-checkin
supabase functions deploy sync-user-tasks
supabase functions deploy update-task-progress
supabase functions deploy track-interaction
supabase functions deploy track-interaction-health
```

## 5) Deploy Frontend (PWA)

Build and deploy using your standard flow:

```bash
pnpm build
```

Then deploy to your host (Vercel/Netlify/etc.) with your existing pipeline.

## 6) Post-Deploy Smoke Checks

## Wallet + rewards

- Promo view reward requires valid `attentionSessionId`.
- Expired attention session is rejected.
- Replaying same attention session is rejected.
- Task rewards/achievement XP are server-authoritative.

## Promo action hardening

- `checkin` / `leave_review` reward paths work only with valid proof.
- Unsupported promo actions do not mint rewards.

## Interaction anti-fraud

- `track-interaction` cooldown and nonce dedup paths return expected errors/success.
- Admin analytics "Interaction anti-fraud" card loads.
- Cleanup history pagination (`Newest/Newer/Older`), filters, and page-size selector (`8/16/25`) work.
- `Run cleanup` executes and writes an `admin_actions` record.

## 7) Known Operational Notes

- `pnpm test:functions` now uses local `deno` directly and fails fast if Deno is missing.
- If cron is unavailable in your Supabase tier, the scheduled cleanup migration is best-effort and should not block deploy.
