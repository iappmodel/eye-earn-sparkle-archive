import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { 
  Wand2, Music, Volume2, Play, Pause, Download, Plus, 
  Sparkles, RefreshCw, Clock, Zap, Heart, Film, Drum,
  Wind, Droplets, Flame, Bird, Car, Bell, Laugh
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface GeneratedAudio {
  id: string;
  type: 'sfx' | 'music';
  prompt: string;
  audioUrl: string;
  duration: number;
  createdAt: Date;
}

interface SFXPreset {
  id: string;
  name: string;
  prompt: string;
  icon: React.ReactNode;
  category: 'nature' | 'urban' | 'action' | 'ambient' | 'comedy';
}

interface MusicPreset {
  id: string;
  name: string;
  prompt: string;
  icon: React.ReactNode;
  mood: string;
}

const sfxPresets: SFXPreset[] = [
  { id: 'whoosh', name: 'Whoosh', prompt: 'Quick swoosh transition sound effect', icon: <Wind className="w-4 h-4" />, category: 'action' },
  { id: 'pop', name: 'Pop', prompt: 'Satisfying pop bubble burst sound', icon: <Sparkles className="w-4 h-4" />, category: 'action' },
  { id: 'rain', name: 'Rain', prompt: 'Gentle rain falling on window', icon: <Droplets className="w-4 h-4" />, category: 'nature' },
  { id: 'fire', name: 'Fire Crackle', prompt: 'Cozy fireplace crackling flames', icon: <Flame className="w-4 h-4" />, category: 'nature' },
  { id: 'birds', name: 'Birds', prompt: 'Morning birds chirping in forest', icon: <Bird className="w-4 h-4" />, category: 'nature' },
  { id: 'traffic', name: 'Traffic', prompt: 'City traffic ambient street sounds', icon: <Car className="w-4 h-4" />, category: 'urban' },
  { id: 'notification', name: 'Notification', prompt: 'Pleasant notification ding bell sound', icon: <Bell className="w-4 h-4" />, category: 'ambient' },
  { id: 'laugh', name: 'Laugh Track', prompt: 'Audience laughter sitcom comedy', icon: <Laugh className="w-4 h-4" />, category: 'comedy' },
  { id: 'impact', name: 'Impact', prompt: 'Deep bass impact hit cinematic', icon: <Zap className="w-4 h-4" />, category: 'action' },
  { id: 'heartbeat', name: 'Heartbeat', prompt: 'Dramatic heartbeat pulse tension', icon: <Heart className="w-4 h-4" />, category: 'action' },
];

const musicPresets: MusicPreset[] = [
  { id: 'upbeat', name: 'Upbeat Pop', prompt: 'Upbeat positive pop music with catchy melody, energetic drums, happy vibes', icon: <Zap className="w-4 h-4" />, mood: 'Energetic' },
  { id: 'lofi', name: 'Lo-Fi Chill', prompt: 'Relaxing lo-fi hip hop beats, soft piano, vinyl crackle, study music', icon: <Music className="w-4 h-4" />, mood: 'Relaxing' },
  { id: 'cinematic', name: 'Cinematic', prompt: 'Epic cinematic orchestral music, dramatic strings, emotional crescendo', icon: <Film className="w-4 h-4" />, mood: 'Dramatic' },
  { id: 'electronic', name: 'Electronic', prompt: 'Modern electronic dance music, synth bass, punchy drums, festival vibes', icon: <Drum className="w-4 h-4" />, mood: 'Party' },
  { id: 'romantic', name: 'Romantic', prompt: 'Romantic acoustic guitar, soft piano, warm strings, love song instrumental', icon: <Heart className="w-4 h-4" />, mood: 'Romantic' },
  { id: 'action', name: 'Action', prompt: 'Intense action trailer music, powerful percussion, epic brass, adrenaline', icon: <Flame className="w-4 h-4" />, mood: 'Intense' },
];

interface AISoundGeneratorProps {
  onAddToTimeline: (audio: GeneratedAudio) => void;
}

export const AISoundGenerator: React.FC<AISoundGeneratorProps> = ({
  onAddToTimeline,
}) => {
  const [activeTab, setActiveTab] = useState<'sfx' | 'music'>('sfx');
  const [sfxPrompt, setSfxPrompt] = useState('');
  const [musicPrompt, setMusicPrompt] = useState('');
  const [sfxDuration, setSfxDuration] = useState([5]);
  const [musicDuration, setMusicDuration] = useState([30]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedAudios, setGeneratedAudios] = useState<GeneratedAudio[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const handleGenerateSFX = async (prompt: string, duration?: number) => {
    if (!prompt.trim()) {
      toast.error('Please enter a description for the sound effect');
      return;
    }

    setIsGenerating(true);
    toast.info('Generating sound effect...', { description: 'This may take a few seconds.' });

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-sfx`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ 
            prompt, 
            duration: duration || sfxDuration[0] 
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to generate sound effect');
      }

      const audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
      
      const newAudio: GeneratedAudio = {
        id: `sfx-${Date.now()}`,
        type: 'sfx',
        prompt,
        audioUrl,
        duration: data.duration || sfxDuration[0],
        createdAt: new Date(),
      };

      setGeneratedAudios(prev => [newAudio, ...prev]);
      setSfxPrompt('');
      toast.success('Sound effect generated!');
    } catch (error) {
      console.error('SFX generation error:', error);
      toast.error('Failed to generate sound effect', {
        description: error instanceof Error ? error.message : 'Please try again'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateMusic = async (prompt: string, duration?: number) => {
    if (!prompt.trim()) {
      toast.error('Please enter a description for the music');
      return;
    }

    setIsGenerating(true);
    toast.info('Generating music track...', { description: 'This may take up to 30 seconds.' });

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-music`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ 
            prompt, 
            duration: duration || musicDuration[0] 
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to generate music');
      }

      const audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
      
      const newAudio: GeneratedAudio = {
        id: `music-${Date.now()}`,
        type: 'music',
        prompt,
        audioUrl,
        duration: data.duration || musicDuration[0],
        createdAt: new Date(),
      };

      setGeneratedAudios(prev => [newAudio, ...prev]);
      setMusicPrompt('');
      toast.success('Music track generated!');
    } catch (error) {
      console.error('Music generation error:', error);
      toast.error('Failed to generate music', {
        description: error instanceof Error ? error.message : 'Please try again'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePlayPause = (audio: GeneratedAudio) => {
    if (playingId === audio.id) {
      audioRef.current?.pause();
      setPlayingId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = new Audio(audio.audioUrl);
      audioRef.current.play();
      audioRef.current.onended = () => setPlayingId(null);
      setPlayingId(audio.id);
    }
  };

  const handleDownload = (audio: GeneratedAudio) => {
    const link = document.createElement('a');
    link.href = audio.audioUrl;
    link.download = `${audio.type}-${audio.id}.mp3`;
    link.click();
    toast.success('Downloaded!');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
          <Wand2 className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-sm">AI Sound Generator</h3>
          <p className="text-xs text-muted-foreground">Powered by ElevenLabs</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'sfx' | 'music')}>
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="sfx" className="flex items-center gap-1.5">
            <Volume2 className="w-4 h-4" /> Sound Effects
          </TabsTrigger>
          <TabsTrigger value="music" className="flex items-center gap-1.5">
            <Music className="w-4 h-4" /> Music
          </TabsTrigger>
        </TabsList>

        {/* Sound Effects Tab */}
        <TabsContent value="sfx" className="space-y-4 mt-4">
          {/* Custom prompt */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Describe your sound</label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g., Dramatic thunder rumble..."
                value={sfxPrompt}
                onChange={(e) => setSfxPrompt(e.target.value)}
                disabled={isGenerating}
              />
              <Button
                size="sm"
                onClick={() => handleGenerateSFX(sfxPrompt)}
                disabled={isGenerating || !sfxPrompt.trim()}
              >
                {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Duration slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Duration</label>
              <span className="text-xs">{sfxDuration[0]}s</span>
            </div>
            <Slider
              value={sfxDuration}
              onValueChange={setSfxDuration}
              min={1}
              max={22}
              step={1}
              disabled={isGenerating}
            />
          </div>

          {/* Presets */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Quick Presets</label>
            <div className="grid grid-cols-5 gap-1.5">
              {sfxPresets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleGenerateSFX(preset.prompt, 5)}
                  disabled={isGenerating}
                  className={cn(
                    'flex flex-col items-center gap-1 p-2 rounded-lg transition-all',
                    'bg-muted/50 hover:bg-muted text-center',
                    isGenerating && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    {preset.icon}
                  </div>
                  <span className="text-[10px] font-medium truncate w-full">{preset.name}</span>
                </button>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Music Tab */}
        <TabsContent value="music" className="space-y-4 mt-4">
          {/* Custom prompt */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Describe your music</label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g., Upbeat tropical house..."
                value={musicPrompt}
                onChange={(e) => setMusicPrompt(e.target.value)}
                disabled={isGenerating}
              />
              <Button
                size="sm"
                onClick={() => handleGenerateMusic(musicPrompt)}
                disabled={isGenerating || !musicPrompt.trim()}
              >
                {isGenerating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* Duration slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">Duration</label>
              <span className="text-xs">{musicDuration[0]}s</span>
            </div>
            <Slider
              value={musicDuration}
              onValueChange={setMusicDuration}
              min={10}
              max={60}
              step={5}
              disabled={isGenerating}
            />
          </div>

          {/* Music Presets */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Genre Presets</label>
            <div className="grid grid-cols-3 gap-2">
              {musicPresets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleGenerateMusic(preset.prompt, 30)}
                  disabled={isGenerating}
                  className={cn(
                    'flex items-center gap-2 p-2.5 rounded-lg transition-all text-left',
                    'bg-muted/50 hover:bg-muted',
                    isGenerating && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
                    {preset.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{preset.name}</p>
                    <p className="text-[10px] text-muted-foreground">{preset.mood}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Generated Audio List */}
      {generatedAudios.length > 0 && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Generated Audio</label>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {generatedAudios.map((audio) => (
              <div
                key={audio.id}
                className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/50"
              >
                <button
                  onClick={() => handlePlayPause(audio)}
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                    playingId === audio.id ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  )}
                >
                  {playingId === audio.id ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4 ml-0.5" />
                  )}
                </button>
                
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{audio.prompt}</p>
                  <div className="flex items-center gap-1.5">
                    <Badge variant="secondary" className="text-[10px] px-1 py-0">
                      {audio.type === 'sfx' ? 'SFX' : 'Music'}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                      {audio.duration}s
                    </span>
                  </div>
                </div>

                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="w-7 h-7"
                    onClick={() => handleDownload(audio)}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="w-7 h-7"
                    onClick={() => {
                      onAddToTimeline(audio);
                      toast.success('Added to timeline');
                    }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading state */}
      {isGenerating && (
        <div className="flex items-center justify-center gap-2 p-4 rounded-lg bg-primary/5 border border-primary/20">
          <RefreshCw className="w-4 h-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">
            Generating {activeTab === 'sfx' ? 'sound effect' : 'music track'}...
          </span>
        </div>
      )}
    </div>
  );
};

export type { GeneratedAudio };
