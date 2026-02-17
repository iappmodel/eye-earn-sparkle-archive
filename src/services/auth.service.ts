/**
 * Auth service: constants, error mapping, password validation, and helpers
 * for Supabase Auth (email/password and related flows).
 */

/** Base URL for auth redirects (e.g. password reset, email confirm). */
export const AUTH_REDIRECT_BASE = typeof window !== 'undefined' ? window.location.origin : '';

/** Auth redirect paths. */
export const AUTH_PATHS = {
  /** After login/signup. */
  home: '/',
  /** Auth page with optional mode (login, signup, forgot, reset). */
  auth: '/auth',
  /** Password reset form (user lands here from email link). */
  authReset: '/auth?mode=reset',
} as const;

/** SessionStorage key for storing intended path before OAuth redirect (e.g. Google). */
export const OAUTH_REDIRECT_STORAGE_KEY = 'iview_oauth_redirect_path';

/** User-friendly messages for known Supabase Auth error codes/messages. */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'Invalid login credentials': 'Invalid email or password. Please try again.',
  'invalid_credentials': 'Invalid email or password. Please try again.',
  'invalid_grant': 'Invalid or expired link. Please request a new one.',
  'email_not_confirmed': 'Please confirm your email address before signing in.',
  'User already registered': 'This email is already registered. Please sign in instead.',
  'already registered': 'This email is already registered. Please sign in instead.',
  'Signup requires a valid password': 'Please choose a stronger password (at least 8 characters).',
  'Password should be at least 6 characters': 'Password must be at least 8 characters.',
  'Unable to validate email address': 'Please enter a valid email address.',
  'For security purposes, you can only request this once every 60 seconds': 'Please wait a minute before requesting another reset link.',
  'rate_limit_exceeded': 'Too many attempts. Please try again in a few minutes.',
  'over_email_send_limit': 'Too many emails sent. Please try again later.',
  'session_expired': 'Your session expired. Please sign in again.',
  // Password reset
  'Password link is invalid or has expired': 'This reset link has expired. Please request a new one.',
  'Email link is invalid or has expired': 'This reset link has expired. Please request a new one.',
  'Token has expired or is invalid': 'This reset link has expired or is invalid. Please request a new one.',
  'invalid_redirect_url': 'Reset link could not be opened. Please try again or contact support.',
  'New password should be different from the old password': 'Please choose a different password than your current one.',
  'Auth session missing': 'Your session expired. Please sign in again.',
  // Google / OAuth
  'access_denied': 'Sign-in was cancelled or denied. Please try again.',
  'popup_closed_by_user': 'Sign-in window was closed. Please try again.',
  'oauth_callback_error': 'Sign-in failed. Please try again.',
  'Provider not enabled': 'Google sign-in is not configured. Please use email or contact support.',
  // Phone / OTP
  'Invalid phone number': 'Please enter a valid phone number in international format (e.g. +1234567890).',
  'invalid_phone_number': 'Please enter a valid phone number in international format.',
  'Phone not confirmed': 'This phone number is not verified. Please complete verification.',
  'OTP expired': 'This code has expired. Please request a new one.',
  'Invalid OTP': 'The code you entered is incorrect. Please try again.',
  'SMS rate limit exceeded': 'Too many codes sent. Please wait a few minutes before trying again.',
  'Phone signups are disabled': 'Phone sign-in is not available. Please use email or contact support.',
  // Network / connection
  'Failed to fetch': 'Check your internet connection and try again.',
  'Network request failed': 'Network error. Please check your connection and try again.',
  'NetworkError': 'Network error. Please check your connection and try again.',
  'Load failed': 'Connection failed. Please try again.',
}

/** True when the error is transient (network, server 5xx, rate limit). Safe to retry. */
export function isRetryableAuthError(error: Error | { message?: string } | null): boolean {
  if (!error) return false;
  const msg = (error as Error).message ?? '';
  if (/failed to fetch|network request failed|networkerror|load failed/i.test(msg)) return true;
  if (/500|502|503|504|429/i.test(msg)) return true;
  if ((error as Error).name === 'TypeError' && /fetch/i.test(msg)) return true;
  return false;
}

/** Cooldown in seconds before user can request another OTP (align with Supabase/SMS provider limits). */
export const RESEND_OTP_COOLDOWN_SEC = 60;

/** Cooldown in seconds before user can request another password reset email (Supabase rate limit). */
export const RESET_PASSWORD_COOLDOWN_SEC = 60;

/** Normalize to E.164: ensure + prefix and digits only (no spaces/dashes). */
export function normalizePhoneToE164(countryCode: string, nationalNumber: string): string {
  const digits = (countryCode.replace(/\D/g, '') + nationalNumber.replace(/\D/g, '')).replace(/^0+/, '');
  return digits ? `+${digits}` : '';
}

/** Validate E.164-like string (optional +, then 10–15 digits). */
export function isValidE164(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length >= 10 && cleaned.length <= 15 && /^[1-9]\d{9,14}$/.test(cleaned);
}

/** Mask phone for display on OTP screen (e.g. +1 *** *** 7890). */
export function formatPhoneForDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return phone;
  const lastFour = digits.slice(-4);
  const rest = digits.slice(0, -4);
  const masked = rest.replace(/\d/g, '*');
  return `+${masked} ${lastFour}`;
}

