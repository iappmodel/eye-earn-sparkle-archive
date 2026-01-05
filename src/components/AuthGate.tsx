import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Play, Zap, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AppLogo } from '@/components/AppLogo';

const AuthGate: React.FC = () => {
  const navigate = useNavigate();
  const [isDevLoggingIn, setIsDevLoggingIn] = useState(false);

  const handleSignIn = () => {
    navigate('/auth');
  };

  const handleTryDemo = () => {
    navigate('/demo');
  };

  const handleDevLogin = async () => {
    setIsDevLoggingIn(true);
    const email = 'dev@viewi.test';
    const password = 'devpass123';
    
    try {
      // Try to sign in first
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!signInError) {
        toast.success('Dev login successful');
        return;
      }

      // If sign in failed, try to create the account
      if (signInError.message.includes('Invalid login credentials')) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
          },
        });

        if (signUpError) {
          if (signUpError.message.includes('email')) {
            toast.error('Email confirmation required', {
              description: 'Disable email confirmation in backend settings, or use Demo mode',
            });
          } else {
            toast.error('Dev login failed', { description: signUpError.message });
          }
          return;
        }

        // Try signing in again after signup
        const { error: retryError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (retryError) {
          toast.warning('Account created but login failed', {
            description: 'Email confirmation may be required. Try Demo mode instead.',
            action: {
              label: 'Try Demo',
              onClick: handleTryDemo,
            },
          });
        } else {
          toast.success('Dev account created and logged in');
        }
      } else {
        toast.error('Dev login failed', { description: signInError.message });
      }
    } catch (err) {
      console.error('[AuthGate] Dev login error:', err);
      toast.error('Dev login failed');
    } finally {
      setIsDevLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center space-y-4">
          <AppLogo size="lg" />
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-display font-bold text-foreground">
              Welcome to ViewI
            </h1>
            <p className="text-muted-foreground">
              Sign in to access your personalized feed and earn rewards
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="space-y-3">
          <Button 
            onClick={handleSignIn}
            className="w-full h-12 text-base font-medium"
            size="lg"
          >
            <LogIn className="w-5 h-5 mr-2" />
            Sign In / Sign Up
          </Button>

          <Button 
            onClick={handleTryDemo}
            variant="outline"
            className="w-full h-12 text-base font-medium"
            size="lg"
          >
            <Play className="w-5 h-5 mr-2" />
            Try Demo Mode
          </Button>

          {import.meta.env.DEV && (
            <Button 
              onClick={handleDevLogin}
              variant="ghost"
              className="w-full h-10 text-sm text-muted-foreground"
              disabled={isDevLoggingIn}
            >
              {isDevLoggingIn ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Zap className="w-4 h-4 mr-2" />
              )}
              Quick Dev Login
            </Button>
          )}
        </div>

        {/* Info text */}
        <p className="text-center text-xs text-muted-foreground">
          Demo mode lets you explore the app with sample content. 
          Sign in to unlock all features and start earning.
        </p>
      </div>
    </div>
  );
};

export default AuthGate;
