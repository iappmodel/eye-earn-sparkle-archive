import React, { createContext, useContext, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { subscriptionService, SubscriptionStatus } from '@/services/subscription.service';
import { AUTH_REDIRECT_BASE, AUTH_PATHS, saveRedirectPathBeforeOAuth } from '@/services/auth.service';
import { useAuthSessionSync } from '@/hooks/useAuthSessionSync';
import { useProfileLoader } from '@/hooks/useProfileLoader';
import { useSubscriptionLoader } from '@/hooks/useSubscriptionLoader';
import { useDailyLoginReward } from '@/hooks/useDailyLoginReward';
import type { Profile, ProfileSocialLinks } from '@/types/auth';

export type { Profile, ProfileSocialLinks };

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  subscription: SubscriptionStatus | null;
  loading: boolean;
  /** True when user landed from password-reset link and must set a new password. */
  isRecoverySession: boolean;
  /** Clear recovery flag after user has set a new password. */
  clearRecoverySession: () => void;
  /** Whether the current user has confirmed their email. */
  isEmailConfirmed: boolean;
  signUp: (email: string, password: string, username: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  /** Start Google OAuth. Optionally pass redirectTo to land on a specific path after sign-in. */
  signInWithGoogle: (options?: { redirectTo?: string }) => Promise<{ error: Error | null }>;
  signInWithPhone: (phone: string, options?: { channel?: 'sms' }) => Promise<{ error: Error | null }>;
  resendOtp: (phone: string) => Promise<{ error: Error | null }>;
  verifyOtp: (phone: string, token: string) => Promise<{ error: Error | null }>;
  /** Request a password reset email. Optional captchaToken for bot protection. */
  resetPassword: (email: string, options?: { captchaToken?: string }) => Promise<{ error: Error | null }>;
  /** Set new password (e.g. after password recovery). */
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  /** Resend email confirmation (e.g. after signup). Pass email if user is not yet in session. */
  resendVerificationEmail: (email?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRecoverySession, setIsRecoverySession] = useState(false);

  useAuthSessionSync(setSession, setUser, setIsRecoverySession, setLoading);
  useProfileLoader(user, setProfile);
  useSubscriptionLoader(user, setSubscription);
  useDailyLoginReward(session, profile);

  const clearRecoverySession = useCallback(() => {
    setIsRecoverySession(false);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) {
      console.error('Error fetching profile:', error);
      return;
    }
    setProfile(data as Profile | null);
  }, [user]);

  const refreshSubscription = useCallback(async () => {
    if (!user) return;
    try {
      const subStatus = await subscriptionService.checkSubscription();
      setSubscription(subStatus);
    } catch (error) {
      console.error('Error fetching subscription:', error);
    }
  }, [user]);

  const signUp = async (email: string, password: string, username: string) => {
    const redirectUrl = `${AUTH_REDIRECT_BASE}${AUTH_PATHS.home}`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          username,
          display_name: username,
        },
      },
    });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    return { error: error as Error | null };
  };

  const signInWithGoogle = async (options?: { redirectTo?: string }) => {
    const redirectTo = options?.redirectTo ?? AUTH_PATHS.home;
    const fullRedirectUrl = redirectTo.startsWith('http') ? redirectTo : `${AUTH_REDIRECT_BASE}${redirectTo}`;
    saveRedirectPathBeforeOAuth(redirectTo.startsWith('/') ? redirectTo : null);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: fullRedirectUrl,
        scopes: 'email profile openid',
        queryParams: {
          prompt: 'select_account',
          access_type: 'offline',
        },
      },
    });
    return { error: error as Error | null };
  };

  const resetPassword = async (email: string, options?: { captchaToken?: string }) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${AUTH_REDIRECT_BASE}${AUTH_PATHS.authReset}`,
      captchaToken: options?.captchaToken,
    });
    return { error: error as Error | null };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (!error) setIsRecoverySession(false);
    return { error: error as Error | null };
  };

  const resendVerificationEmail = async (emailOverride?: string) => {
    const email = emailOverride ?? user?.email;
    if (!email) return { error: new Error('No email found') };
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });
    return { error: error as Error | null };
  };

  const signInWithPhone = async (phone: string, options?: { channel?: 'sms' }) => {
    const { error } = await supabase.auth.signInWithOtp({
      phone,
      options: {
        channel: options?.channel ?? 'sms',
        shouldCreateUser: true,
      },
    });
    return { error: error as Error | null };
  };

  const resendOtp = async (phone: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      phone,
      options: { channel: 'sms', shouldCreateUser: true },
    });
    return { error: error as Error | null };
  };

  const verifyOtp = async (phone: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms',
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setSubscription(null);
  };

  const isEmailConfirmed = Boolean(user?.email_confirmed_at ?? user?.confirmed_at);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        subscription,
        loading,
        isRecoverySession,
        clearRecoverySession,
        isEmailConfirmed,
        signUp,
        signIn,
        signInWithGoogle,
        signInWithPhone,
        resendOtp,
        verifyOtp,
        resetPassword,
        updatePassword,
        resendVerificationEmail,
        signOut,
        refreshProfile,
        refreshSubscription,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
