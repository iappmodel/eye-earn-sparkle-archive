import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Target, Zap, Settings, X, Check, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { 
  useBlinkRemoteControl, 
  BlinkAction,
  getBlinkCommand,
  setBlinkCommand,
  RemoteControlSettings 
} from '@/hooks/useBlinkRemoteControl';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface BlinkRemoteControlProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  className?: string;
}

const BLINK_ACTIONS: { value: BlinkAction; label: string; icon: string }[] = [
  { value: 'click', label: 'Tap/Click', icon: '👆' },
  { value: 'longPress', label: 'Long Press', icon: '✋' },
  { value: 'toggle', label: 'Toggle', icon: '🔄' },
  { value: 'none', label: 'No Action', icon: '⏸️' },
];

const CALIBRATION_POINTS = [
  { x: '10%', y: '10%', label: 'Top Left' },
  { x: '90%', y: '10%', label: 'Top Right' },
  { x: '10%', y: '90%', label: 'Bottom Left' },
  { x: '90%', y: '90%', label: 'Bottom Right' },
];

export const BlinkRemoteControl: React.FC<BlinkRemoteControlProps> = ({
  enabled,
  onToggle,
  className,
}) => {
  const haptics = useHapticFeedback();
  const [showSettings, setShowSettings] = useState(false);
  const [selectedButton, setSelectedButton] = useState<string | null>(null);
  
  const {
    isActive,
    isCalibrating,
    currentTarget,
    gazePosition,
    pendingBlinkCount,
    lastAction,
    calibrationStep,
    settings,
    eyeOpenness,
    toggleActive,
    startCalibration,
    recordCalibrationPoint,
    cancelCalibration,
    updateSettings,
  } = useBlinkRemoteControl({
    enabled,
    onAction: (buttonId, action, count) => {
      haptics.medium();
      console.log('[RemoteControl] Action executed:', buttonId, action, count);
    },
  });

  // Haptic feedback for blinks
  useEffect(() => {
    if (pendingBlinkCount > 0) {
      haptics.light();
    }
  }, [pendingBlinkCount, haptics]);

  const handleCalibrationClick = (e: React.MouseEvent) => {
    if (isCalibrating) {
      recordCalibrationPoint(e.clientX, e.clientY);
      haptics.medium();
    }
  };

  return (
    <>
      {/* Floating Control Button */}
      <div className={cn(
        'fixed z-50 flex flex-col items-center gap-2',
        className
      )}>
        {/* Status indicator */}
        <div className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
          'bg-background/80 backdrop-blur-sm border border-border/50',
          isActive ? 'opacity-100' : 'opacity-60'
        )}>
          <div className={cn(
            'w-2 h-2 rounded-full transition-colors',
            isActive ? 'bg-green-500 animate-pulse' : 'bg-muted'
          )} />
          <span className="text-muted-foreground">
            {isActive ? 'Remote Active' : 'Remote Off'}
          </span>
          {pendingBlinkCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-primary text-primary-foreground rounded-full text-[10px]">
              {pendingBlinkCount}×
            </span>
          )}
        </div>

        {/* Main control button */}
        <Button
          variant={isActive ? 'default' : 'outline'}
          size="icon"
          className={cn(
            'w-14 h-14 rounded-full shadow-lg transition-all',
            isActive && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
          )}
          onClick={() => {
            toggleActive();
            onToggle(!isActive);
            haptics.medium();
          }}
        >
          {isActive ? (
            <Eye className="w-6 h-6" />
          ) : (
            <EyeOff className="w-6 h-6" />
          )}
        </Button>

        {/* Quick settings */}
        <Sheet open={showSettings} onOpenChange={setShowSettings}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
            >
              <Settings className="w-3 h-3 mr-1" />
              Settings
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[70vh]">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Blink Remote Control
              </SheetTitle>
            </SheetHeader>
            
            <div className="mt-4 space-y-6 overflow-y-auto max-h-[55vh] pb-4">
              {/* Main toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <h4 className="font-medium">Enable Remote Control</h4>
                  <p className="text-sm text-muted-foreground">Control the app by blinking at buttons</p>
                </div>
                <Switch
                  checked={settings.enabled}
                  onCheckedChange={(checked) => {
                    updateSettings({ enabled: checked });
                    if (checked) toggleActive();
                  }}
                />
              </div>

              {/* Sensitivity */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Gaze Sensitivity</label>
                  <span className="text-xs text-muted-foreground">{settings.sensitivity}/10</span>
                </div>
                <Slider
                  value={[settings.sensitivity]}
                  min={1}
                  max={10}
                  step={1}
                  onValueChange={([value]) => updateSettings({ sensitivity: value })}
                />
              </div>

              {/* Gaze hold time */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Target Lock Time</label>
                  <span className="text-xs text-muted-foreground">{settings.gazeHoldTime}ms</span>
                </div>
                <Slider
                  value={[settings.gazeHoldTime]}
                  min={200}
                  max={1500}
                  step={100}
                  onValueChange={([value]) => updateSettings({ gazeHoldTime: value })}
                />
              </div>

              {/* Blink pattern timeout */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Blink Pattern Window</label>
                  <span className="text-xs text-muted-foreground">{settings.blinkPatternTimeout}ms</span>
                </div>
                <Slider
                  value={[settings.blinkPatternTimeout]}
                  min={300}
                  max={1200}
                  step={100}
                  onValueChange={([value]) => updateSettings({ blinkPatternTimeout: value })}
                />
              </div>

              {/* Calibration */}
              <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                <h4 className="font-medium">Calibration</h4>
                <p className="text-sm text-muted-foreground">
                  Improve gaze accuracy by looking at screen corners
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowSettings(false);
                    startCalibration();
                  }}
                >
                  <Target className="w-4 h-4 mr-2" />
                  Start Calibration
                </Button>
              </div>

              {/* Blink commands explanation */}
              <div className="p-4 rounded-lg border border-border space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  How It Works
                </h4>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">1</span>
                    <span>Look at a button to target it</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">2</span>
                    <span>Blink 1×, 2×, or 3× for different actions</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">3</span>
                    <span>The command executes automatically</span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    <strong>Default commands:</strong><br />
                    1× Blink = Tap • 2× Blinks = Long Press • 3× Blinks = Toggle
                  </p>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Gaze cursor */}
      {isActive && gazePosition && !isCalibrating && (
        <div
          className="fixed pointer-events-none z-[100] transition-all duration-75"
          style={{
            left: gazePosition.x,
            top: gazePosition.y,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <div className={cn(
            'w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all',
            currentTarget 
              ? 'border-primary bg-primary/20 scale-110' 
              : 'border-muted-foreground/50 bg-background/30'
          )}>
            <Target className={cn(
              'w-5 h-5 transition-colors',
              currentTarget ? 'text-primary' : 'text-muted-foreground'
            )} />
          </div>
          {/* Eye openness indicator */}
          <div 
            className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-muted overflow-hidden"
          >
            <div 
              className="h-full bg-primary transition-all duration-100"
              style={{ width: `${eyeOpenness * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Target highlight */}
      {isActive && currentTarget && !isCalibrating && (
        <div
          className="fixed pointer-events-none z-[99] border-2 border-primary rounded-lg animate-pulse"
          style={{
            left: currentTarget.rect.left - 4,
            top: currentTarget.rect.top - 4,
            width: currentTarget.rect.width + 8,
            height: currentTarget.rect.height + 8,
          }}
        >
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-primary text-primary-foreground text-xs rounded whitespace-nowrap">
            {currentTarget.buttonId}
          </div>
        </div>
      )}

      {/* Last action toast */}
      {lastAction && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-medium animate-in fade-in slide-in-from-bottom-4">
          <Check className="w-4 h-4 inline-block mr-1" />
          {lastAction}
        </div>
      )}

      {/* Calibration overlay */}
      {isCalibrating && (
        <div 
          className="fixed inset-0 z-[200] bg-background/95 backdrop-blur-sm flex items-center justify-center"
          onClick={handleCalibrationClick}
        >
          {/* Cancel button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4"
            onClick={(e) => {
              e.stopPropagation();
              cancelCalibration();
            }}
          >
            <X className="w-5 h-5" />
          </Button>

          {/* Calibration point */}
          {calibrationStep < 4 && (
            <div
              className="absolute flex flex-col items-center gap-2"
              style={{
                left: CALIBRATION_POINTS[calibrationStep].x,
                top: CALIBRATION_POINTS[calibrationStep].y,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <div className="w-16 h-16 rounded-full border-4 border-primary bg-primary/20 flex items-center justify-center animate-pulse">
                <Target className="w-8 h-8 text-primary" />
              </div>
              <span className="text-sm font-medium">{CALIBRATION_POINTS[calibrationStep].label}</span>
              <span className="text-xs text-muted-foreground">Look here and tap</span>
            </div>
          )}

          {/* Progress */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={cn(
                  'w-3 h-3 rounded-full transition-colors',
                  i < calibrationStep ? 'bg-primary' : 'bg-muted'
                )}
              />
            ))}
          </div>

          {/* Instructions */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
            <h3 className="text-xl font-bold mb-2">Calibration</h3>
            <p className="text-muted-foreground">
              Look at the target and tap it to calibrate
            </p>
          </div>
        </div>
      )}

      {/* Pending blinks indicator */}
      {isActive && pendingBlinkCount > 0 && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-full animate-in fade-in">
          <Eye className="w-4 h-4" />
          <span className="font-bold">{pendingBlinkCount}</span>
          <span className="text-xs opacity-80">blink{pendingBlinkCount > 1 ? 's' : ''}</span>
        </div>
      )}
    </>
  );
};

// Button command customization component
interface BlinkCommandEditorProps {
  buttonId: string;
  onClose: () => void;
}

export const BlinkCommandEditor: React.FC<BlinkCommandEditorProps> = ({
  buttonId,
  onClose,
}) => {
  const command = getBlinkCommand(buttonId);
  const [singleBlink, setSingleBlink] = useState(command.singleBlink);
  const [doubleBlink, setDoubleBlink] = useState(command.doubleBlink);
  const [tripleBlink, setTripleBlink] = useState(command.tripleBlink);

  const handleSave = () => {
    setBlinkCommand(buttonId, { singleBlink, doubleBlink, tripleBlink });
    onClose();
  };

  return (
    <div className="p-4 space-y-4">
      <h3 className="font-medium">Blink Commands for: {buttonId}</h3>
      
      {/* Single blink */}
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">1× Blink</label>
        <div className="grid grid-cols-4 gap-2">
          {BLINK_ACTIONS.map((action) => (
            <button
              key={action.value}
              className={cn(
                'p-2 rounded-lg border text-center transition-all',
                singleBlink === action.value
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              )}
              onClick={() => setSingleBlink(action.value)}
            >
              <span className="text-lg">{action.icon}</span>
              <span className="block text-xs mt-1">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Double blink */}
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">2× Blinks</label>
        <div className="grid grid-cols-4 gap-2">
          {BLINK_ACTIONS.map((action) => (
            <button
              key={action.value}
              className={cn(
                'p-2 rounded-lg border text-center transition-all',
                doubleBlink === action.value
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              )}
              onClick={() => setDoubleBlink(action.value)}
            >
              <span className="text-lg">{action.icon}</span>
              <span className="block text-xs mt-1">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Triple blink */}
      <div className="space-y-2">
        <label className="text-sm text-muted-foreground">3× Blinks</label>
        <div className="grid grid-cols-4 gap-2">
          {BLINK_ACTIONS.map((action) => (
            <button
              key={action.value}
              className={cn(
                'p-2 rounded-lg border text-center transition-all',
                tripleBlink === action.value
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              )}
              onClick={() => setTripleBlink(action.value)}
            >
              <span className="text-lg">{action.icon}</span>
              <span className="block text-xs mt-1">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button className="flex-1" onClick={handleSave}>
          Save Commands
        </Button>
      </div>
    </div>
  );
};
