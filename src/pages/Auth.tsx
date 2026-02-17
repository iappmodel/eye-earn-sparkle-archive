import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Mail, Lock, User, Loader2, ArrowLeft, Phone, KeyRound } from 'lucide-react';
import { z } from 'zod';
import { AppLogo } from '@/components/AppLogo';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { BiometricLoginButton } from '@/components/BiometricLoginButton';
import { useBiometricAuth } from '@/hooks/useBiometricAuth';
import {
  getAuthErrorMessage,
  getGoogleAuthErrorMessage,
  getPasswordStrength,
  validatePasswordForSignup,
  validatePasswordMatch,
  getAuthRedirectUrl,
  getPhoneAuthErrorMessage,
  isRetryableAuthError,
  normalizePhoneToE164,
  isValidE164,
  formatPhoneForDisplay,
  RESET_PASSWORD_COOLDOWN_SEC,
} from '@/services/auth.service';
import { usePhoneOtp } from '@/hooks/usePhoneOtp';
import { COUNTRY_CALLING_CODES, DEFAULT_COUNTRY_CODE } from '@/constants/phone';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const emailSchema = z.string().email('Please enter a valid email address');
const passwordSchemaLogin = z.string().min(1, 'Password is required');
const passwordSchemaSignup = z.string().min(8, 'Password must be at least 8 characters');
const usernameSchema = z.string().min(3, 'Username must be at least 3 characters').max(20, 'Username must be less than 20 characters').regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores');

type AuthMode = 'login' | 'signup' | 'forgot' | 'reset' | 'phone' | 'otp';

