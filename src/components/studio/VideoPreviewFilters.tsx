import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

export interface FilterStyle {
  filter: string;
  mixBlendMode?: string;
  overlay?: string;
  overlayOpacity?: number;
  animation?: string;
  /** Display name for badge/export */
  displayName?: string;
  /** 0–1; default from style */
  vignetteStrength?: number;
  /** 0–1; default from style (film grain) */
  grainAmount?: number;
  /** Whether to show letterbox bars */
  letterbox?: boolean;
  /** Whether to show light-leak effect */
  lightLeak?: boolean;
}

// Map AI style IDs to CSS filter combinations (client-side preview + export-ready)
export const styleFilters: Record<string, FilterStyle> = {
  // —— Dynamic ——
  dynamics: {
    filter: 'contrast(1.2) saturate(1.3) brightness(1.05)',
    overlay: 'linear-gradient(45deg, rgba(255,100,0,0.12) 0%, rgba(255,0,100,0.12) 100%)',
    overlayOpacity: 0.35,
    animation: 'pulse-glow',
    displayName: 'Dynamics',
  },
  sports: {
    filter: 'contrast(1.25) saturate(1.2) brightness(1.1)',
    overlay: 'linear-gradient(180deg, rgba(0,150,255,0.18) 0%, rgba(0,200,255,0.06) 100%)',
    overlayOpacity: 0.45,
    displayName: 'Sports',
  },
  action: {
    filter: 'contrast(1.3) saturate(1.4) brightness(0.95)',
    overlay: 'radial-gradient(circle, transparent 40%, rgba(255,50,0,0.22) 100%)',
    overlayOpacity: 0.5,
    animation: 'shake-subtle',
    displayName: 'Action',
  },
  skippy: {
    filter: 'contrast(1.15) saturate(1.2) brightness(1.05)',
    overlay: 'linear-gradient(135deg, rgba(128,0,255,0.12) 0%, rgba(255,0,128,0.12) 100%)',
    overlayOpacity: 0.32,
    displayName: 'Skippy',
  },
  hype: {
    filter: 'contrast(1.2) saturate(1.5) brightness(1.1) hue-rotate(10deg)',
    overlay: 'linear-gradient(45deg, rgba(255,200,0,0.22) 0%, rgba(255,0,150,0.22) 100%)',
    overlayOpacity: 0.42,
    animation: 'strobe-soft',
    displayName: 'Hype',
  },

  // —— Emotional ——
  romantic: {
    filter: 'contrast(0.95) saturate(0.9) brightness(1.05) sepia(0.15)',
    overlay: 'radial-gradient(ellipse at center, rgba(255,192,203,0.22) 0%, transparent 70%)',
    overlayOpacity: 0.5,
    lightLeak: true,
    displayName: 'Romantic',
  },
  spiritual: {
    filter: 'contrast(0.9) saturate(0.85) brightness(1.15) sepia(0.1)',
    overlay: 'radial-gradient(circle at 50% 0%, rgba(255,220,100,0.32) 0%, transparent 60%)',
    overlayOpacity: 0.5,
    animation: 'glow-soft',
    lightLeak: true,
    displayName: 'Spiritual',
  },
  melancholy: {
    filter: 'contrast(1.1) saturate(0.6) brightness(0.9) hue-rotate(-15deg)',
    overlay: 'linear-gradient(180deg, rgba(30,60,120,0.28) 0%, rgba(10,20,50,0.18) 100%)',
    overlayOpacity: 0.52,
    displayName: 'Melancholy',
  },
  dreamy: {
    filter: 'contrast(0.85) saturate(0.9) brightness(1.1) blur(0.5px)',
    overlay: 'radial-gradient(circle, rgba(200,150,255,0.22) 0%, transparent 70%)',
    overlayOpacity: 0.42,
    lightLeak: true,
    displayName: 'Dreamy',
  },
  nostalgic: {
    filter: 'contrast(1.1) saturate(0.7) brightness(0.95) sepia(0.35)',
    overlay: 'linear-gradient(180deg, rgba(180,120,60,0.22) 0%, rgba(100,60,20,0.12) 100%)',
    overlayOpacity: 0.42,
    grainAmount: 0.2,
    displayName: 'Nostalgic',
  },

  // —— Cinematic ——
  movie: {
    filter: 'contrast(1.15) saturate(0.95) brightness(0.95)',
    overlay: 'linear-gradient(180deg, rgba(0,0,0,0.12) 0% transparent 15%, transparent 85%, rgba(0,0,0,0.12) 100%)',
    overlayOpacity: 0.8,
    letterbox: true,
    displayName: 'Movie',
  },
  epic: {
    filter: 'contrast(1.2) saturate(1.1) brightness(0.9)',
    overlay: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,20,60,0.32) 100%)',
    overlayOpacity: 0.6,
    vignetteStrength: 0.5,
    letterbox: true,
    displayName: 'Epic',
  },
  thriller: {
    filter: 'contrast(1.3) saturate(0.8) brightness(0.85)',
    overlay: 'radial-gradient(circle, transparent 30%, rgba(0,0,0,0.42) 100%)',
    overlayOpacity: 0.62,
    animation: 'flicker',
    vignetteStrength: 0.55,
    displayName: 'Thriller',
  },
  noir: {
    filter: 'grayscale(1) contrast(1.4) brightness(0.9)',
    overlay: 'radial-gradient(circle, transparent 30%, rgba(0,0,0,0.52) 100%)',
    overlayOpacity: 0.72,
    vignetteStrength: 0.6,
    grainAmount: 0.18,
    displayName: 'Film Noir',
  },
  documentary: {
    filter: 'contrast(1.05) saturate(0.95) brightness(1.0)',
    overlayOpacity: 0,
    letterbox: true,
    displayName: 'Documentary',
  },

  // —— Special ——
  comedy: {
    filter: 'contrast(1.1) saturate(1.25) brightness(1.1)',
    overlay: 'linear-gradient(135deg, rgba(255,200,0,0.12) 0%, rgba(255,100,50,0.12) 100%)',
    overlayOpacity: 0.32,
    displayName: 'Comedy',
  },
  horror: {
    filter: 'contrast(1.4) saturate(0.7) brightness(0.8) hue-rotate(-20deg)',
    overlay: 'radial-gradient(circle, transparent 20%, rgba(50,0,0,0.52) 100%)',
    overlayOpacity: 0.72,
    animation: 'glitch-horror',
    vignetteStrength: 0.65,
    grainAmount: 0.15,
    displayName: 'Horror',
  },
  'music-video': {
    filter: 'contrast(1.15) saturate(1.4) brightness(1.05)',
    overlay: 'linear-gradient(45deg, rgba(255,0,128,0.16) 0%, rgba(128,0,255,0.16) 50%, rgba(0,255,255,0.16) 100%)',
    overlayOpacity: 0.42,
    animation: 'color-shift',
    displayName: 'Music Video',
  },
  vlog: {
    filter: 'contrast(1.1) saturate(1.15) brightness(1.1)',
    overlay: 'radial-gradient(circle at center, rgba(255,255,255,0.12) 0%, transparent 50%)',
    overlayOpacity: 0.32,
    displayName: 'Vlog',
  },
  aesthetic: {
    filter: 'contrast(0.95) saturate(0.85) brightness(1.1) hue-rotate(5deg)',
    overlay: 'linear-gradient(180deg, rgba(255,182,193,0.22) 0%, rgba(173,216,230,0.22) 100%)',
    overlayOpacity: 0.42,
    displayName: 'Aesthetic',
  },
};

