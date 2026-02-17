/**
 * useAdminUsers – Hook for admin user list with pagination, search, and filters.
 */
import { useState, useCallback } from 'react';
import { adminUsersService, type ListUsersParams, type AdminUserListItem, type AdminUserDetail } from '@/services/adminUsers.service';

export interface UseAdminUsersOptions {
  initialPageSize?: number;
  includeAuth?: boolean;
}

export function useAdminUsers(options: UseAdminUsersOptions = {}) {
  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [perPage] = useState(options.initialPageSize ?? 25);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<Pick<ListUsersParams, 'search' | 'role' | 'kyc_status' | 'banned' | 'sort' | 'order'>>({
    search: '',
    role: undefined,
    kyc_status: undefined,
    banned: undefined,
    sort: 'created_at',
    order: 'desc',
  });

  const fetchUsers = useCallback(async (pageNum: number = page, filterOverrides?: Partial<typeof filters>) => {
    setIsLoading(true);
    setError(null);
    try {
      const merged = { ...filters, ...filterOverrides };
      const res = await adminUsersService.listUsers({
        page: pageNum,
        per_page: perPage,
        search: merged.search || undefined,
        role: merged.role,
        kyc_status: merged.kyc_status,
        banned: merged.banned,
        sort: merged.sort,
        order: merged.order,
        include_auth: options.includeAuth ?? false,
      });
      setUsers(res.users);
      setTotal(res.total);
      setTotalPages(res.total_pages);
      setPage(res.page);
      return res;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load users';
      setError(msg);
      setUsers([]);
      setTotal(0);
      setTotalPages(0);
    } finally {
      setIsLoading(false);
    }
  }, [page, perPage, filters, options.includeAuth]);

  const goToPage = useCallback((p: number) => {
    if (p >= 1 && p <= totalPages) {
      fetchUsers(p);
    }
  }, [totalPages, fetchUsers]);

  const updateFilters = useCallback((newFilters: Partial<typeof filters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
    fetchUsers(1, newFilters);
  }, [fetchUsers]);

  const refresh = useCallback(() => fetchUsers(page), [fetchUsers, page]);

  return {
    users,
    total,
    totalPages,
    page,
    perPage,
    isLoading,
    error,
    filters,
    fetchUsers,
    goToPage,
    updateFilters,
    refresh,
  };
}

export function useAdminUserDetail(userId: string | null) {
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!userId) {
      setDetail(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const res = await adminUsersService.getUserDetail(userId);
      setDetail(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load user');
      setDetail(null);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  return { detail, isLoading, error, fetchDetail };
}
