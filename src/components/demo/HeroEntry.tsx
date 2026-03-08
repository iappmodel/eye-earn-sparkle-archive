import React, { useState, useCallback, useRef } from 'react';
import iLogo from '@/assets/i-logo.png';
import { cn } from '@/lib/utils';

interface HeroEntryProps {
  onEnterDemo: () => void;
  onInvestorWalkthrough: () => void;
  onOpenPresenterPanel?: () => void;
}

const LOGO_TAP_COUNT = 5;
const LOGO_TAP_RESET_MS = 2000;

export const HeroEntry: React.FC<HeroEntryProps> = ({
  onEnterDemo,
  onInvestorWalkthrough,
  onOpenPresenterPanel,
}) => {
  const [logoTapCount, setLogoTapCount] = useState(0);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLogoTap = useCallback(() => {
    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);

    const next = logoTapCount + 1;
    setLogoTapCount(next);

    if (next >= LOGO_TAP_COUNT && onOpenPresenterPanel) {
      setLogoTapCount(0);
      onOpenPresenterPanel();
    } else {
      tapTimeoutRef.current = setTimeout(() => setLogoTapCount(0), LOGO_TAP_RESET_MS);
    }
  }, [logoTapCount, onOpenPresenterPanel]);

  return (
    <div className="fixed inset-0 z-[110] flex flex-col items-center justify-between bg-[#0A0A0F] text-center safe-area-inset">
      {/* Top safe area */}
      <div className="flex-1 min-h-[env(safe-area-inset-top)]" />

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 w-full max-w-[88%]">
        {/* Logo with optional halo */}
        <button
          type="button"
          onClick={handleLogoTap}
          className="relative flex items-center justify-center mb-6 min-w-[44px] min-h-[44px] touch-manipulation"
          aria-label="App logo"
        >
          <div
            className="absolute w-28 h-28 rounded-full opacity-60"
            style={{
              background: 'radial-gradient(circle, hsl(270 95% 65% / 0.35) 0%, hsl(320 90% 60% / 0.2) 50%, transparent 70%)',
            }}
          />
          <img
            src={iLogo}
            alt=""
            className="relative w-16 h-16 object-contain"
          />
        </button>

        {/* Headline - 2 lines max */}
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-100 leading-tight max-w-[85%] mb-4">
          Verified attention becomes usable value
        </h1>

        {/* Subheadline - 2-3 lines */}
        <p className="text-base text-slate-400/90 max-w-[88%] mb-8 leading-relaxed">
          A new media and rewards platform built for immersive viewing and instant financial utility.
        </p>

        {/* CTA zone */}
        <div className="w-full max-w-[calc(100%-48px)] flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={onEnterDemo}
            className={cn(
              'w-full min-h-[52px] px-6 rounded-2xl font-semibold',
              'bg-gradient-to-b from-sky-500 to-sky-600 text-white',
              'shadow-lg shadow-sky-500/25 hover:from-sky-400 hover:to-sky-500',
              'transition-all active:scale-[0.98]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0F]'
            )}
          >
            Enter Demo
          </button>

          <button
            type="button"
            onClick={onInvestorWalkthrough}
            className="text-sm text-sky-400 hover:text-sky-300 underline underline-offset-2 transition-colors min-h-[44px] flex items-center justify-center"
          >
            Investor Walkthrough
          </button>
        </div>
      </div>

      {/* Footer - Demo Mode badge */}
      <div className="pb-6 pt-4">
        <span className="text-xs text-slate-500 tracking-wider uppercase">
          Demo Mode
        </span>
      </div>

      {/* Bottom safe area */}
      <div className="min-h-[env(safe-area-inset-bottom)]" />
    </div>
  );
};
