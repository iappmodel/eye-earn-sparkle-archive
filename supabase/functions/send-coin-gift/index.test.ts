import { assertEquals } from "jsr:@std/assert";
import { assert } from "jsr:@std/assert";
import type { SupabaseClientLike } from "./index.ts";
import { handleSendCoinGift } from "./index.ts";

const TEST_ORIGIN = "http://localhost:8080";
const HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": TEST_ORIGIN,
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

const VALID_USER = { id: "00000000-0000-0000-0000-000000000001", email: "gift@test.com" };
const RECIPIENT_ID = "00000000-0000-0000-0000-000000000002";
const IDEMPOTENCY_KEY = "11111111-1111-1111-1111-111111111111";

type MockConfig = {
  authUser?: typeof VALID_USER | null;
  authError?: Error | null;
  rateLimit?: { allowed: boolean; retry_after_seconds?: number };
  giftRpcResult?: { data: unknown; error: unknown };
  cachedIdempotency?: {
    response_body: unknown;
    response_status: number;
    created_at: string;
  } | null;
};

function makeEqChain(config: MockConfig) {
  return {
    eq: (_col: string, _val: unknown) => makeEqChain(config),
    maybeSingle: () =>
      Promise.resolve({
        data: config.cachedIdempotency ?? null,
        error: null,
      }),
  };
}

