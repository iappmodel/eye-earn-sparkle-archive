import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// Button action types
export type ButtonAction = 
  | 'like' | 'comment' | 'share' | 'follow' 
  | 'wallet' | 'profile' | 'settings' | 'tip'
  | 'save' | 'report' | 'mute' | 'none';

// Button position in the layout
export interface ButtonPosition {
  id: string;
  action: ButtonAction;
  order: number;
  visible: boolean;
  size: 'sm' | 'md' | 'lg';
}

// Color mode for base theme (light/dark)
export type ColorMode = 'light' | 'dark' | 'system';

// User-saved custom theme preset
export interface CustomThemePreset {
  id: string;
  name: string;
  createdAt: number;
  colors: { primary: string; accent: string; glow: string };
  buttonShape: ThemeSettings['buttonShape'];
  glowIntensity: ThemeSettings['glowIntensity'];
}

// Theme customization settings
export interface ThemeSettings {
  preset: string;
  buttonShape: 'rounded' | 'pill' | 'sharp' | 'soft';
  glowIntensity: 'none' | 'subtle' | 'medium' | 'intense';
  colors: {
    primary: string;
    accent: string;
    glow: string;
  };
}

// Advanced settings for fine-tuning
export interface AdvancedSettings {
  fontSize: number;
  buttonSpacing: number;
  buttonPadding: number;
  animationSpeed: number; // 0.5 = slow, 1 = normal, 2 = fast
}

// Page navigation direction
export type PageDirection = 'up' | 'down' | 'left' | 'right' | 'center';

// CSS effects for pages
export interface PageEffects {
  blur: number; // 0-20px
  saturation: number; // 0-200%
  contrast: number; // 50-150%
  brightness: number; // 50-150%
}

// Page slot configuration
export interface PageSlot {
  id: string;
  direction: PageDirection;
  order: number;
  contentType: string;
  label: string;
  theme: string; // Theme preset id or 'inherit'
  customColors?: {
    primary: string;
    accent: string;
    glow: string;
  };
  transitionSpeed?: number; // 0.5-2, multiplier (1 = use global)
  effects?: PageEffects;
}

// Page layout configuration
export interface PageLayout {
  pages: PageSlot[];
  enableMultiDirection: boolean;
}

// Default button layout
const defaultButtonLayout: ButtonPosition[] = [
  { id: 'like', action: 'like', order: 0, visible: true, size: 'md' },
  { id: 'comment', action: 'comment', order: 1, visible: true, size: 'md' },
  { id: 'share', action: 'share', order: 2, visible: true, size: 'md' },
  { id: 'follow', action: 'follow', order: 3, visible: true, size: 'md' },
  { id: 'wallet', action: 'wallet', order: 4, visible: true, size: 'md' },
  { id: 'profile', action: 'profile', order: 5, visible: true, size: 'md' },
  { id: 'settings', action: 'settings', order: 6, visible: true, size: 'md' },
];

const defaultThemeSettings: ThemeSettings = {
  preset: 'midnight',
  buttonShape: 'rounded',
  glowIntensity: 'medium',
  colors: {
    primary: '210 96% 62%',
    accent: '42 96% 56%',
    glow: '195 96% 62%',
  },
};

const defaultAdvancedSettings: AdvancedSettings = {
  fontSize: 14,
  buttonSpacing: 16,
  buttonPadding: 12,
  animationSpeed: 1,
};

// Default page layout
const defaultPageLayout: PageLayout = {
  pages: [
    { id: 'main', direction: 'center', order: 0, contentType: 'main', label: 'Main Feed', theme: 'inherit' },
    { id: 'friends', direction: 'left', order: 0, contentType: 'friends', label: 'Friends', theme: 'ocean' },
    { id: 'promotions', direction: 'right', order: 0, contentType: 'promotions', label: 'Promotions', theme: 'ember' },
  ],
  enableMultiDirection: true,
};

const MAX_RECENT_PRESETS = 6;

interface UICustomizationState {
  buttonLayout: ButtonPosition[];
  themeSettings: ThemeSettings;
  advancedSettings: AdvancedSettings;
  pageLayout: PageLayout;
  colorMode: ColorMode;
  customPresets: CustomThemePreset[];
  recentPresetIds: string[];
}

