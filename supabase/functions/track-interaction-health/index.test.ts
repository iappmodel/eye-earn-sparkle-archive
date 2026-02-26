import { assertEquals } from "jsr:@std/assert";
import { assert } from "jsr:@std/assert";
import type { SupabaseClientLike } from "./index.ts";
import { handleTrackInteractionHealth } from "./index.ts";

const TEST_ORIGIN = "http://localhost:8080";
const HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": TEST_ORIGIN,
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-admin-client",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

const VALID_USER = { id: "user-123", email: "admin@example.com" };

type MockConfig = {
  authUser?: typeof VALID_USER | null;
  authError?: Error | null;
  isAdmin?: boolean;
  isModerator?: boolean;
  statsResult?: unknown;
  statsError?: { message?: string } | null;
  cleanupResult?: unknown;
  cleanupError?: { message?: string } | null;
  adminActionsInsertError?: { message?: string } | null;
  adminActionsHistoryRows?: unknown[];
  adminActionsSelectError?: { message?: string } | null;
  publicProfilesRows?: unknown[];
  publicProfilesSelectError?: { message?: string } | null;
};

function createMockSupabase(config: MockConfig = {}) {
  const rpcCalls: Array<{ name: string; params: Record<string, unknown> }> = [];
  const inserts: Array<{ table: string; rows: unknown[] }> = [];
  const selects: Array<{
    table: string;
    columns: string;
    filters: Array<{ column: string; value: unknown; op?: string }>;
    order?: { column: string; ascending: boolean };
    limit?: number;
  }> = [];
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
      const api = {
        insert: (rows: unknown[]) => {
          inserts.push({ table, rows });
          if (table === "admin_actions" && config.adminActionsInsertError) {
            return Promise.resolve({ data: null, error: config.adminActionsInsertError });
          }
          return Promise.resolve({ data: null, error: null });
        },
        select: (columns: string) => {
          const query = {
            table,
            columns,
            filters: [] as Array<{ column: string; value: unknown; op?: string }>,
            order: undefined as { column: string; ascending: boolean } | undefined,
            limit: undefined as number | undefined,
          };

          const builder = {
            eq: (column: string, value: unknown) => {
              query.filters.push({ column, value });
              return builder;
            },
            gte: (column: string, value: unknown) => {
              query.filters.push({ column, value, op: "gte" });
              return builder;
            },
            lt: (column: string, value: unknown) => {
              query.filters.push({ column, value, op: "lt" });
              return builder;
            },
            gt: (column: string, value: unknown) => {
              query.filters.push({ column, value, op: "gt" });
              return builder;
            },
            filter: (column: string, op: string, value: unknown) => {
              query.filters.push({ column, value, op });
              return builder;
            },
            in: (column: string, value: unknown[]) => {
              query.filters.push({ column, value });
              selects.push(query);
              if (table === "public_profiles" && config.publicProfilesSelectError) {
                return Promise.resolve({ data: null, error: config.publicProfilesSelectError });
              }
              if (table === "public_profiles") {
                return Promise.resolve({ data: config.publicProfilesRows ?? [], error: null });
              }
              return Promise.resolve({ data: [], error: null });
            },
            order: (column: string, options?: { ascending?: boolean }) => {
              query.order = { column, ascending: options?.ascending !== false };
              return builder;
            },
            limit: (limit: number) => {
              query.limit = limit;
              selects.push(query);
              if (table === "admin_actions" && config.adminActionsSelectError) {
                return Promise.resolve({ data: null, error: config.adminActionsSelectError });
              }
              if (table === "admin_actions") {
                const rows = Array.isArray(config.adminActionsHistoryRows) ? config.adminActionsHistoryRows : [];
                return Promise.resolve({ data: rows.slice(0, limit), error: null });
              }
              return Promise.resolve({ data: [], error: null });
            },
          };

          return builder;
        },
      };

      return api;
    },
    rpc: (name: string, params: Record<string, unknown>) => {
      rpcCalls.push({ name, params });

      if (name === "has_role") {
        const role = String(params._role ?? "");
        if (role === "admin") return Promise.resolve({ data: config.isAdmin === true, error: null });
        if (role === "moderator") return Promise.resolve({ data: config.isModerator === true, error: null });
        return Promise.resolve({ data: false, error: null });
      }

      if (name === "get_track_interaction_health_stats") {
        return Promise.resolve({
          data: config.statsResult ?? { success: true, nonce_table: { total_rows: 0 } },
          error: config.statsError ?? null,
        });
      }

      if (name === "cleanup_interaction_event_nonces_global") {
        return Promise.resolve({
          data: config.cleanupResult ?? { success: true, rows_deleted: 12 },
          error: config.cleanupError ?? null,
        });
      }

      return Promise.resolve({ data: null, error: { message: `Unexpected RPC: ${name}` } });
    },
  } as unknown as SupabaseClientLike;

  return { client, rpcCalls, inserts, selects };
}

