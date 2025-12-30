import React, { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { 
  Music, Play, Pause, Plus, Check, TrendingUp, Heart, 
  Zap, Moon, Sun, Sparkles, Volume2, VolumeX,
  Search, Clock, Music2, Waves, Drum
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface AudioTrack {
  id: string;
  name: string;
  artist: string;
  duration: number; // seconds
  bpm: number;
  category: 'trending' | 'energetic' | 'chill' | 'cinematic' | 'dramatic' | 'happy';
  mood: string;
  isPremium: boolean;
  previewUrl?: string;
  beatPoints: number[]; // timestamps in seconds where beats occur
  waveform: number[]; // simplified waveform data for visualization
}

// Sample audio tracks with beat sync data
const audioTracks: AudioTrack[] = [
  // Trending
  { 
    id: 'trending-1', name: 'Viral Energy', artist: 'SoundWave', duration: 30, bpm: 128, 
    category: 'trending', mood: 'Energetic', isPremium: false,
    beatPoints: [0, 0.47, 0.94, 1.41, 1.88, 2.34, 2.81, 3.28, 3.75, 4.22, 4.69, 5.16, 5.63, 6.09, 6.56, 7.03],
    waveform: [0.3, 0.5, 0.8, 1, 0.7, 0.9, 0.6, 0.8, 1, 0.5, 0.7, 0.9, 0.4, 0.6, 0.8, 0.5]
  },
  { 
    id: 'trending-2', name: 'TikTok Wave', artist: 'ViralBeats', duration: 25, bpm: 140, 
    category: 'trending', mood: 'Upbeat', isPremium: false,
    beatPoints: [0, 0.43, 0.86, 1.29, 1.71, 2.14, 2.57, 3.0, 3.43, 3.86, 4.29, 4.71, 5.14, 5.57, 6.0],
    waveform: [0.4, 0.7, 0.5, 0.9, 1, 0.6, 0.8, 0.7, 0.9, 0.5, 0.8, 1, 0.6, 0.7, 0.5, 0.8]
  },
  { 
    id: 'trending-3', name: 'Street Glow', artist: 'NeonDreams', duration: 35, bpm: 95, 
    category: 'trending', mood: 'Cool', isPremium: true,
    beatPoints: [0, 0.63, 1.26, 1.89, 2.53, 3.16, 3.79, 4.42, 5.05, 5.68, 6.32, 6.95, 7.58, 8.21, 8.84],
    waveform: [0.2, 0.4, 0.6, 0.8, 0.5, 0.7, 0.9, 0.6, 0.4, 0.7, 0.5, 0.8, 0.6, 0.4, 0.7, 0.5]
  },
  
  // Energetic
  { 
    id: 'energy-1', name: 'Power Rush', artist: 'BeatMaster', duration: 28, bpm: 150, 
    category: 'energetic', mood: 'Powerful', isPremium: false,
    beatPoints: [0, 0.4, 0.8, 1.2, 1.6, 2.0, 2.4, 2.8, 3.2, 3.6, 4.0, 4.4, 4.8, 5.2, 5.6, 6.0],
    waveform: [0.6, 0.9, 1, 0.8, 0.95, 1, 0.7, 0.9, 1, 0.85, 0.95, 1, 0.8, 0.9, 0.7, 1]
  },
  { 
    id: 'energy-2', name: 'Adrenaline', artist: 'DropZone', duration: 32, bpm: 160, 
    category: 'energetic', mood: 'Intense', isPremium: true,
    beatPoints: [0, 0.375, 0.75, 1.125, 1.5, 1.875, 2.25, 2.625, 3.0, 3.375, 3.75, 4.125, 4.5, 4.875, 5.25],
    waveform: [0.7, 1, 0.85, 0.95, 1, 0.9, 1, 0.8, 0.95, 1, 0.85, 0.9, 1, 0.75, 0.95, 1]
  },
  { 
    id: 'energy-3', name: 'Sports Anthem', artist: 'GameDay', duration: 30, bpm: 135, 
    category: 'energetic', mood: 'Motivating', isPremium: false,
    beatPoints: [0, 0.44, 0.89, 1.33, 1.78, 2.22, 2.67, 3.11, 3.56, 4.0, 4.44, 4.89, 5.33, 5.78, 6.22],
    waveform: [0.5, 0.8, 0.6, 0.9, 1, 0.7, 0.85, 0.9, 1, 0.6, 0.8, 0.95, 0.7, 0.85, 0.9, 1]
  },
  
  // Chill
  { 
    id: 'chill-1', name: 'Sunset Vibes', artist: 'LofiMaster', duration: 40, bpm: 85, 
    category: 'chill', mood: 'Relaxing', isPremium: false,
    beatPoints: [0, 0.71, 1.41, 2.12, 2.82, 3.53, 4.24, 4.94, 5.65, 6.35, 7.06, 7.76, 8.47, 9.18, 9.88],
    waveform: [0.2, 0.3, 0.4, 0.35, 0.45, 0.5, 0.4, 0.35, 0.5, 0.4, 0.3, 0.45, 0.35, 0.4, 0.3, 0.35]
  },
  { 
    id: 'chill-2', name: 'Coffee Shop', artist: 'Mellow', duration: 45, bpm: 75, 
    category: 'chill', mood: 'Cozy', isPremium: true,
    beatPoints: [0, 0.8, 1.6, 2.4, 3.2, 4.0, 4.8, 5.6, 6.4, 7.2, 8.0, 8.8, 9.6, 10.4, 11.2],
    waveform: [0.15, 0.25, 0.35, 0.3, 0.4, 0.35, 0.25, 0.4, 0.3, 0.35, 0.25, 0.4, 0.3, 0.25, 0.35, 0.3]
  },
  
  // Cinematic
  { 
    id: 'cinema-1', name: 'Epic Journey', artist: 'Orchestra', duration: 60, bpm: 100, 
    category: 'cinematic', mood: 'Grand', isPremium: true,
    beatPoints: [0, 0.6, 1.2, 1.8, 2.4, 3.0, 3.6, 4.2, 4.8, 5.4, 6.0, 6.6, 7.2, 7.8, 8.4],
    waveform: [0.3, 0.5, 0.7, 0.6, 0.8, 0.9, 1, 0.8, 0.6, 0.9, 0.7, 0.85, 1, 0.75, 0.65, 0.8]
  },
  { 
    id: 'cinema-2', name: 'Documentary', artist: 'FilmScore', duration: 50, bpm: 90, 
    category: 'cinematic', mood: 'Inspiring', isPremium: false,
    beatPoints: [0, 0.67, 1.33, 2.0, 2.67, 3.33, 4.0, 4.67, 5.33, 6.0, 6.67, 7.33, 8.0, 8.67, 9.33],
    waveform: [0.25, 0.4, 0.55, 0.5, 0.65, 0.75, 0.7, 0.6, 0.8, 0.7, 0.55, 0.7, 0.6, 0.5, 0.65, 0.55]
  },
  
  // Dramatic
  { 
    id: 'drama-1', name: 'Tension Rise', artist: 'DarkTones', duration: 35, bpm: 110, 
    category: 'dramatic', mood: 'Suspenseful', isPremium: true,
    beatPoints: [0, 0.55, 1.09, 1.64, 2.18, 2.73, 3.27, 3.82, 4.36, 4.91, 5.45, 6.0, 6.55, 7.09, 7.64],
    waveform: [0.3, 0.4, 0.5, 0.55, 0.65, 0.7, 0.8, 0.85, 0.9, 0.95, 1, 0.9, 0.85, 0.95, 1, 0.8]
  },
  { 
    id: 'drama-2', name: 'Dark Pulse', artist: 'ShadowBeat', duration: 30, bpm: 120, 
    category: 'dramatic', mood: 'Mysterious', isPremium: false,
    beatPoints: [0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0],
    waveform: [0.4, 0.3, 0.5, 0.6, 0.45, 0.7, 0.55, 0.65, 0.8, 0.5, 0.7, 0.6, 0.75, 0.5, 0.65, 0.55]
  },
  
  // Happy
  { 
    id: 'happy-1', name: 'Good Times', artist: 'SunnyDay', duration: 28, bpm: 125, 
    category: 'happy', mood: 'Joyful', isPremium: false,
    beatPoints: [0, 0.48, 0.96, 1.44, 1.92, 2.4, 2.88, 3.36, 3.84, 4.32, 4.8, 5.28, 5.76, 6.24, 6.72],
    waveform: [0.5, 0.7, 0.8, 0.65, 0.85, 0.9, 0.75, 0.95, 0.8, 0.7, 0.9, 0.85, 0.75, 0.9, 0.8, 0.85]
  },
  { 
    id: 'happy-2', name: 'Celebration', artist: 'PartyMix', duration: 32, bpm: 130, 
    category: 'happy', mood: 'Festive', isPremium: true,
    beatPoints: [0, 0.46, 0.92, 1.38, 1.85, 2.31, 2.77, 3.23, 3.69, 4.15, 4.62, 5.08, 5.54, 6.0, 6.46],
    waveform: [0.6, 0.8, 0.7, 0.9, 1, 0.8, 0.95, 0.85, 1, 0.75, 0.9, 0.95, 0.8, 0.9, 1, 0.85]
  },
];

interface AudioLibraryProps {
  isPremium?: boolean;
  videoDuration: number;
  aiHighlights?: { startTime: number; endTime: number }[];
  onSelectTrack: (track: AudioTrack) => void;
  onSyncBeat: (beatPoints: number[]) => void;
  selectedTrackId?: string;
}

const categories = [
  { id: 'trending', label: 'Trending', icon: <TrendingUp className="w-4 h-4" /> },
  { id: 'energetic', label: 'Energetic', icon: <Zap className="w-4 h-4" /> },
  { id: 'chill', label: 'Chill', icon: <Moon className="w-4 h-4" /> },
  { id: 'cinematic', label: 'Cinematic', icon: <Music2 className="w-4 h-4" /> },
  { id: 'dramatic', label: 'Dramatic', icon: <Waves className="w-4 h-4" /> },
  { id: 'happy', label: 'Happy', icon: <Sun className="w-4 h-4" /> },
];

export const AudioLibrary: React.FC<AudioLibraryProps> = ({
  videoDuration,
  aiHighlights = [],
  onSelectTrack,
  onSyncBeat,
  selectedTrackId,
}) => {
  const isPremium = true; // All features unlocked
  const [activeCategory, setActiveCategory] = useState<string>('trending');
  const [searchQuery, setSearchQuery] = useState('');
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [volume, setVolume] = useState([80]);
  const [showBeatSync, setShowBeatSync] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const filteredTracks = audioTracks.filter(track => {
    const matchesCategory = track.category === activeCategory;
    const matchesSearch = searchQuery === '' || 
      track.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      track.artist.toLowerCase().includes(searchQuery.toLowerCase()) ||
      track.mood.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handlePlayPreview = useCallback((track: AudioTrack) => {
    if (playingTrackId === track.id) {
      setPlayingTrackId(null);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    } else {
      setPlayingTrackId(track.id);
      // In real implementation, this would play the actual audio
      toast.info(`Playing preview: ${track.name}`, {
        description: `${track.bpm} BPM • ${track.mood}`
      });
      // Simulate audio playback with timeout
      setTimeout(() => setPlayingTrackId(null), 5000);
    }
  }, [playingTrackId]);

  const handleSelectTrack = (track: AudioTrack) => {
    onSelectTrack(track);
    toast.success(`Selected: ${track.name}`, {
      description: `${track.bpm} BPM • ${track.duration}s`
    });
  };

  const handleBeatSync = (track: AudioTrack) => {
    // Calculate beat points that align with video highlights
    const syncedBeats = calculateSyncedBeats(track, videoDuration, aiHighlights);
    onSyncBeat(syncedBeats);
    
    toast.success('Beats synced!', {
      description: `${syncedBeats.length} beat points aligned with your video highlights.`
    });
  };

  const calculateSyncedBeats = (
    track: AudioTrack, 
    videoDur: number, 
    highlights: { startTime: number; endTime: number }[]
  ): number[] => {
    // Scale beat points to video duration
    const scaleFactor = videoDur / track.duration;
    const scaledBeats = track.beatPoints.map(bp => bp * scaleFactor);
    
    // Find beats that align with highlight moments
    const highlightStarts = highlights.map(h => h.startTime);
    
    // Add extra emphasis beats at highlight starts
    const syncedBeats = [...scaledBeats];
    highlightStarts.forEach(hs => {
      // Find nearest beat and ensure there's one at highlight start
      const nearestBeatIndex = syncedBeats.findIndex(b => b > hs);
      if (nearestBeatIndex > 0) {
        syncedBeats.splice(nearestBeatIndex, 0, hs);
      }
    });
    
    return syncedBeats.filter(b => b <= videoDur).sort((a, b) => a - b);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search sounds..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 overflow-x-auto pb-2 -mx-1 px-1">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all',
              activeCategory === cat.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted'
            )}
          >
            {cat.icon}
            {cat.label}
          </button>
        ))}
      </div>

      {/* Volume control */}
      <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
        <Volume2 className="w-4 h-4 text-muted-foreground" />
        <Slider
          value={volume}
          onValueChange={setVolume}
          max={100}
          step={1}
          className="flex-1"
        />
        <span className="text-xs text-muted-foreground w-8">{volume[0]}%</span>
      </div>

      {/* Tracks list */}
      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
        {filteredTracks.map((track) => (
          <div
            key={track.id}
            className={cn(
              'relative p-3 rounded-xl transition-all',
              'hover:bg-muted/50',
              selectedTrackId === track.id
                ? 'bg-primary/10 border border-primary/30'
                : 'bg-muted/30 border border-transparent',
              false
            )}
          >
            <div className="flex items-start gap-3">
              {/* Play button */}
              <button
                onClick={() => handlePlayPreview(track)}
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all',
                  playingTrackId === track.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                )}
              >
                {playingTrackId === track.id ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4 ml-0.5" />
                )}
              </button>

              {/* Track info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium text-sm truncate">{track.name}</h4>
                  {selectedTrackId === track.id && (
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                
                {/* Waveform visualization */}
                <div className="flex items-end gap-0.5 h-4 mt-2">
                  {track.waveform.map((level, i) => (
                    <div
                      key={i}
                      className={cn(
                        'w-1.5 rounded-full transition-all',
                        playingTrackId === track.id
                          ? 'bg-primary animate-pulse'
                          : 'bg-muted-foreground/30'
                      )}
                      style={{ height: `${level * 100}%` }}
                    />
                  ))}
                </div>

                {/* Meta info */}
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    <Drum className="w-2.5 h-2.5 mr-1" />
                    {track.bpm} BPM
                  </Badge>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    <Clock className="w-2.5 h-2.5 mr-1" />
                    {formatDuration(track.duration)}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {track.mood}
                  </Badge>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-1">
                <Button
                  size="sm"
                  variant={selectedTrackId === track.id ? "default" : "secondary"}
                  className="h-7 text-xs"
                  onClick={() => handleSelectTrack(track)}
                >
                  {selectedTrackId === track.id ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <Plus className="w-3 h-3" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => handleBeatSync(track)}
                >
                  <Sparkles className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* AI Beat Sync info */}
      <div className="p-3 rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="font-medium text-sm">AI Beat Sync</span>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          Automatically align music beats with your video's highlight moments for professional-quality edits.
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            className="text-xs"
            onClick={() => {
              if (selectedTrackId) {
                const track = audioTracks.find(t => t.id === selectedTrackId);
                if (track) handleBeatSync(track);
              } else {
                toast.error('Select a track first');
              }
            }}
          >
            <Waves className="w-3 h-3 mr-1" />
            Sync Current Track
          </Button>
        </div>
      </div>

      {/* Results count */}
      <p className="text-xs text-muted-foreground text-center">
        {filteredTracks.length} tracks in {categories.find(c => c.id === activeCategory)?.label}
      </p>
    </div>
  );
};

export { audioTracks };
export type { AudioTrack };
