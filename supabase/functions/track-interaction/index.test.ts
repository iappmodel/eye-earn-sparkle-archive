import { assert } from "jsr:@std/assert";
import { assertEquals } from "jsr:@std/assert";
import type { SupabaseClientLike } from "./index.ts";
import { handleTrackInteraction } from "./index.ts";

const TEST_ORIGIN = "http://localhost:8080";
const HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": TEST_ORIGIN,
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

const VALID_USER = { id: "user-123", email: "test@example.com" };
const VALID_CONTENT_ID = "00000000-0000-4000-8000-000000000111";

type MockConfig = {
  authUser?: typeof VALID_USER | null;
  authError?: Error | null;
  rateLimit?: { allowed: boolean; retry_after_seconds?: number };
  userContentRow?: { id: string; user_id: string; status: string } | null;
  existingInteractionRow?: Record<string, unknown> | null;
  existingEventNonce?: boolean;
  duplicateEventNonce?: boolean;
  cachedIdempotency?: {
    response_body: unknown;
    response_status: number;
    created_at: string;
  } | null;
};

function createMockSupabase(config: MockConfig = {}) {
  const rpcCalls: string[] = [];
  const fromCalls: string[] = [];
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
    from: (table: string) => {
      fromCalls.push(table);

      if (table === "user_content") {
        const chain: any = {
          select: (_cols?: string) => chain,
          eq: (_col: string, _val: unknown) => chain,
          limit: (_n: number) => chain,
          maybeSingle: () => Promise.resolve({ data: config.userContentRow ?? null, error: null }),
          single: () => Promise.resolve({ data: config.userContentRow ?? null, error: null }),
        };
        return chain;
      }

      if (table === "content_interactions") {
        const state = {
          row: config.existingInteractionRow ?? null,
          filters: {} as Record<string, unknown>,
        };
        const chain: any = {
          select: (_cols?: string) => chain,
          eq: (col: string, val: unknown) => {
            state.filters[col] = val;
            return chain;
          },
          limit: (_n: number) => chain,
          maybeSingle: () => Promise.resolve({ data: state.row, error: null }),
          single: () => Promise.resolve({ data: state.row, error: null }),
          upsert: (_row: unknown) => ({
            select: () => ({
              single: () => Promise.resolve({ data: null, error: new Error(`Unexpected upsert on ${table}`) }),
            }),
          }),
        };
        return chain;
      }

      if (table === "reward_idempotency") {
        const chain: any = {
          select: (_cols?: string) => chain,
          eq: (_col: string, _val: unknown) => chain,
          maybeSingle: () => Promise.resolve({ data: config.cachedIdempotency ?? null, error: null }),
          insert: (_row: unknown) => Promise.resolve({ data: null, error: null }),
        };
        return chain;
      }

      if (table === "interaction_event_nonces") {
        const chain: any = {
          select: (_cols?: string) => chain,
          eq: (_col: string, _val: unknown) => chain,
          limit: (_n: number) => chain,
          maybeSingle: () => Promise.resolve({
            data: config.existingEventNonce ? { id: "nonce-row-1" } : null,
            error: null,
          }),
          delete: () => ({
            eq: (_col: string, _val: unknown) => ({
              lt: (_ltCol: string, _ltVal: unknown) => Promise.resolve({ data: null, error: null }),
            }),
          }),
          insert: (_row: unknown) => Promise.resolve(
            config.duplicateEventNonce
              ? { data: null, error: { code: "23505", message: "duplicate key value violates unique constraint" } }
              : { data: null, error: null }
          ),
        };
        return chain;
      }

      // These tests target fail-closed paths and should not reach write/prefs tables.
      const unexpectedChain: any = {
        select: () => unexpectedChain,
        eq: () => unexpectedChain,
        limit: () => unexpectedChain,
        maybeSingle: () => Promise.resolve({ data: null, error: new Error(`Unexpected table access: ${table}`) }),
        single: () => Promise.resolve({ data: null, error: new Error(`Unexpected table access: ${table}`) }),
        upsert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: null, error: new Error(`Unexpected upsert on ${table}`) }),
          }),
        }),
        insert: () => Promise.resolve({ data: null, error: new Error(`Unexpected insert on ${table}`) }),
        update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
      };
      return unexpectedChain;
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
      if (name === "cleanup_interaction_event_nonces") {
        return Promise.resolve({ data: { success: true, rows_deleted: 0 }, error: null });
      }
      return Promise.resolve({ data: null, error: new Error(`Unexpected RPC: ${name}`) });
    },
  } as unknown as SupabaseClientLike;

  return { client, rpcCalls, fromCalls };
}

