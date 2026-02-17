import React, { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Fingerprint, ScanFace, ScanLine, AlertCircle, Loader2 } from 'lucide-react';
import { useBiometricAuth, type BiometryType } from '@/hooks/useBiometricAuth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export interface BiometricSettingsProps {
  /** Current email (optional). If provided with password, credentials can be saved immediately. */
  email?: string;
  /** Current password (optional). Required to save credentials when enabling. */
  password?: string;
  /** Additional CSS class for the container. */
  className?: string;
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

export const BiometricSettings: React.FC<BiometricSettingsProps> = ({
  email,
  password,
  className,
}) => {
  const {
    isAvailable,
    biometryType,
    isEnabled,
    isLoading,
    authenticate,
    enableBiometric,
    disableBiometric,
    saveCredentials,
    biometryLabel,
  } = useBiometricAuth();
  const { toast } = useToast();
  const [isToggling, setIsToggling] = useState(false);

  const handleToggle = async (enabled: boolean) => {
    if (isToggling) return;

    if (enabled) {
      setIsToggling(true);
      try {
        const verified = await authenticate({
          reason: `Verify your identity to enable ${biometryLabel} login`,
          title: `Enable ${biometryLabel}`,
          subtitle: 'Confirm it\'s you',
          description: `Use ${biometryLabel} to sign in quickly next time`,
          useFallback: true,
        });

        if (!verified) {
          toast({
            title: 'Verification required',
            description: 'Complete biometric verification to enable quick login.',
            variant: 'destructive',
          });
          setIsToggling(false);
          return;
        }

        if (email && password) {
          const saved = await saveCredentials({ username: email, password });
          if (saved) {
            enableBiometric();
            toast({
              title: `${biometryLabel} login enabled`,
              description: 'You can now sign in with your biometrics.',
            });
          } else {
            toast({
              title: 'Could not save credentials',
              description: 'Biometric login could not be enabled. Try again.',
              variant: 'destructive',
            });
          }
        } else {
          enableBiometric();
          toast({
            title: `${biometryLabel} login enabled`,
            description: 'Sign in with your email and password once to save them for quick biometric login.',
          });
        }
      } catch {
        toast({
          title: 'Something went wrong',
          description: 'Could not enable biometric login.',
          variant: 'destructive',
        });
      } finally {
        setIsToggling(false);
      }
    } else {
      setIsToggling(true);
      try {
        await disableBiometric();
        toast({
          title: `${biometryLabel} login disabled`,
          description: 'Your saved credentials have been removed from this device.',
        });
      } catch {
        toast({
          title: 'Could not disable',
          description: 'Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsToggling(false);
      }
    }
  };

  if (isLoading) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 p-4 rounded-lg bg-secondary/50 animate-pulse',
          className
        )}
      >
        <div className="w-10 h-10 rounded-full bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 bg-muted rounded" />
          <div className="h-3 w-48 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!isAvailable) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 p-4 rounded-lg bg-muted/30 border border-border/50',
          className
        )}
      >
        <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center shrink-0">
          <AlertCircle className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-muted-foreground">
            Biometric login unavailable
          </p>
          <p className="text-xs text-muted-foreground/80 mt-0.5">
            Your device doesn’t support biometric authentication, or you’re using the app in a browser.
          </p>
        </div>
      </div>
    );
  }

  const Icon = getBiometricIcon(biometryType);

  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 p-4 rounded-lg bg-secondary/50 border border-border/50',
        className
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0">
          <Label
            htmlFor="biometric-toggle"
            className="text-sm font-medium cursor-pointer block"
          >
            {biometryLabel} login
          </Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            Use {biometryLabel.toLowerCase()} to sign in quickly on this device
          </p>
        </div>
      </div>
      {isToggling ? (
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground shrink-0" />
      ) : (
        <Switch
          id="biometric-toggle"
          checked={isEnabled}
          onCheckedChange={handleToggle}
          disabled={isToggling}
          aria-label={`Toggle ${biometryLabel} login`}
        />
      )}
    </div>
  );
};