interface UICustomizationContextType extends UICustomizationState {
  // Theme settings
  setPreset: (preset: string, colors: ThemeSettings['colors']) => void;
  setColors: (colors: Partial<ThemeSettings['colors']>) => void;
  setButtonShape: (shape: ThemeSettings['buttonShape']) => void;
  setGlowIntensity: (intensity: ThemeSettings['glowIntensity']) => void;
  setColorMode: (mode: ColorMode) => void;
  resetThemeToDefault: () => void;
  // Custom presets
  saveCustomPreset: (name: string) => string | null;
  removeCustomPreset: (id: string) => void;
  getPresetById: (id: string) => CustomThemePreset | undefined;
  
  // Advanced settings
  setFontSize: (size: number) => void;
  setButtonSpacing: (spacing: number) => void;
  setButtonPadding: (padding: number) => void;
  setAnimationSpeed: (speed: number) => void;
  resetAdvancedSettings: () => void;
  
  // Button layout
  updateButtonPosition: (id: string, updates: Partial<ButtonPosition>) => void;
  reorderButtons: (fromIndex: number, toIndex: number) => void;
  toggleButtonVisibility: (id: string) => void;
  setButtonAction: (id: string, action: ButtonAction) => void;
  setButtonSize: (id: string, size: 'sm' | 'md' | 'lg') => void;
  resetLayout: () => void;
  
  // Get visible buttons in order
  getVisibleButtons: () => ButtonPosition[];
  
  // Page layout
  addPage: (page: PageSlot) => void;
  removePage: (id: string) => void;
  updatePage: (id: string, updates: Partial<PageSlot>) => void;
  reorderPages: (direction: PageDirection, fromIndex: number, toIndex: number) => void;
  resetPageLayout: () => void;
  getPagesByDirection: (direction: PageDirection) => PageSlot[];
  
  // Import/Export
  exportLayout: () => string;
  importLayout: (json: string) => boolean;
  exportThemeOnly: () => string;
  importThemeOnly: (json: string) => boolean;
}

const defaultState: UICustomizationState = {
  buttonLayout: defaultButtonLayout,
  themeSettings: defaultThemeSettings,
  advancedSettings: defaultAdvancedSettings,
  pageLayout: defaultPageLayout,
  colorMode: 'dark',
  customPresets: [],
  recentPresetIds: [],
};

const UICustomizationContext = createContext<UICustomizationContextType | undefined>(undefined);

export function useUICustomization() {
  const context = useContext(UICustomizationContext);
  if (!context) {
    throw new Error('useUICustomization must be used within UICustomizationProvider');
  }
  return context;
}

function mergeSavedState(saved: Record<string, unknown>): UICustomizationState {
  return {
    ...defaultState,
    ...saved,
    themeSettings: { ...defaultThemeSettings, ...(saved.themeSettings as object) },
    advancedSettings: { ...defaultAdvancedSettings, ...(saved.advancedSettings as object) },
    buttonLayout: Array.isArray(saved.buttonLayout) ? saved.buttonLayout : defaultState.buttonLayout,
    pageLayout: saved.pageLayout && typeof saved.pageLayout === 'object'
      ? { ...defaultPageLayout, ...saved.pageLayout } as PageLayout
      : defaultState.pageLayout,
    colorMode: ['light', 'dark', 'system'].includes(saved.colorMode as string) ? saved.colorMode as ColorMode : defaultState.colorMode,
    customPresets: Array.isArray(saved.customPresets) ? saved.customPresets as CustomThemePreset[] : defaultState.customPresets,
    recentPresetIds: Array.isArray(saved.recentPresetIds) ? saved.recentPresetIds.slice(0, MAX_RECENT_PRESETS) : defaultState.recentPresetIds,
  };
}

