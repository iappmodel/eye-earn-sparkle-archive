import React, { useState } from 'react';
import { Radio, Users, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LiveStreamViewer } from './LiveStreamViewer';
import { GoLiveScreen } from './GoLiveScreen';
import { useLiveStreams } from '@/hooks/useLiveStreams';
import type { LiveStreamWithHost } from '@/services/live.service';
import type { LiveStreamUI } from './types';

export type { LiveStreamUI } from './types';

const DEFAULT_THUMB = 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&h=600&fit=crop';

function toStreamUI(row: LiveStreamWithHost): LiveStreamUI {
  return {
    id: row.id,
    hostId: row.host_id,
    hostUsername: row.host_username ?? 'User',
    hostAvatarUrl: row.host_avatar_url ?? undefined,
    title: row.title,
    viewerCount: row.viewer_count,
    thumbnailUrl: row.thumbnail_url ?? DEFAULT_THUMB,
    isLive: row.status === 'live',
  };
}

export const LiveFeed: React.FC = () => {
  const [selectedStream, setSelectedStream] = useState<LiveStreamUI | null>(null);
  const [showGoLive, setShowGoLive] = useState(false);
  const { streams, loading, error } = useLiveStreams();
  const streamsUI = streams.map(toStreamUI);

  return (
    <>
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-red-500" />
            <h2 className="font-bold text-lg">Live Now</h2>
          </div>
          <Button onClick={() => setShowGoLive(true)} size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            Go Live
          </Button>
        </div>

        {error && (
          <p className="text-sm text-destructive">Failed to load live streams. Try again.</p>
        )}

        {/* Live Streams Grid */}
        <div className="grid grid-cols-2 gap-3">
          {loading ? (
            <p className="col-span-2 text-muted-foreground text-sm">Loading...</p>
          ) : streamsUI.length === 0 ? (
            <p className="col-span-2 text-muted-foreground text-sm">No one is live right now. Be the first to go live!</p>
          ) : (
          streamsUI.map((stream) => (
            <button
              key={stream.id}
              onClick={() => setSelectedStream(stream)}
              className="relative rounded-xl overflow-hidden aspect-[4/5] group"
            >
              <img
                src={stream.thumbnailUrl}
                alt={stream.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/60" />
              
              {/* Live Badge */}
              <Badge variant="destructive" className="absolute top-2 left-2 flex items-center gap-1 text-xs">
                <Radio className="w-3 h-3 animate-pulse" />
                LIVE
              </Badge>

              {/* Viewer Count */}
              <div className="absolute top-2 right-2 flex items-center gap-1 text-white text-xs bg-black/50 px-2 py-1 rounded-full">
                <Users className="w-3 h-3" />
                {stream.viewerCount.toLocaleString()}
              </div>

              {/* Host Info */}
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Avatar className="w-6 h-6 border border-white">
                    <AvatarImage src={stream.hostAvatarUrl} />
                    <AvatarFallback>{stream.hostUsername.slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <span className="text-white text-sm font-medium">{stream.hostUsername}</span>
                </div>
                <p className="text-white/80 text-xs line-clamp-2">{stream.title}</p>
              </div>
            </button>
          ))
          )}
        </div>
      </div>

      {/* Stream Viewer */}
      {selectedStream && (
        <LiveStreamViewer
          stream={selectedStream}
          onClose={() => setSelectedStream(null)}
        />
      )}

      {/* Go Live Screen */}
      <GoLiveScreen
        isOpen={showGoLive}
        onClose={() => setShowGoLive(false)}
      />
    </>
  );
};
