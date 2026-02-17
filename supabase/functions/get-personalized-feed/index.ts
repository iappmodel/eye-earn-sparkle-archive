import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_LIMIT = 15;
const MAX_LIMIT = 30;
const POOL_SIZE = 80;

type ContentSource = 'user_content' | 'promotion';

interface ScoredItem {
  id: string;
  source: ContentSource;
  type: 'video' | 'image' | 'promo';
  title: string;
  category: string;
  tags: string[];
  reward: number;
  coinType: 'icoin' | 'vicoin';
  thumbnail: string;
  videoSrc?: string | null;
  duration: number;
  score: number;
  reason: string;
  publishedAt?: string;
  likes_count?: number;
  creator: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
  };
  latitude?: number;
  longitude?: number;
}

// Sample content for cold start when DB is empty (same shape as real items)
const SAMPLE_CONTENT: ScoredItem[] = [
  { id: '1', source: 'user_content', type: 'video', title: 'Morning Workout Routine', category: 'fitness', tags: ['fitness', 'health', 'morning'], reward: 5, coinType: 'icoin', thumbnail: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400', duration: 120, score: 50, reason: 'Trending', creator: { id: 'c1', username: 'fitlife', displayName: 'FitLife', avatarUrl: null } },
  { id: '2', source: 'user_content', type: 'video', title: 'Tech News Update', category: 'tech', tags: ['tech', 'news', 'gadgets'], reward: 3, coinType: 'icoin', thumbnail: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400', duration: 90, score: 50, reason: 'Trending', creator: { id: 'c2', username: 'tech_daily', displayName: 'Tech Daily', avatarUrl: null } },
  { id: '3', source: 'user_content', type: 'video', title: 'Cooking Masterclass', category: 'food', tags: ['food', 'cooking', 'recipes'], reward: 4, coinType: 'icoin', thumbnail: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400', duration: 180, score: 50, reason: 'Trending', creator: { id: 'c3', username: 'chef_mode', displayName: 'Chef Mode', avatarUrl: null } },
  { id: '4', source: 'user_content', type: 'video', title: 'Travel Adventures', category: 'travel', tags: ['travel', 'adventure', 'explore'], reward: 6, coinType: 'vicoin', thumbnail: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400', duration: 150, score: 50, reason: 'Trending', creator: { id: 'c4', username: 'wanderer', displayName: 'Wanderer', avatarUrl: null } },
  { id: '5', source: 'user_content', type: 'video', title: 'Financial Tips', category: 'finance', tags: ['finance', 'money', 'investing'], reward: 8, coinType: 'vicoin', thumbnail: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400', duration: 200, score: 50, reason: 'Trending', creator: { id: 'c5', username: 'money_smart', displayName: 'Money Smart', avatarUrl: null } },
  { id: '6', source: 'user_content', type: 'video', title: 'Music Production', category: 'entertainment', tags: ['music', 'creative', 'production'], reward: 4, coinType: 'icoin', thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400', duration: 240, score: 50, reason: 'Trending', creator: { id: 'c6', username: 'beat_maker', displayName: 'Beat Maker', avatarUrl: null } },
  { id: '7', source: 'user_content', type: 'video', title: 'Yoga & Meditation', category: 'fitness', tags: ['fitness', 'wellness', 'meditation'], reward: 5, coinType: 'icoin', thumbnail: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400', duration: 300, score: 50, reason: 'Trending', creator: { id: 'c7', username: 'calm_life', displayName: 'Calm Life', avatarUrl: null } },
  { id: '8', source: 'user_content', type: 'video', title: 'Startup Stories', category: 'business', tags: ['business', 'startup', 'entrepreneur'], reward: 7, coinType: 'vicoin', thumbnail: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=400', duration: 180, score: 50, reason: 'Trending', creator: { id: 'c8', username: 'founder_talk', displayName: 'Founder Talk', avatarUrl: null } },
  { id: '9', source: 'user_content', type: 'video', title: 'Gaming Highlights', category: 'entertainment', tags: ['gaming', 'esports', 'entertainment'], reward: 3, coinType: 'icoin', thumbnail: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400', duration: 120, score: 50, reason: 'Trending', creator: { id: 'c9', username: 'game_on', displayName: 'Game On', avatarUrl: null } },
  { id: '10', source: 'user_content', type: 'video', title: 'Local Events Near You', category: 'local', tags: ['local', 'events', 'community'], reward: 10, coinType: 'vicoin', thumbnail: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400', duration: 60, score: 50, reason: 'Trending', creator: { id: 'c10', username: 'local_guide', displayName: 'Local Guide', avatarUrl: null } },
];

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    let userPreferences: { liked_tags?: string[]; disliked_tags?: string[]; preferred_categories?: string[]; last_seen_content?: string[] } | null = null;
    let interactions: { category: string | null; watch_completion_rate?: number; attention_score?: number; content_id: string }[] = [];

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;

      if (userId) {
        const { data: prefs } = await supabase
          .from('user_preferences')
          .select('liked_tags, disliked_tags, preferred_categories, last_seen_content')
          .eq('user_id', userId)
          .maybeSingle();
        userPreferences = prefs ?? null;

        const { data: recentInteractions } = await supabase
          .from('content_interactions')
          .select('content_id, category, watch_completion_rate, attention_score')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50);
        interactions = recentInteractions || [];
      }
    }

    const body = await req.json().catch(() => ({}));
    const { latitude, longitude, limit = DEFAULT_LIMIT, excludeIds = [] } = body;
    const take = Math.min(Math.max(1, Number(limit) || DEFAULT_LIMIT), MAX_LIMIT);
    const excludeSet = new Set(Array.isArray(excludeIds) ? excludeIds : []);

    console.log('[PersonalizedFeed] Request:', { userId, hasPrefs: !!userPreferences, interactionCount: interactions.length, excludeCount: excludeSet.size });

    const pool: ScoredItem[] = [];

    // 1. Fetch user_content (public, active, with media)
    // likes_count is synced by DB triggers from content_likes
    const { data: contentRows, error: contentError } = await supabase
      .from('user_content')
      .select('id, user_id, title, caption, media_url, thumbnail_url, media_type, tags, reward_type, content_type, published_at, likes_count')
      .eq('is_public', true)
      .eq('status', 'active')
      .eq('is_draft', false)
      .not('media_url', 'is', null)
      .order('published_at', { ascending: false })
      .limit(POOL_SIZE);

    const profileMap = new Map<string, { username: string; display_name: string; avatar_url: string | null }>();

    if (!contentError && contentRows && contentRows.length > 0) {
      const userIds = [...new Set(contentRows.map((r: { user_id: string }) => r.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, display_name, avatar_url')
        .in('user_id', userIds);

      for (const p of profiles || []) {
        profileMap.set(p.user_id, {
          username: p.username || `user_${p.user_id.slice(0, 8)}`,
          display_name: p.display_name || p.username || p.user_id,
          avatar_url: p.avatar_url ?? null,
        });
      }

      const defaultThumb = 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=400';
      for (const row of contentRows) {
        if (excludeSet.has(row.id)) continue;
        const profile = profileMap.get(row.user_id);
        const mediaType = row.media_type || 'video';
        let thumbnail = row.thumbnail_url;
        if (!thumbnail && row.media_url) {
          if (row.media_url.startsWith('[')) {
            try {
              const arr = JSON.parse(row.media_url) as unknown[];
              thumbnail = Array.isArray(arr) && arr.length ? String(arr[0]) : row.media_url;
            } catch {
              thumbnail = row.media_url;
            }
          } else thumbnail = row.media_url;
        }
        const tags = Array.isArray(row.tags) ? row.tags : (row.tags ? [row.tags] : []);
        const category = tags[0] || 'general';
        pool.push({
          id: row.id,
          source: 'user_content',
          type: row.content_type === 'promotion' ? 'promo' : (mediaType === 'image' || mediaType === 'carousel' ? 'image' : 'video'),
          likes_count: row.likes_count ?? 0,
          title: row.title || row.caption || 'Untitled',
          category,
          tags,
          reward: 10,
          coinType: (row.reward_type as 'icoin' | 'vicoin') || 'vicoin',
          thumbnail: thumbnail || defaultThumb,
          videoSrc: mediaType === 'video' ? (thumbnail || row.media_url) : undefined,
          duration: 30,
          score: 50,
          reason: 'Trending',
          publishedAt: row.published_at,
          creator: {
            id: row.user_id,
            username: profile?.username || `user_${row.user_id.slice(0, 8)}`,
            displayName: profile?.display_name || 'Creator',
            avatarUrl: profile?.avatar_url ?? null,
          },
        });
      }
    }

    // 2. Fetch promotions (active, not expired)
    const { data: promos, error: promosError } = await supabase
      .from('promotions')
      .select('id, business_id, business_name, description, image_url, video_url, reward_type, reward_amount, latitude, longitude, category')
      .eq('is_active', true)
      .or('expires_at.is.null,expires_at.gt.now()')
      .limit(POOL_SIZE);

    if (!promosError && promos && promos.length > 0) {
      const defaultImg = 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=400';
      for (const p of promos) {
        if (excludeSet.has(p.id)) continue;
        const category = (p.category || 'general').toString().toLowerCase().replace(/\s+/g, '_');
        const tags = [category, 'promo', 'local'];
        pool.push({
          id: p.id,
          source: 'promotion',
          type: 'promo',
          title: p.business_name,
          category,
          tags,
          reward: p.reward_amount,
          coinType: p.reward_type === 'both' ? 'vicoin' : (p.reward_type as 'icoin' | 'vicoin'),
          thumbnail: p.image_url || defaultImg,
          videoSrc: p.video_url || undefined,
          duration: 10,
          score: 50,
          reason: 'Trending',
          creator: {
            id: p.business_id || p.id,
            username: p.business_name.toLowerCase().replace(/\s+/g, '_'),
            displayName: p.business_name,
            avatarUrl: p.image_url ?? null,
          },
          latitude: p.latitude,
          longitude: p.longitude,
        });
      }
    }

    // Use sample content when pool is empty
    const candidates = pool.length > 0
      ? pool
      : SAMPLE_CONTENT.filter((c) => !excludeSet.has(c.id));

    // Score each candidate
    const scoredContent = candidates.map((content) => {
      let score = 50;
      let reason = 'Trending';

      if (!userPreferences && interactions.length === 0) {
        score += content.reward * 2;
        if (content.category === 'local' && latitude != null && longitude != null) {
          score += 20;
          reason = 'Near you';
        }
        if (content.latitude != null && content.longitude != null && latitude != null && longitude != null) {
          const km = haversineKm(latitude, longitude, content.latitude, content.longitude);
          if (km < 10) score += 25;
          if (km < 3) score += 15;
          reason = 'Near you';
        }
        return { ...content, score, reason };
      }

      if (userPreferences?.liked_tags?.length) {
        const matched = content.tags.filter((t) => userPreferences!.liked_tags!.includes(t));
        score += matched.length * 15;
        if (matched.length > 0) reason = `Based on: ${matched[0]}`;
      }
      if (userPreferences?.disliked_tags?.length) {
        const disliked = content.tags.filter((t) => userPreferences!.disliked_tags!.includes(t));
        score -= disliked.length * 20;
      }
      if (userPreferences?.preferred_categories?.includes(content.category)) {
        score += 25;
        reason = `You like ${content.category}`;
      }

      const categoryInteractions = interactions.filter((i) => i.category === content.category);
      if (categoryInteractions.length > 0) {
        const avgCompletion = categoryInteractions.reduce((s, i) => s + (Number(i.watch_completion_rate) || 0), 0) / categoryInteractions.length;
        const avgAttention = categoryInteractions.reduce((s, i) => s + (Number(i.attention_score) || 0), 0) / categoryInteractions.length;
        score += avgCompletion * 0.3 + avgAttention * 0.2;
        if (avgCompletion > 80) reason = 'You watch this category';
      }

      if (userPreferences?.last_seen_content?.includes(content.id)) score -= 30;

      if (content.latitude != null && content.longitude != null && latitude != null && longitude != null) {
        const km = haversineKm(latitude, longitude, content.latitude, content.longitude);
        if (km < 10) score += 15;
        if (km < 3) score += 10;
        reason = 'Near you';
      }

      // Freshness: boost recent content
      if (content.publishedAt) {
        const days = (Date.now() - new Date(content.publishedAt).getTime()) / (24 * 60 * 60 * 1000);
        if (days < 1) score += 12;
        else if (days < 7) score += 6;
      }

      // Diversity
      if (Math.random() < 0.15) {
        score += 10;
        reason = 'Discover something new';
      }

      return { ...content, score, reason };
    });

    scoredContent.sort((a, b) => b.score - a.score);

    const feedSlice = scoredContent.slice(0, take);
    const hasMore = scoredContent.length > take;
    const nextCursor = hasMore && feedSlice.length > 0
      ? [...(Array.isArray(excludeIds) ? excludeIds : []), ...feedSlice.map((c) => c.id)]
      : null;

    const feed = feedSlice.map((content, index) => ({
      ...content,
      position: index + 1,
      personalized: !!userPreferences || interactions.length > 0,
      aiEnhanced: false,
    }));

    console.log('[PersonalizedFeed] Returning', feed.length, 'items, hasMore:', hasMore);

    return new Response(
      JSON.stringify({
        success: true,
        feed,
        meta: {
          userId,
          personalized: !!userPreferences || interactions.length > 0,
          interactionCount: interactions.length,
          coldStart: !userPreferences && interactions.length === 0,
          hasMore: !!hasMore,
          nextCursor,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[PersonalizedFeed] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message, success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
