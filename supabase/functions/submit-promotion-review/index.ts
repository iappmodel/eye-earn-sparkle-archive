import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { getCorsHeadersStrict } from "../_shared/cors.ts";
import { checkRewardRateLimit } from "../_shared/rateLimit.ts";
import { getIdempotencyKey, getCachedResponse, setCachedResponse } from "../_shared/idempotency.ts";

const SubmitPromotionReviewSchema = z.object({
  promotionId: z.string().uuid("Invalid promotion ID"),
  rating: z.number().int("Rating must be a whole number").min(1).max(5),
  comment: z.string().trim().max(2000, "Comment is too long").optional().nullable(),
}).strict();

// deno-lint-ignore no-explicit-any
export type SupabaseClientLike = any;

export async function handleSubmitPromotionReview(
  req: Request,
  supabase: SupabaseClientLike,
  headers: Record<string, string>,
): Promise<Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized" }),
      { status: 401, headers: { ...headers, "Content-Type": "application/json" } },
    );
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized" }),
      { status: 401, headers: { ...headers, "Content-Type": "application/json" } },
    );
  }

  const idempotencyKey = getIdempotencyKey(req);
  if (idempotencyKey) {
    const cached = await getCachedResponse(supabase, idempotencyKey, user.id, "submit_promotion_review");
    if (cached) {
      return new Response(JSON.stringify(cached.body), {
        status: cached.status,
        headers: { ...headers, "Content-Type": "application/json" },
      });
    }
  }

  const rateLimit = await checkRewardRateLimit(supabase, user.id, req);
  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Too many requests",
        code: "rate_limit_exceeded",
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      }),
      {
        status: 429,
        headers: {
          ...headers,
          "Content-Type": "application/json",
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  let rawBody: unknown = {};
  try {
    rawBody = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: "Invalid JSON body" }),
      { status: 400, headers: { ...headers, "Content-Type": "application/json" } },
    );
  }

  const parsed = SubmitPromotionReviewSchema.safeParse(rawBody);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Invalid input",
        details: parsed.error.flatten().fieldErrors,
      }),
      { status: 400, headers: { ...headers, "Content-Type": "application/json" } },
    );
  }

  const { promotionId, rating, comment } = parsed.data;
  const normalizedComment = comment?.trim() ? comment.trim() : null;

  // Require a verified check-in before allowing a review write.
  const { data: verifiedCheckin, error: checkinError } = await supabase
    .from("promotion_checkins")
    .select("id, checked_in_at")
    .eq("user_id", user.id)
    .eq("promotion_id", promotionId)
    .eq("status", "verified")
    .order("checked_in_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (checkinError) {
    console.error("[submit-promotion-review] check-in lookup error:", checkinError);
    throw checkinError;
  }
  if (!verifiedCheckin) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "You need a verified check-in before leaving a review",
        code: "checkin_required",
      }),
      { status: 400, headers: { ...headers, "Content-Type": "application/json" } },
    );
  }

  // Upsert-like behavior without schema changes: one review per user/promotion (latest row updated).
  const { data: existingReview, error: existingReviewError } = await supabase
    .from("promotion_reviews")
    .select("id")
    .eq("user_id", user.id)
    .eq("promotion_id", promotionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingReviewError) {
    console.error("[submit-promotion-review] existing review lookup error:", existingReviewError);
    throw existingReviewError;
  }

  let reviewRow: { id: string; promotion_id: string; user_id: string; rating: number; comment: string | null; created_at: string; updated_at: string } | null = null;
  let updated = false;

  if (existingReview?.id) {
    const { data: updatedReview, error: updateReviewError } = await supabase
      .from("promotion_reviews")
      .update({
        rating,
        comment: normalizedComment,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingReview.id)
      .eq("user_id", user.id)
      .select("id, promotion_id, user_id, rating, comment, created_at, updated_at")
      .maybeSingle();

    if (updateReviewError) {
      console.error("[submit-promotion-review] update review error:", updateReviewError);
      throw updateReviewError;
    }
    reviewRow = updatedReview;
    updated = true;
  } else {
    const { data: insertedReview, error: insertReviewError } = await supabase
      .from("promotion_reviews")
      .insert({
        promotion_id: promotionId,
        user_id: user.id,
        rating,
        comment: normalizedComment,
      })
      .select("id, promotion_id, user_id, rating, comment, created_at, updated_at")
      .maybeSingle();

    if (insertReviewError) {
      console.error("[submit-promotion-review] insert review error:", insertReviewError);
      throw insertReviewError;
    }
    reviewRow = insertedReview;
  }

  const successBody = {
    success: true,
    updated,
    review: reviewRow,
  };

  if (idempotencyKey) {
    await setCachedResponse(supabase, idempotencyKey, user.id, "submit_promotion_review", 200, successBody);
  }

  return new Response(
    JSON.stringify(successBody),
    { headers: { ...headers, "Content-Type": "application/json" } },
  );
}

if (import.meta.main) {
  serve(async (req) => {
    const cors = getCorsHeadersStrict(req);
    if (!cors.ok) return cors.response;
    const headers = { ...cors.headers, "Content-Type": "application/json" };

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: cors.headers });
    }

    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      return await handleSubmitPromotionReview(req, supabase, headers);
    } catch (error: unknown) {
      console.error("[submit-promotion-review] error:", error);
      const message = error instanceof Error ? error.message : "Internal server error";
      return new Response(
        JSON.stringify({ success: false, error: message }),
        { status: 500, headers: { ...headers, "Content-Type": "application/json" } },
      );
    }
  });
}
