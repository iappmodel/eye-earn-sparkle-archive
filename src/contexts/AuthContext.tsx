import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { subscriptionService, SubscriptionStatus } from '@/services/subscription.service';
import { errorTrackingService } from '@/services/errorTracking.service';

interface Profile {
  id: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  phone_number: string | null;
  phone_verified: boolean;
  vicoin_balance: number;
  icoin_balance: number;
  total_views: number;
  total_likes: number;
  followers_count: number;
  following_count: number;
  is_verified: boolean;
  kyc_status: string;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  subscription: SubscriptionStatus | null;
  loading: boolean;
  signUp: (email: string, password: string, username: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signInWithPhone: (phone: string) => Promise<{ error: Error | null }>;
  verifyOtp: (phone: string, token: string) => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
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

// Development auto-login configuration
const DEV_AUTO_LOGIN = import.meta.env.VITE_DEV_AUTO_LOGIN === 'true';
const DEV_USER_EMAIL = import.meta.env.VITE_DEV_USER_EMAIL || 'dev@example.com';
const DEV_USER_PASSWORD = import.meta.env.VITE_DEV_USER_PASSWORD || 'devpassword123';

// Mock profile for development when no real profile exists
const createMockProfile = (userId: string): Profile => ({
  id: userId,
  user_id: userId,
  username: 'demo_user',
  display_name: 'Demo User',
  avatar_url: null,
  bio: 'This is a demo account for testing',
  phone_number: null,
  phone_verified: false,
  vicoin_balance: 1000,
  icoin_balance: 500,
  total_views: 0,
  total_likes: 0,
  followers_count: 0,
  following_count: 0,
  is_verified: false,
  kyc_status: 'pending',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [devAutoLoginAttempted, setDevAutoLoginAttempted] = useState(false);

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

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        errorTrackingService.setUserId(session?.user?.id ?? null);
        
        // Defer profile and subscription fetch with setTimeout to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id).then(setProfile);
            subscriptionService.checkSubscription().then(setSubscription).catch(console.error);
          }, 0);
        } else {
          setProfile(null);
          setSubscription(null);
        }
      }
    );

    // THEN check for existing session (fail-open: never block UI forever)
    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        errorTrackingService.setUserId(session?.user?.id ?? null);

        if (session?.user) {
          const timeoutMs = 4000;
          const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));

          const result = (await Promise.race([
            Promise.all([
              fetchProfile(session.user.id),
              subscriptionService.checkSubscription().catch(() => null),
            ]) as Promise<[Profile | null, SubscriptionStatus | null]>,
            timeout,
          ])) as [Profile | null, SubscriptionStatus | null] | null;

          if (result === null) {
            // Timed out: unblock UI, then fetch in background
            setLoading(false);
            fetchProfile(session.user.id).then(setProfile);
            subscriptionService.checkSubscription().then(setSubscription).catch(() => null);
            return;
          }

          const [profileData, subStatus] = result;
          setProfile(profileData);
          if (subStatus) setSubscription(subStatus);
          setLoading(false);
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));

    return () => subscription.unsubscribe();
  }, []);

  // Development auto-login: automatically sign in when VITE_DEV_AUTO_LOGIN=true
  useEffect(() => {
    if (!DEV_AUTO_LOGIN || devAutoLoginAttempted || user) return;
    
    setDevAutoLoginAttempted(true);
    console.log('[AuthContext] Dev auto-login enabled, attempting sign in...');
    
    const attemptDevLogin = async () => {
      try {
        // First try to sign in with dev credentials
        const { data, error } = await supabase.auth.signInWithPassword({
          email: DEV_USER_EMAIL,
          password: DEV_USER_PASSWORD,
        });
        
        if (error) {
          // If user doesn't exist, create one
          if (error.message.includes('Invalid login credentials')) {
            console.log('[AuthContext] Dev user not found, creating...');
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
              email: DEV_USER_EMAIL,
              password: DEV_USER_PASSWORD,
              options: {
                data: {
                  username: 'dev_user',
                  display_name: 'Dev User',
                },
              },
            });
            
            if (signUpError) {
              console.error('[AuthContext] Dev auto-login failed:', signUpError);
              // Fallback to mock profile for demo
              setProfile(createMockProfile('dev-mock-user'));
              setLoading(false);
            } else {
              console.log('[AuthContext] Dev user created:', signUpData.user?.email);
            }
          } else {
            console.error('[AuthContext] Dev auto-login error:', error);
            // Fallback to mock profile
            setProfile(createMockProfile('dev-mock-user'));
            setLoading(false);
          }
        } else {
          console.log('[AuthContext] Dev auto-login successful:', data.user?.email);
        }
      } catch (err) {
        console.error('[AuthContext] Dev auto-login exception:', err);
        setLoading(false);
      }
    };
    
    attemptDevLogin();
  }, [user, devAutoLoginAttempted]);

  const signUp = async (email: string, password: string, username: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
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

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
      },
    });
    
    return { error: error as Error | null };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth?mode=reset`,
    });
    
    return { error: error as Error | null };
  };

  const signInWithPhone = async (phone: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      phone,
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
    errorTrackingService.setUserId(null);
    setUser(null);
    setSession(null);
    setProfile(null);
    setSubscription(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        subscription,
        loading,
        signUp,
        signIn,
        signInWithGoogle,
        signInWithPhone,
        verifyOtp,
        resetPassword,
        signOut,
        refreshProfile,
        refreshSubscription,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
