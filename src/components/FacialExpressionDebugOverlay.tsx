/**
 * FacialExpressionDebugOverlay – instrumentation overlay for facial expression scanning.
 * Toggleable debug panel with tracking state, expression detection metrics, baselines,
 * live mouth/eye values, head pose, FPS, and copy-to-clipboard for support.
 */
import React, { useState, useCallback } from 'react';
import { X, ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';
import type { VisionState } from '@/hooks/useVisionEngine';
import { cn } from '@/lib/utils';

export interface ExpressionDebugSnapshot {
  phase: 'tutorial' | 'matching';
  holdProgress: number;
  attemptCount: number;
  successHoldCount: number;
  currentExpressionId: string;
  currentExpressionName: string;
  statusText: string;
  faceDetected: boolean;
  expressionDetectedThisFrame: boolean;
  consecutiveDetected: number;
  holdStartTimestamp: number | null;
}

export interface BaselineSnapshot {
  smileBaseline: number | null;
  mouthOpenBaseline: number | null;
  cornerBaseline: { leftY: number; rightY: number } | null;
  upperLipBaseline: number | null;
  mouthWidthBaseline: number | null;
  baselineSamplesCollected: {
    smile: number;
    mouthOpen: number;
    corner: number;
    upperLip: number;
    mouthWidth: number;
  };
}

export interface LiveMetricsSnapshot {
  mouthWidthRatio: number | null;
  mouthOpenRatio: number | null;
  cornerLeftY: number | null;
  cornerRightY: number | null;
  upperLipY: number | null;
  mouthWidth: number | null;
  headYaw: number;
  headPitch: number;
}

interface FacialExpressionDebugOverlayProps {
  vision: VisionState;
  expression: ExpressionDebugSnapshot;
  baseline: BaselineSnapshot | null;
  liveMetrics: LiveMetricsSnapshot | null;
  fps: number | null;
  onClose: () => void;
}

function Section({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-white/10 last:border-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between py-2 text-left text-xs font-semibold text-cyan-200 uppercase tracking-wider"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        <span>{title}</span>
      </button>
      {open && <div className="pb-2 space-y-1 text-[11px] font-mono text-white/90">{children}</div>}
    </div>
  );
}

function Row({ label, value, good }: { label: string; value: string | number | null | undefined; good?: boolean }) {
  const v = value == null ? '—' : typeof value === 'number' ? value.toFixed(4) : String(value);
  return (
    <div className="flex justify-between gap-4">
      <span className="text-white/60 truncate">{label}</span>
      <span className={cn('tabular-nums shrink-0', good === true && 'text-emerald-400', good === false && 'text-amber-400')}>
        {v}
      </span>
    </div>
  );
}

export const FacialExpressionDebugOverlay: React.FC<FacialExpressionDebugOverlayProps> = ({
  vision,
  expression,
  baseline,
  liveMetrics,
  fps,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = useCallback(() => {
    const lines: string[] = [
      `[Facial Expression Debug] ${new Date().toISOString()}`,
      '--- Tracking ---',
      `hasFace: ${vision.hasFace}`,
      `landmarks: ${vision.landmarks?.length ?? 0}`,
      `eyeOpenness: ${vision.eyeOpenness.toFixed(4)}`,
      `leftEAR: ${vision.leftEAR.toFixed(4)}`,
      `rightEAR: ${vision.rightEAR.toFixed(4)}`,
      `headYaw: ${vision.headYaw.toFixed(2)}`,
      `headPitch: ${vision.headPitch.toFixed(2)}`,
      `gaze: ${vision.gazePosition ? `${vision.gazePosition.x.toFixed(3)}, ${vision.gazePosition.y.toFixed(3)}` : 'null'}`,
      `blinkCount: ${vision.blinkCount}`,
      `baselineReady: ${vision.baselineReady}`,
      '--- Expression ---',
      `phase: ${expression.phase}`,
      `current: ${expression.currentExpressionId} (${expression.currentExpressionName})`,
      `faceDetected: ${expression.faceDetected}`,
      `expressionDetectedThisFrame: ${expression.expressionDetectedThisFrame}`,
      `holdProgress: ${expression.holdProgress.toFixed(1)}%`,
      `attemptCount: ${expression.attemptCount}`,
      `successHoldCount: ${expression.successHoldCount}`,
      `consecutiveDetected: ${expression.consecutiveDetected}`,
      `status: ${expression.statusText}`,
    ];
    if (baseline) {
      lines.push('--- Baselines ---');
      lines.push(`smileBaseline: ${baseline.smileBaseline?.toFixed(4) ?? 'null'}`);
      lines.push(`mouthOpenBaseline: ${baseline.mouthOpenBaseline?.toFixed(4) ?? 'null'}`);
      lines.push(`mouthWidthBaseline: ${baseline.mouthWidthBaseline?.toFixed(4) ?? 'null'}`);
      if (baseline.cornerBaseline) {
        lines.push(`cornerBaseline: L=${baseline.cornerBaseline.leftY.toFixed(4)} R=${baseline.cornerBaseline.rightY.toFixed(4)}`);
      }
      lines.push(`upperLipBaseline: ${baseline.upperLipBaseline?.toFixed(4) ?? 'null'}`);
      lines.push(`samples: smile=${baseline.baselineSamplesCollected.smile} mouthOpen=${baseline.baselineSamplesCollected.mouthOpen} corner=${baseline.baselineSamplesCollected.corner} upperLip=${baseline.baselineSamplesCollected.upperLip} mouthWidth=${baseline.baselineSamplesCollected.mouthWidth}`);
    }
    if (liveMetrics) {
      lines.push('--- Live metrics ---');
      lines.push(`mouthWidthRatio: ${liveMetrics.mouthWidthRatio?.toFixed(4) ?? 'null'}`);
      lines.push(`mouthOpenRatio: ${liveMetrics.mouthOpenRatio?.toFixed(4) ?? 'null'}`);
      lines.push(`mouthWidth: ${liveMetrics.mouthWidth?.toFixed(4) ?? 'null'}`);
      lines.push(`upperLipY: ${liveMetrics.upperLipY?.toFixed(4) ?? 'null'}`);
      lines.push(`headYaw: ${liveMetrics.headYaw.toFixed(2)} headPitch: ${liveMetrics.headPitch.toFixed(2)}`);
    }
    if (fps != null) {
      lines.push(`fps: ${fps.toFixed(1)}`);
    }
    const text = lines.join('\n');
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {}
    );
  }, [vision, expression, baseline, liveMetrics, fps]);

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-black/85 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0 px-3 py-2 border-b border-white/20 bg-white/5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-cyan-300">Expression Debug</span>
          {expression.expressionDetectedThisFrame && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/90 text-white animate-pulse">
              Detected
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {fps != null && (
            <span className="text-[11px] font-mono text-white/70 tabular-nums">{fps.toFixed(1)} FPS</span>
          )}
          <button
            type="button"
            onClick={copyToClipboard}
            className="flex items-center gap-1 px-2 py-1 rounded bg-white/10 text-white/90 hover:bg-white/20 text-[11px]"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white/80"
            aria-label="Close debug overlay"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-2">
        <Section title="Tracking" defaultOpen={true}>
          <Row label="Face" value={vision.hasFace ? 'Yes' : 'No'} good={vision.hasFace} />
          <Row label="Landmarks" value={vision.landmarks?.length ?? 0} />
          <Row label="Eye openness" value={vision.eyeOpenness} />
          <Row label="Left EAR" value={vision.leftEAR} />
          <Row label="Right EAR" value={vision.rightEAR} />
          <Row label="Blink count" value={vision.blinkCount} />
          <Row label="Baseline ready" value={vision.baselineReady ? 'Yes' : 'No'} good={vision.baselineReady} />
          {vision.gazePosition && (
            <Row label="Gaze" value={`${vision.gazePosition.x.toFixed(3)}, ${vision.gazePosition.y.toFixed(3)}`} />
          )}
        </Section>

        <Section title="Head pose" defaultOpen={true}>
          <Row label="Yaw (°)" value={vision.headYaw} />
          <Row label="Pitch (°)" value={vision.headPitch} />
        </Section>

        <Section title="Expression state" defaultOpen={true}>
          <Row label="Phase" value={expression.phase} />
          <Row label="Current" value={`${expression.currentExpressionName} (${expression.currentExpressionId})`} />
          <Row label="Face in frame" value={expression.faceDetected ? 'Yes' : 'No'} good={expression.faceDetected} />
          <Row label="Detected this frame" value={expression.expressionDetectedThisFrame ? 'Yes' : 'No'} good={expression.expressionDetectedThisFrame} />
          <Row label="Consecutive frames" value={expression.consecutiveDetected} />
          <Row label="Hold progress %" value={expression.holdProgress.toFixed(1)} />
          <Row label="Attempt" value={expression.attemptCount} />
          <Row label="Success holds" value={expression.successHoldCount} />
          <Row label="Status" value={expression.statusText} />
        </Section>

        {liveMetrics && (
          <Section title="Live mouth/face metrics" defaultOpen={true}>
            <Row label="Mouth width ratio" value={liveMetrics.mouthWidthRatio} />
            <Row label="Mouth open ratio" value={liveMetrics.mouthOpenRatio} />
            <Row label="Mouth width" value={liveMetrics.mouthWidth} />
            <Row label="Upper lip Y" value={liveMetrics.upperLipY} />
            <Row label="Corner L Y" value={liveMetrics.cornerLeftY} />
            <Row label="Corner R Y" value={liveMetrics.cornerRightY} />
            <Row label="Head yaw" value={liveMetrics.headYaw} />
            <Row label="Head pitch" value={liveMetrics.headPitch} />
          </Section>
        )}

        {baseline && (
          <Section title="Baselines (expression-specific)" defaultOpen={true}>
            <Row label="Smile baseline" value={baseline.smileBaseline} />
            <Row label="Mouth open baseline" value={baseline.mouthOpenBaseline} />
            <Row label="Mouth width baseline" value={baseline.mouthWidthBaseline} />
            {baseline.cornerBaseline && (
              <Row label="Corner L/R Y" value={`${baseline.cornerBaseline.leftY.toFixed(4)} / ${baseline.cornerBaseline.rightY.toFixed(4)}`} />
            )}
            <Row label="Upper lip baseline" value={baseline.upperLipBaseline} />
            <div className="pt-1 text-white/50">
              Samples: smile={baseline.baselineSamplesCollected.smile} mouthOpen={baseline.baselineSamplesCollected.mouthOpen} corner={baseline.baselineSamplesCollected.corner} upperLip={baseline.baselineSamplesCollected.upperLip} mouthWidth={baseline.baselineSamplesCollected.mouthWidth}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
};

export default FacialExpressionDebugOverlay;
