import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Heart,
  MoreHorizontal,
  Send,
  Loader2,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Trash2,
  ArrowUpDown,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  useComments,
  type Comment,
  type CommentSort,
  COMMENT_MAX_LENGTH,
} from '@/hooks/useComments';

const REPLIES_VISIBLE_INITIAL = 2;

interface CommentsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  contentId: string;
  /** Pass 'user_content' or 'promotion' for correct DB semantics */
  contentType?: 'user_content' | 'promotion';
}

/** Render comment content with @mentions highlighted */
function CommentContent({ text }: { text: string }) {
  const parts = text.split(/(@\w+)/g);
  return (
    <p className="text-sm text-foreground/90 mt-0.5 break-words">
      {parts.map((part, i) =>
        part.startsWith('@') ? (
          <span key={i} className="text-primary font-medium">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  );
}

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

interface CommentItemProps {
  comment: Comment;
  onLike: (id: string) => void;
  onReply: (comment: Comment) => void;
  onDelete?: (id: string) => void;
  currentUserId?: string | null;
  isReply: boolean;
  parentUsername?: string;
  depth?: number;
}

const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  onLike,
  onReply,
  onDelete,
  currentUserId,
  isReply,
  parentUsername,
  depth = 0,
}) => {
  const isOwnComment = !!currentUserId && comment.userId === currentUserId;
  const replyCount = comment.replies?.length ?? 0;
  const [repliesExpanded, setRepliesExpanded] = useState(replyCount <= REPLIES_VISIBLE_INITIAL);
  const visibleReplies = comment.replies ?? [];
  const hiddenCount = replyCount - REPLIES_VISIBLE_INITIAL;
  const showExpand = replyCount > REPLIES_VISIBLE_INITIAL && !repliesExpanded;
  const displayReplies = repliesExpanded
    ? visibleReplies
    : visibleReplies.slice(0, REPLIES_VISIBLE_INITIAL);

  return (
    <div
      className={cn(
        isReply && 'mt-3 pl-4 border-l-2 border-muted/50',
        depth > 0 && 'ml-2'
      )}
    >
      <div className="flex gap-3">
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={comment.avatar} />
          <AvatarFallback>{(comment.username || 'U')[0].toUpperCase()}</AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{comment.username}</span>
            {parentUsername && (
              <span className="text-xs text-muted-foreground">
                Replying to{' '}
                <span className="font-medium text-foreground/80">@{parentUsername}</span>
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              {formatTimeAgo(comment.timestamp)}
            </span>
          </div>
          <CommentContent text={comment.content} />
          <div className="flex items-center gap-4 mt-1 flex-wrap">
            <button
              onClick={() => onLike(comment.id)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Heart
                className={cn('w-3.5 h-3.5', comment.isLiked && 'fill-red-500 text-red-500')}
              />
              {comment.likes > 0 && comment.likes}
            </button>
            <button
              onClick={() => onReply(comment)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Reply
              {replyCount > 0 && (
                <span className="flex items-center gap-0.5">
                  <MessageCircle className="w-3 h-3" />
                  {replyCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="text-muted-foreground hover:text-foreground self-start p-1 rounded"
              aria-label="More options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isOwnComment && onDelete && (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(comment.id)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            )}
            {!isOwnComment && (
              <DropdownMenuItem disabled className="text-muted-foreground">
                Options
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {displayReplies.length > 0 && (
        <div className="mt-2 space-y-1">
          {displayReplies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              onLike={onLike}
              onReply={onReply}
              onDelete={onDelete}
              currentUserId={currentUserId}
              isReply
              parentUsername={comment.username}
              depth={depth + 1}
            />
          ))}
        </div>
      )}

      {showExpand && hiddenCount > 0 && (
        <button
          onClick={() => setRepliesExpanded(true)}
          className="flex items-center gap-1 mt-2 ml-11 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className="w-3.5 h-3.5" />
          View {hiddenCount} more repl{hiddenCount === 1 ? 'y' : 'ies'}
        </button>
      )}

      {repliesExpanded && replyCount > REPLIES_VISIBLE_INITIAL && (
        <button
          onClick={() => setRepliesExpanded(false)}
          className="flex items-center gap-1 mt-2 ml-11 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronUp className="w-3.5 h-3.5" />
          Show less
        </button>
      )}
    </div>
  );
};

const SORT_OPTIONS: { value: CommentSort; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'top', label: 'Top' },
  { value: 'oldest', label: 'Oldest' },
];

export const CommentsPanel: React.FC<CommentsPanelProps> = ({
  isOpen,
  onClose,
  contentId,
  contentType = 'user_content',
}) => {
  const { user } = useAuth();
  const {
    comments,
    loading,
    error,
    sortBy,
    setSortBy,
    addComment,
    addReply,
    toggleLike,
    deleteComment,
    refetch,
    totalCount,
  } = useComments({
    contentId: isOpen && contentId ? contentId : null,
    contentType: contentType === 'promotion' ? 'promotion' : 'user_content',
    enableRealtime: true,
  });

  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Comment | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) {
      setReplyingTo(null);
      setNewComment('');
    }
  }, [isOpen]);

  useEffect(() => {
    if (replyingTo) inputRef.current?.focus();
  }, [replyingTo]);

  const handleSubmitComment = useCallback(async () => {
    if (!newComment.trim()) return;
    if (!user) {
      toast.error('Please sign in to comment');
      return;
    }
    if (!contentId) return;

    setIsSubmitting(true);
    try {
      if (replyingTo) {
        await addReply(newComment.trim(), replyingTo.id);
        setNewComment('');
        setReplyingTo(null);
        toast.success('Reply posted!');
      } else {
        await addComment(newComment.trim());
        setNewComment('');
        toast.success('Comment posted!');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to post comment');
    } finally {
      setIsSubmitting(false);
    }
  }, [newComment, user, contentId, replyingTo, addComment, addReply]);

  const handleLikeComment = useCallback(
    (commentId: string) => {
      if (!user) {
        toast.error('Please sign in to like comments');
        return;
      }
      toggleLike(commentId);
    },
    [user, toggleLike]
  );

  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      const ok = await deleteComment(commentId);
      if (ok) toast.success('Comment deleted');
    },
    [deleteComment]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (v.length <= COMMENT_MAX_LENGTH) setNewComment(v);
  };

  const canComment = !!contentId && contentId.trim() !== '';
  const charCount = newComment.length;
  const charNearLimit = charCount >= COMMENT_MAX_LENGTH * 0.9;

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent
        side="bottom"
        className="h-[min(65vh,600px)] max-h-[90vh] rounded-t-3xl flex flex-col"
      >
        <SheetHeader className="pb-4 border-b border-border shrink-0">
          <div className="w-12 h-1 bg-muted rounded-full mx-auto mb-2" />
          <div className="flex items-center justify-between gap-2">
            <SheetTitle className="text-center flex-1">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </span>
              ) : (
                `${totalCount} Comment${totalCount !== 1 ? 's' : ''}`
              )}
            </SheetTitle>
            <div className="flex items-center gap-2">
              <Select value={sortBy} onValueChange={(v) => setSortBy(v as CommentSort)}>
                <SelectTrigger className="w-[100px] h-8 text-xs">
                  <ArrowUpDown className="w-3 h-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => refetch()}
                disabled={loading}
              >
                <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
              </Button>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1 min-h-0 py-4 -mx-6 px-6">
          <div className="space-y-4">
            {!canComment && (
              <p className="text-center py-6 text-sm text-muted-foreground">
                Comments are not available for this content.
              </p>
            )}
            {canComment && error && (
              <div className="text-center py-6 text-sm text-destructive">
                <p>{error}</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
                  Retry
                </Button>
              </div>
            )}
            {canComment && !loading && !error && comments.length === 0 && (
              <p className="text-center py-6 text-sm text-muted-foreground">
                No comments yet. Be the first to comment!
              </p>
            )}
            {canComment &&
              !loading &&
              !error &&
              comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onLike={handleLikeComment}
              onReply={(c) => setReplyingTo(c)}
              onDelete={user ? handleDeleteComment : undefined}
              currentUserId={user?.id}
              isReply={false}
            />
              ))}
          </div>
        </ScrollArea>

        {canComment && (
          <div className="shrink-0 p-4 border-t border-border bg-background pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
            {replyingTo && (
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-xs text-muted-foreground">
                  Replying to{' '}
                  <span className="font-medium text-foreground">@{replyingTo.username}</span>
                </span>
                <button
                  onClick={() => setReplyingTo(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            )}
            <div className="flex gap-3">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={user?.user_metadata?.avatar_url} />
                <AvatarFallback>
                  {user?.user_metadata?.username?.[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 relative min-w-0">
                <Input
                  ref={inputRef}
                  value={newComment}
                  onChange={handleInputChange}
                  placeholder={
                    replyingTo ? `Reply to @${replyingTo.username}...` : 'Add a comment...'
                  }
                  className="pr-12 rounded-full bg-muted/50"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSubmitComment();
                    if (e.key === 'Escape') setReplyingTo(null);
                  }}
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
                    <Send className={cn('w-4 h-4', newComment.trim() && 'text-primary')} />
                  )}
                </Button>
                {charCount > 0 && (
                  <span
                    className={cn(
                      'absolute -bottom-5 right-0 text-[10px]',
                      charNearLimit ? 'text-amber-600' : 'text-muted-foreground'
                    )}
                  >
                    {charCount}/{COMMENT_MAX_LENGTH}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default CommentsPanel;
