import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Fingerprint, ScanFace, ScanLine, Loader2 } from 'lucide-react';
import { useBiometricAuth, type BiometryType } from '@/hooks/useBiometricAuth';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export interface BiometricLoginButtonProps {
  onSuccess?: () => void;
  className?: string;
  /** Show a "Set up biometric" CTA when available but not enabled. */
  showWhenDisabled?: boolean;
  /** Button variant. */
  variant?: 'default' | 'outline' | 'secondary' | 'ghost' | 'link' | 'destructive';
  /** Callback when user taps "Set up" (e.g. scroll to settings or open modal). */
  onSetupClick?: () => void;
  /** Optional custom verify options (title, reason, etc.). */
  verifyReason?: string;
}

function getBiometricIcon(type: BiometryType) {
  switch (type) {
    case 'faceId':
      return ScanFace;
    case 'iris':
      return ScanLine;
    case 'fingerprint':
    case 'multiple':
    default:
      return Fingerprint;
  }
}

function getButtonLabel(
  biometryLabel: string,
  isAuthenticating: boolean,
  isEnabled: boolean
): string {
  if (isAuthenticating) return 'Authenticating...';
  if (isEnabled) return `Sign in with ${biometryLabel}`;
  return `Set up ${biometryLabel} login`;
}

export const BiometricLoginButton: React.FC<BiometricLoginButtonProps> = ({
  onSuccess,
  className = '',
  showWhenDisabled = true,
  variant = 'outline',
  onSetupClick,
  verifyReason = 'Sign in to viewi',
}) => {
  const {
    isAvailable,
    biometryType,
    isEnabled,
    isLoading,
    authenticate,
    getCredentials,
    biometryLabel,
  } = useBiometricAuth();
  const { signIn } = useAuth();
  const { toast } = useToast();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleBiometricLogin = async () => {
    if (!isAvailable) return;

    if (isAvailable && !isEnabled && showWhenDisabled) {
      onSetupClick?.();
      return;
    }

    setIsAuthenticating(true);
    try {
      const authenticated = await authenticate({
        reason: verifyReason,
        title: `${biometryLabel} Login`,
        subtitle: `Use ${biometryLabel} to sign in`,
        description: `Authenticate with ${biometryLabel} to continue`,
      });

      if (authenticated) {
        const credentials = await getCredentials();

        if (credentials) {
          const { error } = await signIn(credentials.username, credentials.password);

          if (error) {
            toast({
              title: 'Login Failed',
              description: 'Biometric authentication succeeded but login failed. Please try again.',
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Welcome back!',
              description: `Signed in with ${biometryLabel}.`,
            });
            onSuccess?.();
          }
        } else {
          toast({
            title: 'No Saved Credentials',
            description: 'Sign in with email and password once, then enable biometric login in Settings.',
            variant: 'destructive',
          });
        }
      }
    } catch {
      toast({
        title: 'Authentication Failed',
        description: 'Biometric authentication was cancelled or failed.',
        variant: 'destructive',
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  const Icon = getBiometricIcon(biometryType);
  const canLogin = isAvailable && isEnabled;
  const showSetupCta = isAvailable && !isEnabled && showWhenDisabled;

  if (isLoading) {
    return (
      <div
        className={cn(
          'w-full h-12 rounded-md border border-border bg-secondary/30 animate-pulse flex items-center justify-center gap-2',
          className
        )}
        aria-hidden
      >
        <div className="w-5 h-5 rounded-full bg-muted" />
        <div className="h-4 w-24 bg-muted rounded" />
      </div>
    );
  }

  if (!isAvailable && !showSetupCta) {
    return null;
  }

  if (!isAvailable) {
    return null;
  }

  return (
    <Button
      type="button"
      variant={variant}
      onClick={handleBiometricLogin}
      disabled={isAuthenticating}
      className={cn(
        'w-full h-12 border-border font-medium',
        variant === 'outline' && 'hover:bg-secondary',
        className
      )}
      aria-label={
        isAuthenticating
          ? 'Authenticating'
          : canLogin
            ? `Sign in with ${biometryLabel}`
            : `Set up ${biometryLabel} login`
      }
    >
      {isAuthenticating ? (
        <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
      ) : (
        <Icon className="w-5 h-5" aria-hidden />
      )}
      {getButtonLabel(biometryLabel, isAuthenticating, canLogin)}
    </Button>
  );
};
