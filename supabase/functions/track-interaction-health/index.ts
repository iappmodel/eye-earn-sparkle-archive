import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeadersAdmin } from "../_shared/cors.ts";

function jsonResponse(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status: number, headers: Record<string, string>) {
  return jsonResponse({ error: message, success: false }, status, headers);
}

// deno-lint-ignore no-explicit-any
export type SupabaseClientLike = any;

type HealthWarning = {
  code: string;
  severity: "info" | "warn";
  metric: string;
  count: number;
  actual: number;
  threshold: number;
  message: string;
};

type HealthAssessment = {
  status: "ok" | "warn";
  warning_count: number;
  summary: {
    warn_count: number;
    info_count: number;
    top_warning_code: string | null;
    top_warning_severity: "warn" | "info" | null;
  };
  warnings: HealthWarning[];
};

type AuditLogStatus = {
  attempted: boolean;
  logged: boolean;
  error?: string;
};

type CleanupHistoryEntry = {
  id: string;
  admin_id: string;
  admin_display_name: string | null;
  admin_username: string | null;
  admin_label: string | null;
  created_at: string;
  outcome: "success" | "error" | "unknown";
  rows_deleted: number;
  retention_days: number | null;
  cleanup_limit: number | null;
  assessment_status: string | null;
  assessment_warning_count: number | null;
  cleanup_error: string | null;
};

type CleanupHistoryOutcomeFilter = "all" | "success" | "error" | "unknown";

async function checkAdminOrModerator(supabase: SupabaseClientLike, userId: string): Promise<boolean> {
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (isAdmin) return true;
  const { data: isMod } = await supabase.rpc("has_role", { _user_id: userId, _role: "moderator" });
  return !!isMod;
}

function parseRetentionDays(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 14;
  return Math.min(365, Math.max(1, Math.floor(n)));
}

function parseCleanupLimit(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 5000;
  return Math.min(50000, Math.max(1, Math.floor(n)));
}

function parseHistoryLimit(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 8;
  return Math.min(25, Math.max(1, Math.floor(n)));
}

function parseHistorySinceDays(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.min(3650, Math.max(1, Math.floor(n)));
}

function parseHistoryBeforeCreatedAt(raw: unknown): string | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const value = String(raw).trim();
  if (!value) return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

function parseHistoryOutcome(raw: unknown): CleanupHistoryOutcomeFilter {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "success" || value === "error" || value === "unknown") return value;
  return "all";
}

function getRetentionDaysFromRequest(req: Request, body: Record<string, unknown>): number {
  try {
    const url = new URL(req.url);
    const queryValue = url.searchParams.get("retention_days");
    if (queryValue) return parseRetentionDays(queryValue);
  } catch {
    // ignore malformed test URLs
  }
  return parseRetentionDays(body.retention_days);
}

function getCleanupLimitFromRequest(req: Request, body: Record<string, unknown>): number {
  try {
    const url = new URL(req.url);
    const queryValue = url.searchParams.get("cleanup_limit");
    if (queryValue) return parseCleanupLimit(queryValue);
  } catch {
    // ignore malformed test URLs
  }
  return parseCleanupLimit(body.cleanup_limit);
}

function getHistoryLimitFromRequest(req: Request, body: Record<string, unknown>): number {
  try {
    const url = new URL(req.url);
    const queryValue = url.searchParams.get("history_limit");
    if (queryValue) return parseHistoryLimit(queryValue);
  } catch {
    // ignore malformed test URLs
  }
  return parseHistoryLimit(body.history_limit);
}

function getHistorySinceDaysFromRequest(req: Request, body: Record<string, unknown>): number | null {
  try {
    const url = new URL(req.url);
    if (url.searchParams.has("history_since_days")) {
      return parseHistorySinceDays(url.searchParams.get("history_since_days"));
    }
  } catch {
    // ignore malformed test URLs
  }
  return parseHistorySinceDays(body.history_since_days);
}

function getHistoryOutcomeFromRequest(req: Request, body: Record<string, unknown>): CleanupHistoryOutcomeFilter {
  try {
    const url = new URL(req.url);
    if (url.searchParams.has("history_outcome")) {
      return parseHistoryOutcome(url.searchParams.get("history_outcome"));
    }
  } catch {
    // ignore malformed test URLs
  }
  return parseHistoryOutcome(body.history_outcome);
}

