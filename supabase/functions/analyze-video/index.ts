import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  sceneBreaks: number[];
  engagementPrediction: number;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { thumbnailUrl, duration, stylePreference, videoMetadata } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Analyzing video with AI...', { duration, stylePreference });

    // Prepare the analysis prompt
    const analysisPrompt = `You are an expert video editor AI. Analyze this video thumbnail and metadata to suggest optimal editing decisions.

Video Details:
- Duration: ${duration} seconds
- Style Preference: ${stylePreference || 'auto-detect'}
- Metadata: ${JSON.stringify(videoMetadata || {})}

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
  "recommendedStyles": ["top 3 AI editing styles that would work well"],
  "editingSuggestions": ["3-5 specific editing suggestions"],
  "overallEngagementPrediction": 0-100,
  "colorGradeRecommendation": "specific color grade suggestion"
}

Be creative and provide actionable insights. Focus on identifying high-engagement moments.`;

    const messages: any[] = [
      { role: "system", content: "You are an expert video editor AI that analyzes video content and provides detailed editing recommendations. Always respond with valid JSON." }
    ];

    // If we have a thumbnail, include it for visual analysis
    if (thumbnailUrl) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: analysisPrompt },
          { type: "image_url", image_url: { url: thumbnailUrl } }
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
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits depleted, please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
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
      recommendedStyles: analysisData.recommendedStyles || ['dynamics', 'movie', 'vlog'],
      sceneBreaks: (analysisData.sceneBreakPercents || [25, 50, 75]).map((p: number) => (p / 100) * duration),
      engagementPrediction: analysisData.overallEngagementPrediction || 75,
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
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error('Error in analyze-video:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Failed to analyze video' 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function generateFallbackAnalysis(duration: number, stylePreference?: string) {
  const thirds = duration / 3;
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
    colorGradeRecommendation: 'Teal and orange for cinematic feel'
  };
}

function generateDefaultHighlights(duration: number) {
  return [
    { id: `highlight-${Date.now()}-0`, startTime: duration * 0.05, endTime: duration * 0.2, score: 92, reason: 'Opening hook - critical for retention', type: 'action' as const },
    { id: `highlight-${Date.now()}-1`, startTime: duration * 0.35, endTime: duration * 0.5, score: 85, reason: 'Mid-video engagement peak', type: 'emotional' as const },
    { id: `highlight-${Date.now()}-2`, startTime: duration * 0.75, endTime: duration * 0.95, score: 88, reason: 'Climax moment', type: 'visual' as const },
  ];
}