export function UICustomizationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<UICustomizationState>(() => {
    const saved = localStorage.getItem('visuai-ui-customization');
    if (saved) {
      try {
        return mergeSavedState(JSON.parse(saved));
      } catch {
        return defaultState;
      }
    }
    return defaultState;
  });

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem('visuai-ui-customization', JSON.stringify(state));
  }, [state]);

  // Apply color mode (light/dark/system) to document
  useEffect(() => {
    const root = document.documentElement;
    const applyDark = (dark: boolean) => {
      if (dark) root.classList.add('dark');
      else root.classList.remove('dark');
    };
    if (state.colorMode === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      applyDark(mq.matches);
      const handler = () => applyDark(mq.matches);
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
    applyDark(state.colorMode === 'dark');
  }, [state.colorMode]);

  // Apply theme CSS variables
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--preset-primary', state.themeSettings.colors.primary);
    root.style.setProperty('--preset-accent', state.themeSettings.colors.accent);
    root.style.setProperty('--preset-glow', state.themeSettings.colors.glow);

    // Make presets actually affect the app theme variables (inline overrides win over CSS defaults).
    root.style.setProperty('--primary', state.themeSettings.colors.primary);
    root.style.setProperty('--accent', state.themeSettings.colors.accent);
    root.style.setProperty('--ring', state.themeSettings.colors.primary);
    root.style.setProperty('--neon-purple', state.themeSettings.colors.primary);
    root.style.setProperty('--neon-magenta', state.themeSettings.colors.accent);
    root.style.setProperty('--depth-glow', state.themeSettings.colors.glow);
    root.style.setProperty('--gradient-start', state.themeSettings.colors.primary);
    root.style.setProperty('--gradient-mid', state.themeSettings.colors.accent);
    root.style.setProperty('--gradient-end', state.themeSettings.colors.glow);
    
    // Apply button shape class
    root.classList.remove('btn-rounded', 'btn-pill', 'btn-sharp', 'btn-soft');
    root.classList.add(`btn-${state.themeSettings.buttonShape}`);
    
    // Apply glow intensity class
    root.classList.remove('glow-none', 'glow-subtle', 'glow-medium', 'glow-intense');
    root.classList.add(`glow-${state.themeSettings.glowIntensity}`);

    // Preset-only “glass” class (separate from Theme Pack system).
    root.classList.toggle('ui-glass', state.themeSettings.preset === 'glass');
  }, [state.themeSettings]);

  const setPreset = useCallback((preset: string, colors: ThemeSettings['colors']) => {
    setState(s => {
      const nextRecent = [preset, ...s.recentPresetIds.filter(id => id !== preset)].slice(0, MAX_RECENT_PRESETS);
      return {
        ...s,
        themeSettings: { ...s.themeSettings, preset, colors },
        recentPresetIds: nextRecent,
      };
    });
  }, []);

  const setColors = useCallback((colors: Partial<ThemeSettings['colors']>) => {
    setState(s => ({
      ...s,
      themeSettings: {
        ...s.themeSettings,
        colors: { ...s.themeSettings.colors, ...colors },
        preset: 'custom',
      },
    }));
  }, []);

  const setColorMode = useCallback((colorMode: ColorMode) => {
    setState(s => ({ ...s, colorMode }));
  }, []);

  const resetThemeToDefault = useCallback(() => {
    setState(s => ({
      ...s,
      themeSettings: defaultThemeSettings,
    }));
  }, []);

  const saveCustomPreset = useCallback((name: string): string | null => {
    const id = `custom-${Date.now()}`;
    setState(s => {
      if (s.customPresets.some(p => p.name === name)) return s;
      const preset: CustomThemePreset = {
        id,
        name: name.trim() || 'My theme',
        createdAt: Date.now(),
        colors: { ...s.themeSettings.colors },
        buttonShape: s.themeSettings.buttonShape,
        glowIntensity: s.themeSettings.glowIntensity,
      };
      return {
        ...s,
        customPresets: [...s.customPresets, preset],
        themeSettings: { ...s.themeSettings, preset: id, colors: preset.colors },
        recentPresetIds: [id, ...s.recentPresetIds.filter(x => x !== id)].slice(0, MAX_RECENT_PRESETS),
      };
    });
    return id;
  }, []);

  const removeCustomPreset = useCallback((id: string) => {
    setState(s => ({
      ...s,
      customPresets: s.customPresets.filter(p => p.id !== id),
      recentPresetIds: s.recentPresetIds.filter(x => x !== id),
      themeSettings: s.themeSettings.preset === id
        ? { ...s.themeSettings, preset: defaultThemeSettings.preset, colors: defaultThemeSettings.colors }
        : s.themeSettings,
    }));
  }, []);

  const getPresetById = useCallback((id: string): CustomThemePreset | undefined => {
    return state.customPresets.find(p => p.id === id);
  }, [state.customPresets]);

  const setButtonShape = useCallback((buttonShape: ThemeSettings['buttonShape']) => {
    setState(s => ({
      ...s,
      themeSettings: { ...s.themeSettings, buttonShape }
    }));
  }, []);

  const setGlowIntensity = useCallback((glowIntensity: ThemeSettings['glowIntensity']) => {
    setState(s => ({
      ...s,
      themeSettings: { ...s.themeSettings, glowIntensity }
    }));
  }, []);

  const updateButtonPosition = useCallback((id: string, updates: Partial<ButtonPosition>) => {
    setState(s => ({
      ...s,
      buttonLayout: s.buttonLayout.map(btn =>
        btn.id === id ? { ...btn, ...updates } : btn
      )
    }));
  }, []);

  const reorderButtons = useCallback((fromIndex: number, toIndex: number) => {
    setState(s => {
      const newLayout = [...s.buttonLayout];
      const [removed] = newLayout.splice(fromIndex, 1);
      newLayout.splice(toIndex, 0, removed);
      // Update order values
      return {
        ...s,
        buttonLayout: newLayout.map((btn, idx) => ({ ...btn, order: idx }))
      };
    });
  }, []);

  const toggleButtonVisibility = useCallback((id: string) => {
    setState(s => ({
      ...s,
      buttonLayout: s.buttonLayout.map(btn =>
        btn.id === id ? { ...btn, visible: !btn.visible } : btn
      )
    }));
  }, []);

  const setButtonAction = useCallback((id: string, action: ButtonAction) => {
    setState(s => ({
      ...s,
      buttonLayout: s.buttonLayout.map(btn =>
        btn.id === id ? { ...btn, action } : btn
      )
    }));
  }, []);

  const setButtonSize = useCallback((id: string, size: 'sm' | 'md' | 'lg') => {
    setState(s => ({
      ...s,
      buttonLayout: s.buttonLayout.map(btn =>
        btn.id === id ? { ...btn, size } : btn
      )
    }));
  }, []);

  const resetLayout = useCallback(() => {
    setState(s => ({
      ...s,
      buttonLayout: defaultButtonLayout
    }));
  }, []);

  const setFontSize = useCallback((fontSize: number) => {
    setState(s => ({
      ...s,
      advancedSettings: { ...s.advancedSettings, fontSize }
    }));
  }, []);

  const setButtonSpacing = useCallback((buttonSpacing: number) => {
    setState(s => ({
      ...s,
      advancedSettings: { ...s.advancedSettings, buttonSpacing }
    }));
  }, []);

  const setButtonPadding = useCallback((buttonPadding: number) => {
    setState(s => ({
      ...s,
      advancedSettings: { ...s.advancedSettings, buttonPadding }
    }));
  }, []);

  const resetAdvancedSettings = useCallback(() => {
    setState(s => ({
      ...s,
      advancedSettings: defaultAdvancedSettings
    }));
  }, []);

  const setAnimationSpeed = useCallback((animationSpeed: number) => {
    setState(s => ({
      ...s,
      advancedSettings: { ...s.advancedSettings, animationSpeed }
    }));
  }, []);

  // Apply animation speed as CSS variable
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--animation-speed', `${1 / state.advancedSettings.animationSpeed}`);
  }, [state.advancedSettings.animationSpeed]);

  const getVisibleButtons = useCallback(() => {
    return state.buttonLayout
      .filter(btn => btn.visible)
      .sort((a, b) => a.order - b.order);
  }, [state.buttonLayout]);

  // Page layout functions
  const addPage = useCallback((page: PageSlot) => {
    setState(s => ({
      ...s,
      pageLayout: {
        ...s.pageLayout,
        pages: [...s.pageLayout.pages, page]
      }
    }));
  }, []);

  const removePage = useCallback((id: string) => {
    setState(s => ({
      ...s,
      pageLayout: {
        ...s.pageLayout,
        pages: s.pageLayout.pages.filter(p => p.id !== id)
      }
    }));
  }, []);

  const updatePage = useCallback((id: string, updates: Partial<PageSlot>) => {
    setState(s => ({
      ...s,
      pageLayout: {
        ...s.pageLayout,
        pages: s.pageLayout.pages.map(p => 
          p.id === id ? { ...p, ...updates } : p
        )
      }
    }));
  }, []);

  const reorderPages = useCallback((direction: PageDirection, fromIndex: number, toIndex: number) => {
    setState(s => {
      const directionPages = s.pageLayout.pages.filter(p => p.direction === direction);
      const otherPages = s.pageLayout.pages.filter(p => p.direction !== direction);
      const [removed] = directionPages.splice(fromIndex, 1);
      directionPages.splice(toIndex, 0, removed);
      const reorderedPages = directionPages.map((p, idx) => ({ ...p, order: idx }));
      return {
        ...s,
        pageLayout: {
          ...s.pageLayout,
          pages: [...otherPages, ...reorderedPages]
        }
      };
    });
  }, []);

  const resetPageLayout = useCallback(() => {
    setState(s => ({
      ...s,
      pageLayout: defaultPageLayout
    }));
  }, []);

  const getPagesByDirection = useCallback((direction: PageDirection) => {
    return state.pageLayout.pages
      .filter(p => p.direction === direction)
      .sort((a, b) => a.order - b.order);
  }, [state.pageLayout.pages]);

  // Export layout as JSON string
  const exportLayout = useCallback(() => {
    const exportData = {
      version: '1.0',
      pageLayout: state.pageLayout,
      themeSettings: state.themeSettings,
      advancedSettings: state.advancedSettings,
      exportedAt: new Date().toISOString(),
    };
    return JSON.stringify(exportData, null, 2);
  }, [state.pageLayout, state.themeSettings, state.advancedSettings]);

  // Import layout from JSON string
  const importLayout = useCallback((json: string): boolean => {
    try {
      const data = JSON.parse(json);
      if (!data.version || !data.pageLayout) {
        console.error('Invalid layout format');
        return false;
      }
      setState(s => ({
        ...s,
        pageLayout: data.pageLayout,
        themeSettings: data.themeSettings || s.themeSettings,
        advancedSettings: data.advancedSettings || s.advancedSettings,
      }));
      return true;
    } catch (e) {
      console.error('Failed to import layout:', e);
      return false;
    }
  }, []);

  // Export theme only (preset, colors, button shape, glow, colorMode)
  const exportThemeOnly = useCallback(() => {
    const data = {
      version: '1.0',
      type: 'theme',
      themeSettings: state.themeSettings,
      colorMode: state.colorMode,
      exportedAt: new Date().toISOString(),
    };
    return JSON.stringify(data, null, 2);
  }, [state.themeSettings, state.colorMode]);

  // Import theme only
  const importThemeOnly = useCallback((json: string): boolean => {
    try {
      const data = JSON.parse(json);
      if (data.type !== 'theme' || !data.themeSettings) {
        console.error('Invalid theme format');
        return false;
      }
      setState(s => ({
        ...s,
        themeSettings: { ...defaultThemeSettings, ...data.themeSettings },
        colorMode: ['light', 'dark', 'system'].includes(data.colorMode) ? data.colorMode : s.colorMode,
      }));
      return true;
    } catch (e) {
      console.error('Failed to import theme:', e);
      return false;
    }
  }, []);

  return (
    <UICustomizationContext.Provider
      value={{
        ...state,
        setPreset,
        setColors,
        setButtonShape,
        setGlowIntensity,
        setColorMode,
        resetThemeToDefault,
        saveCustomPreset,
        removeCustomPreset,
        getPresetById,
        setFontSize,
        setButtonSpacing,
        setButtonPadding,
        setAnimationSpeed,
        resetAdvancedSettings,
        updateButtonPosition,
        reorderButtons,
        toggleButtonVisibility,
        setButtonAction,
        setButtonSize,
        resetLayout,
        getVisibleButtons,
        addPage,
        removePage,
        updatePage,
        reorderPages,
        resetPageLayout,
        getPagesByDirection,
        exportLayout,
        importLayout,
        exportThemeOnly,
        importThemeOnly,
      }}
    >
      {children}
    </UICustomizationContext.Provider>
  );
}
