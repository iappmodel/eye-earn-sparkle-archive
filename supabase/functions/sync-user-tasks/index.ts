import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeadersStrict } from "../_shared/cors.ts";

// deno-lint-ignore no-explicit-any
type SupabaseClientLike = any;

type TaskTemplateRow = {
  id: string;
  type: "daily" | "weekly" | "milestone" | "streak" | string;
  goal: number;
  is_active?: boolean;
};

function getTodayIsoUTC(): string {
  return new Date().toISOString().split("T")[0];
}

function getWeekStartIsoUTC(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const weekStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  weekStart.setUTCDate(weekStart.getUTCDate() + diffToMonday);
  return weekStart.toISOString().split("T")[0];
}

async function authenticate(req: Request, supabase: SupabaseClientLike) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return { user: null, error: "Unauthorized" };

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return { user: null, error: "Unauthorized" };
  return { user, error: null };
}

export async function handleSyncUserTasks(
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

  const today = getTodayIsoUTC();
  const weekStart = getWeekStartIsoUTC();

  const { data: templates, error: templatesError } = await supabase
    .from("task_templates")
    .select("id, type, goal")
    .eq("is_active", true);

  if (templatesError) {
    console.error("[sync-user-tasks] template lookup error:", templatesError);
    throw templatesError;
  }

  const activeTemplates = (templates ?? []) as TaskTemplateRow[];
  if (activeTemplates.length === 0) {
    return new Response(
      JSON.stringify({ success: true, createdCount: 0, today, weekStart }),
      { headers: { ...headers, "Content-Type": "application/json" } },
    );
  }

  const { data: existingTasks, error: tasksError } = await supabase
    .from("user_tasks")
    .select("template_id, period_start")
    .eq("user_id", user.id)
    .gte("period_start", weekStart);

  if (tasksError) {
    console.error("[sync-user-tasks] user_tasks lookup error:", tasksError);
    throw tasksError;
  }

  const existingKey = new Set(
    (existingTasks ?? []).map((row: { template_id: string; period_start: string }) => `${row.template_id}:${row.period_start}`),
  );

  const rowsToCreate = activeTemplates.flatMap((template) => {
    const templateGoal = Math.max(1, Math.floor(Number(template.goal ?? 1)));
    const periodStart = template.type === "weekly" ? weekStart : today;
    const key = `${template.id}:${periodStart}`;
    if (existingKey.has(key)) return [];
    return [{
      user_id: user.id,
      template_id: template.id,
      goal: templateGoal,
      period_start: periodStart,
    }];
  });

  let createdCount = 0;
  if (rowsToCreate.length > 0) {
    const { error: insertError } = await supabase
      .from("user_tasks")
      .insert(rowsToCreate);

    if (insertError) {
      const code = (insertError as { code?: string })?.code;
      if (code !== "23505") {
        console.error("[sync-user-tasks] insert error:", insertError);
        throw insertError;
      }
      // Concurrent sync created one or more rows first; treat as success.
    } else {
      createdCount = rowsToCreate.length;
    }
  }

  return new Response(
    JSON.stringify({ success: true, createdCount, today, weekStart }),
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
      return await handleSyncUserTasks(req, supabase, headers);
    } catch (error: unknown) {
      console.error("[sync-user-tasks] error:", error);
      return new Response(
        JSON.stringify({ success: false, error: "Internal server error" }),
        { status: 500, headers: { ...headers, "Content-Type": "application/json" } },
      );
    }
  });
}
