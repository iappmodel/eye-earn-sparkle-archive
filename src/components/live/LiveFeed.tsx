import React, { useState } from 'react';
import { Radio, Users, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LiveStreamViewer } from './LiveStreamViewer';
import { GoLiveScreen } from './GoLiveScreen';

interface LiveStream {
  id: string;
  hostId: string;
  hostUsername: string;
  hostAvatarUrl?: string;
  title: string;
  viewerCount: number;
  thumbnailUrl: string;
  isLive: boolean;
}

const mockLiveStreams: LiveStream[] = [
  {
    id: '1',
    hostId: 'h1',
    hostUsername: 'gaming_pro',
    hostAvatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop',
    title: 'Late night gaming session 🎮',
    viewerCount: 1234,
    thumbnailUrl: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&h=600&fit=crop',
    isLive: true,
  },
  {
    id: '2',
    hostId: 'h2',
    hostUsername: 'chef_maria',
    hostAvatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop',
    title: 'Cooking Italian pasta from scratch',
    viewerCount: 856,
    thumbnailUrl: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&h=600&fit=crop',
    isLive: true,
  },
  {
    id: '3',
    hostId: 'h3',
    hostUsername: 'fitness_coach',
    hostAvatarUrl: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&h=150&fit=crop',
    title: 'Morning workout - Join me! 💪',
    viewerCount: 2341,
    thumbnailUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&h=600&fit=crop',
    isLive: true,
  },
];

export const LiveFeed: React.FC = () => {
  const [selectedStream, setSelectedStream] = useState<LiveStream | null>(null);
  const [showGoLive, setShowGoLive] = useState(false);

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

        {/* Live Streams Grid */}
        <div className="grid grid-cols-2 gap-3">
          {mockLiveStreams.map((stream) => (
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
          ))}
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
