// Long Press Button Wrapper - Enables editing and repositioning any button via 1s long-press
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Settings, Move, X, Check, Eye, EyeOff, Clock, Trash2, RotateCcw, Grid3X3, Zap, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { loadSavedPositions, savePositions, clearAllPositions } from './DraggableButton';

interface Position {
  x: number;
  y: number;
}

interface ButtonSettings {
  isVisible: boolean;
  customAction?: string;
}

interface LongPressButtonWrapperProps {
  children: React.ReactNode;
  buttonId: string;
  buttonLabel?: string;
  currentAction?: string;
  availableActions?: { value: string; label: string }[];
  onActionChange?: (action: string) => void;
  onVisibilityChange?: (visible: boolean) => void;
  onSettingsChange?: (settings: ButtonSettings) => void;
  longPressDelay?: number;
  enableDrag?: boolean;
  className?: string;
  showAutoHideSettings?: boolean;
  showVisibilityToggle?: boolean;
  showActionSelector?: boolean;
}

// Storage keys
const BUTTON_SETTINGS_KEY = 'visuai-button-settings';
const AUTO_HIDE_DELAY_KEY = 'visuai-auto-hide-delay';
const GRID_SNAP_KEY = 'visuai-grid-snap-enabled';
const HIDDEN_BUTTONS_KEY = 'visuai-hidden-buttons';
const BUTTON_ACTIONS_KEY = 'visuai-button-actions';
const BUTTON_SIZES_KEY = 'visuai-button-sizes';

// Grid snap configuration
const GRID_SIZE = 40;
const EDGE_PADDING = 16;

// Button size options
export type ButtonSizeOption = 'sm' | 'md' | 'lg';
export const BUTTON_SIZE_OPTIONS: { value: ButtonSizeOption; label: string }[] = [
  { value: 'sm', label: 'Small' },
  { value: 'md', label: 'Medium' },
  { value: 'lg', label: 'Large' },
];

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

// Grid snap management
export const getGridSnapEnabled = (): boolean => {
  try {
    const saved = localStorage.getItem(GRID_SNAP_KEY);
    return saved ? JSON.parse(saved) : true;
  } catch {
    return true;
  }
};

export const setGridSnapEnabled = (enabled: boolean) => {
  try {
    localStorage.setItem(GRID_SNAP_KEY, JSON.stringify(enabled));
  } catch (e) {
    console.error('Failed to save grid snap setting:', e);
  }
};

