import React, { useState, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Heart, MoreHorizontal, Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface Comment {
  id: string;
  userId: string;
  username: string;
  avatar?: string;
  content: string;
  timestamp: Date;
  likes: number;
  isLiked: boolean;
  replies?: Comment[];
}

interface CommentsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  contentId: string;
  contentType?: string;
}

// Mock comments for demo
const mockComments: Comment[] = [
  {
    id: '1',
    userId: 'user1',
    username: 'creative_alex',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=alex',
    content: 'This is absolutely amazing! 🔥',
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
    likes: 24,
    isLiked: false,
  },
  {
    id: '2',
    userId: 'user2',
    username: 'design_pro',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=design',
    content: 'Love the creativity here. How did you make this?',
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
    likes: 12,
    isLiked: true,
  },
  {
    id: '3',
    userId: 'user3',
    username: 'photo_enthusiast',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=photo',
    content: 'Keep up the great work! Following for more content.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60),
    likes: 8,
    isLiked: false,
  },
  {
    id: '4',
    userId: 'user4',
    username: 'travel_lover',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=travel',
    content: 'Incredible! Where is this location?',
    timestamp: new Date(Date.now() - 1000 * 60 * 120),
    likes: 5,
    isLiked: false,
  },
];

const formatTimeAgo = (date: Date): string => {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString();
};

export const CommentsPanel: React.FC<CommentsPanelProps> = ({
  isOpen,
  onClose,
  contentId,
}) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>(mockComments);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmitComment = useCallback(async () => {
    if (!newComment.trim()) return;
    if (!user) {
      toast.error('Please sign in to comment');
      return;
    }

    setIsSubmitting(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const comment: Comment = {
      id: Date.now().toString(),
      userId: user.id,
      username: user.user_metadata?.username || 'you',
      avatar: user.user_metadata?.avatar_url,
      content: newComment.trim(),
      timestamp: new Date(),
      likes: 0,
      isLiked: false,
    };

    setComments(prev => [comment, ...prev]);
    setNewComment('');
    setIsSubmitting(false);
    toast.success('Comment posted!');
  }, [newComment, user]);

  const handleLikeComment = useCallback((commentId: string) => {
    setComments(prev => prev.map(c => {
      if (c.id === commentId) {
        return {
          ...c,
          isLiked: !c.isLiked,
          likes: c.isLiked ? c.likes - 1 : c.likes + 1,
        };
      }
      return c;
    }));
  }, []);

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl">
        <SheetHeader className="pb-4 border-b border-border">
          <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-2" />
          <SheetTitle className="text-center">
            {comments.length} Comments
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1 h-[calc(100%-140px)] py-4">
          <div className="space-y-4">
            {comments.map(comment => (
              <div key={comment.id} className="flex gap-3 px-1">
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage src={comment.avatar} />
                  <AvatarFallback>{comment.username[0].toUpperCase()}</AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{comment.username}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatTimeAgo(comment.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/90 mt-0.5 break-words">
                    {comment.content}
                  </p>
                  <div className="flex items-center gap-4 mt-1">
                    <button
                      onClick={() => handleLikeComment(comment.id)}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                      <Heart 
                        className={cn(
                          "w-3.5 h-3.5",
                          comment.isLiked && "fill-red-500 text-red-500"
                        )} 
                      />
                      {comment.likes > 0 && comment.likes}
                    </button>
                    <button className="text-xs text-muted-foreground hover:text-foreground">
                      Reply
                    </button>
                  </div>
                </div>

                <button className="text-muted-foreground hover:text-foreground">
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border bg-background">
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.user_metadata?.avatar_url} />
              <AvatarFallback>
                {user?.user_metadata?.username?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 relative">
              <Input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment..."
                className="pr-12 rounded-full bg-muted/50"
                onKeyDown={(e) => e.key === 'Enter' && handleSubmitComment()}
              />
              <Button
                size="icon"
                variant="ghost"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                onClick={handleSubmitComment}
                disabled={!newComment.trim() || isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className={cn(
                    "w-4 h-4",
                    newComment.trim() && "text-primary"
                  )} />
                )}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default CommentsPanel;
