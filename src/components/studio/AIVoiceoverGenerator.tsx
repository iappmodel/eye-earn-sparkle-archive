import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Mic, Play, Pause, Download, Loader2, Volume2, Plus, Settings2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { generateVoiceover, AIMediaError } from '@/services/aiMedia.service';
import type { GeneratedAudio } from './AISoundGenerator';

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

export interface GeneratedVoiceover {
  id: string;
  text: string;
  voiceName: string;
  voiceId: string;
  audioUrl: string;
  duration?: number;
  createdAt: Date;
}

interface AIVoiceoverGeneratorProps {
  onVoiceoverGenerated?: (voiceover: GeneratedVoiceover) => void;
  onAddToTimeline?: (audio: GeneratedAudio) => void;
}

export const AIVoiceoverGenerator: React.FC<AIVoiceoverGeneratorProps> = ({
  onVoiceoverGenerated,
  onAddToTimeline,
}) => {
  const [text, setText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState(VOICES[0].id);
  const [stability, setStability] = useState([50]);
  const [similarityBoost, setSimilarityBoost] = useState([75]);
  const [speed, setSpeed] = useState([100]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedVoiceovers, setGeneratedVoiceovers] = useState<GeneratedVoiceover[]>([]);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioElements, setAudioElements] = useState<Map<string, HTMLAudioElement>>(new Map());

  const getAudioDuration = (url: string): Promise<number> => {
    return new Promise((resolve, reject) => {
      const audio = new Audio(url);
      audio.onloadedmetadata = () => {
        resolve(audio.duration);
        URL.revokeObjectURL(audio.src);
      };
      audio.onerror = () => resolve(0);
    });
  };

  const generateVoiceoverHandler = async () => {
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
      const result = await generateVoiceover({
        text: text.trim(),
        voiceId: selectedVoice,
        stability: stability[0] / 100,
        similarityBoost: similarityBoost[0] / 100,
        speed: speed[0] / 100,
      });

      const audioUrl = `data:audio/mpeg;base64,${result.audioContent}`;
      const voiceName = VOICES.find((v) => v.id === selectedVoice)?.name ?? 'Unknown';
      let duration: number | undefined;
      try {
        duration = await getAudioDuration(audioUrl);
      } catch {
        duration = undefined;
      }

      const newVoiceover: GeneratedVoiceover = {
        id: crypto.randomUUID(),
        text: text.length > 100 ? text.substring(0, 100) + '...' : text,
        voiceName,
        voiceId: result.voiceId,
        audioUrl,
        duration,
        createdAt: new Date(),
      };

      setGeneratedVoiceovers((prev) => [newVoiceover, ...prev]);
      onVoiceoverGenerated?.(newVoiceover);
      setText('');
      toast.success('Voiceover generated successfully!');
    } catch (err) {
      const msg = err instanceof AIMediaError ? err.message : 'Failed to generate voiceover';
      const desc =
        err instanceof AIMediaError && err.code === 'CONFIG_MISSING'
          ? 'ElevenLabs API key not configured'
          : err instanceof AIMediaError && err.code === 'RATE_LIMIT'
            ? 'Too many requests. Try again later.'
            : err instanceof AIMediaError && err.code === 'CREDITS_EXHAUSTED'
              ? 'API credits exhausted. Check your ElevenLabs account.'
              : undefined;
      toast.error(msg, { description: desc });
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

    audioElements.forEach((a) => a.pause());

    let audio = existingAudio;
    if (!audio) {
      audio = new Audio(voiceover.audioUrl);
      audio.onended = () => setPlayingId(null);
      setAudioElements((prev) => new Map(prev).set(voiceover.id, audio!));
    }

    audio.play();
    setPlayingId(voiceover.id);
  };

  const downloadVoiceover = (voiceover: GeneratedVoiceover) => {
    const link = document.createElement('a');
    link.href = voiceover.audioUrl;
    link.download = `voiceover-${voiceover.voiceName}-${Date.now()}.mp3`;
    link.click();
    toast.success('Downloaded');
  };

  const addToTimeline = (voiceover: GeneratedVoiceover) => {
    if (!onAddToTimeline) {
      toast.info('Add to timeline', { description: 'Use the Studio to add voiceovers to your video.' });
      return;
    }
    const audio: GeneratedAudio = {
      id: voiceover.id,
      type: 'music',
      prompt: voiceover.text,
      audioUrl: voiceover.audioUrl,
      duration: voiceover.duration ?? 0,
      createdAt: voiceover.createdAt,
    };
    onAddToTimeline(audio);
    toast.success('Voiceover added to timeline');
  };

  const selectedVoiceData = VOICES.find((v) => v.id === selectedVoice);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-primary">
        <Mic className="w-5 h-5" />
        <h3 className="font-semibold">AI Voiceover</h3>
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-sm text-muted-foreground mb-1 block">Voice</Label>
          <Select value={selectedVoice} onValueChange={setSelectedVoice}>
            <SelectTrigger className="bg-background/50 border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VOICES.map((voice) => (
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

        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between text-xs">
              <span className="flex items-center gap-2">
                <Settings2 className="w-3.5 h-3.5" /> Voice settings
              </span>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-2">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <Label>Stability</Label>
                <span>{stability[0]}%</span>
              </div>
              <Slider
                value={stability}
                onValueChange={setStability}
                min={0}
                max={100}
                step={5}
                disabled={isGenerating}
              />
              <p className="text-[10px] text-muted-foreground">Higher = more consistent, less expressive</p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <Label>Similarity</Label>
                <span>{similarityBoost[0]}%</span>
              </div>
              <Slider
                value={similarityBoost}
                onValueChange={setSimilarityBoost}
                min={0}
                max={100}
                step={5}
                disabled={isGenerating}
              />
              <p className="text-[10px] text-muted-foreground">How closely to match the voice</p>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <Label>Speed</Label>
                <span>{speed[0]}%</span>
              </div>
              <Slider
                value={speed}
                onValueChange={setSpeed}
                min={50}
                max={200}
                step={5}
                disabled={isGenerating}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        <div>
          <Label className="text-sm text-muted-foreground mb-1 block">Script ({text.length}/5000)</Label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter your voiceover script here..."
            className="bg-background/50 border-border/50 min-h-[120px] resize-none"
            maxLength={5000}
          />
        </div>

        <Button onClick={generateVoiceoverHandler} disabled={isGenerating || !text.trim()} className="w-full">
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
            {generatedVoiceovers.map((voiceover) => (
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
                  {playingId === voiceover.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{voiceover.text}</p>
                  <p className="text-xs text-muted-foreground">{voiceover.voiceName}</p>
                </div>
                <div className="flex gap-1">
                  {onAddToTimeline && (
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => addToTimeline(voiceover)}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => downloadVoiceover(voiceover)}>
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