Deno.test("track-interaction-health: missing Authorization header -> 401", async () => {
  const { client } = createMockSupabase();
  const req = new Request("http://localhost/", {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: TEST_ORIGIN },
    body: JSON.stringify({ retention_days: 14 }),
  });

  const res = await handleTrackInteractionHealth(req, client, HEADERS);
  assertEquals(res.status, 401);
  const json = await res.json();
  assertEquals(json.success, false);
  assertEquals(json.error, "Unauthorized");
});

Deno.test("track-interaction-health: non-admin/moderator -> 403", async () => {
  const { client, rpcCalls } = createMockSupabase({ isAdmin: false, isModerator: false });
  const req = new Request("http://localhost/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: TEST_ORIGIN,
      Authorization: "Bearer fake-token",
    },
    body: JSON.stringify({ retention_days: 14 }),
  });

  const res = await handleTrackInteractionHealth(req, client, HEADERS);
  assertEquals(res.status, 403);
  const json = await res.json();
  assertEquals(json.success, false);
  assert(json.error.includes("admin or moderator"));
  assertEquals(rpcCalls.map((c) => c.name), ["has_role", "has_role"]);
});

Deno.test("track-interaction-health: success returns stats and clamps retention", async () => {
  const stats = {
    success: true,
    retention_days: 365,
    nonce_table: { total_rows: 123, rows_older_than_retention: 4 },
    cooldown_columns: { rows_with_last_share_at: 20 },
  };
  const { client, rpcCalls, selects } = createMockSupabase({
    isAdmin: true,
    statsResult: stats,
    adminActionsHistoryRows: [
      {
        id: "log-1",
        admin_id: "admin-1",
        created_at: "2026-02-24T12:00:00.000Z",
        details: {
          outcome: "success",
          rows_deleted: 5,
          retention_days: 14,
          cleanup_limit: 5000,
          assessment_status: "ok",
          assessment_warning_count: 0,
          cleanup_error: null,
        },
      },
    ],
    publicProfilesRows: [
      {
        user_id: "admin-1",
        display_name: "Ops Lead",
        username: "opslead",
      },
    ],
  });

  const req = new Request("http://localhost/api?retention_days=9999", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: TEST_ORIGIN,
      Authorization: "Bearer fake-token",
    },
    body: JSON.stringify({ retention_days: 2 }),
  });

  const res = await handleTrackInteractionHealth(req, client, HEADERS);
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.success, true);
  assertEquals(json.requested_retention_days, 365);
  assertEquals(json.stats, stats);
  assertEquals(json.assessment.status, "warn");
  assertEquals(json.assessment.warning_count, 1);
  assertEquals(json.assessment.summary.warn_count, 1);
  assertEquals(json.assessment.summary.info_count, 0);
  assertEquals(json.assessment.summary.top_warning_code, "stale_nonce_rows");
  assertEquals(json.assessment.summary.top_warning_severity, "warn");
  assertEquals(json.assessment.warnings[0].code, "stale_nonce_rows");
  assertEquals(json.assessment.warnings[0].severity, "warn");
  assertEquals(json.assessment.warnings[0].metric, "nonce_table.rows_older_than_retention");
  assertEquals(json.assessment.warnings[0].actual, 4);
  assertEquals(json.assessment.warnings[0].threshold, 0);
  assertEquals(Array.isArray(json.cleanup_history), true);
  assertEquals(json.cleanup_history.length, 1);
  assertEquals(json.cleanup_history[0].outcome, "success");
  assertEquals(json.cleanup_history[0].admin_display_name, "Ops Lead");
  assertEquals(json.cleanup_history[0].admin_username, "opslead");
  assertEquals(json.cleanup_history[0].admin_label, "Ops Lead");
  assertEquals(json.cleanup_history_meta.limit, 8);
  assertEquals(json.cleanup_history_meta.returned_count, 1);
  assertEquals(json.cleanup_history_meta.has_more, false);
  assertEquals(json.cleanup_history_meta.has_older, false);
  assertEquals(json.cleanup_history_meta.has_newer, false);
  assertEquals(json.cleanup_history_meta.next_before_created_at, null);
  assertEquals(json.cleanup_history_meta.next_after_created_at, null);
  assertEquals(json.cleanup_history_meta.paging_direction, "latest");
  assertEquals(json.cleanup_history_meta.filters.outcome, "all");
  assertEquals(json.cleanup_history_meta.filters.since_days, null);
  assertEquals(json.cleanup_history_meta.filters.before_created_at, null);
  assertEquals(json.cleanup_history_meta.filters.after_created_at, null);
  assertEquals(json.cleanup_history_meta.error, null);
  assertEquals(json.cleanup_history_meta.profile_error, null);

  const statsCall = rpcCalls.find((c) => c.name === "get_track_interaction_health_stats");
  assert(statsCall);
  assertEquals(statsCall.params.p_retention_days, 365);
  assertEquals(selects.length, 2);
  assertEquals(selects[0].table, "admin_actions");
  assertEquals(selects[0].limit, 9);
  assertEquals(selects[1].table, "public_profiles");
});

