import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OEmbedResponse {
  title?: string;
  author_name?: string;
  author_url?: string;
  thumbnail_url?: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
  html?: string;
  width?: number;
  height?: number;
  provider_name?: string;
  provider_url?: string;
}

// oEmbed endpoints for different platforms
const OEMBED_ENDPOINTS: Record<string, string> = {
  youtube: 'https://www.youtube.com/oembed',
  vimeo: 'https://vimeo.com/api/oembed.json',
  tiktok: 'https://www.tiktok.com/oembed',
  instagram: 'https://graph.facebook.com/v18.0/instagram_oembed',
  twitter: 'https://publish.twitter.com/oembed',
  facebook: 'https://www.facebook.com/plugins/video/oembed.json',
};

// Detect platform from URL
function detectPlatform(url: string): string {
  const urlLower = url.toLowerCase();
  
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) return 'youtube';
  if (urlLower.includes('vimeo.com')) return 'vimeo';
  if (urlLower.includes('tiktok.com') || urlLower.includes('vm.tiktok.com')) return 'tiktok';
  if (urlLower.includes('instagram.com') || urlLower.includes('instagr.am')) return 'instagram';
  if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) return 'twitter';
  if (urlLower.includes('facebook.com') || urlLower.includes('fb.watch')) return 'facebook';
  if (urlLower.includes('twitch.tv')) return 'twitch';
  if (urlLower.includes('snapchat.com')) return 'snapchat';
  
  return 'other';
}

// Extract video ID from YouTube URLs
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([^&\s?]+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Get YouTube thumbnail directly
function getYouTubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}

// Fetch oEmbed data
async function fetchOEmbed(url: string, platform: string): Promise<OEmbedResponse | null> {
  const endpoint = OEMBED_ENDPOINTS[platform];
  if (!endpoint) return null;
  
  try {
    const oembedUrl = `${endpoint}?url=${encodeURIComponent(url)}&format=json`;
    const response = await fetch(oembedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    if (!response.ok) {
      console.log(`oEmbed request failed for ${platform}: ${response.status}`);
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error(`oEmbed error for ${platform}:`, error);
    return null;
  }
}

// Extract metadata from HTML meta tags (fallback)
async function fetchMetaTags(url: string): Promise<{
  title?: string;
  description?: string;
  thumbnail?: string;
  duration?: number;
}> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Mediabot/1.0)',
        'Accept': 'text/html',
      },
    });
    
    if (!response.ok) return {};
    
    const html = await response.text();
    
    // Extract Open Graph and Twitter meta tags
    const getMetaContent = (property: string): string | undefined => {
      const patterns = [
        new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i'),
        new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${property}["']`, 'i'),
        new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i'),
      ];
      
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) return match[1];
      }
      return undefined;
    };
    
    const getTitle = (): string | undefined => {
      const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      return match ? match[1] : undefined;
    };
    
    return {
      title: getMetaContent('og:title') || getMetaContent('twitter:title') || getTitle(),
      description: getMetaContent('og:description') || getMetaContent('twitter:description'),
      thumbnail: getMetaContent('og:image') || getMetaContent('twitter:image'),
      duration: undefined, // Hard to extract duration from meta tags
    };
  } catch (error) {
    console.error('Meta tags fetch error:', error);
    return {};
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  
  try {
    const { url, mediaId } = await req.json();
    
    if (!url) {
      return new Response(
        JSON.stringify({ error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Extracting metadata for: ${url}`);
    
    const platform = detectPlatform(url);
    let metadata: {
      title?: string;
      description?: string;
      thumbnail_url?: string;
      duration?: number;
      author_name?: string;
      original_views?: number;
      original_likes?: number;
    } = {};
    
    // Try platform-specific oEmbed first
    const oembedData = await fetchOEmbed(url, platform);
    
    if (oembedData) {
      metadata = {
        title: oembedData.title,
        description: undefined,
        thumbnail_url: oembedData.thumbnail_url,
        author_name: oembedData.author_name,
      };
    }
    
    // For YouTube, use direct thumbnail URL
    if (platform === 'youtube') {
      const videoId = extractYouTubeId(url);
      if (videoId) {
        metadata.thumbnail_url = getYouTubeThumbnail(videoId);
      }
    }
    
    // Fallback to meta tags if oEmbed didn't provide everything
    if (!metadata.title || !metadata.thumbnail_url) {
      const metaTags = await fetchMetaTags(url);
      metadata = {
        ...metadata,
        title: metadata.title || metaTags.title,
        description: metadata.description || metaTags.description,
        thumbnail_url: metadata.thumbnail_url || metaTags.thumbnail,
        duration: metadata.duration || metaTags.duration,
      };
    }
    
    // Update database if mediaId provided
    if (mediaId) {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      const updateData: Record<string, any> = {
        status: 'processed',
      };
      
      if (metadata.title) updateData.title = metadata.title;
      if (metadata.description) updateData.description = metadata.description;
      if (metadata.thumbnail_url) updateData.thumbnail_url = metadata.thumbnail_url;
      if (metadata.duration) updateData.duration = metadata.duration;
      
      const { error: updateError } = await supabaseClient
        .from('imported_media')
        .update(updateData)
        .eq('id', mediaId);
      
      if (updateError) {
        console.error('Database update error:', updateError);
      } else {
        console.log('Media updated successfully:', mediaId);
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        platform,
        metadata,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error: unknown) {
    console.error('Error extracting metadata:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Failed to extract metadata', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