// Hidden buttons management
export const getHiddenButtons = (): string[] => {
  try {
    const saved = localStorage.getItem(HIDDEN_BUTTONS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

export const setHiddenButtons = (buttons: string[]) => {
  try {
    localStorage.setItem(HIDDEN_BUTTONS_KEY, JSON.stringify(buttons));
    window.dispatchEvent(new CustomEvent('hiddenButtonsChanged', { detail: buttons }));
  } catch (e) {
    console.error('Failed to save hidden buttons:', e);
  }
};

export const isButtonHidden = (buttonId: string): boolean => {
  return getHiddenButtons().includes(buttonId);
};

export const toggleButtonVisibility = (buttonId: string): boolean => {
  const hidden = getHiddenButtons();
  const isHidden = hidden.includes(buttonId);
  if (isHidden) {
    setHiddenButtons(hidden.filter(id => id !== buttonId));
  } else {
    setHiddenButtons([...hidden, buttonId]);
  }
  return !isHidden;
};

// Button action overrides management
export const getButtonActions = (): Record<string, string> => {
  try {
    const saved = localStorage.getItem(BUTTON_ACTIONS_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
};

export const setButtonAction = (buttonId: string, action: string) => {
  try {
    const actions = getButtonActions();
    actions[buttonId] = action;
    localStorage.setItem(BUTTON_ACTIONS_KEY, JSON.stringify(actions));
    window.dispatchEvent(new CustomEvent('buttonActionsChanged', { detail: actions }));
  } catch (e) {
    console.error('Failed to save button action:', e);
  }
};

export const getButtonAction = (buttonId: string, defaultAction: string): string => {
  const actions = getButtonActions();
  return actions[buttonId] || defaultAction;
};

// Button sizes management
export const getButtonSizes = (): Record<string, ButtonSizeOption> => {
  try {
    const saved = localStorage.getItem(BUTTON_SIZES_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
};

export const setButtonSize = (buttonId: string, size: ButtonSizeOption) => {
  try {
    const sizes = getButtonSizes();
    sizes[buttonId] = size;
    localStorage.setItem(BUTTON_SIZES_KEY, JSON.stringify(sizes));
    window.dispatchEvent(new CustomEvent('buttonSizesChanged', { detail: sizes }));
  } catch (e) {
    console.error('Failed to save button size:', e);
  }
};

export const getButtonSize = (buttonId: string, defaultSize: ButtonSizeOption = 'md'): ButtonSizeOption => {
  const sizes = getButtonSizes();
  return sizes[buttonId] || defaultSize;
};

// Snap position to grid
const snapToGrid = (pos: Position): Position => {
  return {
    x: Math.round(pos.x / GRID_SIZE) * GRID_SIZE,
    y: Math.round(pos.y / GRID_SIZE) * GRID_SIZE,
  };
};

// Available button actions
const ALL_BUTTON_ACTIONS = [
  { value: 'like', label: 'Like' },
  { value: 'comment', label: 'Comments' },
  { value: 'share', label: 'Share' },
  { value: 'follow', label: 'Follow' },
  { value: 'wallet', label: 'Wallet' },
  { value: 'profile', label: 'Profile' },
  { value: 'settings', label: 'Settings' },
  { value: 'tip', label: 'Tip' },
  { value: 'save', label: 'Save' },
  { value: 'report', label: 'Report' },
  { value: 'mute', label: 'Mute' },
];

// Grid Overlay Component for drag mode
const DragGridOverlay: React.FC<{ snapEnabled: boolean }> = ({ snapEnabled }) => {
  if (!snapEnabled) return null;

  return (
    <div className="fixed inset-0 z-[9997] pointer-events-none animate-fade-in">
      <div className="absolute inset-0 bg-background/10 backdrop-blur-[1px]" />
      
      <svg className="absolute inset-0 w-full h-full opacity-30">
        <defs>
          <pattern id="dragGrid" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
            <path 
              d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`} 
              fill="none" 
              stroke="hsl(var(--primary))" 
              strokeWidth="0.5"
              strokeOpacity="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dragGrid)" />
      </svg>
      
      {/* Edge indicators */}
      <div className="absolute top-0 left-0 right-0 h-4 border-b-2 border-dashed border-primary/30" />
      <div className="absolute bottom-0 left-0 right-0 h-4 border-t-2 border-dashed border-primary/30" />
      <div className="absolute top-0 bottom-0 left-0 w-4 border-r-2 border-dashed border-primary/30" />
      <div className="absolute top-0 bottom-0 right-0 w-4 border-l-2 border-dashed border-primary/30" />
    </div>
  );
};

// Settings Popover Component
const ButtonSettingsPopover: React.FC<{
  buttonId: string;
  buttonLabel: string;
  isOpen: boolean;
  onClose: () => void;
  position: Position;
  showAutoHideSettings?: boolean;
  showVisibilityToggle?: boolean;
  showActionSelector?: boolean;
  showSizeSelector?: boolean;
  currentAction?: string;
  currentSize?: ButtonSizeOption;
  availableActions?: { value: string; label: string }[];
  onActionChange?: (action: string) => void;
  onVisibilityChange?: (visible: boolean) => void;
  onSizeChange?: (size: ButtonSizeOption) => void;
  onDragMode: (snapEnabled: boolean) => void;
}> = ({ 
  buttonId, 
  buttonLabel, 
  isOpen, 
  onClose, 
  position, 
  showAutoHideSettings, 
  showVisibilityToggle = true,
  showActionSelector = true,
  showSizeSelector = true,
  currentAction,
  currentSize = 'md',
  availableActions = ALL_BUTTON_ACTIONS,
  onActionChange,
  onVisibilityChange,
  onSizeChange,
  onDragMode 
}) => {
  const { light, success } = useHapticFeedback();
  const [autoHideDelay, setDelay] = useState(getAutoHideDelay());
  const [gridSnapEnabled, setGridSnap] = useState(getGridSnapEnabled());
  const [isHidden, setIsHidden] = useState(() => isButtonHidden(buttonId));
  const [selectedAction, setSelectedAction] = useState(currentAction || 'none');
  const [selectedSize, setSelectedSize] = useState<ButtonSizeOption>(() => getButtonSize(buttonId, currentSize));

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

  const handleGridSnapToggle = () => {
    light();
    const newValue = !gridSnapEnabled;
    setGridSnap(newValue);
    setGridSnapEnabled(newValue);
  };

  const handleVisibilityToggle = () => {
    light();
    const newHidden = toggleButtonVisibility(buttonId);
    setIsHidden(newHidden);
    onVisibilityChange?.(!newHidden);
  };

  const handleActionChange = (action: string) => {
    light();
    setSelectedAction(action);
    setButtonAction(buttonId, action);
    onActionChange?.(action);
  };

  const handleSizeChange = (size: ButtonSizeOption) => {
    light();
    setSelectedSize(size);
    setButtonSize(buttonId, size);
    onSizeChange?.(size);
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
    left: Math.min(Math.max(10, position.x - 120), window.innerWidth - 270),
    top: Math.min(position.y + 60, window.innerHeight - 450),
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
        className="w-64 rounded-2xl bg-card/95 backdrop-blur-xl border border-border shadow-2xl animate-scale-in overflow-hidden max-h-[80vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border/50 bg-muted/30 sticky top-0">
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
          {/* Visibility Toggle */}
          {showVisibilityToggle && (
            <button
              onClick={handleVisibilityToggle}
              className={cn(
                'w-full flex items-center justify-between p-2.5 rounded-xl transition-colors',
                isHidden 
                  ? 'bg-destructive/10 text-destructive' 
                  : 'bg-muted/50 hover:bg-muted text-foreground/80'
              )}
            >
              <div className="flex items-center gap-3">
                {isHidden ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                <span className="text-sm font-medium">
                  {isHidden ? 'Button Hidden' : 'Button Visible'}
                </span>
              </div>
              <div className={cn(
                'w-10 h-6 rounded-full p-1 transition-colors',
                isHidden ? 'bg-destructive/30' : 'bg-primary'
              )}>
                <div className={cn(
                  'w-4 h-4 rounded-full bg-white transition-transform',
                  isHidden ? 'translate-x-0' : 'translate-x-4'
                )} />
              </div>
            </button>
          )}

          {/* Size Selector */}
          {showSizeSelector && !showAutoHideSettings && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Button Size</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {BUTTON_SIZE_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    onClick={() => handleSizeChange(option.value)}
                    className={cn(
                      'px-3 py-2 rounded-lg text-xs font-medium transition-all',
                      selectedSize === option.value
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

          {/* Action Selector */}
          {showActionSelector && !showAutoHideSettings && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Zap className="w-3.5 h-3.5" />
                <span>Button Action</span>
              </div>
              <div className="grid grid-cols-3 gap-1 max-h-32 overflow-y-auto">
                {availableActions.map(action => (
                  <button
                    key={action.value}
                    onClick={() => handleActionChange(action.value)}
                    className={cn(
                      'px-2 py-1.5 rounded-lg text-xs font-medium transition-all',
                      selectedAction === action.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/50 hover:bg-muted text-foreground/70'
                    )}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Move Button with Grid Snap */}
          <div className="space-y-2">
            <button
              onClick={() => {
                light();
                onDragMode(gridSnapEnabled);
              }}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
            >
              <Move className="w-5 h-5" />
              <span className="text-sm font-medium">Move Button</span>
            </button>
            
            {/* Grid Snap Toggle */}
            <button
              onClick={handleGridSnapToggle}
              className={cn(
                'w-full flex items-center justify-between p-2 rounded-lg transition-colors text-xs',
                gridSnapEnabled 
                  ? 'bg-accent/20 text-accent-foreground' 
                  : 'bg-muted/30 text-muted-foreground'
              )}
            >
              <div className="flex items-center gap-2">
                <Grid3X3 className="w-4 h-4" />
                <span>Snap to Grid</span>
              </div>
              <div className={cn(
                'w-8 h-4 rounded-full p-0.5 transition-colors',
                gridSnapEnabled ? 'bg-accent' : 'bg-muted'
              )}>
                <div className={cn(
                  'w-3 h-3 rounded-full bg-white transition-transform',
                  gridSnapEnabled ? 'translate-x-4' : 'translate-x-0'
                )} />
              </div>
            </button>
          </div>

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

// Drag Mode Overlay with controls
const DragModeOverlay: React.FC<{
  isActive: boolean;
  snapEnabled: boolean;
  onToggleSnap: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ isActive, snapEnabled, onToggleSnap, onConfirm, onCancel }) => {
  if (!isActive) return null;

  return (
    <div className="fixed inset-x-0 bottom-20 z-[9999] flex justify-center animate-slide-in-bottom">
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card/95 backdrop-blur-xl border border-border shadow-2xl">
        <Move className="w-5 h-5 text-primary animate-pulse" />
        <span className="text-sm font-medium">Drag to reposition</span>
        
        {/* Grid snap toggle */}
        <button
          onClick={onToggleSnap}
          className={cn(
            'p-2 rounded-full transition-colors',
            snapEnabled ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
          )}
          title={snapEnabled ? 'Grid snap on' : 'Grid snap off'}
        >
          <Grid3X3 className="w-4 h-4" />
        </button>
        
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
  currentAction,
  availableActions,
  onActionChange,
  onVisibilityChange,
  onSettingsChange,
  longPressDelay = 1000,
  enableDrag = true,
  className,
  showAutoHideSettings = false,
  showVisibilityToggle = true,
  showActionSelector = true,
}) => {
  const [showGear, setShowGear] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isDragMode, setIsDragMode] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [dragPosition, setDragPosition] = useState<Position | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(getGridSnapEnabled());
  
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { heavy, success, light } = useHapticFeedback();

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

  const handleDragMode = useCallback((gridSnap: boolean) => {
    setIsDragMode(true);
    setShowSettings(false);
    setSnapEnabled(gridSnap);
    setDragPosition(position);
  }, [position]);

  const handleDragMove = useCallback((e: React.PointerEvent) => {
    if (!isDragMode) return;
    
    let newPos = {
      x: e.clientX - 28, // Half button width
      y: e.clientY - 28, // Half button height
    };
    
    // Apply grid snap if enabled
    if (snapEnabled) {
      newPos = snapToGrid(newPos);
      // Provide haptic feedback when snapping
      if (dragPosition && 
          (Math.abs(newPos.x - dragPosition.x) >= GRID_SIZE || 
           Math.abs(newPos.y - dragPosition.y) >= GRID_SIZE)) {
        light();
      }
    }
    
    // Constrain to screen bounds
    newPos.x = Math.max(EDGE_PADDING, Math.min(window.innerWidth - 56 - EDGE_PADDING, newPos.x));
    newPos.y = Math.max(EDGE_PADDING, Math.min(window.innerHeight - 56 - EDGE_PADDING, newPos.y));
    
    setDragPosition(newPos);
  }, [isDragMode, snapEnabled, dragPosition, light]);

  const handleToggleSnap = useCallback(() => {
    light();
    const newValue = !snapEnabled;
    setSnapEnabled(newValue);
    setGridSnapEnabled(newValue);
  }, [snapEnabled, light]);

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
        {/* Grid overlay */}
        <DragGridOverlay snapEnabled={snapEnabled} />
        
        <div
          className="fixed z-[9999] cursor-move"
          style={{ 
            left: dragPosition.x, 
            top: dragPosition.y,
            touchAction: 'none',
          }}
          onPointerMove={handleDragMove}
        >
          <div className="relative">
            <div className={cn(
              "absolute -inset-4 rounded-full border-2 border-dashed border-primary",
              snapEnabled ? "animate-pulse" : "animate-spin-slow"
            )} />
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
          snapEnabled={snapEnabled}
          onToggleSnap={handleToggleSnap}
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
        showVisibilityToggle={showVisibilityToggle}
        showActionSelector={showActionSelector}
        currentAction={currentAction}
        availableActions={availableActions}
        onActionChange={onActionChange}
        onVisibilityChange={onVisibilityChange}
        onDragMode={handleDragMode}
      />
    </>
  );
};

export default LongPressButtonWrapper;
