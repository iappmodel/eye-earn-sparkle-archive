// ID Document Upload Step Component
import React, { useState, useRef } from 'react';
import { CreditCard, Upload, Check, RefreshCw, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLocalization } from '@/contexts/LocalizationContext';
import type { DocumentType } from './OnboardingFlow';

interface IdUploadStepProps {
  onUpload: (frontFile: File, backFile: File | null, docType: DocumentType) => void;
  onSkip: () => void;
  isLoading: boolean;
  existingFrontUrl: string | null;
  existingBackUrl: string | null;
}

const documentLabelKeys: Record<DocumentType, string> = {
  passport: 'onboarding.idUpload.passport',
  drivers_license: 'onboarding.idUpload.driversLicense',
  national_id: 'onboarding.idUpload.nationalId',
};

const documentTypes: { id: DocumentType; labelKey: string; icon: React.ReactNode; needsBack: boolean }[] = [
  { id: 'passport', labelKey: documentLabelKeys.passport, icon: <FileText className="w-5 h-5" />, needsBack: false },
  { id: 'drivers_license', labelKey: documentLabelKeys.drivers_license, icon: <CreditCard className="w-5 h-5" />, needsBack: true },
  { id: 'national_id', labelKey: documentLabelKeys.national_id, icon: <CreditCard className="w-5 h-5" />, needsBack: true },
];

export const IdUploadStep: React.FC<IdUploadStepProps> = ({
  onUpload,
  onSkip,
  isLoading,
  existingFrontUrl,
  existingBackUrl,
}) => {
  const [selectedType, setSelectedType] = useState<DocumentType | null>(null);
  const [frontImage, setFrontImage] = useState<string | null>(existingFrontUrl);
  const [backImage, setBackImage] = useState<string | null>(existingBackUrl);
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  const { t } = useLocalization();

  const selectedDoc = documentTypes.find(d => d.id === selectedType);
  const needsBack = selectedDoc?.needsBack ?? false;
  const canSubmit = frontFile && (!needsBack || backFile);

  const handleFrontUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setFrontFile(file);
      setFrontImage(URL.createObjectURL(file));
    }
  };

  const handleBackUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setBackFile(file);
      setBackImage(URL.createObjectURL(file));
    }
  };

  const handleSubmit = () => {
    if (frontFile && selectedType) {
      onUpload(frontFile, backFile, selectedType);
    }
  };

  return (
    <div className="flex flex-col items-center min-h-full">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">{t('onboarding.idUpload.title' as 'onboarding.idUpload.title')}</h2>
        <p className="text-muted-foreground">
          {t('onboarding.idUpload.subtitle' as 'onboarding.idUpload.subtitle')}
        </p>
      </div>

      <div className="w-full max-w-sm mb-6">
        <label className="text-sm font-medium mb-2 block">{t('onboarding.idUpload.documentType' as 'onboarding.idUpload.documentType')}</label>
        <div className="grid grid-cols-3 gap-2">
          {documentTypes.map((doc) => (
            <button
              key={doc.id}
              onClick={() => {
                setSelectedType(doc.id);
                setFrontImage(null);
                setBackImage(null);
                setFrontFile(null);
                setBackFile(null);
              }}
              className={cn(
                'neu-card p-3 rounded-xl flex flex-col items-center gap-2 transition-all',
                selectedType === doc.id
                  ? 'ring-2 ring-primary bg-primary/5'
                  : 'hover:bg-secondary/50'
              )}
            >
              {doc.icon}
              <span className="text-xs font-medium text-center">{t(doc.labelKey as 'onboarding.idUpload.passport')}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Upload Areas */}
      {selectedType && (
        <div className="w-full max-w-sm space-y-4 mb-6">
          <div>
            <label className="text-sm font-medium mb-2 block">
              {selectedType === 'passport' ? t('onboarding.idUpload.photoPage' as 'onboarding.idUpload.photoPage') : t('onboarding.idUpload.frontLabel' as 'onboarding.idUpload.frontLabel')}
            </label>
            <button
              onClick={() => frontInputRef.current?.click()}
              className={cn(
                'w-full aspect-[1.6] rounded-xl border-2 border-dashed transition-all flex items-center justify-center overflow-hidden',
                frontImage
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/30 hover:border-primary/50'
              )}
            >
              {frontImage ? (
                <img src={frontImage} alt="Front of ID" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center p-4">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {t('onboarding.idUpload.tapToUploadFront' as 'onboarding.idUpload.tapToUploadFront')}
                  </span>
                </div>
              )}
            </button>
          </div>

          {/* Back of Document (if needed) */}
          {needsBack && (
            <div>
              <label className="text-sm font-medium mb-2 block">{t('onboarding.idUpload.backLabel' as 'onboarding.idUpload.backLabel')}</label>
              <button
                onClick={() => backInputRef.current?.click()}
                className={cn(
                  'w-full aspect-[1.6] rounded-xl border-2 border-dashed transition-all flex items-center justify-center overflow-hidden',
                  backImage
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/30 hover:border-primary/50'
                )}
              >
                {backImage ? (
                  <img src={backImage} alt="Back of ID" className="w-full h-full object-cover" />
                ) : (
                <div className="text-center p-4">
                  <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {t('onboarding.idUpload.tapToUploadBack' as 'onboarding.idUpload.tapToUploadBack')}
                  </span>
                </div>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Tips */}
      {selectedType && (
        <div className="w-full max-w-sm mb-6">
          <div className="neu-card rounded-xl p-4">
            <h4 className="font-medium mb-2">{t('onboarding.idUpload.requirementsTitle' as 'onboarding.idUpload.requirementsTitle')}</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• {t('onboarding.idUpload.req1' as 'onboarding.idUpload.req1')}</li>
              <li>• {t('onboarding.idUpload.req2' as 'onboarding.idUpload.req2')}</li>
              <li>• {t('onboarding.idUpload.req3' as 'onboarding.idUpload.req3')}</li>
              <li>• {t('onboarding.idUpload.req4' as 'onboarding.idUpload.req4')}</li>
            </ul>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="w-full max-w-sm space-y-3 mt-auto">
        <Button
          onClick={handleSubmit}
          className="w-full h-14 text-lg font-semibold rounded-2xl"
          size="lg"
          disabled={!canSubmit || isLoading}
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
              {t('onboarding.idUpload.uploading' as 'onboarding.idUpload.uploading')}
            </>
          ) : (
            <>
              <Check className="w-5 h-5 mr-2" />
              {t('onboarding.idUpload.submitForVerification' as 'onboarding.idUpload.submitForVerification')}
            </>
          )}
        </Button>

        <button
          onClick={onSkip}
          className="w-full text-muted-foreground hover:text-foreground transition-colors py-2"
        >
          {t('onboarding.idUpload.skipForNow' as 'onboarding.idUpload.skipForNow')}
        </button>
      </div>

      {/* Hidden inputs */}
      <input
        ref={frontInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFrontUpload}
        className="hidden"
      />
      <input
        ref={backInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleBackUpload}
        className="hidden"
      />
    </div>
  );
};
