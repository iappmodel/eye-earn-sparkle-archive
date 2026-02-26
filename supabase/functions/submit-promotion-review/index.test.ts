import { assertEquals } from "jsr:@std/assert";
import { assert } from "jsr:@std/assert";
import type { SupabaseClientLike } from "./index.ts";
import { handleSubmitPromotionReview } from "./index.ts";

const TEST_ORIGIN = "http://localhost:8080";
const HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": TEST_ORIGIN,
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

const VALID_USER = { id: "user-123", email: "test@example.com" };

type MockConfig = {
  authUser?: typeof VALID_USER | null;
  authError?: Error | null;
  cachedIdempotency?: {
    response_body: unknown;
    response_status: number;
    created_at: string;
  } | null;
  rateLimit?: { allowed: boolean; retry_after_seconds?: number };
  verifiedCheckin?: { id: string; checked_in_at: string } | null;
  existingReview?: { id: string } | null;
  insertedReview?: Record<string, unknown> | null;
  updatedReview?: Record<string, unknown> | null;
};

function createMockSupabase(config: MockConfig = {}) {
  const rpcCalls: string[] = [];
  const insertedRows: Array<{ table: string; row: unknown }> = [];

  const resolvedAuthUser =
    Object.prototype.hasOwnProperty.call(config, "authUser")
      ? config.authUser ?? null
      : VALID_USER;

  const makeRewardIdempotencySelectChain = () => {
    const chain = {
      eq: (_col: string, _val: unknown) => chain,
      maybeSingle: () =>
        Promise.resolve({
          data: config.cachedIdempotency ?? null,
          error: null,
        }),
    };
    return chain;
  };

  const makePromotionCheckinsSelectChain = () => {
    const chain = {
      eq: (_col: string, _val: unknown) => chain,
      order: (_col: string, _opts?: unknown) => chain,
      limit: (_n: number) => chain,
      maybeSingle: () =>
        Promise.resolve({
          data: Object.prototype.hasOwnProperty.call(config, "verifiedCheckin")
            ? config.verifiedCheckin ?? null
            : { id: "checkin-1", checked_in_at: new Date().toISOString() },
          error: null,
        }),
    };
    return chain;
  };

  const makePromotionReviewsSelectChain = () => {
    const chain = {
      eq: (_col: string, _val: unknown) => chain,
      order: (_col: string, _opts?: unknown) => chain,
      limit: (_n: number) => chain,
      maybeSingle: () =>
        Promise.resolve({
          data: Object.prototype.hasOwnProperty.call(config, "existingReview")
            ? config.existingReview ?? null
            : null,
          error: null,
        }),
    };
    return chain;
  };

  const client = {
    auth: {
      getUser: (_token: string) =>
        Promise.resolve({
          data: { user: resolvedAuthUser },
          error: config.authError ?? null,
        }),
    },
    from: (table: string) => {
      if (table === "reward_idempotency") {
        return {
          select: (_cols: string) => makeRewardIdempotencySelectChain(),
          insert: (row: unknown) => {
            insertedRows.push({ table, row });
            return Promise.resolve({ data: null, error: null });
          },
        };
      }

      if (table === "promotion_checkins") {
        return {
          select: (_cols: string) => makePromotionCheckinsSelectChain(),
          insert: (_row: unknown) => Promise.resolve({ data: null, error: new Error("Unexpected insert") }),
        };
      }

      if (table === "promotion_reviews") {
        return {
          select: (_cols: string) => makePromotionReviewsSelectChain(),
          insert: (row: unknown) => {
            insertedRows.push({ table, row });
            const inserted = config.insertedReview ?? {
              id: "review-1",
              promotion_id: "00000000-0000-4000-8000-000000000123",
              user_id: VALID_USER.id,
              rating: 5,
              comment: "Great",
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            return {
              select: (_cols: string) => ({
                maybeSingle: () => Promise.resolve({ data: inserted, error: null }),
              }),
            };
          },
          update: (_row: unknown) => {
            const chain = {
              eq: (_col: string, _val: unknown) => chain,
              select: (_cols: string) => ({
                maybeSingle: () =>
                  Promise.resolve({
                    data: config.updatedReview ?? {
                      id: "review-1",
                      promotion_id: "00000000-0000-4000-8000-000000000123",
                      user_id: VALID_USER.id,
                      rating: 4,
                      comment: "Updated",
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    },
                    error: null,
                  }),
              }),
            };
            return chain;
          },
        };
      }

      return {
        select: (_cols: string) => ({
          eq: (_col: string, _val: unknown) => ({
            maybeSingle: () => Promise.resolve({ data: null, error: null }),
          }),
        }),
        insert: (_row: unknown) => Promise.resolve({ data: null, error: null }),
      };
    },
    rpc: (name: string, _params: Record<string, unknown>) => {
      rpcCalls.push(name);
      if (name === "check_reward_rate_limit") {
        if (config.rateLimit) {
          return Promise.resolve({
            data: [{ allowed: config.rateLimit.allowed, retry_after_seconds: config.rateLimit.retry_after_seconds ?? null }],
            error: null,
          });
        }
        return Promise.resolve({ data: [{ allowed: true }], error: null });
      }
      return Promise.resolve({ data: null, error: new Error(`Unexpected RPC: ${name}`) });
    },
  } as unknown as SupabaseClientLike;

  return { client, rpcCalls, insertedRows };
}

Deno.test("submit-promotion-review: missing auth header -> 401", async () => {
  const { client } = createMockSupabase();
  const req = new Request("http://localhost/", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: TEST_ORIGIN },
    body: JSON.stringify({
      promotionId: "00000000-0000-4000-8000-000000000123",
      rating: 5,
      comment: "Great",
    }),
  });

  const res = await handleSubmitPromotionReview(req, client, HEADERS);
  assertEquals(res.status, 401);
  const json = await res.json();
  assertEquals(json.error, "Unauthorized");
});

