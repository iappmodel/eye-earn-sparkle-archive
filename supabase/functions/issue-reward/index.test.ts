/**
 * Critical-path tests: reward issuance and caps.
 * 1. No validated attention session → 401/400
 * 2. Forged contentId/amount → ignored/blocked
 * 3. Same session id twice → second fails
 * 4. Caps enforced under concurrency (10 parallel → still capped)
 */
import { assertEquals } from "jsr:@std/assert";
import { assert } from "jsr:@std/assert";
import type { SupabaseClientLike } from "./index.ts";
import { handleIssueReward } from "./index.ts";
// index.ts guards serve() with import.meta.main so tests don't start the server

const TEST_ORIGIN = "http://localhost:8080";
const HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": TEST_ORIGIN,
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

const VALID_USER = { id: "user-123", email: "test@test.com" };

function mockSupabase(overrides: {
  getUser?: () => Promise<{ data: { user: typeof VALID_USER | null }; error: Error | null }>;
  attentionSession?: { data: unknown; error: unknown };
  redeemRpc?: () => Promise<{ data: unknown; error: unknown }>;
}): SupabaseClientLike {
  const chain = {
    eq: (_col: string, _val: unknown) => ({
      maybeSingle: () =>
        Promise.resolve({
          data: overrides.attentionSession?.data ?? null,
          error: overrides.attentionSession?.error ?? null,
        }),
      limit: () => chain,
      or: () => chain,
      single: () =>
        Promise.resolve({
          data: overrides.attentionSession?.data ?? null,
          error: overrides.attentionSession?.error ?? null,
        }),
    }),
    select: (_cols?: string) => chain,
    insert: () => Promise.resolve({ error: null }),
  };
  return {
    auth: {
      getUser: overrides.getUser ?? (() =>
        Promise.resolve({ data: { user: VALID_USER }, error: null })),
    },
    from: (_table: string) => chain,
    rpc:
      overrides.redeemRpc ??
      (() =>
        Promise.resolve({
          data: {
            success: true,
            amount: 5,
            coin_type: "icoin",
            new_balance: 100,
            daily_remaining_icoin: 75,
            daily_remaining_vicoin: 120,
            daily_remaining_promo_views: 19,
          },
          error: null,
        })),
  } as unknown as SupabaseClientLike;
}

Deno.test("issue-reward: no auth → 401", async () => {
  const supabase = mockSupabase({
    getUser: () =>
      Promise.resolve({ data: { user: null }, error: new Error("Unauthorized") }),
  });
  const req = new Request("http://localhost/", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: TEST_ORIGIN },
    body: JSON.stringify({
      rewardType: "promo_view",
      attentionSessionId: "00000000-0000-0000-0000-000000000001",
      mediaId: "00000000-0000-0000-0000-000000000002",
    }),
  });
  const res = await handleIssueReward(req, supabase, HEADERS);
  assertEquals(res.status, 401);
});

Deno.test("issue-reward: no Authorization header → 401", async () => {
  const supabase = mockSupabase({
    getUser: () =>
      Promise.resolve({ data: { user: null }, error: new Error("No token") }),
  });
  const req = new Request("http://localhost/", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: TEST_ORIGIN },
    body: JSON.stringify({
      rewardType: "promo_view",
      attentionSessionId: "00000000-0000-0000-0000-000000000001",
      mediaId: "00000000-0000-0000-0000-000000000002",
    }),
  });
  const res = await handleIssueReward(req, supabase, HEADERS);
  assertEquals(res.status, 401);
});

Deno.test("issue-reward: promo_view without valid session → 400", async () => {
  const supabase = mockSupabase({
    attentionSession: { data: null, error: null },
  });
  const req = new Request("http://localhost/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: TEST_ORIGIN,
      Authorization: "Bearer fake-token",
    },
    body: JSON.stringify({
      rewardType: "promo_view",
      attentionSessionId: "00000000-0000-0000-0000-000000000001",
      mediaId: "00000000-0000-0000-0000-000000000002",
    }),
  });
  const res = await handleIssueReward(req, supabase, HEADERS);
  assertEquals(res.status, 400);
  const json = await res.json();
  assert(json.code === "invalid_session" || json.error?.toLowerCase().includes("session"));
});

Deno.test("issue-reward: forged amount/coinType → 400 (forbidden keys)", async () => {
  const supabase = mockSupabase({});
  const req = new Request("http://localhost/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: TEST_ORIGIN,
      Authorization: "Bearer fake-token",
    },
    body: JSON.stringify({
      rewardType: "promo_view",
      attentionSessionId: "00000000-0000-0000-0000-000000000001",
      mediaId: "00000000-0000-0000-0000-000000000002",
      amount: 999,
      coinType: "vicoin",
    }),
  });
  const res = await handleIssueReward(req, supabase, HEADERS);
  assertEquals(res.status, 400);
  const json = await res.json();
  assert(
    json.error?.includes("Forbidden") || json.error?.includes("amount") || json.error?.includes("coinType")
  );
});

