import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log("[PublishScheduled] Checking for scheduled posts to publish...");

    const now = new Date().toISOString();

    // Find all scheduled posts that are due
    const { data: scheduledPosts, error: fetchError } = await supabase
      .from('imported_media')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now)
      .is('published_content_id', null);

    if (fetchError) throw fetchError;

    console.log(`[PublishScheduled] Found ${scheduledPosts?.length || 0} posts to publish`);

    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const post of scheduledPosts || []) {
      try {
        // Create the user_content entry
        const { data: newContent, error: contentError } = await supabase
          .from('user_content')
          .insert({
            user_id: post.user_id,
            media_type: post.media_type,
            media_url: post.edited_media_url || post.local_media_url || post.original_url,
            thumbnail_url: post.thumbnail_url,
            caption: post.description,
            title: post.title,
            duration: post.duration,
            status: 'published',
            source_platform: post.platform,
            source_url: post.original_url,
          })
          .select()
          .single();

        if (contentError) throw contentError;

        // Update the imported media to mark as published
        const { error: updateError } = await supabase
          .from('imported_media')
          .update({
            status: 'published',
            published_content_id: newContent.id,
          })
          .eq('id', post.id);

        if (updateError) throw updateError;

        // Create notification for the user
        await supabase
          .from('notifications')
          .insert({
            user_id: post.user_id,
            type: 'system',
            title: 'Post Published',
            body: `Your scheduled post "${post.title || 'Untitled'}" has been published!`,
            data: { contentId: newContent.id }
          });

        console.log(`[PublishScheduled] Published post ${post.id} -> content ${newContent.id}`);
        results.push({ id: post.id, success: true });
      } catch (error: any) {
        console.error(`[PublishScheduled] Failed to publish ${post.id}:`, error);
        
        // Mark as failed
        await supabase
          .from('imported_media')
          .update({ status: 'failed' })
          .eq('id', post.id);

        results.push({ id: post.id, success: false, error: error.message });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        processed: results.length,
        results,
        timestamp: now,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[PublishScheduled] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
