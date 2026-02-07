import React, { useState } from 'react';
import { SwipeDismissOverlay } from './SwipeDismissOverlay';
import { 
  X, Shield, Smartphone, Key, Copy, Check, 
  Loader2, QrCode, AlertTriangle, CheckCircle2
} from 'lucide-react';
import { NeuButton } from './NeuButton';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Card3D } from './ui/Card3D';

interface TwoFactorAuthProps {
  isOpen: boolean;
  onClose: () => void;
}

type SetupStep = 'intro' | 'qr' | 'verify' | 'backup' | 'complete';

export const TwoFactorAuth: React.FC<TwoFactorAuthProps> = ({
  isOpen,
  onClose,
}) => {
  const { user } = useAuth();
  const [step, setStep] = useState<SetupStep>('intro');
  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [copied, setCopied] = useState(false);
  
  // Mock secret and backup codes for demo
  const mockSecret = 'JBSWY3DPEHPK3PXP';
  const backupCodes = [
    'a1b2c3d4',
    'e5f6g7h8',
    'i9j0k1l2',
    'm3n4o5p6',
    'q7r8s9t0',
    'u1v2w3x4',
  ];

  const handleCopySecret = () => {
    navigator.clipboard.writeText(mockSecret);
    setCopied(true);
    toast.success('Secret copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleVerify = async () => {
    if (verificationCode.length !== 6) {
      toast.error('Please enter a 6-digit code');
      return;
    }
    
    setIsLoading(true);
    // Simulate verification
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // In real implementation, verify with backend
    if (verificationCode === '123456' || verificationCode.length === 6) {
      setStep('backup');
      toast.success('Code verified successfully');
    } else {
      toast.error('Invalid verification code');
    }
    setIsLoading(false);
  };

  const handleComplete = () => {
    setIsEnabled(true);
    setStep('complete');
  };

  const handleDisable = async () => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsEnabled(false);
    setStep('intro');
    toast.success('Two-factor authentication disabled');
    setIsLoading(false);
  };

  const renderIntro = () => (
    <div className="space-y-6">
      <div className="flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Shield className="w-10 h-10 text-primary" />
        </div>
        <h3 className="font-display text-xl font-bold text-foreground mb-2">
          {isEnabled ? '2FA is Enabled' : 'Protect Your Account'}
        </h3>
        <p className="text-sm text-muted-foreground">
          {isEnabled 
            ? 'Your account is protected with two-factor authentication'
            : 'Add an extra layer of security with two-factor authentication (2FA)'
          }
        </p>
      </div>

      {isEnabled ? (
        <div className="space-y-4">
          <Card3D tiltEnabled={false} className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <p className="font-medium text-foreground">Authenticator App</p>
                <p className="text-sm text-muted-foreground">Connected and active</p>
              </div>
            </div>
          </Card3D>
          
          <Button
            variant="destructive"
            className="w-full"
            onClick={handleDisable}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Shield className="w-4 h-4 mr-2" />
            )}
            Disable 2FA
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
              <Smartphone className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground text-sm">Authenticator App Required</p>
                <p className="text-xs text-muted-foreground">
                  Download Google Authenticator, Authy, or similar app
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
              <Key className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-foreground text-sm">Backup Codes</p>
                <p className="text-xs text-muted-foreground">
                  You'll receive backup codes in case you lose access
                </p>
              </div>
            </div>
          </div>
          
          <Button
            className="w-full"
            onClick={() => setStep('qr')}
          >
            <Shield className="w-4 h-4 mr-2" />
            Enable 2FA
          </Button>
        </div>
      )}
    </div>
  );

  const renderQRStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="font-display text-lg font-bold text-foreground mb-2">
          Scan QR Code
        </h3>
        <p className="text-sm text-muted-foreground">
          Scan this QR code with your authenticator app
        </p>
      </div>

      {/* Mock QR Code */}
      <div className="flex justify-center">
        <div className="w-48 h-48 bg-white rounded-xl p-4 flex items-center justify-center">
          <div className="w-full h-full border-4 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
            <QrCode className="w-20 h-20 text-gray-400" />
          </div>
        </div>
      </div>

      {/* Manual Entry */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground text-center">
          Or enter this code manually:
        </p>
        <div className="flex items-center gap-2">
          <Input 
            value={mockSecret} 
            readOnly 
            className="font-mono text-center"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={handleCopySecret}
          >
            {copied ? (
              <Check className="w-4 h-4 text-green-500" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      <Button
        className="w-full"
        onClick={() => setStep('verify')}
      >
        Continue
      </Button>
    </div>
  );

  const renderVerifyStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="font-display text-lg font-bold text-foreground mb-2">
          Enter Verification Code
        </h3>
        <p className="text-sm text-muted-foreground">
          Enter the 6-digit code from your authenticator app
        </p>
      </div>

      <Input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        value={verificationCode}
        onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
        placeholder="000000"
        className="text-center text-2xl font-mono tracking-widest h-14"
      />

      <Button
        className="w-full"
        onClick={handleVerify}
        disabled={verificationCode.length !== 6 || isLoading}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : null}
        Verify Code
      </Button>
    </div>
  );

  const renderBackupStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="font-display text-lg font-bold text-foreground mb-2">
          Save Backup Codes
        </h3>
        <p className="text-sm text-muted-foreground">
          Save these codes in a secure location. You can use them if you lose access to your authenticator.
        </p>
      </div>

      <div className="p-4 rounded-xl bg-muted/50 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {backupCodes.map((code, index) => (
            <div
              key={index}
              className="px-3 py-2 rounded-lg bg-background font-mono text-sm text-center"
            >
              {code}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Each backup code can only be used once. Store them safely!
        </p>
      </div>

      <Button
        className="w-full"
        onClick={handleComplete}
      >
        I've Saved My Codes
      </Button>
    </div>
  );

  const renderComplete = () => (
    <div className="space-y-6">
      <div className="flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-10 h-10 text-green-500" />
        </div>
        <h3 className="font-display text-xl font-bold text-foreground mb-2">
          2FA Enabled!
        </h3>
        <p className="text-sm text-muted-foreground">
          Your account is now protected with two-factor authentication
        </p>
      </div>

      <Button
        className="w-full"
        onClick={onClose}
      >
        Done
      </Button>
    </div>
  );

  return (
    <SwipeDismissOverlay isOpen={isOpen} onClose={onClose}>
      <div className="max-w-md mx-auto h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-primary" />
            <h1 className="font-display text-lg font-bold">Two-Factor Auth</h1>
          </div>
          <NeuButton onClick={onClose} size="sm">
            <X className="w-5 h-5" />
          </NeuButton>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'intro' && renderIntro()}
          {step === 'qr' && renderQRStep()}
          {step === 'verify' && renderVerifyStep()}
          {step === 'backup' && renderBackupStep()}
          {step === 'complete' && renderComplete()}
        </div>

        {/* Step Indicator */}
        {step !== 'intro' && step !== 'complete' && (
          <div className="p-4 border-t border-border/50">
            <div className="flex justify-center gap-2">
              {['qr', 'verify', 'backup'].map((s, i) => (
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
