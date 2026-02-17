/**
 * Admin Users Service – Client for the admin-users edge function.
 * Used by admin/mod dashboard for user management.
 */
import { supabase } from '@/integrations/supabase/client';

export type AppRole = 'user' | 'creator' | 'moderator' | 'admin';
export type KycStatus = 'pending' | 'submitted' | 'verified' | 'rejected';

export interface AdminUserListItem {
  id: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_verified: boolean | null;
  kyc_status: string | null;
  vicoin_balance: number | null;
  icoin_balance: number | null;
  followers_count: number | null;
  following_count: number | null;
  total_views: number | null;
  total_likes: number | null;
  created_at: string;
  updated_at: string;
  role: string;
  isBanned: boolean;
  ban: {
    id: string;
    reason: string;
    is_permanent: boolean;
    expires_at: string | null;
    created_at: string;
  } | null;
  email?: string;
  last_sign_in_at?: string;
}

export interface AdminUserDetail {
  profile: AdminUserListItem['ban'] extends infer B
    ? Omit<AdminUserListItem, 'role' | 'isBanned' | 'ban' | 'email' | 'last_sign_in_at'> & Record<string, unknown>
    : Record<string, unknown>;
  role: string;
  ban: AdminUserListItem['ban'];
  email: string | null;
  last_sign_in_at: string | null;
  created_at_auth: string | null;
  content_count: number;
  transaction_count: number;
}

export interface ListUsersParams {
  page?: number;
  per_page?: number;
  search?: string;
  role?: AppRole;
  kyc_status?: KycStatus;
  banned?: boolean;
  sort?: 'created_at' | 'updated_at' | 'username' | 'display_name' | 'total_views' | 'total_likes' | 'followers_count';
  order?: 'asc' | 'desc';
  include_auth?: boolean;
}

export interface ListUsersResponse {
  users: AdminUserListItem[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface BulkActionResult {
  user_id: string;
  success: boolean;
  error?: string;
}

export interface BulkActionResponse {
  success: boolean;
  results: BulkActionResult[];
  success_count: number;
  total: number;
}

async function invokeAdminUsers<T = unknown>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('admin-users', {
    body,
  });

  if (error) {
    throw new Error(error.message ?? 'Admin users API failed');
  }

  const err = (data as { error?: string })?.error;
  if (err) {
    throw new Error(err);
  }

  return data as T;
}

export const adminUsersService = {
  /** List users with pagination, search, and filters */
  async listUsers(params: ListUsersParams = {}): Promise<ListUsersResponse> {
    return invokeAdminUsers<ListUsersResponse>({
      action: 'list',
      page: params.page ?? 1,
      per_page: params.per_page ?? 25,
      search: params.search ?? '',
      role: params.role,
      kyc_status: params.kyc_status,
      banned: params.banned,
      sort: params.sort ?? 'created_at',
      order: params.order ?? 'desc',
      include_auth: params.include_auth ?? false,
    });
  },

  /** Get full user detail including auth metadata */
  async getUserDetail(userId: string): Promise<AdminUserDetail> {
    return invokeAdminUsers<AdminUserDetail>({
      action: 'detail',
      user_id: userId,
    });
  },

  /** Bulk ban users */
  async bulkBan(
    userIds: string[],
    options: { reason?: string; is_permanent?: boolean; expires_at?: string } = {}
  ): Promise<BulkActionResponse> {
    return invokeAdminUsers<BulkActionResponse>({
      action: 'bulk',
      bulk_action: 'ban',
      user_ids: userIds,
      reason: options.reason ?? 'Bulk ban by admin',
      is_permanent: options.is_permanent ?? false,
      expires_at: options.expires_at,
    });
  },

  /** Bulk unban users */
  async bulkUnban(userIds: string[]): Promise<BulkActionResponse> {
    return invokeAdminUsers<BulkActionResponse>({
      action: 'bulk',
      bulk_action: 'unban',
      user_ids: userIds,
    });
  },

  /** Bulk update user roles */
  async bulkUpdateRole(userIds: string[], newRole: AppRole): Promise<BulkActionResponse> {
    return invokeAdminUsers<BulkActionResponse>({
      action: 'bulk',
      bulk_action: 'update_role',
      user_ids: userIds,
      new_role: newRole,
    });
  },
};