/** Resolve animation class for a style's animation key */
const animationClassMap: Record<string, string> = {
  'pulse-glow': 'animate-pulse-glow',
  'shake-subtle': 'animate-shake-subtle',
  'strobe-soft': 'animate-strobe',
  'color-shift': 'animate-color-shift',
  'glow-soft': 'animate-glow',
  'glitch-horror': 'animate-glitch',
  'flicker': 'animate-flicker',
};

export interface VideoPreviewFiltersProps {
  /** Selected AI style ID (must exist in styleFilters) */
  selectedStyleId: string | null;
  /** Filter intensity 0–100 */
  intensity?: number;
  /** Optional label/badge showing current style name */
  showLabel?: boolean;
  /** Performance: skip overlays/grain (filter only) */
  filterOnly?: boolean;
  /** Optional clip-path for before/after (e.g. comparison view) */
  clipPath?: string;
  className?: string;
}

export const VideoPreviewFilters: React.FC<VideoPreviewFiltersProps> = ({
  selectedStyleId,
  intensity = 100,
  showLabel = false,
  filterOnly = false,
  clipPath,
  className,
}) => {
  const style = useMemo(() => {
    if (!selectedStyleId || !styleFilters[selectedStyleId]) return null;
    return styleFilters[selectedStyleId];
  }, [selectedStyleId]);

  const intensityMultiplier = intensity / 100;
  const filterLayerClass = style?.animation ? animationClassMap[style.animation] : undefined;
  const overlayLayerClass = style?.animation && style.animation !== 'shake-subtle' ? animationClassMap[style.animation] : undefined;

  if (!style) return null;

  const wrapperStyle: React.CSSProperties = clipPath ? { clipPath } : {};
  const showLetterbox = !filterOnly && style.letterbox;
  const showVignette = !filterOnly && (style.vignetteStrength != null ? style.vignetteStrength > 0 : ['thriller', 'horror', 'epic', 'noir'].includes(selectedStyleId!));
  const showGrain = !filterOnly && (style.grainAmount != null ? style.grainAmount > 0 : ['nostalgic', 'noir', 'horror'].includes(selectedStyleId!));
  const showLightLeak = !filterOnly && (style.lightLeak ?? ['romantic', 'dreamy', 'spiritual'].includes(selectedStyleId!));

  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={wrapperStyle}
      data-video-preview-filter={selectedStyleId}
      data-filter-intensity={intensity}
    >
      {/* Main filter layer (backdrop-filter on video) */}
      <div
        className={cn(
          'absolute inset-0 transition-all duration-500 ease-out',
          filterLayerClass,
          className
        )}
        style={{
          backdropFilter: style.filter,
          WebkitBackdropFilter: style.filter,
          opacity: intensityMultiplier,
        }}
      />

      {/* Overlay gradient */}
      {!filterOnly && style.overlay && (style.overlayOpacity ?? 0) > 0 && (
        <div
          className={cn(
            'absolute inset-0 transition-all duration-500',
            overlayLayerClass
          )}
          style={{
            background: style.overlay,
            opacity: (style.overlayOpacity ?? 0.3) * intensityMultiplier,
            mixBlendMode: (style.mixBlendMode as React.CSSProperties['mixBlendMode']) || 'normal',
          }}
        />
      )}

      {/* Film grain */}
      {showGrain && (
        <div
          className="absolute inset-0 pointer-events-none mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
            opacity: (style.grainAmount ?? 0.15) * intensityMultiplier,
          }}
        />
      )}

      {/* Letterbox */}
      {showLetterbox && (
        <>
          <div
            className="absolute top-0 left-0 right-0 bg-black transition-all duration-500"
            style={{ height: `${6 * intensityMultiplier}%` }}
          />
          <div
            className="absolute bottom-0 left-0 right-0 bg-black transition-all duration-500"
            style={{ height: `${6 * intensityMultiplier}%` }}
          />
        </>
      )}

      {/* Vignette */}
      {showVignette && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            boxShadow: `inset 0 0 ${100 * intensityMultiplier}px rgba(0,0,0,${(style.vignetteStrength ?? 0.5) * intensityMultiplier})`,
          }}
        />
      )}

      {/* Light leak */}
      {showLightLeak && (
        <div
          className="absolute inset-0 pointer-events-none animate-light-leak"
          style={{
            background: 'radial-gradient(ellipse at 80% 20%, rgba(255,200,150,0.35) 0%, transparent 50%)',
            opacity: 0.4 * intensityMultiplier,
          }}
        />
      )}

      {/* Optional label badge */}
      {showLabel && style.displayName && (
        <div
          className="absolute bottom-2 left-2 px-2 py-1 rounded-md bg-black/60 text-white text-xs font-medium backdrop-blur-sm"
          data-filter-label
        >
          {style.displayName}
        </div>
      )}
    </div>
  );
};

