import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ContentItem {
  id: string;
  score: number;
  reasons: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    const { limit = 20, offset = 0, category } = await req.json().catch(() => ({}));

    console.log(`[SmartFeed] Generating feed for user: ${userId || 'anonymous'}`);

    // Fetch all published content
    let query = supabase
      .from('user_content')
      .select(`
        id,
        user_id,
        media_type,
        media_url,
        thumbnail_url,
        caption,
        tags,
        views_count,
        likes_count,
        comments_count,
        shares_count,
        created_at,
        profiles!user_content_user_id_fkey (
          username,
          display_name,
          avatar_url,
          is_verified
        )
      `)
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(100);

    if (category) {
      query = query.contains('tags', [category]);
    }

    const { data: content, error: contentError } = await query;

    if (contentError) throw contentError;

    // Get user preferences if authenticated
    let userPreferences: any = null;
    let userInteractions: any[] = [];

    if (userId) {
      const [prefsResult, interactionsResult] = await Promise.all([
        supabase
          .from('user_preferences')
          .select('*')
          .eq('user_id', userId)
          .single(),
        supabase
          .from('content_interactions')
          .select('content_id, liked, watch_completion_rate, attention_score')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(50)
      ]);

      userPreferences = prefsResult.data;
      userInteractions = interactionsResult.data || [];
    }

    // Create interaction map
    const interactionMap = new Map(
      userInteractions.map(i => [i.content_id, i])
    );

    // Calculate engagement-weighted scores
    const scoredContent: ContentItem[] = (content || []).map(item => {
      let score = 0;
      const reasons: string[] = [];

      // Base engagement score (normalized)
      const views = item.views_count || 0;
      const likes = item.likes_count || 0;
      const comments = item.comments_count || 0;
      const shares = item.shares_count || 0;

      // Engagement rate (likes + comments + shares / views)
      const engagementRate = views > 0 
        ? ((likes + comments * 2 + shares * 3) / views) * 100 
        : 0;
      
      score += Math.min(engagementRate * 10, 30);
      if (engagementRate > 5) reasons.push('high_engagement');

      // Virality score (exponential growth indicator)
      const viralityScore = Math.log10(Math.max(shares, 1) + 1) * 10;
      score += Math.min(viralityScore, 15);
      if (shares > 100) reasons.push('viral');

      // Recency boost (decay over 7 days)
      const hoursOld = (Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60);
      const recencyBoost = Math.max(0, 20 - (hoursOld / 24) * 3);
      score += recencyBoost;
      if (hoursOld < 24) reasons.push('fresh');

      // User preference matching
      if (userPreferences) {
        const likedTags = userPreferences.liked_tags || [];
        const dislikedTags = userPreferences.disliked_tags || [];
        const itemTags = item.tags || [];

        const likedMatch = itemTags.filter((t: string) => likedTags.includes(t)).length;
        const dislikedMatch = itemTags.filter((t: string) => dislikedTags.includes(t)).length;

        score += likedMatch * 5;
        score -= dislikedMatch * 10;

        if (likedMatch > 0) reasons.push('matches_interests');
      }

      // Penalize already seen content
      const interaction = interactionMap.get(item.id);
      if (interaction) {
        if (interaction.watch_completion_rate > 0.8) {
          score -= 15;
          reasons.push('already_watched');
        }
        if (interaction.liked) {
          score -= 5; // Slight penalty for already liked
        }
      }

      // Creator verification boost
      const profile = item.profiles as any;
      if (profile?.is_verified) {
        score += 5;
        reasons.push('verified_creator');
      }

      // Quality indicator from attention scores
      if (interaction?.attention_score > 0.7) {
        score += 10;
        reasons.push('high_attention');
      }

      // Diversity injection (random factor 0-5)
      score += Math.random() * 5;

      return {
        ...item,
        score: Math.max(0, score),
        reasons,
      };
    });

    // Sort by score
    scoredContent.sort((a, b) => b.score - a.score);

    // Apply pagination
    const paginatedContent = scoredContent.slice(offset, offset + limit);

    // Format response
    const feedItems = paginatedContent.map(item => ({
      id: item.id,
      type: (item as any).media_type,
      mediaUrl: (item as any).media_url,
      thumbnailUrl: (item as any).thumbnail_url,
      caption: (item as any).caption,
      tags: (item as any).tags,
      metrics: {
        views: (item as any).views_count,
        likes: (item as any).likes_count,
        comments: (item as any).comments_count,
        shares: (item as any).shares_count,
      },
      creator: (item as any).profiles,
      createdAt: (item as any).created_at,
      score: item.score,
      reasons: item.reasons,
    }));

    console.log(`[SmartFeed] Returning ${feedItems.length} items`);

    return new Response(
      JSON.stringify({
        success: true,
        items: feedItems,
        hasMore: scoredContent.length > offset + limit,
        algorithm: 'engagement_weighted_v1',
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[SmartFeed] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
