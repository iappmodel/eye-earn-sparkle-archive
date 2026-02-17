/**
 * Admin Users API – Admin-only edge function for user management.
 * Requires admin or moderator role.
 *
 * Actions:
 * - list: Paginated user list with search, filters, sort. Optionally includes auth metadata.
 * - detail: Full user detail by ID including auth metadata (email, last_sign_in).
 * - bulk: Bulk ban, unban, or update role.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status: number) {
  return jsonResponse({ error: message }, status);
}

async function checkAdminOrModerator(supabase: ReturnType<typeof createClient>, userId: string): Promise<boolean> {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (data) return true;
  const { data: modData } = await supabase.rpc("has_role", { _user_id: userId, _role: "moderator" });
  return !!modData;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("Unauthorized", 401);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return errorResponse("Unauthorized", 401);

    const isAllowed = await checkAdminOrModerator(supabase, user.id);
    if (!isAllowed) return errorResponse("Forbidden: admin or moderator role required", 403);

    const body = await req.json().catch(() => ({})) as Record<string, unknown>;
    const action = body.action as string;

    if (action === "list") {
      const page = Math.max(1, Number(body.page) || 1);
      const perPage = Math.min(100, Math.max(1, Number(body.per_page) || 25));
      const offset = (page - 1) * perPage;
      const search = (body.search as string)?.trim() || "";
      const role = body.role as string | undefined;
      const kycStatus = body.kyc_status as string | undefined;
      const banned = body.banned as boolean | undefined;
      const sort = (body.sort as string) || "created_at";
      const order = (body.order as string) === "asc" ? "asc" : "desc";
      const includeAuth = body.include_auth === true;

      let query = supabase.from("profiles").select("id, user_id, username, display_name, avatar_url, bio, is_verified, kyc_status, vicoin_balance, icoin_balance, followers_count, following_count, total_views, total_likes, created_at, updated_at", { count: "exact" });

      if (search) {
        const term = `%${search}%`;
        query = query.or(`username.ilike.${term},display_name.ilike.${term},user_id.ilike.${term}`);
      }
      if (kycStatus) query = query.eq("kyc_status", kycStatus);
      if (typeof banned === "boolean") {
        const { data: banUserIds } = await supabase.from("user_bans").select("user_id");
        const ids = (banUserIds || []).map((b) => b.user_id);
        if (banned) query = query.in("user_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
        else if (ids.length) query = query.not("user_id", "in", `(${ids.join(",")})`);
      }

      const validSort = ["created_at", "updated_at", "username", "display_name", "total_views", "total_likes", "followers_count"].includes(sort)
        ? sort
        : "created_at";
      query = query.order(validSort, { ascending: order === "asc" });
      query = query.range(offset, offset + perPage - 1);

      const { data: profiles, error: profilesError, count } = await query;

      if (profilesError) return errorResponse(profilesError.message, 400);

      const userIds = (profiles || []).map((p) => p.user_id);
      const [rolesRes, bansRes] = await Promise.all([
        supabase.from("user_roles").select("user_id, role").in("user_id", userIds),
        supabase.from("user_bans").select("user_id, id, reason, is_permanent, expires_at, created_at").in("user_id", userIds),
      ]);

      const rolesMap = new Map<string, string>();
      (rolesRes.data || []).forEach((r) => rolesMap.set(r.user_id, r.role));
      const bansMap = new Map<string, { id: string; reason: string; is_permanent: boolean; expires_at: string | null; created_at: string }>();
      (bansRes.data || []).forEach((b) => bansMap.set(b.user_id, { id: b.id, reason: b.reason, is_permanent: b.is_permanent, expires_at: b.expires_at, created_at: b.created_at }));

      let users = (profiles || []).map((p) => {
        const roleVal = rolesMap.get(p.user_id) || "user";
        const ban = bansMap.get(p.user_id);
        return {
          ...p,
          role: roleVal,
          isBanned: !!ban,
          ban: ban || null,
        };
      });

      if (role && ["user", "creator", "moderator", "admin"].includes(role)) {
        users = users.filter((u) => u.role === role);
      }

      let authMap: Record<string, { email?: string; last_sign_in_at?: string }> = {};
      if (includeAuth && userIds.length > 0) {
        const authResults = await Promise.all(
          userIds.slice(0, 50).map((id) => supabase.auth.admin.getUserById(id))
        );
        authResults.forEach((r, i) => {
          if (r.data?.user && userIds[i]) {
            authMap[userIds[i]] = {
              email: r.data.user.email,
              last_sign_in_at: r.data.user.last_sign_in_at ?? undefined,
            };
          }
        });
      }

      const items = users.map((u) => {
        if (!u) return null;
        const auth = authMap[u.user_id] || {};
        return { ...u, ...auth };
      }).filter(Boolean);

      return jsonResponse({
        users: items,
        total: count ?? items.length,
        page,
        per_page: perPage,
        total_pages: Math.ceil((count ?? 0) / perPage),
      });
    }

    if (action === "detail") {
      const userId = body.user_id as string;
      if (!userId) return errorResponse("user_id is required", 400);

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (profileError || !profile) return errorResponse("User not found", 404);

      const [{ data: roleData }, { data: banData }, { data: authData }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", userId).maybeSingle(),
        supabase.from("user_bans").select("*").eq("user_id", userId).maybeSingle(),
        supabase.auth.admin.getUserById(userId),
      ]);

      const role = roleData?.role || "user";
      const ban = banData || null;
      const authUser = authData?.user;

      const { count: contentCount } = await supabase
        .from("user_content")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);
      const { count: txCount } = await supabase
        .from("transactions")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);

      return jsonResponse({
        profile,
        role,
        ban,
        email: authUser?.email ?? null,
        last_sign_in_at: authUser?.last_sign_in_at ?? null,
        created_at_auth: authUser?.created_at ?? null,
        content_count: contentCount ?? 0,
        transaction_count: txCount ?? 0,
      });
    }

    if (action === "bulk") {
      const isAdmin = !!(await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" })).data;
      if (!isAdmin) return errorResponse("Only admins can perform bulk actions", 403);

      const userIds = body.user_ids as string[] | undefined;
      const bulkAction = body.bulk_action as string;

      if (!Array.isArray(userIds) || userIds.length === 0) return errorResponse("user_ids array is required", 400);
      if (!["ban", "unban", "update_role"].includes(bulkAction)) return errorResponse("Invalid bulk_action", 400);

      const results: { user_id: string; success: boolean; error?: string }[] = [];

      if (bulkAction === "ban") {
        const reason = (body.reason as string) || "Bulk ban by admin";
        const isPermanent = body.is_permanent === true;
        const expiresAt = body.expires_at as string | undefined;

        for (const uid of userIds) {
          const { error } = await supabase.from("user_bans").upsert(
            { user_id: uid, banned_by: user.id, reason, is_permanent: isPermanent, expires_at: expiresAt || null },
            { onConflict: "user_id" }
          );
          results.push({ user_id: uid, success: !error, error: error?.message });
        }
      } else if (bulkAction === "unban") {
        for (const uid of userIds) {
          const { error } = await supabase.from("user_bans").delete().eq("user_id", uid);
          results.push({ user_id: uid, success: !error, error: error?.message });
        }
      } else if (bulkAction === "update_role") {
        const newRole = body.new_role as string;
        if (!["user", "creator", "moderator", "admin"].includes(newRole)) {
          return errorResponse("Invalid new_role", 400);
        }
        for (const uid of userIds) {
          const { error } = await supabase.from("user_roles").update({ role: newRole }).eq("user_id", uid);
          results.push({ user_id: uid, success: !error, error: error?.message });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      return jsonResponse({
        success: true,
        results,
        success_count: successCount,
        total: userIds.length,
      });
    }

    return errorResponse("Invalid action. Use list, detail, or bulk.", 400);
  } catch (e) {
    console.error("admin-users error:", e);
    return errorResponse("Internal server error", 500);
  }
});
