import React from 'react';
import { ArrowLeft, ChevronRight, Settings2, Wallet, Globe, Play, Landmark } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DemoScenarioId = 'us-earner' | 'brazil-shopper' | 'wallet-explorer';

interface ScenarioCard {
  id: DemoScenarioId;
  title: string;
  subtitle: string;
  region: 'US' | 'BRAZIL';
  flow: string;
}

const SCENARIOS: ScenarioCard[] = [
  {
    id: 'us-earner',
    title: 'US Earner',
    subtitle: 'Promo -> Earn -> Convert -> Withdraw',
    region: 'US',
    flow: 'Withdraw-focused flow',
  },
  {
    id: 'brazil-shopper',
    title: 'Brazil Shopper',
    subtitle: 'Promo -> Earn -> Pay (Pix)',
    region: 'BRAZIL',
    flow: 'Pix payment flow',
  },
  {
    id: 'wallet-explorer',
    title: 'Wallet Explorer',
    subtitle: 'Dashboard + statuses + checkout states',
    region: 'US / BRAZIL',
    flow: 'Wallet trust walkthrough',
  },
];

interface DemoScenarioSelectorProps {
  isOpen: boolean;
  onStartScenario: (scenarioId: DemoScenarioId) => void;
  onOpenDemoControls: () => void;
  /** Optional: go back to Hero Entry */
  onBack?: () => void;
}

export const DemoScenarioSelector: React.FC<DemoScenarioSelectorProps> = ({
  isOpen,
  onStartScenario,
  onOpenDemoControls,
  onBack,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
      <section className="w-full max-w-4xl rounded-3xl border border-white/10 bg-slate-950/90 p-5 sm:p-7 shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div className="flex items-start gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="min-h-[44px] min-w-[44px] rounded-xl border border-white/10 bg-slate-900/80 flex items-center justify-center text-slate-200 hover:bg-slate-800/80 transition-colors"
                aria-label="Back to demo entry"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <p className="text-xs tracking-[0.2em] uppercase text-sky-300/90">Demo Mode</p>
            <h2 className="text-2xl sm:text-3xl font-semibold text-slate-100 mt-1">Investor Scenario Selector</h2>
            <p className="text-sm text-slate-300/80 mt-1">
              High-fidelity prototype. Real camera/map mode is supported when HTTPS + envs are configured.
            </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenDemoControls}
            className={cn(
              'min-h-[44px] px-4 rounded-xl border border-white/15 bg-slate-900/80',
              'text-slate-100 text-sm font-medium flex items-center gap-2',
              'hover:bg-slate-800/80 transition-colors'
            )}
          >
            <Settings2 className="w-4 h-4" />
            Demo Controls
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {SCENARIOS.map((scenario) => (
            <button
              key={scenario.id}
              type="button"
              onClick={() => onStartScenario(scenario.id)}
              className={cn(
                'group min-h-[44px] text-left rounded-2xl border border-white/10',
                'bg-gradient-to-b from-slate-900 to-slate-950 p-4',
                'hover:border-sky-400/40 hover:shadow-[0_10px_28px_rgba(56,189,248,0.15)] transition-all'
              )}
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 px-2 py-1 text-[11px] text-slate-200/80">
                  <Globe className="w-3 h-3" />
                  {scenario.region}
                </span>
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-sky-300 transition-colors" />
              </div>

              <h3 className="text-lg font-semibold text-slate-100 mt-3">{scenario.title}</h3>
              <p className="text-sm text-slate-300 mt-1">{scenario.subtitle}</p>

              <div className="mt-4 flex items-center gap-2 text-xs text-slate-300/80">
                {scenario.id === 'wallet-explorer' ? <Wallet className="w-3.5 h-3.5" /> : <Landmark className="w-3.5 h-3.5" />}
                <span>{scenario.flow}</span>
              </div>
              <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-sky-300/90">
                <Play className="w-3.5 h-3.5" />
                Start scenario
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