Deno.test("track-interaction-health: cleanup action runs cleanup RPC then returns refreshed stats", async () => {
  const stats = {
    success: true,
    retention_days: 14,
    nonce_table: { total_rows: 50, rows_older_than_retention: 0 },
    cooldown_columns: { rows_with_last_share_at: 40 },
  };
  const cleanupResult = { success: true, rows_deleted: 25 };
  const { client, rpcCalls, inserts, selects } = createMockSupabase({
    isAdmin: true,
    statsResult: stats,
    cleanupResult,
    adminActionsHistoryRows: [],
  });

  const req = new Request("http://localhost/api", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: TEST_ORIGIN,
      Authorization: "Bearer fake-token",
    },
    body: JSON.stringify({ action: "cleanup", retention_days: 14, cleanup_limit: 321 }),
  });

  const res = await handleTrackInteractionHealth(req, client, HEADERS);
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.success, true);
  assertEquals(json.action, "cleanup");
  assertEquals(json.cleanup.attempted, true);
  assertEquals(json.cleanup.limit, 321);
  assertEquals(json.cleanup.result, cleanupResult);
  assertEquals(json.audit_log.attempted, true);
  assertEquals(json.audit_log.logged, true);
  assertEquals(Array.isArray(json.cleanup_history), true);
  assertEquals(json.cleanup_history_meta.limit, 8);
  assertEquals(json.cleanup_history_meta.returned_count, 0);
  assertEquals(json.cleanup_history_meta.has_more, false);
  assertEquals(json.cleanup_history_meta.has_older, false);
  assertEquals(json.cleanup_history_meta.has_newer, false);
  assertEquals(json.cleanup_history_meta.next_before_created_at, null);
  assertEquals(json.cleanup_history_meta.next_after_created_at, null);
  assertEquals(json.cleanup_history_meta.paging_direction, "latest");
  assertEquals(json.cleanup_history_meta.filters.outcome, "all");
  assertEquals(json.cleanup_history_meta.filters.since_days, null);
  assertEquals(json.cleanup_history_meta.filters.before_created_at, null);
  assertEquals(json.cleanup_history_meta.filters.after_created_at, null);
  assertEquals(json.cleanup_history_meta.profile_error, null);
  assertEquals(json.stats, stats);
  assertEquals(json.assessment.status, "ok");
  assertEquals(json.assessment.warning_count, 0);
  assertEquals(json.assessment.summary.warn_count, 0);
  assertEquals(json.assessment.summary.info_count, 0);
  assertEquals(json.assessment.summary.top_warning_code, null);
  assertEquals(json.assessment.summary.top_warning_severity, null);

  const cleanupCall = rpcCalls.find((c) => c.name === "cleanup_interaction_event_nonces_global");
  assert(cleanupCall);
  assertEquals(cleanupCall.params.p_limit, 321);
  assert(typeof cleanupCall.params.p_before === "string");

  const statsIndex = rpcCalls.findIndex((c) => c.name === "get_track_interaction_health_stats");
  const cleanupIndex = rpcCalls.findIndex((c) => c.name === "cleanup_interaction_event_nonces_global");
  assert(cleanupIndex >= 0);
  assert(statsIndex >= 0);
  assert(cleanupIndex < statsIndex);
  assertEquals(selects.length, 1);
  assertEquals(selects[0].table, "admin_actions");
  assertEquals(selects[0].limit, 9);

  assertEquals(inserts.length, 1);
  assertEquals(inserts[0].table, "admin_actions");
  const auditRow = inserts[0].rows[0] as Record<string, unknown>;
  assertEquals(auditRow.admin_id, VALID_USER.id);
  assertEquals(auditRow.action_type, "track_interaction_nonce_cleanup");
  assertEquals(auditRow.target_type, "interaction_event_nonces");
  assertEquals(auditRow.target_id, "global");
  const details = auditRow.details as Record<string, unknown>;
  assertEquals(details.outcome, "success");
  assertEquals(details.rows_deleted, 25);
});

