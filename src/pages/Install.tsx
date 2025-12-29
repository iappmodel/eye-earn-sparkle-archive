import React, { useState, useEffect } from 'react';
import { Download, Smartphone, CheckCircle, Share, MoreVertical, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card3D } from '@/components/ui/Card3D';
import { GlassText } from '@/components/ui/GlassText';
import { cn } from '@/lib/utils';
import iLogo from '@/assets/i-logo.png';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const Install: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if already installed
    const checkStandalone = window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(checkStandalone);

    // Detect platform
    const userAgent = navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));
    setIsAndroid(/android/.test(userAgent));

    // Listen for install prompt
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
  };

  if (isStandalone || isInstalled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card3D depth="deep" glowEnabled className="p-8 text-center max-w-sm">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-green-500/20 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-green-400" />
          </div>
          <GlassText theme="emerald" variant="gradient" size="xl" as="h1" className="mb-4">
            Already Installed!
          </GlassText>
          <p className="text-muted-foreground mb-6">
            iView is already installed on your device. Enjoy earning rewards!
          </p>
          <Button 
            onClick={() => window.location.href = '/'}
            className="w-full bg-gradient-to-r from-primary to-accent"
          >
            Open App
          </Button>
        </Card3D>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-neon-glow opacity-50" />
        <div className="relative z-10 px-6 pt-12 pb-8 text-center">
          <img 
            src={iLogo} 
            alt="iView Logo" 
            className="w-24 h-24 mx-auto mb-6 animate-float-neon"
          />
          <GlassText theme="purple" variant="gradient" size="xl" as="h1" className="text-4xl mb-3">
            iView
          </GlassText>
          <p className="text-muted-foreground text-lg">
            Watch & Earn Rewards
          </p>
        </div>
      </div>

      {/* Install Card */}
      <div className="px-6 -mt-4">
        <Card3D depth="deep" glowEnabled className="p-6">
          <GlassText theme="cyan" variant="3d" size="lg" as="h2" className="mb-4 text-center">
            Install on Your Phone
          </GlassText>

          {/* Android with install prompt available */}
          {deferredPrompt && (
            <div className="space-y-4">
              <p className="text-muted-foreground text-center text-sm">
                Install iView for the best experience with offline access and quick launch.
              </p>
              <Button 
                onClick={handleInstallClick}
                className="w-full py-6 text-lg font-display bg-gradient-to-r from-primary to-accent shadow-[0_0_30px_hsl(var(--primary)/0.4)] hover:shadow-[0_0_50px_hsl(var(--primary)/0.6)]"
              >
                <Download className="w-5 h-5 mr-2" />
                Install App
              </Button>
            </div>
          )}

          {/* iOS Instructions */}
          {isIOS && !deferredPrompt && (
            <div className="space-y-6">
              <p className="text-muted-foreground text-center text-sm">
                Follow these steps to install iView on your iPhone:
              </p>
              
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 glass-neon rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Share className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">1. Tap Share</p>
                    <p className="text-sm text-muted-foreground">
                      Tap the share button at the bottom of Safari
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 glass-neon rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                    <Plus className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">2. Add to Home Screen</p>
                    <p className="text-sm text-muted-foreground">
                      Scroll down and tap "Add to Home Screen"
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 glass-neon rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-neon-cyan/20 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-5 h-5 text-neon-cyan" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">3. Confirm</p>
                    <p className="text-sm text-muted-foreground">
                      Tap "Add" to install iView
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Android without prompt (fallback) */}
          {isAndroid && !deferredPrompt && (
            <div className="space-y-6">
              <p className="text-muted-foreground text-center text-sm">
                Follow these steps to install iView:
              </p>
              
              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 glass-neon rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <MoreVertical className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">1. Open Menu</p>
                    <p className="text-sm text-muted-foreground">
                      Tap the three dots in Chrome's top-right corner
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 glass-neon rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                    <Smartphone className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">2. Install App</p>
                    <p className="text-sm text-muted-foreground">
                      Tap "Install app" or "Add to Home screen"
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Desktop */}
          {!isIOS && !isAndroid && !deferredPrompt && (
            <div className="text-center space-y-4">
              <Smartphone className="w-12 h-12 mx-auto text-muted-foreground" />
              <p className="text-muted-foreground">
                Visit this page on your mobile device to install iView.
              </p>
              <div className="p-4 glass-neon rounded-xl">
                <p className="text-sm font-mono text-foreground break-all">
                  {window.location.origin}/install
                </p>
              </div>
            </div>
          )}
        </Card3D>
      </div>

      {/* Features */}
      <div className="px-6 py-8 space-y-4">
        <GlassText theme="magenta" variant="glow" size="lg" as="h3" className="text-center mb-6">
          Why Install?
        </GlassText>
        
        <div className="grid gap-4">
          {[
            { icon: '⚡', title: 'Instant Access', desc: 'Launch from your home screen' },
            { icon: '📴', title: 'Works Offline', desc: 'Browse even without internet' },
            { icon: '🔔', title: 'Notifications', desc: 'Never miss a reward opportunity' },
            { icon: '🚀', title: 'Faster Loading', desc: 'Cached content loads instantly' },
          ].map((feature, i) => (
            <div 
              key={i}
              className="flex items-center gap-4 p-4 glass-neon rounded-xl"
            >
              <span className="text-2xl">{feature.icon}</span>
              <div>
                <p className="font-semibold text-foreground">{feature.title}</p>
                <p className="text-sm text-muted-foreground">{feature.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Install;
