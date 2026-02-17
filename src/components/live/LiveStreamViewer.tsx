import React, { useState, useEffect } from 'react';
import { X, Heart, MessageCircle, Share2, Gift, Users, Radio, Sparkles } from 'lucide-react';
import { useFollow } from '@/hooks/useFollow';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useLiveStreamComments } from '@/hooks/useLiveStreamComments';
import { useLiveStreamViewer } from '@/hooks/useLiveStreamViewer';
import { supabase } from '@/integrations/supabase/client';
import type { LiveStreamUI } from './types';

interface LiveStreamViewerProps {
  stream: LiveStreamUI;
  onClose: () => void;
}

export const LiveStreamViewer: React.FC<LiveStreamViewerProps> = ({ stream, onClose }) => {
  const [message, setMessage] = useState('');
  const [viewerCount, setViewerCount] = useState(stream.viewerCount);
  const { user } = useAuth();
  const follow = useFollow({ creatorId: stream.hostId });

  useLiveStreamViewer(stream.id, user?.id, true);

  const {
    comments: commentsRaw,
    loading: commentsLoading,
    sending,
    sendComment,
  } = useLiveStreamComments(stream.id, user?.id);

  const comments = commentsRaw.map((c) => ({
    id: c.id,
    userId: c.user_id,
    username: c.username ?? 'User',
    avatarUrl: c.avatar_url ?? undefined,
    message: c.message,
    isGift: c.is_gift,
    giftAmount: c.gift_amount ?? undefined,
  }));

  // Realtime viewer count for this stream
  useEffect(() => {
    const channel = supabase
      .channel(`live-stream-viewer-count:${stream.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'live_streams',
          filter: `id=eq.${stream.id}`,
        },
        (payload: { new: { viewer_count: number } }) => {
          setViewerCount(payload.new.viewer_count);
        }
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [stream.id]);

  const handleSendMessage = () => {
    if (!message.trim()) return;
    if (!user?.id) return;
    sendComment(message);
    setMessage('');
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black">
      {/* Video Background */}
      <div className="absolute inset-0">
        <img
          src={stream.thumbnailUrl}
          alt={stream.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/80" />
      </div>

      {/* Header */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <Avatar className="w-12 h-12 border-2 border-rose-500">
            <AvatarImage src={stream.hostAvatarUrl} />
            <AvatarFallback>{stream.hostUsername.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold">{stream.hostUsername}</span>
              <Badge variant="destructive" className="flex items-center gap-1 text-xs">
                <Radio className="w-3 h-3 animate-pulse" />
                LIVE
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-white/70 text-sm">
              <Users className="w-4 h-4" />
              <span>{viewerCount.toLocaleString()} watching</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={follow.isFollowing ? "secondary" : "default"}
            size="sm"
            onClick={() => follow.toggleFollow(stream.hostId)}
            disabled={follow.isLoading}
          >
            {follow.isFollowing ? 'Following' : 'Follow'}
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white">
            <X className="w-6 h-6" />
          </Button>
        </div>
      </div>

      {/* Stream Title */}
      <div className="absolute top-24 left-4 right-4 z-10">
        <h2 className="text-white text-lg font-semibold">{stream.title}</h2>
      </div>

      {/* Comments */}
      <div className="absolute bottom-32 left-4 right-20 max-h-[40vh] overflow-y-auto z-10 space-y-2">
        {commentsLoading && comments.length === 0 && (
          <p className="text-white/60 text-sm">Loading comments...</p>
        )}
        {comments.map((comment) => (
          <div
            key={comment.id}
            className={cn(
              "flex items-start gap-2 p-2 rounded-lg",
              comment.isGift ? "bg-amber-500/30" : "bg-black/30"
            )}
          >
            <Avatar className="w-8 h-8">
              <AvatarImage src={comment.avatarUrl} />
              <AvatarFallback>{comment.username.slice(0, 1)}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white text-sm font-medium">{comment.username}</span>
                {comment.isGift && (
                  <span className="flex items-center gap-1 text-amber-400 text-xs">
                    <Gift className="w-3 h-3" />
                    {comment.giftAmount}
                  </span>
                )}
              </div>
              <p className="text-white/80 text-sm">{comment.message}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Side Actions */}
      <div className="absolute right-4 bottom-32 flex flex-col items-center gap-4 z-10">
        <Button variant="ghost" size="icon" className="text-white bg-white/10 rounded-full">
          <Heart className="w-6 h-6" />
        </Button>
        <Button variant="ghost" size="icon" className="text-white bg-white/10 rounded-full">
          <MessageCircle className="w-6 h-6" />
        </Button>
        <Button variant="ghost" size="icon" className="text-white bg-white/10 rounded-full">
          <Share2 className="w-6 h-6" />
        </Button>
        <Button variant="ghost" size="icon" className="text-amber-400 bg-amber-500/20 rounded-full">
          <Gift className="w-6 h-6" />
        </Button>
      </div>

      {/* Input Bar */}
      <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3 z-10">
        <Input
          placeholder={user?.id ? 'Say something...' : 'Sign in to comment'}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/50"
          disabled={!user?.id || sending}
        />
        <Button
          onClick={handleSendMessage}
          size="icon"
          className="bg-primary"
          disabled={!user?.id || sending || !message.trim()}
        >
          <Sparkles className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
};
