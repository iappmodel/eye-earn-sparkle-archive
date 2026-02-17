import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Eye,
  Target,
  Activity,
  Gauge,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Camera,
  ChevronDown,
  ChevronRight,
  Copy,
  Zap,
  MousePointer,
  Navigation,
  Bug,
  Power,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  CalibrationData,
  GazeCommand,
  RemoteControlSettings,
  type GazeNavigationAction,
} from '@/hooks/useBlinkRemoteControl';
import type { GazeDirection } from '@/hooks/useGazeDirection';

export interface GhostButtonSummary {
  buttonId: string;
  activationProgress: number;
  isGhost: boolean;
}

export interface DebugEvent {
  id: string;
  ts: number;
  type: 'blink' | 'gaze' | 'target' | 'nav' | 'calibration' | 'system';
  label: string;
  detail?: string;
}

interface TrackingStats {
  fps: number;
  avgLatency: number;
  detectionRate: number;
  gazeStability: number;
  blinkAccuracy: number;
  sessionDuration: number;
  totalBlinks: number;
  totalGazeEvents: number;
  autoCalibrationAdjustments: number;
}

interface RemoteControlDebugOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  gazePosition: { x: number; y: number } | null;
  rawGazePosition: { x: number; y: number } | null;
  calibration: CalibrationData;
  currentDirection: GazeDirection;
  eyeOpenness: number;
  isCameraActive: boolean;
  settings: Partial<RemoteControlSettings> & {
    sensitivity?: number;
    gazeHoldTime?: number;
    edgeThreshold?: number;
  };
  blinkCount: number;
  autoCalibrationEnabled: boolean;
  onToggleAutoCalibration: () => void;
  /** Optional: additional debug data */
  lastAction?: string | null;
  pendingBlinkCount?: number;
  currentTargetId?: string | null;
  ghostButtons?: GhostButtonSummary[] | Map<string, { activationProgress: number; isGhost: boolean }>;
  gazeCommands?: GazeCommand[];
  lastNavigationAction?: GazeNavigationAction | null;
  isCalibrating?: boolean;
  calibrationStep?: number;
  isActive?: boolean;
}

const GAZE_ACTION_LABELS: Record<GazeNavigationAction, string> = {
  nextVideo: 'Next',
  prevVideo: 'Prev',
  friendsFeed: 'Friends',
  promoFeed: 'Promo',
  none: '—',
};

const EVENT_LOG_MAX = 20;
const GAZE_TRAIL_MAX = 40;
const FPS_SAMPLE_MAX = 60;

