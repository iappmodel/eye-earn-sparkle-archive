-- Session artifacts should not be world-readable/writeable from the client.
-- Preserve frontend eligibility checks by allowing self SELECT only.

ALTER TABLE public.reward_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attention_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own reward sessions" ON public.reward_sessions;
CREATE POLICY "Users can view own reward sessions"
ON public.reward_sessions
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own attention sessions" ON public.attention_sessions;
CREATE POLICY "Users can view own attention sessions"
ON public.attention_sessions
FOR SELECT
USING (auth.uid() = user_id);

COMMENT ON TABLE public.reward_sessions
  IS 'Server-issued non-promo reward sessions. Client may read only own rows; writes occur via service-role functions.';

COMMENT ON TABLE public.attention_sessions
  IS 'Server-issued attention validation sessions. Client may read only own rows; writes/redeems occur via service-role functions.';
