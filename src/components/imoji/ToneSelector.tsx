import React from 'react';
import { cn } from '@/lib/utils';
import { IMojiTone, IMOJI_TONES } from './types';

interface ToneSelectorProps {
  selectedTone: IMojiTone;
  onSelectTone: (tone: IMojiTone) => void;
}

export const ToneSelector: React.FC<ToneSelectorProps> = ({
  selectedTone,
  onSelectTone
}) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Expression / Tone</h3>
      
      <div className="flex flex-wrap gap-2">
        {IMOJI_TONES.map((tone) => (
          <button
            key={tone.id}
            onClick={() => onSelectTone(tone.id)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-full border transition-all",
              selectedTone === tone.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:border-primary/50"
            )}
          >
            <span className="text-lg">{tone.emoji}</span>
            <span className="text-sm">{tone.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
