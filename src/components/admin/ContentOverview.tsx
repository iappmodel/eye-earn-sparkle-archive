import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FolderOpen, Search, ExternalLink, Loader2, Eye, EyeOff } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { useAdmin } from '@/hooks/useAdmin';

interface ContentRow {
  id: string;
  user_id: string;
  title: string | null;
  content_type: string;
  status: string;
  is_public: boolean | null;
  created_at: string;
  views_count: number | null;
  likes_count: number | null;
  username?: string | null;
  display_name?: string | null;
}

const PAGE_SIZE = 20;
const STATUS_OPTIONS = ['published', 'draft', 'scheduled', 'archived', 'removed'];

const ContentOverview: React.FC = () => {
  const { logAdminAction } = useAdmin();
  const { toast } = useToast();
  const [items, setItems] = useState<ContentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchPage = async (pageNum: number, append: boolean) => {
    if (!append) setLoading(true);
    let q = supabase
      .from('user_content')
      .select('id, user_id, title, content_type, status, is_public, created_at, views_count, likes_count', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

    if (statusFilter !== 'all') {
      q = q.eq('status', statusFilter);
    }
    if (search.trim()) {
      q = q.or(`title.ilike.%${search.trim()}%,caption.ilike.%${search.trim()}%`);
    }

    const { data, error, count } = await q;

    if (error) {
      console.error('Content fetch error:', error);
      toast({ title: 'Error', description: 'Failed to load content', variant: 'destructive' });
      setLoading(false);
      return;
    }

    const list = (data || []) as ContentRow[];
    const userIds = [...new Set(list.map((c) => c.user_id))];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, username, display_name')
      .in('user_id', userIds);

    const profileMap = new Map<string, { username: string | null; display_name: string | null }>();
    (profiles || []).forEach((p) => profileMap.set(p.user_id, { username: p.username, display_name: p.display_name }));

    const withProfiles = list.map((c) => ({
      ...c,
      username: profileMap.get(c.user_id)?.username,
      display_name: profileMap.get(c.user_id)?.display_name,
    }));

    if (append) {
      setItems((prev) => [...prev, ...withProfiles]);
    } else {
      setItems(withProfiles);
    }
    setHasMore(list.length === PAGE_SIZE);
    setLoading(false);
  };

  useEffect(() => {
    setPage(0);
    fetchPage(0, false);
  }, [statusFilter]);

  useEffect(() => {
    if (search === undefined) return;
    const t = setTimeout(() => {
      setPage(0);
      fetchPage(0, false);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchPage(next, true);
  };

  const setContentStatus = async (contentId: string, newStatus: string) => {
    setUpdatingId(contentId);
    const { error } = await supabase
      .from('user_content')
      .update({ status: newStatus })
      .eq('id', contentId);

    if (error) {
      toast({ title: 'Error', description: 'Failed to update content status', variant: 'destructive' });
    } else {
      await logAdminAction('content_status_change', 'user_content', contentId, { newStatus });
      setItems((prev) =>
        prev.map((c) => (c.id === contentId ? { ...c, status: newStatus } : c))
      );
      toast({ title: 'Success', description: 'Content status updated' });
    }
    setUpdatingId(null);
  };

  const takeDown = (row: ContentRow) => {
    setContentStatus(row.id, 'removed');
  };

  const restore = (row: ContentRow) => {
    setContentStatus(row.id, 'published');
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5" />
            Content overview
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Recent user content. You can hide (take down) or restore items.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by title or caption..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading && items.length === 0 ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No content found</p>
          ) : (
            <>
              <div className="space-y-2">
                {items.map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-4 border rounded-lg"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{row.title || row.content_type || row.id.slice(0, 8)}</p>
                      <p className="text-sm text-muted-foreground">
                        @{row.username || 'unknown'} · {row.content_type} ·{' '}
                        {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
                      </p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="secondary">{row.status}</Badge>
                        {row.views_count != null && (
                          <span className="text-xs text-muted-foreground">{row.views_count} views</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                      >
                        <a href={`/profile/${row.username || row.user_id}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </Button>
                      {row.status === 'removed' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => restore(row)}
                          disabled={updatingId === row.id}
                        >
                          {updatingId === row.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4 mr-1" />}
                          Restore
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          onClick={() => takeDown(row)}
                          disabled={updatingId === row.id}
                        >
                          {updatingId === row.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <EyeOff className="w-4 h-4 mr-1" />}
                          Take down
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {hasMore && (
                <Button variant="outline" className="w-full" onClick={loadMore} disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Load more
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ContentOverview;
