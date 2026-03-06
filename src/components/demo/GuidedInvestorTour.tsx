import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Sparkles, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DemoScenarioId } from './DemoScenarioSelector';

export type GuidedTourAction =
  | { type: 'simulate_reward' }
  | { type: 'open_wallet_overview' }
  | { type: 'open_wallet_payout' }
  | { type: 'open_wallet_checkout'; scenarioId: string };

interface GuidedTourStep {
  id: string;
  title: string;
  description: string;
  autoAdvanceMs?: number;
  target: {
    top: string;
    left: string;
    width: string;
    height: string;
    borderRadius?: string;
  };
  action?: GuidedTourAction;
}

interface GuidedInvestorTourProps {
  isOpen: boolean;
  scenarioId: DemoScenarioId | null;
  onClose: () => void;
  onAction: (action: GuidedTourAction) => void;
}

function getScenarioSteps(scenarioId: DemoScenarioId | null): GuidedTourStep[] {
  if (scenarioId === 'us-earner') {
    return [
      {
        id: 'us-reward',
        title: 'Step 1: Promo Reward',
        description: 'Watch promo or simulate reward. This demonstrates media-to-wallet value transfer.',
        target: { top: '4%', left: '74%', width: '22%', height: '9%', borderRadius: '16px' },
        action: { type: 'simulate_reward' },
      },
      {
        id: 'us-wallet',
        title: 'Step 2: Wallet Dashboard',
        description: 'Open wallet to show balances, pending logic, and transaction controls.',
        target: { top: '18%', left: '2%', width: '20%', height: '13%', borderRadius: '18px' },
        action: { type: 'open_wallet_overview' },
      },
      {
        id: 'us-convert',
        title: 'Step 3: Convert Flow',
        description: 'Highlight convert section (Vicoins <-> Icoins) for cross-currency checkout readiness.',
        target: { top: '50%', left: '6%', width: '88%', height: '26%', borderRadius: '24px' },
      },
      {
        id: 'us-withdraw',
        title: 'Step 4: Withdraw Flow',
        description: 'Switch to payout tab for the withdraw path.',
        target: { top: '20%', left: '60%', width: '34%', height: '10%', borderRadius: '16px' },
        action: { type: 'open_wallet_payout' },
      },
      {
        id: 'us-receipt',
        title: 'Step 5: Checkout Receipt Timeline',
        description: 'Open checkout to show status timeline controlled by Demo Controls outcome.',
        target: { top: '30%', left: '6%', width: '88%', height: '44%', borderRadius: '24px' },
        action: { type: 'open_wallet_checkout', scenarioId: 'online-retail-link' },
      },
    ];
  }

  if (scenarioId === 'brazil-shopper') {
    return [
      {
        id: 'br-reward',
        title: 'Step 1: Promo Reward',
        description: 'Start with reward proof before payments.',
        target: { top: '4%', left: '74%', width: '22%', height: '9%', borderRadius: '16px' },
        action: { type: 'simulate_reward' },
      },
      {
        id: 'br-wallet',
        title: 'Step 2: Wallet Overview',
        description: 'Open wallet in BR locale and show balances.',
        target: { top: '18%', left: '2%', width: '20%', height: '13%', borderRadius: '18px' },
        action: { type: 'open_wallet_overview' },
      },
      {
        id: 'br-pay',
        title: 'Step 3: Pay Checkout',
        description: 'Launch pay checkout flow (Pix-like scenario) and proceed to receipt.',
        target: { top: '32%', left: '6%', width: '88%', height: '30%', borderRadius: '24px' },
        action: { type: 'open_wallet_checkout', scenarioId: 'request-restaurant-link' },
      },
      {
        id: 'br-timeline',
        title: 'Step 4: Receipt Status Timeline',
        description: 'Show Pending / Completed / Reversed behavior from Demo Controls.',
        target: { top: '34%', left: '6%', width: '88%', height: '44%', borderRadius: '24px' },
      },
    ];
  }

  return [
    {
      id: 'wx-overview',
      title: 'Step 1: Wallet Proof',
      description: 'Start from wallet dashboard.',
      target: { top: '18%', left: '2%', width: '20%', height: '13%', borderRadius: '18px' },
      action: { type: 'open_wallet_overview' },
    },
    {
      id: 'wx-checkout',
      title: 'Step 2: Checkout Flow',
      description: 'Open checkout demo and move through amount -> review -> confirm -> receipt.',
      target: { top: '32%', left: '6%', width: '88%', height: '30%', borderRadius: '24px' },
      action: { type: 'open_wallet_checkout', scenarioId: 'qr-dynamic-cafe' },
    },
    {
      id: 'wx-status',
      title: 'Step 3: Status Outcome',
      description: 'Use Demo Controls to switch receipt timelines between Completed, Pending, and Reversed.',
      target: { top: '34%', left: '6%', width: '88%', height: '44%', borderRadius: '24px' },
    },
    {
      id: 'wx-withdraw',
      title: 'Step 4: Payout Path',
      description: 'Switch to payout tab and show withdraw requirements/history.',
      target: { top: '20%', left: '60%', width: '34%', height: '10%', borderRadius: '16px' },
      action: { type: 'open_wallet_payout' },
    },
  ];
}

