import React, { useEffect, useState } from 'react';
import { 
  Eye, EyeOff, Target, Zap, Settings, X, Check, ChevronRight, 
  ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Hand, MousePointer,
  ToggleLeft, Ban, Navigation, Play, SkipForward, SkipBack, Users, Video,
  Sparkles, Plus, Trash2, HelpCircle, BookOpen, Clock, Volume2, VolumeX, Film,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  useBlinkRemoteControl, 
  BlinkAction,
  GazeNavigationAction,
  getBlinkCommand,
  setBlinkCommand,
  RemoteControlSettings,
  GazeCommand,
  GhostButton,
  CALIBRATION_TARGETS,
  saveCalibrationData,
} from '@/hooks/useBlinkRemoteControl';
import { GazeDirection } from '@/hooks/useGazeDirection';
import { 
  useGestureCombos, 
  GestureCombo, 
  ComboAction, 
  describeCombo,
  COMBO_ACTION_LABELS,
  removeCombo,
} from '@/hooks/useGestureCombos';
import { GestureComboBuilder } from '@/components/GestureComboBuilder';
import { GestureComboImportExport } from '@/components/GestureComboImportExport';
import { ComboPracticeMode } from '@/components/ComboPracticeMode';
import ComboGuideOverlay from '@/components/ComboGuideOverlay';
import RemoteControlDebugOverlay from '@/components/RemoteControlDebugOverlay';
import { 
  RemoteControlTutorial, 
  useRemoteControlTutorial 
} from '@/components/RemoteControlTutorial';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useVoiceFeedback } from '@/hooks/useVoiceFeedback';
import { EyeBlinkCalibration, CalibrationResult } from '@/components/EyeBlinkCalibration';
import { EyeMovementTracking, EyeMovementResult } from '@/components/EyeMovementTracking';
import FacialExpressionScanning, { FacialExpressionResult } from '@/components/FacialExpressionScanning';

interface BlinkRemoteControlProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  onNavigate?: (action: GazeNavigationAction, direction: GazeDirection) => void;
  onComboAction?: (action: ComboAction, combo: GestureCombo) => void;
  showSettings?: boolean;
  onCloseSettings?: () => void;
  className?: string;
}

const BLINK_ACTIONS: { value: BlinkAction; label: string; icon: React.ReactNode }[] = [
  { value: 'click', label: 'Tap', icon: <MousePointer className="w-4 h-4" /> },
  { value: 'longPress', label: 'Long Press', icon: <Hand className="w-4 h-4" /> },
  { value: 'toggle', label: 'Toggle', icon: <ToggleLeft className="w-4 h-4" /> },
  { value: 'none', label: 'None', icon: <Ban className="w-4 h-4" /> },
];

const GAZE_ACTIONS: { value: GazeNavigationAction; label: string; icon: React.ReactNode }[] = [
  { value: 'nextVideo', label: 'Next Video', icon: <SkipForward className="w-4 h-4" /> },
  { value: 'prevVideo', label: 'Previous Video', icon: <SkipBack className="w-4 h-4" /> },
  { value: 'friendsFeed', label: 'Friends Feed', icon: <Users className="w-4 h-4" /> },
  { value: 'promoFeed', label: 'Promo Feed', icon: <Video className="w-4 h-4" /> },
  { value: 'none', label: 'None', icon: <Ban className="w-4 h-4" /> },
];

const DIRECTION_ICONS: Record<GazeDirection, React.ReactNode> = {
  left: <ArrowLeft className="w-5 h-5" />,
  right: <ArrowRight className="w-5 h-5" />,
  up: <ArrowUp className="w-5 h-5" />,
  down: <ArrowDown className="w-5 h-5" />,
  center: <Target className="w-5 h-5" />,
};

const DIRECTION_LABELS: Record<GazeDirection, string> = {
  left: 'Look Left',
  right: 'Look Right',
  up: 'Look Up',
  down: 'Look Down',
  center: 'Center',
};

// CALIBRATION_TARGETS is now imported from useBlinkRemoteControl

