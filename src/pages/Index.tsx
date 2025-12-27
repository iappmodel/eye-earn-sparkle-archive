import React, { useState, useCallback } from 'react';
import { MediaCard } from '@/components/MediaCard';
import { FloatingControls, ControlsVisibilityProvider } from '@/components/FloatingControls';
import { CoinSlideAnimation } from '@/components/CoinSlideAnimation';
import { WalletScreen } from '@/components/WalletScreen';
import { ProfileScreen } from '@/components/ProfileScreen';
import { CrossNavigation } from '@/components/CrossNavigation';
import { BottomNavigation } from '@/components/BottomNavigation';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Mock data - more realistic content
const mockMedia = [
  {
    id: '1',
    type: 'promo' as const,
    src: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1920&h=1080&fit=crop',
    duration: 8,
    reward: { amount: 50, type: 'vicoin' as const },
    title: 'Holiday Special',
  },
  {
    id: '2',
    type: 'video' as const,
    src: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=1920&h=1080&fit=crop',
    duration: 15,
    title: 'Trending Now',
  },
  {
    id: '3',
    type: 'promo' as const,
    src: 'https://images.unsplash.com/photo-1560472355-536de3962603?w=1920&h=1080&fit=crop',
    duration: 10,
    reward: { amount: 1, type: 'icoin' as const },
    title: 'Coffee Shop Reward',
  },
  {
    id: '4',
    type: 'image' as const,
    src: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&h=1080&fit=crop',
    title: 'Mountain View',
  },
  {
    id: '5',
    type: 'promo' as const,
    src: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=1920&h=1080&fit=crop',
    duration: 12,
    reward: { amount: 25, type: 'vicoin' as const },
    title: 'Sneaker Drop',
  },
];

