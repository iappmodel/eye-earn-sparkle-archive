/**
 * Server-side replay protection for reward endpoints via Idempotency-Key header.
 * First request with a key is processed and response cached; duplicate keys return cached response.
 */

export type IdempotencyScope = "issue_reward" | "validate_attention" | "verify_checkin";

const IDEMPOTENCY_TTL_HOURS = 24;

/** Get idempotency key from request header (standard header name). */
export function getIdempotencyKey(req: Request): string | null {
  const key = req.headers.get("idempotency-key")?.trim();
  if (!key || key.length > 128) return null;
  return key;
}

interface RewardIdempotencyRow {
  response_body: unknown;
  response_status: number;
  created_at: string;
}

/** Supabase client with from().select().eq() and from().insert(). */
export type SupabaseClientLike = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (col: string, val: string) => { eq: (col: string, val: string) => { eq: (col: string, val: string) => { maybeSingle: () => Promise<{ data: RewardIdempotencyRow | null; error: unknown }> } } };
    };
    insert: (row: Record<string, unknown>) => Promise<{ error: unknown }>;
  };
};

/**
 * Look up cached response for (key, userId, scope).
 * Returns cached { body, status } if found and not expired; otherwise null.
 */
export async function getCachedResponse(
  supabase: SupabaseClientLike,
  key: string,
  userId: string,
  scope: IdempotencyScope
): Promise<{ body: unknown; status: number } | null> {
  const { data, error } = await supabase
    .from("reward_idempotency")
    .select("response_body, response_status, created_at")
    .eq("idempotency_key", key)
    .eq("user_id", userId)
    .eq("scope", scope)
    .maybeSingle();

  if (error || !data) return null;
  if (!data.response_body || data.response_status == null) return null;
  const created = new Date(data.created_at ?? 0).getTime();
  if (Date.now() - created > IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000) return null;
  return { body: data.response_body, status: data.response_status };
}

/**
 * Store response for (key, userId, scope). Ignore errors (e.g. duplicate key = concurrent request).
 */
export async function setCachedResponse(
  supabase: SupabaseClientLike,
  key: string,
  userId: string,
  scope: IdempotencyScope,
  responseStatus: number,
  responseBody: unknown
): Promise<void> {
  await supabase.from("reward_idempotency").insert({
    idempotency_key: key,
    user_id: userId,
    scope,
    response_status: responseStatus,
    response_body: responseBody,
  });
}
