import React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IMojiStyle, IMOJI_STYLES } from './types';

interface StyleSelectorProps {
  selectedStyle: IMojiStyle;
  onSelectStyle: (style: IMojiStyle) => void;
}

export const StyleSelector: React.FC<StyleSelectorProps> = ({
  selectedStyle,
  onSelectStyle
}) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Choose Style</h3>
      
      <div className="grid grid-cols-3 gap-3">
        {IMOJI_STYLES.map((style) => (
          <button
            key={style.id}
            onClick={() => onSelectStyle(style.id)}
            className={cn(
              "relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
              selectedStyle === style.id
                ? "border-primary bg-primary/10"
                : "border-border bg-card hover:border-primary/50"
            )}
          >
            {selectedStyle === style.id && (
              <div className="absolute top-2 right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                <Check className="w-3 h-3 text-primary-foreground" />
              </div>
            )}
            
            <span className="text-3xl">{style.icon}</span>
            <span className="text-sm font-medium">{style.name}</span>
            <span className="text-xs text-muted-foreground text-center line-clamp-2">
              {style.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
