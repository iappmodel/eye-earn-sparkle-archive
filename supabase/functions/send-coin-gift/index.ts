import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { getCorsHeadersStrict } from "../_shared/cors.ts";
import { checkRewardRateLimit } from "../_shared/rateLimit.ts";
import { getIdempotencyKey, getCachedResponse, setCachedResponse } from "../_shared/idempotency.ts";

const SendCoinGiftSchema = z.object({
  recipientId: z.string().uuid("Invalid recipient ID"),
  amount: z.number().int("Amount must be a whole number").min(1).max(1_000_000),
  coinType: z.enum(["vicoin", "icoin"]),
  message: z
    .string()
    .trim()
    .max(280, "Message must be 280 characters or less")
    .optional(),
  idempotencyKey: z.string().uuid("Invalid idempotency key").optional(),
}).strict();

// deno-lint-ignore no-explicit-any
export type SupabaseClientLike = any;

export async function handleSendCoinGift(
  req: Request,
  supabase: SupabaseClientLike,
  headers: Record<string, string>,
): Promise<Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(
      JSON.stringify({ error: "Unauthorized", success: false }),
      { status: 401, headers: { ...headers, "Content-Type": "application/json" } },
    );
  }

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return new Response(
      JSON.stringify({ error: "Unauthorized", success: false }),
      { status: 401, headers: { ...headers, "Content-Type": "application/json" } },
    );
  }

  let rawBody: unknown = {};
  try {
    rawBody = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body", success: false }),
      { status: 400, headers: { ...headers, "Content-Type": "application/json" } },
    );
  }

  const parsed = SendCoinGiftSchema.safeParse(rawBody);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({
        error: "Invalid input",
        details: parsed.error.flatten().fieldErrors,
        success: false,
      }),
      { status: 400, headers: { ...headers, "Content-Type": "application/json" } },
    );
  }

  const { recipientId, amount, coinType, message, idempotencyKey } = parsed.data;
  const replayKey = getIdempotencyKey(req) ?? idempotencyKey ?? null;

  if (replayKey) {
    const cached = await getCachedResponse(supabase, replayKey, user.id, "send_coin_gift");
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
        error: "Too many requests",
        code: "rate_limit_exceeded",
        retryAfterSeconds: rateLimit.retryAfterSeconds,
        success: false,
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

  const { data, error: rpcError } = await supabase.rpc("atomic_send_coin_gift", {
    p_sender_id: user.id,
    p_recipient_id: recipientId,
    p_amount: amount,
    p_coin_type: coinType,
    p_message: message ?? null,
    p_gift_id: idempotencyKey ?? null,
  });

  if (rpcError) {
    console.error("[SendCoinGift] RPC error:", rpcError);
    const msg = rpcError.message || "";

    if (msg.includes("SELF_GIFT")) {
      return new Response(
        JSON.stringify({ error: "You cannot gift coins to yourself", code: "self_gift", success: false }),
        { status: 400, headers: { ...headers, "Content-Type": "application/json" } },
      );
    }
    if (msg.includes("INSUFFICIENT_BALANCE")) {
      return new Response(
        JSON.stringify({ error: "Insufficient balance", code: "insufficient_balance", success: false }),
        { status: 400, headers: { ...headers, "Content-Type": "application/json" } },
      );
    }
    if (msg.includes("RECIPIENT_NOT_FOUND")) {
      return new Response(
        JSON.stringify({ error: "Recipient not found", code: "recipient_not_found", success: false }),
        { status: 404, headers: { ...headers, "Content-Type": "application/json" } },
      );
    }
    if (msg.includes("SENDER_NOT_FOUND")) {
      return new Response(
        JSON.stringify({ error: "User profile not found", code: "profile_not_found", success: false }),
        { status: 404, headers: { ...headers, "Content-Type": "application/json" } },
      );
    }
    if (msg.includes("INVALID_AMOUNT") || msg.includes("INVALID_COIN_TYPE")) {
      return new Response(
        JSON.stringify({ error: "Invalid gift request", code: "invalid_request", success: false }),
        { status: 400, headers: { ...headers, "Content-Type": "application/json" } },
      );
    }

    throw new Error("Failed to send coin gift");
  }

  const successBody = {
    success: true,
    gift_id: data?.gift_id ?? null,
    amount: data?.amount ?? amount,
    coin_type: data?.coin_type ?? coinType,
    new_balance: data?.new_balance ?? null,
    idempotent: data?.idempotent === true,
  };

  if (replayKey) {
    await setCachedResponse(supabase, replayKey, user.id, "send_coin_gift", 200, successBody);
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
      return await handleSendCoinGift(req, supabase, headers);
    } catch (error: unknown) {
      console.error("[SendCoinGift] Error:", error);
      const message = error instanceof Error ? error.message : "Internal server error";
      return new Response(
        JSON.stringify({ error: message, success: false }),
        { status: 500, headers: { ...headers, "Content-Type": "application/json" } },
      );
    }
  });
}
