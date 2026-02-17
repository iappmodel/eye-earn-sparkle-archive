/**
 * Flow for reporting a user (profile). Submits to user_reports.
 */
import React, { useState } from 'react';
import {
  X, Flag, AlertTriangle, MessageSquare, User, Loader2, CheckCircle2, ChevronRight,
} from 'lucide-react';
import { NeuButton } from './NeuButton';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { severityFromReason } from '@/services/moderation.service';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface UserReportFlowProps {
  isOpen: boolean;
  onClose: () => void;
  reportedUserId: string;
  reportedUsername?: string | null;
  /** Called when user taps Done after successfully submitting a report (e.g. to close parent profile). */
  onReportSubmitted?: () => void;
}

type ReportReason =
  | 'spam'
  | 'harassment'
  | 'hate_speech'
  | 'impersonation'
  | 'scam'
  | 'other';

const reportReasons: { id: ReportReason; label: string; description: string; icon: React.ReactNode }[] = [
  { id: 'spam', label: 'Spam', description: 'Repetitive or misleading activity', icon: <MessageSquare className="w-5 h-5" /> },
  { id: 'harassment', label: 'Harassment or Bullying', description: 'Targeting others with harmful behavior', icon: <User className="w-5 h-5" /> },
  { id: 'hate_speech', label: 'Hate Speech', description: 'Promoting violence or hatred', icon: <AlertTriangle className="w-5 h-5" /> },
  { id: 'impersonation', label: 'Impersonation', description: 'Pretending to be someone else', icon: <User className="w-5 h-5" /> },
  { id: 'scam', label: 'Scam or Fraud', description: 'Deceptive or fraudulent activity', icon: <AlertTriangle className="w-5 h-5" /> },
  { id: 'other', label: 'Other', description: 'Something else not listed', icon: <Flag className="w-5 h-5" /> },
];

export const UserReportFlow: React.FC<UserReportFlowProps> = ({
  isOpen,
  onClose,
  reportedUserId,
  reportedUsername,
  onReportSubmitted,
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
      const { error } = await supabase.from('user_reports').insert({
        reported_user_id: reportedUserId,
        reported_by: user.id,
        reason: selectedReason,
        description: additionalDetails || null,
        status: 'pending',
        severity: severityFromReason(selectedReason),
      });
      if (error) throw error;
      setStep('complete');
      toast.success('Report submitted. We’ll review it shortly.');
    } catch (e: unknown) {
      console.error(e);
      toast.error('Failed to submit report');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    const wasComplete = step === 'complete';
    setStep('reason');
    setSelectedReason(null);
    setAdditionalDetails('');
    onClose();
    if (wasComplete && onReportSubmitted) onReportSubmitted();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <Flag className="w-5 h-5 text-destructive" />
          <h1 className="font-display text-lg font-bold">Report User</h1>
        </div>
        <NeuButton onClick={handleClose} size="sm">
          <X className="w-5 h-5" />
        </NeuButton>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {step === 'reason' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Why are you reporting {reportedUsername ? `@${reportedUsername}` : 'this user'}?
            </p>
            <div className="space-y-2">
              {reportReasons.map((r) => (
                <button
                  key={r.id}
                  onClick={() => handleSelectReason(r.id)}
                  className={cn(
                    'w-full flex items-center gap-3 p-4 rounded-xl border transition-all text-left',
                    'border-border/50 bg-card/50 hover:border-primary/50 hover:bg-card',
                  )}
                >
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                    {r.icon}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{r.label}</p>
                    <p className="text-sm text-muted-foreground">{r.description}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        )}
        {step === 'details' && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-muted/50">
              <span className="font-medium">
                {reportReasons.find((r) => r.id === selectedReason)?.label}
              </span>
            </div>
            <Textarea
              placeholder="Additional context (optional)"
              value={additionalDetails}
              onChange={(e) => setAdditionalDetails(e.target.value)}
              className="min-h-[120px] resize-none"
            />
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep('reason')}>
                Back
              </Button>
              <Button className="flex-1" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Flag className="w-4 h-4 mr-2" />}
                Submit Report
              </Button>
            </div>
          </div>
        )}
        {step === 'complete' && (
          <div className="space-y-6 text-center">
            <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
            </div>
            <div>
              <h3 className="font-display text-xl font-bold">Report submitted</h3>
              <p className="text-sm text-muted-foreground mt-2">
                We’ll review this report and take action if needed.
              </p>
            </div>
            <Button className="w-full" onClick={handleClose}>
              Done
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
