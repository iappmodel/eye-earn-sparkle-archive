/**
 * Friends Feed Service – fetch posts from users the current user follows.
 * Uses user_follows + user_content + profiles.
 */
import { supabase } from '@/integrations/supabase/client';
import { getFollowingIds } from './follow.service';
import { getPrimaryMediaUrl } from '@/utils/mediaUrl';
import type { VideoTheme } from '@/components/ui/Neu3DButton';

const THEMES: VideoTheme[] = ['rose', 'emerald', 'gold', 'cyan', 'purple', 'magenta'];
const DEFAULT_AVATAR = 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=100&h=100&fit=crop';
const DEFAULT_THUMB = 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=1080&h=1920&fit=crop';
const DEFAULT_DURATION = 15;
const FRIENDS_FEED_LIMIT = 50;

export interface FriendsFeedPostRow {
  id: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  caption: string | null;
  title: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  media_type: string | null;
  likes_count: number | null;
  comments_count: number | null;
  published_at: string | null;
  created_at: string;
  location_address: string | null;
}

export interface FriendPostFromApi {
  id: string;
  userId: string;
  username: string;
  displayName?: string;
  avatar: string;
  videoUrl: string;
  thumbnail: string;
  caption: string;
  likes: number;
  comments: number;
  duration: number;
  isLiked: boolean;
  isSaved: boolean;
  isFollowing: boolean;
  theme: VideoTheme;
  createdAt: string;
  location?: string;
}

export interface FriendsFeedResult {
  posts: FriendPostFromApi[];
  followingCount: number;
}

/**
 * Fetch posts from users that the current user follows.
 * Returns items sorted by published_at desc.
 * Exposes followingCount so UI can show appropriate empty state when following 0.
 */
export async function fetchFriendsFeed(userId: string): Promise<FriendsFeedResult> {
  const followingIds = await getFollowingIds(userId, 200);
  if (followingIds.length === 0) return { posts: [], followingCount: 0 };

  const { data: contentRows, error: contentError } = await supabase
    .from('user_content')
    .select(
      'id, user_id, caption, title, media_url, thumbnail_url, media_type, likes_count, comments_count, published_at, created_at, location_address'
    )
    .in('user_id', followingIds)
    .eq('is_public', true)
    .eq('status', 'active')
    .eq('is_draft', false)
    .not('media_url', 'is', null)
    .order('published_at', { ascending: false })
    .limit(FRIENDS_FEED_LIMIT);

  if (contentError) {
    console.error('[FriendsFeed] content query error:', contentError);
    return { posts: [], followingCount: followingIds.length };
  }

  if (!contentRows?.length) return { posts: [], followingCount: followingIds.length };

  const userIds = [...new Set((contentRows as { user_id: string }[]).map((r) => r.user_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, username, display_name, avatar_url')
    .in('user_id', userIds);

  const profileByUserId = new Map(
    (profiles ?? []).map((p: { user_id: string; username: string | null; display_name: string | null; avatar_url: string | null }) => [
      p.user_id,
      { username: p.username, display_name: p.display_name, avatar_url: p.avatar_url },
    ])
  );

  const rows: FriendsFeedPostRow[] = (contentRows as Record<string, unknown>[]).map((row) => {
    const p = profileByUserId.get(row.user_id as string);
    return {
      id: row.id as string,
      user_id: row.user_id as string,
      username: p?.username ?? null,
      display_name: p?.display_name ?? null,
      avatar_url: p?.avatar_url ?? null,
      caption: row.caption as string | null,
      title: row.title as string | null,
      media_url: row.media_url as string | null,
      thumbnail_url: row.thumbnail_url as string | null,
      media_type: row.media_type as string | null,
      likes_count: row.likes_count as number | null,
      comments_count: row.comments_count as number | null,
      published_at: row.published_at as string | null,
      created_at: row.created_at as string,
      location_address: row.location_address as string | null,
    };
  });

  const posts = rows.map((row, index): FriendPostFromApi => {
    const mediaUrl = getPrimaryMediaUrl(row.media_url);
    const thumb = row.thumbnail_url || mediaUrl || DEFAULT_THUMB;
    const videoUrl = row.media_type === 'video' ? (mediaUrl || thumb) : thumb;
    const theme = THEMES[index % THEMES.length];
    const createdAt = row.published_at || row.created_at;

    return {
      id: row.id,
      userId: row.user_id,
      username: row.username ?? `user_${row.user_id.slice(0, 8)}`,
      displayName: row.display_name ?? undefined,
      avatar: row.avatar_url || DEFAULT_AVATAR,
      videoUrl,
      thumbnail: thumb,
      caption: row.caption || row.title || '',
      likes: row.likes_count ?? 0,
      comments: row.comments_count ?? 0,
      duration: DEFAULT_DURATION,
      isLiked: false,
      isSaved: false,
      isFollowing: true,
      theme,
      createdAt,
      location: row.location_address ?? undefined,
    };
  });

  return { posts, followingCount: followingIds.length };
}
