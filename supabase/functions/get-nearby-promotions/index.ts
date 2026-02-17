import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Haversine formula to calculate distance between two points (km)
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

type SortOption = 'distance' | 'reward_desc' | 'reward_asc' | 'expiring_soon';

const NearbyPromotionsSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radiusKm: z.number().min(0.1).max(200).default(16), // ~10 miles default
  category: z.string().max(100).optional(),
  categories: z.array(z.string().max(100)).max(20).optional(), // multiple categories
  rewardType: z.string().max(50).optional(),
  minReward: z.number().min(0).max(10000).optional(),
  sortBy: z.enum(['distance', 'reward_desc', 'reward_asc', 'expiring_soon']).optional(),
  limit: z.number().min(1).max(200).default(100),
  offset: z.number().min(0).max(1000).default(0),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const parseResult = NearbyPromotionsSchema.safeParse(body);
    if (!parseResult.success) {
      console.warn('[GetNearbyPromos] Validation failed:', parseResult.error.flatten());
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parseResult.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      latitude,
      longitude,
      radiusKm,
      category,
      categories,
      rewardType,
      minReward,
      sortBy = 'distance',
      limit,
      offset,
    } = parseResult.data;

    const categoryList = categories?.length
      ? categories
      : category
        ? [category]
        : null;

    console.log('[GetNearbyPromos] Request:', {
      latitude,
      longitude,
      radiusKm,
      categoryList,
      rewardType,
      minReward,
      sortBy,
      limit,
      offset,
    });

    let query = supabase
      .from('promotions')
      .select('*')
      .eq('is_active', true)
      .or('expires_at.is.null,expires_at.gt.now()');

    if (categoryList?.length) {
      query = query.in('category', categoryList);
    }

    if (rewardType && rewardType !== 'all') {
      query = query.or(`reward_type.eq.${rewardType},reward_type.eq.both`);
    }

    if (minReward != null && minReward > 0) {
      query = query.gte('reward_amount', minReward);
    }

    const { data: promotions, error } = await query;

    if (error) {
      console.error('[GetNearbyPromos] Query error:', error);
      throw error;
    }

    const withDistance = (promotions || [])
      .map((p) => ({
        ...p,
        distance: Math.round(haversineDistance(latitude, longitude, p.latitude, p.longitude) * 100) / 100,
      }))
      .filter((p) => p.distance <= radiusKm);

    const now = Date.now();
    const sortFn = (a: { distance: number; reward_amount: number; expires_at: string | null }, b: typeof a) => {
      switch (sortBy) {
        case 'reward_desc':
          return b.reward_amount - a.reward_amount;
        case 'reward_asc':
          return a.reward_amount - b.reward_amount;
        case 'expiring_soon': {
          const expA = a.expires_at ? new Date(a.expires_at).getTime() : Infinity;
          const expB = b.expires_at ? new Date(b.expires_at).getTime() : Infinity;
          return expA - expB;
        }
        default:
          return a.distance - b.distance;
      }
    };

    const sorted = withDistance.sort(sortFn);
    const paginated = sorted.slice(offset, offset + limit);

    console.log('[GetNearbyPromos] Found:', sorted.length, 'within radius, returning', paginated.length);

    return new Response(
      JSON.stringify({
        promotions: paginated,
        count: paginated.length,
        total: sorted.length,
        center: { latitude, longitude },
        radius: radiusKm,
        sortBy,
        hasMore: offset + paginated.length < sorted.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('[GetNearbyPromos] Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
