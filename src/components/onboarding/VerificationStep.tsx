// Verification Status Step Component
import React, { useEffect, useRef } from 'react';
import { Clock, CheckCircle2, XCircle, RefreshCw, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocalization } from '@/contexts/LocalizationContext';
import { useAccessibility } from '@/contexts/AccessibilityContext';
import { cn } from '@/lib/utils';

interface VerificationStepProps {
  status: string;
  rejectionReason?: string | null;
  onComplete: () => void;
  onRetry?: () => void;
  /** Called once when status becomes approved/verified (e.g. trigger confetti) */
  onVerified?: () => void;
}

const statusKeys: Record<string, { titleKey: string; descKey: string }> = {
  pending: { titleKey: 'onboarding.verification.awaitingTitle', descKey: 'onboarding.verification.awaitingDesc' },
  submitted: { titleKey: 'onboarding.verification.underReviewTitle', descKey: 'onboarding.verification.underReviewDesc' },
  under_review: { titleKey: 'onboarding.verification.beingReviewedTitle', descKey: 'onboarding.verification.beingReviewedDesc' },
  approved: { titleKey: 'onboarding.verification.approvedTitle', descKey: 'onboarding.verification.approvedDesc' },
  rejected: { titleKey: 'onboarding.verification.rejectedTitle', descKey: 'onboarding.verification.rejectedDesc' },
  verified: { titleKey: 'onboarding.verification.approvedTitle', descKey: 'onboarding.verification.approvedDesc' },
};

const statusIcons: Record<string, { icon: React.ReactNode; color: string; bgColor: string }> = {
  pending: { icon: <Clock className="w-12 h-12" />, color: 'text-muted-foreground', bgColor: 'bg-muted' },
  submitted: { icon: <RefreshCw className="w-12 h-12 animate-spin" />, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  under_review: { icon: <RefreshCw className="w-12 h-12 animate-spin" />, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  approved: { icon: <CheckCircle2 className="w-12 h-12" />, color: 'text-green-500', bgColor: 'bg-green-500/10' },
  rejected: { icon: <XCircle className="w-12 h-12" />, color: 'text-destructive', bgColor: 'bg-destructive/10' },
  verified: { icon: <CheckCircle2 className="w-12 h-12" />, color: 'text-green-500', bgColor: 'bg-green-500/10' },
};

const benefitKeys = [
  'onboarding.verification.benefit1',
  'onboarding.verification.benefit2',
  'onboarding.verification.benefit3',
  'onboarding.verification.benefit4',
  'onboarding.verification.benefit5',
] as const;

export const VerificationStep: React.FC<VerificationStepProps> = ({
  status,
  rejectionReason,
  onComplete,
  onRetry,
  onVerified,
}) => {
  const { t } = useLocalization();
  const { reducedMotion } = useAccessibility();
  const verifiedFired = useRef(false);

  const keys = statusKeys[status] || statusKeys.pending;
  const icons = statusIcons[status] || statusIcons.pending;
  const title = t(keys.titleKey as 'onboarding.verification.awaitingTitle');
  const description = t(keys.descKey as 'onboarding.verification.awaitingDesc');

  useEffect(() => {
    if ((status === 'approved' || status === 'verified') && onVerified && !verifiedFired.current) {
      verifiedFired.current = true;
      onVerified();
    }
  }, [status, onVerified]);

  return (
    <div className="flex flex-col items-center justify-center min-h-full text-center">
      <div className={cn(
        'w-24 h-24 rounded-full flex items-center justify-center mb-6',
        icons.bgColor
      )}>
        <span className={icons.color}>{icons.icon}</span>
      </div>

      <h2 className="text-2xl font-bold mb-2">{title}</h2>
      <p className="text-muted-foreground max-w-xs mb-8">
        {description}
      </p>

      {status === 'rejected' && rejectionReason && (
        <div className="w-full max-w-sm mb-6">
          <div className="neu-card rounded-2xl p-4 border border-destructive/20">
            <h4 className="font-semibold mb-2 text-destructive">{t('onboarding.verification.reason' as 'onboarding.verification.reason')}</h4>
            <p className="text-sm text-muted-foreground">{rejectionReason}</p>
          </div>
        </div>
      )}

      {(status === 'approved' || status === 'verified') && (
        <div className="w-full max-w-sm mb-8">
          <div className="neu-card rounded-2xl p-4">
            <h4 className="font-semibold mb-3 text-left">{t('onboarding.verification.whatYouUnlocked' as 'onboarding.verification.whatYouUnlocked')}</h4>
            <ul className="space-y-2">
              {benefitKeys.map((key, index) => (
                <li key={index} className="flex items-center gap-3 text-left">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className="text-sm">{t(key)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {(status === 'submitted' || status === 'under_review') && (
        <div className="w-full max-w-sm mb-8">
          <div className="neu-card rounded-2xl p-4">
            <h4 className="font-semibold mb-3 text-left">{t('onboarding.verification.timelineTitle' as 'onboarding.verification.timelineTitle')}</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">✓</div>
                <span className="text-sm">{t('onboarding.verification.timeline1' as 'onboarding.verification.timeline1')}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                  status === 'under_review' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                )}>
                  {status === 'under_review' ? '✓' : '2'}
                </div>
                <span className="text-sm">{t('onboarding.verification.timeline2' as 'onboarding.verification.timeline2')}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm font-medium">3</div>
                <span className="text-sm text-muted-foreground">{t('onboarding.verification.timeline3' as 'onboarding.verification.timeline3')}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-sm space-y-3">
        <Button
          onClick={onComplete}
          className="w-full h-14 text-lg font-semibold rounded-2xl"
          size="lg"
        >
          {(status === 'approved' || status === 'verified') ? t('onboarding.verification.done' as 'onboarding.verification.done') : t('onboarding.verification.continueToApp' as 'onboarding.verification.continueToApp')}
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>

        {status === 'rejected' && onRetry && (
          <Button variant="outline" className="w-full h-12 rounded-2xl" onClick={onRetry}>
            <RefreshCw className="w-5 h-5 mr-2" />
            {t('onboarding.verification.tryAgain' as 'onboarding.verification.tryAgain')}
          </Button>
        )}
      </div>
    </div>
  );
};