Deno.test("track-interaction-health: cleanup RPC failure -> 400", async () => {
  const { client, inserts } = createMockSupabase({
    isAdmin: true,
    cleanupError: { message: "cleanup failed" },
  });

  const req = new Request("http://localhost/api", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: TEST_ORIGIN,
      Authorization: "Bearer fake-token",
    },
    body: JSON.stringify({ run_cleanup: true }),
  });

  const res = await handleTrackInteractionHealth(req, client, HEADERS);
  assertEquals(res.status, 400);
  const json = await res.json();
  assertEquals(json.success, false);
  assertEquals(json.error, "cleanup failed");
  assertEquals(inserts.length, 1);
  const details = (inserts[0].rows[0] as { details: Record<string, unknown> }).details;
  assertEquals(details.outcome, "error");
  assertEquals(details.cleanup_error, "cleanup failed");
});

Deno.test("track-interaction-health: assessment includes legacy cooldown timestamp warnings", async () => {
  const { client } = createMockSupabase({
    isModerator: true,
    statsResult: {
      success: true,
      retention_days: 14,
      nonce_table: { rows_older_than_retention: 0 },
      cooldown_columns: {
        legacy_share_rows_missing_timestamp: 3,
        legacy_view_complete_missing_timestamp: 2,
      },
    },
  });

  const req = new Request("http://localhost/api", {
    method: "GET",
    headers: {
      Origin: TEST_ORIGIN,
      Authorization: "Bearer fake-token",
    },
  });

  const res = await handleTrackInteractionHealth(req, client, HEADERS);
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.assessment.status, "warn");
  assertEquals(json.assessment.warning_count, 2);
  assertEquals(json.assessment.summary.warn_count, 0);
  assertEquals(json.assessment.summary.info_count, 2);
  assertEquals(json.assessment.summary.top_warning_code, "legacy_share_missing_timestamp");
  assertEquals(json.assessment.summary.top_warning_severity, "info");
  assertEquals(
    json.assessment.warnings.map((w: { code: string }) => w.code),
    ["legacy_share_missing_timestamp", "legacy_view_complete_missing_timestamp"]
  );
  assertEquals(
    json.assessment.warnings.map((w: { severity: string }) => w.severity),
    ["info", "info"]
  );
  assertEquals(json.assessment.warnings[0].threshold, 0);
  assertEquals(json.assessment.warnings[0].actual, 3);
  assertEquals(json.assessment.warnings[1].actual, 2);
});

Deno.test("track-interaction-health: cleanup success still returns success if audit log insert fails", async () => {
  const { client } = createMockSupabase({
    isAdmin: true,
    cleanupResult: { success: true, rows_deleted: 1 },
    statsResult: {
      nonce_table: { rows_older_than_retention: 0 },
      cooldown_columns: {},
    },
    adminActionsInsertError: { message: "audit insert failed" },
  });

  const req = new Request("http://localhost/api", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: TEST_ORIGIN,
      Authorization: "Bearer fake-token",
    },
    body: JSON.stringify({ action: "cleanup" }),
  });

  const res = await handleTrackInteractionHealth(req, client, HEADERS);
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.success, true);
  assertEquals(json.audit_log.attempted, true);
  assertEquals(json.audit_log.logged, false);
  assertEquals(json.audit_log.error, "audit insert failed");
});

