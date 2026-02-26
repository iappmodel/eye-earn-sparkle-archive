import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";
import { getCorsHeadersStrict } from "../_shared/cors.ts";
import { checkRewardRateLimit } from "../_shared/rateLimit.ts";

const UpdateTaskProgressSchema = z.object({
  templateId: z.string().uuid("Invalid task template ID"),
  increment: z.number().int("Increment must be an integer").min(1).max(5).default(1),
  eventType: z.string().max(64).optional(),
  contentId: z.string().max(255).optional(),
}).strict();

// deno-lint-ignore no-explicit-any
type SupabaseClientLike = any;

type TaskTemplateRow = {
  id: string;
  type: "daily" | "weekly" | "milestone" | "streak" | string;
  goal: number;
  is_active?: boolean | null;
  title?: string | null;
  category?: string | null;
  icon?: string | null;
};

type UserTaskRow = {
  id: string;
  user_id: string;
  template_id: string;
  progress: number;
  goal: number;
  completed: boolean;
  completed_at: string | null;
  reward_claimed: boolean;
  period_start: string;
};

type TaskProofKind =
  | "likes_count"
  | "shares_count"
  | "watch_count"
  | "daily_login"
  | "weekly_referrals"
  | "weekly_completed_tasks"
  | "streak_days"
  | "manual_increment";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getTodayIsoUTC(): string {
  return new Date().toISOString().split("T")[0];
}

function getWeekStartIsoUTC(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  weekStart.setUTCDate(weekStart.getUTCDate() + diffToMonday);
  return weekStart.toISOString().split("T")[0];
}

function getPeriodStartIsoUTC(templateType: string): string {
  return templateType === "weekly" ? getWeekStartIsoUTC() : getTodayIsoUTC();
}

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function inferTaskProofKind(template: TaskTemplateRow): TaskProofKind | null {
  const title = String(template.title ?? "").toLowerCase();
  const icon = String(template.icon ?? "").toLowerCase();

  if (title.includes("like") || icon === "heart") return "likes_count";
  if (title.includes("share") || icon === "share") return "shares_count";
  if (title.includes("watch") || icon === "play") return "watch_count";
  if (title.includes("daily login") || icon === "calendar") return "daily_login";
  if (title.includes("invite") || title.includes("referr") || icon === "user-plus") return "weekly_referrals";
  if (title.includes("complete 10 tasks") || icon === "check-circle") return "weekly_completed_tasks";
  if (title.includes("streak") || icon === "flame") return "streak_days";

  return null;
}

