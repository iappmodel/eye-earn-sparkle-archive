import React, { useState, useRef } from 'react';
import { Music, Play, Pause, Plus, TrendingUp, Clock, Heart, Search, Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Sound {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  duration: string;
  usageCount: number;
  audioUrl?: string;
  isTrending?: boolean;
  isOriginal?: boolean;
  isSaved?: boolean;
}

const mockSounds: Sound[] = [
  {
    id: '1',
    title: 'Viral Beat 2024',
    artist: 'DJ Producer',
    coverUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=200&h=200&fit=crop',
    duration: '0:30',
    usageCount: 2400000,
    isTrending: true,
  },
  {
    id: '2',
    title: 'Summer Vibes',
    artist: 'Chill Beats',
    coverUrl: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=200&h=200&fit=crop',
    duration: '0:45',
    usageCount: 1800000,
    isTrending: true,
  },
  {
    id: '3',
    title: 'Lo-Fi Dreams',
    artist: 'Night Owl',
    coverUrl: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=200&h=200&fit=crop',
    duration: '1:00',
    usageCount: 950000,
    isOriginal: true,
  },
  {
    id: '4',
    title: 'Epic Cinematic',
    artist: 'Orchestra Pro',
    coverUrl: 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=200&h=200&fit=crop',
    duration: '0:20',
    usageCount: 670000,
  },
  {
    id: '5',
    title: 'Retro Wave',
    artist: 'Synth Master',
    coverUrl: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&h=200&fit=crop',
    duration: '0:35',
    usageCount: 420000,
    isSaved: true,
  },
];

interface SoundLibraryProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSound?: (sound: Sound) => void;
}

export const SoundLibrary: React.FC<SoundLibraryProps> = ({ isOpen, onClose, onSelectSound }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [savedSounds, setSavedSounds] = useState<Set<string>>(new Set(['5']));
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const formatCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(0)}K`;
    return count.toString();
  };

  const togglePlay = (soundId: string) => {
    if (playingId === soundId) {
      setPlayingId(null);
    } else {
      setPlayingId(soundId);
    }
  };

  const toggleSave = (soundId: string) => {
    setSavedSounds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(soundId)) {
        newSet.delete(soundId);
        toast.info('Removed from saved sounds');
      } else {
        newSet.add(soundId);
        toast.success('Saved to your sounds');
      }
      return newSet;
    });
  };

  const handleSelectSound = (sound: Sound) => {
    onSelectSound?.(sound);
    toast.success(`Selected: ${sound.title}`);
    onClose();
  };

  const filteredSounds = mockSounds.filter(sound =>
    sound.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    sound.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background">
      {/* Header */}
      <div className="sticky top-0 bg-background border-b border-border p-4 space-y-4 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="w-5 h-5 text-primary" />
            <h2 className="font-bold text-lg">Sounds</h2>
          </div>
          <Button variant="ghost" onClick={onClose}>Done</Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search sounds..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Tabs defaultValue="trending" className="flex-1">
        <TabsList className="w-full justify-start px-4 pt-2 bg-transparent">
          <TabsTrigger value="trending" className="gap-1">
            <TrendingUp className="w-4 h-4" />
            Trending
          </TabsTrigger>
          <TabsTrigger value="saved" className="gap-1">
            <Bookmark className="w-4 h-4" />
            Saved
          </TabsTrigger>
          <TabsTrigger value="recent" className="gap-1">
            <Clock className="w-4 h-4" />
            Recent
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trending" className="p-4 space-y-3">
          {filteredSounds.map((sound) => (
            <SoundItem
              key={sound.id}
              sound={sound}
              isPlaying={playingId === sound.id}
              isSaved={savedSounds.has(sound.id)}
              onTogglePlay={() => togglePlay(sound.id)}
              onToggleSave={() => toggleSave(sound.id)}
              onSelect={() => handleSelectSound(sound)}
              formatCount={formatCount}
            />
          ))}
        </TabsContent>

        <TabsContent value="saved" className="p-4 space-y-3">
          {filteredSounds.filter(s => savedSounds.has(s.id)).map((sound) => (
            <SoundItem
              key={sound.id}
              sound={sound}
              isPlaying={playingId === sound.id}
              isSaved={true}
              onTogglePlay={() => togglePlay(sound.id)}
              onToggleSave={() => toggleSave(sound.id)}
              onSelect={() => handleSelectSound(sound)}
              formatCount={formatCount}
            />
          ))}
        </TabsContent>

        <TabsContent value="recent" className="p-4">
          <div className="text-center text-muted-foreground py-8">
            <Clock className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No recent sounds</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

interface SoundItemProps {
  sound: Sound;
  isPlaying: boolean;
  isSaved: boolean;
  onTogglePlay: () => void;
  onToggleSave: () => void;
  onSelect: () => void;
  formatCount: (count: number) => string;
}

const SoundItem: React.FC<SoundItemProps> = ({
  sound,
  isPlaying,
  isSaved,
  onTogglePlay,
  onToggleSave,
  onSelect,
  formatCount,
}) => (
  <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
    {/* Cover */}
    <button
      onClick={onTogglePlay}
      className="relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0"
    >
      <img src={sound.coverUrl} alt={sound.title} className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
        {isPlaying ? (
          <Pause className="w-6 h-6 text-white" fill="white" />
        ) : (
          <Play className="w-6 h-6 text-white" fill="white" />
        )}
      </div>
    </button>

    {/* Info */}
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <h4 className="font-medium text-sm truncate">{sound.title}</h4>
        {sound.isTrending && (
          <Badge variant="secondary" className="text-[10px] px-1">
            <TrendingUp className="w-3 h-3 mr-0.5" />
            Trending
          </Badge>
        )}
        {sound.isOriginal && (
          <Badge variant="outline" className="text-[10px] px-1">Original</Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground truncate">{sound.artist}</p>
      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
        <span>{sound.duration}</span>
        <span>•</span>
        <span>{formatCount(sound.usageCount)} videos</span>
      </div>
    </div>

    {/* Actions */}
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleSave}
        className={cn(isSaved && "text-red-500")}
      >
        <Heart className={cn("w-5 h-5", isSaved && "fill-current")} />
      </Button>
      <Button size="sm" onClick={onSelect} className="gap-1">
        <Plus className="w-4 h-4" />
        Use
      </Button>
    </div>
  </div>
);
