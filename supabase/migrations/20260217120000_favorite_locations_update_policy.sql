-- Allow users to update their own favorites (for notes, etc.)
CREATE POLICY "Users can update their own favorites"
ON public.favorite_locations FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
