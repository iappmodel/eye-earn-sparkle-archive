// Onboarding: Product Tour (optional) + KYC Flow – Welcome → Selfie → ID Upload → Verification
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useKyc } from '@/hooks/useKyc';
import type { OnboardingPhase, OnboardingProgress } from '@/hooks/useOnboarding';
import { StepIndicator } from './StepIndicator';
import { OnboardingProductTour } from './OnboardingProductTour';
import { WelcomeStep } from './WelcomeStep';
import { SelfieStep } from './SelfieStep';
import { IdUploadStep } from './IdUploadStep';
import { VerificationStep } from './VerificationStep';
import { toast } from 'sonner';

export type OnboardingStep = 'welcome' | 'selfie' | 'id-upload' | 'verification';
export type DocumentType = 'passport' | 'drivers_license' | 'national_id';

export interface KycData {
  selfieUrl: string | null;
  idFrontUrl: string | null;
  idBackUrl: string | null;
  documentType: DocumentType | null;
  status: string;
}

interface OnboardingFlowProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  /** When 'product_tour', show tour first; when 'kyc', show KYC steps only */
  phase?: OnboardingPhase;
  /** Called when user taps Get Started on last tour slide */
  onCompleteProductTour?: () => void;
  /** Called when user skips the product tour */
  onSkipProductTour?: () => void;
  /** Persisted progress for "continue where you left off" and progress bar */
  progress?: OnboardingProgress;
  /** Mark a step complete for progress persistence */
  markStepComplete?: (step: 'welcomeSeen' | 'selfieDone' | 'idUploadDone') => void;
  /** 0–100 for progress bar in step indicator */
  progressPercentage?: number;
  /** Called when KYC status becomes approved/verified (e.g. trigger confetti) */
  onVerified?: () => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  isOpen,
  onClose,
  onComplete,
  phase = 'kyc',
  onCompleteProductTour,
  onSkipProductTour,
  progress,
  markStepComplete,
  progressPercentage = 0,
  onVerified,
}) => {
  const { user, profile, refreshProfile } = useAuth();
  const {
    submission,
    rawStatus,
    rejectionReason,
    isLoading: kycLoading,
    refetch,
    submitSelfieDocument,
    submitIdDocuments: submitIdDocs,
    hasSelfie,
    isSubmitted,
  } = useKyc();

  const [currentStep, setCurrentStep] = useState<OnboardingStep>('welcome');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const steps: OnboardingStep[] = ['welcome', 'selfie', 'id-upload', 'verification'];

  useEffect(() => {
    if (!isOpen || !user) return;
    const run = async () => await refetch();
    run();
  }, [isOpen, user?.id, refetch]);

  useEffect(() => {
    if (!isOpen || kycLoading || phase !== 'kyc') return;

    if (rawStatus === 'approved' || rawStatus === 'verified') {
      setCurrentStep('verification');
      return;
    }
    if (rawStatus === 'submitted' || rawStatus === 'under_review') {
      setCurrentStep('verification');
      return;
    }
    if (rawStatus === 'rejected') {
      setCurrentStep('verification');
      return;
    }
    if (hasSelfie && submission && !submission.id_front_url) {
      setCurrentStep('id-upload');
      return;
    }
    if (!hasSelfie) {
      setCurrentStep('welcome');
    } else {
      setCurrentStep('selfie');
    }
  }, [isOpen, kycLoading, phase, rawStatus, hasSelfie, submission]);

  const handleSelfieCapture = async (file: File) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const ok = await submitSelfieDocument(file);
      if (ok) {
        markStepComplete?.('selfieDone');
        toast.success('Selfie saved. Now add your ID document.');
        setCurrentStep('id-upload');
      } else {
        toast.error('Failed to save selfie');
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleIdUpload = async (
    frontFile: File,
    backFile: File | null,
    docType: DocumentType
  ) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const ok = await submitIdDocs(frontFile, backFile, docType);
      if (ok) {
        markStepComplete?.('idUploadDone');
        toast.success("Documents submitted. We'll review them within 24–48 hours.");
        setCurrentStep('verification');
        await refreshProfile();
      } else {
        toast.error('Failed to submit documents');
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComplete = () => {
    refreshProfile();
    onComplete();
  };

  const handleRetry = () => setCurrentStep('id-upload');

  const handleWelcomeContinue = () => {
    markStepComplete?.('welcomeSeen');
    setCurrentStep('selfie');
  };

  if (!isOpen) return null;

  // Product tour phase: show slides only
  if (phase === 'product_tour') {
    return (
      <OnboardingProductTour
        onGetStarted={onCompleteProductTour ?? (() => {})}
        onSkip={onSkipProductTour ?? (() => {})}
        onClose={onClose}
      />
    );
  }

  const currentStepIndex = steps.indexOf(currentStep);
  const displayStatus = rawStatus || 'pending';
  const isResuming = !!(progress?.welcomeSeen || progress?.selfieDone);

  return (
    <div className="fixed inset-0 z-[100] bg-background">
      <div className="absolute top-0 left-0 right-0 p-4 z-10">
        <StepIndicator
          steps={steps}
          currentStep={currentStepIndex}
          onClose={onClose}
          progressPercentage={progressPercentage}
        />
      </div>

      <div className="h-full pt-20 pb-8 px-4 overflow-y-auto">
        {currentStep === 'welcome' && (
          <WelcomeStep
            userName={profile?.display_name || profile?.username || 'there'}
            onContinue={handleWelcomeContinue}
            onSkip={() => onComplete()}
            isResuming={isResuming}
          />
        )}

        {currentStep === 'selfie' && (
          <SelfieStep
            onCapture={handleSelfieCapture}
            onSkip={() => onComplete()}
            isLoading={isSubmitting}
            existingUrl={submission?.selfie_url ?? null}
          />
        )}

        {currentStep === 'id-upload' && (
          <IdUploadStep
            onUpload={handleIdUpload}
            onSkip={() => onComplete()}
            isLoading={isSubmitting}
            existingFrontUrl={submission?.id_front_url ?? null}
            existingBackUrl={submission?.id_back_url ?? null}
          />
        )}

        {currentStep === 'verification' && (
          <VerificationStep
            status={displayStatus === 'approved' ? 'approved' : displayStatus}
            rejectionReason={rejectionReason}
            onComplete={handleComplete}
            onRetry={rawStatus === 'rejected' ? handleRetry : undefined}
            onVerified={onVerified}
          />
        )}
      </div>
    </div>
  );
};
