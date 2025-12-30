import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Music, Disc3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface UseThisSoundButtonProps {
  soundId?: string;
  soundTitle?: string;
  soundArtist?: string;
  soundUrl?: string;
  usageCount?: number;
  className?: string;
  variant?: 'default' | 'compact' | 'floating';
}

export const UseThisSoundButton: React.FC<UseThisSoundButtonProps> = ({
  soundId,
  soundTitle = 'Original Sound',
  soundArtist,
  soundUrl,
  usageCount,
  className,
  variant = 'default',
}) => {
  const navigate = useNavigate();

  const handleUseSound = () => {
    // Navigate to create page with sound data
    navigate('/create', {
      state: {
        selectedSound: {
          id: soundId,
          title: soundTitle,
          artist: soundArtist,
          url: soundUrl,
        }
      }
    });
  };

  const formatCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(0)}K`;
    return count.toString();
  };

  if (variant === 'floating') {
    return (
      <button
        onClick={handleUseSound}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-full",
          "bg-black/60 backdrop-blur-sm text-white text-sm",
          "hover:bg-black/80 transition-colors",
          className
        )}
      >
        <Disc3 className="w-4 h-4 animate-spin-slow" />
        <span className="truncate max-w-[120px]">{soundTitle}</span>
      </button>
    );
  }

  if (variant === 'compact') {
    return (
      <Button
        onClick={handleUseSound}
        size="sm"
        variant="secondary"
        className={cn("gap-1.5", className)}
      >
        <Music className="w-3.5 h-3.5" />
        Use Sound
      </Button>
    );
  }

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-lg",
      "bg-muted/50 border border-border",
      "hover:border-primary/50 transition-colors",
      className
    )}>
      {/* Spinning disc icon */}
      <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center animate-spin-slow">
        <div className="absolute inset-2 rounded-full bg-background" />
        <Music className="w-4 h-4 relative z-10 text-primary" />
      </div>

      {/* Sound info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{soundTitle}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {soundArtist && <span>{soundArtist}</span>}
          {usageCount !== undefined && (
            <>
              {soundArtist && <span>•</span>}
              <span>{formatCount(usageCount)} videos</span>
            </>
          )}
        </div>
      </div>

      {/* Use button */}
      <Button onClick={handleUseSound} size="sm" className="gap-1.5">
        <Music className="w-3.5 h-3.5" />
        Use
      </Button>
    </div>
  );
};

// Add custom animation for slow spin
const styles = `
@keyframes spin-slow {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin-slow {
  animation: spin-slow 3s linear infinite;
}
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleEl = document.createElement('style');
  styleEl.textContent = styles;
  document.head.appendChild(styleEl);
}