function createRecordingTrackSupabase() {
  const rpcCalls: string[] = [];
  const recordedUpserts: Array<Record<string, unknown>> = [];
  const recordedIdempotencyInserts: Array<Record<string, unknown>> = [];
  let interactionRow: Record<string, unknown> | null = null;

  const prefsRow = {
    user_id: VALID_USER.id,
    total_content_views: 0,
    avg_watch_time: 0,
    focus_score: 0,
    engagement_score: 50,
    liked_tags: [],
    disliked_tags: [],
    preferred_categories: [],
    last_seen_content: [],
  };

  const client = {
    auth: {
      getUser: (_token: string) => Promise.resolve({ data: { user: VALID_USER }, error: null }),
    },
    from: (table: string) => {
      if (table === "content_interactions") {
        const state = { filters: {} as Record<string, unknown> };
        const chain: any = {
          select: (_cols?: string) => chain,
          eq: (col: string, val: unknown) => {
            state.filters[col] = val;
            return chain;
          },
          limit: (_n: number) => chain,
          maybeSingle: () => Promise.resolve({ data: interactionRow, error: null }),
          single: () => Promise.resolve({ data: interactionRow, error: null }),
          upsert: (row: Record<string, unknown>) => {
            recordedUpserts.push({ ...row });
            interactionRow = {
              ...(interactionRow ?? {}),
              ...row,
              updated_at: new Date().toISOString(),
            };
            return {
              select: () => ({
                single: () => Promise.resolve({ data: interactionRow, error: null }),
              }),
            };
          },
        };
        return chain;
      }

      if (table === "user_preferences") {
        const chain: any = {
          select: (_cols?: string) => chain,
          eq: (_col: string, _val: unknown) => chain,
          maybeSingle: () => Promise.resolve({ data: prefsRow, error: null }),
          insert: (_row: unknown) => ({
            select: () => ({
              single: () => Promise.resolve({ data: prefsRow, error: null }),
            }),
          }),
          update: (_updates: unknown) => ({
            eq: (_col: string, _val: unknown) => Promise.resolve({ data: null, error: null }),
          }),
        };
        return chain;
      }

      if (table === "reward_idempotency") {
        const chain: any = {
          select: (_cols?: string) => chain,
          eq: (_col: string, _val: unknown) => chain,
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
          insert: (row: Record<string, unknown>) => {
            recordedIdempotencyInserts.push({ ...row });
            return Promise.resolve({ data: null, error: null });
          },
        };
        return chain;
      }

      if (table === "interaction_event_nonces") {
        const chain: any = {
          select: (_cols?: string) => chain,
          eq: (_col: string, _val: unknown) => chain,
          limit: (_n: number) => chain,
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
          delete: () => ({
            eq: (_col: string, _val: unknown) => ({
              lt: (_ltCol: string, _ltVal: unknown) => Promise.resolve({ data: null, error: null }),
            }),
          }),
          insert: (_row: unknown) => Promise.resolve({ data: null, error: null }),
        };
        return chain;
      }

      if (table === "user_content") {
        const chain: any = {
          select: (_cols?: string) => chain,
          eq: (_col: string, _val: unknown) => chain,
          limit: (_n: number) => chain,
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
          single: () => Promise.resolve({ data: null, error: null }),
        };
        return chain;
      }

      const fallback: any = {
        select: () => fallback,
        eq: () => fallback,
        limit: () => fallback,
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        single: () => Promise.resolve({ data: null, error: null }),
        insert: () => Promise.resolve({ data: null, error: null }),
        update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
      };
      return fallback;
    },
    rpc: (name: string, _params: Record<string, unknown>) => {
      rpcCalls.push(name);
      if (name === "check_reward_rate_limit") {
        return Promise.resolve({ data: [{ allowed: true }], error: null });
      }
      if (name === "cleanup_interaction_event_nonces") {
        return Promise.resolve({ data: { success: true, rows_deleted: 0 }, error: null });
      }
      return Promise.resolve({ data: null, error: new Error(`Unexpected RPC: ${name}`) });
    },
  } as unknown as SupabaseClientLike;

  return {
    client,
    rpcCalls,
    recordedUpserts,
    recordedIdempotencyInserts,
    getInteractionRow: () => interactionRow,
  };
}

