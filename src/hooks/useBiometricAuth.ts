import { useState, useEffect, useCallback } from 'react';

interface BiometricCredentials {
  username: string;
  password: string;
}

interface UseBiometricAuthReturn {
  isAvailable: boolean;
  biometryType: 'fingerprint' | 'faceId' | 'iris' | 'multiple' | null;
  isEnabled: boolean;
  isLoading: boolean;
  error: string | null;
  checkAvailability: () => Promise<void>;
  authenticate: () => Promise<boolean>;
  saveCredentials: (credentials: BiometricCredentials) => Promise<boolean>;
  getCredentials: () => Promise<BiometricCredentials | null>;
  deleteCredentials: () => Promise<boolean>;
  enableBiometric: () => void;
  disableBiometric: () => void;
}

const BIOMETRIC_ENABLED_KEY = 'biometric_auth_enabled';
const CREDENTIALS_SERVER = 'viewi_auth';

export const useBiometricAuth = (): UseBiometricAuthReturn => {
  const [isAvailable, setIsAvailable] = useState(false);
  const [biometryType, setBiometryType] = useState<'fingerprint' | 'faceId' | 'iris' | 'multiple' | null>(null);
  const [isEnabled, setIsEnabled] = useState(() => {
    return localStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true';
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [NativeBiometric, setNativeBiometric] = useState<any>(null);

  // Dynamically import the native biometric plugin
  useEffect(() => {
    const loadPlugin = async () => {
      try {
        const { NativeBiometric: BiometricPlugin } = await import('capacitor-native-biometric');
        setNativeBiometric(BiometricPlugin);
      } catch (err) {
        console.log('Native biometric plugin not available (running in browser)');
        setIsLoading(false);
      }
    };
    loadPlugin();
  }, []);

  const checkAvailability = useCallback(async () => {
    if (!NativeBiometric) {
      setIsAvailable(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await NativeBiometric.isAvailable();
      setIsAvailable(result.isAvailable);
      
      if (result.biometryType) {
        switch (result.biometryType) {
          case 1:
            setBiometryType('fingerprint');
            break;
          case 2:
            setBiometryType('faceId');
            break;
          case 3:
            setBiometryType('iris');
            break;
          case 4:
            setBiometryType('multiple');
            break;
          default:
            setBiometryType('fingerprint');
        }
      }
    } catch (err: any) {
      console.error('Biometric availability check failed:', err);
      setIsAvailable(false);
      setError(err.message || 'Failed to check biometric availability');
    } finally {
      setIsLoading(false);
    }
  }, [NativeBiometric]);

  useEffect(() => {
    if (NativeBiometric) {
      checkAvailability();
    }
  }, [NativeBiometric, checkAvailability]);

  const authenticate = useCallback(async (): Promise<boolean> => {
    if (!NativeBiometric || !isAvailable) {
      setError('Biometric authentication not available');
      return false;
    }

    try {
      await NativeBiometric.verifyIdentity({
        reason: 'Sign in to viewi',
        title: 'Biometric Login',
        subtitle: 'Use your biometric to authenticate',
        description: 'Place your finger on the sensor or look at the camera',
        negativeButtonText: 'Cancel',
        maxAttempts: 3,
      });
      return true;
    } catch (err: any) {
      console.error('Biometric authentication failed:', err);
      setError(err.message || 'Authentication failed');
      return false;
    }
  }, [NativeBiometric, isAvailable]);

  const saveCredentials = useCallback(async (credentials: BiometricCredentials): Promise<boolean> => {
    if (!NativeBiometric || !isAvailable) {
      setError('Biometric authentication not available');
      return false;
    }

    try {
      await NativeBiometric.setCredentials({
        username: credentials.username,
        password: credentials.password,
        server: CREDENTIALS_SERVER,
      });
      return true;
    } catch (err: any) {
      console.error('Failed to save credentials:', err);
      setError(err.message || 'Failed to save credentials');
      return false;
    }
  }, [NativeBiometric, isAvailable]);

  const getCredentials = useCallback(async (): Promise<BiometricCredentials | null> => {
    if (!NativeBiometric || !isAvailable) {
      return null;
    }

    try {
      const credentials = await NativeBiometric.getCredentials({
        server: CREDENTIALS_SERVER,
      });
      return {
        username: credentials.username,
        password: credentials.password,
      };
    } catch (err: any) {
      console.error('Failed to get credentials:', err);
      return null;
    }
  }, [NativeBiometric, isAvailable]);

  const deleteCredentials = useCallback(async (): Promise<boolean> => {
    if (!NativeBiometric) {
      return false;
    }

    try {
      await NativeBiometric.deleteCredentials({
        server: CREDENTIALS_SERVER,
      });
      return true;
    } catch (err: any) {
      console.error('Failed to delete credentials:', err);
      return false;
    }
  }, [NativeBiometric]);

  const enableBiometric = useCallback(() => {
    localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
    setIsEnabled(true);
  }, []);

  const disableBiometric = useCallback(() => {
    localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'false');
    setIsEnabled(false);
    deleteCredentials();
  }, [deleteCredentials]);

  return {
    isAvailable,
    biometryType,
    isEnabled,
    isLoading,
    error,
    checkAvailability,
    authenticate,
    saveCredentials,
    getCredentials,
    deleteCredentials,
    enableBiometric,
    disableBiometric,
  };
};
