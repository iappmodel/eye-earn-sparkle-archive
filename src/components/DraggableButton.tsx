// Draggable Button Wrapper - Long press to drag any button to a new position
// Features: Snap-to-edge, grid overlay, position persistence, grouping, magnetic snap points
import React, { useState, useRef, useCallback, useEffect, createContext, useContext } from 'react';
import { cn } from '@/lib/utils';
import { Move, Link2, Unlink, Magnet, Plus, X } from 'lucide-react';

interface Position {
  x: number;
  y: number;
}

interface MagneticSnapPoint {
  id: string;
  position: Position;
  name: string;
}

interface ButtonGroup {
  id: string;
  buttonIds: string[];
  name: string;
}

interface DraggableButtonProps {
  children: React.ReactNode;
  id: string;
  initialPosition?: Position;
  onPositionChange?: (id: string, position: Position) => void;
  longPressDelay?: number;
  className?: string;
}

// Storage keys
const POSITIONS_STORAGE_KEY = 'visuai-button-positions';
const GROUPS_STORAGE_KEY = 'visuai-button-groups';
const SNAP_POINTS_STORAGE_KEY = 'visuai-magnetic-snap-points';

// Snap configuration
const SNAP_THRESHOLD = 40;
const EDGE_PADDING = 16;
const MAGNETIC_SNAP_THRESHOLD = 50;

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
    localStorage.removeItem(GROUPS_STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear button positions:', e);
  }
};

// Get count of repositioned buttons
export const getRepositionedCount = (): number => {
  return Object.keys(loadSavedPositions()).length;
};

