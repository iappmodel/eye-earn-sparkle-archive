import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Hand, Sparkles, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DemoModeBadge } from '@/components/demo/DemoModeBadge';
import { isDemoMode } from '@/lib/appMode';
import {
  applyResidualCompensation,
  fitResidualModel,
  type ResidualTrainingSample,
} from '@/lib/visionCalibration/residualModel';
import {
  normalizeVisionCalibration,
  type AffineParams,
  type VisionCalibrationProfile,
  type VisionDeviceClass,
} from '@/lib/visionCalibration/profile';

type StepId = 'ready' | 'track' | 'verify';

interface GazeSample {
  targetX: number;
  targetY: number;
  gazeX: number;
  gazeY: number;
}

interface GestureChecks {
  singleBlink: boolean;
  doubleBlink: boolean;
  handPinch: boolean;
  headNod: boolean;
}

interface UnifiedVisionCalibrationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  rawGazePosition: { x: number; y: number } | null;
  hasFace: boolean;
  livenessScore: number;
  livenessStable: boolean;
  calibration: VisionCalibrationProfile;
  onSave: (next: VisionCalibrationProfile) => void;
  onOpenAdvanced?: () => void;
}

const STEPS: StepId[] = ['ready', 'track', 'verify'];
const MIN_GAZE_SAMPLES = 3;
const READY_LIVENESS_MIN = 0.25;
const READY_JITTER_MAX = 0.05;

const GAZE_POINTS = [
  { x: 0.5, y: 0.5, label: 'Center' },
  { x: 0.16, y: 0.18, label: 'Top Left' },
  { x: 0.84, y: 0.18, label: 'Top Right' },
  { x: 0.2, y: 0.82, label: 'Bottom Left' },
  { x: 0.8, y: 0.82, label: 'Bottom Right' },
];

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const solve3x3 = (M: number[][], v: number[]): [number, number, number] | null => {
  const a = M.map((row) => [...row]);
  const b = [...v];
  for (let col = 0; col < 3; col += 1) {
    let maxRow = col;
    for (let r = col + 1; r < 3; r += 1) {
      if (Math.abs(a[r][col]) > Math.abs(a[maxRow][col])) maxRow = r;
    }
    [a[col], a[maxRow]] = [a[maxRow], a[col]];
    [b[col], b[maxRow]] = [b[maxRow], b[col]];
    if (Math.abs(a[col][col]) < 1e-10) return null;
    for (let r = col + 1; r < 3; r += 1) {
      const factor = a[r][col] / a[col][col];
      for (let c = col; c < 3; c += 1) a[r][c] -= factor * a[col][c];
      b[r] -= factor * b[col];
    }
  }
  const x = [0, 0, 0];
  for (let i = 2; i >= 0; i -= 1) {
    let sum = b[i];
    for (let j = i + 1; j < 3; j += 1) sum -= a[i][j] * x[j];
    x[i] = sum / a[i][i];
  }
  return [x[0], x[1], x[2]];
};

const fitAffine = (samples: GazeSample[]): AffineParams | null => {
  if (samples.length < 4) return null;
  const AtA = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  const AtbX = [0, 0, 0];
  const AtbY = [0, 0, 0];

  for (const sample of samples) {
    const row = [sample.gazeX, sample.gazeY, 1];
    for (let i = 0; i < 3; i += 1) {
      for (let j = 0; j < 3; j += 1) AtA[i][j] += row[i] * row[j];
      AtbX[i] += row[i] * sample.targetX;
      AtbY[i] += row[i] * sample.targetY;
    }
  }

  const abc = solve3x3(AtA, AtbX);
  const def = solve3x3(AtA, AtbY);
  return abc && def ? ([...abc, ...def] as AffineParams) : null;
};

const applyAffine = (params: AffineParams, x: number, y: number) => {
  const [a, b, c, d, e, f] = params;
  return {
    x: clamp01(a * x + b * y + c),
    y: clamp01(d * x + e * y + f),
  };
};

const applyBaseCalibration = (
  calibration: VisionCalibrationProfile,
  rawX: number,
  rawY: number
) => {
  if (calibration.affineParams && calibration.affineParams.length === 6) {
    return applyAffine(calibration.affineParams, rawX, rawY);
  }
  return {
    x: clamp01((rawX - 0.5) * calibration.scaleX + 0.5 + calibration.offsetX),
    y: clamp01((rawY - 0.5) * calibration.scaleY + 0.5 + calibration.offsetY),
  };
};

