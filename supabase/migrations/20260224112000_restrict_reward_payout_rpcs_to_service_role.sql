-- Restrict reward/payout internal RPCs to service_role only.
-- These are invoked by Edge Functions and should not be callable directly from client rpc().

REVOKE EXECUTE ON FUNCTION public.check_reward_rate_limit(TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_reward_rate_limit(TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.issue_reward_atomic(UUID, UUID, TEXT, TEXT, INTEGER, NUMERIC, BOOLEAN, INTEGER, INTEGER, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_reward_atomic(UUID, UUID, TEXT, TEXT, INTEGER, NUMERIC, BOOLEAN, INTEGER, INTEGER, INTEGER, INTEGER)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.redeem_attention_reward(UUID, UUID, INTEGER, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_attention_reward(UUID, UUID, INTEGER, INTEGER, INTEGER)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.atomic_request_payout(UUID, INTEGER, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atomic_request_payout(UUID, INTEGER, TEXT, TEXT)
  TO service_role;