Deno.test("submit-promotion-review: invalid input -> 400", async () => {
  const { client } = createMockSupabase();
  const req = new Request("http://localhost/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: TEST_ORIGIN,
      Authorization: "Bearer fake-token",
    },
    body: JSON.stringify({
      promotionId: "not-a-uuid",
      rating: 9,
    }),
  });

  const res = await handleSubmitPromotionReview(req, client, HEADERS);
  assertEquals(res.status, 400);
  const json = await res.json();
  assertEquals(json.error, "Invalid input");
});

Deno.test("submit-promotion-review: requires verified check-in -> 400", async () => {
  const { client } = createMockSupabase({ verifiedCheckin: null });
  const req = new Request("http://localhost/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: TEST_ORIGIN,
      Authorization: "Bearer fake-token",
    },
    body: JSON.stringify({
      promotionId: "00000000-0000-4000-8000-000000000123",
      rating: 5,
      comment: "Great",
    }),
  });

  const res = await handleSubmitPromotionReview(req, client, HEADERS);
  assertEquals(res.status, 400);
  const json = await res.json();
  assertEquals(json.code, "checkin_required");
});

Deno.test("submit-promotion-review: idempotency hit returns cached response and skips rate-limit", async () => {
  const cachedBody = { success: true, updated: false, review: { id: "review-1" } };
  const { client, rpcCalls } = createMockSupabase({
    cachedIdempotency: {
      response_body: cachedBody,
      response_status: 200,
      created_at: new Date().toISOString(),
    },
  });

  const req = new Request("http://localhost/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: TEST_ORIGIN,
      Authorization: "Bearer fake-token",
      "idempotency-key": "11111111-1111-1111-1111-111111111111",
    },
    body: JSON.stringify({
      promotionId: "00000000-0000-4000-8000-000000000123",
      rating: 5,
      comment: "Great",
    }),
  });

  const res = await handleSubmitPromotionReview(req, client, HEADERS);
  assertEquals(res.status, 200);
  assertEquals(await res.json(), cachedBody);
  assertEquals(rpcCalls.length, 0);
});

Deno.test("submit-promotion-review: inserts review on success -> 200", async () => {
  const { client, insertedRows, rpcCalls } = createMockSupabase();
  const req = new Request("http://localhost/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: TEST_ORIGIN,
      Authorization: "Bearer fake-token",
      "idempotency-key": "22222222-2222-2222-2222-222222222222",
    },
    body: JSON.stringify({
      promotionId: "00000000-0000-4000-8000-000000000123",
      rating: 5,
      comment: "Great place",
    }),
  });

  const res = await handleSubmitPromotionReview(req, client, HEADERS);
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.success, true);
  assertEquals(json.updated, false);
  assert(json.review?.id);
  assert(rpcCalls.includes("check_reward_rate_limit"));
  assert(insertedRows.some((r) => r.table === "promotion_reviews"));
});
