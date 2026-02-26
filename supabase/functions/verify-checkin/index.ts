import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { getCorsHeadersStrict } from "../_shared/cors.ts";
import { checkRewardRateLimit } from "../_shared/rateLimit.ts";
import { getIdempotencyKey, getCachedResponse, setCachedResponse } from "../_shared/idempotency.ts";

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
  promotionId: z.string().uuid('Invalid promotion ID').optional().nullable(),
  businessName: z.string().max(255).optional(),
  // Deprecated client hints; server resolves canonical promotion coords from DB for non-standalone check-ins.
  promotionLat: z.number().min(-90).max(90).optional(),
  promotionLng: z.number().min(-180).max(180).optional(),
  userLat: z.number().min(-90).max(90),
  userLng: z.number().min(-180).max(180),
  // Deprecated client hints; reward amount/type are server-authoritative for non-standalone check-ins.
  rewardAmount: z.number().int().min(0).max(10000).optional(),
  rewardType: z.enum(['vicoin', 'icoin']).optional(),
  maxDistanceMeters: z.number().int().min(10).max(5000).default(100),
  /** Standalone check-in (no promotion): one per 24h, small fixed reward */
  standalone: z.boolean().optional().default(false),
});

// Server-authoritative geofence radius for promotion check-ins.
// Clients may use their own local radius for UX hints, but backend verification must use a fixed threshold.
const PROMOTION_CHECKIN_MAX_DISTANCE_METERS = 150;

type FinalizePromotionCheckinRewardResult = {
  success?: boolean;
  already_claimed?: boolean;
  amount_added?: number;
  coin_type?: 'vicoin' | 'icoin' | string;
  new_balance?: number;
  xp_added?: number;
  streak_day?: number;
};

