-- content_interactions is used as a proof/input source for rewards and task progression.
-- Client direct writes allow fabricated shares/watch events. Writes should go through track-interaction only.
DROP POLICY IF EXISTS "Users can insert their own interactions" ON public.content_interactions;
DROP POLICY IF EXISTS "Users can update their own interactions" ON public.content_interactions;

