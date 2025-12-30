// Promo Videos Feed Component - Right swipe screen with reward earning
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Gift, Coins, Clock, Check, Eye, Volume2, VolumeX, ChevronUp, Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { rewardsService } from '@/services/rewards.service';
import { toast } from 'sonner';
import { Neu3DButton, VideoTheme } from '@/components/ui/Neu3DButton';
import { GlassText } from '@/components/ui/GlassText';

interface PromoVideo {
  id: string;
  brandName: string;
  brandLogo: string;
  videoUrl: string;
  thumbnail: string;
  title: string;
  description: string;
  duration: number;
  reward: {
    amount: number;
    type: 'vicoin' | 'icoin';
  };
  claimed: boolean;
  theme: VideoTheme;
}

const mockPromoVideos: PromoVideo[] = [
  {
    id: 'pv1',
    brandName: 'TechGadgets',
    brandLogo: 'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=100&h=100&fit=crop',
    videoUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1080&h=1920&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1080&h=1920&fit=crop',
    title: 'Premium Headphones Sale',
    description: 'Experience crystal clear audio with our new wireless headphones. 50% off this week only!',
    duration: 8,
    reward: { amount: 50, type: 'vicoin' },
    claimed: false,
    theme: 'purple',
  },
  {
    id: 'pv2',
    brandName: 'FashionHub',
    brandLogo: 'https://images.unsplash.com/photo-1560343090-f0409e92791a?w=100&h=100&fit=crop',
    videoUrl: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=1080&h=1920&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=1080&h=1920&fit=crop',
    title: 'Summer Collection 2024',
    description: 'Discover the hottest trends this summer. Shop now and get free shipping!',
    duration: 8,
    reward: { amount: 75, type: 'vicoin' },
    claimed: false,
    theme: 'magenta',
  },
  {
    id: 'pv3',
    brandName: 'FoodDelight',
    brandLogo: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=100&h=100&fit=crop',
    videoUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1080&h=1920&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1080&h=1920&fit=crop',
    title: 'Gourmet Meal Kits',
    description: 'Chef-prepared ingredients delivered to your door. Try your first box free!',
    duration: 8,
    reward: { amount: 1, type: 'icoin' },
    claimed: false,
    theme: 'gold',
  },
  {
    id: 'pv4',
    brandName: 'TravelEscape',
    brandLogo: 'https://images.unsplash.com/photo-1488085061387-422e29b40080?w=100&h=100&fit=crop',
    videoUrl: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1080&h=1920&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1080&h=1920&fit=crop',
    title: 'Tropical Paradise Deals',
    description: 'Book your dream vacation today. Up to 40% off on beach resorts!',
    duration: 8,
    reward: { amount: 100, type: 'vicoin' },
    claimed: false,
    theme: 'cyan',
  },
  {
    id: 'pv5',
    brandName: 'FitLife',
    brandLogo: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=100&h=100&fit=crop',
    videoUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1080&h=1920&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1080&h=1920&fit=crop',
    title: 'Home Gym Equipment',
    description: 'Transform your home into a fitness studio. Premium equipment at unbeatable prices!',
    duration: 8,
    reward: { amount: 2, type: 'icoin' },
    claimed: false,
    theme: 'emerald',
  },
];

// Theme-specific gradient overlays
const themeOverlays: Record<VideoTheme, string> = {
  purple: 'from-[hsl(270,95%,10%,0.4)] via-transparent to-[hsl(270,95%,5%,0.8)]',
  magenta: 'from-[hsl(320,90%,10%,0.4)] via-transparent to-[hsl(320,90%,5%,0.8)]',
  cyan: 'from-[hsl(185,100%,10%,0.4)] via-transparent to-[hsl(185,100%,5%,0.8)]',
  gold: 'from-[hsl(45,100%,10%,0.4)] via-transparent to-[hsl(45,100%,5%,0.8)]',
  emerald: 'from-[hsl(160,84%,10%,0.4)] via-transparent to-[hsl(160,84%,5%,0.8)]',
  rose: 'from-[hsl(350,89%,10%,0.4)] via-transparent to-[hsl(350,89%,5%,0.8)]',
};