Deno.test("track-interaction-health: cleanup is audit-logged when stats refresh fails", async () => {
  const { client, inserts } = createMockSupabase({
    isAdmin: true,
    cleanupResult: { success: true, rows_deleted: 9 },
    statsError: { message: "stats rpc failed" },
  });

  const req = new Request("http://localhost/api", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: TEST_ORIGIN,
      Authorization: "Bearer fake-token",
    },
    body: JSON.stringify({ action: "cleanup", retention_days: 14 }),
  });

  const res = await handleTrackInteractionHealth(req, client, HEADERS);
  assertEquals(res.status, 400);
  const json = await res.json();
  assertEquals(json.success, false);
  assertEquals(json.error, "stats rpc failed");
  assertEquals(inserts.length, 1);
  const details = (inserts[0].rows[0] as { details: Record<string, unknown> }).details;
  assertEquals(details.outcome, "error");
  assertEquals(details.rows_deleted, 9);
  assertEquals(details.cleanup_error, "stats_refresh_failed:stats rpc failed");
});

Deno.test("track-interaction-health: cleanup history query failure is non-fatal", async () => {
  const { client } = createMockSupabase({
    isModerator: true,
    statsResult: {
      nonce_table: { rows_older_than_retention: 0 },
      cooldown_columns: {},
    },
    adminActionsSelectError: { message: "history query failed" },
  });

  const req = new Request("http://localhost/api?history_limit=99", {
    method: "GET",
    headers: {
      Origin: TEST_ORIGIN,
      Authorization: "Bearer fake-token",
    },
  });

  const res = await handleTrackInteractionHealth(req, client, HEADERS);
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.success, true);
  assertEquals(Array.isArray(json.cleanup_history), true);
  assertEquals(json.cleanup_history.length, 0);
  assertEquals(json.cleanup_history_meta.limit, 25);
  assertEquals(json.cleanup_history_meta.returned_count, 0);
  assertEquals(json.cleanup_history_meta.has_more, false);
  assertEquals(json.cleanup_history_meta.has_older, false);
  assertEquals(json.cleanup_history_meta.has_newer, false);
  assertEquals(json.cleanup_history_meta.next_before_created_at, null);
  assertEquals(json.cleanup_history_meta.next_after_created_at, null);
  assertEquals(json.cleanup_history_meta.paging_direction, "latest");
  assertEquals(json.cleanup_history_meta.filters.outcome, "all");
  assertEquals(json.cleanup_history_meta.filters.since_days, null);
  assertEquals(json.cleanup_history_meta.filters.before_created_at, null);
  assertEquals(json.cleanup_history_meta.filters.after_created_at, null);
  assertEquals(json.cleanup_history_meta.error, "history query failed");
});

Deno.test("track-interaction-health: cleanup history profile lookup failure is non-fatal and falls back to admin_id", async () => {
  const { client } = createMockSupabase({
    isAdmin: true,
    statsResult: {
      nonce_table: { rows_older_than_retention: 0 },
      cooldown_columns: {},
    },
    adminActionsHistoryRows: [
      {
        id: "log-2",
        admin_id: "admin-xyz",
        created_at: "2026-02-25T10:00:00.000Z",
        details: { outcome: "success", rows_deleted: 7 },
      },
    ],
    publicProfilesSelectError: { message: "profiles lookup failed" },
  });

  const req = new Request("http://localhost/api", {
    method: "GET",
    headers: {
      Origin: TEST_ORIGIN,
      Authorization: "Bearer fake-token",
    },
  });

  const res = await handleTrackInteractionHealth(req, client, HEADERS);
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.success, true);
  assertEquals(json.cleanup_history.length, 1);
  assertEquals(json.cleanup_history[0].admin_label, "admin-xyz");
  assertEquals(json.cleanup_history[0].admin_display_name, null);
  assertEquals(json.cleanup_history[0].admin_username, null);
  assertEquals(json.cleanup_history_meta.profile_error, "profiles lookup failed");
});

