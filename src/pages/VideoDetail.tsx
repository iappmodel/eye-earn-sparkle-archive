import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useContentLikes } from '@/hooks/useContentLikes';
import { useContentUpload } from '@/hooks/useContentUpload';
import { CommentsPanel } from '@/components/CommentsPanel';
import { ShareSheet } from '@/components/ShareSheet';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ContentData {
  id: string;
  user_id: string;
  title: string | null;
  caption: string | null;
  media_url: string | null;
  media_type: string | null;
  views_count: number | null;
  likes_count: number | null;
  comments_count: number | null;
  created_at: string;
  tags: string[] | null;
}

interface CreatorData {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

const VideoDetail = () => {
  const { videoId } = useParams<{ videoId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [content, setContent] = useState<ContentData | null>(null);
  const [creator, setCreator] = useState<CreatorData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { isLiked, isSaved, likesCount, toggleLike, toggleSave } = useContentLikes(videoId || null);
  const { deleteContent } = useContentUpload();

  const isOwner = user?.id === content?.user_id;

  useEffect(() => {
    const loadContent = async () => {
      if (!videoId) return;

      setIsLoading(true);

      // Load content
      const { data: contentData, error } = await supabase
        .from('user_content')
        .select('*')
        .eq('id', videoId)
        .single();

      if (error || !contentData) {
        toast.error('Content not found');
        navigate(-1);
        return;
      }

      setContent(contentData);

      // Load creator
      const { data: creatorData } = await supabase
        .from('profiles')
        .select('user_id, username, display_name, avatar_url')
        .eq('user_id', contentData.user_id)
        .single();

      if (creatorData) {
        setCreator(creatorData);
      }

      // Increment view count
      await supabase
        .from('user_content')
        .update({ views_count: (contentData.views_count || 0) + 1 })
        .eq('id', videoId);

      setIsLoading(false);
    };

    loadContent();
  }, [videoId, navigate]);

  const handleDelete = async () => {
    if (!videoId) return;
    const success = await deleteContent(videoId);
    if (success) {
      navigate(-1);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!content) return null;

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4">
        <Button variant="ghost" size="icon" className="text-white" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-6 h-6" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-white">
              <MoreHorizontal className="w-6 h-6" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isOwner && (
              <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => setShowShare(true)}>
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Media */}
      <div className="relative w-full h-screen flex items-center justify-center bg-black">
        {content.media_type === 'video' ? (
          <video
            src={content.media_url || ''}
            className="max-w-full max-h-full object-contain"
            controls
            autoPlay
            loop
          />
        ) : (
          <img
            src={content.media_url || ''}
            alt={content.title || ''}
            className="max-w-full max-h-full object-contain"
          />
        )}
      </div>

      {/* Actions sidebar */}
      <div className="absolute right-4 bottom-32 flex flex-col items-center gap-6">
        <button onClick={() => navigate(`/u/${creator?.user_id}`)}>
          <Avatar className="w-12 h-12 border-2 border-white">
            <AvatarImage src={creator?.avatar_url || ''} />
            <AvatarFallback>{creator?.display_name?.[0] || 'U'}</AvatarFallback>
          </Avatar>
        </button>

        <button onClick={toggleLike} className="flex flex-col items-center">
          <Heart className={cn('w-8 h-8', isLiked ? 'fill-red-500 text-red-500' : 'text-white')} />
          <span className="text-white text-xs mt-1">{likesCount}</span>
        </button>

        <button onClick={() => setShowComments(true)} className="flex flex-col items-center">
          <MessageCircle className="w-8 h-8 text-white" />
          <span className="text-white text-xs mt-1">{content.comments_count || 0}</span>
        </button>

        <button onClick={toggleSave} className="flex flex-col items-center">
          <Bookmark className={cn('w-8 h-8', isSaved ? 'fill-yellow-500 text-yellow-500' : 'text-white')} />
        </button>

        <button onClick={() => setShowShare(true)} className="flex flex-col items-center">
          <Share2 className="w-8 h-8 text-white" />
        </button>
      </div>

      {/* Bottom info */}
      <div className="absolute bottom-20 left-4 right-20">
        <p className="text-white font-semibold">@{creator?.username || 'user'}</p>
        {content.caption && (
          <p className="text-white/90 text-sm mt-1 line-clamp-3">{content.caption}</p>
        )}
        {content.tags && content.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {content.tags.map(tag => (
              <button
                key={tag}
                onClick={() => navigate(`/tag/${tag}`)}
                className="text-white/80 text-sm hover:text-white"
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Comments Panel */}
      <CommentsPanel
        contentId={videoId || ''}
        isOpen={showComments}
        onClose={() => setShowComments(false)}
      />

      {/* Share Sheet */}
      <ShareSheet
        isOpen={showShare}
        onClose={() => setShowShare(false)}
        title={content.title || 'Check this out!'}
        url={window.location.href}
      />

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Content?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your content.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default VideoDetail;
