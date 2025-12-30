import React from 'react';
import { Mic, Square, X, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VoiceRecorderProps {
  isRecording: boolean;
  duration: number;
  onStart: () => void;
  onStop: () => void;
  onCancel: () => void;
  onSend: () => void;
  disabled?: boolean;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  isRecording,
  duration,
  onStart,
  onStop,
  onCancel,
  onSend,
  disabled,
}) => {
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isRecording) {
    return (
      <div className="flex items-center gap-3 flex-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={onCancel}
          className="shrink-0 text-destructive hover:text-destructive"
        >
          <X className="w-5 h-5" />
        </Button>
        
        <div className="flex-1 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
            <span className="text-sm font-medium text-destructive">
              {formatDuration(duration)}
            </span>
          </div>
          
          {/* Waveform visualization */}
          <div className="flex-1 flex items-center gap-0.5 h-8">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 bg-primary/60 rounded-full animate-pulse"
                style={{
                  height: `${Math.random() * 100}%`,
                  animationDelay: `${i * 50}ms`,
                }}
              />
            ))}
          </div>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onStop}
          className="shrink-0"
        >
          <Square className="w-5 h-5 fill-current" />
        </Button>
        
        <Button
          size="icon"
          onClick={onSend}
          className="shrink-0"
        >
          <Send className="w-5 h-5" />
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onStart}
      disabled={disabled}
      className="shrink-0"
    >
      <Mic className="w-5 h-5" />
    </Button>
  );
};
