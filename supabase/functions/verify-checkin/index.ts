import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Haversine formula to calculate distance between two coordinates in meters
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[verify-checkin] No authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized', success: false }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('[verify-checkin] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid token', success: false }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { 
      promotionId, 
      businessName,
      promotionLat, 
      promotionLng, 
      userLat, 
      userLng,
      rewardAmount,
      rewardType,
      maxDistanceMeters = 100 // Default 100 meter radius for check-in
    } = body;

    console.log('[verify-checkin] Request:', { 
      userId: user.id, 
      promotionId, 
      businessName,
      promotionLat, 
      promotionLng, 
      userLat, 
      userLng 
    });

    // Validate required fields
    if (!promotionLat || !promotionLng || !userLat || !userLng) {
      console.error('[verify-checkin] Missing coordinates');
      return new Response(
        JSON.stringify({ error: 'Missing location coordinates', success: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate distance between user and promotion
    const distance = calculateDistance(userLat, userLng, promotionLat, promotionLng);
    console.log('[verify-checkin] Distance calculated:', distance, 'meters');

    // Check if user is within geofence
    const isWithinRange = distance <= maxDistanceMeters;
    const status = isWithinRange ? 'verified' : 'failed';

    // Check for existing check-in in last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: existingCheckin } = await supabase
      .from('promotion_checkins')
      .select('id, checked_in_at')
      .eq('user_id', user.id)
      .eq('promotion_id', promotionId)
      .gte('checked_in_at', twentyFourHoursAgo)
      .single();

    if (existingCheckin) {
      console.log('[verify-checkin] Already checked in within 24 hours');
      return new Response(
        JSON.stringify({ 
          error: 'Already checked in at this location today', 
          success: false,
          lastCheckin: existingCheckin.checked_in_at
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create check-in record
    const { data: checkin, error: insertError } = await supabase
      .from('promotion_checkins')
      .insert({
        user_id: user.id,
        promotion_id: promotionId,
        business_name: businessName || 'Unknown Business',
        latitude: promotionLat,
        longitude: promotionLng,
        user_latitude: userLat,
        user_longitude: userLng,
        distance_meters: distance,
        status,
        reward_amount: isWithinRange ? rewardAmount : null,
        reward_type: isWithinRange ? rewardType : null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[verify-checkin] Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to record check-in', success: false }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If verified, also update user's coin balance
    if (isWithinRange && rewardAmount && rewardType) {
      const balanceField = rewardType === 'vicoin' ? 'vicoin_balance' : 'icoin_balance';
      
      // Get current balance
      const { data: profile } = await supabase
        .from('profiles')
        .select('vicoin_balance, icoin_balance')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        const currentBalance = (rewardType === 'vicoin' ? profile.vicoin_balance : profile.icoin_balance) || 0;
        await supabase
          .from('profiles')
          .update({ [balanceField]: currentBalance + rewardAmount })
          .eq('user_id', user.id);

        console.log('[verify-checkin] Updated balance:', { balanceField, newBalance: currentBalance + rewardAmount });
      }

      // Mark reward as claimed
      await supabase
        .from('promotion_checkins')
        .update({ reward_claimed: true, reward_claimed_at: new Date().toISOString() })
        .eq('id', checkin.id);
    }

    console.log('[verify-checkin] Success:', { 
      status, 
      distance: Math.round(distance), 
      isWithinRange 
    });

    return new Response(
      JSON.stringify({
        success: isWithinRange,
        verified: isWithinRange,
        status,
        distance: Math.round(distance),
        maxDistance: maxDistanceMeters,
        message: isWithinRange 
          ? `Check-in successful! You earned ${rewardAmount} ${rewardType}!` 
          : `Too far from location. You are ${Math.round(distance)}m away (max ${maxDistanceMeters}m)`,
        checkin,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[verify-checkin] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
