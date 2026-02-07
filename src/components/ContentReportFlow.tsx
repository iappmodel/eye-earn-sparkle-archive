import React, { useState } from 'react';
import { SwipeDismissOverlay } from './SwipeDismissOverlay';
import { 
  X, Flag, AlertTriangle, MessageSquare, User, 
  Image, Video, Loader2, CheckCircle2, ChevronRight
} from 'lucide-react';
import { NeuButton } from './NeuButton';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ContentReportFlowProps {
  isOpen: boolean;
  onClose: () => void;
  contentId?: string;
  contentType?: 'video' | 'image' | 'comment' | 'profile';
}

type ReportReason = 
  | 'spam'
  | 'harassment'
  | 'hate_speech'
  | 'violence'
  | 'nudity'
  | 'misinformation'
  | 'copyright'
  | 'other';

interface ReasonOption {
  id: ReportReason;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const reportReasons: ReasonOption[] = [
  {
    id: 'spam',
    label: 'Spam',
    description: 'Misleading or repetitive content',
    icon: <MessageSquare className="w-5 h-5" />,
  },
  {
    id: 'harassment',
    label: 'Harassment or Bullying',
    description: 'Targeting someone with harmful content',
    icon: <User className="w-5 h-5" />,
  },
  {
    id: 'hate_speech',
    label: 'Hate Speech',
    description: 'Promoting violence or hatred',
    icon: <AlertTriangle className="w-5 h-5" />,
  },
  {
    id: 'violence',
    label: 'Violence or Threats',
    description: 'Graphic violence or threatening behavior',
    icon: <AlertTriangle className="w-5 h-5" />,
  },
  {
    id: 'nudity',
    label: 'Nudity or Sexual Content',
    description: 'Inappropriate sexual content',
    icon: <Image className="w-5 h-5" />,
  },
  {
    id: 'misinformation',
    label: 'Misinformation',
    description: 'False or misleading information',
    icon: <AlertTriangle className="w-5 h-5" />,
  },
  {
    id: 'copyright',
    label: 'Copyright Violation',
    description: 'Using content without permission',
    icon: <Video className="w-5 h-5" />,
  },
  {
    id: 'other',
    label: 'Other',
    description: 'Something else not listed here',
    icon: <Flag className="w-5 h-5" />,
  },
];

export const ContentReportFlow: React.FC<ContentReportFlowProps> = ({
  isOpen,
  onClose,
  contentId = 'unknown',
  contentType = 'video',
}) => {
  const { user } = useAuth();
  const [step, setStep] = useState<'reason' | 'details' | 'complete'>('reason');
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [additionalDetails, setAdditionalDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSelectReason = (reason: ReportReason) => {
    setSelectedReason(reason);
    setStep('details');
  };

  const handleSubmit = async () => {
    if (!user || !selectedReason) return;
    
    setIsSubmitting(true);
    
    try {
      const { error } = await supabase
        .from('content_flags')
        .insert({
          content_id: contentId,
          content_type: contentType,
          flagged_by: user.id,
          reason: selectedReason,
          description: additionalDetails || null,
          status: 'pending',
        });

      if (error) throw error;
      
      setStep('complete');
      toast.success('Report submitted successfully');
    } catch (error: any) {
      console.error('Error submitting report:', error);
      toast.error('Failed to submit report');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep('reason');
    setSelectedReason(null);
    setAdditionalDetails('');
    onClose();
  };

  const renderReasonStep = () => (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="font-display text-lg font-bold text-foreground mb-2">
          Why are you reporting this?
        </h3>
        <p className="text-sm text-muted-foreground">
          Select the reason that best describes the issue
        </p>
      </div>

      <div className="space-y-2">
        {reportReasons.map((reason) => (
          <button
            key={reason.id}
            onClick={() => handleSelectReason(reason.id)}
            className={cn(
              "w-full flex items-center gap-3 p-4 rounded-xl border transition-all text-left",
              "border-border/50 bg-card/50 hover:border-primary/50 hover:bg-card"
            )}
          >
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
              {reason.icon}
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">{reason.label}</p>
              <p className="text-sm text-muted-foreground">{reason.description}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );

  const renderDetailsStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="font-display text-lg font-bold text-foreground mb-2">
          Additional Details
        </h3>
        <p className="text-sm text-muted-foreground">
          Help us understand the issue better (optional)
        </p>
      </div>

      <div className="p-4 rounded-xl bg-muted/50">
        <div className="flex items-center gap-3 mb-2">
          {reportReasons.find(r => r.id === selectedReason)?.icon}
          <span className="font-medium text-foreground">
            {reportReasons.find(r => r.id === selectedReason)?.label}
          </span>
        </div>
      </div>

      <Textarea
        placeholder="Provide any additional context that might help us review this report..."
        value={additionalDetails}
        onChange={(e) => setAdditionalDetails(e.target.value)}
        className="min-h-[120px] resize-none"
      />

      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => setStep('reason')}
        >
          Back
        </Button>
        <Button
          className="flex-1"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Flag className="w-4 h-4 mr-2" />
          )}
          Submit Report
        </Button>
      </div>
    </div>
  );

  const renderCompleteStep = () => (
    <div className="space-y-6">
      <div className="flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-10 h-10 text-green-500" />
        </div>
        <h3 className="font-display text-xl font-bold text-foreground mb-2">
          Report Submitted
        </h3>
        <p className="text-sm text-muted-foreground">
          Thank you for helping keep our community safe. We'll review your report and take appropriate action.
        </p>
      </div>

      <div className="p-4 rounded-xl bg-muted/50">
        <h4 className="font-medium text-foreground mb-2">What happens next?</h4>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            Our team will review the reported content
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            We may remove content that violates our guidelines
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            We may take action against repeat offenders
          </li>
        </ul>
      </div>

      <Button
        className="w-full"
        onClick={handleClose}
      >
        Done
      </Button>
    </div>
  );

  return (
    <SwipeDismissOverlay isOpen={isOpen} onClose={handleClose}>
      <div className="max-w-md mx-auto h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <Flag className="w-5 h-5 text-destructive" />
            <h1 className="font-display text-lg font-bold">Report Content</h1>
          </div>
          <NeuButton onClick={handleClose} size="sm">
            <X className="w-5 h-5" />
          </NeuButton>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'reason' && renderReasonStep()}
          {step === 'details' && renderDetailsStep()}
          {step === 'complete' && renderCompleteStep()}
        </div>

        {/* Step Indicator */}
        {step !== 'complete' && (
          <div className="p-4 border-t border-border/50">
            <div className="flex justify-center gap-2">
              {['reason', 'details'].map((s) => (
                <div
                  key={s}
                  className={cn(
                    "w-2 h-2 rounded-full transition-colors",
                    step === s ? "bg-primary" : "bg-muted"
                  )}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </SwipeDismissOverlay>
  );
};
