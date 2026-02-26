REVOKE EXECUTE ON FUNCTION public.atomic_request_payout(UUID, INTEGER, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
