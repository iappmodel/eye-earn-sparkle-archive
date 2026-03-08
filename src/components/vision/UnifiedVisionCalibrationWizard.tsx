import React, { useEffect, useMemo, useState } from 'react';
import { Check, Hand, Sparkles, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  normalizeVisionCalibration,
  type AffineParams,
  type VisionCalibrationProfile,
} from '@/lib/visionCalibration/profile';

type StepId = 'setup' | 'gaze' | 'gestures' | 'summary';

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

const STEPS: StepId[] = ['setup', 'gaze', 'gestures', 'summary'];
const GAZE_POINTS = [
  { x: 0.12, y: 0.16, label: 'Top Left' },
  { x: 0.88, y: 0.16, label: 'Top Right' },
  { x: 0.5, y: 0.5, label: 'Center' },
  { x: 0.18, y: 0.84, label: 'Bottom Left' },
  { x: 0.82, y: 0.84, label: 'Bottom Right' },
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

  const qualityError = samples.length
    ? samples.reduce((acc, sample) => {
        const corrected = next.affineParams
          ? applyAffine(next.affineParams, sample.gazeX, sample.gazeY)
          : {
              x: clamp01((sample.gazeX - 0.5) * next.scaleX + 0.5 + next.offsetX),
              y: clamp01((sample.gazeY - 0.5) * next.scaleY + 0.5 + next.offsetY),
            };
        const err = Math.hypot(corrected.x - sample.targetX, corrected.y - sample.targetY);
        return acc + err;
      }, 0) / samples.length
    : 0.25;

  const gestureScore =
    Object.values(gestures).filter(Boolean).length / Object.values(gestures).length;

  const profileQuality = clamp01((1 - qualityError / 0.28) * 0.8 + gestureScore * 0.2);
  const easierMode = gestureScore < 0.75;

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
  const [step, setStep] = useState<StepId>('setup');
  const [samples, setSamples] = useState<GazeSample[]>([]);
  const [gestureChecks, setGestureChecks] = useState<GestureChecks>({
    singleBlink: false,
    doubleBlink: false,
    handPinch: false,
    headNod: false,
  });

  useEffect(() => {
    if (!isOpen) return;
    setStep('setup');
    setSamples([]);
    setGestureChecks({
      singleBlink: false,
      doubleBlink: false,
      handPinch: false,
      headNod: false,
    });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || step !== 'gestures') return;
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

  const activePoint = GAZE_POINTS[samples.length];
  const gestureDoneCount = Object.values(gestureChecks).filter(Boolean).length;
  const canContinueSetup = hasFace && (livenessStable || livenessScore >= 0.25);
  const canContinueGestures = gestureChecks.singleBlink && gestureChecks.handPinch;

  const previewCalibration = useMemo(
    () => buildCalibration(calibration, samples, gestureChecks),
    [calibration, samples, gestureChecks]
  );

  const capturePoint = () => {
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
        </DialogHeader>

        {step === 'setup' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Keep your face centered and hold your phone steady for a few seconds.
            </p>
            <div className="rounded-lg border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span>Face detected</span>
                <span className={hasFace ? 'text-emerald-600' : 'text-amber-600'}>
                  {hasFace ? 'Ready' : 'Not detected'}
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span>Liveness score</span>
                <span className={livenessStable ? 'text-emerald-600' : 'text-amber-600'}>
                  {(livenessScore * 100).toFixed(0)}%
                </span>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={() => setStep('gaze')} disabled={!canContinueSetup}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 'gaze' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Look at each target, then press capture. This takes about 20 seconds.
            </p>
            <div className="relative h-56 rounded-lg border bg-muted/30">
              {GAZE_POINTS.map((point, index) => {
                const captured = index < samples.length;
                const isCurrent = index === samples.length;
                return (
                  <div
                    key={point.label}
                    className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border ${
                      captured ? 'bg-emerald-500 border-emerald-500' : isCurrent ? 'bg-primary border-primary' : 'bg-background border-border'
                    }`}
                    style={{
                      left: `${point.x * 100}%`,
                      top: `${point.y * 100}%`,
                      width: isCurrent ? 18 : 14,
                      height: isCurrent ? 18 : 14,
                    }}
                    title={point.label}
                  />
                );
              })}
            </div>
            <div className="text-xs text-muted-foreground">
              Captured {samples.length}/{GAZE_POINTS.length}
              {activePoint ? ` · Next: ${activePoint.label}` : ' · Gaze points complete'}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep('setup')}>Back</Button>
              {samples.length < GAZE_POINTS.length ? (
                <Button onClick={capturePoint} disabled={!rawGazePosition || !hasFace}>
                  <Target className="mr-2 h-4 w-4" />
                  Capture Point
                </Button>
              ) : (
                <Button onClick={() => setStep('gestures')}>Continue</Button>
              )}
            </div>
          </div>
        )}

        {step === 'gestures' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Trigger each gesture once to finish remote-control calibration.
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <GestureItem done={gestureChecks.singleBlink} label="Single blink" />
              <GestureItem done={gestureChecks.doubleBlink} label="Double blink" />
              <GestureItem done={gestureChecks.handPinch} label="Hand pinch" />
              <GestureItem done={gestureChecks.headNod} label="Head nod" />
            </div>
            <div className="text-xs text-muted-foreground">
              Completed {gestureDoneCount}/4 checks.
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep('gaze')}>Back</Button>
              <Button onClick={() => setStep('summary')} disabled={!canContinueGestures}>
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === 'summary' && (
          <div className="space-y-4">
            <div className="rounded-lg border p-3 text-sm">
              <div className="flex items-center justify-between">
                <span>Calibration quality</span>
                <span className="font-medium">{Math.round(previewCalibration.profileQuality * 100)}%</span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span>Liveness threshold</span>
                <span>{Math.round(previewCalibration.livenessMinScore * 100)}%</span>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {onOpenAdvanced && (
                <Button variant="outline" onClick={onOpenAdvanced}>
                  Advanced
                </Button>
              )}
              <Button variant="outline" onClick={() => setStep('gestures')}>Back</Button>
              <Button onClick={handleSave}>
                Save Calibration
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function GestureItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className={`rounded-md border p-2 ${done ? 'border-emerald-500 bg-emerald-500/10' : 'border-border'}`}>
      <div className="flex items-center gap-2">
        {done ? <Check className="h-4 w-4 text-emerald-600" /> : <Hand className="h-4 w-4 text-muted-foreground" />}
        <span>{label}</span>
      </div>
    </div>
  );
}