Deno.test("track-interaction: missing Authorization header -> 401", async () => {
  const { client } = createMockSupabase();
  const req = new Request("http://localhost/", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: TEST_ORIGIN },
    body: JSON.stringify({ contentId: VALID_CONTENT_ID, action: "like" }),
  });

  const res = await handleTrackInteraction(req, client, HEADERS);
  assertEquals(res.status, 401);
  assertEquals((await res.json()).error, "Unauthorized");
});

Deno.test("track-interaction: feedback action requires feedback value -> 400", async () => {
  const { client, rpcCalls, fromCalls } = createMockSupabase();
  const req = new Request("http://localhost/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: TEST_ORIGIN,
      Authorization: "Bearer fake-token",
    },
    body: JSON.stringify({
      contentId: "non-uuid-content",
      action: "feedback",
      tags: [],
      category: "food",
    }),
  });

  const res = await handleTrackInteraction(req, client, HEADERS);
  assertEquals(res.status, 400);
  const json = await res.json();
  assertEquals(json.code, "invalid_feedback");
  assertEquals(rpcCalls, ["check_reward_rate_limit"]);
  assertEquals(fromCalls.includes("content_interactions"), false);
});

Deno.test("track-interaction: view_complete without positive durations -> 400", async () => {
  const { client, rpcCalls } = createMockSupabase();
  const req = new Request("http://localhost/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: TEST_ORIGIN,
      Authorization: "Bearer fake-token",
    },
    body: JSON.stringify({
      contentId: "non-uuid-content",
      action: "view_complete",
      watchDuration: 0,
      totalDuration: 0,
    }),
  });

  const res = await handleTrackInteraction(req, client, HEADERS);
  assertEquals(res.status, 400);
  const json = await res.json();
  assertEquals(json.code, "invalid_view_metrics");
  assertEquals(rpcCalls, ["check_reward_rate_limit"]);
});

Deno.test("track-interaction: share with watch metrics is rejected -> 400", async () => {
  const { client } = createMockSupabase();
  const req = new Request("http://localhost/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: TEST_ORIGIN,
      Authorization: "Bearer fake-token",
    },
    body: JSON.stringify({
      contentId: "non-uuid-content",
      action: "share",
      watchDuration: 15,
      totalDuration: 30,
    }),
  });

  const res = await handleTrackInteraction(req, client, HEADERS);
  assertEquals(res.status, 400);
  const json = await res.json();
  assertEquals(json.code, "invalid_view_metrics");
});

Deno.test("track-interaction: UUID content on strict event must exist and be active -> 400", async () => {
  const { client, fromCalls } = createMockSupabase({
    userContentRow: null,
  });
  const req = new Request("http://localhost/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: TEST_ORIGIN,
      Authorization: "Bearer fake-token",
    },
    body: JSON.stringify({
      contentId: VALID_CONTENT_ID,
      action: "view_progress",
      watchDuration: 5,
      totalDuration: 20,
    }),
  });

  const res = await handleTrackInteraction(req, client, HEADERS);
  assertEquals(res.status, 400);
  const json = await res.json();
  assertEquals(json.code, "invalid_content");
  assert(fromCalls.includes("user_content"));
});

