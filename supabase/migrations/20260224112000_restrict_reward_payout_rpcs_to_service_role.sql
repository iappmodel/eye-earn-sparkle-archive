-- Restrict check_reward_rate_limit to service_role only.
REVOKE EXECUTE ON FUNCTION public.check_reward_rate_limit(TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