const themeProgressBars: Record<VideoTheme, string> = {
  purple: 'bg-[hsl(270,95%,65%)]',
  magenta: 'bg-[hsl(320,90%,60%)]',
  cyan: 'bg-[hsl(185,100%,50%)]',
  gold: 'bg-[hsl(45,100%,55%)]',
  emerald: 'bg-[hsl(160,84%,39%)]',
  rose: 'bg-[hsl(350,89%,60%)]',
};

interface PromoVideosFeedProps {
  isActive: boolean;
  onSwipeLeft?: () => void;
  onRewardEarned?: (amount: number, type: 'vicoin' | 'icoin') => void;
}

export const PromoVideosFeed: React.FC<PromoVideosFeedProps> = ({
  isActive,
  onSwipeLeft,
  onRewardEarned,
}) => {
  const { profile, refreshProfile } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [videos, setVideos] = useState(mockPromoVideos);
  const [progress, setProgress] = useState(0);
  const [isWatching, setIsWatching] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isClaimingReward, setIsClaimingReward] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const watchStartTime = useRef<number | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentVideo = videos[currentIndex];
  const currentTheme = currentVideo.theme;

  // Auto-hide controls after 3s
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  const handleScreenTap = useCallback(() => {
    setShowControls(prev => !prev);
    if (!showControls) {
      resetControlsTimeout();
    }
  }, [showControls, resetControlsTimeout]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, []);

  // Start/stop watching when screen becomes active
  useEffect(() => {
    if (isActive && currentVideo && !currentVideo.claimed && !isPaused) {
      setIsWatching(true);
      watchStartTime.current = Date.now();
    } else {
      setIsWatching(false);
      watchStartTime.current = null;
    }
    
    return () => {
      setIsWatching(false);
      watchStartTime.current = null;
    };
  }, [isActive, currentIndex, currentVideo, isPaused]);

  // Video progress and reward logic
  useEffect(() => {
    if (isWatching && currentVideo && !currentVideo.claimed) {
      const duration = currentVideo.duration * 1000;
      const startTime = Date.now();
      
      progressInterval.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const newProgress = Math.min((elapsed / duration) * 100, 100);
        setProgress(newProgress);
        
        if (newProgress >= 100) {
          clearInterval(progressInterval.current!);
          setIsWatching(false);
          setShowReward(true);
          if (navigator.vibrate) {
            navigator.vibrate([100, 50, 100]);
          }
        }
      }, 50);

      return () => {
        if (progressInterval.current) {
          clearInterval(progressInterval.current);
        }
      };
    }
  }, [isWatching, currentVideo]);

  // Reset progress when changing videos
  useEffect(() => {
    setProgress(0);
    setShowReward(false);
    setIsPaused(false);
  }, [currentIndex]);

  const claimReward = useCallback(async () => {
    if (!currentVideo || currentVideo.claimed || isClaimingReward) return;
    
    setIsClaimingReward(true);
    
    try {
      const result = await rewardsService.issueReward(
        'promo_view',
        currentVideo.id,
        {
          attentionScore: 95,
          coinType: currentVideo.reward.type,
        }
      );

      if (result.success && result.amount) {
        setVideos((prev) =>
          prev.map((v, idx) => (idx === currentIndex ? { ...v, claimed: true } : v))
        );
        
        await refreshProfile();
        onRewardEarned?.(result.amount, result.coinType || currentVideo.reward.type);
        
        toast.success(`+${result.amount} ${result.coinType === 'vicoin' ? 'Vicoins' : 'Icoins'}!`, {
          description: 'Reward added to your wallet',
        });
        
        if (navigator.vibrate) {
          navigator.vibrate([50, 30, 50, 30, 50]);
        }
        
        setTimeout(() => {
          setShowReward(false);
          setCurrentIndex((prev) => (prev + 1) % videos.length);
        }, 1500);
      } else if (result.error) {
        if (result.error.includes('already claimed') || result.error.includes('Reward already')) {
          setVideos((prev) =>
            prev.map((v, idx) => (idx === currentIndex ? { ...v, claimed: true } : v))
          );
          toast.info('Already claimed', { description: 'This reward was already collected' });
        } else if (result.error.includes('limit')) {
          toast.info('Daily limit reached', { description: 'Come back tomorrow!' });
        } else {
          console.error('Reward error:', result.error);
        }
      }
    } catch (error) {
      console.error('Error claiming reward:', error);
    } finally {
      setIsClaimingReward(false);
    }
  }, [currentVideo, currentIndex, isClaimingReward, videos.length, onRewardEarned, refreshProfile]);

  const skipVideo = () => {
    setCurrentIndex((prev) => (prev + 1) % videos.length);
    setProgress(0);
    setShowReward(false);
  };

  return (
    <div 
      className="h-full w-full bg-background relative overflow-hidden"
      onClick={handleScreenTap}
    >
      {/* Video/Image Background */}
      <div className="absolute inset-0">
        <img
          src={currentVideo.thumbnail}
          alt={currentVideo.title}
          className="w-full h-full object-cover"
        />
        {/* Theme-colored gradient overlay */}
        <div className={cn(
          'absolute inset-0 bg-gradient-to-b',
          themeOverlays[currentTheme]
        )} />
      </div>

      {/* Progress Bar with Timer */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4">
        <div className="flex items-center gap-3 mb-2">
          <Clock className="w-4 h-4 text-white drop-shadow-lg" />
          <div className="flex-1 h-2.5 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm border border-white/10">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-100 ease-linear',
                progress >= 100 ? 'bg-green-400' : themeProgressBars[currentTheme],
                'shadow-[0_0_10px_currentColor]'
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          <GlassText theme={currentTheme} variant="glow" size="sm">
            {Math.ceil((currentVideo.duration * (100 - progress)) / 100)}s
          </GlassText>
        </div>
        
        {/* Reward indicator - glass morphism */}
        <div className="flex items-center justify-center gap-2 glass-neon rounded-full px-4 py-2 w-fit mx-auto">
          <Coins className={cn(
            'w-5 h-5',
            currentVideo.reward.type === 'icoin' ? 'text-icoin' : 'text-primary',
            'drop-shadow-[0_0_8px_currentColor]'
          )} />
          <GlassText 
            theme={currentVideo.reward.type === 'icoin' ? 'gold' : currentTheme} 
            variant="gradient" 
            size="lg"
          >
            +{currentVideo.reward.amount}
          </GlassText>
          <span className="text-white/70 text-sm font-medium">
            {currentVideo.reward.type === 'vicoin' ? 'Vicoins' : 'Icoins'}
          </span>
        </div>
      </div>

      {/* Brand Header - glass morphism */}
      <div className="absolute top-28 left-0 right-0 z-10 px-4">
        <div className="flex items-center gap-3 glass-neon rounded-2xl p-3">
          <div className={cn(
            'w-12 h-12 rounded-full overflow-hidden border-2',
            `border-[hsl(var(--neon-${currentTheme === 'gold' ? 'purple' : currentTheme}))]`,
            'shadow-[0_0_15px_hsl(var(--primary)/0.3)]'
          )}>
            <img src={currentVideo.brandLogo} alt={currentVideo.brandName} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1">
            <GlassText theme={currentTheme} variant="3d" size="lg" as="p">
              {currentVideo.brandName}
            </GlassText>
            <p className="text-white/60 text-xs flex items-center gap-1 font-medium">
              <Gift className="w-3 h-3" /> Sponsored
            </p>
          </div>
        </div>
      </div>

      {/* Reward Popup */}
      {showReward && !currentVideo.claimed && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-md">
          <div className="glass-neon rounded-3xl p-8 mx-6 text-center animate-scale-in border-2 border-primary/30">
            <div className={cn(
              'w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4',
              'bg-gradient-to-br from-primary/30 to-accent/20',
              'shadow-[0_0_40px_hsl(var(--primary)/0.4)]',
              'animate-pulse-3d'
            )}>
              <Coins className={cn(
                'w-10 h-10',
                currentVideo.reward.type === 'icoin' ? 'text-icoin' : 'text-primary',
                'drop-shadow-[0_0_15px_currentColor]'
              )} />
            </div>
            <GlassText theme={currentTheme} variant="gradient" size="xl" as="h3" className="mb-2">
              Reward Earned!
            </GlassText>
            <GlassText 
              theme={currentVideo.reward.type === 'icoin' ? 'gold' : currentTheme} 
              variant="neon" 
              className="text-5xl mb-2 block"
            >
              +{currentVideo.reward.amount}
            </GlassText>
            <p className="text-muted-foreground mb-6 font-medium">
              {currentVideo.reward.type === 'vicoin' ? 'Vicoins' : 'Icoins'}
            </p>
            <button
              onClick={claimReward}
              disabled={isClaimingReward}
              className={cn(
                'w-full py-4 rounded-2xl font-display font-bold text-lg',
                'flex items-center justify-center gap-2',
                'bg-gradient-to-r from-primary to-accent text-white',
                'shadow-[0_0_30px_hsl(var(--primary)/0.5)]',
                'hover:shadow-[0_0_50px_hsl(var(--primary)/0.7)]',
                'transition-all duration-300',
                'disabled:opacity-50'
              )}
            >
              {isClaimingReward ? (
                'Claiming...'
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  Claim Reward
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Already Claimed Badge */}
      {currentVideo.claimed && (
        <div className="absolute top-44 left-1/2 -translate-x-1/2 z-20">
          <div className="flex items-center gap-2 glass-neon rounded-full px-4 py-2 border border-green-500/30">
            <Check className="w-5 h-5 text-green-400 drop-shadow-[0_0_8px_hsl(120,70%,50%)]" />
            <GlassText theme="emerald" variant="glow" size="sm">
              Reward Claimed
            </GlassText>
          </div>
        </div>
      )}

      {/* Center Controls - appear on tap, auto-hide after 3s */}
      {showControls && (
        <div 
          className="absolute inset-0 flex items-center justify-center z-20 animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-6">
            {/* Play/Pause - large center button */}
            <Neu3DButton 
              onClick={() => {
                setIsPaused(!isPaused);
                resetControlsTimeout();
              }}
              theme={currentTheme}
              variant="glass"
              size="lg"
            >
              {isPaused ? <Play className="w-8 h-8 ml-1" /> : <Pause className="w-8 h-8" />}
            </Neu3DButton>

            {/* Volume */}
            <Neu3DButton 
              onClick={() => {
                setIsMuted(!isMuted);
                resetControlsTimeout();
              }}
              theme={currentTheme}
              variant="glass"
            >
              {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
            </Neu3DButton>

            {/* Skip/Next */}
            <Neu3DButton 
              onClick={() => {
                skipVideo();
              }}
              theme={currentTheme}
              variant="neon"
            >
              <ChevronUp className="w-6 h-6" />
            </Neu3DButton>
          </div>
        </div>
      )}

      {/* Bottom Content */}
      <div className="absolute bottom-24 left-20 right-4 z-10">
        <GlassText theme={currentTheme} variant="3d" size="xl" as="h2" className="mb-2">
          {currentVideo.title}
        </GlassText>
        <p className="text-white/80 text-sm leading-relaxed font-medium drop-shadow-lg">
          {currentVideo.description}
        </p>
      </div>

      {/* Swipe hint */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
        <p className="text-white/40 text-xs font-medium">← Swipe left for main feed</p>
      </div>

      {/* Video counter */}
      <div className="absolute bottom-6 right-4 z-10">
        <GlassText theme={currentTheme} variant="glow" size="sm">
          {currentIndex + 1} / {videos.length}
        </GlassText>
      </div>
    </div>
  );
};
