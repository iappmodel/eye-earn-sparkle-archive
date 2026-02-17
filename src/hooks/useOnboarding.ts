/**
 * useOnboarding – Manages onboarding state: product tour + KYC flow.
 * Persists progress, supports re-opening from profile, and exposes progress percentage.
 */
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const STORAGE_PREFIX = 'onboarding_';
const NEW_USER_WINDOW_MS = 48 * 60 * 60 * 1000; // 48 hours

export type OnboardingPhase = 'idle' | 'product_tour' | 'kyc';

export interface OnboardingProgress {
  productTourCompleted: boolean;
  productTourSkipped: boolean;
  welcomeSeen: boolean;
  selfieDone: boolean;
  idUploadDone: boolean;
}

function getStorageKey(userId: string, key: string): string {
  return `${STORAGE_PREFIX}${key}_${userId}`;
}

function readBool(userId: string | undefined, key: string): boolean {
  if (!userId || typeof window === 'undefined') return false;
  return localStorage.getItem(getStorageKey(userId, key)) === 'true';
}

function setBool(userId: string | undefined, key: string, value: boolean): void {
  if (!userId || typeof window === 'undefined') return;
  if (value) {
    localStorage.setItem(getStorageKey(userId, key), 'true');
  } else {
    localStorage.removeItem(getStorageKey(userId, key));
  }
}

export interface UseOnboardingResult {
  /** Whether the onboarding overlay should be shown */
  showOnboarding: boolean;
  /** Current phase: product_tour (slides) or kyc (verification steps) */
  phase: OnboardingPhase;
  /** 0–100 overall progress (tour + KYC steps) */
  progressPercentage: number;
  /** KYC status from DB/profile */
  kycStatus: string;
  /** User needs verification (KYC not approved) */
  needsVerification: boolean;
  /** Loading initial state (KYC check) */
  isLoading: boolean;
  /** Progress flags for UI */
  progress: OnboardingProgress;
  /** Open onboarding (e.g. from profile) */
  openOnboarding: (options?: { phase?: OnboardingPhase }) => void;
  /** Close and optionally dismiss (don't show again until re-opened) */
  closeOnboarding: () => void;
  /** Complete flow without dismissing (e.g. skip KYC; can re-open from profile) */
  completeOnboarding: () => void;
  /** Mark product tour as completed (seen all slides and tapped Get Started) */
  completeProductTour: () => void;
  /** Mark product tour as skipped */
  skipProductTour: () => void;
  /** Mark a KYC step as done (for progress %) */
  markStepComplete: (step: keyof Pick<OnboardingProgress, 'welcomeSeen' | 'selfieDone' | 'idUploadDone'>) => void;
}