const Index = () => {
  const { profile, refreshProfile } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [showCoinSlide, setShowCoinSlide] = useState(false);
  const [coinSlideType, setCoinSlideType] = useState<'vicoin' | 'icoin'>('vicoin');
  const [showWallet, setShowWallet] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'up' | 'down' | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [activeTab, setActiveTab] = useState('home');

  const vicoins = profile?.vicoin_balance || 0;
  const icoins = profile?.icoin_balance || 0;

  const currentMedia = mockMedia[currentIndex];

  // Mock transactions for wallet - will be replaced with real data later
  const mockTransactions = [
    { id: '1', type: 'earned' as const, amount: 50, coinType: 'vicoin' as const, description: 'Watched Holiday Special promo', timestamp: new Date() },
    { id: '2', type: 'received' as const, amount: 100, coinType: 'vicoin' as const, description: 'Gift from @maria', timestamp: new Date(Date.now() - 86400000) },
    { id: '3', type: 'earned' as const, amount: 1, coinType: 'icoin' as const, description: 'Coffee Shop promotion', timestamp: new Date(Date.now() - 172800000) },
    { id: '4', type: 'spent' as const, amount: 500, coinType: 'vicoin' as const, description: 'Promoted your video', timestamp: new Date(Date.now() - 259200000) },
  ];

  // Handle promo completion - trigger coin slide animation and update DB
  const handleMediaComplete = useCallback(async () => {
    if (currentMedia.reward && profile) {
      setCoinSlideType(currentMedia.reward.type);
      setShowCoinSlide(true);

      // Update balance in database
      const field = currentMedia.reward.type === 'vicoin' ? 'vicoin_balance' : 'icoin_balance';
      const currentBalance = currentMedia.reward.type === 'vicoin' ? vicoins : icoins;
      
      const { error } = await supabase
        .from('profiles')
        .update({ [field]: currentBalance + currentMedia.reward.amount })
        .eq('user_id', profile.user_id);

      if (error) {
        console.error('Error updating balance:', error);
        toast.error('Failed to update balance');
      } else {
        // Refresh profile to get updated balance
        await refreshProfile();
        toast.success(`+${currentMedia.reward.amount} ${currentMedia.reward.type === 'vicoin' ? 'Vicoins' : 'Icoins'}!`);
      }

      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate([50, 30, 50]);
      }
    }
  }, [currentMedia, profile, vicoins, icoins, refreshProfile]);

  const handleCoinSlideComplete = useCallback(() => {
    setShowCoinSlide(false);
  }, []);

  // Navigate with swipe animation
  const navigateToMedia = useCallback((direction: 'up' | 'down') => {
    if (isTransitioning) return;
    
    setIsTransitioning(true);
    setSwipeDirection(direction);

    setTimeout(() => {
      if (direction === 'up') {
        setCurrentIndex(prev => (prev + 1) % mockMedia.length);
      } else {
        setCurrentIndex(prev => (prev - 1 + mockMedia.length) % mockMedia.length);
      }
      setIsLiked(false);
      setSwipeDirection(null);
      setIsTransitioning(false);
    }, 300);
  }, [isTransitioning]);

  const handleNavigate = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (direction === 'up') {
      navigateToMedia('up');
    } else if (direction === 'down') {
      navigateToMedia('down');
    } else {
      toast(`Navigating ${direction}...`, {
        description: `This would show ${direction === 'left' ? 'friends feed' : 'promotions'}`,
      });
    }
  }, [navigateToMedia]);

  // Swipe gesture handling
  const { handlers } = useSwipeNavigation({
    threshold: 80,
    onSwipeUp: () => navigateToMedia('up'),
    onSwipeDown: () => navigateToMedia('down'),
    onSwipeLeft: () => handleNavigate('right'),
    onSwipeRight: () => handleNavigate('left'),
  });

  const handleLike = () => {
    setIsLiked(!isLiked);
    if (!isLiked) {
      if (navigator.vibrate) navigator.vibrate(10);
      toast('Liked!', { description: 'Added to your favorites' });
    }
  };

  const handleComment = () => {
    toast('Comments', { description: 'Comments panel coming soon...' });
  };

  const handleShare = () => {
    toast('Share', { description: 'Share options coming soon...' });
  };

  const handleSettings = () => {
    toast('Settings', { description: 'Settings panel coming soon...' });
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    switch (tab) {
      case 'profile':
        setShowProfile(true);
        break;
      case 'messages':
        toast('Messages', { description: 'Messages coming soon...' });
        break;
      case 'map':
        toast('Discovery Map', { description: 'Explore nearby offers coming soon...' });
        break;
      case 'create':
        toast('Create', { description: 'Create content coming soon...' });
        break;
      default:
        break;
    }
  };

  return (
    <ControlsVisibilityProvider autoHideDelay={3000}>
      <div 
        className="fixed inset-0 bg-background overflow-hidden touch-none"
        {...handlers}
      >
        {/* Main Media Display with swipe animation */}
        <div className={cn(
          'absolute inset-0 transition-transform duration-300 ease-out',
          swipeDirection === 'up' && 'animate-swipe-exit-up',
          swipeDirection === 'down' && 'animate-swipe-exit-down'
        )}>
          <MediaCard
            key={currentMedia.id}
            type={currentMedia.type}
            src={currentMedia.src}
            duration={currentMedia.duration}
            reward={currentMedia.reward}
            onComplete={handleMediaComplete}
            isActive={!isTransitioning}
          />
        </div>

        {/* Cross Navigation hints */}
        <CrossNavigation onNavigate={handleNavigate} />

        {/* Floating Controls */}
        <FloatingControls
          onWalletClick={() => setShowWallet(true)}
          onProfileClick={() => setShowProfile(true)}
          onLikeClick={handleLike}
          onCommentClick={handleComment}
          onShareClick={handleShare}
          onSettingsClick={handleSettings}
          isLiked={isLiked}
          likeCount={1234}
          commentCount={89}
        />

        {/* Coin slide animation on reward */}
        <CoinSlideAnimation
          type={coinSlideType}
          isAnimating={showCoinSlide}
          onComplete={handleCoinSlideComplete}
        />

        {/* Wallet Screen */}
        <WalletScreen
          isOpen={showWallet}
          onClose={() => setShowWallet(false)}
          vicoins={vicoins}
          icoins={icoins}
          transactions={mockTransactions}
        />

        {/* Profile Screen */}
        <ProfileScreen
          isOpen={showProfile}
          onClose={() => { setShowProfile(false); setActiveTab('home'); }}
        />

        {/* Bottom Navigation - centered at bottom */}
        <BottomNavigation 
          activeTab={activeTab} 
          onTabChange={handleTabChange} 
        />
      </div>
    </ControlsVisibilityProvider>
  );
};

export default Index;
