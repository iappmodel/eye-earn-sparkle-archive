import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

/** Response shape for ai.service.analyzeContent and feed/upload flows */
interface ContentAnalysisResult {
  tags: string[];
  category: string;
  quality_score: number;
  content_safety: 'safe' | 'sensitive' | 'adult';
  suggested_hashtags: string[];
  suggested_caption: string | null;
  /** Optional: detected language / mood for caption */
  detected_mood?: string;
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (!cors.ok) return cors.response;
  const headers = { ...cors.headers, 'Content-Type': 'application/json' };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors.headers });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'LOVABLE_API_KEY is not configured', tags: [], category: 'general', quality_score: 0, content_safety: 'safe', suggested_hashtags: [], suggested_caption: null }),
        { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    const { contentUrl, contentType, thumbnailUrl, thumbnailUrls } = await req.json();
    const type = contentType === 'video' ? 'video' : 'image';

    const frames: string[] = [];
    if (Array.isArray(thumbnailUrls) && thumbnailUrls.length > 0) {
      frames.push(...thumbnailUrls);
    } else if (thumbnailUrl) {
      frames.push(thumbnailUrl);
    } else if (contentUrl && type === 'image') {
      frames.push(contentUrl);
    }

    const hasImage = frames.length > 0;
    const prompt = type === 'video'
      ? `You are an expert content analyst. Analyze the provided video frame(s) and return metadata for tagging and discovery.
${hasImage ? `These ${frames.length} image(s) are frame(s) from the video.` : 'No frame was provided; base your response on "video" content.'}

Return a JSON object with:
- "tags": array of 5-12 lowercase tags for discovery (e.g. lifestyle, tutorial, vlog, travel)
- "category": one of: lifestyle, tutorial, vlog, travel, fitness, comedy, music, education, gaming, beauty, food, sports, documentary, other
- "quality_score": 0-100
- "content_safety": one of: safe, sensitive, adult
- "suggested_hashtags": 5-10 hashtags without # symbol
- "suggested_caption": one engaging caption line for social post, or null
- "detected_mood": optional one word (e.g. energetic, calm, professional)

Respond with only valid JSON, no markdown.`

      : `You are an expert content analyst. Analyze the provided image and return metadata for tagging and discovery.

Return a JSON object with:
- "tags": array of 5-12 lowercase tags for discovery
- "category": one of: lifestyle, tutorial, vlog, travel, fitness, comedy, music, education, gaming, beauty, food, sports, documentary, other
- "quality_score": 0-100
- "content_safety": one of: safe, sensitive, adult
- "suggested_hashtags": 5-10 hashtags without # symbol
- "suggested_caption": one engaging caption line for social post, or null
- "detected_mood": optional one word

Respond with only valid JSON, no markdown.`;

    const messages: { role: string; content: unknown[] }[] = [
      { role: 'system', content: 'You are an expert content analyst. Always respond with valid JSON only.' }
    ];

    if (hasImage) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          ...frames.slice(0, 4).map((url: string) => ({ type: 'image_url', image_url: { url } }))
        ]
      });
    } else {
      messages.push({ role: 'user', content: prompt });
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[ai-content-analyzer] AI gateway error:', response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({
          error: 'Rate limit exceeded',
          tags: [], category: 'general', quality_score: 0, content_safety: 'safe',
          suggested_hashtags: [], suggested_caption: null
        }), { status: 429, headers: { ...headers, 'Content-Type': 'application/json' } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({
          error: 'AI credits depleted',
          tags: [], category: 'general', quality_score: 0, content_safety: 'safe',
          suggested_hashtags: [], suggested_caption: null
        }), { status: 402, headers: { ...headers, 'Content-Type': 'application/json' } });
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content ?? '';

    let parsed: Record<string, unknown>;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
    } catch {
      parsed = {};
    }

    const rawTags = Array.isArray(parsed.tags) ? parsed.tags : [];
    const tags = rawTags.slice(0, 15).map((t: unknown) => String(t).toLowerCase().trim()).filter(Boolean);
    const category = typeof parsed.category === 'string' ? parsed.category.trim() || 'general' : 'general';
    const quality_score = typeof parsed.quality_score === 'number' ? Math.max(0, Math.min(100, parsed.quality_score)) : 70;
    const rawSafety = String(parsed.content_safety || 'safe').toLowerCase();
    const content_safety = rawSafety === 'adult' ? 'adult' : rawSafety === 'sensitive' ? 'sensitive' : 'safe';
    const suggested_hashtags = Array.isArray(parsed.suggested_hashtags)
      ? parsed.suggested_hashtags.slice(0, 12).map((h: unknown) => String(h).replace(/^#/, '').trim()).filter(Boolean)
      : [];
    const suggested_caption = typeof parsed.suggested_caption === 'string' && parsed.suggested_caption.trim()
      ? parsed.suggested_caption.trim()
      : null;
    const detected_mood = typeof parsed.detected_mood === 'string' ? parsed.detected_mood.trim() : undefined;

    const result: ContentAnalysisResult = {
      tags,
      category,
      quality_score,
      content_safety,
      suggested_hashtags,
      suggested_caption,
      ...(detected_mood && { detected_mood }),
    };

    return new Response(JSON.stringify(result), {
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[ai-content-analyzer] Error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Content analysis failed',
        tags: [], category: 'general', quality_score: 0, content_safety: 'safe',
        suggested_hashtags: [], suggested_caption: null
      }),
      { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  }
});