Deno.test("track-interaction-health: cleanup history filters are parsed, clamped, and applied to query", async () => {
  const { client, selects } = createMockSupabase({
    isAdmin: true,
    statsResult: {
      nonce_table: { rows_older_than_retention: 0 },
      cooldown_columns: {},
    },
    adminActionsHistoryRows: [
      {
        id: "log-a",
        admin_id: "admin-a",
        created_at: "2026-02-25T10:00:00.000Z",
        details: { outcome: "error", rows_deleted: 0 },
      },
      {
        id: "log-b",
        admin_id: "admin-b",
        created_at: "2026-02-24T09:00:00.000Z",
        details: { outcome: "error", rows_deleted: 2 },
      },
      {
        id: "log-c",
        admin_id: "admin-c",
        created_at: "2026-02-23T08:00:00.000Z",
        details: { outcome: "error", rows_deleted: 3 },
      },
    ],
  });

  const req = new Request(
    "http://localhost/api?history_outcome=error&history_since_days=99999&history_limit=2&history_before_created_at=2026-02-26T00:00:00.000Z",
    {
      method: "GET",
      headers: {
        Origin: TEST_ORIGIN,
        Authorization: "Bearer fake-token",
      },
    }
  );

  const res = await handleTrackInteractionHealth(req, client, HEADERS);
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.success, true);
  assertEquals(json.cleanup_history_meta.limit, 2);
  assertEquals(json.cleanup_history_meta.returned_count, 2);
  assertEquals(json.cleanup_history_meta.has_more, true);
  assertEquals(json.cleanup_history_meta.has_older, true);
  assertEquals(json.cleanup_history_meta.has_newer, true);
  assertEquals(json.cleanup_history_meta.next_before_created_at, "2026-02-24T09:00:00.000Z");
  assertEquals(json.cleanup_history_meta.next_after_created_at, "2026-02-25T10:00:00.000Z");
  assertEquals(json.cleanup_history_meta.paging_direction, "older");
  assertEquals(json.cleanup_history_meta.filters.outcome, "error");
  assertEquals(json.cleanup_history_meta.filters.since_days, 3650);
  assertEquals(json.cleanup_history_meta.filters.before_created_at, "2026-02-26T00:00:00.000Z");
  assertEquals(json.cleanup_history_meta.filters.after_created_at, null);

  const adminActionsSelect = selects.find((s) => s.table === "admin_actions");
  assert(adminActionsSelect);
  assertEquals(adminActionsSelect.limit, 3);

  const outcomeFilter = adminActionsSelect.filters.find(
    (f) => f.column === "details->>outcome" && f.op === "eq"
  );
  assert(outcomeFilter);
  assertEquals(outcomeFilter.value, "error");

  const sinceFilter = adminActionsSelect.filters.find(
    (f) => f.column === "created_at" && f.op === "gte"
  );
  assert(sinceFilter);
  assertEquals(typeof sinceFilter.value, "string");

  const beforeFilter = adminActionsSelect.filters.find(
    (f) => f.column === "created_at" && f.op === "lt"
  );
  assert(beforeFilter);
  assertEquals(beforeFilter.value, "2026-02-26T00:00:00.000Z");
});

Deno.test("track-interaction-health: exact-limit history page does not report has_more without overflow row", async () => {
  const { client } = createMockSupabase({
    isAdmin: true,
    statsResult: {
      nonce_table: { rows_older_than_retention: 0 },
      cooldown_columns: {},
    },
    adminActionsHistoryRows: [
      {
        id: "log-1",
        admin_id: "admin-a",
        created_at: "2026-02-25T10:00:00.000Z",
        details: { outcome: "success", rows_deleted: 1 },
      },
      {
        id: "log-2",
        admin_id: "admin-b",
        created_at: "2026-02-24T10:00:00.000Z",
        details: { outcome: "success", rows_deleted: 2 },
      },
    ],
  });

  const req = new Request("http://localhost/api?history_limit=2", {
    method: "GET",
    headers: {
      Origin: TEST_ORIGIN,
      Authorization: "Bearer fake-token",
    },
  });

  const res = await handleTrackInteractionHealth(req, client, HEADERS);
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.success, true);
  assertEquals(json.cleanup_history.length, 2);
  assertEquals(json.cleanup_history_meta.limit, 2);
  assertEquals(json.cleanup_history_meta.returned_count, 2);
  assertEquals(json.cleanup_history_meta.has_more, false);
  assertEquals(json.cleanup_history_meta.has_older, false);
  assertEquals(json.cleanup_history_meta.has_newer, false);
  assertEquals(json.cleanup_history_meta.next_before_created_at, null);
  assertEquals(json.cleanup_history_meta.next_after_created_at, null);
  assertEquals(json.cleanup_history_meta.paging_direction, "latest");
  assertEquals(json.cleanup_history_meta.filters.after_created_at, null);
});

