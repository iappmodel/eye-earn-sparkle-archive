// Verification Status Step Component
import React from 'react';
import { Clock, CheckCircle2, XCircle, RefreshCw, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VerificationStepProps {
  status: string;
  onComplete: () => void;
}

const statusConfig: Record<string, {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
  bgColor: string;
}> = {
  pending: {
    icon: <Clock className="w-12 h-12" />,
    title: 'Awaiting Documents',
    description: 'Please complete the previous steps to submit your verification.',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted',
  },
  submitted: {
    icon: <RefreshCw className="w-12 h-12 animate-spin" />,
    title: 'Under Review',
    description: 'Your documents have been submitted. We\'ll verify them within 24-48 hours.',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  under_review: {
    icon: <RefreshCw className="w-12 h-12 animate-spin" />,
    title: 'Being Reviewed',
    description: 'Our team is reviewing your documents. This usually takes a few hours.',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
  },
  approved: {
    icon: <CheckCircle2 className="w-12 h-12" />,
    title: 'Verified!',
    description: 'Congratulations! Your account is now fully verified. Enjoy all premium features!',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
  },
  rejected: {
    icon: <XCircle className="w-12 h-12" />,
    title: 'Verification Failed',
    description: 'We couldn\'t verify your documents. Please try again with clearer photos.',
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
  },
};

export const VerificationStep: React.FC<VerificationStepProps> = ({
  status,
  onComplete,
}) => {
  const config = statusConfig[status] || statusConfig.pending;

  const benefits = [
    'Earn up to 5x more rewards',
    'Priority payout processing',
    'Access exclusive campaigns',
    'Create and monetize content',
    'Verified badge on profile',
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-full text-center">
      {/* Status Icon */}
      <div className={cn(
        'w-24 h-24 rounded-full flex items-center justify-center mb-6',
        config.bgColor
      )}>
        <span className={config.color}>{config.icon}</span>
      </div>

      {/* Status Text */}
      <h2 className="text-2xl font-bold mb-2">{config.title}</h2>
      <p className="text-muted-foreground max-w-xs mb-8">
        {config.description}
      </p>

      {/* What you get */}
      {status === 'approved' && (
        <div className="w-full max-w-sm mb-8">
          <div className="neu-card rounded-2xl p-4">
            <h4 className="font-semibold mb-3 text-left">What you unlocked:</h4>
            <ul className="space-y-2">
              {benefits.map((benefit, index) => (
                <li key={index} className="flex items-center gap-3 text-left">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className="text-sm">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Timeline for pending states */}
      {(status === 'submitted' || status === 'under_review') && (
        <div className="w-full max-w-sm mb-8">
          <div className="neu-card rounded-2xl p-4">
            <h4 className="font-semibold mb-3 text-left">Verification timeline:</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                  ✓
                </div>
                <span className="text-sm">Documents received</span>
              </div>
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                  status === 'under_review' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                )}>
                  {status === 'under_review' ? '✓' : '2'}
                </div>
                <span className="text-sm">Manual review</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm font-medium">
                  3
                </div>
                <span className="text-sm text-muted-foreground">Verification complete</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="w-full max-w-sm space-y-3">
        <Button
          onClick={onComplete}
          className="w-full h-14 text-lg font-semibold rounded-2xl"
          size="lg"
        >
          {status === 'approved' ? 'Start Exploring' : 'Continue to App'}
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>

        {status === 'rejected' && (
          <Button
            variant="outline"
            className="w-full h-12 rounded-2xl"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="w-5 h-5 mr-2" />
            Try Again
          </Button>
        )}
      </div>
    </div>
  );
};
