// Long Press Button Wrapper - Enables editing and repositioning any button via 1s long-press
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { 
  Settings, Move, X, Check, Eye, EyeOff, Clock, Trash2, RotateCcw, Grid3X3, Zap, Maximize2, Palette,
  Heart, MessageCircle, Share2, UserPlus, Wallet, User, Cog, Gift, Bookmark, Flag, VolumeX,
  Bell, Star, ThumbsUp, ThumbsDown, Send, Camera, Video, Music, Image, Home, Search, Plus,
  Sparkles, Flame, Trophy, Crown, Diamond, Gem, Coins, Award, Target, Lightbulb,
  Wand2, CircleDot, Waves, Activity, Square, Sun, Layers,
  type LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { loadSavedPositions, savePositions, clearAllPositions } from './DraggableButton';
import { HSLColorPicker } from './HSLColorPicker';

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
const BUTTON_ICONS_KEY = 'visuai-button-icons';
const BUTTON_COLORS_KEY = 'visuai-button-colors';
const BUTTON_ANIMATIONS_KEY = 'visuai-button-animations';
const BUTTON_OPACITY_KEY = 'visuai-button-opacity';
const BUTTON_BORDERS_KEY = 'visuai-button-borders';
const BUTTON_SHADOWS_KEY = 'visuai-button-shadows';
const BUTTON_HOVERS_KEY = 'visuai-button-hovers';
const BUTTON_UI_GROUPS_KEY = 'visuai-button-ui-groups';

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

// Icon options for button customization
export const BUTTON_ICON_OPTIONS: { value: string; label: string; Icon: LucideIcon }[] = [
  { value: 'heart', label: 'Heart', Icon: Heart },
  { value: 'thumbs-up', label: 'Thumbs Up', Icon: ThumbsUp },
  { value: 'thumbs-down', label: 'Thumbs Down', Icon: ThumbsDown },
  { value: 'star', label: 'Star', Icon: Star },
  { value: 'message-circle', label: 'Message', Icon: MessageCircle },
  { value: 'share', label: 'Share', Icon: Share2 },
  { value: 'send', label: 'Send', Icon: Send },
  { value: 'user-plus', label: 'Follow', Icon: UserPlus },
  { value: 'user', label: 'Profile', Icon: User },
  { value: 'wallet', label: 'Wallet', Icon: Wallet },
  { value: 'gift', label: 'Gift', Icon: Gift },
  { value: 'bookmark', label: 'Bookmark', Icon: Bookmark },
  { value: 'bell', label: 'Bell', Icon: Bell },
  { value: 'settings', label: 'Settings', Icon: Cog },
  { value: 'flag', label: 'Flag', Icon: Flag },
  { value: 'mute', label: 'Mute', Icon: VolumeX },
  { value: 'camera', label: 'Camera', Icon: Camera },
  { value: 'video', label: 'Video', Icon: Video },
  { value: 'music', label: 'Music', Icon: Music },
  { value: 'image', label: 'Image', Icon: Image },
  { value: 'home', label: 'Home', Icon: Home },
  { value: 'search', label: 'Search', Icon: Search },
  { value: 'plus', label: 'Plus', Icon: Plus },
  { value: 'sparkles', label: 'Sparkles', Icon: Sparkles },
  { value: 'flame', label: 'Flame', Icon: Flame },
  { value: 'trophy', label: 'Trophy', Icon: Trophy },
  { value: 'crown', label: 'Crown', Icon: Crown },
  { value: 'diamond', label: 'Diamond', Icon: Diamond },
  { value: 'gem', label: 'Gem', Icon: Gem },
  { value: 'coins', label: 'Coins', Icon: Coins },
  { value: 'award', label: 'Award', Icon: Award },
  { value: 'target', label: 'Target', Icon: Target },
  { value: 'lightbulb', label: 'Lightbulb', Icon: Lightbulb },
];

// Preset colors for quick selection
export const PRESET_COLORS: { label: string; value: string }[] = [
  { label: 'Primary', value: '270 95% 65%' },
  { label: 'Magenta', value: '300 85% 60%' },
  { label: 'Cyan', value: '180 90% 50%' },
  { label: 'Gold', value: '45 95% 55%' },
  { label: 'Emerald', value: '150 80% 45%' },
  { label: 'Rose', value: '340 85% 60%' },
  { label: 'Orange', value: '25 95% 55%' },
  { label: 'Blue', value: '210 100% 50%' },
];

// Animation effect options
export type ButtonAnimationType = 'none' | 'pulse' | 'glow' | 'bounce' | 'shake' | 'float';
export const BUTTON_ANIMATION_OPTIONS: { value: ButtonAnimationType; label: string; description: string }[] = [
  { value: 'none', label: 'None', description: 'No animation' },
  { value: 'pulse', label: 'Pulse', description: 'Gentle pulse effect' },
  { value: 'glow', label: 'Glow', description: 'Glowing aura' },
  { value: 'bounce', label: 'Bounce', description: 'Bouncy motion' },
  { value: 'shake', label: 'Shake', description: 'Attention shake' },
  { value: 'float', label: 'Float', description: 'Floating motion' },
];

// Opacity presets
export const OPACITY_PRESETS: { value: number; label: string }[] = [
  { value: 100, label: 'Full' },
  { value: 75, label: '75%' },
  { value: 50, label: '50%' },
  { value: 25, label: '25%' },
];

// Border style options
export type ButtonBorderStyle = 'none' | 'solid' | 'dashed' | 'dotted' | 'gradient';
export const BUTTON_BORDER_OPTIONS: { value: ButtonBorderStyle; label: string; description: string }[] = [
  { value: 'none', label: 'None', description: 'No border' },
  { value: 'solid', label: 'Solid', description: 'Clean solid line' },
  { value: 'dashed', label: 'Dashed', description: 'Dashed line' },
  { value: 'dotted', label: 'Dotted', description: 'Dotted line' },
  { value: 'gradient', label: 'Gradient', description: 'Neon glow border' },
];

// Shadow style options
export type ButtonShadowStyle = 'none' | 'soft' | 'hard' | 'neon';
export const BUTTON_SHADOW_OPTIONS: { value: ButtonShadowStyle; label: string; description: string }[] = [
  { value: 'none', label: 'None', description: 'No shadow' },
  { value: 'soft', label: 'Soft', description: 'Subtle shadow' },
  { value: 'hard', label: 'Hard', description: 'Sharp shadow' },
  { value: 'neon', label: 'Neon Glow', description: 'Neon effect' },
];

// Hover effect options
export type ButtonHoverEffect = 'none' | 'scale' | 'rotate' | 'glow' | 'scale-rotate' | 'lift';
export const BUTTON_HOVER_OPTIONS: { value: ButtonHoverEffect; label: string; description: string }[] = [
  { value: 'none', label: 'None', description: 'No hover effect' },
  { value: 'scale', label: 'Scale', description: 'Grow on hover' },
  { value: 'rotate', label: 'Rotate', description: 'Spin on hover' },
  { value: 'glow', label: 'Glow', description: 'Glow on hover' },
  { value: 'scale-rotate', label: 'Scale + Rotate', description: 'Combined effect' },
  { value: 'lift', label: 'Lift', description: 'Float up on hover' },
];

// Button UI Groups for collapsible sections
export interface ButtonUIGroup {
  id: string;
  name: string;
  buttonIds: string[];
  isCollapsed: boolean;
  icon?: string;
}

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

// Button icons management
export const getButtonIcons = (): Record<string, string> => {
  try {
    const saved = localStorage.getItem(BUTTON_ICONS_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
};

export const setButtonIcon = (buttonId: string, icon: string) => {
  try {
    const icons = getButtonIcons();
    icons[buttonId] = icon;
    localStorage.setItem(BUTTON_ICONS_KEY, JSON.stringify(icons));
    window.dispatchEvent(new CustomEvent('buttonIconsChanged', { detail: icons }));
  } catch (e) {
    console.error('Failed to save button icon:', e);
  }
};

export const getButtonIcon = (buttonId: string): string | undefined => {
  const icons = getButtonIcons();
  return icons[buttonId];
};

export const clearButtonIcon = (buttonId: string) => {
  try {
    const icons = getButtonIcons();
    delete icons[buttonId];
    localStorage.setItem(BUTTON_ICONS_KEY, JSON.stringify(icons));
    window.dispatchEvent(new CustomEvent('buttonIconsChanged', { detail: icons }));
  } catch (e) {
    console.error('Failed to clear button icon:', e);
  }
};

// Button colors management
export const getButtonColors = (): Record<string, string> => {
  try {
    const saved = localStorage.getItem(BUTTON_COLORS_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
};

export const setButtonColor = (buttonId: string, color: string) => {
  try {
    const colors = getButtonColors();
    colors[buttonId] = color;
    localStorage.setItem(BUTTON_COLORS_KEY, JSON.stringify(colors));
    window.dispatchEvent(new CustomEvent('buttonColorsChanged', { detail: colors }));
  } catch (e) {
    console.error('Failed to save button color:', e);
  }
};

export const getButtonColor = (buttonId: string): string | undefined => {
  const colors = getButtonColors();
  return colors[buttonId];
};

export const clearButtonColor = (buttonId: string) => {
  try {
    const colors = getButtonColors();
    delete colors[buttonId];
    localStorage.setItem(BUTTON_COLORS_KEY, JSON.stringify(colors));
    window.dispatchEvent(new CustomEvent('buttonColorsChanged', { detail: colors }));
  } catch (e) {
    console.error('Failed to clear button color:', e);
  }
};

// Button animations management
export const getButtonAnimations = (): Record<string, ButtonAnimationType> => {
  try {
    const saved = localStorage.getItem(BUTTON_ANIMATIONS_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
};

export const setButtonAnimation = (buttonId: string, animation: ButtonAnimationType) => {
  try {
    const animations = getButtonAnimations();
    animations[buttonId] = animation;
    localStorage.setItem(BUTTON_ANIMATIONS_KEY, JSON.stringify(animations));
    window.dispatchEvent(new CustomEvent('buttonAnimationsChanged', { detail: animations }));
  } catch (e) {
    console.error('Failed to save button animation:', e);
  }
};

export const getButtonAnimation = (buttonId: string): ButtonAnimationType => {
  const animations = getButtonAnimations();
  return animations[buttonId] || 'none';
};

// Button opacity management
export const getButtonOpacities = (): Record<string, number> => {
  try {
    const saved = localStorage.getItem(BUTTON_OPACITY_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
};

export const setButtonOpacity = (buttonId: string, opacity: number) => {
  try {
    const opacities = getButtonOpacities();
    opacities[buttonId] = opacity;
    localStorage.setItem(BUTTON_OPACITY_KEY, JSON.stringify(opacities));
    window.dispatchEvent(new CustomEvent('buttonOpacitiesChanged', { detail: opacities }));
  } catch (e) {
    console.error('Failed to save button opacity:', e);
  }
};

export const getButtonOpacity = (buttonId: string): number => {
  const opacities = getButtonOpacities();
  return opacities[buttonId] ?? 100;
};

// Button border styles management
export const getButtonBorders = (): Record<string, ButtonBorderStyle> => {
  try {
    const saved = localStorage.getItem(BUTTON_BORDERS_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
};

export const setButtonBorder = (buttonId: string, border: ButtonBorderStyle) => {
  try {
    const borders = getButtonBorders();
    borders[buttonId] = border;
    localStorage.setItem(BUTTON_BORDERS_KEY, JSON.stringify(borders));
    window.dispatchEvent(new CustomEvent('buttonBordersChanged', { detail: borders }));
  } catch (e) {
    console.error('Failed to save button border:', e);
  }
};

export const getButtonBorder = (buttonId: string): ButtonBorderStyle => {
  const borders = getButtonBorders();
  return borders[buttonId] || 'none';
};

// Button shadow styles management
export const getButtonShadows = (): Record<string, ButtonShadowStyle> => {
  try {
    const saved = localStorage.getItem(BUTTON_SHADOWS_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
};

export const setButtonShadow = (buttonId: string, shadow: ButtonShadowStyle) => {
  try {
    const shadows = getButtonShadows();
    shadows[buttonId] = shadow;
    localStorage.setItem(BUTTON_SHADOWS_KEY, JSON.stringify(shadows));
    window.dispatchEvent(new CustomEvent('buttonShadowsChanged', { detail: shadows }));
  } catch (e) {
    console.error('Failed to save button shadow:', e);
  }
};

export const getButtonShadow = (buttonId: string): ButtonShadowStyle => {
  const shadows = getButtonShadows();
  return shadows[buttonId] || 'none';
};

// Button hover effects management
export const getButtonHovers = (): Record<string, ButtonHoverEffect> => {
  try {
    const saved = localStorage.getItem(BUTTON_HOVERS_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
};

export const setButtonHover = (buttonId: string, hover: ButtonHoverEffect) => {
  try {
    const hovers = getButtonHovers();
    hovers[buttonId] = hover;
    localStorage.setItem(BUTTON_HOVERS_KEY, JSON.stringify(hovers));
    window.dispatchEvent(new CustomEvent('buttonHoversChanged', { detail: hovers }));
  } catch (e) {
    console.error('Failed to save button hover:', e);
  }
};

export const getButtonHover = (buttonId: string): ButtonHoverEffect => {
  const hovers = getButtonHovers();
  return hovers[buttonId] || 'none';
};

// Button UI Groups management
export const loadButtonUIGroups = (): ButtonUIGroup[] => {
  try {
    const saved = localStorage.getItem(BUTTON_UI_GROUPS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

export const saveButtonUIGroups = (groups: ButtonUIGroup[]) => {
  try {
    localStorage.setItem(BUTTON_UI_GROUPS_KEY, JSON.stringify(groups));
    window.dispatchEvent(new CustomEvent('buttonUIGroupsChanged', { detail: groups }));
  } catch (e) {
    console.error('Failed to save button UI groups:', e);
  }
};

export const createButtonUIGroup = (buttonIds: string[], name?: string): ButtonUIGroup => {
  const groups = loadButtonUIGroups();
  const newGroup: ButtonUIGroup = {
    id: `ui-group-${Date.now()}`,
    name: name || `Group ${groups.length + 1}`,
    buttonIds,
    isCollapsed: false,
  };
  groups.push(newGroup);
  saveButtonUIGroups(groups);
  return newGroup;
};

export const toggleUIGroupCollapse = (groupId: string) => {
  const groups = loadButtonUIGroups();
  const group = groups.find(g => g.id === groupId);
  if (group) {
    group.isCollapsed = !group.isCollapsed;
    saveButtonUIGroups(groups);
  }
};

export const deleteButtonUIGroup = (groupId: string) => {
  const groups = loadButtonUIGroups();
  saveButtonUIGroups(groups.filter(g => g.id !== groupId));
};

export const addButtonToUIGroup = (groupId: string, buttonId: string) => {
  const groups = loadButtonUIGroups();
  const group = groups.find(g => g.id === groupId);
  if (group && !group.buttonIds.includes(buttonId)) {
    group.buttonIds.push(buttonId);
    saveButtonUIGroups(groups);
  }
};

export const removeButtonFromUIGroup = (groupId: string, buttonId: string) => {
  const groups = loadButtonUIGroups();
  const group = groups.find(g => g.id === groupId);
  if (group) {
    group.buttonIds = group.buttonIds.filter(id => id !== buttonId);
    if (group.buttonIds.length === 0) {
      saveButtonUIGroups(groups.filter(g => g.id !== groupId));
    } else {
      saveButtonUIGroups(groups);
    }
  }
};

export const getButtonUIGroup = (buttonId: string): ButtonUIGroup | undefined => {
  const groups = loadButtonUIGroups();
  return groups.find(g => g.buttonIds.includes(buttonId));
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
  const [selectedIcon, setSelectedIcon] = useState<string | undefined>(() => getButtonIcon(buttonId));
  const [selectedColor, setSelectedColor] = useState<string | undefined>(() => getButtonColor(buttonId));
  const [selectedAnimation, setSelectedAnimation] = useState<ButtonAnimationType>(() => getButtonAnimation(buttonId));
  const [selectedOpacity, setSelectedOpacity] = useState<number>(() => getButtonOpacity(buttonId));
  const [selectedBorder, setSelectedBorder] = useState<ButtonBorderStyle>(() => getButtonBorder(buttonId));
  const [selectedShadow, setSelectedShadow] = useState<ButtonShadowStyle>(() => getButtonShadow(buttonId));
  const [selectedHover, setSelectedHover] = useState<ButtonHoverEffect>(() => getButtonHover(buttonId));
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showAnimationPicker, setShowAnimationPicker] = useState(false);
  const [showBorderPicker, setShowBorderPicker] = useState(false);
  const [showShadowPicker, setShowShadowPicker] = useState(false);
  const [showHoverPicker, setShowHoverPicker] = useState(false);

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

  const handleIconChange = (icon: string) => {
    light();
    if (icon === 'default') {
      setSelectedIcon(undefined);
      clearButtonIcon(buttonId);
    } else {
      setSelectedIcon(icon);
      setButtonIcon(buttonId, icon);
    }
  };

  const handleColorChange = (color: string) => {
    light();
    setSelectedColor(color);
    setButtonColor(buttonId, color);
  };

  const handleClearColor = () => {
    light();
    setSelectedColor(undefined);
    clearButtonColor(buttonId);
  };

  const handleAnimationChange = (animation: ButtonAnimationType) => {
    light();
    setSelectedAnimation(animation);
    setButtonAnimation(buttonId, animation);
  };

  const handleOpacityChange = (opacity: number) => {
    light();
    setSelectedOpacity(opacity);
    setButtonOpacity(buttonId, opacity);
  };

  const handleBorderChange = (border: ButtonBorderStyle) => {
    light();
    setSelectedBorder(border);
    setButtonBorder(buttonId, border);
  };

  const handleShadowChange = (shadow: ButtonShadowStyle) => {
    light();
    setSelectedShadow(shadow);
    setButtonShadow(buttonId, shadow);
  };

  const handleHoverChange = (hover: ButtonHoverEffect) => {
    light();
    setSelectedHover(hover);
    setButtonHover(buttonId, hover);
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

          {/* Icon Picker */}
          {!showAutoHideSettings && (
            <div className="space-y-2">
              <button
                onClick={() => setShowIconPicker(!showIconPicker)}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  {selectedIcon ? (
                    (() => {
                      const iconOption = BUTTON_ICON_OPTIONS.find(opt => opt.value === selectedIcon);
                      const IconComponent = iconOption?.Icon || Settings;
                      return <IconComponent className="w-5 h-5 text-primary" />;
                    })()
                  ) : (
                    <Sparkles className="w-5 h-5 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium">
                    {selectedIcon ? 'Change Icon' : 'Choose Icon'}
                  </span>
                </div>
                <X 
                  className={cn(
                    'w-4 h-4 transition-transform',
                    showIconPicker ? 'rotate-0' : 'rotate-45'
                  )} 
                />
              </button>
              
              {showIconPicker && (
                <div className="space-y-2 animate-fade-in">
                  <div className="grid grid-cols-6 gap-1.5 p-2 rounded-xl bg-muted/30 max-h-36 overflow-y-auto">
                    {/* Default option */}
                    <button
                      onClick={() => handleIconChange('default')}
                      className={cn(
                        'p-2 rounded-lg transition-all flex items-center justify-center',
                        !selectedIcon
                          ? 'bg-primary text-primary-foreground ring-2 ring-primary/50'
                          : 'bg-muted/50 hover:bg-muted text-foreground/70'
                      )}
                      title="Default"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    {BUTTON_ICON_OPTIONS.map(option => {
                      const IconComponent = option.Icon;
                      return (
                        <button
                          key={option.value}
                          onClick={() => handleIconChange(option.value)}
                          className={cn(
                            'p-2 rounded-lg transition-all flex items-center justify-center',
                            selectedIcon === option.value
                              ? 'bg-primary text-primary-foreground ring-2 ring-primary/50'
                              : 'bg-muted/50 hover:bg-muted text-foreground/70'
                          )}
                          title={option.label}
                        >
                          <IconComponent className="w-4 h-4" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Color Picker */}
          {!showAutoHideSettings && (
            <div className="space-y-2">
              <button
                onClick={() => setShowColorPicker(!showColorPicker)}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="w-5 h-5 rounded-full border-2 border-white/20 shadow-sm"
                    style={{ 
                      backgroundColor: selectedColor ? `hsl(${selectedColor})` : 'hsl(var(--primary))',
                      boxShadow: selectedColor ? `0 0 10px hsl(${selectedColor} / 0.5)` : undefined
                    }}
                  />
                  <span className="text-sm font-medium">
                    {selectedColor ? 'Change Color' : 'Custom Color'}
                  </span>
                </div>
                <Palette 
                  className={cn(
                    'w-4 h-4 transition-colors',
                    showColorPicker ? 'text-primary' : 'text-muted-foreground'
                  )} 
                />
              </button>
              
              {showColorPicker && (
                <div className="space-y-3 animate-fade-in p-2 rounded-xl bg-muted/30">
                  {/* Quick Color Presets */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-muted-foreground">Quick Colors</span>
                    <div className="flex flex-wrap gap-1.5">
                      {PRESET_COLORS.map(preset => (
                        <button
                          key={preset.value}
                          onClick={() => handleColorChange(preset.value)}
                          className={cn(
                            'w-7 h-7 rounded-full border-2 transition-all hover:scale-110',
                            selectedColor === preset.value
                              ? 'border-white ring-2 ring-primary/50 scale-110'
                              : 'border-transparent'
                          )}
                          style={{ 
                            backgroundColor: `hsl(${preset.value})`,
                            boxShadow: `0 0 8px hsl(${preset.value} / 0.4)`
                          }}
                          title={preset.label}
                        />
                      ))}
                      {selectedColor && (
                        <button
                          onClick={handleClearColor}
                          className="w-7 h-7 rounded-full border-2 border-dashed border-muted-foreground/50 flex items-center justify-center hover:border-destructive hover:bg-destructive/10 transition-all"
                          title="Reset to default"
                        >
                          <X className="w-3 h-3 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Full HSL Color Picker */}
                  <HSLColorPicker
                    value={selectedColor || '270 95% 65%'}
                    onChange={handleColorChange}
                    label="Custom Color"
                    showPreview={true}
                  />
                </div>
              )}
            </div>
          )}

          {/* Animation Effects */}
          {!showAutoHideSettings && (
            <div className="space-y-2">
              <button
                onClick={() => setShowAnimationPicker(!showAnimationPicker)}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Wand2 className={cn(
                    'w-5 h-5',
                    selectedAnimation !== 'none' ? 'text-primary animate-pulse' : 'text-muted-foreground'
                  )} />
                  <span className="text-sm font-medium">
                    {selectedAnimation !== 'none' 
                      ? BUTTON_ANIMATION_OPTIONS.find(a => a.value === selectedAnimation)?.label 
                      : 'Add Animation'}
                  </span>
                </div>
                <Activity 
                  className={cn(
                    'w-4 h-4 transition-colors',
                    showAnimationPicker ? 'text-primary' : 'text-muted-foreground'
                  )} 
                />
              </button>
              
              {showAnimationPicker && (
                <div className="space-y-2 animate-fade-in p-2 rounded-xl bg-muted/30">
                  <div className="grid grid-cols-2 gap-1.5">
                    {BUTTON_ANIMATION_OPTIONS.map(option => (
                      <button
                        key={option.value}
                        onClick={() => handleAnimationChange(option.value)}
                        className={cn(
                          'p-2.5 rounded-lg transition-all text-left',
                          selectedAnimation === option.value
                            ? 'bg-primary text-primary-foreground ring-2 ring-primary/50'
                            : 'bg-muted/50 hover:bg-muted text-foreground/70'
                        )}
                      >
                        <div className="text-xs font-medium">{option.label}</div>
                        <div className="text-[10px] opacity-70">{option.description}</div>
                      </button>
                    ))}
                  </div>
                  
                  {/* Animation Preview */}
                  {selectedAnimation !== 'none' && (
                    <div className="flex items-center justify-center p-3 rounded-lg bg-background/50">
                      <div className={cn(
                        'w-10 h-10 rounded-full bg-primary flex items-center justify-center',
                        selectedAnimation === 'pulse' && 'animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]',
                        selectedAnimation === 'glow' && 'animate-[glow_2s_ease-in-out_infinite]',
                        selectedAnimation === 'bounce' && 'animate-bounce',
                        selectedAnimation === 'shake' && 'animate-[shake_0.5s_ease-in-out_infinite]',
                        selectedAnimation === 'float' && 'animate-[float_3s_ease-in-out_infinite]',
                      )}>
                        <Sparkles className="w-5 h-5 text-primary-foreground" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Opacity Control */}
          {!showAutoHideSettings && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CircleDot className="w-3.5 h-3.5" />
                <span>Opacity</span>
                <span className="ml-auto font-mono">{selectedOpacity}%</span>
              </div>
              
              {/* Quick Presets */}
              <div className="grid grid-cols-4 gap-1">
                {OPACITY_PRESETS.map(preset => (
                  <button
                    key={preset.value}
                    onClick={() => handleOpacityChange(preset.value)}
                    className={cn(
                      'px-2 py-1.5 rounded-lg text-xs font-medium transition-all',
                      selectedOpacity === preset.value
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/50 hover:bg-muted text-foreground/70'
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              
              {/* Custom Slider */}
              <div className="flex items-center gap-3 px-1">
                <Waves className="w-4 h-4 text-muted-foreground opacity-50" />
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={selectedOpacity}
                  onChange={(e) => handleOpacityChange(parseInt(e.target.value))}
                  className="flex-1 h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                />
                <Waves className="w-4 h-4 text-muted-foreground" />
              </div>
              
              {/* Preview */}
              <div className="flex items-center justify-center p-2 rounded-lg bg-background/50">
                <div 
                  className="w-10 h-10 rounded-full bg-primary flex items-center justify-center"
                  style={{ opacity: selectedOpacity / 100 }}
                >
                  <Eye className="w-5 h-5 text-primary-foreground" />
                </div>
              </div>
            </div>
          )}

          {/* Border Style */}
          {!showAutoHideSettings && (
            <div className="space-y-2">
              <button
                onClick={() => setShowBorderPicker(!showBorderPicker)}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Square className={cn(
                    'w-5 h-5',
                    selectedBorder !== 'none' ? 'text-primary' : 'text-muted-foreground',
                    selectedBorder === 'dashed' && 'border-2 border-dashed border-current',
                    selectedBorder === 'dotted' && 'border-2 border-dotted border-current'
                  )} />
                  <span className="text-sm font-medium">
                    {selectedBorder !== 'none' 
                      ? BUTTON_BORDER_OPTIONS.find(b => b.value === selectedBorder)?.label + ' Border'
                      : 'Add Border'}
                  </span>
                </div>
                <Square 
                  className={cn(
                    'w-4 h-4 transition-colors',
                    showBorderPicker ? 'text-primary' : 'text-muted-foreground'
                  )} 
                />
              </button>
              
              {showBorderPicker && (
                <div className="space-y-2 animate-fade-in p-2 rounded-xl bg-muted/30">
                  <div className="grid grid-cols-2 gap-1.5">
                    {BUTTON_BORDER_OPTIONS.map(option => (
                      <button
                        key={option.value}
                        onClick={() => handleBorderChange(option.value)}
                        className={cn(
                          'p-2.5 rounded-lg transition-all text-left',
                          selectedBorder === option.value
                            ? 'bg-primary text-primary-foreground ring-2 ring-primary/50'
                            : 'bg-muted/50 hover:bg-muted text-foreground/70'
                        )}
                      >
                        <div className="text-xs font-medium">{option.label}</div>
                        <div className="text-[10px] opacity-70">{option.description}</div>
                      </button>
                    ))}
                  </div>
                  
                  {/* Border Preview */}
                  {selectedBorder !== 'none' && (
                    <div className="flex items-center justify-center p-3 rounded-lg bg-background/50">
                      <div className={cn(
                        'w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center',
                        selectedBorder === 'solid' && 'border-2 border-primary',
                        selectedBorder === 'dashed' && 'border-2 border-dashed border-primary',
                        selectedBorder === 'dotted' && 'border-2 border-dotted border-primary',
                        selectedBorder === 'gradient' && 'btn-border-gradient',
                      )}>
                        <Sparkles className="w-5 h-5 text-primary" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Shadow Style */}
          {!showAutoHideSettings && (
            <div className="space-y-2">
              <button
                onClick={() => setShowShadowPicker(!showShadowPicker)}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Sun className={cn(
                    'w-5 h-5',
                    selectedShadow !== 'none' ? 'text-primary' : 'text-muted-foreground'
                  )} />
                  <span className="text-sm font-medium">
                    {selectedShadow !== 'none' 
                      ? BUTTON_SHADOW_OPTIONS.find(s => s.value === selectedShadow)?.label + ' Shadow'
                      : 'Add Shadow'}
                  </span>
                </div>
                <Sun 
                  className={cn(
                    'w-4 h-4 transition-colors',
                    showShadowPicker ? 'text-primary' : 'text-muted-foreground'
                  )} 
                />
              </button>
              
              {showShadowPicker && (
                <div className="space-y-2 animate-fade-in p-2 rounded-xl bg-muted/30">
                  <div className="grid grid-cols-2 gap-1.5">
                    {BUTTON_SHADOW_OPTIONS.map(option => (
                      <button
                        key={option.value}
                        onClick={() => handleShadowChange(option.value)}
                        className={cn(
                          'p-2.5 rounded-lg transition-all text-left',
                          selectedShadow === option.value
                            ? 'bg-primary text-primary-foreground ring-2 ring-primary/50'
                            : 'bg-muted/50 hover:bg-muted text-foreground/70'
                        )}
                      >
                        <div className="text-xs font-medium">{option.label}</div>
                        <div className="text-[10px] opacity-70">{option.description}</div>
                      </button>
                    ))}
                  </div>
                  
                  {/* Shadow Preview */}
                  {selectedShadow !== 'none' && (
                    <div className="flex items-center justify-center p-3 rounded-lg bg-background/50">
                      <div className={cn(
                        'w-10 h-10 rounded-full bg-primary flex items-center justify-center',
                        selectedShadow === 'soft' && 'btn-shadow-soft',
                        selectedShadow === 'hard' && 'btn-shadow-hard',
                        selectedShadow === 'neon' && 'btn-shadow-neon',
                      )}>
                        <Sparkles className="w-5 h-5 text-primary-foreground" />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Hover Effects */}
          {!showAutoHideSettings && (
            <div className="space-y-2">
              <button
                onClick={() => setShowHoverPicker(!showHoverPicker)}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Activity className={cn(
                    'w-5 h-5',
                    selectedHover !== 'none' ? 'text-primary' : 'text-muted-foreground'
                  )} />
                  <span className="text-sm font-medium">
                    {selectedHover !== 'none' 
                      ? BUTTON_HOVER_OPTIONS.find(h => h.value === selectedHover)?.label + ' Hover'
                      : 'Hover Effect'}
                  </span>
                </div>
                <Activity 
                  className={cn(
                    'w-4 h-4 transition-colors',
                    showHoverPicker ? 'text-primary' : 'text-muted-foreground'
                  )} 
                />
              </button>
              
              {showHoverPicker && (
                <div className="space-y-2 animate-fade-in p-2 rounded-xl bg-muted/30">
                  <div className="grid grid-cols-2 gap-1.5">
                    {BUTTON_HOVER_OPTIONS.map(option => (
                      <button
                        key={option.value}
                        onClick={() => handleHoverChange(option.value)}
                        className={cn(
                          'p-2.5 rounded-lg transition-all text-left',
                          selectedHover === option.value
                            ? 'bg-primary text-primary-foreground ring-2 ring-primary/50'
                            : 'bg-muted/50 hover:bg-muted text-foreground/70'
                        )}
                      >
                        <div className="text-xs font-medium">{option.label}</div>
                        <div className="text-[10px] opacity-70">{option.description}</div>
                      </button>
                    ))}
                  </div>
                  
                  {/* Hover Preview */}
                  {selectedHover !== 'none' && (
                    <div className="flex items-center justify-center p-3 rounded-lg bg-background/50">
                      <div className={cn(
                        'w-10 h-10 rounded-full bg-primary flex items-center justify-center transition-all duration-300',
                        selectedHover === 'scale' && 'btn-hover-scale',
                        selectedHover === 'rotate' && 'btn-hover-rotate',
                        selectedHover === 'glow' && 'btn-hover-glow',
                        selectedHover === 'scale-rotate' && 'btn-hover-scale-rotate',
                        selectedHover === 'lift' && 'btn-hover-lift',
                      )}>
                        <Sparkles className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <span className="ml-2 text-[10px] text-muted-foreground">Hover to preview</span>
                    </div>
                  )}
                </div>
              )}
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

          {/* Divider */}
          <div className="border-t border-border/50" />

          {/* Presets Button - opens preset manager via event */}
          <button
            onClick={() => {
              light();
              window.dispatchEvent(new CustomEvent('openButtonPresets'));
              onClose();
            }}
            className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-accent/10 hover:bg-accent/20 text-accent-foreground transition-colors"
          >
            <Layers className="w-5 h-5" />
            <span className="text-sm font-medium">Manage Presets</span>
          </button>

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
