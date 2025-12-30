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
  preset: 'cyberpunk',
  buttonShape: 'rounded',
  glowIntensity: 'intense',
  colors: {
    primary: '270 95% 65%',
    accent: '320 90% 60%',
    glow: '270 95% 65%',
  },
};

const defaultAdvancedSettings: AdvancedSettings = {
  fontSize: 14,
  buttonSpacing: 16,
  buttonPadding: 12,
};

interface UICustomizationState {
  buttonLayout: ButtonPosition[];
  themeSettings: ThemeSettings;
  advancedSettings: AdvancedSettings;
}

interface UICustomizationContextType extends UICustomizationState {
  // Theme settings
  setPreset: (preset: string, colors: ThemeSettings['colors']) => void;
  setButtonShape: (shape: ThemeSettings['buttonShape']) => void;
  setGlowIntensity: (intensity: ThemeSettings['glowIntensity']) => void;
  
  // Advanced settings
  setFontSize: (size: number) => void;
  setButtonSpacing: (spacing: number) => void;
  setButtonPadding: (padding: number) => void;
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
}

const defaultState: UICustomizationState = {
  buttonLayout: defaultButtonLayout,
  themeSettings: defaultThemeSettings,
  advancedSettings: defaultAdvancedSettings,
};

const UICustomizationContext = createContext<UICustomizationContextType | undefined>(undefined);

export function useUICustomization() {
  const context = useContext(UICustomizationContext);
  if (!context) {
    throw new Error('useUICustomization must be used within UICustomizationProvider');
  }
  return context;
}

export function UICustomizationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<UICustomizationState>(() => {
    const saved = localStorage.getItem('visuai-ui-customization');
    if (saved) {
      try {
        return { ...defaultState, ...JSON.parse(saved) };
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

  // Apply theme CSS variables
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--preset-primary', state.themeSettings.colors.primary);
    root.style.setProperty('--preset-accent', state.themeSettings.colors.accent);
    root.style.setProperty('--preset-glow', state.themeSettings.colors.glow);
    
    // Apply button shape class
    root.classList.remove('btn-rounded', 'btn-pill', 'btn-sharp', 'btn-soft');
    root.classList.add(`btn-${state.themeSettings.buttonShape}`);
    
    // Apply glow intensity class
    root.classList.remove('glow-none', 'glow-subtle', 'glow-medium', 'glow-intense');
    root.classList.add(`glow-${state.themeSettings.glowIntensity}`);
  }, [state.themeSettings]);

  const setPreset = useCallback((preset: string, colors: ThemeSettings['colors']) => {
    setState(s => ({
      ...s,
      themeSettings: { ...s.themeSettings, preset, colors }
    }));
  }, []);

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

  const getVisibleButtons = useCallback(() => {
    return state.buttonLayout
      .filter(btn => btn.visible)
      .sort((a, b) => a.order - b.order);
  }, [state.buttonLayout]);

  return (
    <UICustomizationContext.Provider
      value={{
        ...state,
        setPreset,
        setButtonShape,
        setGlowIntensity,
        setFontSize,
        setButtonSpacing,
        setButtonPadding,
        resetAdvancedSettings,
        updateButtonPosition,
        reorderButtons,
        toggleButtonVisibility,
        setButtonAction,
        setButtonSize,
        resetLayout,
        getVisibleButtons,
      }}
    >
      {children}
    </UICustomizationContext.Provider>
  );
}