export const GuidedInvestorTour: React.FC<GuidedInvestorTourProps> = ({
  isOpen,
  scenarioId,
  onClose,
  onAction,
}) => {
  const steps = useMemo(() => getScenarioSteps(scenarioId), [scenarioId]);
  const [stepIndex, setStepIndex] = useState(0);
  const executed = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isOpen) return;
    setStepIndex(0);
    executed.current.clear();
  }, [isOpen, scenarioId]);

  useEffect(() => {
    if (!isOpen) return;
    const step = steps[stepIndex];
    if (!step || !step.action) return;
    if (executed.current.has(step.id)) return;
    executed.current.add(step.id);
    onAction(step.action);
  }, [isOpen, onAction, stepIndex, steps]);

  useEffect(() => {
    if (!isOpen) return;
    const step = steps[stepIndex];
    if (!step) return;
    if (stepIndex >= steps.length - 1) return;
    const delayMs = step.autoAdvanceMs ?? 2800;
    const timer = window.setTimeout(() => {
      setStepIndex((prev) => Math.min(steps.length - 1, prev + 1));
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [isOpen, stepIndex, steps]);

  if (!isOpen || steps.length === 0) return null;

  const step = steps[stepIndex];

  return (
    <>
      <div className="fixed inset-0 z-[140] bg-black/30 pointer-events-none" />
      <div className="fixed inset-0 z-[141] pointer-events-none">
        <div
          className={cn(
            'absolute border-2 border-sky-300 shadow-[0_0_0_9999px_rgba(2,6,23,0.45)]',
            'animate-pulse'
          )}
          style={{
            top: step.target.top,
            left: step.target.left,
            width: step.target.width,
            height: step.target.height,
            borderRadius: step.target.borderRadius ?? '16px',
          }}
        />
      </div>

      <section className="fixed z-[142] left-1/2 -translate-x-1/2 bottom-3 w-[min(92vw,640px)] rounded-2xl border border-white/10 bg-slate-950/95 backdrop-blur-md p-4 pointer-events-auto">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.15em] text-sky-300/90 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Guided Investor Tour
            </p>
            <h3 className="text-base sm:text-lg font-semibold text-slate-100 mt-1">{step.title}</h3>
            <p className="text-sm text-slate-300/90 mt-1">{step.description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg border border-white/10 bg-slate-900 text-slate-200 flex items-center justify-center"
            aria-label="Close guided tour"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            Step {stepIndex + 1} of {steps.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStepIndex((prev) => Math.max(0, prev - 1))}
              disabled={stepIndex === 0}
              className="min-h-[44px] px-3 rounded-xl border border-white/15 text-slate-100 text-sm disabled:opacity-40 flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <button
              type="button"
              onClick={() => {
                if (stepIndex >= steps.length - 1) {
                  onClose();
                  return;
                }
                setStepIndex((prev) => Math.min(steps.length - 1, prev + 1));
              }}
              className="min-h-[44px] px-3 rounded-xl border border-sky-400/50 bg-sky-500/15 text-sky-100 text-sm flex items-center gap-1.5"
            >
              {stepIndex >= steps.length - 1 ? 'Finish' : 'Next'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
    </>
  );
};
