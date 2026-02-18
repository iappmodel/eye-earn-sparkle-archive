/**
 * Admin audit logging: persist every admin action to admin_actions and console.
 * Use from admin-only edge functions (admin-users, kyc-review) after auth and CORS.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const LOG_PREFIX = "[ADMIN-AUDIT]";

export async function logAdminAction(
  supabase: SupabaseClient,
  adminId: string,
  actionType: string,
  targetType: string,
  targetId: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  const payload = { adminId, actionType, targetType, targetId, details };
  console.log(`${LOG_PREFIX} ${JSON.stringify(payload)}`);

  const { error } = await supabase.from("admin_actions").insert({
    admin_id: adminId,
    action_type: actionType,
    target_type: targetType,
    target_id: targetId,
    details: details as Record<string, unknown>,
  });

  if (error) {
    console.error(`${LOG_PREFIX} insert failed:`, error.message);
  }
}