const buildCalibration = (
  existing: VisionCalibrationProfile,
  samples: GazeSample[],
  gestures: GestureChecks
): VisionCalibrationProfile => {
  let next = { ...existing };

  const affine = fitAffine(samples);
  if (affine) {
    next = {
      ...next,
      offsetX: 0,
      offsetY: 0,
      scaleX: 1,
      scaleY: 1,
      affineParams: affine,
    };
  } else if (samples.length > 0) {
    const avgGazeX = samples.reduce((acc, s) => acc + s.gazeX, 0) / samples.length;
    const avgGazeY = samples.reduce((acc, s) => acc + s.gazeY, 0) / samples.length;
    const avgTargetX = samples.reduce((acc, s) => acc + s.targetX, 0) / samples.length;
    const avgTargetY = samples.reduce((acc, s) => acc + s.targetY, 0) / samples.length;
    next = {
      ...next,
      offsetX: avgTargetX - avgGazeX,
      offsetY: avgTargetY - avgGazeY,
      scaleX: 1,
      scaleY: 1,
      affineParams: undefined,
    };
  }

  const residualSamples: ResidualTrainingSample[] = samples.map((sample) => {
    const base = applyBaseCalibration(next, sample.gazeX, sample.gazeY);
    const distance = Math.hypot(base.x - sample.targetX, base.y - sample.targetY);
    const weight = Math.max(0.2, Math.min(1.2, 1.2 - distance * 2));
    return {
      inputX: base.x,
      inputY: base.y,
      targetX: sample.targetX,
      targetY: sample.targetY,
      weight,
    };
  });
  const residualModel = fitResidualModel(residualSamples, {
    lambda: 0.05,
    minSamples: existing.deviceClass === 'desktop' ? 8 : 6,
  });
  if (residualModel) {
    next = {
      ...next,
      residualModel,
    };
  }

  const qualityError = samples.length
    ? samples.reduce((acc, sample) => {
        const base = applyBaseCalibration(next, sample.gazeX, sample.gazeY);
        const corrected = applyResidualCompensation(base.x, base.y, next.residualModel);
        const err = Math.hypot(corrected.x - sample.targetX, corrected.y - sample.targetY);
        return acc + err;
      }, 0) / samples.length
    : 0.25;

  const mandatoryGestureScore =
    Number(gestures.singleBlink) * 0.5 +
    Number(gestures.handPinch) * 0.5;
  const bonusGestureScore =
    (Number(gestures.doubleBlink) + Number(gestures.headNod)) / 6;

  const profileQuality = clamp01((1 - qualityError / 0.28) * 0.82 + mandatoryGestureScore * 0.14 + bonusGestureScore);
  const easierMode = mandatoryGestureScore < 1;

  return normalizeVisionCalibration({
    ...next,
    isCalibrated: true,
    calibratedAt: Date.now(),
    profileQuality,
    handPinchMinConfidence: easierMode
      ? Math.max(0.48, next.handPinchMinConfidence - 0.06)
      : next.handPinchMinConfidence,
    handPointMinConfidence: easierMode
      ? Math.max(0.52, next.handPointMinConfidence - 0.06)
      : next.handPointMinConfidence,
    handOpenPalmMinConfidence: easierMode
      ? Math.max(0.48, next.handOpenPalmMinConfidence - 0.06)
      : next.handOpenPalmMinConfidence,
    headYawCommandThreshold: easierMode
      ? next.headYawCommandThreshold + 2
      : next.headYawCommandThreshold,
    nodRangeThreshold: easierMode ? next.nodRangeThreshold + 1 : next.nodRangeThreshold,
    version: 2,
  });
};

const stepIndex = (step: StepId) => STEPS.indexOf(step) + 1;

const stepLabel = (step: StepId) => {
  if (step === 'ready') return 'Ready';
  if (step === 'track') return 'Track';
  return 'Verify';
};

const getAutoCapturePreset = (deviceClass?: VisionDeviceClass) => {
  if (deviceClass === 'iphone') {
    return { holdMs: 340, cooldownMs: 220, targetRadius: 0.115 };
  }
  if (deviceClass === 'android') {
    return { holdMs: 420, cooldownMs: 260, targetRadius: 0.12 };
  }
  return { holdMs: 320, cooldownMs: 210, targetRadius: 0.1 };
};