Deno.test("track-interaction: rate limited reward-relevant action -> 429", async () => {
  const { client, rpcCalls, fromCalls } = createMockSupabase({
    rateLimit: { allowed: false, retry_after_seconds: 11 },
  });
  const req = new Request("http://localhost/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: TEST_ORIGIN,
      Authorization: "Bearer fake-token",
    },
    body: JSON.stringify({
      contentId: "non-uuid-content",
      action: "share",
    }),
  });

  const res = await handleTrackInteraction(req, client, HEADERS);
  assertEquals(res.status, 429);
  assertEquals(res.headers.get("Retry-After"), "11");
  const json = await res.json();
  assertEquals(json.code, "rate_limit_exceeded");
  assertEquals(json.retryAfterSeconds, 11);
  assertEquals(rpcCalls, ["check_reward_rate_limit"]);
  assertEquals(fromCalls.length, 0);
});

Deno.test("track-interaction: idempotency cache hit returns cached response and skips processing", async () => {
  const cachedBody = {
    success: true,
    count: 1,
    interactions: [{ contentId: "cached-content", deduped: true }],
  };
  const { client, rpcCalls, fromCalls } = createMockSupabase({
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
      "idempotency-key": "22222222-2222-4222-8222-222222222222",
    },
    body: JSON.stringify({
      contentId: "non-uuid-content",
      action: "share",
      eventNonce: "33333333-3333-4333-8333-333333333333",
    }),
  });

  const res = await handleTrackInteraction(req, client, HEADERS);
  assertEquals(res.status, 200);
  assertEquals(await res.json(), cachedBody);
  assertEquals(rpcCalls.length, 0);
  assert(fromCalls.includes("reward_idempotency"));
  assertEquals(fromCalls.includes("content_interactions"), false);
  assertEquals(fromCalls.includes("interaction_event_nonces"), false);
});

Deno.test("track-interaction: batch idempotency cache hit returns cached response and skips processing", async () => {
  const cachedBody = {
    success: true,
    count: 2,
    interactions: [
      { contentId: "a", deduped: true },
      { contentId: "b", watchCompletionRate: 50 },
    ],
  };
  const { client, rpcCalls, fromCalls } = createMockSupabase({
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
      "idempotency-key": "44444444-4444-4444-8444-444444444444",
    },
    body: JSON.stringify({
      batch: [
        { contentId: "non-uuid-a", action: "share", eventNonce: "55555555-5555-4555-8555-555555555555" },
        { contentId: "non-uuid-b", action: "view_complete", eventNonce: "66666666-6666-4666-8666-666666666666", watchDuration: 3, totalDuration: 6 },
      ],
    }),
  });

  const res = await handleTrackInteraction(req, client, HEADERS);
  assertEquals(res.status, 200);
  assertEquals(await res.json(), cachedBody);
  assertEquals(rpcCalls.length, 0);
  assert(fromCalls.includes("reward_idempotency"));
  assertEquals(fromCalls.includes("content_interactions"), false);
  assertEquals(fromCalls.includes("interaction_event_nonces"), false);
});

Deno.test("track-interaction: duplicate eventNonce replay is deduped and skips writes", async () => {
  const nonce = "11111111-1111-4111-8111-111111111111";
  const { client, rpcCalls, fromCalls } = createMockSupabase({
    existingEventNonce: true,
  });
  const req = new Request("http://localhost/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: TEST_ORIGIN,
      Authorization: "Bearer fake-token",
    },
    body: JSON.stringify({
      contentId: "non-uuid-content",
      eventNonce: nonce,
      action: "share",
    }),
  });

  const res = await handleTrackInteraction(req, client, HEADERS);
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.success, true);
  assertEquals(json.count, 1);
  assertEquals(json.interactions?.[0]?.contentId, "non-uuid-content");
  assertEquals(json.interactions?.[0]?.deduped, true);
  assertEquals(json.interactions?.[0]?.eventNonce, nonce);
  assertEquals(rpcCalls, ["check_reward_rate_limit", "cleanup_interaction_event_nonces"]);
  assert(fromCalls.includes("interaction_event_nonces"));
  assertEquals(fromCalls.includes("content_interactions"), false);
  assertEquals(fromCalls.includes("user_preferences"), false);
});

