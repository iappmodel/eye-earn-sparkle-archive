// Promo Videos Feed Component - Right swipe screen with reward earning
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Gift, Coins, Clock, Check, Eye, Volume2, VolumeX, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { rewardsService } from '@/services/rewards.service';
import { toast } from 'sonner';

interface PromoVideo {
  id: string;
  brandName: string;
  brandLogo: string;
  videoUrl: string;
  thumbnail: string;
  title: string;
  description: string;
  duration: number; // in seconds
  reward: {
    amount: number;
    type: 'vicoin' | 'icoin';
  };
  claimed: boolean;
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
  },
];

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
  const [isClaimingReward, setIsClaimingReward] = useState(false);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const watchStartTime = useRef<number | null>(null);

  const currentVideo = videos[currentIndex];

  // Start/stop watching when screen becomes active
  useEffect(() => {
    if (isActive && currentVideo && !currentVideo.claimed) {
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
  }, [isActive, currentIndex, currentVideo]);

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
          // Haptic feedback
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
  }, [currentIndex]);

  const claimReward = useCallback(async () => {
    if (!currentVideo || currentVideo.claimed || isClaimingReward) return;
    
    setIsClaimingReward(true);
    
    try {
      // Call the rewards service
      const result = await rewardsService.issueReward(
        'promo_view',
        currentVideo.id,
        {
          attentionScore: 95,
          coinType: currentVideo.reward.type,
        }
      );

      if (result.success && result.amount) {
        // Mark as claimed
        setVideos((prev) =>
          prev.map((v, idx) => (idx === currentIndex ? { ...v, claimed: true } : v))
        );
        
        // Refresh profile to update balance
        await refreshProfile();
        
        // Notify parent
        onRewardEarned?.(result.amount, result.coinType || currentVideo.reward.type);
        
        toast.success(`+${result.amount} ${result.coinType === 'vicoin' ? 'Vicoins' : 'Icoins'}!`, {
          description: 'Reward added to your wallet',
        });
        
        // Haptic feedback
        if (navigator.vibrate) {
          navigator.vibrate([50, 30, 50, 30, 50]);
        }
        
        // Auto advance after claiming
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

  const navigateVertical = (direction: 'up' | 'down') => {
    if (direction === 'up') {
      setCurrentIndex((prev) => (prev + 1) % videos.length);
    } else {
      setCurrentIndex((prev) => (prev - 1 + videos.length) % videos.length);
    }
    setProgress(0);
    setShowReward(false);
  };

  const skipVideo = () => {
    setCurrentIndex((prev) => (prev + 1) % videos.length);
    setProgress(0);
    setShowReward(false);
  };

  return (
    <div className="h-full w-full bg-background relative">
      {/* Video/Image Background */}
      <div className="absolute inset-0">
        <img
          src={currentVideo.thumbnail}
          alt={currentVideo.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/70" />
      </div>

      {/* Progress Bar with Timer */}
      <div className="absolute top-0 left-0 right-0 z-20 p-4">
        <div className="flex items-center gap-3 mb-2">
          <Clock className="w-4 h-4 text-white" />
          <div className="flex-1 h-2 bg-white/30 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-100 ease-linear',
                progress >= 100 ? 'bg-green-400' : 'bg-primary'
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-white text-sm font-medium min-w-[40px]">
            {Math.ceil((currentVideo.duration * (100 - progress)) / 100)}s
          </span>
        </div>
        
        {/* Reward indicator */}
        <div className="flex items-center justify-center gap-2 bg-black/40 backdrop-blur-sm rounded-full px-4 py-2 w-fit mx-auto">
          <Coins className={cn('w-5 h-5', currentVideo.reward.type === 'icoin' ? 'text-amber-400' : 'text-primary')} />
          <span className="text-white font-bold">+{currentVideo.reward.amount}</span>
          <span className="text-white/70 text-sm">
            {currentVideo.reward.type === 'vicoin' ? 'Vicoins' : 'Icoins'}
          </span>
        </div>
      </div>

      {/* Brand Header */}
      <div className="absolute top-24 left-0 right-0 z-10 px-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-white/50 bg-white">
            <img src={currentVideo.brandLogo} alt={currentVideo.brandName} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1">
            <p className="text-white font-bold text-lg">{currentVideo.brandName}</p>
            <p className="text-white/70 text-xs flex items-center gap-1">
              <Gift className="w-3 h-3" /> Sponsored
            </p>
          </div>
        </div>
      </div>

      {/* Reward Popup */}
      {showReward && !currentVideo.claimed && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card rounded-3xl p-8 mx-6 text-center animate-scale-in shadow-2xl">
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
              <Coins className={cn('w-10 h-10', currentVideo.reward.type === 'icoin' ? 'text-amber-400' : 'text-primary')} />
            </div>
            <h3 className="text-2xl font-bold mb-2">Reward Earned!</h3>
            <p className="text-4xl font-black text-primary mb-2">
              +{currentVideo.reward.amount}
            </p>
            <p className="text-muted-foreground mb-6">
              {currentVideo.reward.type === 'vicoin' ? 'Vicoins' : 'Icoins'}
            </p>
            <button
              onClick={claimReward}
              disabled={isClaimingReward}
              className="w-full py-4 bg-primary text-primary-foreground rounded-2xl font-bold text-lg flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors disabled:opacity-50"
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
        <div className="absolute top-40 left-1/2 -translate-x-1/2 z-20">
          <div className="flex items-center gap-2 bg-green-500/20 backdrop-blur-sm rounded-full px-4 py-2">
            <Check className="w-5 h-5 text-green-400" />
            <span className="text-green-400 font-medium">Reward Claimed</span>
          </div>
        </div>
      )}

      {/* Right Side Actions */}
      <div className="absolute right-4 bottom-40 z-20 flex flex-col items-center gap-6">
        <button className="flex flex-col items-center gap-1">
          <div className="w-12 h-12 rounded-full bg-black/30 flex items-center justify-center backdrop-blur-sm">
            <Eye className="w-7 h-7 text-white" />
          </div>
          <span className="text-white text-xs font-medium">Watch</span>
        </button>

        <button onClick={() => setIsMuted(!isMuted)} className="flex flex-col items-center gap-1">
          <div className="w-12 h-12 rounded-full bg-black/30 flex items-center justify-center backdrop-blur-sm">
            {isMuted ? (
              <VolumeX className="w-7 h-7 text-white" />
            ) : (
              <Volume2 className="w-7 h-7 text-white" />
            )}
          </div>
        </button>

        <button onClick={skipVideo} className="flex flex-col items-center gap-1">
          <div className="w-12 h-12 rounded-full bg-black/30 flex items-center justify-center backdrop-blur-sm">
            <ChevronUp className="w-7 h-7 text-white" />
          </div>
          <span className="text-white text-xs font-medium">Skip</span>
        </button>
      </div>

      {/* Bottom Content */}
      <div className="absolute bottom-24 left-0 right-20 z-10 px-4">
        <h2 className="text-white text-xl font-bold mb-2">{currentVideo.title}</h2>
        <p className="text-white/80 text-sm leading-relaxed">{currentVideo.description}</p>
      </div>

      {/* Swipe hint */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
        <p className="text-white/50 text-xs">← Swipe left for main feed</p>
      </div>

      {/* Video counter */}
      <div className="absolute bottom-6 right-4 z-10">
        <p className="text-white/50 text-xs">
          {currentIndex + 1} / {videos.length}
        </p>
      </div>
    </div>
  );
};
