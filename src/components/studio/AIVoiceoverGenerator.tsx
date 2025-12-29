import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mic, Play, Pause, Download, Loader2, Volume2 } from 'lucide-react';
import { toast } from 'sonner';

interface Voice {
  id: string;
  name: string;
  description: string;
}

const VOICES: Voice[] = [
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', description: 'Warm, conversational female' },
  { id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger', description: 'Professional male narrator' },
  { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura', description: 'Young, energetic female' },
  { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie', description: 'Friendly, casual male' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', description: 'Deep, authoritative male' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', description: 'British accent male' },
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', description: 'Soft, gentle female' },
  { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', description: 'Mature, sophisticated female' },
  { id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', description: 'Youthful, bright female' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', description: 'Calm, reassuring male' },
];

interface GeneratedVoiceover {
  id: string;
  text: string;
  voiceName: string;
  audioUrl: string;
  createdAt: Date;
}

interface AIVoiceoverGeneratorProps {
  onVoiceoverGenerated?: (voiceover: GeneratedVoiceover) => void;
}

export const AIVoiceoverGenerator: React.FC<AIVoiceoverGeneratorProps> = ({
  onVoiceoverGenerated
}) => {
  const [text, setText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState(VOICES[0].id);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVoiceovers, setGeneratedVoiceovers] = useState<GeneratedVoiceover[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElements, setAudioElements] = useState<Map<string, HTMLAudioElement>>(new Map());

  const generateVoiceover = async () => {
    if (!text.trim()) {
      toast.error('Please enter text for the voiceover');
      return;
    }

    if (text.length > 5000) {
      toast.error('Text must be under 5000 characters');
      return;
    }

    setIsGenerating(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-voiceover`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text, voiceId: selectedVoice }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate voiceover');
      }

      const audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
      const voiceName = VOICES.find(v => v.id === selectedVoice)?.name || 'Unknown';

      const newVoiceover: GeneratedVoiceover = {
        id: crypto.randomUUID(),
        text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        voiceName,
        audioUrl,
        createdAt: new Date(),
      };

      setGeneratedVoiceovers(prev => [newVoiceover, ...prev]);
      onVoiceoverGenerated?.(newVoiceover);
      toast.success('Voiceover generated successfully!');
      setText('');
    } catch (error) {
      console.error('Error generating voiceover:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate voiceover');
    } finally {
      setIsGenerating(false);
    }
  };

  const togglePlayback = (voiceover: GeneratedVoiceover) => {
    const existingAudio = audioElements.get(voiceover.id);

    if (playingId === voiceover.id && existingAudio) {
      existingAudio.pause();
      setPlayingId(null);
      return;
    }

    // Stop any currently playing audio
    audioElements.forEach(audio => audio.pause());

    let audio = existingAudio;
    if (!audio) {
      audio = new Audio(voiceover.audioUrl);
      audio.onended = () => setPlayingId(null);
      setAudioElements(prev => new Map(prev).set(voiceover.id, audio!));
    }

    audio.play();
    setPlayingId(voiceover.id);
  };

  const downloadVoiceover = (voiceover: GeneratedVoiceover) => {
    const link = document.createElement('a');
    link.href = voiceover.audioUrl;
    link.download = `voiceover-${voiceover.voiceName}-${Date.now()}.mp3`;
    link.click();
  };

  const selectedVoiceData = VOICES.find(v => v.id === selectedVoice);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-primary">
        <Mic className="w-5 h-5" />
        <h3 className="font-semibold">AI Voiceover</h3>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Voice</label>
          <Select value={selectedVoice} onValueChange={setSelectedVoice}>
            <SelectTrigger className="bg-background/50 border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VOICES.map(voice => (
                <SelectItem key={voice.id} value={voice.id}>
                  <div className="flex flex-col">
                    <span>{voice.name}</span>
                    <span className="text-xs text-muted-foreground">{voice.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedVoiceData && (
            <p className="text-xs text-muted-foreground mt-1">{selectedVoiceData.description}</p>
          )}
        </div>

        <div>
          <label className="text-sm text-muted-foreground mb-1 block">
            Script ({text.length}/5000)
          </label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter your voiceover script here..."
            className="bg-background/50 border-border/50 min-h-[120px] resize-none"
            maxLength={5000}
          />
        </div>

        <Button
          onClick={generateVoiceover}
          disabled={isGenerating || !text.trim()}
          className="w-full"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Volume2 className="w-4 h-4 mr-2" />
              Generate Voiceover
            </>
          )}
        </Button>
      </div>

      {generatedVoiceovers.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Generated Voiceovers</h4>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {generatedVoiceovers.map(voiceover => (
              <div
                key={voiceover.id}
                className="flex items-center gap-2 p-2 rounded-lg bg-background/30 border border-border/30"
              >
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0"
                  onClick={() => togglePlayback(voiceover)}
                >
                  {playingId === voiceover.id ? (
                    <Pause className="w-4 h-4" />
                  ) : (
                    <Play className="w-4 h-4" />
                  )}
                </Button>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{voiceover.text}</p>
                  <p className="text-xs text-muted-foreground">{voiceover.voiceName}</p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0"
                  onClick={() => downloadVoiceover(voiceover)}
                >
                  <Download className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
