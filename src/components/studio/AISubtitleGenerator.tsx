import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Subtitles, Loader2, Download, Copy, Check, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  videoRef?: React.RefObject<HTMLVideoElement>;
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

export const AISubtitleGenerator: React.FC<AISubtitleGeneratorProps> = ({
  videoRef,
  onSubtitlesGenerated
}) => {
  const [language, setLanguage] = useState('auto');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const extractAudioFromVideo = async (videoElement: HTMLVideoElement): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const audioContext = new AudioContext();
      
      // For now, we'll use the video file directly if available
      // In a real implementation, you'd extract audio using Web Audio API or FFmpeg
      toast.info('Preparing audio for transcription...');
      
      // Fallback: request user to upload audio file
      reject(new Error('Please upload an audio file directly'));
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    await transcribeAudio(file);
  };

  const transcribeAudio = async (audioFile: File) => {
    setIsTranscribing(true);

    try {
      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('language', language);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-subtitles`,
        {
          method: 'POST',
          headers: {
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Transcription failed');
      }

      // Convert words to subtitle segments (group every ~5-8 words or by speaker)
      const words: SubtitleWord[] = data.words || [];
      const generatedSubtitles: Subtitle[] = [];
      
      if (words.length > 0) {
        let currentSubtitle: Subtitle = {
          id: '1',
          startTime: words[0].start,
          endTime: words[0].end,
          text: words[0].text,
          speaker: words[0].speaker,
        };
        
        let wordCount = 1;
        
        for (let i = 1; i < words.length; i++) {
          const word = words[i];
          const timeDiff = word.start - currentSubtitle.endTime;
          const speakerChanged = word.speaker !== currentSubtitle.speaker;
          
          // Start new subtitle if: speaker changed, long pause, or too many words
          if (speakerChanged || timeDiff > 1.5 || wordCount >= 8) {
            generatedSubtitles.push(currentSubtitle);
            currentSubtitle = {
              id: String(generatedSubtitles.length + 1),
              startTime: word.start,
              endTime: word.end,
              text: word.text,
              speaker: word.speaker,
            };
            wordCount = 1;
          } else {
            currentSubtitle.text += ' ' + word.text;
            currentSubtitle.endTime = word.end;
            wordCount++;
          }
        }
        
        // Add last subtitle
        generatedSubtitles.push(currentSubtitle);
      } else if (data.text) {
        // Fallback if no word-level timestamps
        generatedSubtitles.push({
          id: '1',
          startTime: 0,
          endTime: 10,
          text: data.text,
        });
      }

      setSubtitles(generatedSubtitles);
      onSubtitlesGenerated?.(generatedSubtitles);
      toast.success(`Generated ${generatedSubtitles.length} subtitle segments`);
    } catch (error) {
      console.error('Transcription error:', error);
      toast.error(error instanceof Error ? error.message : 'Transcription failed');
    } finally {
      setIsTranscribing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const exportSRT = () => {
    if (subtitles.length === 0) return;

    const srtContent = subtitles.map((sub, index) => {
      return `${index + 1}\n${formatTime(sub.startTime)} --> ${formatTime(sub.endTime)}\n${sub.text}\n`;
    }).join('\n');

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
    vttContent += subtitles.map((sub, index) => {
      return `${index + 1}\n${formatVTTTime(sub.startTime)} --> ${formatVTTTime(sub.endTime)}\n${sub.text}\n`;
    }).join('\n');

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
    const text = subtitles.map(s => s.text).join('\n');
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
          <label className="text-sm text-muted-foreground mb-1 block">Language</label>
          <Select value={language} onValueChange={setLanguage}>
            <SelectTrigger className="bg-background/50 border-border/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map(lang => (
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

        <p className="text-xs text-muted-foreground text-center">
          Upload audio or video file to generate subtitles with speaker detection
        </p>
      </div>

      {subtitles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">{subtitles.length} Segments</h4>
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

          <ScrollArea className="h-[200px] rounded-lg border border-border/30 bg-background/30">
            <div className="p-2 space-y-2">
              {subtitles.map((subtitle) => (
                <div
                  key={subtitle.id}
                  className="p-2 rounded bg-muted/30 text-sm"
                >
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <span>{formatVTTTime(subtitle.startTime)} → {formatVTTTime(subtitle.endTime)}</span>
                    {subtitle.speaker && (
                      <span className="px-1.5 py-0.5 rounded bg-primary/20 text-primary">
                        {subtitle.speaker}
                      </span>
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
