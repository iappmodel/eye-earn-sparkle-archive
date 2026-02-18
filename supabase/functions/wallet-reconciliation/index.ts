/**
 * Wallet Reconciliation API – Admin-only edge function for wallet audit.
 * Requires admin role. Uses user JWT for RPC so auth.uid() is set.
 *
 * Actions:
 * - reconciliation: Ledger sum vs profile balance per user/currency; flags discrepancies.
 * - ledger_entries: Paginated ledger entries with filters.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeadersStrict } from "../_shared/cors.ts";

function jsonResponse(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status: number, headers: Record<string, string>) {
  return jsonResponse({ error: message }, status, headers);
}

async function checkAdmin(supabase: ReturnType<typeof createClient>, userId: string): Promise<boolean> {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  return !!data;
}

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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return errorResponse("Unauthorized", 401, headers);

    const token = authHeader.replace("Bearer ", "");
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !user) return errorResponse("Unauthorized", 401, headers);

    const isAdmin = await checkAdmin(adminClient, user.id);
    if (!isAdmin) return errorResponse("Forbidden: admin role required", 403, headers);

    // Client with user JWT so auth.uid() works in RPCs
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = body.action as string;

    if (action === "reconciliation") {
      const userId = body.user_id as string | undefined;
      const limit = Math.min(500, Math.max(1, Number(body.limit) || 100));

      const { data: rows, error } = await userClient.rpc("get_wallet_reconciliation", {
        p_user_id_filter: userId || null,
        p_limit: limit,
      });

      if (error) return errorResponse(error.message, 400, headers);

      const discrepancies = (rows || []).filter(
        (r: { discrepancy: number }) => r.discrepancy !== 0
      );

      return jsonResponse(
        {
          rows: rows || [],
          discrepancy_count: discrepancies.length,
          total_rows: (rows || []).length,
        },
        200,
        headers
      );
    }

    if (action === "ledger_entries") {
      const userId = body.user_id as string | undefined;
      const typeFilter = body.type as string | undefined;
      const currencyFilter = body.currency as string | undefined;
      const since = body.since as string | undefined;
      const until = body.until as string | undefined;
      const limit = Math.min(200, Math.max(1, Number(body.limit) || 50));
      const offset = Math.max(0, Number(body.offset) || 0);

      const { data: rows, error } = await userClient.rpc("get_wallet_ledger_entries", {
        p_user_id_filter: userId || null,
        p_type_filter: typeFilter || null,
        p_currency_filter: currencyFilter || null,
        p_since: since || null,
        p_until: until || null,
        p_limit: limit,
        p_offset: offset,
      });

      if (error) return errorResponse(error.message, 400, headers);

      const entries = rows || [];
      const totalCount = entries.length > 0 ? (entries[0] as { total_count: number }).total_count : 0;

      return jsonResponse(
        {
          entries: entries.map(
            (e: Record<string, unknown>) => ({
              id: e.id,
              user_id: e.user_id,
              type: e.type,
              amount: e.amount,
              currency: e.currency,
              ref_id: e.ref_id,
              metadata: e.metadata,
              row_hash: e.row_hash,
              created_at: e.created_at,
              username: e.username,
              display_name: e.display_name,
            })
          ),
          total_count: totalCount,
          limit,
          offset,
        },
        200,
        headers
      );
    }

    return errorResponse("Invalid action. Use reconciliation or ledger_entries.", 400, headers);
  } catch (e) {
    console.error("wallet-reconciliation error:", e);
    return errorResponse("Internal server error", 500, headers);
  }
});
