import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Sample content pool for demonstration
const SAMPLE_CONTENT = [
  { id: '1', title: 'Morning Workout Routine', category: 'fitness', tags: ['fitness', 'health', 'morning'], reward: 5, coinType: 'icoin', thumbnail: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400', duration: 120 },
  { id: '2', title: 'Tech News Update', category: 'tech', tags: ['tech', 'news', 'gadgets'], reward: 3, coinType: 'icoin', thumbnail: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=400', duration: 90 },
  { id: '3', title: 'Cooking Masterclass', category: 'food', tags: ['food', 'cooking', 'recipes'], reward: 4, coinType: 'icoin', thumbnail: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400', duration: 180 },
  { id: '4', title: 'Travel Adventures', category: 'travel', tags: ['travel', 'adventure', 'explore'], reward: 6, coinType: 'vicoin', thumbnail: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400', duration: 150 },
  { id: '5', title: 'Financial Tips', category: 'finance', tags: ['finance', 'money', 'investing'], reward: 8, coinType: 'vicoin', thumbnail: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=400', duration: 200 },
  { id: '6', title: 'Music Production', category: 'entertainment', tags: ['music', 'creative', 'production'], reward: 4, coinType: 'icoin', thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400', duration: 240 },
  { id: '7', title: 'Yoga & Meditation', category: 'fitness', tags: ['fitness', 'wellness', 'meditation'], reward: 5, coinType: 'icoin', thumbnail: 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400', duration: 300 },
  { id: '8', title: 'Startup Stories', category: 'business', tags: ['business', 'startup', 'entrepreneur'], reward: 7, coinType: 'vicoin', thumbnail: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=400', duration: 180 },
  { id: '9', title: 'Gaming Highlights', category: 'entertainment', tags: ['gaming', 'esports', 'entertainment'], reward: 3, coinType: 'icoin', thumbnail: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=400', duration: 120 },
  { id: '10', title: 'Local Events Near You', category: 'local', tags: ['local', 'events', 'community'], reward: 10, coinType: 'vicoin', thumbnail: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400', duration: 60 },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header (optional for cold start)
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    let userPreferences: any = null;
    let interactions: any[] = [];

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;

      if (userId) {
        // Fetch user preferences
        const { data: prefs } = await supabase
          .from('user_preferences')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();
        userPreferences = prefs;

        // Fetch recent interactions
        const { data: recentInteractions } = await supabase
          .from('content_interactions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(20);
        interactions = recentInteractions || [];
      }
    }

    const { latitude, longitude } = await req.json().catch(() => ({}));
    console.log('[PersonalizedFeed] Request:', { userId, hasPrefs: !!userPreferences, interactionCount: interactions.length });

    // Calculate content scores
    let scoredContent = SAMPLE_CONTENT.map(content => {
      let score = 50; // Base score
      let reason = 'Trending';

      // Cold start: show trending + high-conversion content
      if (!userPreferences && !interactions.length) {
        score += content.reward * 2; // Higher reward = higher priority
        if (content.category === 'local' && latitude && longitude) {
          score += 20;
          reason = 'Near you';
        }
        return { ...content, score, reason };
      }

      // Tag matching
      if (userPreferences?.liked_tags?.length) {
        const matchedTags = content.tags.filter(tag => 
          userPreferences.liked_tags.includes(tag)
        );
        score += matchedTags.length * 15;
        if (matchedTags.length > 0) {
          reason = `Based on: ${matchedTags[0]}`;
        }
      }

      // Penalize disliked tags
      if (userPreferences?.disliked_tags?.length) {
        const dislikedTags = content.tags.filter(tag => 
          userPreferences.disliked_tags.includes(tag)
        );
        score -= dislikedTags.length * 20;
      }

      // Category preference
      if (userPreferences?.preferred_categories?.includes(content.category)) {
        score += 25;
        reason = `You like ${content.category}`;
      }

      // Engagement-based scoring from interactions
      const categoryInteractions = interactions.filter(i => i.category === content.category);
      if (categoryInteractions.length > 0) {
        const avgCompletion = categoryInteractions.reduce((sum, i) => sum + (i.watch_completion_rate || 0), 0) / categoryInteractions.length;
        const avgAttention = categoryInteractions.reduce((sum, i) => sum + (i.attention_score || 0), 0) / categoryInteractions.length;
        
        score += avgCompletion * 0.3;
        score += avgAttention * 0.2;
        
        if (avgCompletion > 80) {
          reason = 'You watch this category';
        }
      }

      // Already seen penalty
      if (userPreferences?.last_seen_content?.includes(content.id)) {
        score -= 30;
      }

      // Location boost
      if (content.category === 'local' && latitude && longitude) {
        score += 15;
        reason = 'Near you';
      }

      // Diversity injection (prevent echo chamber)
      if (Math.random() < 0.15) {
        score += 10;
        reason = 'Discover something new';
      }

      return { ...content, score, reason };
    });

    // Sort by score
    scoredContent.sort((a, b) => b.score - a.score);

    // Optional: Use AI for enhanced recommendations
    if (lovableApiKey && userPreferences && interactions.length > 5) {
      try {
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: 'You are a content recommendation AI. Analyze user preferences and suggest content order. Return only a JSON array of content IDs in recommended order.'
              },
              {
                role: 'user',
                content: `User preferences: ${JSON.stringify({
                  liked_tags: userPreferences.liked_tags,
                  avg_watch_time: userPreferences.avg_watch_time,
                  focus_score: userPreferences.focus_score,
                  recent_categories: interactions.slice(0, 5).map(i => i.category)
                })}. Available content: ${JSON.stringify(scoredContent.slice(0, 5).map(c => ({ id: c.id, title: c.title, category: c.category, tags: c.tags })))}`
              }
            ],
            max_tokens: 200,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const aiSuggestion = aiData.choices?.[0]?.message?.content;
          console.log('[PersonalizedFeed] AI suggestion:', aiSuggestion);
          // AI enhancement logged but not overriding for stability
        }
      } catch (aiError) {
        console.log('[PersonalizedFeed] AI enhancement skipped:', aiError);
      }
    }

    // Add personalization metadata
    const feed = scoredContent.slice(0, 10).map((content, index) => ({
      ...content,
      position: index + 1,
      personalized: !!userPreferences,
      aiEnhanced: false,
    }));

    console.log('[PersonalizedFeed] Returning', feed.length, 'items');

    return new Response(
      JSON.stringify({
        success: true,
        feed,
        meta: {
          userId,
          personalized: !!userPreferences,
          interactionCount: interactions.length,
          coldStart: !userPreferences && interactions.length === 0,
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
