// Product tour slides: Welcome → Discover → Create → Get Verified
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Sparkles, Compass, Camera, Shield, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocalization } from '@/contexts/LocalizationContext';
import { useAccessibility } from '@/contexts/AccessibilityContext';
import { cn } from '@/lib/utils';

const SLIDE_KEYS = ['welcome', 'discover', 'create', 'verify'] as const;

interface OnboardingProductTourProps {
  onGetStarted: () => void;
  onSkip: () => void;
  onClose: () => void;
}

export const OnboardingProductTour: React.FC<OnboardingProductTourProps> = ({
  onGetStarted,
  onSkip,
  onClose,
}) => {
  const { t } = useLocalization();
  const { reducedMotion } = useAccessibility();
  const [index, setIndex] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const minSwipeDistance = 50;
  const onSwipeLeft = useCallback(() => {
    setIndex((i) => Math.min(SLIDE_KEYS.length - 1, i + 1));
  }, []);
  const onSwipeRight = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const onTouchStart = (e: React.TouchEvent) => setTouchStart(e.targetTouches[0].clientX);
  const onTouchMove = (e: React.TouchEvent) => setTouchEnd(e.targetTouches[0].clientX);
  const onTouchEnd = () => {
    if (touchStart == null || touchEnd == null) return;
    const diff = touchStart - touchEnd;
    if (Math.abs(diff) > minSwipeDistance) {
      if (diff > 0) onSwipeLeft();
      else onSwipeRight();
    }
    setTouchStart(null);
    setTouchEnd(null);
  };

  const goNext = () => {
    if (index >= SLIDE_KEYS.length - 1) {
      onGetStarted();
    } else {
      setIndex((i) => i + 1);
    }
  };

  const isLast = index === SLIDE_KEYS.length - 1;

  const slides: { key: typeof SLIDE_KEYS[number]; icon: React.ReactNode; titleKey: string; descKey: string }[] = [
    {
      key: 'welcome',
      icon: <Sparkles className="w-14 h-14 text-primary" />,
      titleKey: 'onboarding.tour.welcomeTitle',
      descKey: 'onboarding.tour.welcomeDesc',
    },
    {
      key: 'discover',
      icon: <Compass className="w-14 h-14 text-amber-500" />,
      titleKey: 'onboarding.tour.discoverTitle',
      descKey: 'onboarding.tour.discoverDesc',
    },
    {
      key: 'create',
      icon: <Camera className="w-14 h-14 text-violet-500" />,
      titleKey: 'onboarding.tour.createTitle',
      descKey: 'onboarding.tour.createDesc',
    },
    {
      key: 'verify',
      icon: <Shield className="w-14 h-14 text-green-500" />,
      titleKey: 'onboarding.tour.verifyTitle',
      descKey: 'onboarding.tour.verifyDesc',
    },
  ];

  const slide = slides[index];
  const title = slide ? t(slide.titleKey as 'onboarding.tour.welcomeTitle') : '';
  const desc = slide ? t(slide.descKey as 'onboarding.tour.welcomeDesc') : '';

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col" role="dialog" aria-label="Product tour">
      {/* Header: dots + close */}
      <div className="flex items-center justify-between p-4 shrink-0">
        <div className="flex items-center gap-2" role="tablist" aria-label="Tour steps">
          {SLIDE_KEYS.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Step ${i + 1}`}
              onClick={() => setIndex(i)}
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                i === index ? 'w-8 bg-primary' : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
              )}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
          aria-label="Close tour"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Slide content */}
      <div
        ref={containerRef}
        className="flex-1 flex flex-col items-center justify-center px-6 overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="w-full max-w-sm flex flex-col items-center text-center"
          style={!reducedMotion ? { animation: 'fadeIn 0.35s ease-out' } : undefined}
        >
          <div className="w-24 h-24 rounded-2xl bg-muted/50 flex items-center justify-center mb-8">
            {slide?.icon}
          </div>
          <h2 className="text-2xl font-bold mb-3">{title}</h2>
          <p className="text-muted-foreground text-lg leading-relaxed">{desc}</p>
        </div>
      </div>

      {/* Footer: Skip + Next / Get Started */}
      <div className="p-6 pt-4 shrink-0 space-y-3">
        <Button
          onClick={goNext}
          className="w-full h-14 text-lg font-semibold rounded-2xl"
          size="lg"
        >
          {isLast ? t('onboarding.tour.getStarted' as 'onboarding.tour.getStarted') : t('onboarding.tour.next' as 'onboarding.tour.next')}
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
        <button
          type="button"
          onClick={onSkip}
          className="w-full text-muted-foreground hover:text-foreground transition-colors py-2 text-sm"
        >
          {t('onboarding.tour.skip' as 'onboarding.tour.skip')}
        </button>
      </div>

      {!reducedMotion && (
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      )}
    </div>
  );
};
