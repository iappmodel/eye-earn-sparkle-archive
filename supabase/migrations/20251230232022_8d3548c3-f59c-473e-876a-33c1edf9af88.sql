-- Performance indexes for frequently queried tables

-- User content queries (feed, search)
CREATE INDEX IF NOT EXISTS idx_user_content_status_public_created 
ON public.user_content (status, is_public, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_content_user_id_status 
ON public.user_content (user_id, status);

CREATE INDEX IF NOT EXISTS idx_user_content_content_type 
ON public.user_content (content_type) WHERE status = 'published';

-- Content interactions (feed personalization)
CREATE INDEX IF NOT EXISTS idx_content_interactions_user_content 
ON public.content_interactions (user_id, content_id);

CREATE INDEX IF NOT EXISTS idx_content_interactions_created_at 
ON public.content_interactions (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_content_interactions_liked 
ON public.content_interactions (user_id) WHERE liked = true;

-- Content likes (engagement queries)
CREATE INDEX IF NOT EXISTS idx_content_likes_content_id 
ON public.content_likes (content_id);

CREATE INDEX IF NOT EXISTS idx_content_likes_user_content 
ON public.content_likes (user_id, content_id);

-- Comments (threaded comments, counts)
CREATE INDEX IF NOT EXISTS idx_comments_content_created 
ON public.comments (content_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_comments_parent_id 
ON public.comments (parent_id) WHERE parent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_comments_user_id 
ON public.comments (user_id);

-- Profiles (search, verification status)
CREATE INDEX IF NOT EXISTS idx_profiles_username 
ON public.profiles (username) WHERE username IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_verified 
ON public.profiles (is_verified) WHERE is_verified = true;

CREATE INDEX IF NOT EXISTS idx_profiles_user_id 
ON public.profiles (user_id);

-- Notifications (user inbox)
CREATE INDEX IF NOT EXISTS idx_notifications_user_seen_created 
ON public.notifications (user_id, seen, created_at DESC);

-- Messages (conversation queries)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
ON public.messages (conversation_id, created_at DESC);

-- Conversation participants
CREATE INDEX IF NOT EXISTS idx_conv_participants_user_id 
ON public.conversation_participants (user_id);

-- Transactions (wallet history)
CREATE INDEX IF NOT EXISTS idx_transactions_user_created 
ON public.transactions (user_id, created_at DESC);

-- Reward logs (analytics)
CREATE INDEX IF NOT EXISTS idx_reward_logs_user_created 
ON public.reward_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reward_logs_content_id 
ON public.reward_logs (content_id);

-- Promotions (nearby discovery)
CREATE INDEX IF NOT EXISTS idx_promotions_active_location 
ON public.promotions (is_active, latitude, longitude);

-- Content flags (moderation)
CREATE INDEX IF NOT EXISTS idx_content_flags_status 
ON public.content_flags (status) WHERE status = 'pending';

-- Device fingerprints (security)
CREATE INDEX IF NOT EXISTS idx_device_fingerprints_user_trusted 
ON public.device_fingerprints (user_id, is_trusted);

-- Imported media (studio)
CREATE INDEX IF NOT EXISTS idx_imported_media_user_status 
ON public.imported_media (user_id, status);

-- Following relationships (social)
CREATE INDEX IF NOT EXISTS idx_user_follows_follower 
ON public.user_follows (follower_id);

CREATE INDEX IF NOT EXISTS idx_user_follows_following 
ON public.user_follows (following_id);