import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      contentId,
      contentType = 'video',
      watchDuration = 0,
      totalDuration = 0,
      attentionScore = 0,
      liked = false,
      shared = false,
      skipped = false,
      tags = [],
      category = null,
      action = 'update', // 'update', 'like', 'unlike', 'share', 'feedback'
      feedback = null, // 'more' or 'less'
    } = await req.json();

    console.log('[TrackInteraction] Request:', { userId: user.id, contentId, action });

    const watchCompletionRate = totalDuration > 0 ? (watchDuration / totalDuration) * 100 : 0;

    // Upsert content interaction
    const { data: interaction, error: interactionError } = await supabase
      .from('content_interactions')
      .upsert({
        user_id: user.id,
        content_id: contentId,
        content_type: contentType,
        watch_duration: watchDuration,
        total_duration: totalDuration,
        watch_completion_rate: watchCompletionRate,
        attention_score: attentionScore,
        liked: action === 'like' ? true : (action === 'unlike' ? false : liked),
        shared: action === 'share' ? true : shared,
        skipped,
        tags,
        category,
      }, {
        onConflict: 'user_id,content_id',
      })
      .select()
      .single();

    if (interactionError) {
      console.error('[TrackInteraction] Interaction error:', interactionError);
      throw interactionError;
    }

    // Update user preferences based on interaction
    let { data: prefs, error: prefsError } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (prefsError && prefsError.code !== 'PGRST116') {
      console.error('[TrackInteraction] Prefs fetch error:', prefsError);
    }

    // Create preferences if not exists
    if (!prefs) {
      const { data: newPrefs, error: createError } = await supabase
        .from('user_preferences')
        .insert({ user_id: user.id })
        .select()
        .single();
      
      if (createError) {
        console.error('[TrackInteraction] Prefs create error:', createError);
      } else {
        prefs = newPrefs;
      }
    }

    if (prefs) {
      const updates: any = {
        updated_at: new Date().toISOString(),
      };

      // Update average watch time
      const totalViews = (prefs.total_content_views || 0) + 1;
      const currentAvg = prefs.avg_watch_time || 0;
      updates.avg_watch_time = ((currentAvg * (totalViews - 1)) + watchDuration) / totalViews;
      updates.total_content_views = totalViews;

      // Update focus score (rolling average)
      if (attentionScore > 0) {
        const currentFocus = prefs.focus_score || 0;
        updates.focus_score = ((currentFocus * 0.9) + (attentionScore * 0.1));
      }

      // Update engagement score
      let engagementBoost = 0;
      if (liked || action === 'like') engagementBoost += 2;
      if (shared || action === 'share') engagementBoost += 3;
      if (watchCompletionRate > 80) engagementBoost += 1;
      if (skipped) engagementBoost -= 1;
      updates.engagement_score = Math.max(0, Math.min(100, (prefs.engagement_score || 50) + engagementBoost));

      // Handle feedback
      if (feedback && category) {
        const likedTags = prefs.liked_tags || [];
        const dislikedTags = prefs.disliked_tags || [];
        const preferredCategories = prefs.preferred_categories || [];

        if (feedback === 'more') {
          // Add to liked tags
          const newLiked = [...new Set([...likedTags, ...tags, category])];
          updates.liked_tags = newLiked;
          // Remove from disliked if present
          updates.disliked_tags = dislikedTags.filter((t: string) => !tags.includes(t) && t !== category);
          // Add to preferred categories
          if (!preferredCategories.includes(category)) {
            updates.preferred_categories = [...preferredCategories, category];
          }
        } else if (feedback === 'less') {
          // Add to disliked tags
          const newDisliked = [...new Set([...dislikedTags, ...tags, category])];
          updates.disliked_tags = newDisliked;
          // Remove from liked if present
          updates.liked_tags = likedTags.filter((t: string) => !tags.includes(t) && t !== category);
          // Remove from preferred categories
          updates.preferred_categories = preferredCategories.filter((c: string) => c !== category);
        }
      }

      // Update last seen content
      const lastSeen = prefs.last_seen_content || [];
      updates.last_seen_content = [contentId, ...lastSeen.filter((id: string) => id !== contentId)].slice(0, 50);

      const { error: updateError } = await supabase
        .from('user_preferences')
        .update(updates)
        .eq('user_id', user.id);

      if (updateError) {
        console.error('[TrackInteraction] Prefs update error:', updateError);
      }
    }

    console.log('[TrackInteraction] Success:', { userId: user.id, contentId, action });

    return new Response(
      JSON.stringify({
        success: true,
        interaction: {
          contentId,
          watchCompletionRate,
          attentionScore,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[TrackInteraction] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message, success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
