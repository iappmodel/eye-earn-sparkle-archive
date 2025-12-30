import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Play, Pause, Music, TrendingUp, Clock, Heart, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface Sound {
  id: string;
  title: string;
  artist: string;
  duration: number;
  coverUrl: string;
  usageCount: number;
  isOriginal: boolean;
  category: string;
}

// Mock data - would come from Supabase in production
const mockSounds: Sound[] = [
  { id: '1', title: 'Viral Beat 2024', artist: 'TrendMaster', duration: 30, coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=100&h=100&fit=crop', usageCount: 125000, isOriginal: false, category: 'trending' },
  { id: '2', title: 'Lo-Fi Chill', artist: 'ChillBeats', duration: 45, coverUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=100&h=100&fit=crop', usageCount: 89000, isOriginal: false, category: 'chill' },
  { id: '3', title: 'Epic Drop', artist: 'BassKing', duration: 25, coverUrl: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=100&h=100&fit=crop', usageCount: 67000, isOriginal: false, category: 'trending' },
  { id: '4', title: 'Acoustic Vibes', artist: 'MelodyMaker', duration: 60, coverUrl: 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=100&h=100&fit=crop', usageCount: 45000, isOriginal: false, category: 'acoustic' },
  { id: '5', title: 'Dance Floor', artist: 'DJ Pulse', duration: 35, coverUrl: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=100&h=100&fit=crop', usageCount: 92000, isOriginal: false, category: 'dance' },
  { id: '6', title: 'My Original Song', artist: 'You', duration: 40, coverUrl: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=100&h=100&fit=crop', usageCount: 150, isOriginal: true, category: 'original' },
];

const categories = [
  { id: 'trending', label: 'Trending', icon: TrendingUp },
  { id: 'recent', label: 'Recent', icon: Clock },
  { id: 'favorites', label: 'Favorites', icon: Heart },
  { id: 'original', label: 'My Sounds', icon: Music },
];

const Sounds = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('trending');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [sounds, setSounds] = useState<Sound[]>(mockSounds);

  const filteredSounds = sounds.filter(sound => {
    const matchesSearch = sound.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sound.artist.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === 'original') {
      return matchesSearch && sound.isOriginal;
    }
    if (activeTab === 'favorites') {
      return matchesSearch; // Would filter by user favorites
    }
    return matchesSearch;
  });

  const handlePlayPause = (id: string) => {
    setPlayingId(playingId === id ? null : id);
  };

  const handleUseSound = (sound: Sound) => {
    navigate('/create', { state: { sound } });
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold flex-1">Sounds</h1>
          <Button size="sm" onClick={() => navigate('/create')}>
            <Plus className="w-4 h-4 mr-1" />
            Upload
          </Button>
        </div>

        {/* Search */}
        <div className="px-4 pb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sounds..."
              className="pl-10"
            />
          </div>
        </div>

        {/* Category Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start px-4 gap-2 h-auto py-2 bg-transparent">
            {categories.map(cat => (
              <TabsTrigger
                key={cat.id}
                value={cat.id}
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-full px-4"
              >
                <cat.icon className="w-4 h-4 mr-1.5" />
                {cat.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Sound List */}
      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="p-4 space-y-2">
          {filteredSounds.length === 0 ? (
            <div className="text-center py-12">
              <Music className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No sounds found</p>
            </div>
          ) : (
            filteredSounds.map(sound => (
              <div
                key={sound.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors"
              >
                {/* Cover & Play */}
                <button
                  onClick={() => handlePlayPause(sound.id)}
                  className="relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 group"
                >
                  <img
                    src={sound.coverUrl}
                    alt={sound.title}
                    className="w-full h-full object-cover"
                  />
                  <div className={cn(
                    "absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity",
                    playingId === sound.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  )}>
                    {playingId === sound.id ? (
                      <Pause className="w-6 h-6 text-white" />
                    ) : (
                      <Play className="w-6 h-6 text-white" />
                    )}
                  </div>
                  {playingId === sound.id && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary/30">
                      <div className="h-full bg-primary animate-pulse" style={{ width: '60%' }} />
                    </div>
                  )}
                </button>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium truncate">{sound.title}</h3>
                    {sound.isOriginal && (
                      <Badge variant="secondary" className="text-xs">Original</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground truncate">{sound.artist}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                    <span>{formatDuration(sound.duration)}</span>
                    <span>•</span>
                    <span>{formatCount(sound.usageCount)} videos</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Heart className="w-4 h-4" />
                  </Button>
                  <Button size="sm" onClick={() => handleUseSound(sound)}>
                    Use
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default Sounds;
