import React from 'react';
import { 
  Eye, 
  Smartphone, 
  Volume2, 
  Hand, 
  Sun, 
  Moon, 
  Zap, 
  Leaf,
  Type,
  Minus,
  Plus,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAccessibility, UIDensity, ThemePack } from '@/contexts/AccessibilityContext';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Card3D } from '@/components/ui/Card3D';

interface SettingRowProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}

const SettingRow: React.FC<SettingRowProps> = ({ icon, title, description, children }) => (
  <div className="flex items-center justify-between gap-4 py-4 border-b border-border/50 last:border-0">
    <div className="flex items-start gap-3">
      <div className="p-2 rounded-lg bg-muted text-primary">{icon}</div>
      <div>
        <h4 className="font-medium text-foreground">{title}</h4>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
    <div className="flex-shrink-0">{children}</div>
  </div>
);

const densityOptions: { value: UIDensity; label: string }[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'default', label: 'Default' },
  { value: 'comfortable', label: 'Comfortable' },
];

const themeOptions: { value: ThemePack; label: string; icon: React.ReactNode }[] = [
  { value: 'default', label: 'Default', icon: <Sparkles className="w-4 h-4" /> },
  { value: 'night', label: 'Night', icon: <Moon className="w-4 h-4" /> },
  { value: 'focus', label: 'Focus', icon: <Eye className="w-4 h-4" /> },
  { value: 'energy', label: 'Energy', icon: <Zap className="w-4 h-4" /> },
  { value: 'nature', label: 'Nature', icon: <Leaf className="w-4 h-4" /> },
];

export const AccessibilitySettings: React.FC = () => {
  const {
    uiDensity,
    setUIDensity,
    reducedMotion,
    setReducedMotion,
    highContrast,
    setHighContrast,
    voiceControlEnabled,
    setVoiceControl,
    themePack,
    setThemePack,
    fontSize,
    setFontSize,
    gestureNavEnabled,
    setGestureNav,
    hapticFeedback,
    setHapticFeedback,
  } = useAccessibility();

  return (
    <div className="space-y-6 p-4">
      {/* UI Density */}
      <Card3D className="p-4" tiltEnabled={false}>
        <h3 className="font-display text-lg font-semibold mb-4 gradient-text">
          Interface Density
        </h3>
        <div className="flex gap-2">
          {densityOptions.map(option => (
            <button
              key={option.value}
              onClick={() => setUIDensity(option.value)}
              className={cn(
                'flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all',
                uiDensity === option.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </Card3D>

      {/* Font Size */}
      <Card3D className="p-4" tiltEnabled={false}>
        <h3 className="font-display text-lg font-semibold mb-4 gradient-text">
          Text Size
        </h3>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setFontSize(Math.max(0.85, fontSize - 0.15))}
            className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
            aria-label="Decrease font size"
          >
            <Minus className="w-4 h-4" />
          </button>
          
          <div className="flex-1">
            <Slider
              value={[fontSize]}
              min={0.85}
              max={1.3}
              step={0.15}
              onValueChange={([v]) => setFontSize(v)}
              className="w-full"
            />
          </div>
          
          <button
            onClick={() => setFontSize(Math.min(1.3, fontSize + 0.15))}
            className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
            aria-label="Increase font size"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <p className="text-center text-sm text-muted-foreground mt-2">
          {Math.round(fontSize * 100)}%
        </p>
      </Card3D>

      {/* Theme Packs */}
      <Card3D className="p-4" tiltEnabled={false}>
        <h3 className="font-display text-lg font-semibold mb-4 gradient-text">
          Theme Pack
        </h3>
        <div className="grid grid-cols-5 gap-2">
          {themeOptions.map(option => (
            <button
              key={option.value}
              onClick={() => setThemePack(option.value)}
              className={cn(
                'flex flex-col items-center gap-1 p-3 rounded-xl transition-all',
                themePack === option.value
                  ? 'bg-primary text-primary-foreground scale-105'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {option.icon}
              <span className="text-xs">{option.label}</span>
            </button>
          ))}
        </div>
      </Card3D>

      {/* Accessibility Toggles */}
      <Card3D className="p-4" tiltEnabled={false}>
        <h3 className="font-display text-lg font-semibold mb-4 gradient-text">
          Accessibility
        </h3>
        
        <SettingRow
          icon={<Eye className="w-5 h-5" />}
          title="High Contrast"
          description="Increase contrast for better visibility"
        >
          <Switch checked={highContrast} onCheckedChange={setHighContrast} />
        </SettingRow>

        <SettingRow
          icon={<Sparkles className="w-5 h-5" />}
          title="Reduced Motion"
          description="Minimize animations and effects"
        >
          <Switch checked={reducedMotion} onCheckedChange={setReducedMotion} />
        </SettingRow>

        <SettingRow
          icon={<Volume2 className="w-5 h-5" />}
          title="Voice Control"
          description="Enable hands-free navigation"
        >
          <Switch checked={voiceControlEnabled} onCheckedChange={setVoiceControl} />
        </SettingRow>
      </Card3D>

      {/* Interaction Preferences */}
      <Card3D className="p-4" tiltEnabled={false}>
        <h3 className="font-display text-lg font-semibold mb-4 gradient-text">
          Interactions
        </h3>
        
        <SettingRow
          icon={<Hand className="w-5 h-5" />}
          title="Gesture Navigation"
          description="Swipe to navigate between content"
        >
          <Switch checked={gestureNavEnabled} onCheckedChange={setGestureNav} />
        </SettingRow>

        <SettingRow
          icon={<Smartphone className="w-5 h-5" />}
          title="Haptic Feedback"
          description="Vibration for button interactions"
        >
          <Switch checked={hapticFeedback} onCheckedChange={setHapticFeedback} />
        </SettingRow>
      </Card3D>
    </div>
  );
};
