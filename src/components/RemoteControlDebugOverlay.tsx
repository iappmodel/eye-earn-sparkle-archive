import React, { useState, useEffect } from 'react';
import { X, Eye, Target, Activity, Gauge, TrendingUp, AlertCircle, CheckCircle, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { CalibrationData } from '@/hooks/useBlinkRemoteControl';
import { GazeDirection } from '@/hooks/useGazeDirection';

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
  settings: {
    sensitivity: number;
    gazeHoldTime: number;
    edgeThreshold: number;
  };
  blinkCount: number;
  autoCalibrationEnabled: boolean;
  onToggleAutoCalibration: () => void;
}

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
  
  const [fpsHistory, setFpsHistory] = useState<number[]>([]);
  const [positionHistory, setPositionHistory] = useState<{ x: number; y: number }[]>([]);
  const [lastFrameTime, setLastFrameTime] = useState(Date.now());
  const [sessionStart] = useState(Date.now());

  // Track FPS
  useEffect(() => {
    if (!isOpen || !gazePosition) return;
    
    const now = Date.now();
    const delta = now - lastFrameTime;
    const currentFps = delta > 0 ? Math.round(1000 / delta) : 0;
    
    setLastFrameTime(now);
    setFpsHistory(prev => {
      const newHistory = [...prev, currentFps].slice(-30);
      return newHistory;
    });
    
    // Calculate average FPS
    const avgFps = fpsHistory.length > 0 
      ? Math.round(fpsHistory.reduce((a, b) => a + b, 0) / fpsHistory.length)
      : 0;
    
    setStats(prev => ({
      ...prev,
      fps: avgFps,
      avgLatency: avgFps > 0 ? Math.round(1000 / avgFps) : 0,
      totalGazeEvents: prev.totalGazeEvents + 1,
    }));
  }, [gazePosition, isOpen]);

  // Track gaze stability
  useEffect(() => {
    if (!gazePosition) return;
    
    setPositionHistory(prev => {
      const newHistory = [...prev, gazePosition].slice(-20);
      return newHistory;
    });
    
    if (positionHistory.length >= 5) {
      // Calculate variance as stability metric
      const avgX = positionHistory.reduce((a, p) => a + p.x, 0) / positionHistory.length;
      const avgY = positionHistory.reduce((a, p) => a + p.y, 0) / positionHistory.length;
      const variance = positionHistory.reduce((a, p) => 
        a + Math.sqrt((p.x - avgX) ** 2 + (p.y - avgY) ** 2), 0
      ) / positionHistory.length;
      
      // Convert variance to stability score (lower variance = higher stability)
      const stability = Math.max(0, Math.min(100, 100 - variance / 5));
      
      setStats(prev => ({
        ...prev,
        gazeStability: Math.round(stability),
      }));
    }
  }, [gazePosition]);

  // Track session duration
  useEffect(() => {
    if (!isOpen) return;
    
    const interval = setInterval(() => {
      setStats(prev => ({
        ...prev,
        sessionDuration: Math.floor((Date.now() - sessionStart) / 1000),
      }));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [isOpen, sessionStart]);

  // Track blink count
  useEffect(() => {
    setStats(prev => ({
      ...prev,
      totalBlinks: blinkCount,
    }));
  }, [blinkCount]);

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

  return (
    <div className="fixed top-4 right-4 z-[200] w-80 bg-background/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">Debug Overlay</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-2 h-2 rounded-full animate-pulse",
            isCameraActive ? "bg-green-500" : "bg-red-500"
          )} />
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="p-3 space-y-4 max-h-[70vh] overflow-y-auto">
        {/* Camera Status */}
        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
          <Camera className={cn("w-4 h-4", isCameraActive ? "text-green-500" : "text-muted-foreground")} />
          <span className="text-xs">Camera: {isCameraActive ? 'Active' : 'Inactive'}</span>
        </div>

        {/* Real-time Gaze Position */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Target className="w-3 h-3" />
            Gaze Position
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded-lg bg-muted/30">
              <div className="text-xs text-muted-foreground">Calibrated</div>
              <div className="font-mono text-sm">
                {gazePosition 
                  ? `${Math.round(gazePosition.x)}, ${Math.round(gazePosition.y)}`
                  : 'N/A'
                }
              </div>
            </div>
            <div className="p-2 rounded-lg bg-muted/30">
              <div className="text-xs text-muted-foreground">Raw</div>
              <div className="font-mono text-sm">
                {rawGazePosition 
                  ? `${Math.round(rawGazePosition.x)}, ${Math.round(rawGazePosition.y)}`
                  : 'N/A'
                }
              </div>
            </div>
          </div>
          
          {/* Visual position indicator */}
          <div className="relative h-20 rounded-lg bg-muted/20 border border-border overflow-hidden">
            {gazePosition && (
              <div
                className="absolute w-3 h-3 rounded-full bg-primary shadow-[0_0_10px_hsl(var(--primary))] transition-all duration-75"
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
              ● Calibrated ○ Raw
            </div>
          </div>
        </div>

        {/* Eye Status */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Eye className="w-3 h-3" />
            Eye Status
          </h4>
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
          
          {/* Eye openness bar */}
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div 
              className={cn(
                "h-full transition-all duration-100",
                eyeOpenness > 0.5 ? "bg-green-500" : eyeOpenness > 0.3 ? "bg-yellow-500" : "bg-red-500"
              )}
              style={{ width: `${eyeOpenness * 100}%` }}
            />
          </div>
        </div>

        {/* Performance Stats */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Gauge className="w-3 h-3" />
            Performance
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
              <span className="text-xs">FPS</span>
              <span className={cn("font-mono text-sm", getStatusColor(stats.fps, { good: 15, warning: 10 }))}>
                {stats.fps}
              </span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
              <span className="text-xs">Latency</span>
              <span className={cn("font-mono text-sm", getStatusColor(100 - stats.avgLatency, { good: 50, warning: 30 }))}>
                {stats.avgLatency}ms
              </span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
              <span className="text-xs">Stability</span>
              <div className="flex items-center gap-1">
                {getStatusIcon(stats.gazeStability, { good: 70, warning: 40 })}
                <span className={cn("font-mono text-sm", getStatusColor(stats.gazeStability, { good: 70, warning: 40 }))}>
                  {stats.gazeStability}%
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
              <span className="text-xs">Session</span>
              <span className="font-mono text-sm">{formatDuration(stats.sessionDuration)}</span>
            </div>
          </div>
        </div>

        {/* Calibration Data */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Calibration
          </h4>
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
          <div className={cn(
            "flex items-center justify-between p-2 rounded-lg",
            calibration.isCalibrated ? "bg-green-500/10" : "bg-yellow-500/10"
          )}>
            <span className="text-xs">Status</span>
            <span className={cn(
              "text-xs font-medium",
              calibration.isCalibrated ? "text-green-500" : "text-yellow-500"
            )}>
              {calibration.isCalibrated ? 'Calibrated' : 'Not Calibrated'}
            </span>
          </div>
        </div>

        {/* Auto-Calibration */}
        <div className="space-y-2">
          <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium">Auto-Calibration</span>
            </div>
            <Button
              variant={autoCalibrationEnabled ? "default" : "outline"}
              size="sm"
              className="h-6 text-xs"
              onClick={onToggleAutoCalibration}
            >
              {autoCalibrationEnabled ? 'Enabled' : 'Disabled'}
            </Button>
          </div>
          {autoCalibrationEnabled && (
            <p className="text-[10px] text-muted-foreground px-2">
              Automatically adjusts calibration based on your interactions to improve accuracy over time.
            </p>
          )}
        </div>

        {/* Settings Preview */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Settings</h4>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="p-2 rounded-lg bg-muted/30 text-center">
              <div className="text-muted-foreground">Sensitivity</div>
              <div className="font-mono">{settings.sensitivity}</div>
            </div>
            <div className="p-2 rounded-lg bg-muted/30 text-center">
              <div className="text-muted-foreground">Hold Time</div>
              <div className="font-mono">{settings.gazeHoldTime}ms</div>
            </div>
            <div className="p-2 rounded-lg bg-muted/30 text-center">
              <div className="text-muted-foreground">Edge Threshold</div>
              <div className="font-mono">{settings.edgeThreshold}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RemoteControlDebugOverlay;
