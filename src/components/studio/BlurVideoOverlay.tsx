import React, { useRef, useEffect, useState } from 'react';
import { BlurSegment } from './MediaBlurEditor';
import { getBlurFilterStyle } from './blurUtils';

interface BlurVideoOverlayProps {
  children: React.ReactNode;
  segments: BlurSegment[];
  currentTime: number;
  /** Creator mode: always show blur. Viewer mode: respect CAF unlock. */
  isCreatorMode?: boolean;
}

/**
 * Wraps video/image and applies blur overlay when currentTime is within a blur segment.
 * In creator mode, blur is always visible. In viewer mode, CAF unlock state would be considered.
 */
export const BlurVideoOverlay: React.FC<BlurVideoOverlayProps> = ({
  children,
  segments,
  currentTime,
  isCreatorMode = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeSegment, setActiveSegment] = useState<BlurSegment | null>(null);

  useEffect(() => {
    const segment = segments.find((s) => currentTime >= s.startTime && currentTime <= s.endTime);
    setActiveSegment(segment ?? null);
  }, [currentTime, segments]);

  if (!activeSegment || !segments.length) {
    return <>{children}</>;
  }

  const isVideoHidden = activeSegment.videoHidden;
  const shouldApplyBlur = !isVideoHidden;
  const blurStyle = shouldApplyBlur ? getBlurFilterStyle({
    blurType: activeSegment.blurType,
    blurIntensity: activeSegment.blurIntensity,
  }) : undefined;

  const isVignette = activeSegment.blurType === 'vignette';
  const vignetteOpacity = (activeSegment.blurIntensity / 100) * 0.85;

  return (
    <div ref={containerRef} className="absolute inset-0 w-full h-full">
      <div
        className="absolute inset-0 w-full h-full [&>video]:w-full [&>video]:h-full [&>video]:object-contain [&>img]:w-full [&>img]:h-full [&>img]:object-contain"
        style={blurStyle}
      >
        {children}
      </div>
      {isVignette && shouldApplyBlur && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,${vignetteOpacity}) 100%)`,
          }}
        />
      )}
      {isVideoHidden && (
        <div className="absolute inset-0 bg-black/95 flex items-center justify-center pointer-events-none">
          <div className="text-center text-white/80">
            <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-2">
              <span className="text-2xl">🔒</span>
            </div>
            <p className="text-sm font-medium">Hidden segment</p>
            {!activeSegment.audioMuted && (
              <p className="text-xs opacity-70 mt-0.5">Audio playing</p>
            )}
          </div>
        </div>
      )}
      {activeSegment.cafEnabled && isCreatorMode && (
        <div className="absolute top-2 left-2 px-2 py-1 rounded-full bg-amber-500/90 text-white text-xs font-medium">
          CAF locked
        </div>
      )}
    </div>
  );
};

export default BlurVideoOverlay;
