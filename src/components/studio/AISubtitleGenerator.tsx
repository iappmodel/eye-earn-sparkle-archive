import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Subtitles, Loader2, Download, Copy, Check, Upload, Film, Settings2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { generateSubtitles, AIMediaError } from '@/services/aiMedia.service';

interface SubtitleWord {
  text: string;
  start: number;
  end: number;
  speaker?: string;
}

interface Subtitle {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
  speaker?: string;
}

interface AISubtitleGeneratorProps {
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  onSubtitlesGenerated?: (subtitles: Subtitle[]) => void;
}

const LANGUAGES = [
  { code: 'auto', name: 'Auto-detect' },
  { code: 'eng', name: 'English' },
  { code: 'spa', name: 'Spanish' },
  { code: 'fra', name: 'French' },
  { code: 'deu', name: 'German' },
  { code: 'ita', name: 'Italian' },
  { code: 'por', name: 'Portuguese' },
  { code: 'jpn', name: 'Japanese' },
  { code: 'kor', name: 'Korean' },
  { code: 'cmn', name: 'Chinese (Mandarin)' },
  { code: 'ara', name: 'Arabic' },
  { code: 'hin', name: 'Hindi' },
];

const formatTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
};

const formatVTTTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
};

function wordsToSubtitles(words: SubtitleWord[]): Subtitle[] {
  const result: Subtitle[] = [];
  if (words.length === 0) return result;

  let current: Subtitle = {
    id: '1',
    startTime: words[0].start,
    endTime: words[0].end,
    text: words[0].text,
    speaker: words[0].speaker,
  };
  let wordCount = 1;

  for (let i = 1; i < words.length; i++) {
    const w = words[i];
    const timeDiff = w.start - current.endTime;
    const speakerChanged = w.speaker !== current.speaker;
    if (speakerChanged || timeDiff > 1.5 || wordCount >= 8) {
      result.push(current);
      current = {
        id: String(result.length + 1),
        startTime: w.start,
        endTime: w.end,
        text: w.text,
        speaker: w.speaker,
      };
      wordCount = 1;
    } else {
      current.text += ' ' + w.text;
      current.endTime = w.end;
      wordCount++;
    }
  }
  result.push(current);
  return result;
}

interface AISubtitleGeneratorPropsExtended extends AISubtitleGeneratorProps {
  /** Optional: current video file from Studio for "Use current video" flow */
  videoFile?: File | null;
}

