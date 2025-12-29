// Selfie Capture Step Component
import React, { useState, useRef, useCallback } from 'react';
import { Camera, RefreshCw, Check, Upload, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface SelfieStepProps {
  onCapture: (file: File) => void;
  onSkip: () => void;
  isLoading: boolean;
  existingUrl: string | null;
}

export const SelfieStep: React.FC<SelfieStepProps> = ({
  onCapture,
  onSkip,
  isLoading,
  existingUrl,
}) => {
  const { toast } = useToast();
  const [mode, setMode] = useState<'initial' | 'camera' | 'preview'>('initial');
  const [capturedImage, setCapturedImage] = useState<string | null>(existingUrl);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 720, height: 720 },
      });
      streamRef.current = stream;
      setMode('camera');
    } catch (error) {
      console.error('Camera access denied:', error);
      toast({
        title: "Camera access denied",
        description: "Please allow camera access or upload a photo instead.",
        variant: "destructive",
      });
      // Fall back to file upload
      fileInputRef.current?.click();
    }
  }, [toast]);

  // Assign stream to video element after mode changes to 'camera'
  React.useEffect(() => {
    if (mode === 'camera' && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
    }
  }, [mode]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    
    if (ctx) {
      // Mirror the image for selfie
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoRef.current, 0, 0);
    }

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'selfie.jpg', { type: 'image/jpeg' });
        setCapturedFile(file);
        setCapturedImage(URL.createObjectURL(blob));
        setMode('preview');
        stopCamera();
      }
    }, 'image/jpeg', 0.9);
  }, [stopCamera]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setCapturedFile(file);
      setCapturedImage(URL.createObjectURL(file));
      setMode('preview');
    }
  };

  const retake = () => {
    setCapturedImage(null);
    setCapturedFile(null);
    setMode('initial');
  };

  const confirmSelfie = () => {
    if (capturedFile) {
      onCapture(capturedFile);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-full">
      {/* Instructions */}
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">Take a Selfie</h2>
        <p className="text-muted-foreground">
          We need a clear photo of your face for verification
        </p>
      </div>

      {/* Camera/Preview Area */}
      <div className="relative w-72 h-72 rounded-full overflow-hidden bg-muted mb-8">
        {mode === 'initial' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <User className="w-24 h-24 text-muted-foreground/30" />
          </div>
        )}

        {/* Always render video element, hide when not in camera mode */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={cn(
            "absolute inset-0 w-full h-full object-cover scale-x-[-1]",
            mode !== 'camera' && "hidden"
          )}
        />

        {mode === 'preview' && capturedImage && (
          <img
            src={capturedImage}
            alt="Captured selfie"
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* Overlay guide */}
        {mode === 'camera' && (
          <div className="absolute inset-4 border-2 border-dashed border-primary/50 rounded-full" />
        )}
      </div>

      {/* Tips */}
      {mode !== 'preview' && (
        <div className="w-full max-w-sm mb-8">
          <div className="neu-card rounded-xl p-4">
            <h4 className="font-medium mb-2">Tips for a good selfie:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Good lighting on your face</li>
              <li>• No sunglasses or hats</li>
              <li>• Look directly at the camera</li>
              <li>• Neutral expression</li>
            </ul>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="w-full max-w-sm space-y-3">
        {mode === 'initial' && (
          <>
            <Button
              onClick={startCamera}
              className="w-full h-14 text-lg font-semibold rounded-2xl"
              size="lg"
            >
              <Camera className="w-5 h-5 mr-2" />
              Open Camera
            </Button>
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="outline"
              className="w-full h-12 rounded-2xl"
            >
              <Upload className="w-5 h-5 mr-2" />
              Upload Photo
            </Button>
          </>
        )}

        {mode === 'camera' && (
          <Button
            onClick={capturePhoto}
            className="w-full h-14 text-lg font-semibold rounded-2xl"
            size="lg"
          >
            <Camera className="w-5 h-5 mr-2" />
            Capture
          </Button>
        )}

        {mode === 'preview' && (
          <>
            <Button
              onClick={confirmSelfie}
              className="w-full h-14 text-lg font-semibold rounded-2xl"
              size="lg"
              disabled={isLoading}
            >
              {isLoading ? (
                <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Check className="w-5 h-5 mr-2" />
              )}
              {isLoading ? 'Uploading...' : 'Use This Photo'}
            </Button>
            <Button
              onClick={retake}
              variant="outline"
              className="w-full h-12 rounded-2xl"
              disabled={isLoading}
            >
              <RefreshCw className="w-5 h-5 mr-2" />
              Retake
            </Button>
          </>
        )}

        <button
          onClick={onSkip}
          className="w-full text-muted-foreground hover:text-foreground transition-colors py-2"
        >
          Skip for now
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="user"
        onChange={handleFileUpload}
        className="hidden"
      />
    </div>
  );
};
