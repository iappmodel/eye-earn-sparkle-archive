// Long Press Button Wrapper - Enables editing and repositioning any button via 1s long-press
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Settings, Move, X, Check, Eye, EyeOff, Clock, Trash2, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { loadSavedPositions, savePositions, clearAllPositions } from './DraggableButton';

interface Position {
  x: number;
  y: number;
}

interface ButtonSettings {
  isVisible: boolean;
  customLabel?: string;
}

interface LongPressButtonWrapperProps {
  children: React.ReactNode;
  buttonId: string;
  buttonLabel?: string;
  onSettingsChange?: (settings: ButtonSettings) => void;
  longPressDelay?: number;
  enableDrag?: boolean;
  className?: string;
  showAutoHideSettings?: boolean;
}

// Storage keys
const BUTTON_SETTINGS_KEY = 'visuai-button-settings';
const AUTO_HIDE_DELAY_KEY = 'visuai-auto-hide-delay';

// Load/save button settings
export const loadButtonSettings = (): Record<string, ButtonSettings> => {
  try {
    const saved = localStorage.getItem(BUTTON_SETTINGS_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
};

export const saveButtonSettings = (settings: Record<string, ButtonSettings>) => {
  try {
    localStorage.setItem(BUTTON_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save button settings:', e);
  }
};

// Auto-hide delay management
export const getAutoHideDelay = (): number => {
  try {
    const saved = localStorage.getItem(AUTO_HIDE_DELAY_KEY);
    return saved ? parseInt(saved, 10) : 3000;
  } catch {
    return 3000;
  }
};

export const setAutoHideDelay = (delay: number) => {
  try {
    localStorage.setItem(AUTO_HIDE_DELAY_KEY, delay.toString());
    window.dispatchEvent(new CustomEvent('autoHideDelayChanged', { detail: delay }));
  } catch (e) {
    console.error('Failed to save auto-hide delay:', e);
  }
};

// Settings Popover Component
const ButtonSettingsPopover: React.FC<{
  buttonId: string;
  buttonLabel: string;
  isOpen: boolean;
  onClose: () => void;
  position: Position;
  showAutoHideSettings?: boolean;
  onDragMode: () => void;
}> = ({ buttonId, buttonLabel, isOpen, onClose, position, showAutoHideSettings, onDragMode }) => {
  const { light, success } = useHapticFeedback();
  const [autoHideDelay, setDelay] = useState(getAutoHideDelay());
  const [settings, setSettings] = useState<ButtonSettings>(() => {
    const allSettings = loadButtonSettings();
    return allSettings[buttonId] || { isVisible: true };
  });

  const delayOptions = [
    { value: 500, label: '0.5s' },
    { value: 1000, label: '1s' },
    { value: 2000, label: '2s' },
    { value: 3000, label: '3s' },
    { value: 5000, label: '5s' },
    { value: 10000, label: '10s' },
    { value: -1, label: 'Never' },
  ];

  const handleDelayChange = (value: number) => {
    light();
    setDelay(value);
    setAutoHideDelay(value);
  };

  const handleResetPosition = () => {
    light();
    const positions = loadSavedPositions();
    delete positions[buttonId];
    savePositions(positions);
    window.dispatchEvent(new Event('storage'));
    onClose();
  };

  const handleResetAllPositions = () => {
    success();
    clearAllPositions();
    window.dispatchEvent(new Event('storage'));
    window.location.reload();
  };

  if (!isOpen) return null;

  // Calculate position to keep popover on screen
  const popoverStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 9999,
    left: Math.min(position.x, window.innerWidth - 260),
    top: Math.min(position.y + 60, window.innerHeight - 300),
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      
      {/* Popover */}
      <div 
        style={popoverStyle}
        className="w-60 rounded-2xl bg-card/95 backdrop-blur-xl border border-border shadow-2xl animate-scale-in overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border/50 bg-muted/30">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold truncate">{buttonLabel}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 space-y-4">
          {/* Move Button */}
          <button
            onClick={() => {
              light();
              onDragMode();
            }}
            className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
          >
            <Move className="w-5 h-5" />
            <span className="text-sm font-medium">Move Button</span>
          </button>

          {/* Reset Position */}
          <button
            onClick={handleResetPosition}
            className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-muted/50 hover:bg-muted text-foreground/80 transition-colors"
          >
            <RotateCcw className="w-5 h-5" />
            <span className="text-sm font-medium">Reset Position</span>
          </button>

          {/* Auto-hide Timer Settings (only for visibility toggle) */}
          {showAutoHideSettings && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                <span>Auto-hide delay</span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                {delayOptions.map(option => (
                  <button
                    key={option.value}
                    onClick={() => handleDelayChange(option.value)}
                    className={cn(
                      'px-2 py-1.5 rounded-lg text-xs font-medium transition-all',
                      autoHideDelay === option.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/50 hover:bg-muted text-foreground/70'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Reset All */}
          <button
            onClick={handleResetAllPositions}
            className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-destructive/10 hover:bg-destructive/20 text-destructive transition-colors"
          >
            <Trash2 className="w-5 h-5" />
            <span className="text-sm font-medium">Reset All Buttons</span>
          </button>
        </div>
      </div>
    </>
  );
};

// Gear Icon Overlay
const GearIconOverlay: React.FC<{
  isVisible: boolean;
  onClick: () => void;
}> = ({ isVisible, onClick }) => {
  if (!isVisible) return null;

  return (
    <div 
      className="absolute -top-2 -right-2 z-50 animate-scale-in"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <button className="w-7 h-7 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-110 transition-transform active:scale-95">
        <Settings className="w-4 h-4" />
      </button>
    </div>
  );
};

// Drag Mode Overlay
const DragModeOverlay: React.FC<{
  isActive: boolean;
  position: Position;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ isActive, position, onConfirm, onCancel }) => {
  if (!isActive) return null;

  return (
    <div className="fixed inset-x-0 bottom-20 z-[9999] flex justify-center animate-slide-in-bottom">
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card/95 backdrop-blur-xl border border-border shadow-2xl">
        <Move className="w-5 h-5 text-primary animate-pulse" />
        <span className="text-sm font-medium">Drag to reposition</span>
        <div className="flex gap-2 ml-2">
          <button
            onClick={onConfirm}
            className="p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Check className="w-4 h-4" />
          </button>
          <button
            onClick={onCancel}
            className="p-2 rounded-full bg-destructive/20 text-destructive hover:bg-destructive/30"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export const LongPressButtonWrapper: React.FC<LongPressButtonWrapperProps> = ({
  children,
  buttonId,
  buttonLabel = 'Button',
  onSettingsChange,
  longPressDelay = 1000,
  enableDrag = true,
  className,
  showAutoHideSettings = false,
}) => {
  const [showGear, setShowGear] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isDragMode, setIsDragMode] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [dragPosition, setDragPosition] = useState<Position | null>(null);
  
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { heavy, success } = useHapticFeedback();

  // Get initial position from saved positions or element position
  useEffect(() => {
    if (wrapperRef.current) {
      const rect = wrapperRef.current.getBoundingClientRect();
      setPosition({ x: rect.left, y: rect.top });
    }
  }, []);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (isDragMode) return;
    
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (rect) {
      setPosition({ x: rect.left, y: rect.top });
    }

    longPressTimer.current = setTimeout(() => {
      heavy();
      setShowGear(true);
    }, longPressDelay);
  }, [longPressDelay, heavy, isDragMode]);

  const handlePointerUp = useCallback(() => {
    clearLongPress();
  }, [clearLongPress]);

  const handlePointerLeave = useCallback(() => {
    clearLongPress();
  }, [clearLongPress]);

  const handleGearClick = useCallback(() => {
    setShowSettings(true);
    setShowGear(false);
  }, []);

  const handleCloseSettings = useCallback(() => {
    setShowSettings(false);
    setShowGear(false);
  }, []);

  const handleDragMode = useCallback(() => {
    setIsDragMode(true);
    setShowSettings(false);
    setDragPosition(position);
  }, [position]);

  const handleDragMove = useCallback((e: React.PointerEvent) => {
    if (!isDragMode || !dragPosition) return;
    
    setDragPosition({
      x: e.clientX - 28, // Half button width
      y: e.clientY - 28, // Half button height
    });
  }, [isDragMode, dragPosition]);

  const handleDragConfirm = useCallback(() => {
    if (dragPosition) {
      const positions = loadSavedPositions();
      positions[buttonId] = dragPosition;
      savePositions(positions);
      window.dispatchEvent(new Event('storage'));
      success();
    }
    setIsDragMode(false);
    setDragPosition(null);
  }, [buttonId, dragPosition, success]);

  const handleDragCancel = useCallback(() => {
    setIsDragMode(false);
    setDragPosition(null);
  }, []);

  // Close gear icon if clicking elsewhere
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showGear && wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowGear(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showGear]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearLongPress();
  }, [clearLongPress]);

  // Drag mode rendering
  if (isDragMode && dragPosition) {
    return (
      <>
        <div
          className="fixed z-[9999] cursor-move"
          style={{ 
            left: dragPosition.x, 
            top: dragPosition.y,
            touchAction: 'none',
          }}
          onPointerMove={handleDragMove}
        >
          <div className="relative animate-pulse">
            <div className="absolute -inset-4 rounded-full border-2 border-dashed border-primary animate-spin-slow" />
            {children}
          </div>
        </div>
        
        {/* Drag overlay for touch events */}
        <div 
          className="fixed inset-0 z-[9998]"
          onPointerMove={handleDragMove}
          style={{ touchAction: 'none' }}
        />
        
        <DragModeOverlay
          isActive={true}
          position={dragPosition}
          onConfirm={handleDragConfirm}
          onCancel={handleDragCancel}
        />
      </>
    );
  }

  return (
    <>
      <div
        ref={wrapperRef}
        className={cn('relative', className)}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerLeave}
        style={{ touchAction: 'manipulation' }}
      >
        {children}
        
        <GearIconOverlay 
          isVisible={showGear} 
          onClick={handleGearClick}
        />
      </div>

      <ButtonSettingsPopover
        buttonId={buttonId}
        buttonLabel={buttonLabel}
        isOpen={showSettings}
        onClose={handleCloseSettings}
        position={position}
        showAutoHideSettings={showAutoHideSettings}
        onDragMode={handleDragMode}
      />
    </>
  );
};

export default LongPressButtonWrapper;
