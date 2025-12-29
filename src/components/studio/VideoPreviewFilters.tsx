import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface FilterStyle {
  filter: string;
  mixBlendMode?: string;
  overlay?: string;
  overlayOpacity?: number;
  animation?: string;
}

// Map AI style IDs to CSS filter combinations
const styleFilters: Record<string, FilterStyle> = {
  // Dynamic styles
  dynamics: {
    filter: 'contrast(1.2) saturate(1.3) brightness(1.05)',
    overlay: 'linear-gradient(45deg, rgba(255,100,0,0.1) 0%, rgba(255,0,100,0.1) 100%)',
    overlayOpacity: 0.3,
    animation: 'pulse-glow',
  },
  sports: {
    filter: 'contrast(1.25) saturate(1.2) brightness(1.1)',
    overlay: 'linear-gradient(180deg, rgba(0,150,255,0.15) 0%, rgba(0,200,255,0.05) 100%)',
    overlayOpacity: 0.4,
  },
  action: {
    filter: 'contrast(1.3) saturate(1.4) brightness(0.95)',
    overlay: 'radial-gradient(circle, transparent 40%, rgba(255,50,0,0.2) 100%)',
    overlayOpacity: 0.5,
    animation: 'shake-subtle',
  },
  skippy: {
    filter: 'contrast(1.15) saturate(1.2) brightness(1.05)',
    overlay: 'linear-gradient(135deg, rgba(128,0,255,0.1) 0%, rgba(255,0,128,0.1) 100%)',
    overlayOpacity: 0.3,
  },
  hype: {
    filter: 'contrast(1.2) saturate(1.5) brightness(1.1) hue-rotate(10deg)',
    overlay: 'linear-gradient(45deg, rgba(255,200,0,0.2) 0%, rgba(255,0,150,0.2) 100%)',
    overlayOpacity: 0.4,
    animation: 'strobe-soft',
  },

  // Emotional styles
  romantic: {
    filter: 'contrast(0.95) saturate(0.9) brightness(1.05) sepia(0.15)',
    overlay: 'radial-gradient(ellipse at center, rgba(255,192,203,0.2) 0%, transparent 70%)',
    overlayOpacity: 0.5,
  },
  spiritual: {
    filter: 'contrast(0.9) saturate(0.85) brightness(1.15) sepia(0.1)',
    overlay: 'radial-gradient(circle at 50% 0%, rgba(255,220,100,0.3) 0%, transparent 60%)',
    overlayOpacity: 0.5,
    animation: 'glow-soft',
  },
  melancholy: {
    filter: 'contrast(1.1) saturate(0.6) brightness(0.9) hue-rotate(-15deg)',
    overlay: 'linear-gradient(180deg, rgba(30,60,120,0.25) 0%, rgba(10,20,50,0.15) 100%)',
    overlayOpacity: 0.5,
  },
  dreamy: {
    filter: 'contrast(0.85) saturate(0.9) brightness(1.1) blur(0.5px)',
    overlay: 'radial-gradient(circle, rgba(200,150,255,0.2) 0%, transparent 70%)',
    overlayOpacity: 0.4,
  },
  nostalgic: {
    filter: 'contrast(1.1) saturate(0.7) brightness(0.95) sepia(0.35)',
    overlay: 'linear-gradient(180deg, rgba(180,120,60,0.2) 0%, rgba(100,60,20,0.1) 100%)',
    overlayOpacity: 0.4,
  },

  // Cinematic styles
  movie: {
    filter: 'contrast(1.15) saturate(0.95) brightness(0.95)',
    overlay: 'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, transparent 15%, transparent 85%, rgba(0,0,0,0.1) 100%)',
    overlayOpacity: 0.8,
  },
  epic: {
    filter: 'contrast(1.2) saturate(1.1) brightness(0.9)',
    overlay: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,20,60,0.3) 100%)',
    overlayOpacity: 0.6,
  },
  thriller: {
    filter: 'contrast(1.3) saturate(0.8) brightness(0.85)',
    overlay: 'radial-gradient(circle, transparent 30%, rgba(0,0,0,0.4) 100%)',
    overlayOpacity: 0.6,
    animation: 'flicker',
  },
  noir: {
    filter: 'grayscale(1) contrast(1.4) brightness(0.9)',
    overlay: 'radial-gradient(circle, transparent 30%, rgba(0,0,0,0.5) 100%)',
    overlayOpacity: 0.7,
  },
  documentary: {
    filter: 'contrast(1.05) saturate(0.95) brightness(1.0)',
    overlayOpacity: 0,
  },

  // Special styles
  comedy: {
    filter: 'contrast(1.1) saturate(1.25) brightness(1.1)',
    overlay: 'linear-gradient(135deg, rgba(255,200,0,0.1) 0%, rgba(255,100,50,0.1) 100%)',
    overlayOpacity: 0.3,
  },
  horror: {
    filter: 'contrast(1.4) saturate(0.7) brightness(0.8) hue-rotate(-20deg)',
    overlay: 'radial-gradient(circle, transparent 20%, rgba(50,0,0,0.5) 100%)',
    overlayOpacity: 0.7,
    animation: 'glitch-horror',
  },
  'music-video': {
    filter: 'contrast(1.15) saturate(1.4) brightness(1.05)',
    overlay: 'linear-gradient(45deg, rgba(255,0,128,0.15) 0%, rgba(128,0,255,0.15) 50%, rgba(0,255,255,0.15) 100%)',
    overlayOpacity: 0.4,
    animation: 'color-shift',
  },
  vlog: {
    filter: 'contrast(1.1) saturate(1.15) brightness(1.1)',
    overlay: 'radial-gradient(circle at center, rgba(255,255,255,0.1) 0%, transparent 50%)',
    overlayOpacity: 0.3,
  },
  aesthetic: {
    filter: 'contrast(0.95) saturate(0.85) brightness(1.1) hue-rotate(5deg)',
    overlay: 'linear-gradient(180deg, rgba(255,182,193,0.2) 0%, rgba(173,216,230,0.2) 100%)',
    overlayOpacity: 0.4,
  },
};

