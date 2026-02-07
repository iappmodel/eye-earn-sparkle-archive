import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

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

// Streak bonus percentages
const STREAK_BONUSES: { [key: number]: number } = {
  2: 5,
  3: 10,
  5: 15,
  7: 25,
  14: 35,
  30: 50,
};

function getStreakBonus(streakDays: number): number {
  let bonus = 0;
  for (const [days, bonusPercent] of Object.entries(STREAK_BONUSES)) {
    if (streakDays >= parseInt(days)) {
      bonus = bonusPercent;
    }
  }
  return bonus;
}

const VerifyCheckinSchema = z.object({
  promotionId: z.string().uuid('Invalid promotion ID').optional(),
  businessName: z.string().max(255).optional(),
  promotionLat: z.number().min(-90).max(90),
  promotionLng: z.number().min(-180).max(180),
  userLat: z.number().min(-90).max(90),
  userLng: z.number().min(-180).max(180),
  rewardAmount: z.number().int().min(0).max(10000).optional(),
  rewardType: z.enum(['vicoin', 'icoin']).optional(),
  maxDistanceMeters: z.number().int().min(10).max(5000).default(100),
});

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

    // Validate input with zod
    const parseResult = VerifyCheckinSchema.safeParse(await req.json());
    if (!parseResult.success) {
      console.warn('[verify-checkin] Validation failed:', parseResult.error.flatten());
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parseResult.error.flatten().fieldErrors, success: false }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { 
      promotionId, businessName, promotionLat, promotionLng,
      userLat, userLng, rewardAmount, rewardType, maxDistanceMeters 
    } = parseResult.data;

    console.log('[verify-checkin] Request:', { 
      userId: user.id, promotionId, businessName,
      promotionLat, promotionLng, userLat, userLng 
    });

    // Calculate distance between user and promotion
    const distance = calculateDistance(userLat, userLng, promotionLat, promotionLng);
    console.log('[verify-checkin] Distance calculated:', distance, 'meters');

    // Check if user is within geofence
    const isWithinRange = distance <= maxDistanceMeters;
    const status = isWithinRange ? 'verified' : 'failed';

    // Check for existing check-in in last 24 hours at this location
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

    // Get or create user_levels for streak tracking
    let { data: userLevel } = await supabase
      .from('user_levels')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!userLevel) {
      const { data: newLevel } = await supabase
        .from('user_levels')
        .insert({ user_id: user.id, streak_days: 0, longest_streak: 0, level: 1, current_xp: 0, total_xp: 0 })
        .select()
        .single();
      userLevel = newLevel;
    }

    // Calculate streak
    let newStreakDays = 1;
    let newLongestStreak = userLevel?.longest_streak || 0;
    const today = new Date().toISOString().split('T')[0];
    const lastActiveDate = userLevel?.last_active_date;

    if (lastActiveDate) {
      const lastActive = new Date(lastActiveDate);
      const todayDate = new Date(today);
      const diffDays = Math.floor((todayDate.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        newStreakDays = (userLevel?.streak_days || 0) + 1;
      } else if (diffDays === 0) {
        newStreakDays = userLevel?.streak_days || 1;
      }
    }

    if (newStreakDays > newLongestStreak) {
      newLongestStreak = newStreakDays;
    }

    // Calculate streak bonus
    const streakBonus = getStreakBonus(newStreakDays);
    const bonusAmount = Math.floor((rewardAmount || 0) * streakBonus / 100);
    const totalReward = (rewardAmount || 0) + bonusAmount;

    console.log('[verify-checkin] Streak info:', { 
      newStreakDays, newLongestStreak, streakBonus, bonusAmount, totalReward 
    });

    // Create check-in record with streak info
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
        reward_amount: isWithinRange ? totalReward : null,
        reward_type: isWithinRange ? rewardType : null,
        streak_bonus: isWithinRange ? bonusAmount : 0,
        streak_day: newStreakDays,
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

    // If verified, update user's coin balance and streak
    if (isWithinRange && totalReward && rewardType) {
      const balanceField = rewardType === 'vicoin' ? 'vicoin_balance' : 'icoin_balance';
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('vicoin_balance, icoin_balance')
        .eq('user_id', user.id)
        .single();

      if (profile) {
        const currentBalance = (rewardType === 'vicoin' ? profile.vicoin_balance : profile.icoin_balance) || 0;
        await supabase
          .from('profiles')
          .update({ [balanceField]: currentBalance + totalReward })
          .eq('user_id', user.id);

        console.log('[verify-checkin] Updated balance:', { balanceField, newBalance: currentBalance + totalReward });
      }

      // Update streak in user_levels
      await supabase
        .from('user_levels')
        .update({ 
          streak_days: newStreakDays,
          longest_streak: newLongestStreak,
          last_active_date: today,
        })
        .eq('user_id', user.id);

      // Mark reward as claimed
      await supabase
        .from('promotion_checkins')
        .update({ reward_claimed: true, reward_claimed_at: new Date().toISOString() })
        .eq('id', checkin.id);

      // Add XP for check-in
      const xpReward = 25 + (newStreakDays >= 7 ? 10 : 0);
      await supabase
        .from('user_levels')
        .update({ 
          current_xp: (userLevel?.current_xp || 0) + xpReward,
          total_xp: (userLevel?.total_xp || 0) + xpReward,
        })
        .eq('user_id', user.id);
    }

    console.log('[verify-checkin] Success:', { 
      status, distance: Math.round(distance), isWithinRange,
      streak: newStreakDays, bonusAmount,
    });

    return new Response(
      JSON.stringify({
        success: isWithinRange,
        verified: isWithinRange,
        status,
        distance: Math.round(distance),
        maxDistance: maxDistanceMeters,
        streak: {
          current: newStreakDays,
          longest: newLongestStreak,
          bonus: streakBonus,
          bonusAmount,
        },
        reward: {
          base: rewardAmount,
          bonus: bonusAmount,
          total: totalReward,
          type: rewardType,
        },
        message: isWithinRange 
          ? `Check-in successful! You earned ${totalReward} ${rewardType}${bonusAmount > 0 ? ` (+${bonusAmount} streak bonus!)` : ''}!` 
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
