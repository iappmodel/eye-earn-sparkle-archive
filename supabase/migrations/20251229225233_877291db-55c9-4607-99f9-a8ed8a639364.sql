-- Create storage bucket for studio media
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'studio-media',
  'studio-media',
  true,
  104857600, -- 100MB limit for videos
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime']
);

-- Allow authenticated users to upload their own media
CREATE POLICY "Users can upload their own media"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'studio-media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to view their own media
CREATE POLICY "Users can view their own media"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'studio-media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow public read access for published content
CREATE POLICY "Public can view studio media"
ON storage.objects
FOR SELECT
USING (bucket_id = 'studio-media');

-- Allow users to update their own media
CREATE POLICY "Users can update their own media"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'studio-media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete their own media
CREATE POLICY "Users can delete their own media"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'studio-media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);