export const BlinkRemoteControl: React.FC<BlinkRemoteControlProps> = ({
  enabled,
  onToggle,
  onNavigate,
  onComboAction,
  showSettings: externalShowSettings,
  onCloseSettings,
  className,
}) => {
  const haptics = useHapticFeedback();
  const voiceFeedback = useVoiceFeedback();
  const [internalShowSettings, setInternalShowSettings] = useState(false);
  
  // Use external control if provided, otherwise use internal state
  const showSettings = externalShowSettings !== undefined ? externalShowSettings : internalShowSettings;
  const setShowSettings = onCloseSettings 
    ? (open: boolean) => { if (!open) onCloseSettings(); }
    : setInternalShowSettings;
  const [showComboBuilder, setShowComboBuilder] = useState(false);
  const [practiceMode, setPracticeMode] = useState(false);
  const [showComboGuide, setShowComboGuide] = useState(false);
  const [showDebugOverlay, setShowDebugOverlay] = useState(false);
  const [showBlinkCalibration, setShowBlinkCalibration] = useState(false);
  const [showEyeMovement, setShowEyeMovement] = useState(false);
  const [showFacialExpression, setShowFacialExpression] = useState(false);
  const [blinkCalibrationResult, setBlinkCalibrationResult] = useState<CalibrationResult | null>(null);
  const [eyeMovementResult, setEyeMovementResult] = useState<EyeMovementResult | null>(null);
  
  // Tutorial hook
  const {
    shouldShowTutorial,
    isTutorialOpen,
    openTutorial,
    closeTutorial,
    completeTutorial,
    resetTutorial,
  } = useRemoteControlTutorial();

  // Gesture combos
  const {
    currentSteps: comboSteps,
    matchProgress: comboProgress,
    lastMatchedCombo,
    combos,
    enabledCombos,
    addDirectionStep,
    addBlinkStep,
    updateCombo: updateGestureCombo,
  } = useGestureCombos({
    enabled: enabled,
    onComboExecuted: (combo) => {
      haptics.success();
      
      // Announce with voice feedback
      if (!practiceMode) {
        voiceFeedback.announceCombo(combo.name, COMBO_ACTION_LABELS[combo.action]);
        console.log('[RemoteControl] Combo executed:', combo.name, combo.action);
        onComboAction?.(combo.action, combo);
      } else {
        voiceFeedback.announcePracticeCombo(combo.name);
        console.log('[RemoteControl] Practice combo:', combo.name);
      }
    },
  });
  
  const {
    isActive,
    isCalibrating,
    currentTarget,
    gazePosition,
    rawGazePosition,
    pendingBlinkCount,
    lastAction,
    calibrationStep,
    settings,
    gazeCommands,
    calibration,
    eyeOpenness,
    ghostButtons,
    currentDirection,
    isCameraActive,
    calibrationTargets,
    blinkCount,
    toggleActive,
    startCalibration,
    recordCalibrationPoint,
    cancelCalibration,
    resetCalibration,
    updateSettings,
    updateGazeCommand,
    toggleAutoCalibration,
    recordInteractionForAutoCalibration,
  } = useBlinkRemoteControl({
    enabled,
    onAction: (buttonId, action, count) => {
      haptics.medium();
      console.log('[RemoteControl] Action executed:', buttonId, action, count);
      // Record for auto-calibration when user interacts with a button
      if (currentTarget) {
        recordInteractionForAutoCalibration(
          currentTarget.rect.left + currentTarget.rect.width / 2,
          currentTarget.rect.top + currentTarget.rect.height / 2
        );
      }
    },
    onNavigate: (action, direction) => {
      haptics.success();
      onNavigate?.(action, direction);
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

  const getGazeCommandForDirection = (direction: GazeDirection): GazeCommand | undefined => {
    return gazeCommands.find(c => c.direction === direction);
  };

  return (
    <>
      {/* Debug Overlay */}
      <RemoteControlDebugOverlay
        isOpen={showDebugOverlay}
        onClose={() => setShowDebugOverlay(false)}
        gazePosition={gazePosition}
        rawGazePosition={rawGazePosition}
        calibration={calibration}
        currentDirection={currentDirection}
        eyeOpenness={eyeOpenness}
        isCameraActive={isCameraActive}
        settings={{
          sensitivity: settings.sensitivity,
          gazeHoldTime: settings.gazeHoldTime,
          edgeThreshold: settings.edgeThreshold,
        }}
        blinkCount={blinkCount}
        autoCalibrationEnabled={calibration.autoCalibrationEnabled}
        onToggleAutoCalibration={toggleAutoCalibration}
      />

      {/* Ghost button overlays */}
      {isActive && Array.from(ghostButtons.values()).map((ghost) => (
        <div
          key={ghost.buttonId}
          className={cn(
            'fixed pointer-events-none z-[98] rounded-xl transition-all duration-300',
            ghost.isGhost 
              ? 'ring-2 ring-primary shadow-[0_0_30px_hsl(var(--primary)/0.5)]' 
              : 'ring-1 ring-primary/30'
          )}
          style={{
            left: ghost.rect.left - 6,
            top: ghost.rect.top - 6,
            width: ghost.rect.width + 12,
            height: ghost.rect.height + 12,
            opacity: ghost.isGhost ? settings.ghostOpacity : 0.2,
            background: ghost.isGhost 
              ? `linear-gradient(135deg, hsl(var(--primary) / ${settings.ghostOpacity}), hsl(var(--primary) / ${settings.ghostOpacity * 0.5}))`
              : 'transparent',
          }}
        >
          {ghost.isGhost && (
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-3 py-1 bg-primary text-primary-foreground text-xs rounded-full whitespace-nowrap animate-pulse">
              👁 Blink to command
            </div>
          )}
          {/* Activation progress ring */}
          {!ghost.isGhost && (
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 100 100"
              style={{ transform: 'rotate(-90deg)' }}
            >
              <circle
                cx="50"
                cy="50"
                r="48"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-primary/20"
              />
              <circle
                cx="50"
                cy="50"
                r="48"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray={`${ghost.activationProgress * 301} 301`}
                className="text-primary transition-all duration-100"
              />
            </svg>
          )}
        </div>
      ))}

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
            'w-14 h-14 rounded-full border-2 flex items-center justify-center transition-all',
            currentTarget 
              ? 'border-primary bg-primary/20 scale-110' 
              : 'border-muted-foreground/50 bg-background/30'
          )}>
            {/* Direction indicator */}
            <div className={cn(
              'transition-all',
              currentDirection !== 'center' && 'text-primary'
            )}>
              {DIRECTION_ICONS[currentDirection]}
            </div>
          </div>
          {/* Eye openness indicator */}
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-10 h-1.5 rounded-full bg-muted overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-100"
              style={{ width: `${eyeOpenness * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Direction indicator at edges */}
      {isActive && currentDirection !== 'center' && (
        <div className={cn(
          'fixed pointer-events-none z-[95] flex items-center justify-center transition-all duration-200',
          currentDirection === 'left' && 'left-0 top-1/2 -translate-y-1/2 w-16 h-32',
          currentDirection === 'right' && 'right-0 top-1/2 -translate-y-1/2 w-16 h-32',
          currentDirection === 'up' && 'top-0 left-1/2 -translate-x-1/2 w-32 h-16',
          currentDirection === 'down' && 'bottom-0 left-1/2 -translate-x-1/2 w-32 h-16',
        )}>
          <div className={cn(
            'px-4 py-2 rounded-full bg-primary/80 text-primary-foreground text-sm font-medium',
            'animate-pulse flex items-center gap-2'
          )}>
            {DIRECTION_ICONS[currentDirection]}
            <span>{getGazeCommandForDirection(currentDirection)?.action || 'Move'}</span>
          </div>
        </div>
      )}

      {/* Last action toast */}
      {lastAction && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-medium animate-in fade-in slide-in-from-bottom-4">
          <Check className="w-4 h-4 inline-block mr-2" />
          {lastAction}
        </div>
      )}

      {/* Pending blinks indicator */}
      {isActive && pendingBlinkCount > 0 && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-full animate-in fade-in">
          <Eye className="w-4 h-4" />
          <span className="font-bold text-lg">{pendingBlinkCount}</span>
          <span className="text-xs opacity-80">blink{pendingBlinkCount > 1 ? 's' : ''} pending</span>
        </div>
      )}

      {/* Settings Sheet */}
      <Sheet open={showSettings} onOpenChange={setShowSettings}>
        {/* Only show trigger button if not externally controlled */}
        {externalShowSettings === undefined && (
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'fixed z-50 h-8 px-3 text-xs bg-background/80 backdrop-blur-sm',
                className
              )}
              onClick={() => setShowSettings(true)}
            >
              <Settings className="w-3 h-3 mr-1" />
              Remote Settings
            </Button>
          </SheetTrigger>
        )}
        <SheetContent side="bottom" className="h-[85vh]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              Remote Control
            </SheetTitle>
          </SheetHeader>
          
          <Tabs defaultValue="commands" className="mt-4">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="commands">Blinks</TabsTrigger>
              <TabsTrigger value="combos">Combos</TabsTrigger>
              <TabsTrigger value="gaze">Gaze</TabsTrigger>
              <TabsTrigger value="audio">Audio</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>

            {/* Blink Commands Tab */}
            <TabsContent value="commands" className="space-y-4 mt-4 overflow-y-auto max-h-[60vh] pb-4">
              <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  Blink Commands
                </h4>
                <p className="text-sm text-muted-foreground">
                  Assign actions to different blink patterns. Stare at a button until it glows, then blink to execute.
                </p>
              </div>

              {/* Blink pattern assignments */}
              <div className="space-y-4">
                {[1, 2, 3].map((blinkCount) => (
                  <div key={blinkCount} className="p-4 rounded-lg border border-border space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex gap-1">
                        {Array.from({ length: blinkCount }).map((_, i) => (
                          <Eye key={i} className="w-5 h-5 text-primary" />
                        ))}
                      </div>
                      <span className="font-medium">{blinkCount}× Blink</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {BLINK_ACTIONS.map((action) => (
                        <button
                          key={action.value}
                          className={cn(
                            'p-3 rounded-lg border text-center transition-all flex flex-col items-center gap-1',
                            'hover:border-primary/50'
                          )}
                        >
                          <span className="text-muted-foreground">{action.icon}</span>
                          <span className="text-xs">{action.label}</span>
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Default: {blinkCount === 1 ? 'Tap' : blinkCount === 2 ? 'Long Press' : 'Toggle'}
                    </p>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Gesture Combos Tab */}
            <TabsContent value="combos" className="space-y-4 mt-4 overflow-y-auto max-h-[60vh] pb-4">
              <div className="p-4 rounded-lg bg-gradient-to-r from-primary/10 to-amber-500/10 border border-primary/20 space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Gesture Combos
                </h4>
                <p className="text-sm text-muted-foreground">
                  Combine eye movements and blinks for powerful shortcuts. Execute a sequence of gestures to trigger actions.
                </p>
              </div>

              {/* Create new combo button & Guide button */}
              <div className="flex gap-2">
                <Button 
                  onClick={() => setShowComboBuilder(true)}
                  className="flex-1"
                  variant="outline"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Custom Combo
                </Button>
                <Button 
                  onClick={() => setShowComboGuide(true)}
                  variant="outline"
                >
                  <Film className="w-4 h-4 mr-2" />
                  Combo Guide
                </Button>
              </div>

              {/* Combo progress indicator */}
              {comboSteps.length > 0 && (
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 flex items-center gap-3">
                  <div className="flex items-center gap-1">
                    {comboSteps.map((step, i) => (
                      <div key={i} className="flex items-center gap-1">
                        {step.type === 'direction' && DIRECTION_ICONS[step.direction]}
                        {step.type === 'blink' && (
                          <div className="flex gap-0.5">
                            {Array.from({ length: step.count }).map((_, j) => (
                              <Eye key={j} className="w-4 h-4 text-primary" />
                            ))}
                          </div>
                        )}
                        {i < comboSteps.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                      </div>
                    ))}
                  </div>
                  <div className="flex-1">
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all"
                        style={{ width: `${comboProgress * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">{Math.round(comboProgress * 100)}%</span>
                </div>
              )}

              {/* Last matched combo */}
              {lastMatchedCombo && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium">{lastMatchedCombo.name}</span>
                  <span className="text-xs text-muted-foreground">→ {COMBO_ACTION_LABELS[lastMatchedCombo.action]}</span>
                </div>
              )}

              {/* Available combos */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Available Combos</h4>
                {combos.map((combo) => (
                  <div 
                    key={combo.id} 
                    className={cn(
                      'p-4 rounded-lg border flex items-start gap-4 transition-all',
                      combo.enabled ? 'border-border' : 'border-border/50 opacity-60'
                    )}
                  >
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <h5 className="font-medium">{combo.name}</h5>
                        {combo.id.startsWith('custom-') ? (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">Custom</span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Built-in</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{combo.description}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {combo.steps.map((step, i) => (
                          <div key={i} className="flex items-center gap-1">
                            <div className="px-2 py-1 rounded bg-muted text-xs flex items-center gap-1">
                              {step.type === 'direction' && (
                                <>
                                  {DIRECTION_ICONS[step.direction]}
                                  <span>Look {step.direction}</span>
                                </>
                              )}
                              {step.type === 'blink' && (
                                <>
                                  <div className="flex gap-0.5">
                                    {Array.from({ length: step.count }).map((_, j) => (
                                      <Eye key={j} className="w-3 h-3" />
                                    ))}
                                  </div>
                                  <span>{step.count}× blink</span>
                                </>
                              )}
                              {step.type === 'hold' && (
                                <>
                                  <Clock className="w-3 h-3" />
                                  <span>Hold {step.duration}ms</span>
                                </>
                              )}
                            </div>
                            {i < combo.steps.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                          </div>
                        ))}
                        <ChevronRight className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs font-medium text-primary">{COMBO_ACTION_LABELS[combo.action]}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Switch
                        checked={combo.enabled}
                        onCheckedChange={(checked) => {
                          updateGestureCombo(combo.id, { enabled: checked });
                          haptics.light();
                        }}
                      />
                      {combo.id.startsWith('custom-') && (
                        <button
                          onClick={() => {
                            removeCombo(combo.id);
                            haptics.light();
                          }}
                          className="text-xs text-destructive hover:text-destructive/80 flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Empty state */}
              {combos.length === 0 && (
                <div className="p-8 rounded-lg border border-dashed border-border text-center space-y-3">
                  <Sparkles className="w-8 h-8 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    No combos yet. Create your first custom combo!
                  </p>
                </div>
              )}

              {/* Import/Export */}
              <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                <h4 className="text-sm font-medium">Import / Export</h4>
                <p className="text-xs text-muted-foreground">
                  Share your gesture combos between devices or with others.
                </p>
                <GestureComboImportExport />
              </div>

              {/* Practice Mode */}
              <ComboPracticeMode
                isActive={practiceMode}
                onToggle={setPracticeMode}
                combos={combos}
                currentSteps={comboSteps}
                matchProgress={comboProgress}
                lastMatchedCombo={lastMatchedCombo}
              />

              {/* Combo Guide Overlay */}
              <ComboGuideOverlay
                isOpen={showComboGuide}
                onClose={() => setShowComboGuide(false)}
              />
            </TabsContent>

            {/* Gaze Navigation Tab */}
            <TabsContent value="gaze" className="space-y-4 mt-4 overflow-y-auto max-h-[60vh] pb-4">
              <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-primary" />
                  Gaze Navigation
                </h4>
                <p className="text-sm text-muted-foreground">
                  Rapidly move your eyes to the edge of the screen to navigate. Each direction can trigger a different action.
                </p>
              </div>

              {/* Direction commands */}
              <div className="space-y-3">
                {(['left', 'right', 'up', 'down'] as GazeDirection[]).map((direction) => {
                  const command = getGazeCommandForDirection(direction);
                  return (
                    <div 
                      key={direction} 
                      className="p-4 rounded-lg border border-border flex items-center gap-4"
                    >
                      <div className={cn(
                        'w-12 h-12 rounded-full flex items-center justify-center',
                        'bg-primary/10 text-primary'
                      )}>
                        {DIRECTION_ICONS[direction]}
                      </div>
                      <div className="flex-1">
                        <h5 className="font-medium">{DIRECTION_LABELS[direction]}</h5>
                        <p className="text-xs text-muted-foreground">Rapidly look {direction}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <select 
                          className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
                          value={command?.action || 'none'}
                          onChange={(e) => {
                            updateGazeCommand(direction, e.target.value as GazeNavigationAction, true);
                            haptics.light();
                          }}
                        >
                          {GAZE_ACTIONS.map((action) => (
                            <option key={action.value} value={action.value}>
                              {action.label}
                            </option>
                          ))}
                        </select>
                        <Switch
                          checked={command?.enabled ?? true}
                          onCheckedChange={(checked) => {
                            updateGazeCommand(direction, command?.action || 'none', checked);
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Enable/disable all */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <h4 className="font-medium">Rapid Eye Movement</h4>
                  <p className="text-sm text-muted-foreground">Enable gaze navigation commands</p>
                </div>
                <Switch
                  checked={settings.rapidMovementEnabled}
                  onCheckedChange={(checked) => updateSettings({ rapidMovementEnabled: checked })}
                />
              </div>
            </TabsContent>

            {/* Audio Feedback Tab */}
            <TabsContent value="audio" className="space-y-4 mt-4 overflow-y-auto max-h-[60vh] pb-4">
              <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-primary" />
                  Audio Feedback
                </h4>
                <p className="text-sm text-muted-foreground">
                  Enable voice announcements and sound effects for accessibility.
                </p>
              </div>

              {/* Voice feedback toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    {voiceFeedback.settings.voiceEnabled ? (
                      <Volume2 className="w-5 h-5 text-primary" />
                    ) : (
                      <VolumeX className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <h5 className="font-medium">Voice Announcements</h5>
                    <p className="text-xs text-muted-foreground">Speak combo names and actions</p>
                  </div>
                </div>
                <Switch
                  checked={voiceFeedback.settings.voiceEnabled}
                  onCheckedChange={(checked) => voiceFeedback.updateSettings({ voiceEnabled: checked })}
                />
              </div>

              {/* Voice settings */}
              {voiceFeedback.settings.voiceEnabled && (
                <div className="space-y-4 p-4 rounded-lg border border-border">
                  {/* Voice volume */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Voice Volume</label>
                      <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">
                        {Math.round(voiceFeedback.settings.voiceVolume * 100)}%
                      </span>
                    </div>
                    <Slider
                      value={[voiceFeedback.settings.voiceVolume]}
                      min={0.1}
                      max={1}
                      step={0.1}
                      onValueChange={([value]) => voiceFeedback.updateSettings({ voiceVolume: value })}
                    />
                  </div>

                  {/* Voice speed */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Voice Speed</label>
                      <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">
                        {voiceFeedback.settings.voiceRate}x
                      </span>
                    </div>
                    <Slider
                      value={[voiceFeedback.settings.voiceRate]}
                      min={0.5}
                      max={2}
                      step={0.1}
                      onValueChange={([value]) => voiceFeedback.updateSettings({ voiceRate: value })}
                    />
                  </div>

                  {/* Voice selection */}
                  {voiceFeedback.availableVoices.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Voice</label>
                      <select
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm"
                        value={voiceFeedback.settings.selectedVoice || ''}
                        onChange={(e) => voiceFeedback.updateSettings({ selectedVoice: e.target.value || null })}
                      >
                        <option value="">System Default</option>
                        {voiceFeedback.availableVoices.map((voice) => (
                          <option key={voice.name} value={voice.name}>
                            {voice.name} ({voice.lang})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Test voice */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => voiceFeedback.speak('Quick Like. Like Video', true)}
                    className="w-full"
                  >
                    <Volume2 className="w-4 h-4 mr-2" />
                    Test Voice
                  </Button>
                </div>
              )}

              {/* Sound effects toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg border border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                  </div>
                  <div>
                    <h5 className="font-medium">Sound Effects</h5>
                    <p className="text-xs text-muted-foreground">Play sounds for gestures and combos</p>
                  </div>
                </div>
                <Switch
                  checked={voiceFeedback.settings.soundEnabled}
                  onCheckedChange={(checked) => voiceFeedback.updateSettings({ soundEnabled: checked })}
                />
              </div>

              {/* Sound settings */}
              {voiceFeedback.settings.soundEnabled && (
                <div className="space-y-4 p-4 rounded-lg border border-border">
                  {/* Sound volume */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Sound Volume</label>
                      <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">
                        {Math.round(voiceFeedback.settings.soundVolume * 100)}%
                      </span>
                    </div>
                    <Slider
                      value={[voiceFeedback.settings.soundVolume]}
                      min={0.1}
                      max={1}
                      step={0.1}
                      onValueChange={([value]) => voiceFeedback.updateSettings({ soundVolume: value })}
                    />
                  </div>

                  {/* Test sounds */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => voiceFeedback.playSound('step')}
                      className="flex-1"
                    >
                      Step
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => voiceFeedback.playSound('success')}
                      className="flex-1"
                    >
                      Success
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => voiceFeedback.playComboSound()}
                      className="flex-1"
                    >
                      Combo
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-4 mt-4 overflow-y-auto max-h-[60vh] pb-4">
              {/* Main toggle */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div>
                  <h4 className="font-medium">Enable Remote Control</h4>
                  <p className="text-sm text-muted-foreground">Control the app with your eyes</p>
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
              <div className="space-y-2 p-4 rounded-lg border border-border">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Gaze Sensitivity</label>
                  <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">{settings.sensitivity}/10</span>
                </div>
                <Slider
                  value={[settings.sensitivity]}
                  min={1}
                  max={10}
                  step={1}
                  onValueChange={([value]) => updateSettings({ sensitivity: value })}
                />
                <p className="text-xs text-muted-foreground">Higher = more responsive to small eye movements</p>
              </div>

              {/* Ghost mode timing */}
              <div className="space-y-2 p-4 rounded-lg border border-border">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Stare Time (Ghost Mode)</label>
                  <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">{settings.gazeHoldTime}ms</span>
                </div>
                <Slider
                  value={[settings.gazeHoldTime]}
                  min={300}
                  max={2000}
                  step={100}
                  onValueChange={([value]) => updateSettings({ gazeHoldTime: value })}
                />
                <p className="text-xs text-muted-foreground">How long to stare at a button before it activates</p>
              </div>

              {/* Ghost opacity */}
              <div className="space-y-2 p-4 rounded-lg border border-border">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Ghost Button Opacity</label>
                  <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">{Math.round(settings.ghostOpacity * 100)}%</span>
                </div>
                <Slider
                  value={[settings.ghostOpacity]}
                  min={0.2}
                  max={0.6}
                  step={0.05}
                  onValueChange={([value]) => updateSettings({ ghostOpacity: value })}
                />
                <p className="text-xs text-muted-foreground">Visibility of the ghost highlight when targeting a button</p>
              </div>

              {/* Edge threshold */}
              <div className="space-y-2 p-4 rounded-lg border border-border">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Edge Detection Zone</label>
                  <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">{Math.round(settings.edgeThreshold * 100)}%</span>
                </div>
                <Slider
                  value={[settings.edgeThreshold]}
                  min={0.2}
                  max={0.5}
                  step={0.05}
                  onValueChange={([value]) => updateSettings({ edgeThreshold: value })}
                />
                <p className="text-xs text-muted-foreground">How far your eyes need to move to trigger navigation</p>
              </div>

              {/* Blink pattern timeout */}
              <div className="space-y-2 p-4 rounded-lg border border-border">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Blink Pattern Window</label>
                  <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded">{settings.blinkPatternTimeout}ms</span>
                </div>
                <Slider
                  value={[settings.blinkPatternTimeout]}
                  min={300}
                  max={1200}
                  step={100}
                  onValueChange={([value]) => updateSettings({ blinkPatternTimeout: value })}
                />
                <p className="text-xs text-muted-foreground">Time window to complete multi-blink patterns</p>
              </div>

              {/* Calibration */}
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20 space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Calibration
                  {calibration.isCalibrated && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-500">
                      Calibrated
                    </span>
                  )}
                </h4>
                <p className="text-sm text-muted-foreground">
                  {calibration.isCalibrated 
                    ? `Last calibrated: ${new Date(calibration.calibratedAt).toLocaleDateString()}`
                    : 'Improve accuracy by calibrating to your eye position'
                  }
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowSettings(false);
                      setShowBlinkCalibration(true);
                    }}
                  >
                    <Target className="w-4 h-4 mr-2" />
                    {calibration.isCalibrated ? 'Recalibrate' : 'Start Calibration'}
                  </Button>
                  {calibration.isCalibrated && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        resetCalibration();
                        haptics.light();
                      }}
                    >
                      Reset
                    </Button>
                  )}
                </div>
                
                {/* Auto-calibration toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-border/50 mt-2">
                  <div>
                    <span className="text-sm font-medium">Auto-Calibration</span>
                    <p className="text-xs text-muted-foreground">
                      Gradually improves accuracy based on your interactions
                    </p>
                  </div>
                  <Switch
                    checked={calibration.autoCalibrationEnabled}
                    onCheckedChange={toggleAutoCalibration}
                  />
                </div>
                {calibration.autoAdjustments > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {calibration.autoAdjustments} automatic adjustments made
                  </p>
                )}
              </div>

              {/* Debug Overlay */}
              <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Debug Tools
                </h4>
                <p className="text-sm text-muted-foreground">
                  View real-time tracking statistics and gaze position
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowDebugOverlay(true);
                  }}
                >
                  <Activity className="w-4 h-4 mr-2" />
                  Open Debug Overlay
                </Button>
              </div>

              {/* Tutorial */}
              <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  Tutorial
                </h4>
                <p className="text-sm text-muted-foreground">
                  Learn how to use eye remote control step by step
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowSettings(false);
                      openTutorial();
                    }}
                  >
                    <HelpCircle className="w-4 h-4 mr-2" />
                    View Tutorial
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      resetTutorial();
                      haptics.light();
                    }}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Eye Blink Calibration - Step 1 */}
      <EyeBlinkCalibration
        isOpen={showBlinkCalibration}
        onClose={() => setShowBlinkCalibration(false)}
        onComplete={(result: CalibrationResult) => {
          console.log('[RemoteControl] Blink calibration complete:', result);
          setBlinkCalibrationResult(result);
          setShowBlinkCalibration(false);
          // Proceed to Eye Movement Tracking
          setShowEyeMovement(true);
        }}
        onSkip={() => {
          setShowBlinkCalibration(false);
          // Skip to Eye Movement Tracking
          setShowEyeMovement(true);
        }}
      />

      {/* Eye Movement Tracking - Step 2 */}
      <EyeMovementTracking
        isOpen={showEyeMovement}
        onClose={() => setShowEyeMovement(false)}
        onComplete={(result: EyeMovementResult) => {
          console.log('[RemoteControl] Eye movement calibration complete:', result);
          setEyeMovementResult(result);
          setShowEyeMovement(false);
          // Proceed to Facial Expression Scanning
          setShowFacialExpression(true);
        }}
        onSkip={() => {
          setShowEyeMovement(false);
          // Skip to Facial Expression Scanning
          setShowFacialExpression(true);
        }}
      />

      {/* Facial Expression Scanning - Step 3 */}
      <FacialExpressionScanning
        isOpen={showFacialExpression}
        onClose={() => setShowFacialExpression(false)}
        onComplete={(result: FacialExpressionResult) => {
          console.log('[RemoteControl] Facial expression calibration complete:', result);
          setShowFacialExpression(false);
          // Save all calibration data
          saveCalibrationData({
            offsetX: 0,
            offsetY: 0,
            scaleX: 1,
            scaleY: 1,
            isCalibrated: true,
            calibratedAt: Date.now(),
            autoCalibrationEnabled: true,
            autoAdjustments: 0,
          });
          haptics.success();
        }}
        onSkip={() => setShowFacialExpression(false)}
      />

      {/* Tutorial overlay */}
      <RemoteControlTutorial
        isOpen={isTutorialOpen}
        onClose={closeTutorial}
        onComplete={completeTutorial}
      />

      {/* First-time prompt */}
      {shouldShowTutorial && enabled && !isTutorialOpen && (
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[101] animate-in fade-in slide-in-from-bottom-4">
          <div className="px-4 py-3 rounded-xl bg-primary text-primary-foreground shadow-lg flex items-center gap-3">
            <Sparkles className="w-5 h-5" />
            <span className="text-sm font-medium">New to Eye Remote?</span>
            <Button
              size="sm"
              variant="secondary"
              onClick={openTutorial}
            >
              Start Tutorial
            </Button>
            <button
              onClick={() => completeTutorial()}
              className="text-primary-foreground/70 hover:text-primary-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Gesture Combo Builder */}
      <GestureComboBuilder
        isOpen={showComboBuilder}
        onClose={() => setShowComboBuilder(false)}
        onComboCreated={(combo) => {
          haptics.success();
          console.log('[RemoteControl] Custom combo created:', combo.name);
        }}
      />
    </>
  );
};

// Export command editor for individual button customization
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
      <h3 className="font-medium flex items-center gap-2">
        <Eye className="w-4 h-4" />
        Blink Commands: {buttonId}
      </h3>
      
      {[
        { count: 1, value: singleBlink, setter: setSingleBlink },
        { count: 2, value: doubleBlink, setter: setDoubleBlink },
        { count: 3, value: tripleBlink, setter: setTripleBlink },
      ].map(({ count, value, setter }) => (
        <div key={count} className="space-y-2">
          <label className="text-sm text-muted-foreground flex items-center gap-2">
            {Array.from({ length: count }).map((_, i) => (
              <Eye key={i} className="w-4 h-4" />
            ))}
            {count}× Blink
          </label>
          <div className="grid grid-cols-4 gap-2">
            {BLINK_ACTIONS.map((action) => (
              <button
                key={action.value}
                className={cn(
                  'p-3 rounded-lg border text-center transition-all flex flex-col items-center gap-1',
                  value === action.value
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                )}
                onClick={() => setter(action.value)}
              >
                {action.icon}
                <span className="text-xs">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="flex gap-2 pt-2">
        <Button variant="outline" className="flex-1" onClick={onClose}>
          Cancel
        </Button>
        <Button className="flex-1" onClick={handleSave}>
          Save
        </Button>
      </div>
    </div>
  );
};
