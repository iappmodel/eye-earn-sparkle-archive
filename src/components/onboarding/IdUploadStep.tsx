// ID Document Upload Step Component
import React, { useState, useRef } from 'react';
import { CreditCard, Upload, Check, RefreshCw, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DocumentType } from './OnboardingFlow';

interface IdUploadStepProps {
  onUpload: (frontFile: File, backFile: File | null, docType: DocumentType) => void;
  onSkip: () => void;
  isLoading: boolean;
  existingFrontUrl: string | null;
  existingBackUrl: string | null;
}

const documentTypes: { id: DocumentType; label: string; icon: React.ReactNode; needsBack: boolean }[] = [
  { id: 'passport', label: 'Passport', icon: <FileText className="w-5 h-5" />, needsBack: false },
  { id: 'drivers_license', label: "Driver's License", icon: <CreditCard className="w-5 h-5" />, needsBack: true },
  { id: 'national_id', label: 'National ID', icon: <CreditCard className="w-5 h-5" />, needsBack: true },
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
      {/* Instructions */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">Upload ID Document</h2>
        <p className="text-muted-foreground">
          Choose a document type and upload clear photos
        </p>
      </div>

      {/* Document Type Selection */}
      <div className="w-full max-w-sm mb-6">
        <label className="text-sm font-medium mb-2 block">Document Type</label>
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
              <span className="text-xs font-medium text-center">{doc.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Upload Areas */}
      {selectedType && (
        <div className="w-full max-w-sm space-y-4 mb-6">
          {/* Front of Document */}
          <div>
            <label className="text-sm font-medium mb-2 block">
              {selectedType === 'passport' ? 'Photo Page' : 'Front of Document'}
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
                    Tap to upload front
                  </span>
                </div>
              )}
            </button>
          </div>

          {/* Back of Document (if needed) */}
          {needsBack && (
            <div>
              <label className="text-sm font-medium mb-2 block">Back of Document</label>
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
                      Tap to upload back
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
            <h4 className="font-medium mb-2">Photo requirements:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• All corners visible</li>
              <li>• No blur or glare</li>
              <li>• Document not expired</li>
              <li>• Original document (no copies)</li>
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
              Uploading...
            </>
          ) : (
            <>
              <Check className="w-5 h-5 mr-2" />
              Submit for Verification
            </>
          )}
        </Button>

        <button
          onClick={onSkip}
          className="w-full text-muted-foreground hover:text-foreground transition-colors py-2"
        >
          Skip for now
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