Deno.test("track-interaction: duplicate share within cooldown -> 429 action_cooldown", async () => {
  const now = new Date().toISOString();
  const { client, rpcCalls, fromCalls } = createMockSupabase({
    existingInteractionRow: {
      id: "row-1",
      updated_at: now,
      last_event_type: "share",
      shared: true,
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
      contentId: "non-uuid-content",
      action: "share",
    }),
  });

  const res = await handleTrackInteraction(req, client, HEADERS);
  assertEquals(res.status, 429);
  assert(res.headers.get("Retry-After") !== null);
  const json = await res.json();
  assertEquals(json.code, "action_cooldown");
  assertEquals(json.action, "share");
  assert(typeof json.retryAfterSeconds === "number" && json.retryAfterSeconds >= 1);
  assertEquals(rpcCalls, ["check_reward_rate_limit"]);
  assert(fromCalls.includes("content_interactions"));
});

Deno.test("track-interaction: share cooldown survives alternating events via last_share_at -> 429", async () => {
  const now = new Date().toISOString();
  const { client } = createMockSupabase({
    existingInteractionRow: {
      id: "row-2",
      updated_at: now,
      last_event_type: "view_progress",
      last_share_at: now,
      shared: true,
      watch_completion_rate: 70,
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
      contentId: "non-uuid-content",
      action: "share",
    }),
  });

  const res = await handleTrackInteraction(req, client, HEADERS);
  assertEquals(res.status, 429);
  const json = await res.json();
  assertEquals(json.code, "action_cooldown");
  assertEquals(json.action, "share");
});

Deno.test("track-interaction: view_complete cooldown survives alternating events via last_view_complete_at -> 429", async () => {
  const now = new Date().toISOString();
  const { client } = createMockSupabase({
    existingInteractionRow: {
      id: "row-3",
      updated_at: now,
      last_event_type: "share",
      last_view_complete_at: now,
      shared: true,
      watch_completion_rate: 92,
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
      contentId: "non-uuid-content",
      action: "view_complete",
      watchDuration: 24,
      totalDuration: 30,
      attentionScore: 80,
    }),
  });

  const res = await handleTrackInteraction(req, client, HEADERS);
  assertEquals(res.status, 429);
  const json = await res.json();
  assertEquals(json.code, "action_cooldown");
  assertEquals(json.action, "view_complete");
});

Deno.test("track-interaction: share upsert payload preserves watch metrics by omission", async () => {
  const { client, recordedUpserts } = createRecordingTrackSupabase();

  const req = new Request("http://localhost/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: TEST_ORIGIN,
      Authorization: "Bearer fake-token",
    },
    body: JSON.stringify({
      contentId: "non-uuid-content",
      action: "share",
      contentType: "video",
      tags: ["promo"],
      category: "test",
    }),
  });

  const res = await handleTrackInteraction(req, client, HEADERS);
  assertEquals(res.status, 200);
  assertEquals(recordedUpserts.length, 1);
  const row = recordedUpserts[0];
  assertEquals("watch_duration" in row, false);
  assertEquals("total_duration" in row, false);
  assertEquals("watch_completion_rate" in row, false);
  assertEquals(row.shared, true);
  assert(typeof row.last_share_at === "string");
});

Deno.test("track-interaction: view_progress upsert payload preserves shared flag by omission", async () => {
  const { client, recordedUpserts } = createRecordingTrackSupabase();

  const req = new Request("http://localhost/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: TEST_ORIGIN,
      Authorization: "Bearer fake-token",
    },
    body: JSON.stringify({
      contentId: "non-uuid-content",
      action: "view_progress",
      watchDuration: 12,
      totalDuration: 60,
      attentionScore: 75,
    }),
  });

  const res = await handleTrackInteraction(req, client, HEADERS);
  assertEquals(res.status, 200);
  assertEquals(recordedUpserts.length, 1);
  const row = recordedUpserts[0];
  assertEquals("shared" in row, false);
  assertEquals(row.watch_duration, 12);
  assertEquals(row.total_duration, 60);
  assertEquals(row.attention_score, 75);
  assertEquals("last_view_complete_at" in row, false);
});

