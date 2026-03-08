import React from 'react';
import { Check, MonitorPlay, Globe2, RotateCcw, ShieldCheck, TimerReset, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCameraRuntimeIssue, hasMapboxEnvToken, isSupabaseConfigured } from '@/lib/demoRuntime';

export type DemoRewardMode = 'auto' | 'always_pass' | 'always_fail';
export type DemoCheckoutOutcome = 'completed' | 'pending' | 'reversed';

export interface DemoControlsState {
  forceLandscapePlayback: boolean;
  rewardMode: DemoRewardMode;
  verificationDelayMs: number;
  checkoutOutcome: DemoCheckoutOutcome;
  simulateVisionInput: boolean;
  simulateMapFallback: boolean;
}

interface DemoControlsSheetProps {
  isOpen: boolean;
  locale: 'en' | 'pt';
  controls: DemoControlsState;
  onClose: () => void;
  onControlsChange: (next: DemoControlsState) => void;
  onLocaleChange: (nextLocale: 'en' | 'pt') => void;
  /** Optional: reset demo to Hero Entry (for rehearsals) */
  onRestartDemo?: () => void;
  /** Optional: reset floating button layout/preferences */
  onResetLayout?: () => void;
}

const verificationDelayOptions = [
  { label: 'Instant', value: 0 },
  { label: '2s', value: 2000 },
  { label: '5s', value: 5000 },
] as const;

const rewardModes: { id: DemoRewardMode; label: string; description: string }[] = [
  { id: 'auto', label: 'Auto', description: 'Use real completion + attention outcome' },
  { id: 'always_pass', label: 'Always Pass', description: 'Always grant reward on completion' },
  { id: 'always_fail', label: 'Always Fail', description: 'Always withhold reward on completion' },
];

const checkoutOutcomes: { id: DemoCheckoutOutcome; label: string; description: string }[] = [
  { id: 'completed', label: 'Completed', description: 'Checkout settles successfully' },
  { id: 'pending', label: 'Pending', description: 'Receipt shows processing timeline' },
  { id: 'reversed', label: 'Reversed', description: 'Receipt shows reversal outcome' },
];

