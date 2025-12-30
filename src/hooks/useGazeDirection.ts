import { useState, useEffect, useRef, useCallback } from 'react';

export type GazeDirection = 'center' | 'left' | 'right' | 'up' | 'down';

export interface GazeDirectionState {
  currentDirection: GazeDirection;
  normalizedPosition: { x: number; y: number }; // -1 to 1 from center
  isTracking: boolean;
  lastRapidMovement: GazeDirection | null;
  rapidMovementTimestamp: number | null;
}

export interface GazeZone {
  direction: GazeDirection;
  threshold: number; // How far from center (0-1) to trigger
}

interface UseGazeDirectionOptions {
  enabled?: boolean;
  edgeThreshold?: number; // Distance from edge to trigger directional command (0-0.5)
  rapidMovementSpeed?: number; // Pixels per frame to consider "rapid"
  rapidMovementCooldown?: number; // Ms between rapid movement detections
  onRapidMovement?: (direction: GazeDirection) => void;
  onDirectionChange?: (direction: GazeDirection) => void;
}

const DEFAULT_OPTIONS: Required<Omit<UseGazeDirectionOptions, 'onRapidMovement' | 'onDirectionChange'>> = {
  enabled: false,
  edgeThreshold: 0.3,
  rapidMovementSpeed: 80,
  rapidMovementCooldown: 500,
};

export function useGazeDirection(options: UseGazeDirectionOptions = {}) {
  const {
    enabled = DEFAULT_OPTIONS.enabled,
    edgeThreshold = DEFAULT_OPTIONS.edgeThreshold,
    rapidMovementSpeed = DEFAULT_OPTIONS.rapidMovementSpeed,
    rapidMovementCooldown = DEFAULT_OPTIONS.rapidMovementCooldown,
    onRapidMovement,
    onDirectionChange,
  } = options;

  const [state, setState] = useState<GazeDirectionState>({
    currentDirection: 'center',
    normalizedPosition: { x: 0, y: 0 },
    isTracking: false,
    lastRapidMovement: null,
    rapidMovementTimestamp: null,
  });

  // Refs for tracking
  const positionHistoryRef = useRef<{ x: number; y: number; timestamp: number }[]>([]);
  const lastRapidMovementTimeRef = useRef<number>(0);
  const callbackRefs = useRef({ onRapidMovement, onDirectionChange });
  const prevDirectionRef = useRef<GazeDirection>('center');

  useEffect(() => {
    callbackRefs.current = { onRapidMovement, onDirectionChange };
  }, [onRapidMovement, onDirectionChange]);

  // Calculate direction from normalized position
  const calculateDirection = useCallback((x: number, y: number): GazeDirection => {
    // Check if clearly in an edge zone
    const absX = Math.abs(x);
    const absY = Math.abs(y);

    // Prioritize the axis with greater deviation
    if (absX > edgeThreshold || absY > edgeThreshold) {
      if (absX > absY) {
        return x < 0 ? 'left' : 'right';
      } else {
        return y < 0 ? 'up' : 'down';
      }
    }

    return 'center';
  }, [edgeThreshold]);

  // Detect rapid movement from position history
  const detectRapidMovement = useCallback((newX: number, newY: number): GazeDirection | null => {
    const now = Date.now();
    
    // Check cooldown
    if (now - lastRapidMovementTimeRef.current < rapidMovementCooldown) {
      return null;
    }

    const history = positionHistoryRef.current;
    if (history.length < 3) return null;

    // Look at last few frames
    const recentHistory = history.slice(-5);
    const oldestPoint = recentHistory[0];
    const newestPoint = { x: newX, y: newY, timestamp: now };

    const timeDelta = now - oldestPoint.timestamp;
    if (timeDelta === 0) return null;

    const deltaX = (newestPoint.x - oldestPoint.x) * window.innerWidth;
    const deltaY = (newestPoint.y - oldestPoint.y) * window.innerHeight;
    
    const speedX = Math.abs(deltaX) / (timeDelta / 1000);
    const speedY = Math.abs(deltaY) / (timeDelta / 1000);

    const threshold = rapidMovementSpeed * 60; // Convert to per-second

    if (speedX > threshold && speedX > speedY) {
      lastRapidMovementTimeRef.current = now;
      return deltaX < 0 ? 'left' : 'right';
    }
    if (speedY > threshold && speedY > speedX) {
      lastRapidMovementTimeRef.current = now;
      return deltaY < 0 ? 'up' : 'down';
    }

    return null;
  }, [rapidMovementCooldown, rapidMovementSpeed]);

  // Update gaze position (called from parent hook)
  const updateGazePosition = useCallback((screenX: number, screenY: number) => {
    if (!enabled) return;

    // Normalize to -1 to 1 (center = 0,0)
    const normalizedX = (screenX / window.innerWidth) * 2 - 1;
    const normalizedY = (screenY / window.innerHeight) * 2 - 1;

    // Add to history
    const now = Date.now();
    positionHistoryRef.current.push({ x: normalizedX, y: normalizedY, timestamp: now });
    if (positionHistoryRef.current.length > 10) {
      positionHistoryRef.current.shift();
    }

    // Detect rapid movement
    const rapidMovement = detectRapidMovement(normalizedX, normalizedY);
    
    // Calculate current direction
    const newDirection = calculateDirection(normalizedX, normalizedY);

    setState(prev => {
      const updates: Partial<GazeDirectionState> = {
        normalizedPosition: { x: normalizedX, y: normalizedY },
        isTracking: true,
      };

      if (rapidMovement) {
        updates.lastRapidMovement = rapidMovement;
        updates.rapidMovementTimestamp = now;
        callbackRefs.current.onRapidMovement?.(rapidMovement);
      }

      if (newDirection !== prev.currentDirection) {
        updates.currentDirection = newDirection;
        prevDirectionRef.current = newDirection;
        callbackRefs.current.onDirectionChange?.(newDirection);
      }

      return { ...prev, ...updates };
    });
  }, [enabled, calculateDirection, detectRapidMovement]);

  // Reset tracking
  const resetTracking = useCallback(() => {
    positionHistoryRef.current = [];
    lastRapidMovementTimeRef.current = 0;
    setState({
      currentDirection: 'center',
      normalizedPosition: { x: 0, y: 0 },
      isTracking: false,
      lastRapidMovement: null,
      rapidMovementTimestamp: null,
    });
  }, []);

  // Cleanup on disable
  useEffect(() => {
    if (!enabled) {
      resetTracking();
    }
  }, [enabled, resetTracking]);

  return {
    ...state,
    updateGazePosition,
    resetTracking,
  };
}
