import { useState, useCallback, useEffect } from 'react';
import { RESEND_OTP_COOLDOWN_SEC } from '@/services/auth.service';

export interface UsePhoneOtpOptions {
  onSend?: (phone: string) => Promise<{ error: Error | null }>;
  onResend?: (phone: string) => Promise<{ error: Error | null }>;
  cooldownSeconds?: number;
}

export interface UsePhoneOtpReturn {
  /** Seconds remaining until resend is allowed; 0 when allowed. */
  resendCooldownSec: number;
  /** True while send or resend request is in flight. */
  isSending: boolean;
  /** Request OTP for this phone (e.g. initial send). */
  sendOtp: (phone: string) => Promise<{ error: Error | null }>;
  /** Resend OTP for the same phone (e.g. after cooldown). */
  resendOtp: (phone: string) => Promise<{ error: Error | null }>;
  /** Start cooldown (call after successful send/resend). */
  startCooldown: () => void;
}

/**
 * Hook to manage OTP send/resend and cooldown for phone auth.
 * Use with AuthContext's signInWithPhone and resendOtp.
 */
export function usePhoneOtp(options: UsePhoneOtpOptions): UsePhoneOtpReturn {
  const {
    onSend,
    onResend,
    cooldownSeconds = RESEND_OTP_COOLDOWN_SEC,
  } = options;

  const [resendCooldownSec, setResendCooldownSec] = useState(0);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (resendCooldownSec <= 0) return;
    const t = setInterval(() => {
      setResendCooldownSec((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [resendCooldownSec]);

  const startCooldown = useCallback(() => {
    setResendCooldownSec(cooldownSeconds);
  }, [cooldownSeconds]);

  const sendOtp = useCallback(
    async (phone: string) => {
      if (!onSend) return { error: new Error('Send not configured') as Error };
      setIsSending(true);
      try {
        const result = await onSend(phone);
        if (!result.error) startCooldown();
        return result;
      } finally {
        setIsSending(false);
      }
    },
    [onSend, startCooldown]
  );

  const resendOtp = useCallback(
    async (phone: string) => {
      if (resendCooldownSec > 0) return { error: new Error('Cooldown active') as Error };
      const fn = onResend ?? onSend;
      if (!fn) return { error: new Error('Resend not configured') as Error };
      setIsSending(true);
      try {
        const result = await fn(phone);
        if (!result.error) startCooldown();
        return result;
      } finally {
        setIsSending(false);
      }
    },
    [onResend, onSend, resendCooldownSec, startCooldown]
  );

  return {
    resendCooldownSec,
    isSending,
    sendOtp,
    resendOtp,
    startCooldown,
  };
}
