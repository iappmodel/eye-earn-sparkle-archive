// Draggable Button Wrapper - Long press to drag any button to a new position
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Move } from 'lucide-react';

interface Position {
  x: number;
  y: number;
}

interface DraggableButtonProps {
  children: React.ReactNode;
  id: string;
  initialPosition?: Position;
  onPositionChange?: (id: string, position: Position) => void;
  longPressDelay?: number;
  className?: string;
}

// Storage key for persisted positions
const POSITIONS_STORAGE_KEY = 'visuai-button-positions';

// Load saved positions from localStorage
export const loadSavedPositions = (): Record<string, Position> => {
  try {
    const saved = localStorage.getItem(POSITIONS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
};

// Save positions to localStorage
export const savePositions = (positions: Record<string, Position>) => {
  try {
    localStorage.setItem(POSITIONS_STORAGE_KEY, JSON.stringify(positions));
  } catch (e) {
    console.error('Failed to save button positions:', e);
  }
};

export const DraggableButton: React.FC<DraggableButtonProps> = ({
  children,
  id,
  initialPosition,
  onPositionChange,
  longPressDelay = 2000,
  className,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLongPressing, setIsLongPressing] = useState(false);
  const [position, setPosition] = useState<Position | null>(initialPosition || null);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);
  const startPosRef = useRef<Position>({ x: 0, y: 0 });
  const hasMoved = useRef(false);

  // Load saved position on mount
  useEffect(() => {
    const savedPositions = loadSavedPositions();
    if (savedPositions[id]) {
      setPosition(savedPositions[id]);
    }
  }, [id]);

  // Clear long press timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    startPosRef.current = { x: e.clientX, y: e.clientY };
    hasMoved.current = false;

    // Start long press timer
    longPressTimerRef.current = setTimeout(() => {
      if (!hasMoved.current) {
        setIsLongPressing(true);
        setIsDragging(true);
        
        // Haptic feedback
        if (navigator.vibrate) {
          navigator.vibrate([50, 30, 50]);
        }
        
        // Calculate offset from element center
        if (elementRef.current) {
          const rect = elementRef.current.getBoundingClientRect();
          setDragOffset({
            x: e.clientX - rect.left - rect.width / 2,
            y: e.clientY - rect.top - rect.height / 2,
          });
          
          // Set initial position if not already set
          if (!position) {
            setPosition({
              x: rect.left + rect.width / 2,
              y: rect.top + rect.height / 2,
            });
          }
        }
      }
    }, longPressDelay);
  }, [longPressDelay, position]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    // Check if moved significantly (prevents accidental drags)
    const dx = Math.abs(e.clientX - startPosRef.current.x);
    const dy = Math.abs(e.clientY - startPosRef.current.y);
    if (dx > 10 || dy > 10) {
      hasMoved.current = true;
      // Cancel long press if moved before timer completes
      if (longPressTimerRef.current && !isDragging) {
        clearTimeout(longPressTimerRef.current);
      }
    }

    if (isDragging) {
      e.preventDefault();
      e.stopPropagation();
      
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      // Constrain to viewport
      const padding = 24;
      const constrainedX = Math.max(padding, Math.min(window.innerWidth - padding, newX));
      const constrainedY = Math.max(padding, Math.min(window.innerHeight - padding, newY));
      
      setPosition({ x: constrainedX, y: constrainedY });
    }
  }, [isDragging, dragOffset]);

  const handlePointerUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    
    if (isDragging && position) {
      // Save position
      const savedPositions = loadSavedPositions();
      savedPositions[id] = position;
      savePositions(savedPositions);
      
      onPositionChange?.(id, position);
      
      // Haptic feedback for drop
      if (navigator.vibrate) {
        navigator.vibrate(30);
      }
    }
    
    setIsDragging(false);
    setIsLongPressing(false);
  }, [isDragging, position, id, onPositionChange]);

  const handlePointerCancel = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    setIsDragging(false);
    setIsLongPressing(false);
  }, []);

  // Reset position handler
  const resetPosition = useCallback(() => {
    setPosition(null);
    const savedPositions = loadSavedPositions();
    delete savedPositions[id];
    savePositions(savedPositions);
    
    if (navigator.vibrate) {
      navigator.vibrate([30, 20, 30]);
    }
  }, [id]);

  // If position is set, render as absolutely positioned
  if (position) {
    return (
      <div
        ref={elementRef}
        className={cn(
          'fixed z-50 touch-none select-none',
          isDragging && 'cursor-grabbing scale-110',
          isLongPressing && !isDragging && 'animate-pulse',
          className
        )}
        style={{
          left: position.x,
          top: position.y,
          transform: 'translate(-50%, -50%)',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerUp}
      >
        {/* Drag indicator */}
        {isDragging && (
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-full bg-primary/90 text-primary-foreground text-[10px] font-medium whitespace-nowrap flex items-center gap-1 animate-fade-in">
            <Move className="w-3 h-3" />
            Drag to position
          </div>
        )}
        
        {/* Reset button when dragging */}
        {isDragging && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              resetPosition();
            }}
            className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-full bg-destructive/90 text-destructive-foreground text-[10px] font-medium whitespace-nowrap animate-fade-in"
          >
            Reset
          </button>
        )}
        
        {/* Visual feedback ring when dragging */}
        {isDragging && (
          <div className="absolute inset-0 -m-2 rounded-full border-2 border-dashed border-primary animate-pulse pointer-events-none" />
        )}
        
        {children}
      </div>
    );
  }

  // Default render (in flow, not repositioned)
  return (
    <div
      ref={elementRef}
      className={cn(
        'touch-none select-none',
        isLongPressing && 'animate-pulse scale-105',
        className
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      {/* Long press indicator */}
      {isLongPressing && !isDragging && (
        <div className="absolute inset-0 -m-1 rounded-full border-2 border-primary/50 animate-ping pointer-events-none" />
      )}
      {children}
    </div>
  );
};

export default DraggableButton;
