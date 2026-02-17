import React, { useState, useEffect } from 'react';
import { X, Camera, Mic, MicOff, Video, VideoOff, Radio, Users, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { createStream, endStream } from '@/services/live.service';
import { supabase } from '@/integrations/supabase/client';

interface GoLiveScreenProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GoLiveScreen: React.FC<GoLiveScreenProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [isLive, setIsLive] = useState(false);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [viewerCount, setViewerCount] = useState(0);
  const [allowComments, setAllowComments] = useState(true);
  const [allowGifts, setAllowGifts] = useState(true);

  // Realtime viewer count while live
  useEffect(() => {
    if (!streamId || !isLive) return;
    const channel = supabase
      .channel(`go-live-viewer-count:${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'live_streams',
          filter: `id=eq.${streamId}`,
        },
        (payload: { new: { viewer_count: number } }) => {
          setViewerCount(payload.new.viewer_count);
        }
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  }, [streamId, isLive]);

  const handleGoLive = async () => {
    if (!title.trim()) {
      toast.error('Please add a title for your stream');
      return;
    }
    if (!user?.id) {
      toast.error('Sign in to go live');
      return;
    }
    setIsStarting(true);
    const { data, error } = await createStream(user.id, {
      title: title.trim(),
      allowComments,
      allowGifts,
    });
    setIsStarting(false);
    if (error) {
      toast.error(error.message || 'Failed to start stream');
      return;
    }
    if (data) {
      setStreamId(data.id);
      setViewerCount(data.viewer_count);
      setIsLive(true);
      toast.success('You are now live!');
    }
  };

  const handleEndStream = async () => {
    if (!streamId || !user?.id) {
      setIsLive(false);
      setStreamId(null);
      setViewerCount(0);
      onClose();
      return;
    }
    setIsEnding(true);
    const { error } = await endStream(streamId, user.id);
    setIsEnding(false);
    setIsLive(false);
    setStreamId(null);
    setViewerCount(0);
    if (error) toast.error(error.message || 'Failed to end stream');
    else toast.info('Stream ended');
    onClose();
  };

  const handleClose = () => {
    if (isLive && streamId && user?.id) {
      handleEndStream();
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black">
      {/* Camera Preview */}
      <div className="absolute inset-0 bg-gradient-to-b from-muted to-background flex items-center justify-center">
        {isCameraOn ? (
          <div className="text-center text-muted-foreground">
            <Camera className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>Camera preview would appear here</p>
          </div>
        ) : (
          <div className="text-center text-muted-foreground">
            <VideoOff className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>Camera is off</p>
          </div>
        )}
      </div>

      {/* Header */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
        <Button variant="ghost" size="icon" onClick={handleClose} className="text-white bg-black/50">
          <X className="w-6 h-6" />
        </Button>
        
        {isLive && (
          <div className="flex items-center gap-4">
            <Badge variant="destructive" className="flex items-center gap-1">
              <Radio className="w-3 h-3 animate-pulse" />
              LIVE
            </Badge>
            <Badge variant="secondary" className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {viewerCount}
            </Badge>
          </div>
        )}

        <Button variant="ghost" size="icon" className="text-white bg-black/50">
          <Settings className="w-5 h-5" />
        </Button>
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent z-10">
        {!isLive ? (
          <div className="space-y-4">
            <Input
              placeholder="Add a title for your stream..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-white/10 border-white/20 text-white placeholder:text-white/50"
            />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="comments" className="text-white text-sm">Comments</Label>
                <Switch
                  id="comments"
                  checked={allowComments}
                  onCheckedChange={setAllowComments}
                />
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="gifts" className="text-white text-sm">Gifts</Label>
                <Switch
                  id="gifts"
                  checked={allowGifts}
                  onCheckedChange={setAllowGifts}
                />
              </div>
            </div>

            <div className="flex items-center justify-center gap-6">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMicOn(!isMicOn)}
                className={`rounded-full w-14 h-14 ${isMicOn ? 'bg-white/20' : 'bg-red-500/50'}`}
              >
                {isMicOn ? <Mic className="w-6 h-6 text-white" /> : <MicOff className="w-6 h-6 text-white" />}
              </Button>

              <Button
                onClick={handleGoLive}
                disabled={!user?.id || isStarting}
                className="rounded-full w-20 h-20 bg-red-500 hover:bg-red-600"
              >
                <Radio className="w-8 h-8" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsCameraOn(!isCameraOn)}
                className={`rounded-full w-14 h-14 ${isCameraOn ? 'bg-white/20' : 'bg-red-500/50'}`}
              >
                {isCameraOn ? <Video className="w-6 h-6 text-white" /> : <VideoOff className="w-6 h-6 text-white" />}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMicOn(!isMicOn)}
              className={`rounded-full w-14 h-14 ${isMicOn ? 'bg-white/20' : 'bg-red-500/50'}`}
            >
              {isMicOn ? <Mic className="w-6 h-6 text-white" /> : <MicOff className="w-6 h-6 text-white" />}
            </Button>

            <Button
              onClick={handleEndStream}
              disabled={isEnding}
              variant="destructive"
              className="rounded-full px-8 py-6"
            >
              {isEnding ? 'Ending…' : 'End Stream'}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsCameraOn(!isCameraOn)}
              className={`rounded-full w-14 h-14 ${isCameraOn ? 'bg-white/20' : 'bg-red-500/50'}`}
            >
              {isCameraOn ? <Video className="w-6 h-6 text-white" /> : <VideoOff className="w-6 h-6 text-white" />}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
