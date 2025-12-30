import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, Clock, Trash2, Edit3, MoreVertical, 
  Video, Image, AlertCircle, RefreshCw 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
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
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface Draft {
  key: string;
  contentType: string;
  data: {
    title?: string;
    caption?: string;
    tags?: string[];
    media?: string;
    mediaType?: string;
    thumbnail?: string;
    savedAt: string;
  };
}

export default function Drafts() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    loadDrafts();
  }, [user]);

  const loadDrafts = () => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const foundDrafts: Draft[] = [];

    // Scan localStorage for drafts
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(`draft_${user.id}_`)) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          const contentType = key.replace(`draft_${user.id}_`, '');
          foundDrafts.push({
            key,
            contentType,
            data,
          });
        } catch (e) {
          console.error('Failed to parse draft:', key);
        }
      }
    }

    // Sort by savedAt (newest first)
    foundDrafts.sort((a, b) => {
      const dateA = new Date(a.data.savedAt || 0).getTime();
      const dateB = new Date(b.data.savedAt || 0).getTime();
      return dateB - dateA;
    });

    setDrafts(foundDrafts);
    setIsLoading(false);
  };

  const handleDelete = (key: string) => {
    localStorage.removeItem(key);
    setDrafts(prev => prev.filter(d => d.key !== key));
    setDeleteTarget(null);
    toast.success('Draft deleted');
  };

  const handleEdit = (draft: Draft) => {
    // Navigate to appropriate editor based on content type
    switch (draft.contentType) {
      case 'video':
      case 'reel':
        navigate('/create', { state: { draft: draft.data } });
        break;
      case 'post':
        navigate('/create', { state: { draft: draft.data } });
        break;
      default:
        navigate('/studio', { state: { draft: draft.data } });
    }
  };

  const handleClearAll = () => {
    drafts.forEach(draft => localStorage.removeItem(draft.key));
    setDrafts([]);
    toast.success('All drafts cleared');
  };

  const getMediaIcon = (type?: string) => {
    if (type === 'video') return <Video className="w-4 h-4" />;
    if (type === 'image') return <Image className="w-4 h-4" />;
    return <FileText className="w-4 h-4" />;
  };

  const getContentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      video: 'Video',
      reel: 'Reel',
      post: 'Post',
      image: 'Photo',
      story: 'Story',
    };
    return labels[type] || type;
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
        <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Sign in Required</h2>
        <p className="text-muted-foreground text-center mb-4">
          Please sign in to view your drafts
        </p>
        <Button onClick={() => navigate('/auth')}>Sign In</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border z-10">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-semibold">Drafts</h1>
            {drafts.length > 0 && (
              <Badge variant="secondary">{drafts.length}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={loadDrafts}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            {drafts.length > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-destructive"
                onClick={handleClearAll}
              >
                Clear All
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : drafts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <FileText className="w-16 h-16 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-2">No Drafts</h2>
            <p className="text-muted-foreground text-center text-sm mb-6">
              Your unsaved content will appear here
            </p>
            <Button onClick={() => navigate('/create')}>
              Create Content
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {drafts.map(draft => (
              <Card 
                key={draft.key}
                className="overflow-hidden hover:border-primary/50 transition-colors"
              >
                <CardContent className="p-0">
                  <div className="flex items-stretch">
                    {/* Thumbnail */}
                    <div className="w-24 h-24 bg-muted flex-shrink-0 relative">
                      {draft.data.thumbnail || draft.data.media ? (
                        <img
                          src={draft.data.thumbnail || draft.data.media}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          {getMediaIcon(draft.data.mediaType)}
                        </div>
                      )}
                      <Badge 
                        variant="secondary" 
                        className="absolute bottom-1 left-1 text-[10px]"
                      >
                        {getContentTypeLabel(draft.contentType)}
                      </Badge>
                    </div>

                    {/* Info */}
                    <div className="flex-1 p-3 min-w-0">
                      <h3 className="font-medium text-sm truncate">
                        {draft.data.title || draft.data.caption || 'Untitled Draft'}
                      </h3>
                      {draft.data.caption && draft.data.title && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {draft.data.caption}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>
                          {draft.data.savedAt 
                            ? formatDistanceToNow(new Date(draft.data.savedAt), { addSuffix: true })
                            : 'Unknown'}
                        </span>
                      </div>
                      {draft.data.tags && draft.data.tags.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {draft.data.tags.slice(0, 3).map(tag => (
                            <Badge key={tag} variant="outline" className="text-[10px] px-1">
                              #{tag}
                            </Badge>
                          ))}
                          {draft.data.tags.length > 3 && (
                            <Badge variant="outline" className="text-[10px] px-1">
                              +{draft.data.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col justify-center p-2 gap-1">
                      <Button 
                        size="sm" 
                        onClick={() => handleEdit(draft)}
                        className="gap-1"
                      >
                        <Edit3 className="w-3 h-3" />
                        Edit
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem 
                            onClick={() => setDeleteTarget(draft.key)}
                            className="text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Draft?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The draft will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