/** User-friendly message for phone/OTP auth errors. */
export function getPhoneAuthErrorMessage(error: Error | { message?: string } | null): string {
  if (!error) return 'Something went wrong. Please try again.';
  const msg = (error as Error).message ?? '';
  if (/429|rate limit|too many requests|60 seconds/i.test(msg)) {
    return 'Too many attempts. Please wait a minute before requesting another code.';
  }
  if (/expired|invalid.*token|invalid.*otp/i.test(msg)) {
    return 'This code has expired or is invalid. Please request a new code.';
  }
  return (AUTH_ERROR_MESSAGES[msg] ?? msg) || 'Something went wrong. Please try again.';
}

/** Map raw auth error to a user-friendly message. */
export function getAuthErrorMessage(error: Error | { message?: string } | null): string {
  if (!error) return 'An unexpected error occurred. Please try again.';
  const msg = (error as Error).message ?? '';
  if (/429|rate limit|too many requests/i.test(msg)) {
    return 'Too many attempts. Please try again in a few minutes.';
  }
  return (AUTH_ERROR_MESSAGES[msg] ?? msg) || 'Something went wrong. Please try again.';
}

/** User-friendly messages for Google OAuth errors. */
const GOOGLE_OAUTH_ERROR_MESSAGES: Record<string, string> = {
  'access_denied': 'Sign-in was cancelled or you denied access. Please try again.',
  'popup_closed_by_user': 'Sign-in window was closed. Please try again.',
  'Provider not enabled': 'Google sign-in is not set up for this app. Please use email or contact support.',
  'oauth_callback_error': 'Google sign-in failed. Please try again.',
  'Email link is invalid or has expired': 'This link has expired. Please start sign-in again.',
  'Invalid redirect URL': 'Redirect URL is not allowed. Please try again or contact support.',
  'Network request failed': 'Check your connection and try again.',
};

/** Map Google/OAuth error to a user-friendly message. */
export function getGoogleAuthErrorMessage(error: Error | { message?: string } | null): string {
  if (!error) return 'Google sign-in failed. Please try again.';
  const msg = (error as Error).message ?? '';
  if (/access_denied|denied|cancelled|canceled/i.test(msg)) {
    return GOOGLE_OAUTH_ERROR_MESSAGES['access_denied'];
  }
  if (/popup|closed/i.test(msg)) return GOOGLE_OAUTH_ERROR_MESSAGES['popup_closed_by_user'];
  if (/429|rate limit|too many requests/i.test(msg)) {
    return 'Too many attempts. Please try again in a few minutes.';
  }
  return (GOOGLE_OAUTH_ERROR_MESSAGES[msg] ?? AUTH_ERROR_MESSAGES[msg] ?? msg) || 'Google sign-in failed. Please try again.';
}

/** Save the path to redirect to after OAuth (e.g. Google) completes. Call before starting OAuth. */
export function saveRedirectPathBeforeOAuth(path: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (path) sessionStorage.setItem(OAUTH_REDIRECT_STORAGE_KEY, path);
    else sessionStorage.removeItem(OAUTH_REDIRECT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Get and clear the stored OAuth redirect path. Call after session is established. */
export function getAndClearRedirectPath(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const path = sessionStorage.getItem(OAUTH_REDIRECT_STORAGE_KEY);
    sessionStorage.removeItem(OAUTH_REDIRECT_STORAGE_KEY);
    return path;
  } catch {
    return null;
  }
}

/** Password strength result for UI. */
export interface PasswordStrength {
  score: number; // 0–4
  label: 'Very weak' | 'Weak' | 'Fair' | 'Strong' | 'Very strong';
  meetsMinimum: boolean;
  suggestions: string[];
}

const MIN_PASSWORD_LENGTH = 8;

/** Check password strength and return score, label, and suggestions. */
export function getPasswordStrength(password: string): PasswordStrength {
  const suggestions: string[] = [];
  let score = 0;

  if (password.length >= MIN_PASSWORD_LENGTH) score += 1;
  else suggestions.push(`Use at least ${MIN_PASSWORD_LENGTH} characters`);

  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  else suggestions.push('Use both uppercase and lowercase letters');
  if (/\d/.test(password)) score += 1;
  else suggestions.push('Add a number');
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;
  else suggestions.push('Add a symbol (e.g. !@#$%)');

  const labels: PasswordStrength['label'][] = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'];
  return {
    score,
    label: labels[Math.min(score, 4)],
    meetsMinimum: password.length >= MIN_PASSWORD_LENGTH,
    suggestions,
  };
}

/** Validation result for signup/login. */
export interface PasswordValidation {
  valid: boolean;
  message?: string;
}

/** Validate password for signup and password reset (stricter than login). */
export function validatePasswordForSignup(password: string): PasswordValidation {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { valid: false, message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` };
  }
  if (password.length > 72) {
    return { valid: false, message: 'Password is too long' };
  }
  return { valid: true };
}

/** Confirm-password match check. */
export function validatePasswordMatch(
  password: string,
  confirmPassword: string
): PasswordValidation {
  if (password !== confirmPassword) {
    return { valid: false, message: 'Passwords do not match' };
  }
  return { valid: true };
}

/** Build redirect URL for auth flows (e.g. post-login). Preserves path and search. */
export function getAuthRedirectUrl(redirectTo?: string | null): string {
  const fallback = AUTH_PATHS.home;
  if (!redirectTo || redirectTo.startsWith('http')) return fallback;
  if (redirectTo.startsWith('/')) return redirectTo;
  return fallback;
}