// Button Groups Management
export const loadButtonGroups = (): ButtonGroup[] => {
  try {
    const saved = localStorage.getItem(GROUPS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

export const saveButtonGroups = (groups: ButtonGroup[]) => {
  try {
    localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(groups));
  } catch (e) {
    console.error('Failed to save button groups:', e);
  }
};

export const createButtonGroup = (buttonIds: string[], name?: string): ButtonGroup => {
  const groups = loadButtonGroups();
  const newGroup: ButtonGroup = {
    id: `group-${Date.now()}`,
    buttonIds,
    name: name || `Group ${groups.length + 1}`,
  };
  groups.push(newGroup);
  saveButtonGroups(groups);
  return newGroup;
};

export const getButtonGroup = (buttonId: string): ButtonGroup | undefined => {
  const groups = loadButtonGroups();
  return groups.find(g => g.buttonIds.includes(buttonId));
};

export const removeButtonFromGroup = (buttonId: string) => {
  const groups = loadButtonGroups();
  const updatedGroups = groups.map(g => ({
    ...g,
    buttonIds: g.buttonIds.filter(id => id !== buttonId),
  })).filter(g => g.buttonIds.length > 1);
  saveButtonGroups(updatedGroups);
};

export const dissolveGroup = (groupId: string) => {
  const groups = loadButtonGroups();
  saveButtonGroups(groups.filter(g => g.id !== groupId));
};

// Magnetic Snap Points Management
export const loadMagneticSnapPoints = (): MagneticSnapPoint[] => {
  try {
    const saved = localStorage.getItem(SNAP_POINTS_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

export const saveMagneticSnapPoints = (points: MagneticSnapPoint[]) => {
  try {
    localStorage.setItem(SNAP_POINTS_STORAGE_KEY, JSON.stringify(points));
  } catch (e) {
    console.error('Failed to save magnetic snap points:', e);
  }
};

export const addMagneticSnapPoint = (position: Position, name?: string): MagneticSnapPoint => {
  const points = loadMagneticSnapPoints();
  const newPoint: MagneticSnapPoint = {
    id: `snap-${Date.now()}`,
    position,
    name: name || `Point ${points.length + 1}`,
  };
  points.push(newPoint);
  saveMagneticSnapPoints(points);
  return newPoint;
};

export const removeMagneticSnapPoint = (pointId: string) => {
  const points = loadMagneticSnapPoints();
  saveMagneticSnapPoints(points.filter(p => p.id !== pointId));
};

export const clearAllMagneticSnapPoints = () => {
  try {
    localStorage.removeItem(SNAP_POINTS_STORAGE_KEY);
  } catch (e) {
    console.error('Failed to clear magnetic snap points:', e);
  }
};

// Context for global drag state
interface DragContextType {
  isAnyDragging: boolean;
  setDragging: (dragging: boolean) => void;
  selectedForGrouping: string[];
  toggleGroupingSelection: (id: string) => void;
  clearGroupingSelection: () => void;
  isGroupingMode: boolean;
  setGroupingMode: (mode: boolean) => void;
  isSnapPointMode: boolean;
  setSnapPointMode: (mode: boolean) => void;
  magneticSnapPoints: MagneticSnapPoint[];
  refreshSnapPoints: () => void;
}

const DragContext = createContext<DragContextType>({
  isAnyDragging: false,
  setDragging: () => {},
  selectedForGrouping: [],
  toggleGroupingSelection: () => {},
  clearGroupingSelection: () => {},
  isGroupingMode: false,
  setGroupingMode: () => {},
  isSnapPointMode: false,
  setSnapPointMode: () => {},
  magneticSnapPoints: [],
  refreshSnapPoints: () => {},
});

export const useDragContext = () => useContext(DragContext);

export const DragContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAnyDragging, setIsAnyDragging] = useState(false);
  const [selectedForGrouping, setSelectedForGrouping] = useState<string[]>([]);
  const [isGroupingMode, setGroupingMode] = useState(false);
  const [isSnapPointMode, setSnapPointMode] = useState(false);
  const [magneticSnapPoints, setMagneticSnapPoints] = useState<MagneticSnapPoint[]>([]);

  useEffect(() => {
    setMagneticSnapPoints(loadMagneticSnapPoints());
  }, []);

  const refreshSnapPoints = useCallback(() => {
    setMagneticSnapPoints(loadMagneticSnapPoints());
  }, []);

  const setDragging = useCallback((dragging: boolean) => {
    setIsAnyDragging(dragging);
  }, []);

  const toggleGroupingSelection = useCallback((id: string) => {
    setSelectedForGrouping(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }, []);

  const clearGroupingSelection = useCallback(() => {
    setSelectedForGrouping([]);
  }, []);

  const handleScreenTapForSnapPoint = useCallback((e: React.MouseEvent) => {
    if (!isSnapPointMode) return;
    
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('[data-draggable]')) return;
    
    const newPoint = addMagneticSnapPoint({ x: e.clientX, y: e.clientY });
    setMagneticSnapPoints(prev => [...prev, newPoint]);
    
    if (navigator.vibrate) {
      navigator.vibrate([30, 20, 30]);
    }
  }, [isSnapPointMode]);

  return (
    <DragContext.Provider value={{ 
      isAnyDragging, 
      setDragging,
      selectedForGrouping,
      toggleGroupingSelection,
      clearGroupingSelection,
      isGroupingMode,
      setGroupingMode,
      isSnapPointMode,
      setSnapPointMode,
      magneticSnapPoints,
      refreshSnapPoints,
    }}>
      <div onClick={handleScreenTapForSnapPoint} className="contents">
        {children}
      </div>
      
      {/* Grid Overlay */}
      {isAnyDragging && <DragGridOverlay magneticSnapPoints={magneticSnapPoints} />}
      
      {/* Grouping Mode UI */}
      {isGroupingMode && (
        <GroupingModeOverlay 
          selectedIds={selectedForGrouping}
          onCreateGroup={() => {
            if (selectedForGrouping.length >= 2) {
              createButtonGroup(selectedForGrouping);
              clearGroupingSelection();
              setGroupingMode(false);
              if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
            }
          }}
          onCancel={() => {
            clearGroupingSelection();
            setGroupingMode(false);
          }}
        />
      )}
      
      {/* Snap Point Mode UI */}
      {isSnapPointMode && (
        <SnapPointModeOverlay 
          points={magneticSnapPoints}
          onRemovePoint={(id) => {
            removeMagneticSnapPoint(id);
            setMagneticSnapPoints(prev => prev.filter(p => p.id !== id));
          }}
          onClose={() => setSnapPointMode(false)}
        />
      )}
      
      {/* Render magnetic snap points */}
      {magneticSnapPoints.map(point => (
        <div
          key={point.id}
          className="fixed z-30 pointer-events-none"
          style={{ left: point.position.x, top: point.position.y, transform: 'translate(-50%, -50%)' }}
        >
          <div className={cn(
            "w-4 h-4 rounded-full border-2 border-accent bg-accent/20",
            isAnyDragging && "w-8 h-8 animate-pulse border-primary bg-primary/30"
          )} />
        </div>
      ))}
    </DragContext.Provider>
  );
};

// Grouping Mode Overlay
const GroupingModeOverlay: React.FC<{
  selectedIds: string[];
  onCreateGroup: () => void;
  onCancel: () => void;
}> = ({ selectedIds, onCreateGroup, onCancel }) => (
  <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-card/95 backdrop-blur-md border border-border shadow-lg animate-fade-in">
    <Link2 className="w-4 h-4 text-primary" />
    <span className="text-sm font-medium">
      {selectedIds.length < 2 
        ? `Select ${2 - selectedIds.length} more buttons` 
        : `${selectedIds.length} buttons selected`}
    </span>
    <button
      onClick={onCreateGroup}
      disabled={selectedIds.length < 2}
      className={cn(
        "px-3 py-1 rounded-full text-xs font-medium transition-all",
        selectedIds.length >= 2 
          ? "bg-primary text-primary-foreground hover:bg-primary/90" 
          : "bg-muted text-muted-foreground"
      )}
    >
      Group
    </button>
    <button
      onClick={onCancel}
      className="px-3 py-1 rounded-full text-xs font-medium bg-destructive/20 text-destructive hover:bg-destructive/30"
    >
      Cancel
    </button>
  </div>
);

// Snap Point Mode Overlay
const SnapPointModeOverlay: React.FC<{
  points: MagneticSnapPoint[];
  onRemovePoint: (id: string) => void;
  onClose: () => void;
}> = ({ points, onRemovePoint, onClose }) => (
  <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 px-4 py-3 rounded-xl bg-card/95 backdrop-blur-md border border-border shadow-lg animate-fade-in max-w-[90vw]">
    <div className="flex items-center gap-2 w-full">
      <Magnet className="w-4 h-4 text-accent" />
      <span className="text-sm font-medium flex-1">Tap anywhere to add snap point</span>
      <button onClick={onClose} className="p-1 rounded-full hover:bg-muted">
        <X className="w-4 h-4" />
      </button>
    </div>
    {points.length > 0 && (
      <div className="flex flex-wrap gap-1 mt-2">
        {points.map(point => (
          <button
            key={point.id}
            onClick={() => onRemovePoint(point.id)}
            className="px-2 py-1 rounded-full text-[10px] bg-accent/20 text-accent-foreground hover:bg-destructive/20 hover:text-destructive flex items-center gap-1"
          >
            {point.name}
            <X className="w-3 h-3" />
          </button>
        ))}
      </div>
    )}
  </div>
);

// Grid overlay component
const DragGridOverlay: React.FC<{ magneticSnapPoints: MagneticSnapPoint[] }> = ({ magneticSnapPoints }) => {
  const gridSize = 40;

  return (
    <div className="fixed inset-0 z-40 pointer-events-none animate-fade-in">
      <div className="absolute inset-0 bg-background/20 backdrop-blur-[1px]" />
      
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
      
      <div className="absolute top-0 left-0 right-0 h-10 border-b-2 border-dashed border-primary/30" />
      <div className="absolute bottom-0 left-0 right-0 h-10 border-t-2 border-dashed border-primary/30" />
      <div className="absolute top-0 bottom-0 left-0 w-10 border-r-2 border-dashed border-primary/30" />
      <div className="absolute top-0 bottom-0 right-0 w-10 border-l-2 border-dashed border-primary/30" />
      
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
      
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border-2 border-dashed border-accent/40" />
      
      {/* Magnetic snap point indicators during drag */}
      {magneticSnapPoints.map(point => (
        <div
          key={point.id}
          className="absolute w-12 h-12 rounded-full border-2 border-accent bg-accent/20 animate-pulse"
          style={{ 
            left: point.position.x, 
            top: point.position.y, 
            transform: 'translate(-50%, -50%)' 
          }}
        >
          <Magnet className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 text-accent" />
        </div>
      ))}
    </div>
  );
};

// Snap position to edges, center, or magnetic points
const snapToEdge = (pos: Position, magneticSnapPoints: MagneticSnapPoint[], elementSize: number = 48): Position => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const half = elementSize / 2;
  
  let snappedX = pos.x;
  let snappedY = pos.y;
  
  // Check magnetic snap points first (higher priority)
  for (const point of magneticSnapPoints) {
    const distance = Math.sqrt(
      Math.pow(pos.x - point.position.x, 2) + Math.pow(pos.y - point.position.y, 2)
    );
    if (distance < MAGNETIC_SNAP_THRESHOLD) {
      return point.position;
    }
  }
  
  // Horizontal snap to edges
  if (pos.x < SNAP_THRESHOLD + half) {
    snappedX = EDGE_PADDING + half;
  } else if (pos.x > vw - SNAP_THRESHOLD - half) {
    snappedX = vw - EDGE_PADDING - half;
  }
  
  // Vertical snap to edges
  if (pos.y < SNAP_THRESHOLD + half) {
    snappedY = EDGE_PADDING + half;
  } else if (pos.y > vh - SNAP_THRESHOLD - half) {
    snappedY = vh - EDGE_PADDING - half;
  }
  
  // Center snap
  if (Math.abs(pos.x - vw / 2) < SNAP_THRESHOLD) {
    snappedX = vw / 2;
  }
  if (Math.abs(pos.y - vh / 2) < SNAP_THRESHOLD) {
    snappedY = vh / 2;
  }
  
  return { x: snappedX, y: snappedY };
};

// Move entire group together
const moveGroupTogether = (buttonId: string, delta: Position) => {
  const group = getButtonGroup(buttonId);
  if (!group) return;
  
  const positions = loadSavedPositions();
  group.buttonIds.forEach(id => {
    if (positions[id]) {
      positions[id] = {
        x: positions[id].x + delta.x,
        y: positions[id].y + delta.y,
      };
    }
  });
  savePositions(positions);
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
  const [lastPosition, setLastPosition] = useState<Position | null>(null);
  
  const { 
    setDragging: setGlobalDragging, 
    isGroupingMode, 
    selectedForGrouping, 
    toggleGroupingSelection,
    magneticSnapPoints,
  } = useDragContext();
  
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);
  const startPosRef = useRef<Position>({ x: 0, y: 0 });
  const hasMoved = useRef(false);

  const group = getButtonGroup(id);
  const isInGroup = !!group;
  const isSelected = selectedForGrouping.includes(id);

  useEffect(() => {
    const savedPositions = loadSavedPositions();
    if (savedPositions[id]) {
      setPosition(savedPositions[id]);
    }
  }, [id]);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setGlobalDragging(isDragging);
  }, [isDragging, setGlobalDragging]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (isGroupingMode) {
      e.preventDefault();
      e.stopPropagation();
      toggleGroupingSelection(id);
      if (navigator.vibrate) navigator.vibrate(20);
      return;
    }

    startPosRef.current = { x: e.clientX, y: e.clientY };
    hasMoved.current = false;

    longPressTimerRef.current = setTimeout(() => {
      if (!hasMoved.current) {
        setIsLongPressing(true);
        setIsDragging(true);
        
        if (navigator.vibrate) {
          navigator.vibrate([50, 30, 50]);
        }
        
        if (elementRef.current) {
          const rect = elementRef.current.getBoundingClientRect();
          setDragOffset({
            x: e.clientX - rect.left - rect.width / 2,
            y: e.clientY - rect.top - rect.height / 2,
          });
          
          const currentPos = position || {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
          };
          setPosition(currentPos);
          setLastPosition(currentPos);
        }
      }
    }, longPressDelay);
  }, [longPressDelay, position, isGroupingMode, toggleGroupingSelection, id]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (isGroupingMode) return;
    
    const dx = Math.abs(e.clientX - startPosRef.current.x);
    const dy = Math.abs(e.clientY - startPosRef.current.y);
    if (dx > 10 || dy > 10) {
      hasMoved.current = true;
      if (longPressTimerRef.current && !isDragging) {
        clearTimeout(longPressTimerRef.current);
      }
    }

    if (isDragging) {
      e.preventDefault();
      e.stopPropagation();
      
      const rawX = e.clientX - dragOffset.x;
      const rawY = e.clientY - dragOffset.y;
      
      const padding = 24;
      const constrainedX = Math.max(padding, Math.min(window.innerWidth - padding, rawX));
      const constrainedY = Math.max(padding, Math.min(window.innerHeight - padding, rawY));
      
      const rawPos = { x: constrainedX, y: constrainedY };
      const snappedPos = snapToEdge(rawPos, magneticSnapPoints);
      
      const wasSnapped = snappedPos.x !== constrainedX || snappedPos.y !== constrainedY;
      if (wasSnapped && !isSnapped) {
        if (navigator.vibrate) navigator.vibrate(15);
      }
      setIsSnapped(wasSnapped);
      
      setPosition(snappedPos);
    }
  }, [isDragging, dragOffset, isSnapped, isGroupingMode, magneticSnapPoints]);

  const handlePointerUp = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    
    if (isDragging && position) {
      // If in a group, move all group members together
      if (isInGroup && lastPosition) {
        const delta = {
          x: position.x - lastPosition.x,
          y: position.y - lastPosition.y,
        };
        moveGroupTogether(id, delta);
      } else {
        const savedPositions = loadSavedPositions();
        savedPositions[id] = position;
        savePositions(savedPositions);
      }
      
      onPositionChange?.(id, position);
      
      if (navigator.vibrate) {
        navigator.vibrate(isSnapped ? [20, 10, 20] : 30);
      }
    }
    
    setIsDragging(false);
    setIsLongPressing(false);
    setIsSnapped(false);
    setLastPosition(null);
  }, [isDragging, position, id, onPositionChange, isSnapped, isInGroup, lastPosition]);

  const handlePointerCancel = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
    setIsDragging(false);
    setIsLongPressing(false);
    setIsSnapped(false);
    setLastPosition(null);
  }, []);

  const resetPosition = useCallback(() => {
    setPosition(null);
    const savedPositions = loadSavedPositions();
    delete savedPositions[id];
    savePositions(savedPositions);
    
    if (navigator.vibrate) {
      navigator.vibrate([30, 20, 30]);
    }
  }, [id]);

  const handleUngroup = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    removeButtonFromGroup(id);
    if (navigator.vibrate) navigator.vibrate([20, 10, 20]);
  }, [id]);

  // Render with position
  if (position) {
    return (
      <div
        ref={elementRef}
        data-draggable
        className={cn(
          'fixed z-50 touch-none select-none',
          isDragging && 'cursor-grabbing scale-110',
          isLongPressing && !isDragging && 'animate-pulse',
          isSnapped && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
          isInGroup && !isDragging && 'ring-1 ring-accent/50',
          isGroupingMode && 'cursor-pointer',
          isSelected && 'ring-2 ring-primary',
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
        onPointerLeave={isDragging ? handlePointerUp : undefined}
      >
        {/* Group indicator */}
        {isInGroup && !isDragging && (
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-accent/80 text-accent-foreground text-[8px] font-medium whitespace-nowrap flex items-center gap-1">
            <Link2 className="w-2 h-2" />
            {group.name}
            <button onClick={handleUngroup} className="hover:text-destructive">
              <Unlink className="w-2 h-2" />
            </button>
          </div>
        )}
        
        {/* Drag indicator */}
        {isDragging && (
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-full bg-primary/90 text-primary-foreground text-[10px] font-medium whitespace-nowrap flex items-center gap-1 animate-fade-in">
            <Move className="w-3 h-3" />
            {isSnapped ? 'Snapped!' : isInGroup ? 'Moving group' : 'Drag to position'}
          </div>
        )}
        
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
        
        {isDragging && !isSnapped && (
          <div className="absolute inset-0 -m-2 rounded-full border-2 border-dashed border-primary animate-pulse pointer-events-none" />
        )}
        
        {/* Grouping mode selection indicator */}
        {isGroupingMode && (
          <div className={cn(
            "absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
            isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}>
            {isSelected ? '✓' : '+'}
          </div>
        )}
        
        {children}
      </div>
    );
  }

  // Default render (in flow)
  return (
    <div
      ref={elementRef}
      data-draggable
      className={cn(
        'touch-none select-none relative',
        isLongPressing && 'animate-pulse scale-105',
        isGroupingMode && 'cursor-pointer',
        isSelected && 'ring-2 ring-primary rounded-full',
        className
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      {isLongPressing && !isDragging && (
        <div className="absolute inset-0 -m-1 rounded-full border-2 border-primary/50 animate-ping pointer-events-none" />
      )}
      
      {isGroupingMode && (
        <div className={cn(
          "absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold z-10",
          isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )}>
          {isSelected ? '✓' : '+'}
        </div>
      )}
      
      {children}
    </div>
  );
};

export default DraggableButton;
