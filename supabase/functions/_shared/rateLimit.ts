/**
 * Rate limiting for reward endpoints: per user and per IP.
 * Uses Postgres RPC check_reward_rate_limit for atomic check-and-increment.
 */

const REWARD_SCOPE = "reward";
const MAX_PER_USER_PER_MINUTE = 60;
const MAX_PER_IP_PER_MINUTE = 120;
const WINDOW_SECONDS = 60;

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

/** Normalize IP from X-Forwarded-For or X-Real-IP for bucket key. */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

export type SupabaseClientLike = {
  rpc: (name: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
};

/**
 * Check and consume one request for reward scope.
 * Returns { allowed: false, retryAfterSeconds } if either user or IP limit exceeded.
 */
export async function checkRewardRateLimit(
  supabase: SupabaseClientLike,
  userId: string,
  req: Request
): Promise<RateLimitResult> {
  const ip = getClientIp(req);
  const userKey = `user:${userId}`;
  const ipKey = `ip:${ip}`;

  const { data, error } = await supabase.rpc("check_reward_rate_limit", {
    p_scope: REWARD_SCOPE,
    p_user_key: userKey,
    p_ip_key: ipKey,
    p_max_per_user: MAX_PER_USER_PER_MINUTE,
    p_max_per_ip: MAX_PER_IP_PER_MINUTE,
    p_window_seconds: WINDOW_SECONDS,
  });

  if (error) {
    console.error("[rateLimit] RPC error:", error);
    return { allowed: true };
  }

  const row = Array.isArray(data) ? data[0] : data;
  const allowed = row?.allowed !== false;
  const retryAfter = row?.retry_after_seconds;

  if (allowed) return { allowed: true };
  return {
    allowed: false,
    retryAfterSeconds: typeof retryAfter === "number" ? Math.max(1, retryAfter) : 60,
  };
}