const Auth: React.FC = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const returnPath = (location.state as { from?: string } | null)?.from;
  const [mode, setMode] = useState<AuthMode>(() => {
    const urlMode = searchParams.get('mode');
    if (urlMode === 'reset') return 'reset';
    if (urlMode === 'forgot') return 'forgot';
    return 'login';
  });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState(DEFAULT_COUNTRY_CODE);
  const [nationalNumber, setNationalNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; username?: string; phone?: string; confirmPassword?: string }>({});
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [resetCooldownRemaining, setResetCooldownRemaining] = useState(0);
  const [otpSent, setOtpSent] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [signupNeedsConfirmation, setSignupNeedsConfirmation] = useState(false);
  const [isGoogleRedirecting, setIsGoogleRedirecting] = useState(false);
  const otpAutoSubmitDone = useRef(false);

  const {
    signIn,
    signUp,
    signInWithGoogle,
    signInWithPhone,
    resendOtp,
    verifyOtp,
    resetPassword,
    updatePassword,
    clearRecoverySession,
    resendVerificationEmail,
    user,
    loading,
    isRecoverySession,
  } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { resendCooldownSec, isSending: isOtpSending, sendOtp, resendOtp: triggerResendOtp } = usePhoneOtp({
    onSend: signInWithPhone,
    onResend: resendOtp,
  });

  const redirectTo = returnPath && returnPath.startsWith('/') ? returnPath : getAuthRedirectUrl(searchParams.get('redirect'));
  const showSetNewPassword = isRecoverySession || (mode === 'reset' && !!user);
  const { isAvailable: biometricAvailable, isEnabled: biometricEnabled } = useBiometricAuth();

  /** Run an auth operation with up to 2 retries for transient (network/server) errors. */
  const withAuthRetry = useCallback(
    async <T extends { error?: unknown }>(op: () => Promise<T>, maxRetries = 2): Promise<T> => {
      let last: T | null = null;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        last = await op();
        if (!last?.error) return last;
        const err = last.error instanceof Error ? last.error : new Error(String(last.error));
        if (attempt < maxRetries && isRetryableAuthError(err)) {
          toast({
            title: 'Connection issue',
            description: `Retrying… (${attempt + 1}/${maxRetries})`,
            variant: 'default',
          });
          await new Promise((r) => setTimeout(r, 1500 + attempt * 500));
          continue;
        }
        return last;
      }
      return last!;
    },
    [toast]
  );

  const passwordStrength = useMemo(
    () => (password ? getPasswordStrength(password) : null),
    [password]
  );

  useEffect(() => {
    if (user && !loading && !showSetNewPassword) {
      navigate(redirectTo, { replace: true });
    }
  }, [user, loading, showSetNewPassword, navigate, redirectTo]);

  // Cooldown timer for password reset email (prevents spam, aligns with Supabase rate limit)
  useEffect(() => {
    if (resetCooldownRemaining <= 0) return;
    const t = setInterval(() => {
      setResetCooldownRemaining((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [resetCooldownRemaining]);

  // Auto-submit OTP when 6 digits entered (once per OTP screen)
  useEffect(() => {
    if (mode !== 'otp' || otp.length !== 6 || otpAutoSubmitDone.current || isSubmitting || !phone) return;
    otpAutoSubmitDone.current = true;
    let cancelled = false;
    (async () => {
      setIsSubmitting(true);
      try {
        const { error } = await withAuthRetry(() => verifyOtp(phone, otp));
        if (cancelled) return;
        if (error) {
          toast({ title: 'Verification Failed', description: getPhoneAuthErrorMessage(error), variant: 'destructive' });
          otpAutoSubmitDone.current = false;
        } else {
          toast({ title: 'Welcome!', description: 'You have successfully logged in.' });
          navigate(redirectTo, { replace: true });
        }
      } catch {
        if (!cancelled) {
          toast({ title: 'Error', description: 'Something went wrong. Please try again.', variant: 'destructive' });
          otpAutoSubmitDone.current = false;
        }
      } finally {
        if (!cancelled) setIsSubmitting(false);
      }
    })();
    return () => { cancelled = true; };
  }, [mode, otp, phone, isSubmitting, verifyOtp, withAuthRetry, toast, navigate, redirectTo]);

  const validateForm = () => {
    const newErrors: { email?: string; password?: string; username?: string; phone?: string; confirmPassword?: string } = {};

    if (mode === 'phone') {
      const e164 = normalizePhoneToE164(countryCode, nationalNumber);
      if (!e164 || !isValidE164(e164)) {
        newErrors.phone = 'Please enter a valid phone number (e.g. 10+ digits).';
      }
      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    }

    if (mode === 'otp') {
      setErrors(newErrors);
      return otp.length === 6;
    }

    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) newErrors.email = emailResult.error.errors[0].message;

    if (mode !== 'forgot') {
      const schema = mode === 'signup' ? passwordSchemaSignup : passwordSchemaLogin;
      const passwordResult = schema.safeParse(password);
      if (!passwordResult.success) newErrors.password = passwordResult.error.errors[0].message;
      if (mode === 'signup') {
        const signupCheck = validatePasswordForSignup(password);
        if (!signupCheck.valid) newErrors.password = signupCheck.message;
        const matchCheck = validatePasswordMatch(password, confirmPassword);
        if (!matchCheck.valid) newErrors.confirmPassword = matchCheck.message;
      }
    }

    if (mode === 'signup') {
      const usernameResult = usernameSchema.safeParse(username);
      if (!usernameResult.success) newErrors.username = usernameResult.error.errors[0].message;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const pv = validatePasswordForSignup(password);
    const mv = validatePasswordMatch(password, confirmPassword);
    if (!pv.valid) {
      setErrors((prev) => ({ ...prev, password: pv.message }));
      return;
    }
    if (!mv.valid) {
      setErrors((prev) => ({ ...prev, confirmPassword: mv.message }));
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await withAuthRetry(() => updatePassword(password));
      if (error) {
        toast({ title: 'Update Failed', description: getAuthErrorMessage(error), variant: 'destructive' });
      } else {
        clearRecoverySession();
        toast({ title: 'Password updated', description: 'You can now sign in with your new password.' });
        setPassword('');
        setConfirmPassword('');
      }
    } catch {
      toast({ title: 'Error', description: 'Something went wrong. Please try again.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setIsSubmitting(true);
    setSignupNeedsConfirmation(false);
    try {
      if (mode === 'phone') {
        const e164 = normalizePhoneToE164(countryCode, nationalNumber);
        const { error } = await withAuthRetry(() => sendOtp(e164));
        if (error) {
          toast({ title: 'Failed to send OTP', description: getPhoneAuthErrorMessage(error), variant: 'destructive' });
        } else {
          setPhone(e164);
          setOtpSent(true);
          otpAutoSubmitDone.current = false;
          setMode('otp');
          setOtp('');
          toast({ title: 'OTP Sent', description: 'Check your phone for the verification code.' });
        }
      } else if (mode === 'otp') {
        otpAutoSubmitDone.current = true;
        const { error } = await withAuthRetry(() => verifyOtp(phone, otp));
        if (error) {
          otpAutoSubmitDone.current = false;
          toast({ title: 'Verification Failed', description: getPhoneAuthErrorMessage(error), variant: 'destructive' });
        } else {
          toast({ title: 'Welcome!', description: 'You have successfully logged in.' });
          navigate(redirectTo, { replace: true });
        }
      } else if (mode === 'forgot') {
        const { error } = await withAuthRetry(() => resetPassword(email));
        if (error) {
          toast({ title: 'Reset Failed', description: getAuthErrorMessage(error), variant: 'destructive' });
        } else {
          setResetEmailSent(true);
          setResetCooldownRemaining(RESET_PASSWORD_COOLDOWN_SEC);
          toast({
            title: 'Check your email',
            description: 'If an account exists for that email, we sent a password reset link. It may take a few minutes and could be in spam.',
          });
        }
      } else if (mode === 'login') {
        const { error } = await withAuthRetry(() => signIn(email, password));
        if (error) {
          toast({ title: 'Login Failed', description: getAuthErrorMessage(error), variant: 'destructive' });
        } else {
          toast({ title: 'Welcome back!', description: 'You have successfully logged in.' });
          navigate(redirectTo, { replace: true });
        }
      } else if (mode === 'signup') {
        const { error } = await withAuthRetry(() => signUp(email, password, username));
        if (error) {
          toast({ title: 'Signup Failed', description: getAuthErrorMessage(error), variant: 'destructive' });
        } else {
          setSignupNeedsConfirmation(true);
          toast({
            title: 'Account created!',
            description: 'Check your email to confirm your account, or sign in if confirmation is not required.',
          });
        }
      }
    } catch {
      toast({ title: 'Error', description: 'An unexpected error occurred. Please try again.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    setIsGoogleRedirecting(true);
    try {
      const redirectTo = returnPath && returnPath.startsWith('/') ? returnPath : undefined;
      const { error } = await signInWithGoogle(redirectTo ? { redirectTo } : undefined);
      if (error) {
        setIsGoogleRedirecting(false);
        toast({ title: 'Google Sign In Failed', description: getGoogleAuthErrorMessage(error), variant: 'destructive' });
      }
    } catch (err) {
      setIsGoogleRedirecting(false);
      toast({
        title: 'Error',
        description: getGoogleAuthErrorMessage(err instanceof Error ? err : new Error(String(err))),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setErrors({});
    setResetEmailSent(false);
    setResetCooldownRemaining(0);
    setOtpSent(false);
    setSignupNeedsConfirmation(false);
    setOtp('');
    if (newMode === 'phone') {
      setPhone('');
      setNationalNumber('');
      setCountryCode(DEFAULT_COUNTRY_CODE);
    }
    if (newMode === 'otp') otpAutoSubmitDone.current = false;
  };

  const handleResendResetLink = async () => {
    if (resetCooldownRemaining > 0 || !email.trim()) return;
    setIsSubmitting(true);
    try {
      const { error } = await withAuthRetry(() => resetPassword(email));
      if (error) {
        toast({ title: 'Resend Failed', description: getAuthErrorMessage(error), variant: 'destructive' });
      } else {
        setResetCooldownRemaining(RESET_PASSWORD_COOLDOWN_SEC);
        toast({
          title: 'Link sent again',
          description: 'Check your inbox (and spam folder) for the new reset link.',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    setIsSubmitting(true);
    try {
      const { error } = await withAuthRetry(() => resendVerificationEmail(email || undefined));
      if (error) {
        toast({ title: 'Resend Failed', description: getAuthErrorMessage(error), variant: 'destructive' });
      } else {
        toast({ title: 'Email sent', description: 'Check your inbox for the confirmation link.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const getTitle = () => {
    switch (mode) {
      case 'login': return 'Welcome Back';
      case 'signup': return 'Join viewi';
      case 'forgot': return 'Reset Password';
      case 'reset': return 'Set New Password';
      case 'phone': return 'Phone Login';
      case 'otp': return 'Enter Code';
    }
  };

  const getSubtitle = () => {
    switch (mode) {
      case 'login': return 'Sign in to continue earning';
      case 'signup': return 'Start earning by watching & creating';
      case 'forgot': return 'Enter your email to receive a reset link';
      case 'reset': return 'Enter your new password';
      case 'phone': return 'Enter your phone number to receive a code';
      case 'otp': return `Enter the 6-digit code sent to ${phone ? formatPhoneForDisplay(phone) : 'your phone'}`;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      {/* Logo/Brand */}
      <div className="mb-8 text-center">
        <div className="w-20 h-20 mx-auto mb-4 neu-card rounded-2xl flex items-center justify-center">
          <AppLogo size="xl" />
        </div>
        <h1 className="text-2xl font-display font-semibold text-foreground">
          {showSetNewPassword ? 'Set New Password' : getTitle()}
        </h1>
        <p className="text-muted-foreground mt-2">
          {showSetNewPassword ? 'Choose a secure password for your account' : getSubtitle()}
        </p>
      </div>

      {/* Auth Form */}
      <div className="w-full max-w-sm">
        {/* Set new password (recovery flow) */}
        {showSetNewPassword ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Choose a new password. Use at least 8 characters with a mix of letters, numbers, and symbols for better security.</p>
            <form onSubmit={handleSetNewPassword} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-foreground">New password</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="New password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 bg-secondary border-border focus:border-primary"
                    aria-describedby={errors.password ? 'new-password-error' : undefined}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {passwordStrength && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            i <= passwordStrength.score
                              ? passwordStrength.score <= 1
                                ? 'bg-destructive'
                                : passwordStrength.score <= 2
                                  ? 'bg-amber-500'
                                  : 'bg-primary'
                              : 'bg-muted'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">{passwordStrength.label}</p>
                  </div>
                )}
                {errors.password && <p id="new-password-error" className="text-sm text-destructive">{errors.password}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-new-password" className="text-foreground">Confirm password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="confirm-new-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 bg-secondary border-border focus:border-primary"
                  />
                </div>
                {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
              </div>
              <Button
                type="submit"
                disabled={isSubmitting || !password || password !== confirmPassword || !passwordStrength?.meetsMinimum}
                className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-lg"
              >
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Update password'}
              </Button>
              <p className="text-xs text-muted-foreground text-center pt-2">
                Link expired or not working?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setEmail(user?.email ?? '');
                    setMode('forgot');
                    clearRecoverySession();
                  }}
                  className="text-primary hover:underline font-medium"
                >
                  Request a new reset link
                </button>
              </p>
            </form>
          </div>
        ) : (
        <>
        {/* Back button for forgot password or phone login */}
        {(mode === 'forgot' || mode === 'phone' || mode === 'otp') && (
          <button
            type="button"
            onClick={() => mode === 'otp' ? switchMode('phone') : switchMode('login')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            {mode === 'otp' ? 'Change phone number' : 'Back to login'}
          </button>
        )}

        {/* Reset email sent success */}
        {resetEmailSent ? (
          <div className="text-center space-y-4" role="status" aria-live="polite">
            <div className="w-16 h-16 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
              <Mail className="w-8 h-8 text-primary" aria-hidden />
            </div>
            <p className="text-foreground font-medium">Check your email</p>
            <p className="text-sm text-muted-foreground">
              If an account exists for <span className="font-medium text-foreground">{email}</span>, we sent a password reset link. The link expires in 1 hour. Check your spam or junk folder if you don&apos;t see it.
            </p>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResendResetLink}
                disabled={resetCooldownRemaining > 0 || isSubmitting}
                className="w-full"
              >
                {resetCooldownRemaining > 0
                  ? `Resend link in ${resetCooldownRemaining}s`
                  : isSubmitting
                    ? 'Sending…'
                    : 'Resend reset link'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => switchMode('login')}
                className="w-full"
              >
                Back to login
              </Button>
            </div>
          </div>
        ) : mode === 'otp' ? (
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>
            <div className="flex flex-col items-center space-y-4">
              <Label htmlFor="otp-input" className="text-foreground">
                Verification Code
              </Label>
              <InputOTP
                id="otp-input"
                value={otp}
                onChange={setOtp}
                maxLength={6}
                aria-label="One-time verification code, 6 digits"
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || otp.length !== 6}
              className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-lg"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
              ) : (
                'Verify Code'
              )}
            </Button>

            <div className="text-center">
              <button
                type="button"
                onClick={async () => {
                  const { error } = await triggerResendOtp(phone);
                  if (error) {
                    toast({
                      title: 'Resend failed',
                      description: getPhoneAuthErrorMessage(error),
                      variant: 'destructive',
                    });
                  } else {
                    toast({ title: 'Code sent again', description: 'Check your phone for the new code.' });
                  }
                }}
                disabled={isSubmitting || resendCooldownSec > 0 || isOtpSending}
                className="text-sm text-primary hover:text-primary/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resendCooldownSec > 0
                  ? `Resend code in ${resendCooldownSec}s`
                  : isOtpSending
                    ? 'Sending…'
                    : 'Resend code'}
              </button>
            </div>
          </form>
        ) : mode === 'phone' ? (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="phone-national" className="text-foreground">
                Phone Number
              </Label>
              <div className="flex gap-2">
                <Select value={countryCode} onValueChange={setCountryCode}>
                  <SelectTrigger id="phone-country" className="w-[110px] shrink-0 bg-secondary border-border">
                    <SelectValue placeholder="Code" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRY_CALLING_CODES.map(({ code, label, dial }) => (
                      <SelectItem key={code} value={code}>
                        {dial} {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative flex-1">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                  <Input
                    id="phone-national"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder="555 123 4567"
                    value={nationalNumber}
                    onChange={(e) => setNationalNumber(e.target.value.replace(/\D/g, '').slice(0, 15))}
                    className="pl-10 bg-secondary border-border focus:border-primary"
                    aria-invalid={!!errors.phone}
                    aria-describedby={errors.phone ? 'phone-error' : undefined}
                  />
                </div>
              </div>
              {errors.phone && (
                <p id="phone-error" className="text-sm text-destructive" role="alert">
                  {errors.phone}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Enter your number without the country code. We&apos;ll send an SMS verification code.
              </p>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting || isOtpSending}
              className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-lg"
            >
              {isSubmitting || isOtpSending ? (
                <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
              ) : (
                'Send Code'
              )}
            </Button>
          </form>
        ) : (
          <>
            {/* Quick biometric login when enabled */}
            {mode === 'login' && biometricAvailable && biometricEnabled && (
              <div className="space-y-3 mb-4">
                <BiometricLoginButton
                  onSuccess={() => navigate(redirectTo)}
                  variant="default"
                  verifyReason="Sign in to viewi"
                />
                <div className="relative flex items-center">
                  <div className="w-full border-t border-border" />
                  <span className="bg-background px-3 text-sm text-muted-foreground">or sign in with email</span>
                  <div className="w-full border-t border-border" />
                </div>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-foreground">Username</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="username"
                      type="text"
                      placeholder="Choose a username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="pl-10 bg-secondary border-border focus:border-primary"
                    />
                  </div>
                  {errors.username && (
                    <p className="text-sm text-destructive">{errors.username}</p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder={mode === 'forgot' ? 'Email address for your account' : 'Enter your email'}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-secondary border-border focus:border-primary"
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email}</p>
                )}
              </div>

                {mode !== 'forgot' && mode !== 'reset' && (
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-foreground">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                    placeholder={mode === 'signup' ? 'At least 8 characters' : 'Enter your password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 bg-secondary border-border focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {(mode === 'signup' && passwordStrength) && (
                    <div className="space-y-1">
                      <div className="flex gap-1">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className={`h-1 flex-1 rounded-full transition-colors ${
                              i <= passwordStrength.score
                                ? passwordStrength.score <= 1
                                  ? 'bg-destructive'
                                  : passwordStrength.score <= 2
                                    ? 'bg-amber-500'
                                    : 'bg-primary'
                              : 'bg-muted'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">{passwordStrength.label}</p>
                    </div>
                  )}
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password}</p>
                  )}
                </div>
              )}

              {mode === 'signup' && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-foreground">Confirm password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Confirm your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10 bg-secondary border-border focus:border-primary"
                    />
                  </div>
                  {errors.confirmPassword && (
                    <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                  )}
                </div>
              )}

              {/* Forgot password link */}
              {mode === 'login' && (
                <div className="text-right">
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-sm text-primary hover:text-primary/80 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
              )}

              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-lg"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : mode === 'login' ? (
                  'Sign In'
                ) : mode === 'signup' ? (
                  'Create Account'
                ) : (
                  'Send Reset Link'
                )}
              </Button>
            </form>

            {/* Social Login Divider */}
            {(mode === 'login' || mode === 'signup') && (
              <>
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="bg-background px-4 text-muted-foreground">or continue with</span>
                  </div>
                </div>

                {/* Social Login Buttons */}
                <div className="space-y-3">
                  {/* Biometric: setup CTA when available but not enabled; login button when enabled (if not shown at top) */}
                  {mode === 'login' && biometricAvailable && !biometricEnabled && (
                    <BiometricLoginButton
                      showWhenDisabled
                      onSetupClick={() =>
                        toast({
                          title: 'Set up in Settings',
                          description: 'Sign in with email first, then go to Profile → Settings → Security to enable biometric login.',
                        })
                      }
                    />
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGoogleSignIn}
                    disabled={isSubmitting}
                    className="w-full h-12 border-border hover:bg-secondary"
                  >
                    {isGoogleRedirecting ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Redirecting to Google…
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" aria-hidden>
                          <path
                            fill="currentColor"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="currentColor"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="currentColor"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          />
                          <path
                            fill="currentColor"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          />
                        </svg>
                        Continue with Google
                      </>
                    )}
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => switchMode('phone')}
                    disabled={isSubmitting}
                    className="w-full h-12 border-border hover:bg-secondary"
                  >
                    <Phone className="w-5 h-5 mr-2" />
                    Continue with Phone
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    disabled
                    className="w-full h-12 border-border opacity-50 cursor-not-allowed"
                  >
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                    </svg>
                    Apple (Coming Soon)
                  </Button>
                </div>
              </>
            )}

            {/* Toggle Login/Signup */}
            {(mode === 'login' || mode === 'signup') && (
              <div className="mt-6 text-center">
                <p className="text-muted-foreground">
                  {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}
                </p>
                <button
                  type="button"
                  onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
                  className="mt-1 text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  {mode === 'login' ? 'Sign up' : 'Sign in'}
                </button>
              </div>
            )}

            {/* Terms */}
            {mode === 'signup' && (
              <p className="mt-6 text-xs text-muted-foreground text-center">
                By creating an account, you agree to our Terms of Service and Privacy Policy
              </p>
            )}

            {/* Signup: check email confirmation */}
            {signupNeedsConfirmation && (
              <div className="mt-4 p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
                <p className="text-sm text-foreground">Check your email to confirm your account.</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResendVerification}
                  disabled={isSubmitting}
                  className="w-full"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Resend confirmation email'}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => switchMode('login')} className="w-full">
                  Back to sign in
                </Button>
              </div>
            )}
          </>
        )}
        </>
        )}
      </div>
    </div>
  );
};

export default Auth;