Deno.test("track-interaction-health: history_after_created_at applies gt filter and returns rows in desc order", async () => {
  const { client, selects } = createMockSupabase({
    isAdmin: true,
    statsResult: {
      nonce_table: { rows_older_than_retention: 0 },
      cooldown_columns: {},
    },
    // Mock returns rows in query order; for after-cursor path the function asks ascending,
    // then reverses rows before returning cleanup_history.
    adminActionsHistoryRows: [
      {
        id: "log-older-newer-page-1",
        admin_id: "admin-a",
        created_at: "2026-02-24T09:00:00.000Z",
        details: { outcome: "success", rows_deleted: 2 },
      },
      {
        id: "log-older-newer-page-2",
        admin_id: "admin-b",
        created_at: "2026-02-25T10:00:00.000Z",
        details: { outcome: "success", rows_deleted: 3 },
      },
      {
        id: "log-older-newer-page-3-overflow",
        admin_id: "admin-c",
        created_at: "2026-02-26T11:00:00.000Z",
        details: { outcome: "success", rows_deleted: 4 },
      },
    ],
  });

  const req = new Request(
    "http://localhost/api?history_limit=2&history_before_created_at=2026-02-26T00:00:00.000Z&history_after_created_at=2026-02-24T08:00:00.000Z",
    {
      method: "GET",
      headers: {
        Origin: TEST_ORIGIN,
        Authorization: "Bearer fake-token",
      },
    }
  );

  const res = await handleTrackInteractionHealth(req, client, HEADERS);
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.success, true);
  assertEquals(json.cleanup_history_meta.filters.before_created_at, null);
  assertEquals(json.cleanup_history_meta.filters.after_created_at, "2026-02-24T08:00:00.000Z");
  assertEquals(json.cleanup_history.length, 2);
  assertEquals(json.cleanup_history_meta.has_more, true);
  assertEquals(json.cleanup_history_meta.has_older, true);
  assertEquals(json.cleanup_history_meta.has_newer, true);
  assertEquals(json.cleanup_history_meta.next_before_created_at, "2026-02-24T09:00:00.000Z");
  assertEquals(json.cleanup_history_meta.next_after_created_at, "2026-02-25T10:00:00.000Z");
  assertEquals(json.cleanup_history_meta.paging_direction, "newer");
  assertEquals(json.cleanup_history[0].id, "log-older-newer-page-2");
  assertEquals(json.cleanup_history[1].id, "log-older-newer-page-1");

  const adminActionsSelect = selects.find((s) => s.table === "admin_actions");
  assert(adminActionsSelect);
  assertEquals(adminActionsSelect.order?.column, "created_at");
  assertEquals(adminActionsSelect.order?.ascending, true);
  const afterFilter = adminActionsSelect.filters.find(
    (f) => f.column === "created_at" && f.op === "gt"
  );
  assert(afterFilter);
  assertEquals(afterFilter.value, "2026-02-24T08:00:00.000Z");
});

Deno.test("track-interaction-health: after-cursor page can have older rows even when has_more is false", async () => {
  const { client } = createMockSupabase({
    isAdmin: true,
    statsResult: {
      nonce_table: { rows_older_than_retention: 0 },
      cooldown_columns: {},
    },
    adminActionsHistoryRows: [
      {
        id: "log-a",
        admin_id: "admin-a",
        created_at: "2026-02-25T10:00:00.000Z",
        details: { outcome: "success", rows_deleted: 1 },
      },
      {
        id: "log-b",
        admin_id: "admin-b",
        created_at: "2026-02-26T10:00:00.000Z",
        details: { outcome: "success", rows_deleted: 2 },
      },
    ],
  });

  const req = new Request(
    "http://localhost/api?history_limit=5&history_after_created_at=2026-02-25T09:00:00.000Z",
    {
      method: "GET",
      headers: {
        Origin: TEST_ORIGIN,
        Authorization: "Bearer fake-token",
      },
    }
  );

  const res = await handleTrackInteractionHealth(req, client, HEADERS);
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.success, true);
  assertEquals(json.cleanup_history_meta.has_more, false);
  assertEquals(json.cleanup_history_meta.has_older, true);
  assertEquals(json.cleanup_history_meta.has_newer, false);
  assertEquals(json.cleanup_history_meta.next_before_created_at, "2026-02-25T10:00:00.000Z");
  assertEquals(json.cleanup_history_meta.next_after_created_at, null);
  assertEquals(json.cleanup_history_meta.paging_direction, "newer");
});