function createMockSupabase(config: MockConfig = {}) {
  const rpcCalls: Array<{ name: string; params: Record<string, unknown> }> = [];
  const inserts: Array<{ table: string; row: unknown }> = [];
  const resolvedAuthUser =
    Object.prototype.hasOwnProperty.call(config, "authUser")
      ? config.authUser ?? null
      : VALID_USER;

  const client = {
    auth: {
      getUser: (_token: string) =>
        Promise.resolve({
          data: { user: resolvedAuthUser },
          error: config.authError ?? null,
        }),
    },
    from: (table: string) => ({
      select: (_cols: string) => makeEqChain(config),
      insert: (row: unknown) => {
        inserts.push({ table, row });
        return Promise.resolve({ error: null });
      },
    }),
    rpc: (name: string, params: Record<string, unknown>) => {
      rpcCalls.push({ name, params });
      if (name === "check_reward_rate_limit") {
        if (config.rateLimit) {
          return Promise.resolve({
            data: [{ allowed: config.rateLimit.allowed, retry_after_seconds: config.rateLimit.retry_after_seconds ?? null }],
            error: null,
          });
        }
        return Promise.resolve({ data: [{ allowed: true }], error: null });
      }
      if (name === "atomic_send_coin_gift") {
        return Promise.resolve(config.giftRpcResult ?? {
          data: {
            success: true,
            gift_id: IDEMPOTENCY_KEY,
            amount: 25,
            coin_type: "vicoin",
            new_balance: 975,
            idempotent: false,
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: new Error(`Unexpected RPC: ${name}`) });
    },
  } as unknown as SupabaseClientLike;

  return { client, rpcCalls, inserts };
}

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost/", {
    method: "POST",
    headers: {
      Origin: TEST_ORIGIN,
      "Content-Type": "application/json",
      Authorization: "Bearer token",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

Deno.test("send-coin-gift: missing auth header → 401", async () => {
  const { client } = createMockSupabase();
  const req = new Request("http://localhost/", {
    method: "POST",
    headers: { Origin: TEST_ORIGIN, "Content-Type": "application/json" },
    body: JSON.stringify({ recipientId: RECIPIENT_ID, amount: 25, coinType: "vicoin" }),
  });

  const res = await handleSendCoinGift(req, client, HEADERS);
  assertEquals(res.status, 401);
  assertEquals((await res.json()).error, "Unauthorized");
});

Deno.test("send-coin-gift: invalid body → 400", async () => {
  const { client } = createMockSupabase();
  const req = makeRequest({
    recipientId: "not-a-uuid",
    amount: 0,
    coinType: "dogecoin",
    extra: "forbidden",
  });

  const res = await handleSendCoinGift(req, client, HEADERS);
  assertEquals(res.status, 400);
  const json = await res.json();
  assertEquals(json.error, "Invalid input");
  assert(json.details != null);
});

Deno.test("send-coin-gift: rate limit exceeded → 429", async () => {
  const { client, rpcCalls } = createMockSupabase({
    rateLimit: { allowed: false, retry_after_seconds: 23 },
  });
  const req = makeRequest({
    recipientId: RECIPIENT_ID,
    amount: 25,
    coinType: "vicoin",
  });

  const res = await handleSendCoinGift(req, client, HEADERS);
  assertEquals(res.status, 429);
  assertEquals(res.headers.get("Retry-After"), "23");
  const json = await res.json();
  assertEquals(json.code, "rate_limit_exceeded");
  assertEquals(rpcCalls.length, 1);
  assertEquals(rpcCalls[0].name, "check_reward_rate_limit");
});

Deno.test("send-coin-gift: idempotency cache hit returns cached response and skips rate-limit/rpc", async () => {
  const cachedBody = {
    success: true,
    gift_id: IDEMPOTENCY_KEY,
    amount: 25,
    coin_type: "vicoin",
    new_balance: 975,
    idempotent: false,
  };
  const { client, rpcCalls } = createMockSupabase({
    cachedIdempotency: {
      response_body: cachedBody,
      response_status: 200,
      created_at: new Date().toISOString(),
    },
  });

  const req = makeRequest(
    {
      recipientId: RECIPIENT_ID,
      amount: 25,
      coinType: "vicoin",
      idempotencyKey: IDEMPOTENCY_KEY,
    },
    { "idempotency-key": IDEMPOTENCY_KEY },
  );

  const res = await handleSendCoinGift(req, client, HEADERS);
  assertEquals(res.status, 200);
  assertEquals(await res.json(), cachedBody);
  assertEquals(rpcCalls.length, 0);
});

Deno.test("send-coin-gift: SELF_GIFT rpc error maps to 400", async () => {
  const { client } = createMockSupabase({
    giftRpcResult: {
      data: null,
      error: { message: "SELF_GIFT: Cannot gift coins to yourself" },
    },
  });
  const req = makeRequest({
    recipientId: RECIPIENT_ID,
    amount: 25,
    coinType: "vicoin",
    idempotencyKey: IDEMPOTENCY_KEY,
  });

  const res = await handleSendCoinGift(req, client, HEADERS);
  assertEquals(res.status, 400);
  const json = await res.json();
  assertEquals(json.code, "self_gift");
});

Deno.test("send-coin-gift: success passes idempotency key into rpc, caches response, and returns normalized response", async () => {
  const { client, rpcCalls, inserts } = createMockSupabase({
    giftRpcResult: {
      data: {
        gift_id: IDEMPOTENCY_KEY,
        amount: 25,
        coin_type: "vicoin",
        new_balance: 975,
        idempotent: true,
      },
      error: null,
    },
  });
  const req = makeRequest({
    recipientId: RECIPIENT_ID,
    amount: 25,
    coinType: "vicoin",
    message: "Congrats",
    idempotencyKey: IDEMPOTENCY_KEY,
  });

  const res = await handleSendCoinGift(req, client, HEADERS);
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.success, true);
  assertEquals(json.gift_id, IDEMPOTENCY_KEY);
  assertEquals(json.idempotent, true);

  const giftCall = rpcCalls.find((c) => c.name === "atomic_send_coin_gift");
  assert(giftCall);
  assertEquals(giftCall.params.p_sender_id, VALID_USER.id);
  assertEquals(giftCall.params.p_recipient_id, RECIPIENT_ID);
  assertEquals(giftCall.params.p_gift_id, IDEMPOTENCY_KEY);

  const idempotencyInsert = inserts.find((i) => i.table === "reward_idempotency");
  assert(idempotencyInsert);
  const row = idempotencyInsert.row as Record<string, unknown>;
  assertEquals(row.scope, "send_coin_gift");
  assertEquals(row.idempotency_key, IDEMPOTENCY_KEY);
});
