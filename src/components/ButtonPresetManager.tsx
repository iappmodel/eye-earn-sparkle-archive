// Button Preset Manager - Save/Load button customization profiles and export/import JSON configs
import React, { useState, useEffect } from 'react';
import { 
  Save, FolderOpen, Download, Upload, Trash2, Check, X, Plus, 
  Layers, FileJson, Copy, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { loadSavedPositions, savePositions } from './DraggableButton';
import { 
  ButtonSizeOption, ButtonAnimationType, ButtonBorderStyle, ButtonShadowStyle,
  getButtonSizes, getButtonIcons, getButtonColors, getButtonAnimations, 
  getButtonOpacities, getButtonBorders, getButtonShadows, getHiddenButtons, getButtonActions
} from './LongPressButtonWrapper';

// Storage key for presets
const BUTTON_PRESETS_KEY = 'visuai-button-presets';

// Preset profile interface
export interface ButtonPreset {
  id: string;
  name: string;
  createdAt: string;
  data: ButtonConfigData;
}

// Complete button configuration data
export interface ButtonConfigData {
  positions: Record<string, { x: number; y: number }>;
  sizes: Record<string, ButtonSizeOption>;
  icons: Record<string, string>;
  colors: Record<string, string>;
  animations: Record<string, ButtonAnimationType>;
  opacities: Record<string, number>;
  borders: Record<string, ButtonBorderStyle>;
  shadows: Record<string, ButtonShadowStyle>;
  hidden: string[];
  actions: Record<string, string>;
}

// Get all button presets
export const getButtonPresets = (): ButtonPreset[] => {
  try {
    const saved = localStorage.getItem(BUTTON_PRESETS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

// Save all button presets
export const saveButtonPresets = (presets: ButtonPreset[]) => {
  try {
    localStorage.setItem(BUTTON_PRESETS_KEY, JSON.stringify(presets));
    window.dispatchEvent(new CustomEvent('buttonPresetsChanged', { detail: presets }));
  } catch (e) {
    console.error('Failed to save button presets:', e);
  }
};

// Create a new preset from current configuration
export const createPresetFromCurrent = (name: string): ButtonPreset => {
  const preset: ButtonPreset = {
    id: `preset-${Date.now()}`,
    name,
    createdAt: new Date().toISOString(),
    data: getCurrentButtonConfig(),
  };
  
  const presets = getButtonPresets();
  presets.push(preset);
  saveButtonPresets(presets);
  
  return preset;
};

// Get current button configuration
export const getCurrentButtonConfig = (): ButtonConfigData => {
  return {
    positions: loadSavedPositions(),
    sizes: getButtonSizes(),
    icons: getButtonIcons(),
    colors: getButtonColors(),
    animations: getButtonAnimations(),
    opacities: getButtonOpacities(),
    borders: getButtonBorders(),
    shadows: getButtonShadows(),
    hidden: getHiddenButtons(),
    actions: getButtonActions(),
  };
};

// Apply a preset configuration
export const applyButtonConfig = (data: ButtonConfigData) => {
  // Apply positions
  savePositions(data.positions || {});
  
  // Apply each setting type
  localStorage.setItem('visuai-button-sizes', JSON.stringify(data.sizes || {}));
  localStorage.setItem('visuai-button-icons', JSON.stringify(data.icons || {}));
  localStorage.setItem('visuai-button-colors', JSON.stringify(data.colors || {}));
  localStorage.setItem('visuai-button-animations', JSON.stringify(data.animations || {}));
  localStorage.setItem('visuai-button-opacity', JSON.stringify(data.opacities || {}));
  localStorage.setItem('visuai-button-borders', JSON.stringify(data.borders || {}));
  localStorage.setItem('visuai-button-shadows', JSON.stringify(data.shadows || {}));
  localStorage.setItem('visuai-hidden-buttons', JSON.stringify(data.hidden || []));
  localStorage.setItem('visuai-button-actions', JSON.stringify(data.actions || {}));
  
  // Dispatch events to trigger UI updates
  window.dispatchEvent(new Event('storage'));
  window.dispatchEvent(new CustomEvent('buttonConfigApplied'));
};

// Delete a preset
export const deletePreset = (presetId: string) => {
  const presets = getButtonPresets().filter(p => p.id !== presetId);
  saveButtonPresets(presets);
};

// Export configuration to JSON string
export const exportButtonConfig = (): string => {
  const config = getCurrentButtonConfig();
  return JSON.stringify(config, null, 2);
};

// Import configuration from JSON string
export const importButtonConfig = (jsonString: string): boolean => {
  try {
    const data = JSON.parse(jsonString) as ButtonConfigData;
    applyButtonConfig(data);
    return true;
  } catch (e) {
    console.error('Failed to import button config:', e);
    return false;
  }
};

// Button Preset Manager Component
interface ButtonPresetManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ButtonPresetManager: React.FC<ButtonPresetManagerProps> = ({ isOpen, onClose }) => {
  const { light, success, error } = useHapticFeedback();
  const [presets, setPresets] = useState<ButtonPreset[]>([]);
  const [showNewPreset, setShowNewPreset] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState('');
  const [copied, setCopied] = useState(false);
  
  useEffect(() => {
    setPresets(getButtonPresets());
    
    const handlePresetsChanged = () => {
      setPresets(getButtonPresets());
    };
    
    window.addEventListener('buttonPresetsChanged', handlePresetsChanged);
    return () => window.removeEventListener('buttonPresetsChanged', handlePresetsChanged);
  }, []);
  
  const handleSavePreset = () => {
    if (!newPresetName.trim()) return;
    
    light();
    createPresetFromCurrent(newPresetName.trim());
    setNewPresetName('');
    setShowNewPreset(false);
    success();
  };
  
  const handleLoadPreset = (preset: ButtonPreset) => {
    light();
    applyButtonConfig(preset.data);
    success();
    setTimeout(() => window.location.reload(), 300);
  };
  
  const handleDeletePreset = (presetId: string) => {
    light();
    deletePreset(presetId);
    setPresets(getButtonPresets());
  };
  
  const handleExport = async () => {
    light();
    const json = exportButtonConfig();
    
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      success();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: create download
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'button-config.json';
      a.click();
      URL.revokeObjectURL(url);
      success();
    }
  };
  
  const handleImport = () => {
    if (!importJson.trim()) {
      setImportError('Please paste a valid JSON configuration');
      return;
    }
    
    light();
    const success_import = importButtonConfig(importJson);
    
    if (success_import) {
      success();
      setShowImport(false);
      setImportJson('');
      setImportError('');
      setTimeout(() => window.location.reload(), 300);
    } else {
      error();
      setImportError('Invalid JSON configuration');
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-[9998] bg-black/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-[400px] md:max-h-[80vh] z-[9999] rounded-2xl bg-card/95 backdrop-blur-xl border border-border shadow-2xl animate-scale-in overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50 bg-muted/30">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            <span className="font-semibold">Button Presets</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Save Current as Preset */}
          {!showNewPreset ? (
            <button
              onClick={() => setShowNewPreset(true)}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span className="font-medium">Save Current Layout</span>
            </button>
          ) : (
            <div className="space-y-2 p-3 rounded-xl bg-muted/50 animate-fade-in">
              <input
                type="text"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                placeholder="Preset name..."
                className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSavePreset}
                  disabled={!newPresetName.trim()}
                  className="flex-1 flex items-center justify-center gap-2 p-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span className="text-sm">Save</span>
                </button>
                <button
                  onClick={() => {
                    setShowNewPreset(false);
                    setNewPresetName('');
                  }}
                  className="px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          
          {/* Saved Presets */}
          {presets.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs text-muted-foreground">Saved Presets</span>
              {presets.map(preset => (
                <div
                  key={preset.id}
                  className="flex items-center gap-2 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors group"
                >
                  <Sparkles className="w-4 h-4 text-primary" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{preset.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(preset.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={() => handleLoadPreset(preset)}
                    className="p-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                    title="Load preset"
                  >
                    <FolderOpen className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeletePreset(preset.id)}
                    className="p-2 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive opacity-0 group-hover:opacity-100 transition-all"
                    title="Delete preset"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {presets.length === 0 && !showNewPreset && (
            <div className="text-center py-6 text-muted-foreground text-sm">
              No presets saved yet
            </div>
          )}
          
          {/* Divider */}
          <div className="border-t border-border/50 pt-4">
            <span className="text-xs text-muted-foreground">Import / Export</span>
          </div>
          
          {/* Export Button */}
          <button
            onClick={handleExport}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-5 h-5 text-green-500" />
                <span className="font-medium text-green-500">Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium">Export Configuration</span>
              </>
            )}
          </button>
          
          {/* Import Section */}
          {!showImport ? (
            <button
              onClick={() => setShowImport(true)}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors"
            >
              <Upload className="w-5 h-5 text-muted-foreground" />
              <span className="font-medium">Import Configuration</span>
            </button>
          ) : (
            <div className="space-y-2 p-3 rounded-xl bg-muted/50 animate-fade-in">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <FileJson className="w-3.5 h-3.5" />
                <span>Paste JSON configuration</span>
              </div>
              <textarea
                value={importJson}
                onChange={(e) => {
                  setImportJson(e.target.value);
                  setImportError('');
                }}
                placeholder='{"positions": {}, "sizes": {}, ...}'
                className="w-full h-24 px-3 py-2 rounded-lg bg-background border border-border text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
              {importError && (
                <div className="text-xs text-destructive">{importError}</div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleImport}
                  className="flex-1 flex items-center justify-center gap-2 p-2 rounded-lg bg-primary text-primary-foreground transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span className="text-sm">Import</span>
                </button>
                <button
                  onClick={() => {
                    setShowImport(false);
                    setImportJson('');
                    setImportError('');
                  }}
                  className="px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ButtonPresetManager;
