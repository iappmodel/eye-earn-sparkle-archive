import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Fingerprint, ScanFace, AlertCircle } from 'lucide-react';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

interface BiometricSettingsProps {
  email?: string;
  password?: string;
}

export const BiometricSettings: React.FC<BiometricSettingsProps> = ({ email, password }) => {
  const { 
    isAvailable, 
    biometryType, 
    isEnabled, 
    isLoading,
    enableBiometric, 
    disableBiometric,
    saveCredentials,
    deleteCredentials,
  } = useBiometricAuth();
  const { user } = useAuth();
  const { toast } = useToast();

  const handleToggle = async (enabled: boolean) => {
    if (enabled) {
      if (email && password) {
        const saved = await saveCredentials({ username: email, password });
        if (saved) {
          enableBiometric();
          toast({
            title: 'Biometric Login Enabled',
            description: 'You can now use biometrics to sign in.',
          });
        } else {
          toast({
            title: 'Failed to Enable',
            description: 'Could not save credentials for biometric login.',
            variant: 'destructive',
          });
        }
      } else {
        enableBiometric();
        toast({
          title: 'Biometric Login Enabled',
          description: 'Sign in with your credentials once to save them for biometric login.',
        });
      }
    } else {
      await deleteCredentials();
      disableBiometric();
      toast({
        title: 'Biometric Login Disabled',
        description: 'Your saved credentials have been removed.',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-lg bg-secondary/50 animate-pulse">
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
      <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/30">
        <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center">
          <AlertCircle className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">
            Biometric Login Unavailable
          </p>
          <p className="text-xs text-muted-foreground/70">
            Your device doesn't support biometric authentication or it's running in a browser.
          </p>
        </div>
      </div>
    );
  }

  const Icon = biometryType === 'faceId' ? ScanFace : Fingerprint;
  const label = biometryType === 'faceId' ? 'Face ID' : 'Fingerprint';

  return (
    <div className="flex items-center justify-between gap-3 p-4 rounded-lg bg-secondary/50">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <Label htmlFor="biometric-toggle" className="text-sm font-medium cursor-pointer">
            {label} Login
          </Label>
          <p className="text-xs text-muted-foreground">
            Use {label.toLowerCase()} to sign in quickly
          </p>
        </div>
      </div>
      <Switch
        id="biometric-toggle"
        checked={isEnabled}
        onCheckedChange={handleToggle}
      />
    </div>
  );
};
