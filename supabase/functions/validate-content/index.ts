import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Content validation categories
const NSFW_KEYWORDS = [
  'explicit', 'adult', 'xxx', 'porn', 'nude', 'naked',
  // Add more as needed - this is a simplified version
];

const SPAM_PATTERNS = [
  /(.)\1{10,}/i, // Repeated characters
  /\b(buy|sell|click|visit|subscribe)\s+now\b/i,
  /(https?:\/\/[^\s]+){3,}/i, // Multiple links
  /\$\d+|\d+\$/i, // Price mentions
];

const COPYRIGHT_SIGNATURES = [
  '©', '(c)', 'copyright', 'all rights reserved',
  'trademark', '™', '®',
];

interface ValidationResult {
  isValid: boolean;
  flags: string[];
  severity: 'low' | 'medium' | 'high';
  details: Record<string, unknown>;
}

function checkNSFW(text: string): { flagged: boolean; matches: string[] } {
  const lowerText = text.toLowerCase();
  const matches = NSFW_KEYWORDS.filter(kw => lowerText.includes(kw));
  return { flagged: matches.length > 0, matches };
}

function checkSpam(text: string): { flagged: boolean; patterns: string[] } {
  const patterns: string[] = [];
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(text)) {
      patterns.push(pattern.source);
    }
  }
  return { flagged: patterns.length > 0, patterns };
}

function checkCopyright(text: string): { flagged: boolean; indicators: string[] } {
  const lowerText = text.toLowerCase();
  const indicators = COPYRIGHT_SIGNATURES.filter(sig => 
    lowerText.includes(sig.toLowerCase())
  );
  return { flagged: indicators.length > 0, indicators };
}

function checkDuplicate(
  text: string, 
  recentTexts: string[]
): { flagged: boolean; similarity: number } {
  // Simple similarity check using Jaccard index
  const words = new Set(text.toLowerCase().split(/\s+/));
  
  for (const recent of recentTexts) {
    const recentWords = new Set(recent.toLowerCase().split(/\s+/));
    const intersection = new Set([...words].filter(w => recentWords.has(w)));
    const union = new Set([...words, ...recentWords]);
    const similarity = intersection.size / union.size;
    
    if (similarity > 0.8) { // 80% similar = duplicate
      return { flagged: true, similarity };
    }
  }
  
  return { flagged: false, similarity: 0 };
}

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[VALIDATE-CONTENT] ${step}`, details ? JSON.stringify(details) : '');
};

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

    const { text, contentType, checkDuplicates = true } = await req.json();
    logStep('Validating content', { userId: user.id, contentType, textLength: text?.length });

    if (!text || typeof text !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Text content required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const flags: string[] = [];
    const details: Record<string, unknown> = {};

    // NSFW check
    const nsfwResult = checkNSFW(text);
    if (nsfwResult.flagged) {
      flags.push('nsfw');
      details.nsfw = nsfwResult.matches;
    }

    // Spam check
    const spamResult = checkSpam(text);
    if (spamResult.flagged) {
      flags.push('spam');
      details.spam = spamResult.patterns;
    }

    // Copyright check
    const copyrightResult = checkCopyright(text);
    if (copyrightResult.flagged) {
      flags.push('potential_copyright');
      details.copyright = copyrightResult.indicators;
    }

    // Duplicate check (for comments)
    if (checkDuplicates && contentType === 'comment') {
      // Get user's recent comments
      const { data: recentComments } = await supabase
        .from('comments')
        .select('content')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10);

      const recentTexts = recentComments?.map(c => c.content) || [];
      const duplicateResult = checkDuplicate(text, recentTexts);
      
      if (duplicateResult.flagged) {
        flags.push('duplicate');
        details.duplicate = { similarity: duplicateResult.similarity };
      }
    }

    // Determine severity
    let severity: 'low' | 'medium' | 'high' = 'low';
    if (flags.includes('nsfw')) {
      severity = 'high';
    } else if (flags.includes('spam') || flags.includes('duplicate')) {
      severity = 'medium';
    } else if (flags.length > 0) {
      severity = 'low';
    }

    const isValid = flags.length === 0;

    // Log validation if content was flagged
    if (!isValid) {
      await supabase
        .from('abuse_logs')
        .insert({
          user_id: user.id,
          abuse_type: 'content_violation',
          severity,
          details: { flags, ...details, content_type: contentType },
        });

      logStep('Content flagged', { flags, severity });
    }

    const result: ValidationResult = {
      isValid,
      flags,
      severity,
      details,
    };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logStep('ERROR', { message });
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
