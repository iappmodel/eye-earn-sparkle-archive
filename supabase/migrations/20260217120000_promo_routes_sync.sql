-- Promo routes: save routes server-side for sync across devices
CREATE TABLE IF NOT EXISTS public.promo_routes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'My Route',
  transport_mode text NOT NULL DEFAULT 'walking' CHECK (transport_mode IN ('walking','driving','transit','cycling','running')),
  filters jsonb NOT NULL DEFAULT '{"rewardTypes":["vicoin","icoin","both"],"optimization":"balanced","maxStops":10,"maxDistance":20,"categories":[],"minRewardPerStop":0}'::jsonb,
  is_commute_route boolean NOT NULL DEFAULT false,
  origin jsonb,
  destination jsonb,
  schedule jsonb,
  segment_transport jsonb NOT NULL DEFAULT '{}'::jsonb,
  smart_label text,
  total_reward integer NOT NULL DEFAULT 0,
  estimated_time integer,
  estimated_distance numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_promo_routes_user_id ON public.promo_routes(user_id);
CREATE INDEX IF NOT EXISTS idx_promo_routes_updated_at ON public.promo_routes(updated_at DESC);

-- Stops for each route (ordered)
CREATE TABLE IF NOT EXISTS public.promo_route_stops (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id uuid NOT NULL REFERENCES public.promo_routes(id) ON DELETE CASCADE,
  promotion_id text NOT NULL,
  business_name text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  address text,
  category text,
  reward_type text NOT NULL CHECK (reward_type IN ('vicoin','icoin','both')),
  reward_amount integer NOT NULL DEFAULT 0,
  required_action text,
  "order" integer NOT NULL DEFAULT 0,
  from_feed boolean DEFAULT false,
  content_id text
);

CREATE INDEX IF NOT EXISTS idx_promo_route_stops_route_id ON public.promo_route_stops(route_id);

-- Watch later (saved promos to add to routes later)
CREATE TABLE IF NOT EXISTS public.promo_watch_later (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  promotion_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, promotion_id)
);

CREATE INDEX IF NOT EXISTS idx_promo_watch_later_user_id ON public.promo_watch_later(user_id);

-- RLS
ALTER TABLE public.promo_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_route_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promo_watch_later ENABLE ROW LEVEL SECURITY;

-- promo_routes policies
DROP POLICY IF EXISTS "Users can view own promo routes" ON public.promo_routes;
CREATE POLICY "Users can view own promo routes" ON public.promo_routes FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own promo routes" ON public.promo_routes;
CREATE POLICY "Users can insert own promo routes" ON public.promo_routes FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own promo routes" ON public.promo_routes;
CREATE POLICY "Users can update own promo routes" ON public.promo_routes FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own promo routes" ON public.promo_routes;
CREATE POLICY "Users can delete own promo routes" ON public.promo_routes FOR DELETE USING (auth.uid() = user_id);

-- promo_route_stops: access via route ownership
DROP POLICY IF EXISTS "Users can view own route stops" ON public.promo_route_stops;
CREATE POLICY "Users can view own route stops" ON public.promo_route_stops FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.promo_routes r WHERE r.id = route_id AND r.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can insert own route stops" ON public.promo_route_stops;
CREATE POLICY "Users can insert own route stops" ON public.promo_route_stops FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.promo_routes r WHERE r.id = route_id AND r.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can update own route stops" ON public.promo_route_stops;
CREATE POLICY "Users can update own route stops" ON public.promo_route_stops FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.promo_routes r WHERE r.id = route_id AND r.user_id = auth.uid()));
DROP POLICY IF EXISTS "Users can delete own route stops" ON public.promo_route_stops;
CREATE POLICY "Users can delete own route stops" ON public.promo_route_stops FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.promo_routes r WHERE r.id = route_id AND r.user_id = auth.uid()));

-- promo_watch_later policies
DROP POLICY IF EXISTS "Users can view own promo watch later" ON public.promo_watch_later;
CREATE POLICY "Users can view own promo watch later" ON public.promo_watch_later FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own promo watch later" ON public.promo_watch_later;
CREATE POLICY "Users can insert own promo watch later" ON public.promo_watch_later FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own promo watch later" ON public.promo_watch_later;
CREATE POLICY "Users can update own promo watch later" ON public.promo_watch_later FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own promo watch later" ON public.promo_watch_later;
CREATE POLICY "Users can delete own promo watch later" ON public.promo_watch_later FOR DELETE USING (auth.uid() = user_id);

-- Trigger to set updated_at on promo_routes
CREATE OR REPLACE FUNCTION public.set_promo_routes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS promo_routes_updated_at ON public.promo_routes;
CREATE TRIGGER promo_routes_updated_at
  BEFORE UPDATE ON public.promo_routes
  FOR EACH ROW EXECUTE PROCEDURE public.set_promo_routes_updated_at();