export function UnifiedVisionCalibrationWizard({
  isOpen,
  onClose,
  rawGazePosition,
  hasFace,
  livenessScore,
  livenessStable,
  calibration,
  onSave,
  onOpenAdvanced,
}: UnifiedVisionCalibrationWizardProps) {
  const [step, setStep] = useState<StepId>('ready');
  const [samples, setSamples] = useState<GazeSample[]>([]);
  const [gestureChecks, setGestureChecks] = useState<GestureChecks>({
    singleBlink: false,
    doubleBlink: false,
    handPinch: false,
    headNod: false,
  });
  const [holdProgress, setHoldProgress] = useState(0);
  const [activeDistance, setActiveDistance] = useState<number | null>(null);
  const [gazeSpread, setGazeSpread] = useState(1);

  const holdStartRef = useRef<number | null>(null);
  const holdBufferRef = useRef<Array<{ x: number; y: number; t: number }>>([]);
  const captureCooldownUntilRef = useRef(0);
  const stabilityHistoryRef = useRef<Array<{ x: number; y: number; t: number }>>([]);

  const activePoint = step === 'track' ? GAZE_POINTS[samples.length] : undefined;
  const gestureDoneCount = Object.values(gestureChecks).filter(Boolean).length;
  const hasLivenessReadiness = livenessStable || livenessScore >= READY_LIVENESS_MIN;
  const hasSteadyCamera = hasFace && gazeSpread <= READY_JITTER_MAX;
  const canStartTracking = hasFace && hasLivenessReadiness && hasSteadyCamera;
  const canSave = samples.length >= MIN_GAZE_SAMPLES && gestureChecks.singleBlink && gestureChecks.handPinch;

  const { holdMs, cooldownMs, targetRadius } = useMemo(
    () => getAutoCapturePreset(calibration.deviceClass),
    [calibration.deviceClass]
  );

  useEffect(() => {
    if (!isOpen) return;
    setStep('ready');
    setSamples([]);
    setGestureChecks({
      singleBlink: false,
      doubleBlink: false,
      handPinch: false,
      headNod: false,
    });
    setHoldProgress(0);
    setActiveDistance(null);
    setGazeSpread(1);
    holdStartRef.current = null;
    holdBufferRef.current = [];
    captureCooldownUntilRef.current = 0;
    stabilityHistoryRef.current = [];
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !rawGazePosition) return;
    const now = performance.now();
    const next = {
      x: clamp01(rawGazePosition.x / window.innerWidth),
      y: clamp01(rawGazePosition.y / window.innerHeight),
      t: now,
    };
    stabilityHistoryRef.current = [...stabilityHistoryRef.current, next]
      .filter((entry) => now - entry.t < 1000)
      .slice(-16);

    const history = stabilityHistoryRef.current;
    if (history.length < 4) {
      setGazeSpread(1);
      return;
    }

    const centerX = history.reduce((acc, entry) => acc + entry.x, 0) / history.length;
    const centerY = history.reduce((acc, entry) => acc + entry.y, 0) / history.length;
    const spread = history.reduce((acc, entry) => (
      acc + Math.hypot(entry.x - centerX, entry.y - centerY)
    ), 0) / history.length;
    setGazeSpread(spread);
  }, [isOpen, rawGazePosition]);

  useEffect(() => {
    if (!isOpen || step !== 'track' || !activePoint) {
      holdStartRef.current = null;
      holdBufferRef.current = [];
      setHoldProgress(0);
      setActiveDistance(null);
      return;
    }

    if (!rawGazePosition || !hasFace) {
      holdStartRef.current = null;
      holdBufferRef.current = [];
      setHoldProgress(0);
      setActiveDistance(null);
      return;
    }

    const now = performance.now();
    if (now < captureCooldownUntilRef.current) return;

    const gazeX = clamp01(rawGazePosition.x / window.innerWidth);
    const gazeY = clamp01(rawGazePosition.y / window.innerHeight);
    const distance = Math.hypot(gazeX - activePoint.x, gazeY - activePoint.y);
    setActiveDistance(distance);

    if (distance > targetRadius) {
      holdStartRef.current = null;
      holdBufferRef.current = [];
      setHoldProgress(0);
      return;
    }

    if (holdStartRef.current == null) {
      holdStartRef.current = now;
      holdBufferRef.current = [];
    }

    holdBufferRef.current.push({ x: gazeX, y: gazeY, t: now });
    holdBufferRef.current = holdBufferRef.current.filter((entry) => now - entry.t <= holdMs + 120);
    const elapsed = now - (holdStartRef.current ?? now);
    const progress = Math.min(1, elapsed / holdMs);
    setHoldProgress(progress);

    if (progress < 1) return;

    const recent = holdBufferRef.current.slice(-6);
    const avgX = recent.reduce((acc, item) => acc + item.x, 0) / recent.length;
    const avgY = recent.reduce((acc, item) => acc + item.y, 0) / recent.length;

    setSamples((prev) => [
      ...prev,
      {
        targetX: activePoint.x,
        targetY: activePoint.y,
        gazeX: avgX,
        gazeY: avgY,
      },
    ]);

    holdStartRef.current = null;
    holdBufferRef.current = [];
    captureCooldownUntilRef.current = now + cooldownMs;
    setHoldProgress(0);
    setActiveDistance(null);
  }, [activePoint, cooldownMs, hasFace, holdMs, isOpen, rawGazePosition, step, targetRadius]);

  useEffect(() => {
    if (!isOpen || step !== 'track') return;
    if (samples.length < GAZE_POINTS.length) return;
    const timeoutId = window.setTimeout(() => setStep('verify'), 180);
    return () => window.clearTimeout(timeoutId);
  }, [isOpen, samples.length, step]);

  useEffect(() => {
    if (!isOpen || step !== 'verify') return;
    const onBlink = (event: Event) => {
      const detail = (event as CustomEvent<{ count?: number }>).detail;
      if (detail?.count === 1) {
        setGestureChecks((prev) => ({ ...prev, singleBlink: true }));
      }
      if (detail?.count === 2) {
        setGestureChecks((prev) => ({ ...prev, doubleBlink: true }));
      }
    };
    const onGesture = (event: Event) => {
      const detail = (event as CustomEvent<{ trigger?: string }>).detail;
      if (detail?.trigger === 'handPinch') {
        setGestureChecks((prev) => ({ ...prev, handPinch: true }));
      }
      if (detail?.trigger === 'headNod') {
        setGestureChecks((prev) => ({ ...prev, headNod: true }));
      }
    };
    window.addEventListener('remoteBlinkPattern', onBlink);
    window.addEventListener('remoteGestureTrigger', onGesture);
    return () => {
      window.removeEventListener('remoteBlinkPattern', onBlink);
      window.removeEventListener('remoteGestureTrigger', onGesture);
    };
  }, [isOpen, step]);

  const previewCalibration = useMemo(
    () => buildCalibration(calibration, samples, gestureChecks),
    [calibration, gestureChecks, samples]
  );

  const readyGuidance = !hasFace
    ? 'Move your face into the frame and keep both eyes visible.'
    : !hasLivenessReadiness
      ? 'Increase front lighting and avoid backlight.'
      : !hasSteadyCamera
        ? 'Hold the device still for a second to lock tracking.'
        : 'Ready. Start tracking now.';

  const holdRemainingMs = Math.max(0, Math.ceil((1 - holdProgress) * holdMs));
  const trackGuidance = !hasFace
    ? 'Face lost. Re-center and keep looking at the target.'
    : !activePoint
      ? 'All gaze targets captured.'
      : activeDistance == null
        ? `Look at ${activePoint.label}.`
        : activeDistance > targetRadius
          ? `Move gaze to ${activePoint.label}.`
          : `Hold for ${holdRemainingMs}ms to auto-capture.`;

  const capturePointManually = () => {
    if (!rawGazePosition || !activePoint) return;
    const gazeX = clamp01(rawGazePosition.x / window.innerWidth);
    const gazeY = clamp01(rawGazePosition.y / window.innerHeight);
    setSamples((prev) => [
      ...prev,
      {
        targetX: activePoint.x,
        targetY: activePoint.y,
        gazeX,
        gazeY,
      },
    ]);
    holdStartRef.current = null;
    holdBufferRef.current = [];
    setHoldProgress(0);
    setActiveDistance(null);
    captureCooldownUntilRef.current = performance.now() + cooldownMs;
  };

  const handleSave = () => {
    const next = buildCalibration(calibration, samples, gestureChecks);
    onSave(next);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Quick Calibration
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Step {stepIndex(step)} of {STEPS.length}
          </p>
          {isDemoMode && <DemoModeBadge className="mt-2 w-fit" />}
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2">
          {STEPS.map((id) => {
            const active = id === step;
            const done = stepIndex(step) > stepIndex(id);
            return (
              <div
                key={id}
                className={`rounded-md border px-2 py-1 text-xs text-center ${
                  active
                    ? 'border-primary bg-primary/10 text-primary'
                    : done
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700'
                      : 'border-border text-muted-foreground'
                }`}
              >
                {stepLabel(id)}
              </div>
            );
          })}
        </div>

        {step === 'ready' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{readyGuidance}</p>

            <div className="rounded-lg border p-3 text-sm space-y-2">
              <ReadinessItem
                label="Face in frame"
                value={hasFace ? 'Ready' : 'Not detected'}
                ok={hasFace}
              />
              <ReadinessItem
                label="Lighting / liveness"
                value={`${(livenessScore * 100).toFixed(0)}%`}
                ok={hasLivenessReadiness}
              />
              <ReadinessItem
                label="Camera stability"
                value={hasSteadyCamera ? 'Stable' : 'Hold still'}
                ok={hasSteadyCamera}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={() => setStep('track')} disabled={!canStartTracking}>
                Start Tracking
              </Button>
            </div>
          </div>
        )}

        {step === 'track' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {trackGuidance}
            </p>
            <div className="relative h-56 rounded-lg border bg-muted/30">
              {GAZE_POINTS.map((point, index) => {
                const captured = index < samples.length;
                const isCurrent = index === samples.length;
                return (
                  <div
                    key={point.label}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border ${
                      captured
                        ? 'bg-emerald-500 border-emerald-500'
                        : isCurrent
                          ? 'bg-primary border-primary animate-pulse'
                          : 'bg-background border-border'
                    }`}
                    style={{
                      left: `${point.x * 100}%`,
                      top: `${point.y * 100}%`,
                      width: isCurrent ? 20 : 14,
                      height: isCurrent ? 20 : 14,
                    }}
                    title={point.label}
                  />
                );
              })}
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">
                Captured {samples.length}/{GAZE_POINTS.length}
                {samples.length >= MIN_GAZE_SAMPLES ? ' · Minimum reached' : ` · Minimum ${MIN_GAZE_SAMPLES}`}
              </div>
              <div className="h-2 rounded bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${Math.round(holdProgress * 100)}%` }}
                />
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => setStep('ready')}>Back</Button>
              {activePoint && (
                <Button variant="outline" onClick={capturePointManually} disabled={!rawGazePosition || !hasFace}>
                  <Target className="mr-2 h-4 w-4" />
                  Capture Now
                </Button>
              )}
              <Button
                onClick={() => setStep('verify')}
                disabled={samples.length < MIN_GAZE_SAMPLES}
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 'verify' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Quick verification: single blink and hand pinch are required.
            </p>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <GestureItem done={gestureChecks.singleBlink} label="Single blink" required />
              <GestureItem done={gestureChecks.handPinch} label="Hand pinch" required />
              <GestureItem done={gestureChecks.doubleBlink} label="Double blink" />
              <GestureItem done={gestureChecks.headNod} label="Head nod" />
            </div>

            <div className="rounded-lg border p-3 text-sm space-y-2">
              <div className="flex items-center justify-between">
                <span>Gaze points used</span>
                <span className="font-medium">{samples.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Checks complete</span>
                <span className="font-medium">{gestureDoneCount}/4</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Estimated quality</span>
                <span className="font-medium">{Math.round(previewCalibration.profileQuality * 100)}%</span>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              {onOpenAdvanced && (
                <Button variant="outline" onClick={onOpenAdvanced}>
                  Advanced
                </Button>
              )}
              <Button variant="outline" onClick={() => setStep('track')}>Back</Button>
              <Button onClick={handleSave} disabled={!canSave}>
                Save Calibration
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ReadinessItem({
  label,
  value,
  ok,
}: {
  label: string;
  value: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span>{label}</span>
      <span className={ok ? 'text-emerald-600' : 'text-amber-600'}>
        {value}
      </span>
    </div>
  );
}

function GestureItem({ done, label, required }: { done: boolean; label: string; required?: boolean }) {
  return (
    <div className={`rounded-md border p-2 ${done ? 'border-emerald-500 bg-emerald-500/10' : 'border-border'}`}>
      <div className="flex items-center gap-2">
        {done ? <Check className="h-4 w-4 text-emerald-600" /> : <Hand className="h-4 w-4 text-muted-foreground" />}
        <span>{label}</span>
        {required && <span className="text-[10px] text-muted-foreground ml-auto">Required</span>}
      </div>
    </div>
  );
}