function getHistoryBeforeCreatedAtFromRequest(req: Request, body: Record<string, unknown>): string | null {
  try {
    const url = new URL(req.url);
    if (url.searchParams.has("history_before_created_at")) {
      return parseHistoryBeforeCreatedAt(url.searchParams.get("history_before_created_at"));
    }
  } catch {
    // ignore malformed test URLs
  }
  return parseHistoryBeforeCreatedAt(body.history_before_created_at);
}

function getHistoryAfterCreatedAtFromRequest(req: Request, body: Record<string, unknown>): string | null {
  try {
    const url = new URL(req.url);
    if (url.searchParams.has("history_after_created_at")) {
      return parseHistoryBeforeCreatedAt(url.searchParams.get("history_after_created_at"));
    }
  } catch {
    // ignore malformed test URLs
  }
  return parseHistoryBeforeCreatedAt(body.history_after_created_at);
}

function getRequestedAction(req: Request, body: Record<string, unknown>): "stats" | "cleanup" {
  try {
    const url = new URL(req.url);
    const queryValue = url.searchParams.get("action");
    if (queryValue === "cleanup") return "cleanup";
  } catch {
    // ignore malformed test URLs
  }
  if (body.action === "cleanup" || body.run_cleanup === true) return "cleanup";
  return "stats";
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function getNestedNumber(source: unknown, path: string[]): number {
  let current: unknown = source;
  for (const key of path) {
    if (!isObject(current)) return 0;
    current = current[key];
  }
  const n = Number(current);
  return Number.isFinite(n) ? n : 0;
}

function buildHealthAssessment(stats: unknown, retentionDays: number): HealthAssessment {
  const staleNonceRows = getNestedNumber(stats, ["nonce_table", "rows_older_than_retention"]);
  const legacyShareMissingTs = getNestedNumber(stats, ["cooldown_columns", "legacy_share_rows_missing_timestamp"]);
  const legacyViewCompleteMissingTs = getNestedNumber(stats, ["cooldown_columns", "legacy_view_complete_missing_timestamp"]);

  const warnings: HealthWarning[] = [];

  if (staleNonceRows > 0) {
    warnings.push({
      code: "stale_nonce_rows",
      severity: "warn",
      metric: "nonce_table.rows_older_than_retention",
      count: staleNonceRows,
      actual: staleNonceRows,
      threshold: 0,
      message: `${staleNonceRows} nonce rows are older than the ${retentionDays}-day retention window.`,
    });
  }

  if (legacyShareMissingTs > 0) {
    warnings.push({
      code: "legacy_share_missing_timestamp",
      severity: "info",
      metric: "cooldown_columns.legacy_share_rows_missing_timestamp",
      count: legacyShareMissingTs,
      actual: legacyShareMissingTs,
      threshold: 0,
      message: `${legacyShareMissingTs} share interaction rows are missing last_share_at.`,
    });
  }

  if (legacyViewCompleteMissingTs > 0) {
    warnings.push({
      code: "legacy_view_complete_missing_timestamp",
      severity: "info",
      metric: "cooldown_columns.legacy_view_complete_missing_timestamp",
      count: legacyViewCompleteMissingTs,
      actual: legacyViewCompleteMissingTs,
      threshold: 0,
      message: `${legacyViewCompleteMissingTs} view_complete interaction rows are missing last_view_complete_at.`,
    });
  }

  const warnWarnings = warnings.filter((w) => w.severity === "warn");
  const infoWarnings = warnings.filter((w) => w.severity === "info");
  const topWarning = warnings[0] ?? null;

  return {
    status: warnings.length > 0 ? "warn" : "ok",
    warning_count: warnings.length,
    summary: {
      warn_count: warnWarnings.length,
      info_count: infoWarnings.length,
      top_warning_code: topWarning?.code ?? null,
      top_warning_severity: topWarning?.severity ?? null,
    },
    warnings,
  };
}

function getNestedString(source: unknown, path: string[]): string | null {
  let current: unknown = source;
  for (const key of path) {
    if (!isObject(current)) return null;
    current = current[key];
  }
  return typeof current === "string" ? current : null;
}

async function fetchPublicProfileLabels(
  supabase: SupabaseClientLike,
  userIds: string[]
): Promise<{ byUserId: Record<string, { display_name: string | null; username: string | null }>; error?: string }> {
  const uniqueIds = [...new Set(userIds.filter((id) => typeof id === "string" && id.trim().length > 0))];
  if (uniqueIds.length === 0) return { byUserId: {} };

  try {
    const { data, error } = await supabase
      .from("public_profiles")
      .select("user_id,display_name,username")
      .in("user_id", uniqueIds);

    if (error) {
      return {
        byUserId: {},
        error: error.message ?? "Failed to load public profile labels",
      };
    }

    const rows = Array.isArray(data) ? data : [];
    const byUserId: Record<string, { display_name: string | null; username: string | null }> = {};
    for (const row of rows) {
      if (!isObject(row)) continue;
      const userId = getNestedString(row, ["user_id"]);
      if (!userId) continue;
      byUserId[userId] = {
        display_name: getNestedString(row, ["display_name"]),
        username: getNestedString(row, ["username"]),
      };
    }

    return { byUserId };
  } catch (e) {
    console.error("track-interaction-health public profile label lookup failed:", e);
    return {
      byUserId: {},
      error: e instanceof Error ? e.message : "Failed to load public profile labels",
    };
  }
}

async function fetchCleanupHistory(
  supabase: SupabaseClientLike,
  params: {
    historyLimit: number;
    historyOutcome: CleanupHistoryOutcomeFilter;
    historySinceDays: number | null;
    historyBeforeCreatedAt: string | null;
    historyAfterCreatedAt: string | null;
  }
): Promise<{ entries: CleanupHistoryEntry[]; hasMore: boolean; error?: string; profileError?: string }> {
  try {
    const useAfterCursor =
      typeof params.historyAfterCreatedAt === "string" && params.historyAfterCreatedAt.length > 0;

    let query = supabase
      .from("admin_actions")
      .select("id,admin_id,created_at,action_type,target_type,target_id,details")
      .eq("action_type", "track_interaction_nonce_cleanup")
      .eq("target_type", "interaction_event_nonces")
      .eq("target_id", "global");

    if (params.historySinceDays !== null) {
      const sinceIso = new Date(Date.now() - params.historySinceDays * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte("created_at", sinceIso);
    }

    if (params.historyOutcome !== "all") {
      query = query.filter("details->>outcome", "eq", params.historyOutcome);
    }

    if (useAfterCursor) {
      query = query.gt("created_at", params.historyAfterCreatedAt);
    } else if (params.historyBeforeCreatedAt !== null) {
      query = query.lt("created_at", params.historyBeforeCreatedAt);
    }

    const { data, error } = await query
      .order("created_at", { ascending: useAfterCursor })
      .limit(params.historyLimit + 1);

    if (error) {
      return {
        entries: [],
        hasMore: false,
        error: error.message ?? "Failed to load cleanup history",
      };
    }

    const rows = Array.isArray(data) ? data : [];
    const hasMore = rows.length > params.historyLimit;
    const visibleRows = hasMore ? rows.slice(0, params.historyLimit) : rows;
    const normalizedRows = useAfterCursor ? [...visibleRows].reverse() : visibleRows;
    const baseEntries: CleanupHistoryEntry[] = normalizedRows.map((row: unknown) => {
      const record = isObject(row) ? row : {};
      const details = isObject(record.details) ? record.details : {};
      const outcomeRaw = getNestedString(details, ["outcome"]);
      const outcome: CleanupHistoryEntry["outcome"] =
        outcomeRaw === "success" || outcomeRaw === "error" ? outcomeRaw : "unknown";
      const adminId = getNestedString(record, ["admin_id"]) ?? "";

      return {
        id: getNestedString(record, ["id"]) ?? "",
        admin_id: adminId,
        admin_display_name: null,
        admin_username: null,
        admin_label: adminId || null,
        created_at: getNestedString(record, ["created_at"]) ?? "",
        outcome,
        rows_deleted: getNestedNumber(details, ["rows_deleted"]),
        retention_days: Number.isFinite(Number(details.retention_days)) ? Number(details.retention_days) : null,
        cleanup_limit: Number.isFinite(Number(details.cleanup_limit)) ? Number(details.cleanup_limit) : null,
        assessment_status: getNestedString(details, ["assessment_status"]),
        assessment_warning_count: Number.isFinite(Number(details.assessment_warning_count))
          ? Number(details.assessment_warning_count)
          : null,
        cleanup_error: getNestedString(details, ["cleanup_error"]),
      };
    });

    const profileLookup = await fetchPublicProfileLabels(
      supabase,
      baseEntries.map((entry) => entry.admin_id)
    );

    const entries = baseEntries.map((entry) => {
      const profile = profileLookup.byUserId[entry.admin_id];
      if (!profile) return entry;
      const adminLabel = profile.display_name || profile.username || entry.admin_id || null;
      return {
        ...entry,
        admin_display_name: profile.display_name ?? null,
        admin_username: profile.username ?? null,
        admin_label: adminLabel,
      };
    });

    return {
      entries,
      hasMore,
      profileError: profileLookup.error,
    };
  } catch (e) {
    console.error("track-interaction-health cleanup history query failed:", e);
    return {
      entries: [],
      hasMore: false,
      error: e instanceof Error ? e.message : "Failed to load cleanup history",
    };
  }
}

async function logCleanupAdminAction(
  supabase: SupabaseClientLike,
  params: {
    adminId: string;
    retentionDays: number;
    cleanupLimit: number;
    cleanupBefore: string;
    cleanupResult?: unknown;
    cleanupError?: string;
    assessment?: HealthAssessment;
  }
): Promise<AuditLogStatus> {
  const rowsDeleted = getNestedNumber(params.cleanupResult, ["rows_deleted"]);
  const details = {
    operation: "track_interaction_nonce_cleanup",
    retention_days: params.retentionDays,
    cleanup_limit: params.cleanupLimit,
    cleanup_before: params.cleanupBefore,
    rows_deleted: rowsDeleted,
    outcome: params.cleanupError ? "error" : "success",
    cleanup_error: params.cleanupError ?? null,
    assessment_status: params.assessment?.status ?? null,
    assessment_warning_count: params.assessment?.warning_count ?? null,
  };

  const { error } = await supabase
    .from("admin_actions")
    .insert([{
      admin_id: params.adminId,
      action_type: "track_interaction_nonce_cleanup",
      target_type: "interaction_event_nonces",
      target_id: "global",
      details,
    }]);

  if (error) {
    console.error("track-interaction-health audit log insert failed:", error);
    return {
      attempted: true,
      logged: false,
      error: error.message ?? "Failed to insert admin action log",
    };
  }

  return {
    attempted: true,
    logged: true,
  };
}

export async function handleTrackInteractionHealth(
  req: Request,
  supabase: SupabaseClientLike,
  headers: Record<string, string>
): Promise<Response> {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("Unauthorized", 401, headers);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return errorResponse("Unauthorized", 401, headers);

    const isAllowed = await checkAdminOrModerator(supabase, user.id);
    if (!isAllowed) return errorResponse("Forbidden: admin or moderator role required", 403, headers);

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const retentionDays = getRetentionDaysFromRequest(req, body);
    const action = getRequestedAction(req, body);
    const cleanupLimit = getCleanupLimitFromRequest(req, body);
    const historyLimit = getHistoryLimitFromRequest(req, body);
    const historyOutcome = getHistoryOutcomeFromRequest(req, body);
    const historySinceDays = getHistorySinceDaysFromRequest(req, body);
    const requestedHistoryBeforeCreatedAt = getHistoryBeforeCreatedAtFromRequest(req, body);
    const requestedHistoryAfterCreatedAt = getHistoryAfterCreatedAtFromRequest(req, body);
    const historyAfterCreatedAt = requestedHistoryAfterCreatedAt;
    const historyBeforeCreatedAt =
      historyAfterCreatedAt !== null ? null : requestedHistoryBeforeCreatedAt;
    const cleanupBefore = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

    let cleanup: {
      attempted: boolean;
      before: string;
      limit: number;
      result: unknown;
    } | null = null;
    let auditLog: AuditLogStatus | null = null;

    if (action === "cleanup") {
      const { data: cleanupResult, error: cleanupError } = await supabase.rpc("cleanup_interaction_event_nonces_global", {
        p_before: cleanupBefore,
        p_limit: cleanupLimit,
      });
      if (cleanupError) {
        auditLog = await logCleanupAdminAction(supabase, {
          adminId: user.id,
          retentionDays,
          cleanupLimit,
          cleanupBefore,
          cleanupError: cleanupError.message || "cleanup_error",
        });
        return errorResponse(cleanupError.message || "Failed to run interaction nonce cleanup", 400, headers);
      }
      cleanup = {
        attempted: true,
        before: cleanupBefore,
        limit: cleanupLimit,
        result: cleanupResult ?? null,
      };
    }

    const { data: stats, error: statsError } = await supabase.rpc("get_track_interaction_health_stats", {
      p_retention_days: retentionDays,
    });
    if (statsError) {
      if (action === "cleanup") {
        await logCleanupAdminAction(supabase, {
          adminId: user.id,
          retentionDays,
          cleanupLimit,
          cleanupBefore,
          cleanupResult: cleanup?.result,
          cleanupError: `stats_refresh_failed:${statsError.message || "unknown"}`,
        });
      }
      return errorResponse(statsError.message || "Failed to load track interaction health", 400, headers);
    }
    const assessment = buildHealthAssessment(stats ?? null, retentionDays);

    if (action === "cleanup") {
      auditLog = await logCleanupAdminAction(supabase, {
        adminId: user.id,
        retentionDays,
        cleanupLimit,
        cleanupBefore,
        cleanupResult: cleanup?.result,
        assessment,
      });
    }
    const cleanupHistory = await fetchCleanupHistory(supabase, {
      historyLimit,
      historyOutcome,
      historySinceDays,
      historyBeforeCreatedAt,
      historyAfterCreatedAt,
    });
    const returnedCount = cleanupHistory.entries.length;
    const isAfterPaging = historyAfterCreatedAt !== null;
    const isBeforePaging = historyBeforeCreatedAt !== null;
    const hasMore = cleanupHistory.hasMore; // direction-specific overflow for the active query mode
    const pagingDirection: "latest" | "older" | "newer" = isAfterPaging
      ? "newer"
      : isBeforePaging
        ? "older"
        : "latest";

    const hasOlder =
      returnedCount > 0 &&
      (isAfterPaging ? true : hasMore);
    const hasNewer =
      returnedCount > 0 &&
      (isAfterPaging ? hasMore : isBeforePaging);

    const nextBeforeCreatedAt = hasOlder
      ? cleanupHistory.entries[returnedCount - 1]?.created_at ?? null
      : null;
    const nextAfterCreatedAt = hasNewer
      ? cleanupHistory.entries[0]?.created_at ?? null
      : null;

    return jsonResponse(
      {
        success: true,
        generated_at: new Date().toISOString(),
        action,
        requested_retention_days: retentionDays,
        cleanup,
        audit_log: auditLog,
        cleanup_history: cleanupHistory.entries,
        cleanup_history_meta: {
          limit: historyLimit,
          returned_count: returnedCount,
          has_more: hasMore,
          has_older: hasOlder,
          has_newer: hasNewer,
          next_before_created_at: nextBeforeCreatedAt,
          next_after_created_at: nextAfterCreatedAt,
          paging_direction: pagingDirection,
          filters: {
            outcome: historyOutcome,
            since_days: historySinceDays,
            before_created_at: historyBeforeCreatedAt,
            after_created_at: historyAfterCreatedAt,
          },
          error: cleanupHistory.error ?? null,
          profile_error: cleanupHistory.profileError ?? null,
        },
        assessment,
        stats: stats ?? null,
      },
      200,
      headers
    );
  } catch (e) {
    console.error("track-interaction-health error:", e);
    return errorResponse("Internal server error", 500, headers);
  }
}

if (import.meta.main) {
  serve(async (req) => {
    const cors = getCorsHeadersAdmin(req);
    if (!cors.ok) return cors.response;
    const headers = { ...cors.headers, "Content-Type": "application/json" };

    if (req.method === "OPTIONS") {
      return new Response(null, { headers: cors.headers });
    }

    if (req.method !== "GET" && req.method !== "POST") {
      return errorResponse("Method not allowed", 405, headers);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    return await handleTrackInteractionHealth(req, supabase, headers);
  });
}