serve(async (req) => {
  const cors = getCorsHeadersStrict(req);
  if (!cors.ok) return cors.response;
  const headers = { ...cors.headers, 'Content-Type': 'application/json' };

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: cors.headers });
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
        { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('[verify-checkin] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid token', success: false }),
        { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    const idempotencyKey = getIdempotencyKey(req);
    if (idempotencyKey) {
      const cached = await getCachedResponse(supabase, idempotencyKey, user.id, 'verify_checkin');
      if (cached) {
        return new Response(JSON.stringify(cached.body), {
          status: cached.status,
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
      }
    }

    const rateLimit = await checkRewardRateLimit(supabase, user.id, req);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({
          error: 'Too many requests',
          code: 'rate_limit_exceeded',
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        }),
        { status: 429, headers: { ...headers, 'Content-Type': 'application/json', 'Retry-After': String(rateLimit.retryAfterSeconds) } }
      );
    }

    // Validate input with zod
    const parseResult = VerifyCheckinSchema.safeParse(await req.json());
    if (!parseResult.success) {
      console.warn('[verify-checkin] Validation failed:', parseResult.error.flatten());
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: parseResult.error.flatten().fieldErrors, success: false }),
        { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    const { 
      promotionId, businessName, promotionLat, promotionLng,
      userLat, userLng, rewardAmount, rewardType, maxDistanceMeters,
      standalone,
    } = parseResult.data;

    const effectivePromotionId = standalone ? null : (promotionId ?? null);
    let effectiveRewardAmount = standalone ? 10 : 0;
    let effectiveRewardType: 'vicoin' | 'icoin' = 'vicoin';
    let effectiveBusinessName = businessName || (standalone ? 'Quick Check-In' : 'Unknown Business');
    let effectivePromotionLat = standalone ? (promotionLat ?? userLat) : 0;
    let effectivePromotionLng = standalone ? (promotionLng ?? userLng) : 0;
    const effectiveMaxDistanceMeters = standalone
      ? maxDistanceMeters
      : PROMOTION_CHECKIN_MAX_DISTANCE_METERS;

    if (!standalone && !effectivePromotionId) {
      return new Response(
        JSON.stringify({ error: 'promotionId required when not standalone', success: false }),
        { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    if (!standalone && effectivePromotionId) {
      const { data: promotion, error: promotionError } = await supabase
        .from('promotions')
        .select('id, business_name, latitude, longitude, reward_amount, reward_type, is_active, expires_at')
        .eq('id', effectivePromotionId)
        .maybeSingle();

      if (promotionError) {
        console.error('[verify-checkin] Promotion lookup error:', promotionError);
        return new Response(
          JSON.stringify({ error: 'Failed to verify promotion', success: false }),
          { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } }
        );
      }

      if (!promotion) {
        return new Response(
          JSON.stringify({ error: 'Promotion not found', success: false }),
          { status: 404, headers: { ...headers, 'Content-Type': 'application/json' } }
        );
      }

      const expired = promotion.expires_at ? new Date(promotion.expires_at).getTime() <= Date.now() : false;
      if (!promotion.is_active || expired) {
        return new Response(
          JSON.stringify({ error: 'Promotion is not active', success: false }),
          { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
        );
      }

      effectiveBusinessName = promotion.business_name || effectiveBusinessName;
      effectivePromotionLat = Number(promotion.latitude);
      effectivePromotionLng = Number(promotion.longitude);
      effectiveRewardAmount = Math.max(0, Math.floor(Number(promotion.reward_amount ?? 0)));
      const promoRewardType = String(promotion.reward_type ?? 'vicoin');
      // Promotions may be configured as "both"; preserve prior behavior by crediting vicoin for check-ins.
      effectiveRewardType = promoRewardType === 'icoin' ? 'icoin' : 'vicoin';

      if (
        rewardAmount != null ||
        rewardType != null ||
        promotionLat != null ||
        promotionLng != null ||
        businessName != null ||
        maxDistanceMeters !== PROMOTION_CHECKIN_MAX_DISTANCE_METERS
      ) {
        console.log('[verify-checkin] Ignoring client-provided promo reward/location/radius fields in favor of server values', {
          userId: user.id,
          promotionId: effectivePromotionId,
        });
      }
    }

    console.log('[verify-checkin] Request:', {
      userId: user.id,
      promotionId: effectivePromotionId,
      businessName: effectiveBusinessName,
      promotionLat: effectivePromotionLat,
      promotionLng: effectivePromotionLng,
      userLat,
      userLng,
      maxDistanceMeters: effectiveMaxDistanceMeters,
      standalone,
    });

    // Calculate distance between user and promotion (for standalone, use 0 so it always passes)
    const distance = standalone ? 0 : calculateDistance(userLat, userLng, effectivePromotionLat, effectivePromotionLng);
    console.log('[verify-checkin] Distance calculated:', distance, 'meters');

    // Check if user is within geofence (standalone always in range)
    const isWithinRange = standalone || distance <= effectiveMaxDistanceMeters;
    const status = isWithinRange ? 'verified' : 'failed';

    // Check for existing check-in in last 24 hours at this location (or standalone: one per 24h)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    let query = supabase
      .from('promotion_checkins')
      .select('id, checked_in_at, status, reward_claimed, reward_amount, reward_type, streak_day, streak_bonus, distance_meters')
      .eq('user_id', user.id)
      .gte('checked_in_at', twentyFourHoursAgo)
      .order('checked_in_at', { ascending: false });

    if (standalone) {
      query = query.is('promotion_id', null);
    } else {
      query = query.eq('promotion_id', effectivePromotionId);
    }

    const { data: existingCheckin } = await query.limit(1).maybeSingle();

    if (existingCheckin) {
      const existingRewardTotal = Math.max(0, Math.floor(Number(existingCheckin.reward_amount ?? 0)));
      const existingRewardType = String(existingCheckin.reward_type ?? '');
      const canFinalizePendingReward =
        existingCheckin.status === 'verified' &&
        existingCheckin.reward_claimed !== true &&
        existingRewardTotal > 0 &&
        (existingRewardType === 'vicoin' || existingRewardType === 'icoin');

      if (canFinalizePendingReward) {
        const { data: finalizeData, error: finalizeError } = await supabase.rpc('finalize_promotion_checkin_reward', {
          p_user_id: user.id,
          p_checkin_id: existingCheckin.id,
        });

        if (finalizeError) {
          console.error('[verify-checkin] Failed to finalize pending check-in reward:', finalizeError);
          return new Response(
            JSON.stringify({
              error: 'Check-in exists but reward processing is pending. Please retry.',
              code: 'reward_processing_failed',
              success: false,
              checkinId: existingCheckin.id,
              retryable: true,
            }),
            { status: 503, headers: { ...headers, 'Content-Type': 'application/json', 'Retry-After': '5' } }
          );
        }

        console.log('[verify-checkin] Finalized pending check-in reward:', finalizeData);

        const nextAvailable = new Date(new Date(existingCheckin.checked_in_at).getTime() + 24 * 60 * 60 * 1000);
        const recoveredStreakDay = Math.max(1, Math.floor(Number(existingCheckin.streak_day ?? 1)));
        const recoveredBonusAmount = Math.max(0, Math.floor(Number(existingCheckin.streak_bonus ?? 0)));
        const recoveredBaseReward = Math.max(0, existingRewardTotal - recoveredBonusAmount);
        const recoveredDistance = Number.isFinite(Number(existingCheckin.distance_meters))
          ? Math.round(Number(existingCheckin.distance_meters))
          : Math.round(distance);
        const recoveredStreakBonusPercent = getStreakBonus(recoveredStreakDay);

        const successBody = {
          success: true,
          verified: true,
          status: 'verified',
          distance: recoveredDistance,
          maxDistance: effectiveMaxDistanceMeters,
          streak: {
            current: recoveredStreakDay,
            longest: recoveredStreakDay,
            bonus: recoveredStreakBonusPercent,
            bonusAmount: recoveredBonusAmount,
          },
          reward: {
            base: recoveredBaseReward,
            bonus: recoveredBonusAmount,
            total: existingRewardTotal,
            type: existingRewardType,
          },
          message: `Check-in reward finalized! You earned ${existingRewardTotal} ${existingRewardType}${recoveredBonusAmount > 0 ? ` (+${recoveredBonusAmount} streak bonus!)` : ''}!`,
          checkin: {
            ...existingCheckin,
            reward_claimed: true,
          },
          nextCheckInAvailableAt: nextAvailable.toISOString(),
          recoveredPendingReward: true,
        };
        if (idempotencyKey) await setCachedResponse(supabase, idempotencyKey, user.id, 'verify_checkin', 200, successBody);
        return new Response(
          JSON.stringify(successBody),
          { headers: { ...headers, 'Content-Type': 'application/json' } }
        );
      }

      const nextAvailable = new Date(new Date(existingCheckin.checked_in_at).getTime() + 24 * 60 * 60 * 1000);
      console.log('[verify-checkin] Already checked in within 24 hours');
      return new Response(
        JSON.stringify({ 
          error: 'Already checked in at this location today', 
          success: false,
          lastCheckin: existingCheckin.checked_in_at,
          nextCheckInAvailableAt: nextAvailable.toISOString(),
        }),
        { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
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
    const bonusAmount = Math.floor(effectiveRewardAmount * streakBonus / 100);
    const totalReward = effectiveRewardAmount + bonusAmount;

    console.log('[verify-checkin] Streak info:', { 
      newStreakDays, newLongestStreak, streakBonus, bonusAmount, totalReward 
    });

    // Create check-in record with streak info
    const { data: checkin, error: insertError } = await supabase
      .from('promotion_checkins')
      .insert({
        user_id: user.id,
        promotion_id: effectivePromotionId,
        business_name: effectiveBusinessName,
        latitude: effectivePromotionLat,
        longitude: effectivePromotionLng,
        user_latitude: userLat,
        user_longitude: userLng,
        distance_meters: distance,
        status,
        reward_amount: isWithinRange ? totalReward : null,
        reward_type: isWithinRange ? effectiveRewardType : null,
        streak_bonus: isWithinRange ? bonusAmount : 0,
        streak_day: newStreakDays,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[verify-checkin] Insert error:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to record check-in', success: false }),
        { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    // If verified, finalize reward + streak/XP in one DB transaction
    if (isWithinRange && totalReward && effectiveRewardType) {
      const { data: finalizeData, error: finalizeError } = await supabase.rpc('finalize_promotion_checkin_reward', {
        p_user_id: user.id,
        p_checkin_id: checkin.id,
      });

      if (finalizeError) {
        console.error('[verify-checkin] Atomic check-in finalization error:', finalizeError);
        return new Response(
          JSON.stringify({
            error: 'Check-in recorded, but reward processing failed. Please retry.',
            code: 'reward_processing_failed',
            success: false,
            checkinId: checkin.id,
            retryable: true,
            nextCheckInAvailableAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          }),
          { status: 503, headers: { ...headers, 'Content-Type': 'application/json', 'Retry-After': '5' } }
        );
      }

      console.log('[verify-checkin] Finalized check-in reward atomically:', finalizeData as FinalizePromotionCheckinRewardResult);
    }

    console.log('[verify-checkin] Success:', { 
      status, distance: Math.round(distance), isWithinRange,
      streak: newStreakDays, bonusAmount,
    });

    // Next check-in available at this location (24h from now)
    const nextCheckInAvailableAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const successBody = {
      success: isWithinRange,
      verified: isWithinRange,
      status,
      distance: Math.round(distance),
      maxDistance: effectiveMaxDistanceMeters,
      streak: {
        current: newStreakDays,
        longest: newLongestStreak,
        bonus: streakBonus,
        bonusAmount,
      },
      reward: {
        base: effectiveRewardAmount,
        bonus: bonusAmount,
        total: totalReward,
        type: effectiveRewardType,
      },
      message: isWithinRange 
        ? `Check-in successful! You earned ${totalReward} ${effectiveRewardType}${bonusAmount > 0 ? ` (+${bonusAmount} streak bonus!)` : ''}!` 
        : `Too far from location. You are ${Math.round(distance)}m away (max ${effectiveMaxDistanceMeters}m)`,
      checkin,
      nextCheckInAvailableAt,
    };
    if (idempotencyKey) await setCachedResponse(supabase, idempotencyKey, user.id, 'verify_checkin', 200, successBody);
    return new Response(
      JSON.stringify(successBody),
      { headers: { ...headers, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[verify-checkin] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', success: false }),
      { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  }
});
