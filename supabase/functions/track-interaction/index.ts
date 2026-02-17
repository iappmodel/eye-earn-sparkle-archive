import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EVENT_TYPES = ['view_start', 'view_progress', 'view_complete', 'like', 'unlike', 'share', 'save', 'unsave', 'feedback', 'update', 'skip'] as const;

const MetadataSchema = z.object({
  device_type: z.string().max(50).optional(),
  session_id: z.string().max(64).optional(),
  referrer: z.string().max(200).optional(),
}).passthrough();

const SingleEventSchema = z.object({
  contentId: z.string().min(1).max(128),
  contentType: z.enum(['video', 'image', 'reel', 'story']).default('video'),
  watchDuration: z.number().min(0).max(86400).default(0),
  totalDuration: z.number().min(0).max(86400).default(0),
  attentionScore: z.number().min(0).max(100).default(0),
  liked: z.boolean().default(false),
  shared: z.boolean().default(false),
  skipped: z.boolean().default(false),
  saved: z.boolean().default(false),
  tags: z.array(z.string().max(50)).max(20).default([]),
  category: z.string().max(100).nullable().default(null),
  action: z.enum(EVENT_TYPES).default('update'),
  feedback: z.enum(['more', 'less']).nullable().default(null),
  metadata: MetadataSchema.optional(),
  contentOwnerId: z.string().uuid().nullable().optional(),
});

const TrackInteractionSchema = z.union([
  z.object({ batch: z.array(SingleEventSchema).min(1).max(20) }),
  SingleEventSchema,
]);

type SingleEvent = z.infer<typeof SingleEventSchema>;

async function processOne(
  supabase: ReturnType<typeof createClient>,
  user: { id: string },
  event: SingleEvent
): Promise<{ interaction: any; prefsUpdated: boolean }> {
  const {
    contentId, contentType, watchDuration, totalDuration,
    attentionScore, liked, shared, skipped, saved, tags, category,
    action, feedback, metadata, contentOwnerId,
  } = event;

  const watchCompletionRate = totalDuration > 0 ? (watchDuration / totalDuration) * 100 : 0;

  const lastEventType = action === 'update' ? 'view_progress' : action;
  const isViewEvent = ['view_start', 'view_progress', 'view_complete'].includes(action);

  const row: Record<string, unknown> = {
    user_id: user.id,
    content_id: contentId,
    content_type: contentType,
    watch_duration: watchDuration,
    total_duration: totalDuration,
    watch_completion_rate: watchCompletionRate,
    attention_score: attentionScore,
    liked: action === 'like' ? true : action === 'unlike' ? false : liked,
    shared: action === 'share' ? true : shared,
    skipped: action === 'skip' ? true : skipped,
    tags,
    category,
    last_event_type: lastEventType,
    metadata: metadata ?? {},
    saved: action === 'save' ? true : action === 'unsave' ? false : saved,
  };

  if (contentOwnerId) {
    row.content_owner_id = contentOwnerId;
  }

  const { data: interaction, error: interactionError } = await supabase
    .from('content_interactions')
    .upsert(row, { onConflict: 'user_id,content_id' })
    .select()
    .single();

  if (interactionError) {
    console.error('[TrackInteraction] Interaction error:', interactionError);
    throw interactionError;
  }

  // Update user_preferences only for meaningful engagement (not every view_progress heartbeat)
  const shouldUpdatePrefs = !isViewEvent || action === 'view_start' || action === 'view_complete';

  if (shouldUpdatePrefs) {
    let { data: prefs, error: prefsError } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (prefsError && prefsError.code !== 'PGRST116') {
      console.error('[TrackInteraction] Prefs fetch error:', prefsError);
    }

    if (!prefs) {
      const { data: newPrefs, error: createError } = await supabase
        .from('user_preferences')
        .insert({ user_id: user.id })
        .select()
        .single();
      if (!createError) prefs = newPrefs;
    }

    if (prefs) {
      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (isViewEvent && (action === 'view_start' || action === 'view_complete')) {
        const totalViews = (prefs.total_content_views || 0) + 1;
        const currentAvg = prefs.avg_watch_time || 0;
        updates.avg_watch_time = ((currentAvg * (totalViews - 1)) + watchDuration) / totalViews;
        updates.total_content_views = totalViews;
      }

      if (attentionScore > 0 && (action === 'view_complete' || !isViewEvent)) {
        const currentFocus = prefs.focus_score || 0;
        updates.focus_score = ((currentFocus * 0.9) + (attentionScore * 0.1));
      }

      let engagementBoost = 0;
      if (event.liked || action === 'like') engagementBoost += 2;
      if (event.shared || action === 'share') engagementBoost += 3;
      if (watchCompletionRate > 80 && action === 'view_complete') engagementBoost += 1;
      if (event.skipped || action === 'skip') engagementBoost -= 1;
      updates.engagement_score = Math.max(0, Math.min(100, (prefs.engagement_score || 50) + engagementBoost));

      if (feedback && category) {
        const likedTags = prefs.liked_tags || [];
        const dislikedTags = prefs.disliked_tags || [];
        const preferredCategories = prefs.preferred_categories || [];

        if (feedback === 'more') {
          updates.liked_tags = [...new Set([...likedTags, ...tags, category].filter(Boolean))];
          updates.disliked_tags = dislikedTags.filter((t: string) => !tags.includes(t) && t !== category);
          if (category && !preferredCategories.includes(category)) {
            updates.preferred_categories = [...preferredCategories, category];
          }
        } else if (feedback === 'less') {
          updates.disliked_tags = [...new Set([...dislikedTags, ...tags, category].filter(Boolean))];
          updates.liked_tags = likedTags.filter((t: string) => !tags.includes(t) && t !== category);
          updates.preferred_categories = preferredCategories.filter((c: string) => c !== category);
        }
      }

      const lastSeen = prefs.last_seen_content || [];
      updates.last_seen_content = [contentId, ...lastSeen.filter((id: string) => id !== contentId)].slice(0, 50);

      await supabase
        .from('user_preferences')
        .update(updates)
        .eq('user_id', user.id);
    }
  }

  return { interaction, prefsUpdated: shouldUpdatePrefs };
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

    const body = await req.json().catch(() => ({}));
    const parseResult = TrackInteractionSchema.safeParse(body);

    if (!parseResult.success) {
      console.warn('[TrackInteraction] Validation failed:', parseResult.error.flatten());
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parseResult.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = parseResult.data;
    const events: SingleEvent[] = 'batch' in data && Array.isArray(data.batch)
      ? data.batch
      : [data as SingleEvent];

    const results: { contentId: string; watchCompletionRate?: number; attentionScore?: number; saved?: boolean }[] = [];

    for (const event of events) {
      const { interaction } = await processOne(supabase, user, event);
      results.push({
        contentId: event.contentId,
        watchCompletionRate: interaction?.watch_completion_rate ?? undefined,
        attentionScore: interaction?.attention_score ?? undefined,
        saved: interaction?.saved ?? undefined,
      });
    }

    console.log('[TrackInteraction] Success:', { userId: user.id, count: results.length });

    return new Response(
      JSON.stringify({
        success: true,
        interactions: results,
        count: results.length,
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