/**
 * Returns the CSS filter string for a given style and intensity (for export/server-side or canvas).
 * Use this when baking the filter into an exported video or image.
 */
export function getFilterCss(styleId: string | null, intensityPercent: number = 100): string | null {
  if (!styleId || !styleFilters[styleId]) return null;
  const style = styleFilters[styleId];
  const t = intensityPercent / 100;
  if (t <= 0) return 'none';
  if (t >= 1) return style.filter;
  return style.filter;
}

/**
 * Returns full filter style for export pipeline (filter CSS + overlay/grain/letterbox flags).
 */
export function getFilterStyleForExport(
  styleId: string | null,
  intensityPercent: number = 100
): { filter: string; displayName: string; letterbox: boolean; vignette: number; grain: number } | null {
  if (!styleId || !styleFilters[styleId]) return null;
  const s = styleFilters[styleId];
  const t = intensityPercent / 100;
  return {
    filter: s.filter,
    displayName: s.displayName ?? styleId,
    letterbox: s.letterbox ?? false,
    vignette: (s.vignetteStrength ?? 0) * t,
    grain: (s.grainAmount ?? 0) * t,
  };
}

/**
 * List of all supported style IDs (for UI/validation).
 */
export function getSupportedStyleIds(): string[] {
  return Object.keys(styleFilters);
}
