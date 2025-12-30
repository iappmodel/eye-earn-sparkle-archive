-- Add scheduling and draft fields to user_content
ALTER TABLE public.user_content
ADD COLUMN IF NOT EXISTS scheduled_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS is_draft boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS draft_saved_at timestamp with time zone;

-- Create content-uploads bucket for user content
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('content-uploads', 'content-uploads', true, 104857600)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for content uploads
CREATE POLICY "Users can upload their own content files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'content-uploads' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own content files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'content-uploads' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own content files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'content-uploads' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Public can view content uploads"
ON storage.objects FOR SELECT
USING (bucket_id = 'content-uploads');

-- Create index for scheduled content
CREATE INDEX IF NOT EXISTS idx_user_content_scheduled 
ON public.user_content(scheduled_at) 
WHERE scheduled_at IS NOT NULL AND status = 'scheduled';