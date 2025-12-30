// Transition Preview component for Page Layout Editor
import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { PageDirection } from '@/contexts/UICustomizationContext';

interface TransitionPreviewProps {
  direction: PageDirection;
  transitionType: 'slide' | 'fade' | 'zoom';
  isPlaying?: boolean;
  onPlayToggle?: () => void;
  primaryColor?: string;
  accentColor?: string;
}

export const TransitionPreview: React.FC<TransitionPreviewProps> = ({
  direction,
  transitionType,
  isPlaying = false,
  onPlayToggle,
  primaryColor = '270 95% 65%',
  accentColor = '320 90% 60%',
}) => {
  const [animationPhase, setAnimationPhase] = useState<'idle' | 'exit' | 'enter'>('idle');
  const [key, setKey] = useState(0);

  const playAnimation = useCallback(() => {
    setAnimationPhase('exit');
    setKey(k => k + 1);
    
    setTimeout(() => {
      setAnimationPhase('enter');
    }, 300);
    
    setTimeout(() => {
      setAnimationPhase('idle');
    }, 600);
  }, []);

  useEffect(() => {
    if (isPlaying) {
      playAnimation();
      const interval = setInterval(playAnimation, 1500);
      return () => clearInterval(interval);
    }
  }, [isPlaying, playAnimation]);

  const getTransformStyle = (phase: typeof animationPhase): React.CSSProperties => {
    if (phase === 'idle') {
      return { transform: 'none', opacity: 1 };
    }

    if (transitionType === 'slide') {
      const exitTransforms: Record<PageDirection, string> = {
        up: 'translateY(-100%)',
        down: 'translateY(100%)',
        left: 'translateX(-100%)',
        right: 'translateX(100%)',
        center: 'none',
      };
      const enterTransforms: Record<PageDirection, string> = {
        up: 'translateY(100%)',
        down: 'translateY(-100%)',
        left: 'translateX(100%)',
        right: 'translateX(-100%)',
        center: 'none',
      };
      
      return {
        transform: phase === 'exit' ? exitTransforms[direction] : (phase === 'enter' ? 'none' : enterTransforms[direction]),
        opacity: 1,
      };
    }

    if (transitionType === 'fade') {
      return {
        transform: 'none',
        opacity: phase === 'exit' ? 0 : 1,
      };
    }

    if (transitionType === 'zoom') {
      return {
        transform: phase === 'exit' ? 'scale(0.8)' : 'none',
        opacity: phase === 'exit' ? 0 : 1,
      };
    }

    return {};
  };

  const directionLabels: Record<PageDirection, string> = {
    up: '↑ Up',
    down: '↓ Down',
    left: '← Left',
    right: '→ Right',
    center: '● Center',
  };

  return (
    <div className="space-y-3">
      {/* Preview Window */}
      <div 
        className="relative w-full aspect-[9/16] max-w-[120px] mx-auto rounded-2xl overflow-hidden border-2 border-border/50 bg-background/50"
        style={{ 
          boxShadow: `0 0 20px hsl(${primaryColor} / 0.2)` 
        }}
      >
        {/* Phone Frame Effect */}
        <div className="absolute top-1 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-muted/50" />
        
        {/* Animated Content */}
        <div 
          key={key}
          className="absolute inset-2 rounded-xl overflow-hidden transition-all duration-300 ease-out"
          style={getTransformStyle(animationPhase)}
        >
          {/* Page Content Preview */}
          <div 
            className="w-full h-full rounded-xl flex flex-col items-center justify-center p-2"
            style={{
              background: `linear-gradient(135deg, hsl(${primaryColor}), hsl(${accentColor}))`,
            }}
          >
            <div className="w-6 h-6 rounded-full bg-white/30 mb-1" />
            <div className="w-12 h-1.5 rounded bg-white/40 mb-1" />
            <div className="w-8 h-1 rounded bg-white/30" />
          </div>
        </div>

        {/* Direction Indicator */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm">
          <span className="text-[8px] text-white/80 font-medium">
            {directionLabels[direction]}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={onPlayToggle}
          className={cn(
            "p-2 rounded-lg transition-all",
            isPlaying 
              ? "bg-primary text-primary-foreground" 
              : "bg-muted hover:bg-muted/80"
          )}
        >
          {isPlaying ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
        </button>
        <button
          onClick={playAnimation}
          className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-all"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Transition Type Label */}
      <div className="text-center">
        <span className="text-[10px] text-muted-foreground capitalize">
          {transitionType} Transition
        </span>
      </div>
    </div>
  );
};

// Mini preview for grid display
export const MiniTransitionPreview: React.FC<{
  transitionType: 'slide' | 'fade' | 'zoom';
  direction: PageDirection;
  isActive?: boolean;
  onClick?: () => void;
  primaryColor?: string;
}> = ({ transitionType, direction, isActive, onClick, primaryColor = '270 95% 65%' }) => {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleClick = () => {
    setIsAnimating(true);
    onClick?.();
    setTimeout(() => setIsAnimating(false), 600);
  };

  const getAnimationClass = () => {
    if (!isAnimating) return '';
    
    if (transitionType === 'slide') {
      const slideClasses: Record<PageDirection, string> = {
        up: 'animate-bounce-up',
        down: 'animate-bounce-down',
        left: 'animate-bounce-left',
        right: 'animate-bounce-right',
        center: '',
      };
      return slideClasses[direction];
    }
    if (transitionType === 'fade') return 'animate-pulse';
    if (transitionType === 'zoom') return 'animate-ping-once';
    return '';
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "relative w-12 h-16 rounded-lg border-2 transition-all overflow-hidden",
        isActive 
          ? "border-primary shadow-lg" 
          : "border-border/50 hover:border-border"
      )}
    >
      <div 
        className={cn(
          "absolute inset-1 rounded transition-all duration-300",
          getAnimationClass()
        )}
        style={{
          background: `linear-gradient(135deg, hsl(${primaryColor}), hsl(${primaryColor} / 0.5))`,
        }}
      />
      <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[6px] font-medium text-muted-foreground capitalize">
        {transitionType}
      </span>
    </button>
  );
};

export default TransitionPreview;