Deno.test("issue-reward: forged mediaId (session does not match media) → 400", async () => {
  const sessionId = "00000000-0000-0000-0000-000000000001";
  const mediaIdFromSession = "00000000-0000-0000-0000-000000000002";
  const forgedMediaId = "00000000-0000-0000-0000-000000000099";
  const supabase = mockSupabase({
    attentionSession: {
      data: {
        id: sessionId,
        user_id: VALID_USER.id,
        content_id: mediaIdFromSession,
        media_id: mediaIdFromSession,
        validated: true,
        validation_score: 95,
        redeemed_at: null,
      },
      error: null,
    },
  });
  const req = new Request("http://localhost/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: TEST_ORIGIN,
      Authorization: "Bearer fake-token",
    },
    body: JSON.stringify({
      rewardType: "promo_view",
      attentionSessionId: sessionId,
      mediaId: forgedMediaId,
    }),
  });
  const res = await handleIssueReward(req, supabase, HEADERS);
  assertEquals(res.status, 400);
  const json = await res.json();
  assert(json.code === "invalid_session" || json.error?.toLowerCase().includes("match"));
});

Deno.test("issue-reward: same session id twice → second call fails 400", async () => {
  const sessionId = "00000000-0000-0000-0000-000000000001";
  const mediaId = "00000000-0000-0000-0000-000000000002";
  let redeemCount = 0;
  const supabase = mockSupabase({
    attentionSession: {
      data: {
        id: sessionId,
        user_id: VALID_USER.id,
        content_id: mediaId,
        media_id: mediaId,
        validated: true,
        validation_score: 95,
        redeemed_at: null,
      },
      error: null,
    },
    redeemRpc: () => {
      redeemCount++;
      if (redeemCount === 1) {
        return Promise.resolve({
          data: {
            success: true,
            amount: 5,
            coin_type: "icoin",
            new_balance: 100,
            daily_remaining_icoin: 75,
            daily_remaining_vicoin: 120,
            daily_remaining_promo_views: 19,
          },
          error: null,
        });
      }
      return Promise.resolve({
        data: { success: false, code: "invalid_session" },
        error: null,
      });
    },
  });

  const body = JSON.stringify({
    rewardType: "promo_view",
    attentionSessionId: sessionId,
    mediaId,
  });
  const req1 = new Request("http://localhost/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: TEST_ORIGIN,
      Authorization: "Bearer fake-token",
    },
    body,
  });
  const res1 = await handleIssueReward(req1, supabase, HEADERS);
  assertEquals(res1.status, 200, "first redeem should succeed");

  const req2 = new Request("http://localhost/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: TEST_ORIGIN,
      Authorization: "Bearer fake-token",
    },
    body,
  });
  const res2 = await handleIssueReward(req2, supabase, HEADERS);
  assertEquals(res2.status, 400, "second redeem with same session must fail");
  const json2 = await res2.json();
  assert(
    json2.code === "invalid_session" || json2.error?.toLowerCase().includes("redeemed") || json2.success === false
  );
});

Deno.test("issue-reward: 10 parallel requests → capped (mock allows 3, rest get limit)", async () => {
  const sessionId = "00000000-0000-0000-0000-000000000001";
  const mediaId = "00000000-0000-0000-0000-000000000002";
  const CAP = 3;
  let redeemCount = 0;
  const supabase = mockSupabase({
    attentionSession: {
      data: {
        id: sessionId,
        user_id: VALID_USER.id,
        content_id: mediaId,
        media_id: mediaId,
        validated: true,
        validation_score: 95,
        redeemed_at: null,
      },
      error: null,
    },
    redeemRpc: () => {
      redeemCount += 1;
      if (redeemCount <= CAP) {
        return Promise.resolve({
          data: {
            success: true,
            amount: 5,
            coin_type: "icoin",
            new_balance: 100,
            daily_remaining_icoin: 75,
            daily_remaining_vicoin: 120,
            daily_remaining_promo_views: Math.max(0, 20 - redeemCount),
          },
          error: null,
        });
      }
      return Promise.resolve({
        data: {
          success: false,
          code: "daily_limit_reached",
          limit_type: "promo_views",
        },
        error: null,
      });
    },
  });

  const body = JSON.stringify({
    rewardType: "promo_view",
    attentionSessionId: sessionId,
    mediaId,
  });
  const requests = Array.from({ length: 10 }, () =>
    new Request("http://localhost/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: TEST_ORIGIN,
        Authorization: "Bearer fake-token",
      },
      body,
    })
  );

  const results = await Promise.all(
    requests.map((req) => handleIssueReward(req, supabase, HEADERS))
  );

  const successCount = results.filter((r) => r.status === 200).length;
  const rateLimitedCount = results.filter((r) => r.status === 429).length;
  const failCount = results.filter((r) => r.status === 400).length;

  assert(
    successCount <= CAP,
    `Expected at most ${CAP} successes under cap, got ${successCount}`
  );
  assert(
    rateLimitedCount + failCount >= 10 - CAP,
    `Expected at least ${10 - CAP} rate-limited or failed, got ${rateLimitedCount} 429 and ${failCount} 400`
  );
});
