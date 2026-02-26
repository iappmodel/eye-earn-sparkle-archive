/**
 * Stories API – fetch and view stories from user_content (content_type = 'story').
 * Stories are 24h content; one row per slide; grouped by user for the stories bar.
 */
import { supabase } from '@/integrations/supabase/client';
import { getPrimaryMediaUrl } from '@/utils/mediaUrl';

export interface StoryItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  duration?: number;
  createdAt: string;
}

export interface Story {
  id: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  items: StoryItem[];
  hasUnviewed: boolean;
}

interface UserContentRow {
  id: string;
  user_id: string;
  media_type: string | null;
  media_url: string | null;
  created_at: string;
  profiles: { username: string | null; avatar_url: string | null } | null;
}

/**
 * Fetch active stories (content_type = 'story', status = 'active', not expired).
 * Groups by user and attaches profile; marks hasUnviewed based on content_interactions for currentUser.
 */
export async function fetchStories(currentUserId: string | null): Promise<Story[]> {
  const now = new Date().toISOString();

  const { data: rows, error } = await supabase
    .from('user_content')
    .select('id, user_id, media_type, media_url, created_at')
    .eq('content_type', 'story')
    .eq('status', 'active')
    .eq('is_public', true)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[StoriesService] fetchStories error:', error);
    return [];
  }

  const contentRows = (rows ?? []) as unknown as Omit<UserContentRow, 'profiles'>[];
  const withProfiles = await attachProfilesToStoryRows(contentRows);
  return buildStoriesFromRows(withProfiles, currentUserId);
}

/** Attach profile (username, avatar) to story rows. */
async function attachProfilesToStoryRows(
  rows: Omit<UserContentRow, 'profiles'>[]
): Promise<UserContentRow[]> {
  if (rows.length === 0) return [];
  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const { data: profiles } = await supabase
    .from('public_profiles')
    .select('user_id, username, avatar_url')
    .in('user_id', userIds);
  const byUser = new Map(
    (profiles ?? []).map((p: { user_id: string; username: string | null; avatar_url: string | null }) => [
      p.user_id,
      { username: p.username, avatar_url: p.avatar_url },
    ])
  );
  return rows.map((r) => ({
    ...r,
    profiles: byUser.get(r.user_id) ?? null,
  }));
}

async function buildStoriesFromRows(
  rows: UserContentRow[],
  currentUserId: string | null
): Promise<Story[]> {
  if (rows.length === 0) return [];

  const contentIds = rows.map((r) => r.id);
  let viewedIds = new Set<string>();
  if (currentUserId) {
    const { data: interactions } = await supabase
      .from('content_interactions')
      .select('content_id')
      .eq('user_id', currentUserId)
      .in('content_id', contentIds);
    if (interactions) {
      viewedIds = new Set(interactions.map((i: { content_id: string }) => i.content_id));
    }
  }

  const byUser = new Map<
    string,
    { userId: string; username: string; avatarUrl?: string; items: StoryItem[]; contentIds: string[] }
  >();

  for (const r of rows) {
    const url = getPrimaryMediaUrl(r.media_url) ?? r.media_url ?? '';
    if (!url) continue;
    const mediaType = (r.media_type ?? 'image').toLowerCase();
    const type: 'image' | 'video' = mediaType === 'video' ? 'video' : 'image';
    const item: StoryItem = {
      id: r.id,
      type,
      url,
      duration: type === 'video' ? undefined : 5000,
      createdAt: r.created_at,
    };
    const profile = r.profiles;
    const username = profile?.username ?? `user_${r.user_id.slice(0, 8)}`;
    const avatarUrl = profile?.avatar_url ?? undefined;

    if (!byUser.has(r.user_id)) {
      byUser.set(r.user_id, {
        userId: r.user_id,
        username,
        avatarUrl,
        items: [],
        contentIds: [],
      });
    }
    const entry = byUser.get(r.user_id)!;
    entry.items.push(item);
    entry.contentIds.push(r.id);
  }

  const stories: Story[] = [];
  for (const [, entry] of byUser) {
    const hasUnviewed = currentUserId
      ? entry.contentIds.some((id) => !viewedIds.has(id))
      : true;
    stories.push({
      id: entry.userId,
      userId: entry.userId,
      username: entry.username,
      avatarUrl: entry.avatarUrl,
      items: entry.items,
      hasUnviewed,
    });
  }

  return stories;
}

/**
 * Record that the current user viewed a story item (for hasUnviewed and analytics).
 */
export async function recordStoryView(contentId: string, _contentOwnerId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  try {
    const eventNonce = crypto.randomUUID();
    await supabase.functions.invoke('track-interaction', {
      headers: {
        'Idempotency-Key': eventNonce,
      },
      body: {
        contentId,
        eventNonce,
        contentType: 'story',
        action: 'view_complete',
        watchDuration: 1,
        totalDuration: 1,
        attentionScore: 0,
      },
    });
  } catch (error) {
    console.warn('[StoriesService] Failed to record story view via track-interaction:', error);
  }
}
