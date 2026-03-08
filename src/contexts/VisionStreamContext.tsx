/**
 * VisionStreamContext – optional shared camera stream provider.
 * When this context provides a stream, VisionContext delegates to it.
 * When it provides null (default), VisionContext owns the camera itself.
 */
import React, { createContext, useContext } from 'react';

export interface VisionStreamSample {
  hasFace: boolean;
  eyeEAR?: number;
  eyeOpenness?: number;
  gazePosition?: { x: number; y: number };
  headYaw?: number;
  headPitch?: number;
  handCount?: number;
  handGesture?: 'none' | 'pinch' | 'point' | 'openPalm' | 'closedFist';
  handGestureConfidence?: number;
  lastHandGestureTime?: number | null;
  commandIntent?: 'none' | 'select' | 'confirm' | 'next' | 'previous';
  commandConfidence?: number;
  lastCommandTime?: number | null;
  livenessScore?: number;
  livenessStable?: boolean;
}

export interface VisionStreamHandle {
  subscribe: (cb: (s: VisionStreamSample) => void) => () => void;
  isActive: boolean;
  needsUserGesture?: boolean;
  requestOwner: (id: string) => () => void;
  startFromUserGesture: () => Promise<void>;
}

const VisionStreamContext = createContext<VisionStreamHandle | null>(null);

export function useVisionStream(): VisionStreamHandle | null {
  return useContext(VisionStreamContext);
}

interface VisionStreamProviderProps {
  children: React.ReactNode;
}

/**
 * Provides null so VisionContext uses its own camera.
 * Can be extended later to provide a shared stream if needed.
 */
export function VisionStreamProvider({ children }: VisionStreamProviderProps) {
  return (
    <VisionStreamContext.Provider value={null}>
      {children}
    </VisionStreamContext.Provider>
  );
}
