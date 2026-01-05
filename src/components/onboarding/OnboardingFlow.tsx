// Multi-step Onboarding Flow Component
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { StepIndicator } from './StepIndicator';
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
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const { user, profile } = useAuth();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('selfie');
  const [kycData, setKycData] = useState<KycData>({
    selfieUrl: null,
    idFrontUrl: null,
    idBackUrl: null,
    documentType: null,
    status: 'pending',
  });
  const [isLoading, setIsLoading] = useState(false);

  // Load existing KYC data if any
  useEffect(() => {
    const loadKycData = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from('kyc_submissions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setKycData({
          selfieUrl: data.selfie_url,
          idFrontUrl: data.id_front_url,
          idBackUrl: data.id_back_url,
          documentType: data.document_type as DocumentType,
          status: data.status,
        });

        // Set step based on progress - ID upload and verification disabled for now
        if (data.selfie_url) {
          // After selfie, complete the flow
          onComplete();
        }
      }
    };

    if (isOpen) {
      loadKycData();
    }
  }, [user, isOpen]);

  const uploadFile = async (file: File, folder: string): Promise<string | null> => {
    if (!user) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${folder}/${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('kyc-documents')
      .upload(fileName, file, { upsert: true });

    if (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload file');
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('kyc-documents')
      .getPublicUrl(fileName);

    return urlData.publicUrl;
  };

  const handleSelfieCapture = async (file: File) => {
    setIsLoading(true);
    const url = await uploadFile(file, 'selfie');
    
    if (url) {
      // Upsert KYC submission
      const { error } = await supabase
        .from('kyc_submissions')
        .upsert({
          user_id: user?.id,
          selfie_url: url,
          status: 'pending',
        }, { onConflict: 'user_id' });

      if (error) {
        toast.error('Failed to save selfie');
        console.error(error);
      } else {
        setKycData(prev => ({ ...prev, selfieUrl: url }));
        toast.success('Selfie uploaded successfully');
        // Complete flow after selfie - ID upload disabled for now
        onComplete();
      }
    }
    setIsLoading(false);
  };

  const handleIdUpload = async (frontFile: File, backFile: File | null, docType: DocumentType) => {
    setIsLoading(true);
    
    const frontUrl = await uploadFile(frontFile, 'id-front');
    const backUrl = backFile ? await uploadFile(backFile, 'id-back') : null;

    if (frontUrl) {
      const { error } = await supabase
        .from('kyc_submissions')
        .upsert({
          user_id: user?.id,
          id_front_url: frontUrl,
          id_back_url: backUrl,
          document_type: docType,
          status: 'submitted',
        }, { onConflict: 'user_id' });

      if (error) {
        toast.error('Failed to save ID documents');
        console.error(error);
      } else {
        setKycData(prev => ({
          ...prev,
          idFrontUrl: frontUrl,
          idBackUrl: backUrl,
          documentType: docType,
          status: 'submitted',
        }));
        
        // Update profile kyc_status
        await supabase
          .from('profiles')
          .update({ kyc_status: 'submitted' })
          .eq('user_id', user?.id);

        setCurrentStep('verification');
        toast.success('Documents submitted for verification');
      }
    }
    setIsLoading(false);
  };

  const handleSkip = () => {
    onComplete();
  };

  if (!isOpen) return null;

  // ID upload and verification steps disabled for now
  const steps: OnboardingStep[] = ['welcome', 'selfie'];
  const currentStepIndex = steps.indexOf(currentStep);

  return (
    <div className="fixed inset-0 z-[100] bg-background">
      {/* Header with step indicator */}
      <div className="absolute top-0 left-0 right-0 p-4 z-10">
        <StepIndicator 
          steps={steps} 
          currentStep={currentStepIndex} 
          onClose={onClose}
        />
      </div>

      {/* Content */}
      <div className="h-full pt-20 pb-8 px-4 overflow-y-auto">
        {currentStep === 'welcome' && (
          <WelcomeStep
            userName={profile?.display_name || profile?.username || 'there'}
            onContinue={() => setCurrentStep('selfie')}
            onSkip={handleSkip}
          />
        )}

        {currentStep === 'selfie' && (
          <SelfieStep
            onCapture={handleSelfieCapture}
            onSkip={onComplete}
            isLoading={isLoading}
            existingUrl={kycData.selfieUrl}
          />
        )}
      </div>
    </div>
  );
};