interface VideoPreviewFiltersProps {
  selectedStyleId: string | null;
  intensity?: number; // 0-100
  className?: string;
}

export const VideoPreviewFilters: React.FC<VideoPreviewFiltersProps> = ({
  selectedStyleId,
  intensity = 100,
  className,
}) => {
  const style = useMemo(() => {
    if (!selectedStyleId || !styleFilters[selectedStyleId]) {
      return null;
    }
    return styleFilters[selectedStyleId];
  }, [selectedStyleId]);

  const intensityMultiplier = intensity / 100;

  if (!style) return null;

  return (
    <>
      {/* Main filter layer - applies CSS filters */}
      <div
        className={cn(
          'absolute inset-0 pointer-events-none transition-all duration-500',
          style.animation === 'pulse-glow' && 'animate-pulse',
          className
        )}
        style={{
          backdropFilter: style.filter,
          WebkitBackdropFilter: style.filter,
          opacity: intensityMultiplier,
        }}
      />

      {/* Overlay gradient layer */}
      {style.overlay && (style.overlayOpacity ?? 0) > 0 && (
        <div
          className={cn(
            'absolute inset-0 pointer-events-none transition-all duration-500',
            style.animation === 'strobe-soft' && 'animate-strobe',
            style.animation === 'color-shift' && 'animate-color-shift',
            style.animation === 'glow-soft' && 'animate-glow',
            style.animation === 'glitch-horror' && 'animate-glitch',
          )}
          style={{
            background: style.overlay,
            opacity: (style.overlayOpacity ?? 0.3) * intensityMultiplier,
            mixBlendMode: (style.mixBlendMode as React.CSSProperties['mixBlendMode']) || 'normal',
          }}
        />
      )}

      {/* Film grain for certain styles */}
      {(selectedStyleId === 'nostalgic' || selectedStyleId === 'noir' || selectedStyleId === 'horror') && (
        <div
          className="absolute inset-0 pointer-events-none opacity-20 mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            opacity: 0.15 * intensityMultiplier,
          }}
        />
      )}

      {/* Letterbox for cinematic styles */}
      {(selectedStyleId === 'movie' || selectedStyleId === 'epic' || selectedStyleId === 'documentary') && (
        <>
          <div
            className="absolute top-0 left-0 right-0 bg-black pointer-events-none transition-all duration-500"
            style={{ height: `${6 * intensityMultiplier}%` }}
          />
          <div
            className="absolute bottom-0 left-0 right-0 bg-black pointer-events-none transition-all duration-500"
            style={{ height: `${6 * intensityMultiplier}%` }}
          />
        </>
      )}

      {/* Vignette for dramatic styles */}
      {(selectedStyleId === 'thriller' || selectedStyleId === 'horror' || selectedStyleId === 'epic' || selectedStyleId === 'noir') && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            boxShadow: `inset 0 0 ${100 * intensityMultiplier}px rgba(0,0,0,${0.5 * intensityMultiplier})`,
          }}
        />
      )}

      {/* Light leak for romantic/dreamy styles */}
      {(selectedStyleId === 'romantic' || selectedStyleId === 'dreamy' || selectedStyleId === 'spiritual') && (
        <div
          className="absolute inset-0 pointer-events-none animate-light-leak"
          style={{
            background: 'radial-gradient(ellipse at 80% 20%, rgba(255,200,150,0.3) 0%, transparent 50%)',
            opacity: 0.4 * intensityMultiplier,
          }}
        />
      )}
    </>
  );
};

export { styleFilters };
