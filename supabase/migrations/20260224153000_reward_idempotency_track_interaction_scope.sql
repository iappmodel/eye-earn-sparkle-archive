-- Extend shared idempotency scope allowlist so track-interaction can cache replay-safe responses.

ALTER TABLE public.reward_idempotency
  DROP CONSTRAINT IF EXISTS reward_idempotency_scope_check;

ALTER TABLE public.reward_idempotency
  ADD CONSTRAINT reward_idempotency_scope_check
  CHECK (scope IN (
    'issue_reward',
    'validate_attention',
    'verify_checkin',
    'track_interaction',
    'request_payout',
    'send_coin_gift',
    'submit_promotion_review'
  ));