export const AISubtitleGenerator: React.FC<AISubtitleGeneratorPropsExtended> = ({
  videoRef,
  onSubtitlesGenerated,
  videoFile,
}) => {
  const [language, setLanguage] = useState('auto');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [copied, setCopied] = useState(false);
  const [styleFontSize, setStyleFontSize] = useState([24]);
  const [stylePosition, setStylePosition] = useState<'bottom' | 'middle' | 'top'>('bottom');
  const [styleOpen, setStyleOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const transcribeFile = useCallback(
    async (file: File) => {
      setIsTranscribing(true);
      try {
        const result = await generateSubtitles(file, language);
        const generated = wordsToSubtitles(result.words);
        if (generated.length === 0 && result.text) {
          generated.push({
            id: '1',
            startTime: 0,
            endTime: 10,
            text: result.text,
          });
        }
        setSubtitles(generated);
        onSubtitlesGenerated?.(generated);
        toast.success(`Generated ${generated.length} subtitle segments`);
      } catch (err) {
        const msg = err instanceof AIMediaError ? err.message : 'Transcription failed';
        const desc =
          err instanceof AIMediaError && err.code === 'CONFIG_MISSING'
            ? 'ElevenLabs API key not configured'
            : err instanceof AIMediaError && err.code === 'RATE_LIMIT'
              ? 'Too many requests. Try again later.'
              : err instanceof AIMediaError && err.code === 'CREDITS_EXHAUSTED'
                ? 'API credits exhausted.'
                : undefined;
        toast.error(msg, { description: desc });
      } finally {
        setIsTranscribing(false);
        fileInputRef.current && (fileInputRef.current.value = '');
      }
    },
    [language, onSubtitlesGenerated]
  );

  const handleFileUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      await transcribeFile(file);
    },
    [transcribeFile]
  );

  const exportSRT = () => {
    if (subtitles.length === 0) return;
    const srtContent = subtitles
      .map((sub, i) => `${i + 1}\n${formatTime(sub.startTime)} --> ${formatTime(sub.endTime)}\n${sub.text}\n`)
      .join('\n');
    const blob = new Blob([srtContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'subtitles.srt';
    link.click();
    URL.revokeObjectURL(url);
    toast.success('SRT file downloaded');
  };

  const exportVTT = () => {
    if (subtitles.length === 0) return;
    let vttContent = 'WEBVTT\n\n';
    vttContent += subtitles
      .map((sub, i) => `${i + 1}\n${formatVTTTime(sub.startTime)} --> ${formatVTTTime(sub.endTime)}\n${sub.text}\n`)
      .join('\n');
    const blob = new Blob([vttContent], { type: 'text/vtt' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'subtitles.vtt';
    link.click();
    URL.revokeObjectURL(url);
    toast.success('VTT file downloaded');
  };

  const copyToClipboard = () => {
    const text = subtitles.map((s) => s.text).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-primary">
        <Subtitles className="w-5 h-5" />
        <h3 className="font-semibold">AI Subtitles</h3>
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-sm text-muted-foreground mb-1 block">Language</Label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="bg-background/50 border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((lang) => (
                <SelectItem key={lang.code} value={lang.code}>
                  {lang.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*,video/*"
          onChange={handleFileUpload}
          className="hidden"
        />

        <div className="flex flex-col gap-2">
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isTranscribing}
            className="w-full"
          >
            {isTranscribing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Transcribing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload Audio/Video
              </>
            )}
          </Button>
          {videoFile && (videoFile.type.startsWith('video/') || videoFile.type.startsWith('audio/')) && (
            <Button
              variant="secondary"
              onClick={() => transcribeFile(videoFile)}
              disabled={isTranscribing}
              className="w-full"
              title="Transcribe current video/audio in Studio"
            >
              <Film className="w-4 h-4 mr-2" />
              Use current video
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Upload audio/video or extract from current video. Speaker detection supported.
        </p>
      </div>

      {subtitles.length > 0 && (
        <div className="space-y-3">
          <Collapsible open={styleOpen} onOpenChange={setStyleOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between text-xs">
                <span className="flex items-center gap-2">
                  <Settings2 className="w-3.5 h-3.5" /> Subtitle style
                </span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <Label>Font size</Label>
                  <span>{styleFontSize[0]}px</span>
                </div>
                <Slider value={styleFontSize} onValueChange={setStyleFontSize} min={14} max={48} step={2} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Position</Label>
                <div className="flex gap-2">
                  {(['bottom', 'middle', 'top'] as const).map((pos) => (
                    <Button
                      key={pos}
                      variant={stylePosition === pos ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setStylePosition(pos)}
                    >
                      {pos.charAt(0).toUpperCase() + pos.slice(1)}
                    </Button>
                  ))}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">{subtitles.length} segments</h4>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={copyToClipboard}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
              <Button size="sm" variant="ghost" onClick={exportSRT}>
                <Download className="w-4 h-4" />
                <span className="ml-1 text-xs">SRT</span>
              </Button>
              <Button size="sm" variant="ghost" onClick={exportVTT}>
                <Download className="w-4 h-4" />
                <span className="ml-1 text-xs">VTT</span>
              </Button>
            </div>
          </div>

          <ScrollArea
            className="h-[200px] rounded-lg border border-border/30 bg-background/30"
            style={{ '--subtitle-font-size': `${styleFontSize[0]}px` } as React.CSSProperties}
          >
            <div
              className="p-2 space-y-2"
              data-subtitle-position={stylePosition}
            >
              {subtitles.map((subtitle) => (
                <div
                  key={subtitle.id}
                  className="p-2 rounded bg-muted/30 text-sm"
                  style={{ fontSize: styleFontSize[0] }}
                >
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <span>
                      {formatVTTTime(subtitle.startTime)} → {formatVTTTime(subtitle.endTime)}
                    </span>
                    {subtitle.speaker && (
                      <span className="px-1.5 py-0.5 rounded bg-primary/20 text-primary">{subtitle.speaker}</span>
                    )}
                  </div>
                  <p className="text-foreground">{subtitle.text}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
};