export function useOnboarding(): UseOnboardingResult {
  const { user, profile } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [phase, setPhase] = useState<OnboardingPhase>('idle');
  const [isLoading, setIsLoading] = useState(true);
  const [kycStatus, setKycStatus] = useState<string>('pending');
  const [progress, setProgress] = useState<OnboardingProgress>({
    productTourCompleted: false,
    productTourSkipped: false,
    welcomeSeen: false,
    selfieDone: false,
    idUploadDone: false,
  });

  const userId = user?.id;

  // Load persisted progress
  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }
    setProgress((prev) => ({
      ...prev,
      productTourCompleted: readBool(userId, 'product_tour_completed'),
      productTourSkipped: readBool(userId, 'product_tour_skipped'),
      welcomeSeen: readBool(userId, 'welcome_seen'),
      selfieDone: readBool(userId, 'selfie_done'),
      idUploadDone: readBool(userId, 'id_upload_done'),
    }));
  }, [userId]);

  // Check KYC and decide whether to show onboarding
  useEffect(() => {
    const check = async () => {
      if (!user) {
        setKycStatus('pending');
        setIsLoading(false);
        return;
      }
      try {
        const { data: kycData } = await supabase
          .from('kyc_submissions')
          .select('status')
          .eq('user_id', user.id)
          .maybeSingle();

        const status = kycData?.status ?? profile?.kyc_status ?? 'pending';
        setKycStatus(status);

        const dismissed = localStorage.getItem(getStorageKey(user.id, 'dismissed'));
        const isNewUser =
          user.created_at &&
          new Date(user.created_at).getTime() > Date.now() - NEW_USER_WINDOW_MS;

        const productTourDone =
          readBool(user.id, 'product_tour_completed') || readBool(user.id, 'product_tour_skipped');
        const kycApproved = status === 'approved' || status === 'verified';

        if (kycApproved) {
          setShowOnboarding(false);
          setPhase('idle');
        } else if (dismissed === 'true') {
          setShowOnboarding(false);
          setPhase('idle');
        } else if (isNewUser && !productTourDone) {
          setShowOnboarding(true);
          setPhase('product_tour');
        } else {
          setShowOnboarding(true);
          setPhase('kyc');
        }
      } catch (e) {
        console.error('Error checking onboarding status:', e);
        setKycStatus('pending');
      } finally {
        setIsLoading(false);
      }
    };
    check();
  }, [user?.id, user?.created_at, profile?.kyc_status]);

  const openOnboarding = useCallback(
    (options?: { phase?: OnboardingPhase }) => {
      setShowOnboarding(true);
      if (options?.phase) {
        setPhase(options.phase);
      } else if (kycStatus === 'approved' || kycStatus === 'verified') {
        setPhase('product_tour');
      } else {
        setPhase('kyc');
      }
    },
    [kycStatus]
  );

  const closeOnboarding = useCallback(() => {
    setShowOnboarding(false);
    setPhase('idle');
    if (userId) {
      localStorage.setItem(getStorageKey(userId, 'dismissed'), 'true');
    }
  }, [userId]);

  const completeOnboarding = useCallback(() => {
    setShowOnboarding(false);
    setPhase('idle');
    // Do not set dismissed so user can re-open from profile
  }, []);

  const completeProductTour = useCallback(() => {
    if (userId) {
      setBool(userId, 'product_tour_completed', true);
      setProgress((p) => ({ ...p, productTourCompleted: true }));
    }
    setPhase('kyc');
    // Keep showOnboarding true so KYC flow shows next
  }, [userId]);

  const skipProductTour = useCallback(() => {
    if (userId) {
      setBool(userId, 'product_tour_skipped', true);
      setProgress((p) => ({ ...p, productTourSkipped: true }));
    }
    setPhase('kyc');
  }, [userId]);

  const markStepComplete = useCallback(
    (step: keyof Pick<OnboardingProgress, 'welcomeSeen' | 'selfieDone' | 'idUploadDone'>) => {
      if (!userId) return;
      setBool(userId, step === 'welcomeSeen' ? 'welcome_seen' : step === 'selfieDone' ? 'selfie_done' : 'id_upload_done', true);
      setProgress((p) => ({ ...p, [step]: true }));
    },
    [userId]
  );

  // Progress: tour 20%, welcome 20%, selfie 20%, id 20%, verification 20%
  const progressPercentage = (() => {
    let p = 0;
    if (progress.productTourCompleted || progress.productTourSkipped) p += 20;
    if (progress.welcomeSeen) p += 20;
    if (progress.selfieDone) p += 20;
    if (progress.idUploadDone) p += 20;
    if (kycStatus === 'approved' || kycStatus === 'verified') p += 20;
    else if (kycStatus === 'submitted' || kycStatus === 'under_review') p += 10;
    return Math.min(100, p);
  })();

  return {
    showOnboarding,
    phase,
    progressPercentage,
    kycStatus,
    needsVerification: kycStatus !== 'approved' && kycStatus !== 'verified',
    isLoading,
    progress,
    openOnboarding,
    closeOnboarding,
    completeOnboarding,
    completeProductTour,
    skipProductTour,
    markStepComplete,
  };
}