Deno.test("track-interaction: view_complete upsert payload stamps last_view_complete_at", async () => {
  const { client, recordedUpserts } = createRecordingTrackSupabase();

  const req = new Request("http://localhost/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: TEST_ORIGIN,
      Authorization: "Bearer fake-token",
    },
    body: JSON.stringify({
      contentId: "non-uuid-content",
      action: "view_complete",
      watchDuration: 30,
      totalDuration: 60,
      attentionScore: 88,
    }),
  });

  const res = await handleTrackInteraction(req, client, HEADERS);
  assertEquals(res.status, 200);
  assertEquals(recordedUpserts.length, 1);
  const row = recordedUpserts[0];
  assertEquals(row.watch_duration, 30);
  assertEquals(row.total_duration, 60);
  assertEquals(row.watch_completion_rate, 50);
  assert(typeof row.last_view_complete_at === "string");
});

Deno.test("track-interaction: success with Idempotency-Key caches response body", async () => {
  const { client, rpcCalls, recordedIdempotencyInserts } = createRecordingTrackSupabase();
  const eventNonce = "77777777-7777-4777-8777-777777777777";
  const req = new Request("http://localhost/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: TEST_ORIGIN,
      Authorization: "Bearer fake-token",
      "idempotency-key": "88888888-8888-4888-8888-888888888888",
    },
    body: JSON.stringify({
      contentId: "non-uuid-content",
      action: "share",
      eventNonce,
      contentType: "video",
    }),
  });

  const res = await handleTrackInteraction(req, client, HEADERS);
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.success, true);
  assertEquals(json.count, 1);

  assertEquals(rpcCalls, ["check_reward_rate_limit", "cleanup_interaction_event_nonces"]);
  assertEquals(recordedIdempotencyInserts.length, 1);
  const cached = recordedIdempotencyInserts[0];
  assertEquals(cached.scope, "track_interaction");
  assertEquals(cached.idempotency_key, "88888888-8888-4888-8888-888888888888");
  assertEquals(cached.user_id, VALID_USER.id);
  assertEquals(cached.response_status, 200);
  const body = cached.response_body as Record<string, unknown>;
  assertEquals(body.success, true);
  assertEquals(body.count, 1);
});

Deno.test("track-interaction: batch success with Idempotency-Key caches response body", async () => {
  const { client, rpcCalls, recordedIdempotencyInserts, recordedUpserts } = createRecordingTrackSupabase();
  const req = new Request("http://localhost/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: TEST_ORIGIN,
      Authorization: "Bearer fake-token",
      "idempotency-key": "99999999-9999-4999-8999-999999999999",
    },
    body: JSON.stringify({
      batch: [
        {
          contentId: "non-uuid-content-a",
          action: "share",
          eventNonce: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          contentType: "video",
        },
        {
          contentId: "non-uuid-content-b",
          action: "view_complete",
          eventNonce: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          contentType: "video",
          watchDuration: 6,
          totalDuration: 12,
          attentionScore: 80,
        },
      ],
    }),
  });

  const res = await handleTrackInteraction(req, client, HEADERS);
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.success, true);
  assertEquals(json.count, 2);

  assertEquals(rpcCalls, ["check_reward_rate_limit", "cleanup_interaction_event_nonces"]);
  assertEquals(recordedUpserts.length, 2);
  assertEquals(recordedIdempotencyInserts.length, 1);
  const cached = recordedIdempotencyInserts[0];
  assertEquals(cached.scope, "track_interaction");
  assertEquals(cached.idempotency_key, "99999999-9999-4999-8999-999999999999");
  assertEquals(cached.user_id, VALID_USER.id);
  assertEquals(cached.response_status, 200);
  const body = cached.response_body as Record<string, unknown>;
  assertEquals(body.success, true);
  assertEquals(body.count, 2);
});