async function computeTaskProgressFromProof(
  supabase: SupabaseClientLike,
  userId: string,
  task: UserTaskRow,
  template: TaskTemplateRow,
  increment: number,
  eventType?: string,
): Promise<{ progress: number; proofKind: TaskProofKind; proofMeta?: Record<string, unknown> }> {
  const proofKind = inferTaskProofKind(template);
  const goal = Math.max(1, Math.floor(Number(task.goal ?? template.goal ?? 1)));
  const normalizedEventType = String(eventType ?? "").trim().toLowerCase();
  const periodStart = getPeriodStartIsoUTC(template.type);
  const today = getTodayIsoUTC();

  if (proofKind === "likes_count") {
    const { data, error } = await supabase
      .from("content_likes")
      .select("id, content_id, created_at")
      .eq("user_id", userId)
      .gte("created_at", `${periodStart}T00:00:00.000Z`);
    if (error) throw error;
    const likeRows = (data ?? []) as Array<{ content_id?: string | null }>;
    const candidateIds = [...new Set(
      likeRows
        .map((row) => String(row.content_id ?? ""))
        .filter((id) => isUuid(id))
    )];
    let validContentIds = new Set<string>();
    if (candidateIds.length > 0) {
      const { data: contentRows, error: contentError } = await supabase
        .from("user_content")
        .select("id")
        .in("id", candidateIds)
        .eq("status", "active");
      if (contentError) throw contentError;
      validContentIds = new Set((contentRows ?? []).map((row: { id: string }) => row.id));
    }
    const count = likeRows.filter((row) => validContentIds.has(String(row.content_id ?? ""))).length;
    return { progress: Math.min(goal, count), proofKind, proofMeta: { periodStart } };
  }

  if (proofKind === "shares_count") {
    const { data, error } = await supabase
      .from("content_interactions")
      .select("id, content_id, created_at, shared, last_event_type")
      .eq("user_id", userId)
      .gte("created_at", `${periodStart}T00:00:00.000Z`);
    if (error) throw error;
    const shareRows = (data ?? []).filter((row: { shared?: boolean | null; last_event_type?: string | null }) =>
      row.shared === true || String(row.last_event_type ?? "").toLowerCase() === "share"
    ) as Array<{ content_id?: string | null }>;
    const candidateIds = [...new Set(
      shareRows
        .map((row) => String(row.content_id ?? ""))
        .filter((id) => isUuid(id))
    )];
    let validContentIds = new Set<string>();
    if (candidateIds.length > 0) {
      const { data: contentRows, error: contentError } = await supabase
        .from("user_content")
        .select("id")
        .in("id", candidateIds)
        .eq("status", "active");
      if (contentError) throw contentError;
      validContentIds = new Set((contentRows ?? []).map((row: { id: string }) => row.id));
    }
    const count = shareRows.filter((row) => validContentIds.has(String(row.content_id ?? ""))).length;
    return { progress: Math.min(goal, count), proofKind, proofMeta: { periodStart } };
  }

  if (proofKind === "watch_count") {
    const { data, error } = await supabase
      .from("content_interactions")
      .select("id, content_id, created_at, watch_duration, total_duration, watch_completion_rate")
      .eq("user_id", userId)
      .gte("created_at", `${periodStart}T00:00:00.000Z`);
    if (error) throw error;
    const watchedRows = (data ?? []).filter((row: {
      content_id?: string | null;
      watch_duration?: number | null;
      total_duration?: number | null;
      watch_completion_rate?: number | null;
    }) => (
      Number(row.watch_duration ?? 0) > 0 ||
      Number(row.total_duration ?? 0) > 0 ||
      Number(row.watch_completion_rate ?? 0) > 0
    )) as Array<{ content_id?: string | null }>;
    const candidateIds = [...new Set(
      watchedRows
        .map((row) => String(row.content_id ?? ""))
        .filter((id) => isUuid(id))
    )];
    let validContentIds = new Set<string>();
    if (candidateIds.length > 0) {
      const { data: contentRows, error: contentError } = await supabase
        .from("user_content")
        .select("id")
        .in("id", candidateIds)
        .eq("status", "active");
      if (contentError) throw contentError;
      validContentIds = new Set((contentRows ?? []).map((row: { id: string }) => row.id));
    }
    const count = watchedRows.filter((row) => validContentIds.has(String(row.content_id ?? ""))).length;
    return { progress: Math.min(goal, count), proofKind, proofMeta: { periodStart } };
  }

  if (proofKind === "daily_login") {
    const { data, error } = await supabase
      .from("user_levels")
      .select("last_active_date")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;

    // If no server-owned activity has touched user_levels yet, allow explicit login event to mark the daily login task.
    const loginObserved = String(data?.last_active_date ?? "") === today || normalizedEventType === "login";
    return { progress: loginObserved ? 1 : 0, proofKind, proofMeta: { today, source: loginObserved && normalizedEventType === "login" ? "login_event" : "user_levels" } };
  }

  if (proofKind === "weekly_referrals") {
    const { data, error } = await supabase
      .from("referrals")
      .select("id, created_at")
      .eq("referrer_id", userId)
      .gte("created_at", `${getWeekStartIsoUTC()}T00:00:00.000Z`);
    if (error) throw error;
    return { progress: Math.min(goal, (data ?? []).length), proofKind, proofMeta: { periodStart: getWeekStartIsoUTC() } };
  }

  if (proofKind === "weekly_completed_tasks") {
    const { data, error } = await supabase
      .from("user_tasks")
      .select("id, completed, period_start")
      .eq("user_id", userId)
      .eq("completed", true)
      .gte("period_start", getWeekStartIsoUTC());
    if (error) throw error;
    const count = (data ?? []).filter((row: { id: string }) => row.id !== task.id).length;
    return { progress: Math.min(goal, count), proofKind, proofMeta: { periodStart: getWeekStartIsoUTC() } };
  }

  if (proofKind === "streak_days") {
    const { data, error } = await supabase
      .from("user_levels")
      .select("streak_days")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return { progress: Math.min(goal, Math.max(0, Math.floor(Number(data?.streak_days ?? 0)))), proofKind };
  }

  // Fail closed for unknown templates unless an explicit manual override event is provided.
  if (normalizedEventType === "manual_increment") {
    return {
      progress: Math.min(goal, Math.max(0, Math.floor(Number(task.progress ?? 0))) + Math.max(1, Math.floor(increment))),
      proofKind: "manual_increment",
    };
  }

  return {
    progress: Math.max(0, Math.floor(Number(task.progress ?? 0))),
    proofKind: "manual_increment",
    proofMeta: { unsupported: true },
  };
}

async function authenticate(req: Request, supabase: SupabaseClientLike) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return { user: null, error: "Unauthorized" };
  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return { user: null, error: "Unauthorized" };
  return { user, error: null };
}

