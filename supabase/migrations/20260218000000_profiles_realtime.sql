-- Enable realtime for profiles table so balance updates (tips, rewards, payouts)
-- are reflected instantly in the UI without manual refresh
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
EXCEPTION WHEN duplicate_object THEN
  NULL; -- already in publication
END;
$$;
