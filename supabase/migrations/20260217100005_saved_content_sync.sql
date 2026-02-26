-- Saved content (Save for later): table and RLS for syncing across devices
CREATE TABLE IF NOT EXISTS public.saved_content (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb,
  UNIQUE(user_id, content_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_content_user_id ON public.saved_content(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_content_created_at ON public.saved_content(created_at DESC);

-- Add metadata column if table already existed without it
ALTER TABLE public.saved_content
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Ensure unique (user_id, content_id) for upsert when table already existed without it
DO $$
BEGIN
  ALTER TABLE public.saved_content
  ADD CONSTRAINT saved_content_user_id_content_id_key UNIQUE (user_id, content_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN duplicate_table THEN NULL;  -- index/constraint name already exists
END $$;

ALTER TABLE public.saved_content ENABLE ROW LEVEL SECURITY;

-- Idempotent policies: drop if exists then create
DROP POLICY IF EXISTS "Users can view own saved content" ON public.saved_content;
CREATE POLICY "Users can view own saved content"
ON public.saved_content FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own saved content" ON public.saved_content;
CREATE POLICY "Users can insert own saved content"
ON public.saved_content FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own saved content" ON public.saved_content;
CREATE POLICY "Users can delete own saved content"
ON public.saved_content FOR DELETE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own saved content" ON public.saved_content;
CREATE POLICY "Users can update own saved content"
ON public.saved_content FOR UPDATE
USING (auth.uid() = user_id);
