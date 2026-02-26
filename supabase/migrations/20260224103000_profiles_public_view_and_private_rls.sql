-- Harden profiles privacy:
-- 1) Public/social reads go through public.public_profiles (safe columns only)
-- 2) Sensitive columns on public.profiles are self-only (plus admin/moderator access)

-- Public-safe profile projection used across feed/chat/social UIs
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT
  p.id,
  p.user_id,
  p.username,
  p.display_name,
  p.avatar_url,
  p.cover_photo_url,
  p.bio,
  p.social_links,
  p.followers_count,
  p.following_count,
  p.total_views,
  p.total_likes,
  p.is_verified,
  p.show_timed_interactions,
  p.show_contributor_badges,
  p.created_at,
  p.updated_at
FROM public.profiles p;

COMMENT ON VIEW public.public_profiles IS
  'Public profile fields only. Excludes balances, KYC status, phone, and calibration data.';

GRANT SELECT ON TABLE public.public_profiles TO anon, authenticated;

-- Replace permissive profiles SELECT with least-privilege access
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins and moderators can view all profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins and moderators can view all profiles"
  ON public.profiles
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
  );
