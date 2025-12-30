// Draggable Button Wrapper - Long press to drag any button to a new position
// Features: Snap-to-edge, grid overlay, position persistence
import React, { useState, useRef, useCallback, useEffect, createContext, useContext } from 'react';
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

// Snap configuration
const SNAP_THRESHOLD = 40; // Distance to trigger snap
const EDGE_PADDING = 16; // Padding from edges when snapped

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

// Clear all saved positions
export const clearAllPositions = () => {
  try {
    localStorage.removeItem(POSITIONS_STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear button positions:', e);
  }
};

// Get count of repositioned buttons
export const getRepositionedCount = (): number => {
  return Object.keys(loadSavedPositions()).length;
};

// Context for global drag state (to show grid overlay)
interface DragContextType {
  isAnyDragging: boolean;
  setDragging: (dragging: boolean) => void;
}

const DragContext = createContext<DragContextType>({
  isAnyDragging: false,
  setDragging: () => {},
});

export const useDragContext = () => useContext(DragContext);

export const DragContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAnyDragging, setIsAnyDragging] = useState(false);
  
  const setDragging = useCallback((dragging: boolean) => {
    setIsAnyDragging(dragging);
  }, []);

  return (
    <DragContext.Provider value={{ isAnyDragging, setDragging }}>
      {children}
      {/* Grid Overlay - Shows during any drag operation */}
      {isAnyDragging && <DragGridOverlay />}
    </DragContext.Provider>
  );
};

// Grid overlay component
const DragGridOverlay: React.FC = () => {
  const gridSize = 40;
  const cols = Math.ceil(window.innerWidth / gridSize);
  const rows = Math.ceil(window.innerHeight / gridSize);

  return (
    <div className="fixed inset-0 z-40 pointer-events-none animate-fade-in">
      {/* Semi-transparent overlay */}
      <div className="absolute inset-0 bg-background/20 backdrop-blur-[1px]" />
      
      {/* Grid lines */}
      <svg className="absolute inset-0 w-full h-full opacity-30">
        <defs>
          <pattern id="grid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
            <path 
              d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} 
              fill="none" 
              stroke="hsl(var(--primary))" 
              strokeWidth="0.5"
              strokeOpacity="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
      
      {/* Edge snap indicators */}
      <div className="absolute top-0 left-0 right-0 h-10 border-b-2 border-dashed border-primary/30" />
      <div className="absolute bottom-0 left-0 right-0 h-10 border-t-2 border-dashed border-primary/30" />
      <div className="absolute top-0 bottom-0 left-0 w-10 border-r-2 border-dashed border-primary/30" />
      <div className="absolute top-0 bottom-0 right-0 w-10 border-l-2 border-dashed border-primary/30" />
      
      {/* Corner snap zones */}
      {[
        'top-0 left-0',
        'top-0 right-0',
        'bottom-0 left-0',
        'bottom-0 right-0',
      ].map((pos, i) => (
        <div 
          key={i}
          className={cn(
            'absolute w-12 h-12 rounded-full bg-primary/10 border border-primary/30',
            pos
          )}
          style={{ margin: EDGE_PADDING }}
        />
      ))}
      
      {/* Center indicator */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border-2 border-dashed border-accent/40"
      />
    </div>
  );
};

// Snap position to edges/corners
const snapToEdge = (pos: Position, elementSize: number = 48): Position => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const half = elementSize / 2;
  
  let snappedX = pos.x;
  let snappedY = pos.y;
  
  // Horizontal snap
  if (pos.x < SNAP_THRESHOLD + half) {
    snappedX = EDGE_PADDING + half;
  } else if (pos.x > vw - SNAP_THRESHOLD - half) {
    snappedX = vw - EDGE_PADDING - half;
  }
  
  // Vertical snap
  if (pos.y < SNAP_THRESHOLD + half) {
    snappedY = EDGE_PADDING + half;
  } else if (pos.y > vh - SNAP_THRESHOLD - half) {
    snappedY = vh - EDGE_PADDING - half;
  }
  
  // Center snap (horizontal)
  if (Math.abs(pos.x - vw / 2) < SNAP_THRESHOLD) {
    snappedX = vw / 2;
  }
  
  // Center snap (vertical)
  if (Math.abs(pos.y - vh / 2) < SNAP_THRESHOLD) {
    snappedY = vh / 2;
  }
  
  return { x: snappedX, y: snappedY };
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
  const [isSnapped, setIsSnapped] = useState(false);
  
  const { setDragging: setGlobalDragging } = useDragContext();
  
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

  // Update global drag state
  useEffect(() => {
    setGlobalDragging(isDragging);
  }, [isDragging, setGlobalDragging]);

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
      
      const rawX = e.clientX - dragOffset.x;
      const rawY = e.clientY - dragOffset.y;
      
      // Constrain to viewport
      const padding = 24;
      const constrainedX = Math.max(padding, Math.min(window.innerWidth - padding, rawX));
      const constrainedY = Math.max(padding, Math.min(window.innerHeight - padding, rawY));
      
      const rawPos = { x: constrainedX, y: constrainedY };
      const snappedPos = snapToEdge(rawPos);
      
      // Check if position was snapped
      const wasSnapped = snappedPos.x !== constrainedX || snappedPos.y !== constrainedY;
      if (wasSnapped && !isSnapped) {
        // Haptic feedback on snap
        if (navigator.vibrate) {
          navigator.vibrate(15);
        }
      }
      setIsSnapped(wasSnapped);
      
      setPosition(snappedPos);
    }
  }, [isDragging, dragOffset, isSnapped]);

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
        navigator.vibrate(isSnapped ? [20, 10, 20] : 30);
      }
    }
    
    setIsDragging(false);
    setIsLongPressing(false);
    setIsSnapped(false);
  }, [isDragging, position, id, onPositionChange, isSnapped]);

  const handlePointerCancel = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    setIsDragging(false);
    setIsLongPressing(false);
    setIsSnapped(false);
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
          isSnapped && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
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
            {isSnapped ? 'Snapped!' : 'Drag to position'}
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
        {isDragging && !isSnapped && (
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
        'touch-none select-none relative',
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
