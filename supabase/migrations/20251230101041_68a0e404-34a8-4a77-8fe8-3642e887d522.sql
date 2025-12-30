-- Add scheduled_at column to imported_media table for scheduling feature
ALTER TABLE public.imported_media 
ADD COLUMN IF NOT EXISTS scheduled_at timestamp with time zone DEFAULT NULL;