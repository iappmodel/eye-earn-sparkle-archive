import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Haversine formula to calculate distance between two points
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { latitude, longitude, radiusKm = 10, category, rewardType } = await req.json();
    console.log('[GetNearbyPromos] Request:', { latitude, longitude, radiusKm, category, rewardType });

    if (!latitude || !longitude) {
      return new Response(
        JSON.stringify({ error: 'Latitude and longitude are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all active promotions
    let query = supabase
      .from('promotions')
      .select('*')
      .eq('is_active', true)
      .or('expires_at.is.null,expires_at.gt.now()');

    if (category) {
      query = query.eq('category', category);
    }

    if (rewardType && rewardType !== 'all') {
      query = query.or(`reward_type.eq.${rewardType},reward_type.eq.both`);
    }

    const { data: promotions, error } = await query;

    if (error) {
      console.error('[GetNearbyPromos] Query error:', error);
      throw error;
    }

    // Filter by distance and add distance to each promotion
    const nearbyPromotions = (promotions || [])
      .map(promo => {
        const distance = haversineDistance(
          latitude,
          longitude,
          promo.latitude,
          promo.longitude
        );
        return { ...promo, distance: Math.round(distance * 100) / 100 };
      })
      .filter(promo => promo.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);

    console.log('[GetNearbyPromos] Found:', nearbyPromotions.length, 'promotions');

    return new Response(
      JSON.stringify({
        promotions: nearbyPromotions,
        count: nearbyPromotions.length,
        center: { latitude, longitude },
        radius: radiusKm,
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