export const DemoControlsSheet: React.FC<DemoControlsSheetProps> = ({
  isOpen,
  locale,
  controls,
  onClose,
  onControlsChange,
  onLocaleChange,
  onRestartDemo,
  onResetLayout,
}) => {
  if (!isOpen) return null;
  const cameraIssue = getCameraRuntimeIssue();
  const supabaseConfigured = isSupabaseConfigured();
  const mapboxConfigured = hasMapboxEnvToken();

  return (
    <div className="fixed inset-0 z-[130] bg-black/70 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <section className="w-full sm:max-w-xl bg-slate-950 border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-slate-100">Demo Controls</h3>
            <p className="text-sm text-slate-300/80 mt-1">Internal controls for repeatable investor walkthroughs.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl bg-slate-900 border border-white/10 text-slate-200 flex items-center justify-center"
            aria-label="Close demo controls"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-5 space-y-5">
          <section>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400 mb-2 flex items-center gap-2">
              <Globe2 className="w-3.5 h-3.5" />
              Locale
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onLocaleChange('en')}
                className={cn(
                  'min-h-[44px] rounded-xl px-3 py-2 border text-sm text-left',
                  locale === 'en'
                    ? 'border-sky-400/60 bg-sky-500/10 text-sky-100'
                    : 'border-white/10 bg-slate-900 text-slate-200'
                )}
              >
                English (US)
              </button>
              <button
                type="button"
                onClick={() => onLocaleChange('pt')}
                className={cn(
                  'min-h-[44px] rounded-xl px-3 py-2 border text-sm text-left',
                  locale === 'pt'
                    ? 'border-sky-400/60 bg-sky-500/10 text-sky-100'
                    : 'border-white/10 bg-slate-900 text-slate-200'
                )}
              >
                Portuguese (Brazil)
              </button>
            </div>
          </section>

          <section>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400 mb-2 flex items-center gap-2">
              <MonitorPlay className="w-3.5 h-3.5" />
              Playback
            </p>
            <button
              type="button"
              onClick={() =>
                onControlsChange({
                  ...controls,
                  forceLandscapePlayback: !controls.forceLandscapePlayback,
                })
              }
              className={cn(
                'w-full min-h-[44px] rounded-xl border px-3 py-2 flex items-center justify-between text-sm',
                controls.forceLandscapePlayback
                  ? 'border-sky-400/60 bg-sky-500/10 text-sky-100'
                  : 'border-white/10 bg-slate-900 text-slate-200'
              )}
            >
              <span>Force landscape framing in media view</span>
              {controls.forceLandscapePlayback && <Check className="w-4 h-4" />}
            </button>
          </section>

          <section>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400 mb-2 flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              Demo Runtime
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() =>
                  onControlsChange({
                    ...controls,
                    simulateVisionInput: !controls.simulateVisionInput,
                  })
                }
                className={cn(
                  'w-full min-h-[44px] rounded-xl border px-3 py-2 text-left',
                  controls.simulateVisionInput
                    ? 'border-sky-400/60 bg-sky-500/10'
                    : 'border-white/10 bg-slate-900'
                )}
              >
                <p className="text-sm text-slate-100">Simulate vision when camera is blocked</p>
                <p className="text-xs text-slate-300/80 mt-0.5">
                  Keeps eye-tracking and remote-control demos running without HTTPS/camera permissions.
                </p>
              </button>
              <button
                type="button"
                onClick={() =>
                  onControlsChange({
                    ...controls,
                    simulateMapFallback: !controls.simulateMapFallback,
                  })
                }
                className={cn(
                  'w-full min-h-[44px] rounded-xl border px-3 py-2 text-left',
                  controls.simulateMapFallback
                    ? 'border-sky-400/60 bg-sky-500/10'
                    : 'border-white/10 bg-slate-900'
                )}
              >
                <p className="text-sm text-slate-100">Use iGO fallback when map token is missing</p>
                <p className="text-xs text-slate-300/80 mt-0.5">
                  Shows promotions in demo map mode instead of blocking on Mapbox.
                </p>
              </button>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2 text-xs text-slate-300/90 space-y-1">
              <p className="font-medium text-slate-200">Runtime diagnostics</p>
              <p>
                Camera runtime:{' '}
                {cameraIssue ? <span className="text-amber-300">{cameraIssue}</span> : <span className="text-emerald-300">Ready</span>}
              </p>
              <p>
                Supabase config:{' '}
                {supabaseConfigured ? <span className="text-emerald-300">Configured</span> : <span className="text-amber-300">Placeholder / missing</span>}
              </p>
              <p>
                Mapbox env token:{' '}
                {mapboxConfigured ? <span className="text-emerald-300">Present</span> : <span className="text-amber-300">Missing (using fallback)</span>}
              </p>
            </div>
          </section>

          <section>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400 mb-2 flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              Reward Simulation
            </p>
            <div className="space-y-2">
              {rewardModes.map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => onControlsChange({ ...controls, rewardMode: mode.id })}
                  className={cn(
                    'w-full min-h-[44px] rounded-xl border px-3 py-2 text-left',
                    controls.rewardMode === mode.id
                      ? 'border-sky-400/60 bg-sky-500/10'
                      : 'border-white/10 bg-slate-900'
                  )}
                >
                  <p className="text-sm text-slate-100">{mode.label}</p>
                  <p className="text-xs text-slate-300/80 mt-0.5">{mode.description}</p>
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400 mb-2 flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              Checkout Outcome
            </p>
            <div className="space-y-2">
              {checkoutOutcomes.map((outcome) => (
                <button
                  key={outcome.id}
                  type="button"
                  onClick={() => onControlsChange({ ...controls, checkoutOutcome: outcome.id })}
                  className={cn(
                    'w-full min-h-[44px] rounded-xl border px-3 py-2 text-left',
                    controls.checkoutOutcome === outcome.id
                      ? 'border-sky-400/60 bg-sky-500/10'
                      : 'border-white/10 bg-slate-900'
                  )}
                >
                  <p className="text-sm text-slate-100">{outcome.label}</p>
                  <p className="text-xs text-slate-300/80 mt-0.5">{outcome.description}</p>
                </button>
              ))}
            </div>
          </section>

          {onRestartDemo && (
            <section>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    onRestartDemo();
                    onClose();
                  }}
                  className="w-full min-h-[44px] rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 flex items-center justify-center gap-2 text-amber-300 text-sm font-medium hover:bg-amber-500/20 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Restart Demo
                </button>
                {onResetLayout && (
                  <button
                    type="button"
                    onClick={() => {
                      onResetLayout();
                    }}
                    className="w-full min-h-[44px] rounded-xl border border-slate-500/40 bg-slate-500/10 px-3 py-2 flex items-center justify-center gap-2 text-slate-200 text-sm font-medium hover:bg-slate-500/20 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reset Layout
                  </button>
                )}
              </div>
            </section>
          )}

          <section>
            <p className="text-xs uppercase tracking-[0.16em] text-slate-400 mb-2 flex items-center gap-2">
              <TimerReset className="w-3.5 h-3.5" />
              Verification Delay
            </p>
            <div className="grid grid-cols-3 gap-2">
              {verificationDelayOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onControlsChange({ ...controls, verificationDelayMs: option.value })}
                  className={cn(
                    'min-h-[44px] rounded-xl border px-2 py-2 text-sm',
                    controls.verificationDelayMs === option.value
                      ? 'border-sky-400/60 bg-sky-500/10 text-sky-100'
                      : 'border-white/10 bg-slate-900 text-slate-200'
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
};