export const RemoteControlDebugOverlay: React.FC<RemoteControlDebugOverlayProps> = ({
  isOpen,
  onClose,
  gazePosition,
  rawGazePosition,
  calibration,
  currentDirection,
  eyeOpenness,
  isCameraActive,
  settings,
  blinkCount,
  autoCalibrationEnabled,
  onToggleAutoCalibration,
  lastAction,
  pendingBlinkCount = 0,
  currentTargetId,
  ghostButtons = [],
  gazeCommands = [],
  lastNavigationAction,
  isCalibrating = false,
  calibrationStep = 0,
  isActive = false,
}) => {
  const [stats, setStats] = useState<TrackingStats>({
    fps: 0,
    avgLatency: 0,
    detectionRate: 100,
    gazeStability: 0,
    blinkAccuracy: 100,
    sessionDuration: 0,
    totalBlinks: 0,
    totalGazeEvents: 0,
    autoCalibrationAdjustments: 0,
  });
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [showFullSettings, setShowFullSettings] = useState(false);
  const [eventLog, setEventLog] = useState<DebugEvent[]>([]);
  const [gazeTrail, setGazeTrail] = useState<{ x: number; y: number }[]>([]);
  const [copySuccess, setCopySuccess] = useState(false);
  const lastFrameTimeRef = useRef(Date.now());
  const fpsSamplesRef = useRef<number[]>([]);
  const positionHistoryRef = useRef<{ x: number; y: number }[]>([]);
  const sessionStartRef = useRef(Date.now());
  const eventIdRef = useRef(0);

  const isDev = import.meta.env?.DEV ?? false;

  const toggleSection = useCallback((id: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const addEvent = useCallback((type: DebugEvent['type'], label: string, detail?: string) => {
    const id = `ev-${++eventIdRef.current}`;
    setEventLog((prev) => [{ id, ts: Date.now(), type, label, detail }, ...prev].slice(0, EVENT_LOG_MAX));
  }, []);

  const prevActionRef = useRef<string | null>(null);
  const prevNavRef = useRef<GazeNavigationAction | null>(null);
  const prevBlinkRef = useRef(0);

  // Track events from prop changes (only when values actually change)
  useEffect(() => {
    if (!isOpen) return;
    if (lastAction && lastAction !== prevActionRef.current) {
      prevActionRef.current = lastAction;
      addEvent('target', lastAction, 'Action');
    }
  }, [lastAction, isOpen, addEvent]);

  useEffect(() => {
    if (!isOpen) return;
    if (lastNavigationAction && lastNavigationAction !== 'none' && lastNavigationAction !== prevNavRef.current) {
      prevNavRef.current = lastNavigationAction;
      addEvent('nav', GAZE_ACTION_LABELS[lastNavigationAction] ?? lastNavigationAction, 'Gaze nav');
    }
  }, [lastNavigationAction, isOpen, addEvent]);

  useEffect(() => {
    if (!isOpen) return;
    if (blinkCount <= prevBlinkRef.current) return;
    const delta = blinkCount - prevBlinkRef.current;
    prevBlinkRef.current = blinkCount;
    addEvent('blink', `Blink +${delta} (total ${blinkCount})`, 'Detected');
  }, [blinkCount, isOpen, addEvent]);

  // Reset prev refs when overlay opens so we don't log stale changes
  useEffect(() => {
    if (isOpen) {
      prevActionRef.current = lastAction ?? null;
      prevNavRef.current = lastNavigationAction ?? null;
      prevBlinkRef.current = blinkCount;
    }
  }, [isOpen]);

  // FPS tracking using refs to avoid stale closures
  useEffect(() => {
    if (!isOpen || !gazePosition) return;
    const now = Date.now();
    const delta = now - lastFrameTimeRef.current;
    lastFrameTimeRef.current = now;
    const fps = delta > 0 ? 1000 / delta : 0;
    fpsSamplesRef.current = [...fpsSamplesRef.current, fps].slice(-FPS_SAMPLE_MAX);
    const avgFps =
      fpsSamplesRef.current.length > 0
        ? fpsSamplesRef.current.reduce((a, b) => a + b, 0) / fpsSamplesRef.current.length
        : 0;
    setStats((prev) => ({
      ...prev,
      fps: Math.round(avgFps),
      avgLatency: avgFps > 0 ? Math.round(1000 / avgFps) : 0,
      totalGazeEvents: prev.totalGazeEvents + 1,
    }));
  }, [gazePosition, isOpen]);

  // Gaze trail
  useEffect(() => {
    if (!gazePosition || !isOpen) return;
    setGazeTrail((prev) => [...prev, gazePosition].slice(-GAZE_TRAIL_MAX));
  }, [gazePosition, isOpen]);

  // Gaze stability using ref
  useEffect(() => {
    if (!gazePosition) return;
    positionHistoryRef.current = [...positionHistoryRef.current, gazePosition].slice(-20);
    const hist = positionHistoryRef.current;
    if (hist.length >= 5) {
      const avgX = hist.reduce((a, p) => a + p.x, 0) / hist.length;
      const avgY = hist.reduce((a, p) => a + p.y, 0) / hist.length;
      const variance =
        hist.reduce((a, p) => a + Math.sqrt((p.x - avgX) ** 2 + (p.y - avgY) ** 2), 0) /
        hist.length;
      const stability = Math.max(0, Math.min(100, 100 - variance / 5));
      setStats((prev) => ({ ...prev, gazeStability: Math.round(stability) }));
    }
  }, [gazePosition]);

  // Session duration
  useEffect(() => {
    if (!isOpen) return;
    const interval = setInterval(() => {
      setStats((prev) => ({
        ...prev,
        sessionDuration: Math.floor((Date.now() - sessionStartRef.current) / 1000),
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Blink count
  useEffect(() => {
    setStats((prev) => ({ ...prev, totalBlinks: blinkCount }));
  }, [blinkCount]);

  // Auto-calibration adjustments
  useEffect(() => {
    setStats((prev) => ({ ...prev, autoCalibrationAdjustments: calibration.autoAdjustments ?? 0 }));
  }, [calibration.autoAdjustments]);

  const copyStats = useCallback(() => {
    const ghostList =
      ghostButtons instanceof Map
        ? Array.from(ghostButtons.entries()).map(([id, v]) => ({ buttonId: id, ...v }))
        : ghostButtons;
    const payload = {
      ts: new Date().toISOString(),
      session: stats.sessionDuration,
      fps: stats.fps,
      latency: stats.avgLatency,
      stability: stats.gazeStability,
      blinks: stats.totalBlinks,
      gazeEvents: stats.totalGazeEvents,
      autoAdjustments: calibration.autoAdjustments,
      calibration: calibration.isCalibrated ? 'yes' : 'no',
      currentDirection,
      eyeOpenness,
      cameraActive: isCameraActive,
      settings: { ...settings },
      lastAction,
      currentTarget: currentTargetId ?? null,
      ghostCount: ghostList?.length ?? 0,
    };
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 1500);
  }, [
    stats,
    calibration,
    currentDirection,
    eyeOpenness,
    isCameraActive,
    settings,
    lastAction,
    currentTargetId,
    ghostButtons,
  ]);

  if (!isOpen) return null;

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value >= thresholds.good) return 'text-green-500';
    if (value >= thresholds.warning) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getStatusIcon = (value: number, thresholds: { good: number; warning: number }) => {
    if (value >= thresholds.good) return <CheckCircle className="w-3 h-3 text-green-500" />;
    if (value >= thresholds.warning) return <AlertCircle className="w-3 h-3 text-yellow-500" />;
    return <AlertCircle className="w-3 h-3 text-red-500" />;
  };

  const ghostList: GhostButtonSummary[] =
    ghostButtons instanceof Map
      ? Array.from(ghostButtons.entries()).map(([buttonId, v]) => ({
          buttonId,
          activationProgress: v.activationProgress,
          isGhost: v.isGhost,
        }))
      : ghostButtons;

  const Section: React.FC<{
    id: string;
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
  }> = ({ id, title, icon, children }) => {
    const collapsed = collapsedSections.has(id);
    return (
      <div className="space-y-2">
        <button
          type="button"
          className="flex w-full items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
          onClick={() => toggleSection(id)}
        >
          {icon}
          {title}
          {collapsed ? (
            <ChevronRight className="w-3 h-3 ml-auto" />
          ) : (
            <ChevronDown className="w-3 h-3 ml-auto" />
          )}
        </button>
        {!collapsed && children}
      </div>
    );
  };

  return (
    <div className="fixed top-4 right-4 z-[200] w-[340px] max-h-[90vh] flex flex-col bg-background/97 backdrop-blur-xl border border-border rounded-xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-muted/50 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">Debug Overlay</span>
          {isDev && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400">
              DEV
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'w-2 h-2 rounded-full',
              isCameraActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'
            )}
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={copyStats}
            title="Copy stats to clipboard"
          >
            <Copy className="w-3 h-3 mr-1" />
            {copySuccess ? 'Copied!' : 'Copy'}
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="p-3 space-y-4 overflow-y-auto max-h-[calc(90vh-56px)]">
        {/* Status bar */}
        <div className="flex flex-wrap gap-2">
          <div
            className={cn(
              'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs',
              isActive ? 'bg-green-500/15 text-green-600 dark:text-green-400' : 'bg-muted/50'
            )}
          >
            <Power className="w-3 h-3" />
            {isActive ? 'Active' : 'Standby'}
          </div>
          {isCalibrating && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Target className="w-3 h-3" />
              Calibrating {calibrationStep > 0 ? `(${calibrationStep}/9)` : ''}
            </div>
          )}
        </div>

        {/* Camera Status */}
        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
          <Camera className={cn('w-4 h-4', isCameraActive ? 'text-green-500' : 'text-muted-foreground')} />
          <span className="text-xs">Camera: {isCameraActive ? 'Active' : 'Inactive'}</span>
        </div>

        {/* Gaze Position & Trail */}
        <Section id="gaze" title="Gaze Position" icon={<Target className="w-3 h-3" />}>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded-lg bg-muted/30">
              <div className="text-xs text-muted-foreground">Calibrated</div>
              <div className="font-mono text-sm">
                {gazePosition ? `${Math.round(gazePosition.x)}, ${Math.round(gazePosition.y)}` : 'N/A'}
              </div>
            </div>
            <div className="p-2 rounded-lg bg-muted/30">
              <div className="text-xs text-muted-foreground">Raw</div>
              <div className="font-mono text-sm">
                {rawGazePosition ? `${Math.round(rawGazePosition.x)}, ${Math.round(rawGazePosition.y)}` : 'N/A'}
              </div>
            </div>
          </div>
          <div className="relative h-24 rounded-lg bg-muted/20 border border-border overflow-hidden">
            {/* Gaze trail */}
            {gazeTrail.length > 1 &&
              gazeTrail.slice(0, -1).map((p, i) => (
                <div
                  key={i}
                  className="absolute w-1.5 h-1.5 rounded-full bg-primary/40"
                  style={{
                    left: `${(p.x / window.innerWidth) * 100}%`,
                    top: `${(p.y / window.innerHeight) * 100}%`,
                    transform: 'translate(-50%, -50%)',
                    opacity: (i + 1) / gazeTrail.length,
                  }}
                />
              ))}
            {gazePosition && (
              <div
                className="absolute w-3 h-3 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary))] transition-all duration-75 z-10"
                style={{
                  left: `${(gazePosition.x / window.innerWidth) * 100}%`,
                  top: `${(gazePosition.y / window.innerHeight) * 100}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              />
            )}
            {rawGazePosition && (
              <div
                className="absolute w-2 h-2 rounded-full bg-muted-foreground/50 transition-all duration-75"
                style={{
                  left: `${(rawGazePosition.x / window.innerWidth) * 100}%`,
                  top: `${(rawGazePosition.y / window.innerHeight) * 100}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              />
            )}
            <div className="absolute bottom-1 left-1 text-[10px] text-muted-foreground">
              ● Calibrated ○ Raw · Trail
            </div>
          </div>
        </Section>

        {/* Eye Status */}
        <Section id="eye" title="Eye Status" icon={<Eye className="w-3 h-3" />}>
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 rounded-lg bg-muted/30 text-center">
              <div className="text-xs text-muted-foreground">Direction</div>
              <div className="font-medium text-sm capitalize">{currentDirection}</div>
            </div>
            <div className="p-2 rounded-lg bg-muted/30 text-center">
              <div className="text-xs text-muted-foreground">Openness</div>
              <div className="font-medium text-sm">{Math.round(eyeOpenness * 100)}%</div>
            </div>
            <div className="p-2 rounded-lg bg-muted/30 text-center">
              <div className="text-xs text-muted-foreground">Blinks</div>
              <div className="font-medium text-sm">{stats.totalBlinks}</div>
            </div>
          </div>
          {pendingBlinkCount > 0 && (
            <div className="text-xs text-amber-600 dark:text-amber-400">
              Pending pattern: {pendingBlinkCount} blink(s)
            </div>
          )}
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-100',
                eyeOpenness > 0.5 ? 'bg-green-500' : eyeOpenness > 0.3 ? 'bg-yellow-500' : 'bg-red-500'
              )}
              style={{ width: `${eyeOpenness * 100}%` }}
            />
          </div>
        </Section>

        {/* Ghost Buttons */}
        {ghostList.length > 0 && (
          <Section id="ghost" title="Ghost Buttons" icon={<MousePointer className="w-3 h-3" />}>
            <div className="space-y-1.5 max-h-24 overflow-y-auto">
              {ghostList.map((g) => (
                <div
                  key={g.buttonId}
                  className={cn(
                    'flex items-center justify-between p-2 rounded-md text-xs',
                    g.buttonId === currentTargetId ? 'bg-primary/15 ring-1 ring-primary/50' : 'bg-muted/30'
                  )}
                >
                  <span className="font-mono truncate">{g.buttonId}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={g.isGhost ? 'text-green-500' : 'text-muted-foreground'}>
                      {g.isGhost ? 'Ready' : `${Math.round(g.activationProgress * 100)}%`}
                    </span>
                    <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${g.activationProgress * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Gaze Commands */}
        {gazeCommands.length > 0 && (
          <Section id="commands" title="Gaze Commands" icon={<Navigation className="w-3 h-3" />}>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              {gazeCommands.map((c) => (
                <div
                  key={c.direction}
                  className={cn(
                    'flex justify-between p-2 rounded-md',
                    c.enabled ? 'bg-muted/30' : 'bg-muted/10 opacity-60'
                  )}
                >
                  <span className="capitalize">{c.direction}</span>
                  <span className="text-muted-foreground">
                    {GAZE_ACTION_LABELS[c.action] ?? c.action}
                  </span>
                </div>
              ))}
            </div>
            {lastNavigationAction && lastNavigationAction !== 'none' && (
              <div className="text-xs text-primary mt-1">
                Last nav: {GAZE_ACTION_LABELS[lastNavigationAction]}
              </div>
            )}
          </Section>
        )}

        {/* Performance */}
        <Section id="perf" title="Performance" icon={<Gauge className="w-3 h-3" />}>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
              <span className="text-xs">FPS</span>
              <span className={cn('font-mono text-sm', getStatusColor(stats.fps, { good: 15, warning: 10 }))}>
                {stats.fps}
              </span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
              <span className="text-xs">Latency</span>
              <span
                className={cn(
                  'font-mono text-sm',
                  getStatusColor(100 - stats.avgLatency, { good: 50, warning: 30 })
                )}
              >
                {stats.avgLatency}ms
              </span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
              <span className="text-xs">Stability</span>
              <div className="flex items-center gap-1">
                {getStatusIcon(stats.gazeStability, { good: 70, warning: 40 })}
                <span
                  className={cn(
                    'font-mono text-sm',
                    getStatusColor(stats.gazeStability, { good: 70, warning: 40 })
                  )}
                >
                  {stats.gazeStability}%
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
              <span className="text-xs">Session</span>
              <span className="font-mono text-sm">{formatDuration(stats.sessionDuration)}</span>
            </div>
          </div>
          {stats.fps > 0 && stats.fps < 12 && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs">
              <Zap className="w-3 h-3 shrink-0" />
              Low FPS may affect responsiveness. Try closing other apps or reducing camera resolution.
            </div>
          )}
        </Section>

        {/* Calibration */}
        <Section id="calibration" title="Calibration" icon={<TrendingUp className="w-3 h-3" />}>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded-lg bg-muted/30">
              <div className="text-muted-foreground">Offset X</div>
              <div className="font-mono">{calibration.offsetX.toFixed(3)}</div>
            </div>
            <div className="p-2 rounded-lg bg-muted/30">
              <div className="text-muted-foreground">Offset Y</div>
              <div className="font-mono">{calibration.offsetY.toFixed(3)}</div>
            </div>
            <div className="p-2 rounded-lg bg-muted/30">
              <div className="text-muted-foreground">Scale X</div>
              <div className="font-mono">{calibration.scaleX.toFixed(3)}</div>
            </div>
            <div className="p-2 rounded-lg bg-muted/30">
              <div className="text-muted-foreground">Scale Y</div>
              <div className="font-mono">{calibration.scaleY.toFixed(3)}</div>
            </div>
          </div>
          {(calibration.slowBlinkMinMs != null || calibration.slowBlinkMaxMs != null) && (
            <div className="text-xs text-muted-foreground">
              Slow blink: {calibration.slowBlinkMinMs ?? 400}–{calibration.slowBlinkMaxMs ?? 2000}ms
            </div>
          )}
          <div
            className={cn(
              'flex items-center justify-between p-2 rounded-lg',
              calibration.isCalibrated ? 'bg-green-500/10' : 'bg-yellow-500/10'
            )}
          >
            <span className="text-xs">Status</span>
            <span
              className={cn(
                'text-xs font-medium',
                calibration.isCalibrated ? 'text-green-500' : 'text-yellow-500'
              )}
            >
              {calibration.isCalibrated ? 'Calibrated' : 'Not Calibrated'}
            </span>
          </div>
          {calibration.autoAdjustments > 0 && (
            <div className="text-xs text-muted-foreground">
              Auto-adjustments: {calibration.autoAdjustments}
            </div>
          )}
        </Section>

        {/* Auto-Calibration Toggle */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium">Auto-Calibration</span>
          </div>
          <Button
            variant={autoCalibrationEnabled ? 'default' : 'outline'}
            size="sm"
            className="h-6 text-xs"
            onClick={onToggleAutoCalibration}
          >
            {autoCalibrationEnabled ? 'On' : 'Off'}
          </Button>
        </div>

        {/* Settings (expandable) */}
        <Section id="settings" title="Settings" icon={<Activity className="w-3 h-3" />}>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="p-2 rounded-lg bg-muted/30 text-center">
              <div className="text-muted-foreground">Sensitivity</div>
              <div className="font-mono">{settings.sensitivity ?? '—'}</div>
            </div>
            <div className="p-2 rounded-lg bg-muted/30 text-center">
              <div className="text-muted-foreground">Hold</div>
              <div className="font-mono">{settings.gazeHoldTime ?? '—'}ms</div>
            </div>
            <div className="p-2 rounded-lg bg-muted/30 text-center">
              <div className="text-muted-foreground">Edge</div>
              <div className="font-mono">{settings.edgeThreshold ?? '—'}</div>
            </div>
          </div>
          {showFullSettings && (
            <div className="grid grid-cols-2 gap-1.5 text-xs mt-2">
              {settings.ghostOpacity != null && (
                <div className="p-2 rounded-md bg-muted/20">
                  <span className="text-muted-foreground">Ghost Opacity</span>
                  <div className="font-mono">{settings.ghostOpacity}</div>
                </div>
              )}
              {settings.gazeReach != null && (
                <div className="p-2 rounded-md bg-muted/20">
                  <span className="text-muted-foreground">Gaze Reach</span>
                  <div className="font-mono">{settings.gazeReach}</div>
                </div>
              )}
              {settings.mirrorX != null && (
                <div className="p-2 rounded-md bg-muted/20">
                  <span className="text-muted-foreground">Mirror X</span>
                  <div className="font-mono">{settings.mirrorX ? 'Yes' : 'No'}</div>
                </div>
              )}
              {settings.invertY != null && (
                <div className="p-2 rounded-md bg-muted/20">
                  <span className="text-muted-foreground">Invert Y</span>
                  <div className="font-mono">{settings.invertY ? 'Yes' : 'No'}</div>
                </div>
              )}
              {settings.tiltEnabled != null && (
                <div className="p-2 rounded-md bg-muted/20">
                  <span className="text-muted-foreground">Tilt</span>
                  <div className="font-mono">{settings.tiltEnabled ? 'On' : 'Off'}</div>
                </div>
              )}
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs mt-1"
            onClick={() => setShowFullSettings((v) => !v)}
          >
            {showFullSettings ? 'Less' : 'More settings…'}
          </Button>
        </Section>

        {/* Event Log */}
        <Section id="events" title="Event Log" icon={<Activity className="w-3 h-3" />}>
          <div className="space-y-1 max-h-32 overflow-y-auto font-mono text-[10px]">
            {eventLog.length === 0 ? (
              <div className="text-muted-foreground p-2">No events yet</div>
            ) : (
              eventLog.map((e) => (
                <div
                  key={e.id}
                  className={cn(
                    'flex items-center gap-2 p-1.5 rounded',
                    e.type === 'blink' && 'bg-blue-500/10',
                    e.type === 'nav' && 'bg-green-500/10',
                    e.type === 'target' && 'bg-purple-500/10',
                    e.type === 'system' && 'bg-muted/30'
                  )}
                >
                  <span className="text-muted-foreground shrink-0">
                    {new Date(e.ts).toLocaleTimeString()}
                  </span>
                  <span>{e.label}</span>
                  {e.detail && (
                    <span className="text-muted-foreground truncate">{e.detail}</span>
                  )}
                </div>
              ))
            )}
          </div>
        </Section>
      </div>
    </div>
  );
};

export default RemoteControlDebugOverlay;
