import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Fingerprint, ScanFace, Loader2 } from 'lucide-react';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface BiometricLoginButtonProps {
  onSuccess?: () => void;
  className?: string;
}

export const BiometricLoginButton: React.FC<BiometricLoginButtonProps> = ({
  onSuccess,
  className = '',
}) => {
  const { isAvailable, biometryType, isEnabled, isLoading, authenticate, getCredentials } = useBiometricAuth();
  const { signIn } = useAuth();
  const { toast } = useToast();
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleBiometricLogin = async () => {
    if (!isAvailable || !isEnabled) return;

    setIsAuthenticating(true);
    try {
      const authenticated = await authenticate();
      
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
              description: 'Successfully signed in with biometrics.',
            });
            onSuccess?.();
          }
        } else {
          toast({
            title: 'No Saved Credentials',
            description: 'Please log in with your email first, then enable biometric login.',
            variant: 'destructive',
          });
        }
      }
    } catch (err) {
      toast({
        title: 'Authentication Failed',
        description: 'Biometric authentication was cancelled or failed.',
        variant: 'destructive',
      });
    } finally {
      setIsAuthenticating(false);
    }
  };

  // Don't render if not available or not enabled
  if (isLoading) {
    return null;
  }

  if (!isAvailable || !isEnabled) {
    return null;
  }

  const Icon = biometryType === 'faceId' ? ScanFace : Fingerprint;
  const label = biometryType === 'faceId' ? 'Sign in with Face ID' : 'Sign in with Fingerprint';

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handleBiometricLogin}
      disabled={isAuthenticating}
      className={`w-full h-12 border-border hover:bg-secondary ${className}`}
    >
      {isAuthenticating ? (
        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
      ) : (
        <Icon className="w-5 h-5 mr-2" />
      )}
      {isAuthenticating ? 'Authenticating...' : label}
    </Button>
  );
};
