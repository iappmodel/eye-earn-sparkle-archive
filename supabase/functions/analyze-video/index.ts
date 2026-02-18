import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

/** Valid AI style IDs that match our app's styleFilters / aiStyles */
const VALID_STYLE_IDS = [
  'dynamics', 'sports', 'action', 'skippy', 'hype',
  'romantic', 'spiritual', 'melancholy', 'dreamy', 'nostalgic',
  'movie', 'epic', 'thriller', 'noir', 'documentary',
  'comedy', 'horror', 'music-video', 'vlog', 'aesthetic',
] as const;

interface AnalysisResult {
  highlights: {
    id: string;
    startTime: number;
    endTime: number;
    score: number;
    reason: string;
    type: 'action' | 'emotional' | 'visual' | 'audio';
  }[];
  suggestions: string[];
  detectedStyle: string;
  recommendedStyles: string[];
  /** First recommended style ID for one-click apply */
  recommendedStyleId: string | null;
  /** Human-readable color grade suggestion */
  colorGradeRecommendation: string | null;
  /** Filter ID to apply (one of VALID_STYLE_IDS or basic filter slug) */
  recommendedFilterId: string | null;
  sceneBreaks: number[];
  engagementPrediction: number;
  /** Content tags for discovery and SEO */
  tags: string[];
  /** Content category (e.g. lifestyle, tutorial, vlog) */
  category: string;
  /** 0-100 quality/readiness score */
  qualityScore: number;
  /** safe, sensitive, or adult */
  contentSafety: 'safe' | 'sensitive' | 'adult';
  /** Suggested hashtags for social posting */
  suggestedHashtags: string[];
  /** Suggested caption for social posting */
  suggestedCaption: string | null;
  /** Pacing: slow, medium, fast */
  pacing: 'slow' | 'medium' | 'fast';
  /** When multiple frames: 0-based index of best thumbnail for cover */
  bestThumbnailIndex: number | null;
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (!cors.ok) return cors.response;
  const headers = { ...cors.headers, 'Content-Type': 'application/json' };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors.headers });
  }

  try {
    const { thumbnailUrl, thumbnailUrls, duration, stylePreference, videoMetadata } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const frames = Array.isArray(thumbnailUrls) && thumbnailUrls.length > 0
      ? thumbnailUrls
      : thumbnailUrl ? [thumbnailUrl] : [];
    const multiFrame = frames.length > 1;

    console.log('Analyzing video with AI...', { duration, stylePreference, frameCount: frames.length });

    const styleList = VALID_STYLE_IDS.join(', ');
    const frameContext = multiFrame
      ? `These ${frames.length} images are frames from the video at different timestamps. Use them to detect scene changes and identify the best moments.`
      : 'This image is a frame from the video.';
    const analysisPrompt = `You are an expert video editor AI. Analyze the provided video frame(s) and metadata to suggest optimal editing decisions.

${frameContext}

Video Details:
- Duration: ${duration} seconds
- Style Preference: ${stylePreference || 'auto-detect'}
- Metadata: ${JSON.stringify(videoMetadata || {})}

You MUST use only these style IDs in recommendedStyles (pick the best 3): ${styleList}

Based on the visual content, provide a detailed analysis in JSON format:
{
  "detectedMood": "one of: energetic, calm, emotional, professional, playful, dramatic",
  "suggestedHighlights": [
    {
      "startPercent": 0-100,
      "endPercent": 0-100,
      "type": "action|emotional|visual|audio",
      "reason": "why this moment is engaging",
      "engagementScore": 0-100
    }
  ],
  "sceneBreakPercents": [percentages where scene changes likely occur],
  "recommendedStyles": ["exactly 3 style IDs from this list: ${styleList}"],
  "editingSuggestions": ["3-5 specific editing suggestions"],
  "overallEngagementPrediction": 0-100,
  "colorGradeRecommendation": "specific color grade suggestion (e.g. teal and orange, warm vintage, cool cinematic)",
  "tags": ["5-10 short lowercase tags for discovery, e.g. lifestyle, tutorial, vlog, travel"],
  "category": "one word or short phrase: lifestyle|tutorial|vlog|travel|fitness|comedy|music|education|gaming|beauty|food|sports|documentary|other",
  "qualityScore": 0-100,
  "contentSafety": "safe|sensitive|adult",
  "suggestedHashtags": ["5-8 hashtags without # symbol, trending where relevant"],
  "suggestedCaption": "one engaging caption line for social post, or null",
  "pacing": "slow|medium|fast",
  "bestThumbnailIndex": 0-based index of the best frame for cover (when multiple frames), or null
}

Be creative and provide actionable insights. Focus on identifying high-engagement moments. recommendedStyles must only contain IDs from the list above. Tags and suggestedHashtags should be relevant to the content.`;

    const messages: any[] = [
      { role: "system", content: "You are an expert video editor AI that analyzes video content and provides detailed editing recommendations. Always respond with valid JSON." }
    ];

    if (frames.length > 0) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: analysisPrompt },
          ...frames.map((url: string) => ({ type: "image_url", image_url: { url } }))
        ]
      });
    } else {
      messages.push({ role: "user", content: analysisPrompt });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits depleted, please add funds." }), {
          status: 402,
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const aiContent = data.choices?.[0]?.message?.content || '';
    
    console.log('AI response received:', aiContent.substring(0, 200));

    // Parse the AI response
    let analysisData;
    try {
      // Extract JSON from the response
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response, using defaults:', parseError);
      // Provide intelligent fallback based on duration
      analysisData = generateFallbackAnalysis(duration, stylePreference);
    }

    // Normalize recommendedStyles to valid IDs only
    const rawRecommended = analysisData.recommendedStyles || ['dynamics', 'movie', 'vlog'];
    const recommendedStyles = rawRecommended
      .map((s: string) => (typeof s === 'string' ? s.toLowerCase().replace(/\s+/g, '-') : ''))
      .filter((id: string) => VALID_STYLE_IDS.includes(id as any));
    const fallbackStyles = ['dynamics', 'movie', 'vlog'];
    const finalRecommended = recommendedStyles.length > 0 ? recommendedStyles : fallbackStyles;
    const recommendedStyleId = finalRecommended[0] || null;
    const recommendedFilterId = recommendedStyleId; // Our style IDs double as filter IDs

    // Normalize content safety
    const rawSafety = (analysisData.contentSafety || 'safe').toLowerCase();
    const contentSafety = rawSafety === 'adult' ? 'adult' : rawSafety === 'sensitive' ? 'sensitive' : 'safe';
    const rawPacing = (analysisData.pacing || 'medium').toString().toLowerCase();
    const pacing: 'slow' | 'medium' | 'fast' =
      rawPacing === 'slow' || rawPacing === 'fast' ? rawPacing : 'medium';
    const frameCount = frames.length;
    const rawBest = analysisData.bestThumbnailIndex;
    const bestThumbnailIndex =
      typeof rawBest === 'number' && rawBest >= 0 && rawBest < frameCount ? rawBest : null;

    // Transform AI response into our format
    const result: AnalysisResult = {
      highlights: (analysisData.suggestedHighlights || []).map((h: any, i: number) => ({
        id: `highlight-${Date.now()}-${i}`,
        startTime: (h.startPercent / 100) * duration,
        endTime: (h.endPercent / 100) * duration,
        score: h.engagementScore || 80,
        reason: h.reason || 'AI-detected highlight moment',
        type: h.type || 'visual',
      })),
      suggestions: analysisData.editingSuggestions || [
        'Consider adding dynamic transitions between scenes',
        'Apply color grading for mood enhancement',
        'Add subtle zoom effects on key moments'
      ],
      detectedStyle: analysisData.detectedMood || 'cinematic',
      recommendedStyles: finalRecommended,
      recommendedStyleId,
      recommendedFilterId,
      colorGradeRecommendation: analysisData.colorGradeRecommendation || null,
      sceneBreaks: (analysisData.sceneBreakPercents || [25, 50, 75]).map((p: number) => (p / 100) * duration),
      engagementPrediction: analysisData.overallEngagementPrediction ?? 75,
      tags: Array.isArray(analysisData.tags) ? analysisData.tags.slice(0, 15).map((t: any) => String(t).toLowerCase().trim()).filter(Boolean) : [],
      category: typeof analysisData.category === 'string' ? analysisData.category.trim() || 'general' : 'general',
      qualityScore: typeof analysisData.qualityScore === 'number' ? Math.max(0, Math.min(100, analysisData.qualityScore)) : 75,
      contentSafety,
      suggestedHashtags: Array.isArray(analysisData.suggestedHashtags) ? analysisData.suggestedHashtags.slice(0, 12).map((h: any) => String(h).replace(/^#/, '').trim()).filter(Boolean) : [],
      suggestedCaption: typeof analysisData.suggestedCaption === 'string' && analysisData.suggestedCaption.trim() ? analysisData.suggestedCaption.trim() : null,
      pacing,
      bestThumbnailIndex,
    };

    // Ensure we always have at least some highlights
    if (result.highlights.length === 0) {
      result.highlights = generateDefaultHighlights(duration);
    }

    console.log('Analysis complete:', {
      highlightCount: result.highlights.length,
      suggestionsCount: result.suggestions.length,
      detectedStyle: result.detectedStyle
    });

    return new Response(JSON.stringify(result), {
      headers: { ...headers, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error('Error in analyze-video:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Failed to analyze video' 
    }), {
      status: 500,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  }
});

function generateFallbackAnalysis(duration: number, stylePreference?: string) {
  return {
    detectedMood: stylePreference || 'dynamic',
    suggestedHighlights: [
      { startPercent: 5, endPercent: 20, type: 'action', reason: 'Opening hook - critical for viewer retention', engagementScore: 92 },
      { startPercent: 35, endPercent: 50, type: 'emotional', reason: 'Mid-video engagement peak', engagementScore: 85 },
      { startPercent: 75, endPercent: 95, type: 'visual', reason: 'Climax and call-to-action moment', engagementScore: 88 },
    ],
    sceneBreakPercents: [25, 50, 75],
    recommendedStyles: ['dynamics', 'movie', 'vlog'],
    editingSuggestions: [
      'Add a strong hook in the first 3 seconds',
      'Use jump cuts to maintain pacing',
      'Apply cinematic color grading for professional look',
      'Consider adding text overlays for key points',
      'End with a clear call-to-action'
    ],
    overallEngagementPrediction: 78,
    colorGradeRecommendation: 'Teal and orange for cinematic feel',
    tags: ['video', 'content', 'creative'],
    category: 'general',
    qualityScore: 75,
    contentSafety: 'safe',
    suggestedHashtags: ['viral', 'fyp', 'content', 'creative'],
    suggestedCaption: null,
    pacing: 'medium',
    bestThumbnailIndex: 0,
  };
}

function generateDefaultHighlights(duration: number) {
  return [
    { id: `highlight-${Date.now()}-0`, startTime: duration * 0.05, endTime: duration * 0.2, score: 92, reason: 'Opening hook - critical for retention', type: 'action' as const },
    { id: `highlight-${Date.now()}-1`, startTime: duration * 0.35, endTime: duration * 0.5, score: 85, reason: 'Mid-video engagement peak', type: 'emotional' as const },
    { id: `highlight-${Date.now()}-2`, startTime: duration * 0.75, endTime: duration * 0.95, score: 88, reason: 'Climax moment', type: 'visual' as const },
  ];
}
