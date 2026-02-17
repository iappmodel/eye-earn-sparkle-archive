import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { subscriptionService, SubscriptionStatus } from '@/services/subscription.service';
import { AUTH_REDIRECT_BASE, AUTH_PATHS, saveRedirectPathBeforeOAuth } from '@/services/auth.service';
import { rewardsService } from '@/services/rewards.service';

export interface ProfileSocialLinks {
  instagram?: string;
  twitter?: string;
  tiktok?: string;
  website?: string;
  youtube?: string;
  linkedin?: string;
}

/**
 * Profile row from public.profiles. Fetched by user_id (auth user id).
 * For tip/follow: feed creator id is the creator's auth user_id; use user.id (not profile.id)
 * when comparing current user to creator (e.g. self-tip check).
 */
export interface Profile {
  id: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  cover_photo_url?: string | null;
  bio: string | null;
  phone_number: string | null;
  phone_verified: boolean;
  calibration_data?: Record<string, unknown> | null;
  vicoin_balance: number;
  icoin_balance: number;
  total_views: number;
  total_likes: number;
  followers_count: number;
  following_count: number;
  is_verified: boolean;
  kyc_status: string;
  social_links?: ProfileSocialLinks | null;
  show_contributor_badges?: boolean | null;
  show_timed_interactions?: boolean | null;
  created_at: string;
  updated_at: string;
}

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

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
    return data as Profile | null;
  };

  const refreshProfile = async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
    }
  };

  const refreshSubscription = async () => {
    if (user) {
      try {
        const subStatus = await subscriptionService.checkSubscription();
        setSubscription(subStatus);
      } catch (error) {
        console.error('Error fetching subscription:', error);
      }
    }
  };

  const clearRecoverySession = useCallback(() => {
    setIsRecoverySession(false);
  }, []);

  const syncProfileFromGoogle = useCallback(async (uid: string, metadata: Record<string, unknown> | undefined) => {
    if (!metadata) return;
    const fullName = (metadata.full_name as string) || (metadata.name as string);
    const avatar = (metadata.avatar_url as string) || (metadata.picture as string);
    if (!fullName && !avatar) return;
    const { data: existing } = await supabase
      .from('profiles')
      .select('display_name, avatar_url')
      .eq('user_id', uid)
      .maybeSingle();
    if (!existing) return;
    const updates: { display_name?: string; avatar_url?: string } = {};
    if (fullName && !existing.display_name) updates.display_name = fullName;
    if (avatar && !existing.avatar_url) updates.avatar_url = avatar;
    if (Object.keys(updates).length === 0) return;
    await supabase.from('profiles').update(updates).eq('user_id', uid);
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          setIsRecoverySession(true);
        }
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          const isGoogle = session.user.app_metadata?.provider === 'google';
          const doFetch = () => {
            fetchProfile(session!.user.id).then(setProfile);
            subscriptionService.checkSubscription().then(setSubscription).catch(console.error);
            // Platform rewards user with VICOIN for logging in (once per day)
            const today = new Date().toISOString().split('T')[0];
            rewardsService.issueReward('login', `login:${today}`, {}).catch(() => {});
          };
          if (event === 'SIGNED_IN' && isGoogle && session.user.user_metadata) {
            syncProfileFromGoogle(session.user.id, session.user.user_metadata)
              .then(() => doFetch())
              .catch((e) => {
                console.error(e);
                doFetch();
              });
          } else {
            setTimeout(doFetch, 0);
          }
        } else {
          setProfile(null);
          setSubscription(null);
          setIsRecoverySession(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);

      if (initialSession?.user) {
        Promise.all([
          fetchProfile(initialSession.user.id),
          subscriptionService.checkSubscription().catch(() => null),
        ]).then(([profileData, subStatus]) => {
          setProfile(profileData);
          if (subStatus) setSubscription(subStatus);
          setLoading(false);
          // Platform rewards user with VICOIN for being logged in (once per day)
          const today = new Date().toISOString().split('T')[0];
          rewardsService.issueReward('login', `login:${today}`, {}).catch(() => {});
        });
      } else {
        setLoading(false);
      }
    });

    return () => authSub.unsubscribe();
  }, [syncProfileFromGoogle]);

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