async function getOrCreateTaskForCurrentPeriod(
  supabase: SupabaseClientLike,
  userId: string,
  template: TaskTemplateRow,
): Promise<UserTaskRow> {
  const periodStart = template.type === "weekly" ? getWeekStartIsoUTC() : getTodayIsoUTC();

  const lookup = async () => {
    const { data, error } = await supabase
      .from("user_tasks")
      .select("id, user_id, template_id, progress, goal, completed, completed_at, reward_claimed, period_start")
      .eq("user_id", userId)
      .eq("template_id", template.id)
      .eq("period_start", periodStart)
      .maybeSingle();
    if (error) throw error;
    return data as UserTaskRow | null;
  };

  const existing = await lookup();
  if (existing) return existing;

  const templateGoal = Math.max(1, Math.floor(Number(template.goal ?? 1)));
  const { data: inserted, error: insertError } = await supabase
    .from("user_tasks")
    .insert({
      user_id: userId,
      template_id: template.id,
      goal: templateGoal,
      period_start: periodStart,
    })
    .select("id, user_id, template_id, progress, goal, completed, completed_at, reward_claimed, period_start")
    .maybeSingle();

  if (insertError) {
    const code = (insertError as { code?: string })?.code;
    if (code === "23505") {
      const concurrent = await lookup();
      if (concurrent) return concurrent;
    }
    throw insertError;
  }

  if (!inserted) {
    throw new Error("Failed to create user task row");
  }

  return inserted as UserTaskRow;
}

export async function handleUpdateTaskProgress(
  req: Request,
  supabase: SupabaseClientLike,
  headers: Record<string, string>,
): Promise<Response> {
  const { user, error: authError } = await authenticate(req, supabase);
  if (authError || !user) {
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized" }),
      { status: 401, headers: { ...headers, "Content-Type": "application/json" } },
    );
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

  const parsed = UpdateTaskProgressSchema.safeParse(rawBody);
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

  const { templateId, increment, eventType } = parsed.data;

  const { data: template, error: templateError } = await supabase
    .from("task_templates")
    .select("id, type, goal, is_active, title, category, icon")
    .eq("id", templateId)
    .eq("is_active", true)
    .maybeSingle();

  if (templateError) {
    console.error("[update-task-progress] template lookup error:", templateError);
    throw templateError;
  }
  if (!template) {
    return new Response(
      JSON.stringify({ success: false, error: "Task template not found", code: "action_not_found" }),
      { status: 404, headers: { ...headers, "Content-Type": "application/json" } },
    );
  }

  const task = await getOrCreateTaskForCurrentPeriod(supabase, user.id, template as TaskTemplateRow);
  const currentProgress = Math.max(0, Math.floor(Number(task.progress ?? 0)));
  const goal = Math.max(1, Math.floor(Number(task.goal ?? template.goal ?? 1)));
  const wasCompleted = Boolean(task.completed);
  const computed = await computeTaskProgressFromProof(
    supabase,
    user.id,
    task,
    template as TaskTemplateRow,
    increment,
    eventType,
  );
  const computedProgress = Math.max(0, Math.floor(Number(computed.progress ?? 0)));
  const nextProgress = Math.min(goal, Math.max(currentProgress, computedProgress));
  const completed = nextProgress >= goal;

  if ((computed.proofMeta as { unsupported?: boolean } | undefined)?.unsupported) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Task progress proof is not supported for this template yet",
        code: "unsupported_task_proof",
      }),
      { status: 400, headers: { ...headers, "Content-Type": "application/json" } },
    );
  }

  if (wasCompleted || nextProgress === currentProgress) {
    return new Response(
      JSON.stringify({
        success: true,
        created: false,
        updated: false,
        completedJustNow: false,
        proofKind: computed.proofKind,
        task: {
          ...task,
          progress: currentProgress,
          goal,
          completed: wasCompleted,
        },
      }),
      { headers: { ...headers, "Content-Type": "application/json" } },
    );
  }

  const completedAt = completed ? (task.completed_at ?? new Date().toISOString()) : null;
  const { data: updatedTask, error: updateError } = await supabase
    .from("user_tasks")
    .update({
      progress: nextProgress,
      goal,
      completed,
      completed_at: completedAt,
    })
    .eq("id", task.id)
    .eq("user_id", user.id)
    .select("id, user_id, template_id, progress, goal, completed, completed_at, reward_claimed, period_start")
    .maybeSingle();

  if (updateError) {
    console.error("[update-task-progress] task update error:", updateError);
    throw updateError;
  }
  if (!updatedTask) {
    return new Response(
      JSON.stringify({ success: false, error: "Task not found after update" }),
      { status: 500, headers: { ...headers, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      created: false,
      updated: true,
      completedJustNow: !wasCompleted && completed,
      proofKind: computed.proofKind,
      task: updatedTask,
    }),
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
      return await handleUpdateTaskProgress(req, supabase, headers);
    } catch (error: unknown) {
      console.error("[update-task-progress] error:", error);
      return new Response(
        JSON.stringify({ success: false, error: "Internal server error" }),
        { status: 500, headers: { ...headers, "Content-Type": "application/json" } },
      );
    }
  });
}
