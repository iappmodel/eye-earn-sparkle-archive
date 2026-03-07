import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { subscriptionService, SubscriptionStatus, SUBSCRIPTION_TIERS } from '@/services/subscription.service';
import { AUTH_REDIRECT_BASE, AUTH_PATHS, saveRedirectPathBeforeOAuth } from '@/services/auth.service';
import { useAuthSessionSync } from '@/hooks/useAuthSessionSync';
import { useProfileLoader } from '@/hooks/useProfileLoader';
import { useSubscriptionLoader } from '@/hooks/useSubscriptionLoader';
import { useDailyLoginReward } from '@/hooks/useDailyLoginReward';
import type { Profile, ProfileSocialLinks } from '@/types/auth';
import { isDemoMode } from '@/lib/appMode';
import { DEMO_BALANCES_KEY, DEMO_SUBSCRIPTION_KEY, getDemoBalances, getDemoSubscriptionTier } from '@/lib/demoState';

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

const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001';
const DEMO_EMAIL = 'investor.demo@iview.local';

function createDemoUser(): User {
  const now = new Date().toISOString();
  return {
    id: DEMO_USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: DEMO_EMAIL,
    email_confirmed_at: now,
    phone: '',
    confirmed_at: now,
    last_sign_in_at: now,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {
      username: 'investor_demo',
      display_name: 'Investor Demo',
    },
    identities: [],
    created_at: now,
    updated_at: now,
    is_anonymous: false,
  } as User;
}

function createDemoSession(user: User): Session {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: 'demo-access-token',
    refresh_token: 'demo-refresh-token',
    expires_in: 24 * 60 * 60,
    expires_at: now + 24 * 60 * 60,
    token_type: 'bearer',
    user,
  } as Session;
}

function createDemoProfile(userId: string): Profile {
  const now = new Date().toISOString();
  const balances = getDemoBalances();
  return {
    id: 'demo-profile',
    user_id: userId,
    username: 'investor_demo',
    display_name: 'Investor Demo',
    avatar_url: null,
    cover_photo_url: null,
    bio: 'Investor demonstration account',
    social_links: null,
    followers_count: 1320,
    following_count: 246,
    total_views: 128900,
    total_likes: 20345,
    is_verified: true,
    show_contributor_badges: true,
    show_timed_interactions: true,
    created_at: now,
    updated_at: now,
    phone_number: null,
    phone_verified: true,
    calibration_data: null,
    vicoin_balance: balances.vicoins,
    icoin_balance: balances.icoins,
    kyc_status: 'verified',
    referred_by: null,
  } as Profile;
}

function createDemoSubscription(): SubscriptionStatus {
  const tier = getDemoSubscriptionTier();
  const tierConfig = SUBSCRIPTION_TIERS[tier];
  const subscribed = tier !== 'free';
  return {
    subscribed,
    tier,
    tier_name: tierConfig.name,
    subscription_end: subscribed ? new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString() : null,
    reward_multiplier: tierConfig.reward_multiplier,
    trial_end: null,
    cancel_at_period_end: false,
    current_period_start: subscribed ? new Date().toISOString() : null,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => (isDemoMode ? createDemoUser() : null));
  const [session, setSession] = useState<Session | null>(() => (isDemoMode ? createDemoSession(createDemoUser()) : null));
  const [profile, setProfile] = useState<Profile | null>(() => (isDemoMode ? createDemoProfile(DEMO_USER_ID) : null));
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(() => (isDemoMode ? createDemoSubscription() : null));
  const [loading, setLoading] = useState(!isDemoMode);
  const [isRecoverySession, setIsRecoverySession] = useState(false);

  useAuthSessionSync(setSession, setUser, setIsRecoverySession, setLoading, !isDemoMode);
  useProfileLoader(user, setProfile, !isDemoMode);
  useSubscriptionLoader(user, setSubscription, !isDemoMode);
  useDailyLoginReward(session, profile);

  const syncDemoSnapshot = useCallback(() => {
    if (!isDemoMode) return;
    const demoUser = createDemoUser();
    setUser(demoUser);
    setSession(createDemoSession(demoUser));
    setProfile(createDemoProfile(demoUser.id));
    setSubscription(createDemoSubscription());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!isDemoMode) return;
    syncDemoSnapshot();
    const handleStorage = (event: StorageEvent) => {
      if (!event.key || event.key === DEMO_BALANCES_KEY || event.key === DEMO_SUBSCRIPTION_KEY) {
        syncDemoSnapshot();
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [syncDemoSnapshot]);

  const clearRecoverySession = useCallback(() => {
    setIsRecoverySession(false);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    if (isDemoMode) {
      setProfile(createDemoProfile(user.id));
      return;
    }
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
    if (isDemoMode) {
      setSubscription(createDemoSubscription());
      return;
    }
    try {
      const subStatus = await subscriptionService.checkSubscription();
      setSubscription(subStatus);
    } catch (error) {
      console.error('Error fetching subscription:', error);
    }
  }, [user]);

  const signUp = async (email: string, password: string, username: string) => {
    if (isDemoMode) return { error: null };
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
    if (isDemoMode) return { error: null };
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    return { error: error as Error | null };
  };

  const signInWithGoogle = async (options?: { redirectTo?: string }) => {
    if (isDemoMode) return { error: null };
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
    if (isDemoMode) return { error: null };
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${AUTH_REDIRECT_BASE}${AUTH_PATHS.authReset}`,
      captchaToken: options?.captchaToken,
    });
    return { error: error as Error | null };
  };

  const updatePassword = async (newPassword: string) => {
    if (isDemoMode) return { error: null };
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (!error) setIsRecoverySession(false);
    return { error: error as Error | null };
  };

  const resendVerificationEmail = async (emailOverride?: string) => {
    if (isDemoMode) return { error: null };
    const email = emailOverride ?? user?.email;
    if (!email) return { error: new Error('No email found') };
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });
    return { error: error as Error | null };
  };

  const signInWithPhone = async (phone: string, options?: { channel?: 'sms' }) => {
    if (isDemoMode) return { error: null };
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
    if (isDemoMode) return { error: null };
    const { error } = await supabase.auth.signInWithOtp({
      phone,
      options: { channel: 'sms', shouldCreateUser: true },
    });
    return { error: error as Error | null };
  };

  const verifyOtp = async (phone: string, token: string) => {
    if (isDemoMode) return { error: null };
    const { error } = await supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms',
    });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    if (isDemoMode) {
      syncDemoSnapshot();
      return;
    }
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
