import { assertEquals } from "jsr:@std/assert";
import { assert } from "jsr:@std/assert";
import type { SupabaseClientLike } from "./index.ts";
import { handleRequestPayout } from "./index.ts";

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
};

function makeEqChain(config: MockConfig) {
  return {
    eq: (_col: string, _val: unknown) => makeEqChain(config),
    maybeSingle: () => Promise.resolve({
      data: config.cachedIdempotency ?? null,
      error: null,
    }),
    single: () => Promise.resolve({ data: null, error: null }),
  };
}

function createMockSupabase(config: MockConfig = {}) {
  const rpcCalls: string[] = [];
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
    from: (_table: string) => ({
      select: (_cols: string) => makeEqChain(config),
      insert: (_row: unknown) => Promise.resolve({ data: null, error: null }),
    }),
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

  return { client, rpcCalls };
}

Deno.test("request-payout: missing Authorization header → 401", async () => {
  const { client } = createMockSupabase();
  const req = new Request("http://localhost/", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: TEST_ORIGIN },
    body: JSON.stringify({ amount: 1000, coinType: "icoin", method: "paypal" }),
  });

  const res = await handleRequestPayout(req, client, HEADERS);
  assertEquals(res.status, 401);
  const json = await res.json();
  assertEquals(json.error, "Unauthorized");
});

Deno.test("request-payout: invalid auth token → 401", async () => {
  const { client } = createMockSupabase({
    authUser: null,
    authError: new Error("Invalid token"),
  });
  const req = new Request("http://localhost/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: TEST_ORIGIN,
      Authorization: "Bearer bad-token",
    },
    body: JSON.stringify({ amount: 1000, coinType: "icoin", method: "paypal" }),
  });

  const res = await handleRequestPayout(req, client, HEADERS);
  assertEquals(res.status, 401);
  const json = await res.json();
  assertEquals(json.error, "Unauthorized");
});

Deno.test("request-payout: idempotency hit returns cached response and skips rate-limit/RPC", async () => {
  const cachedBody = {
    success: true,
    payout_request_id: "payout-1",
    transaction_id: "txn-1",
    status: "processing",
  };
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
    body: JSON.stringify({ amount: 1000, coinType: "icoin", method: "paypal" }),
  });

  const res = await handleRequestPayout(req, client, HEADERS);
  assertEquals(res.status, 200);
  assertEquals(await res.json(), cachedBody);
  assertEquals(rpcCalls.length, 0);
});

Deno.test("request-payout: rate limited → 429 with retry header", async () => {
  const { client, rpcCalls } = createMockSupabase({
    rateLimit: { allowed: false, retry_after_seconds: 17 },
  });

  const req = new Request("http://localhost/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: TEST_ORIGIN,
      Authorization: "Bearer fake-token",
    },
    body: JSON.stringify({ amount: 1000, coinType: "icoin", method: "paypal" }),
  });

  const res = await handleRequestPayout(req, client, HEADERS);
  assertEquals(res.status, 429);
  assertEquals(res.headers.get("Retry-After"), "17");
  const json = await res.json();
  assertEquals(json.code, "rate_limit_exceeded");
  assert(json.retryAfterSeconds === 17);
  assertEquals(rpcCalls, ["check_reward_rate_limit"]);
});
