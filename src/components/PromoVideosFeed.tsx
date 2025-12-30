// Promo Videos Feed Component - Right swipe screen with reward earning
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Gift, Coins, Clock, Check, Eye, Volume2, VolumeX, Play, Pause, Heart, MessageCircle, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { rewardsService } from '@/services/rewards.service';
import { toast } from 'sonner';
import { Neu3DButton, VideoTheme } from '@/components/ui/Neu3DButton';
import { GlassText } from '@/components/ui/GlassText';

interface FeedItem {
  id: string;
  type: 'promo' | 'user_post';
  brandName?: string;
  username?: string;
  brandLogo?: string;
  avatar?: string;
  videoUrl: string;
  thumbnail: string;
  title: string;
  description: string;
  duration: number;
  reward?: { amount: number; type: 'vicoin' | 'icoin' };
  claimed?: boolean;
  theme: VideoTheme;
  likes?: number;
  comments?: number;
}

const mockFeedItems: FeedItem[] = [
  { id: 'coca-cola-1', type: 'promo', brandName: 'Coca-Cola', brandLogo: 'https://images.unsplash.com/photo-1629203851122-3726ecdf080e?w=100&h=100&fit=crop', videoUrl: '', thumbnail: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?w=1080&h=1920&fit=crop', title: 'Share a Coke This Summer', description: 'Refresh your moments with the taste of happiness!', duration: 8, reward: { amount: 100, type: 'vicoin' }, claimed: false, theme: 'rose' },
  { id: 'user-1', type: 'user_post', username: '@travel_adventures', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop', videoUrl: '', thumbnail: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1080&h=1920&fit=crop', title: 'Sunrise in Bali', description: 'Woke up to this incredible view! #travel', duration: 15, theme: 'gold', likes: 12400, comments: 342 },
  { id: 'emirates-1', type: 'promo', brandName: 'Emirates Airlines', brandLogo: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=100&h=100&fit=crop', videoUrl: '', thumbnail: 'https://images.unsplash.com/photo-1540962351504-03099e0a754b?w=1080&h=1920&fit=crop', title: 'Fly Better with Emirates', description: 'Experience world-class luxury. Book now - 20% off!', duration: 8, reward: { amount: 150, type: 'vicoin' }, claimed: false, theme: 'gold' },
  { id: 'user-2', type: 'user_post', username: '@fitness_queen', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop', videoUrl: '', thumbnail: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=1080&h=1920&fit=crop', title: 'Morning Workout', description: 'Start your day right! 💪', duration: 20, theme: 'emerald', likes: 8900, comments: 156 },
  { id: 'pool-party-1', type: 'promo', brandName: 'Wet Republic', brandLogo: 'https://images.unsplash.com/photo-1519046904884-53103b34b206?w=100&h=100&fit=crop', videoUrl: '', thumbnail: 'https://images.unsplash.com/photo-1504196606672-aef5c9cefc92?w=1080&h=1920&fit=crop', title: 'Ultimate Pool Party', description: 'Vegas hottest pool party! Use code SWIM50', duration: 8, reward: { amount: 75, type: 'vicoin' }, claimed: false, theme: 'cyan' },
  { id: 'wellness-1', type: 'promo', brandName: 'Serenity Spa', brandLogo: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=100&h=100&fit=crop', videoUrl: '', thumbnail: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=1080&h=1920&fit=crop', title: 'Find Your Inner Peace', description: 'Luxury wellness retreat from $99!', duration: 8, reward: { amount: 2, type: 'icoin' }, claimed: false, theme: 'emerald' },
  { id: 'user-3', type: 'user_post', username: '@chef_marco', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop', videoUrl: '', thumbnail: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1080&h=1920&fit=crop', title: 'Perfect Italian Pasta', description: 'Secret family recipe 🍝', duration: 12, theme: 'gold', likes: 45200, comments: 892 },
  { id: 'nike-1', type: 'promo', brandName: 'Nike', brandLogo: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=100&h=100&fit=crop', videoUrl: '', thumbnail: 'https://images.unsplash.com/photo-1556906781-9a412961c28c?w=1080&h=1920&fit=crop', title: 'Just Do It - New Collection', description: 'Unleash your potential!', duration: 8, reward: { amount: 80, type: 'vicoin' }, claimed: false, theme: 'rose' },
  { id: 'starbucks-1', type: 'promo', brandName: 'Starbucks', brandLogo: 'https://images.unsplash.com/photo-1453614512568-c4024d13c247?w=100&h=100&fit=crop', videoUrl: '', thumbnail: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=1080&h=1920&fit=crop', title: 'Fall Favorites Are Back', description: 'Pumpkin Spice Latte season!', duration: 8, reward: { amount: 50, type: 'vicoin' }, claimed: false, theme: 'gold' },
  { id: 'user-4', type: 'user_post', username: '@dance_vibes', avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=100&h=100&fit=crop', videoUrl: '', thumbnail: 'https://images.unsplash.com/photo-1508700929628-666bc8bd84ea?w=1080&h=1920&fit=crop', title: 'New Choreography', description: 'Learn this dance! 💃', duration: 18, theme: 'magenta', likes: 67800, comments: 1204 },
  { id: 'apple-1', type: 'promo', brandName: 'Apple', brandLogo: 'https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=100&h=100&fit=crop', videoUrl: '', thumbnail: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=1080&h=1920&fit=crop', title: 'iPhone 16 Pro', description: 'The most powerful iPhone ever!', duration: 8, reward: { amount: 3, type: 'icoin' }, claimed: false, theme: 'purple' },
  { id: 'marriott-1', type: 'promo', brandName: 'Marriott Hotels', brandLogo: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=100&h=100&fit=crop', videoUrl: '', thumbnail: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=1080&h=1920&fit=crop', title: 'Luxury Awaits', description: 'Members save up to 25%!', duration: 8, reward: { amount: 120, type: 'vicoin' }, claimed: false, theme: 'gold' },
  { id: 'user-5', type: 'user_post', username: '@mountain_explorer', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop', videoUrl: '', thumbnail: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1080&h=1920&fit=crop', title: 'Summit Reached!', description: '14,000 ft above sea level 🏔️', duration: 10, theme: 'cyan', likes: 23100, comments: 456 },
  { id: 'samsung-1', type: 'promo', brandName: 'Samsung', brandLogo: 'https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=100&h=100&fit=crop', videoUrl: '', thumbnail: 'https://images.unsplash.com/photo-1585060544812-6b45742d762f?w=1080&h=1920&fit=crop', title: 'Galaxy Z Fold 6', description: 'Unfold the future!', duration: 8, reward: { amount: 90, type: 'vicoin' }, claimed: false, theme: 'purple' },
  { id: 'tesla-1', type: 'promo', brandName: 'Tesla', brandLogo: 'https://images.unsplash.com/photo-1560958089-b8a1929cea89?w=100&h=100&fit=crop', videoUrl: '', thumbnail: 'https://images.unsplash.com/photo-1617886322168-72b886573c35?w=1080&h=1920&fit=crop', title: 'Model S Plaid', description: 'Quickest production car ever!', duration: 8, reward: { amount: 200, type: 'vicoin' }, claimed: false, theme: 'rose' },
  { id: 'user-6', type: 'user_post', username: '@art_gallery', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop', videoUrl: '', thumbnail: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?w=1080&h=1920&fit=crop', title: 'Digital Art Process', description: 'Watch me create! 🎨', duration: 25, theme: 'magenta', likes: 34500, comments: 678 },
  { id: 'mcdonalds-1', type: 'promo', brandName: "McDonald's", brandLogo: 'https://images.unsplash.com/photo-1586816001966-79b736744398?w=100&h=100&fit=crop', videoUrl: '', thumbnail: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=1080&h=1920&fit=crop', title: "I'm Lovin' It", description: 'New crispy chicken sandwich!', duration: 8, reward: { amount: 40, type: 'vicoin' }, claimed: false, theme: 'gold' },
  { id: 'adidas-1', type: 'promo', brandName: 'Adidas', brandLogo: 'https://images.unsplash.com/photo-1518002171953-a080ee817e1f?w=100&h=100&fit=crop', videoUrl: '', thumbnail: 'https://images.unsplash.com/photo-1518002171953-a080ee817e1f?w=1080&h=1920&fit=crop', title: 'Impossible Is Nothing', description: 'New Ultraboost collection!', duration: 8, reward: { amount: 70, type: 'vicoin' }, claimed: false, theme: 'purple' },
  { id: 'user-7', type: 'user_post', username: '@pet_lover', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop', videoUrl: '', thumbnail: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=1080&h=1920&fit=crop', title: 'Meet My New Puppy!', description: 'Welcome home buddy! 🐕', duration: 8, theme: 'gold', likes: 89200, comments: 2341 },
  { id: 'rolex-1', type: 'promo', brandName: 'Rolex', brandLogo: 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=100&h=100&fit=crop', videoUrl: '', thumbnail: 'https://images.unsplash.com/photo-1522312346375-d1a52e2b99b3?w=1080&h=1920&fit=crop', title: 'Perpetual Excellence', description: 'Discover the art of watchmaking', duration: 8, reward: { amount: 5, type: 'icoin' }, claimed: false, theme: 'gold' },
  { id: 'spotify-1', type: 'promo', brandName: 'Spotify', brandLogo: 'https://images.unsplash.com/photo-1614680376593-902f74cf0d41?w=100&h=100&fit=crop', videoUrl: '', thumbnail: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=1080&h=1920&fit=crop', title: 'Premium Free 3 Months', description: 'Ad-free music, offline listening!', duration: 8, reward: { amount: 60, type: 'vicoin' }, claimed: false, theme: 'emerald' },
  { id: 'user-8', type: 'user_post', username: '@fashion_forward', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&h=100&fit=crop', videoUrl: '', thumbnail: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=1080&h=1920&fit=crop', title: 'OOTD - Street Style', description: 'Under $50 thrifted! 🛍️', duration: 12, theme: 'magenta', likes: 15600, comments: 289 },
  { id: 'delta-1', type: 'promo', brandName: 'Delta Airlines', brandLogo: 'https://images.unsplash.com/photo-1474302770737-173ee21bab63?w=100&h=100&fit=crop', videoUrl: '', thumbnail: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1080&h=1920&fit=crop', title: 'Keep Climbing', description: 'Double miles on international!', duration: 8, reward: { amount: 130, type: 'vicoin' }, claimed: false, theme: 'cyan' },
  { id: 'equinox-1', type: 'promo', brandName: 'Equinox', brandLogo: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=100&h=100&fit=crop', videoUrl: '', thumbnail: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1080&h=1920&fit=crop', title: 'Elevate Your Fitness', description: 'First month free!', duration: 8, reward: { amount: 85, type: 'vicoin' }, claimed: false, theme: 'purple' },
  { id: 'bmw-1', type: 'promo', brandName: 'BMW', brandLogo: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=100&h=100&fit=crop', videoUrl: '', thumbnail: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=1080&h=1920&fit=crop', title: 'Ultimate Driving Machine', description: 'New M4 Competition!', duration: 8, reward: { amount: 180, type: 'vicoin' }, claimed: false, theme: 'cyan' },
];

const themeOverlays: Record<VideoTheme, string> = {
  purple: 'from-[hsl(270,95%,10%,0.4)] via-transparent to-[hsl(270,95%,5%,0.8)]',
  magenta: 'from-[hsl(320,90%,10%,0.4)] via-transparent to-[hsl(320,90%,5%,0.8)]',
  cyan: 'from-[hsl(185,100%,10%,0.4)] via-transparent to-[hsl(185,100%,5%,0.8)]',
  gold: 'from-[hsl(45,100%,10%,0.4)] via-transparent to-[hsl(45,100%,5%,0.8)]',
  emerald: 'from-[hsl(160,84%,10%,0.4)] via-transparent to-[hsl(160,84%,5%,0.8)]',
  rose: 'from-[hsl(350,89%,10%,0.4)] via-transparent to-[hsl(350,89%,5%,0.8)]',
};

const themeProgressBars: Record<VideoTheme, string> = {
  purple: 'bg-[hsl(270,95%,65%)]', magenta: 'bg-[hsl(320,90%,60%)]', cyan: 'bg-[hsl(185,100%,50%)]',
  gold: 'bg-[hsl(45,100%,55%)]', emerald: 'bg-[hsl(160,84%,39%)]', rose: 'bg-[hsl(350,89%,60%)]',
};

interface PromoVideosFeedProps {
  isActive: boolean;
  onSwipeLeft?: () => void;
  onRewardEarned?: (amount: number, type: 'vicoin' | 'icoin') => void;
}

export const PromoVideosFeed: React.FC<PromoVideosFeedProps> = ({ isActive, onSwipeLeft, onRewardEarned }) => {
  const { refreshProfile } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [feedItems, setFeedItems] = useState(mockFeedItems);
  const [progress, setProgress] = useState(0);
  const [isWatching, setIsWatching] = useState(false);
  const [showReward, setShowReward] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isClaimingReward, setIsClaimingReward] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartY = useRef<number>(0);
  const touchEndY = useRef<number>(0);

  const currentItem = feedItems[currentIndex];
  const currentTheme = currentItem.theme;
  const isPromo = currentItem.type === 'promo';

  const handleTouchStart = useCallback((e: React.TouchEvent) => { touchStartY.current = e.touches[0].clientY; }, []);
  const handleTouchMove = useCallback((e: React.TouchEvent) => { touchEndY.current = e.touches[0].clientY; }, []);
  const handleTouchEnd = useCallback(() => {
    const diff = touchStartY.current - touchEndY.current;
    if (Math.abs(diff) > 50) {
      setCurrentIndex(prev => diff > 0 ? (prev + 1) % feedItems.length : (prev - 1 + feedItems.length) % feedItems.length);
    }
    touchStartY.current = 0; touchEndY.current = 0;
  }, [feedItems.length]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (Math.abs(e.deltaY) > 30) {
      setCurrentIndex(prev => e.deltaY > 0 ? (prev + 1) % feedItems.length : (prev - 1 + feedItems.length) % feedItems.length);
    }
  }, [feedItems.length]);

  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  const handleScreenTap = useCallback(() => {
    setShowControls(prev => !prev);
    if (!showControls) resetControlsTimeout();
  }, [showControls, resetControlsTimeout]);

  useEffect(() => { return () => { if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); }; }, []);

  useEffect(() => {
    if (isActive && currentItem && isPromo && !currentItem.claimed && !isPaused) setIsWatching(true);
    else setIsWatching(false);
  }, [isActive, currentIndex, currentItem, isPaused, isPromo]);

  useEffect(() => {
    if (isWatching && currentItem && isPromo && !currentItem.claimed) {
      const duration = currentItem.duration * 1000;
      const startTime = Date.now();
      progressInterval.current = setInterval(() => {
        const newProgress = Math.min(((Date.now() - startTime) / duration) * 100, 100);
        setProgress(newProgress);
        if (newProgress >= 100) {
          clearInterval(progressInterval.current!);
          setIsWatching(false);
          setShowReward(true);
          navigator.vibrate?.([100, 50, 100]);
        }
      }, 50);
      return () => { if (progressInterval.current) clearInterval(progressInterval.current); };
    }
  }, [isWatching, currentItem, isPromo]);

  useEffect(() => { setProgress(0); setShowReward(false); setIsPaused(false); }, [currentIndex]);

  const claimReward = useCallback(async () => {
    if (!currentItem || !isPromo || currentItem.claimed || isClaimingReward || !currentItem.reward) return;
    setIsClaimingReward(true);
    try {
      const result = await rewardsService.issueReward('promo_view', currentItem.id, { attentionScore: 95, coinType: currentItem.reward.type });
      if (result.success && result.amount) {
        setFeedItems(prev => prev.map((v, idx) => idx === currentIndex ? { ...v, claimed: true } : v));
        await refreshProfile();
        onRewardEarned?.(result.amount, result.coinType || currentItem.reward.type);
        toast.success(`+${result.amount} ${result.coinType === 'vicoin' ? 'Vicoins' : 'Icoins'}!`);
        setTimeout(() => setShowReward(false), 1500);
      }
    } catch (error) { console.error('Error claiming reward:', error); }
    finally { setIsClaimingReward(false); }
  }, [currentItem, currentIndex, isClaimingReward, isPromo, onRewardEarned, refreshProfile]);

  const formatNumber = (num: number) => num >= 1000000 ? (num / 1000000).toFixed(1) + 'M' : num >= 1000 ? (num / 1000).toFixed(1) + 'K' : num.toString();

  return (
    <div className="h-full w-full bg-background relative overflow-hidden" onClick={handleScreenTap} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} onWheel={handleWheel}>
      <div className="absolute inset-0">
        <img src={currentItem.thumbnail} alt={currentItem.title} className="w-full h-full object-cover" />
        <div className={cn('absolute inset-0 bg-gradient-to-b', themeOverlays[currentTheme])} />
      </div>

      {isPromo && currentItem.reward && (
        <div className="absolute top-0 left-0 right-0 z-20 p-4">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-4 h-4 text-white" />
            <div className="flex-1 h-2.5 bg-white/20 rounded-full overflow-hidden">
              <div className={cn('h-full rounded-full transition-all', progress >= 100 ? 'bg-green-400' : themeProgressBars[currentTheme])} style={{ width: `${progress}%` }} />
            </div>
            <GlassText theme={currentTheme} variant="glow" size="sm">{Math.ceil((currentItem.duration * (100 - progress)) / 100)}s</GlassText>
          </div>
          <div className="flex items-center justify-center gap-2 glass-neon rounded-full px-4 py-2 w-fit mx-auto">
            <Coins className={cn('w-5 h-5', currentItem.reward.type === 'icoin' ? 'text-icoin' : 'text-primary')} />
            <GlassText theme={currentItem.reward.type === 'icoin' ? 'gold' : currentTheme} variant="gradient" size="lg">+{currentItem.reward.amount}</GlassText>
            <span className="text-white/70 text-sm">{currentItem.reward.type === 'vicoin' ? 'Vicoins' : 'Icoins'}</span>
          </div>
        </div>
      )}

      <div className={cn("absolute left-0 right-0 z-10 px-4", isPromo ? "top-28" : "top-4")}>
        <div className="flex items-center gap-3 glass-neon rounded-2xl p-3">
          <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-primary/50">
            <img src={isPromo ? currentItem.brandLogo : currentItem.avatar} alt="" className="w-full h-full object-cover" />
          </div>
          <div className="flex-1">
            <GlassText theme={currentTheme} variant="3d" size="lg" as="p">{isPromo ? currentItem.brandName : currentItem.username}</GlassText>
            <p className="text-white/60 text-xs flex items-center gap-1">{isPromo ? <><Gift className="w-3 h-3" /> Sponsored</> : <><Eye className="w-3 h-3" /> {formatNumber(currentItem.likes || 0)} likes</>}</p>
          </div>
        </div>
      </div>

      {showReward && isPromo && !currentItem.claimed && currentItem.reward && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-md">
          <div className="glass-neon rounded-3xl p-8 mx-6 text-center animate-scale-in">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 bg-gradient-to-br from-primary/30 to-accent/20">
              <Coins className={cn('w-10 h-10', currentItem.reward.type === 'icoin' ? 'text-icoin' : 'text-primary')} />
            </div>
            <GlassText theme={currentTheme} variant="gradient" size="xl" as="h3" className="mb-2">Reward Earned!</GlassText>
            <GlassText theme={currentItem.reward.type === 'icoin' ? 'gold' : currentTheme} variant="neon" className="text-5xl mb-2 block">+{currentItem.reward.amount}</GlassText>
            <button onClick={claimReward} disabled={isClaimingReward} className="w-full py-4 rounded-2xl font-bold bg-gradient-to-r from-primary to-accent text-white flex items-center justify-center gap-2">
              {isClaimingReward ? 'Claiming...' : <><Check className="w-5 h-5" /> Claim Reward</>}
            </button>
          </div>
        </div>
      )}

      {isPromo && currentItem.claimed && (
        <div className="absolute top-44 left-1/2 -translate-x-1/2 z-20">
          <div className="flex items-center gap-2 glass-neon rounded-full px-4 py-2 border border-green-500/30">
            <Check className="w-5 h-5 text-green-400" />
            <GlassText theme="emerald" variant="glow" size="sm">Reward Claimed</GlassText>
          </div>
        </div>
      )}

      {showControls && (
        <div className="absolute inset-0 flex items-center justify-center z-20 animate-fade-in" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-6">
            <Neu3DButton onClick={() => { setIsPaused(!isPaused); resetControlsTimeout(); }} theme={currentTheme} variant="glass" size="lg">
              {isPaused ? <Play className="w-8 h-8 ml-1" /> : <Pause className="w-8 h-8" />}
            </Neu3DButton>
            <Neu3DButton onClick={() => { setIsMuted(!isMuted); resetControlsTimeout(); }} theme={currentTheme} variant="glass">
              {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
            </Neu3DButton>
          </div>
        </div>
      )}

      {!isPromo && (
        <div className="absolute right-4 bottom-40 z-10 flex flex-col items-center gap-4">
          <button className="flex flex-col items-center gap-1"><div className="w-12 h-12 rounded-full glass-neon flex items-center justify-center"><Heart className="w-6 h-6 text-white" /></div><span className="text-white text-xs">{formatNumber(currentItem.likes || 0)}</span></button>
          <button className="flex flex-col items-center gap-1"><div className="w-12 h-12 rounded-full glass-neon flex items-center justify-center"><MessageCircle className="w-6 h-6 text-white" /></div><span className="text-white text-xs">{formatNumber(currentItem.comments || 0)}</span></button>
          <button className="flex flex-col items-center gap-1"><div className="w-12 h-12 rounded-full glass-neon flex items-center justify-center"><Share2 className="w-6 h-6 text-white" /></div><span className="text-white text-xs">Share</span></button>
        </div>
      )}

      <div className="absolute bottom-24 left-4 right-20 z-10">
        <GlassText theme={currentTheme} variant="3d" size="xl" as="h2" className="mb-2">{currentItem.title}</GlassText>
        <p className="text-white/80 text-sm line-clamp-2">{currentItem.description}</p>
      </div>

      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10"><div className="flex flex-col items-center gap-1 animate-bounce"><div className="w-1 h-6 bg-white/30 rounded-full" /><span className="text-white/50 text-xs">Swipe</span></div></div>
      <div className="absolute top-4 right-4 z-20"><div className="glass-neon rounded-full px-3 py-1"><span className="text-white/80 text-sm">{currentIndex + 1}/{feedItems.length}</span></div></div>
    </div>
  );
};

export default PromoVideosFeed;