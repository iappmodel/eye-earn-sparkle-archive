-- Enable realtime for imported_media table
ALTER TABLE public.imported_media REPLICA IDENTITY FULL;

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.imported_media;