import { useState, useEffect, useCallback } from 'react';

export interface BiometricCredentials {
  username: string;
  password: string;
}

export type BiometryType = 'fingerprint' | 'faceId' | 'iris' | 'multiple' | null;

export type BiometricPlatform = 'ios' | 'android' | 'web';

export interface BiometricVerifyOptions {
  reason?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  negativeButtonText?: string;
  maxAttempts?: number;
  useFallback?: boolean;
}

export interface UseBiometricAuthReturn {
  /** Whether the device supports biometric authentication (native app only). */
  isAvailable: boolean;
  /** Detected biometry type. */
  biometryType: BiometryType;
  /** Current platform: ios, android, or web. */
  platform: BiometricPlatform;
  /** User has enabled biometric login in app settings. */
  isEnabled: boolean;
  /** Credentials are stored in device keychain/keystore (only when isEnabled and after save). */
  hasStoredCredentials: boolean;
  /** Initial check or plugin load in progress. */
  isLoading: boolean;
  /** Last error message from plugin. */
  error: string | null;
  /** Re-check availability (e.g. after app resume). */
  checkAvailability: () => Promise<void>;
  /** Verify user identity with biometric. Returns true on success. */
  authenticate: (options?: BiometricVerifyOptions) => Promise<boolean>;
  /** Securely store credentials (requires biometric to be available). */
  saveCredentials: (credentials: BiometricCredentials) => Promise<boolean>;
  /** Retrieve stored credentials (no prompt). Returns null if none or error. */
  getCredentials: () => Promise<BiometricCredentials | null>;
  /** Remove stored credentials from device. */
  deleteCredentials: () => Promise<boolean>;
  /** Enable biometric login in app (persists preference). */
  enableBiometric: () => void;
  /** Disable biometric login and clear stored credentials. */
  disableBiometric: () => Promise<void>;
  /** Human-readable label for current biometry type. */
  biometryLabel: string;
}

const BIOMETRIC_ENABLED_KEY = 'biometric_auth_enabled';
const BIOMETRIC_HAS_CREDENTIALS_KEY = 'biometric_has_credentials';
const CREDENTIALS_SERVER = 'viewi_auth';

const DEFAULT_VERIFY_OPTIONS: Required<BiometricVerifyOptions> = {
  reason: 'Sign in to viewi',
  title: 'Biometric Login',
  subtitle: 'Use your biometric to authenticate',
  description: 'Place your finger on the sensor or look at the camera',
  negativeButtonText: 'Cancel',
  maxAttempts: 3,
  useFallback: false,
};

function getBiometryLabel(type: BiometryType): string {
  switch (type) {
    case 'faceId':
      return 'Face ID';
    case 'fingerprint':
      return 'Fingerprint';
    case 'iris':
      return 'Iris';
    case 'multiple':
      return 'Biometric';
    default:
      return 'Biometric';
  }
}

export const useBiometricAuth = (): UseBiometricAuthReturn => {
  const [isAvailable, setIsAvailable] = useState(false);
  const [biometryType, setBiometryType] = useState<BiometryType>(null);
  const [platform, setPlatform] = useState<BiometricPlatform>('web');
  const [isEnabled, setIsEnabled] = useState(() => {
    return typeof localStorage !== 'undefined' && localStorage.getItem(BIOMETRIC_ENABLED_KEY) === 'true';
  });
  const [hasStoredCredentials, setHasStoredCredentials] = useState(() => {
    return typeof localStorage !== 'undefined' && localStorage.getItem(BIOMETRIC_HAS_CREDENTIALS_KEY) === 'true';
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [NativeBiometric, setNativeBiometric] = useState<typeof import('capacitor-native-biometric')['NativeBiometric'] | null>(null);

  useEffect(() => {
    const loadPlugin = async () => {
      try {
        const [{ NativeBiometric: BiometricPlugin }, { Capacitor }] = await Promise.all([
          import('capacitor-native-biometric'),
          import('@capacitor/core'),
        ]);
        const plat = Capacitor.getPlatform();
        if (plat === 'ios' || plat === 'android') {
          setPlatform(plat);
          setNativeBiometric(BiometricPlugin);
        } else {
          setPlatform('web');
          setNativeBiometric(null);
          setIsLoading(false);
        }
      } catch {
        setPlatform('web');
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
      setIsAvailable(!!result.isAvailable);

      if (result.biometryType != null) {
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to check biometric availability';
      console.error('Biometric availability check failed:', err);
      setIsAvailable(false);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [NativeBiometric]);

  useEffect(() => {
    if (NativeBiometric) {
      checkAvailability();
    }
  }, [NativeBiometric, checkAvailability]);

  const authenticate = useCallback(
    async (options?: BiometricVerifyOptions): Promise<boolean> => {
      if (!NativeBiometric || !isAvailable) {
        setError('Biometric authentication not available');
        return false;
      }

      const opts = { ...DEFAULT_VERIFY_OPTIONS, ...options };

      try {
        await NativeBiometric.verifyIdentity({
          reason: opts.reason,
          title: opts.title,
          subtitle: opts.subtitle,
          description: opts.description,
          negativeButtonText: opts.negativeButtonText,
          maxAttempts: opts.maxAttempts,
          useFallback: opts.useFallback,
        });
        setError(null);
        return true;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Authentication failed';
        console.error('Biometric authentication failed:', err);
        setError(message);
        return false;
      }
    },
    [NativeBiometric, isAvailable]
  );

  const saveCredentials = useCallback(
    async (credentials: BiometricCredentials): Promise<boolean> => {
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
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(BIOMETRIC_HAS_CREDENTIALS_KEY, 'true');
        }
        setHasStoredCredentials(true);
        setError(null);
        return true;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to save credentials';
        console.error('Failed to save credentials:', err);
        setError(message);
        return false;
      }
    },
    [NativeBiometric, isAvailable]
  );

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
    } catch {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(BIOMETRIC_HAS_CREDENTIALS_KEY);
      }
      setHasStoredCredentials(false);
      return null;
    }
  }, [NativeBiometric, isAvailable]);

  const deleteCredentials = useCallback(async (): Promise<boolean> => {
    if (!NativeBiometric) {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(BIOMETRIC_HAS_CREDENTIALS_KEY);
      }
      setHasStoredCredentials(false);
      return true;
    }

    try {
      await NativeBiometric.deleteCredentials({
        server: CREDENTIALS_SERVER,
      });
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(BIOMETRIC_HAS_CREDENTIALS_KEY);
      }
      setHasStoredCredentials(false);
      return true;
    } catch (err: unknown) {
      console.error('Failed to delete credentials:', err);
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(BIOMETRIC_HAS_CREDENTIALS_KEY);
      }
      setHasStoredCredentials(false);
      return false;
    }
  }, [NativeBiometric]);

  const enableBiometric = useCallback(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'true');
    }
    setIsEnabled(true);
  }, []);

  const disableBiometric = useCallback(async () => {
    await deleteCredentials();
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(BIOMETRIC_ENABLED_KEY, 'false');
    }
    setIsEnabled(false);
  }, [deleteCredentials]);

  return {
    isAvailable,
    biometryType,
    platform,
    isEnabled,
    hasStoredCredentials,
    isLoading,
    error,
    checkAvailability,
    authenticate,
    saveCredentials,
    getCredentials,
    deleteCredentials,
    enableBiometric,
    disableBiometric,
    biometryLabel: getBiometryLabel(biometryType),
  };
};
