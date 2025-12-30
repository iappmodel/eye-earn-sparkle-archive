import React, { useState, useEffect } from 'react';
import { Edit, Eye, Calendar, Clock, Trash2, MoreVertical, BarChart3, Image } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ContentEditor } from './ContentEditor';
import { ContentAnalytics } from './ContentAnalytics';
import { format } from 'date-fns';

interface UserContentItem {
  id: string;
  title: string | null;
  caption: string | null;
  media_url: string | null;
  media_type: string | null;
  content_type: string;
  status: string;
  views_count: number | null;
  likes_count: number | null;
  created_at: string;
  scheduled_at: string | null;
  published_at: string | null;
}

export const ContentManager: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [contents, setContents] = useState<UserContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedContent, setSelectedContent] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (user) {
      loadContents();
    }
  }, [user]);

  const loadContents = async () => {
    try {
      const { data, error } = await supabase
        .from('user_content')
        .select('id, title, caption, media_url, media_type, content_type, status, views_count, likes_count, created_at, scheduled_at, published_at')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setContents((data || []) as UserContentItem[]);
    } catch (error) {
      console.error('Error loading contents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('user_content')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Content deleted' });
      setDeleteConfirm(null);
      loadContents();
    } catch (error) {
      console.error('Error deleting:', error);
      toast({ title: 'Failed to delete', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
      active: 'default',
      scheduled: 'secondary',
      draft: 'outline',
      expired: 'destructive',
    };
    const colors: Record<string, string> = {
      active: 'bg-green-500/20 text-green-500 border-green-500/30',
      scheduled: 'bg-blue-500/20 text-blue-500 border-blue-500/30',
      draft: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
      expired: 'bg-gray-500/20 text-gray-500 border-gray-500/30',
    };
    return (
      <Badge variant={variants[status] || 'outline'} className={colors[status] || ''}>
        {status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Your Content</h3>
        <span className="text-sm text-muted-foreground">{contents.length} items</span>
      </div>

      {contents.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Image className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No content yet</p>
            <p className="text-sm">Start creating to earn rewards!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {contents.map((content) => (
            <Card key={content.id} className="overflow-hidden">
              <CardContent className="p-0">
                <div className="flex">
                  {/* Thumbnail */}
                  <div className="w-24 h-24 shrink-0 bg-muted">
                    {content.media_url ? (
                      content.media_type === 'video' ? (
                        <video
                          src={content.media_url}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <img
                          src={content.media_url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      )
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Image className="w-8 h-8 text-muted-foreground/50" />
                      </div>
                    )}
                  </div>

                  {/* Content Info */}
                  <div className="flex-1 p-3 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate">
                          {content.title || content.caption?.slice(0, 30) || 'Untitled'}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {getStatusBadge(content.status)}
                          <span className="text-xs text-muted-foreground capitalize">
                            {content.content_type}
                          </span>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="shrink-0">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setSelectedContent(content.id);
                            setShowEditor(true);
                          }}>
                            <Edit className="w-4 h-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {
                            setSelectedContent(content.id);
                            setShowAnalytics(true);
                          }}>
                            <BarChart3 className="w-4 h-4 mr-2" /> Analytics
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteConfirm(content.id)}
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3 h-3" /> {content.views_count || 0}
                      </span>
                      {content.scheduled_at && content.status === 'scheduled' && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(content.scheduled_at), 'MMM d, h:mm a')}
                        </span>
                      )}
                      {!content.scheduled_at && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(content.created_at), 'MMM d')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Editor Sheet */}
      <Sheet open={showEditor} onOpenChange={setShowEditor}>
        <SheetContent className="overflow-y-auto w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Edit Content</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <ContentEditor
              contentId={selectedContent || undefined}
              onClose={() => {
                setShowEditor(false);
                setSelectedContent(null);
                loadContents();
              }}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Analytics Sheet */}
      <Sheet open={showAnalytics} onOpenChange={setShowAnalytics}>
        <SheetContent className="overflow-y-auto w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Content Analytics</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            {selectedContent && <ContentAnalytics contentId={selectedContent} />}
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Content?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your content
              and all associated data including views, likes, and analytics.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
