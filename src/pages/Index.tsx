import React, { useState, useCallback } from 'react';
import { MediaCard } from '@/components/MediaCard';
import { FloatingControls, ControlsVisibilityProvider } from '@/components/FloatingControls';
import { CoinSlideAnimation } from '@/components/CoinSlideAnimation';
import { WalletScreen } from '@/components/WalletScreen';
import { ProfileScreen } from '@/components/ProfileScreen';
import { DiscoveryMap } from '@/components/DiscoveryMap';
import { PersonalizedFeed } from '@/components/PersonalizedFeed';
import { MessagesScreen } from '@/components/MessagesScreen';
import { CrossNavigation } from '@/components/CrossNavigation';
import { BottomNavigation } from '@/components/BottomNavigation';
import { OnboardingFlow } from '@/components/onboarding';
import { FriendsPostsFeed } from '@/components/FriendsPostsFeed';
import { PromoVideosFeed } from '@/components/PromoVideosFeed';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useAuth } from '@/contexts/AuthContext';
import { rewardsService } from '@/services/rewards.service';
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

type HorizontalScreen = 'friends' | 'main' | 'promos';

const Index = () => {
  const { profile, refreshProfile } = useAuth();
  const { showOnboarding, closeOnboarding, completeOnboarding, openOnboarding } = useOnboarding();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [showCoinSlide, setShowCoinSlide] = useState(false);
  const [coinSlideType, setCoinSlideType] = useState<'vicoin' | 'icoin'>('vicoin');
  const [showWallet, setShowWallet] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showFeed, setShowFeed] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'up' | 'down' | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  
  // Horizontal screen navigation
  const [currentScreen, setCurrentScreen] = useState<HorizontalScreen>('main');
  const [horizontalSwipeDirection, setHorizontalSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [isHorizontalTransitioning, setIsHorizontalTransitioning] = useState(false);
  
  const vicoins = profile?.vicoin_balance || 0;
  const icoins = profile?.icoin_balance || 0;

  const currentMedia = mockMedia[currentIndex];

  // Navigate horizontal screens
  const navigateHorizontal = useCallback((direction: 'left' | 'right') => {
    if (isHorizontalTransitioning) return;
    
    let newScreen: HorizontalScreen = currentScreen;
    
    if (direction === 'left') {
      // Swipe left = go right (to promos from main, or main from friends)
      if (currentScreen === 'main') newScreen = 'promos';
      else if (currentScreen === 'friends') newScreen = 'main';
    } else {
      // Swipe right = go left (to friends from main, or main from promos)
      if (currentScreen === 'main') newScreen = 'friends';
      else if (currentScreen === 'promos') newScreen = 'main';
    }
    
    if (newScreen !== currentScreen) {
      setIsHorizontalTransitioning(true);
      setHorizontalSwipeDirection(direction);
      
      setTimeout(() => {
        setCurrentScreen(newScreen);
        setHorizontalSwipeDirection(null);
        setIsHorizontalTransitioning(false);
      }, 300);
    }
  }, [currentScreen, isHorizontalTransitioning]);

  // Handle promo completion - use rewards service for secure backend validation
  const handleMediaComplete = useCallback(async (attentionValidated: boolean = true, attentionScore?: number) => {
    // Only give rewards if attention was validated for promo content
    if (currentMedia.reward && profile && attentionValidated) {
      // Use rewards service for secure backend validation
      const result = await rewardsService.issueReward(
        'promo_view',
        currentMedia.id,
        {
          attentionScore: attentionScore || 85,
          coinType: currentMedia.reward.type,
        }
      );

      if (result.success && result.amount) {
        setCoinSlideType(result.coinType || currentMedia.reward.type);
        setShowCoinSlide(true);
        
        // Refresh profile to get updated balance
        await refreshProfile();
        toast.success(`+${result.amount} ${result.coinType === 'vicoin' ? 'Vicoins' : 'Icoins'}!`);

        // Haptic feedback
        if (navigator.vibrate) {
          navigator.vibrate([50, 30, 50]);
        }
      } else if (result.error) {
        // Check for specific errors
        if (result.error.includes('already claimed') || result.error.includes('Reward already')) {
          console.log('[Index] Content already rewarded');
        } else if (result.error.includes('limit')) {
          toast.info('Daily limit reached', {
            description: 'Come back tomorrow for more rewards!',
          });
        } else {
          console.error('[Index] Reward error:', result.error);
        }
      }
    } else if (currentMedia.reward && !attentionValidated) {
      // Attention not validated - no reward
      console.log('[Index] Reward not given - attention validation failed');
    }
  }, [currentMedia, profile, refreshProfile]);

  const handleRewardEarned = useCallback((amount: number, type: 'vicoin' | 'icoin') => {
    setCoinSlideType(type);
    setShowCoinSlide(true);
  }, []);

  const handleCoinSlideComplete = useCallback(() => {
    setShowCoinSlide(false);
  }, []);

  // Navigate with swipe animation (vertical)
  const navigateToMedia = useCallback((direction: 'up' | 'down') => {
    if (isTransitioning || currentScreen !== 'main') return;
    
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
  }, [isTransitioning, currentScreen]);

  // Skip to next media
  const handleSkip = useCallback(() => {
    navigateToMedia('up');
  }, [navigateToMedia]);

  const handleNavigate = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    if (direction === 'up') {
      navigateToMedia('up');
    } else if (direction === 'down') {
      navigateToMedia('down');
    } else if (direction === 'left') {
      navigateHorizontal('left');
    } else if (direction === 'right') {
      navigateHorizontal('right');
    }
  }, [navigateToMedia, navigateHorizontal]);

  // Swipe gesture handling
  const { handlers } = useSwipeNavigation({
    threshold: 80,
    onSwipeUp: () => handleNavigate('up'),
    onSwipeDown: () => handleNavigate('down'),
    onSwipeLeft: () => handleNavigate('left'),
    onSwipeRight: () => handleNavigate('right'),
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
    // Close all modals first
    setShowProfile(false);
    setShowMap(false);
    setShowFeed(false);
    setShowMessages(false);
    
    switch (tab) {
      case 'profile':
        setShowProfile(true);
        break;
      case 'messages':
        setShowMessages(true);
        break;
      case 'map':
        setShowMap(true);
        break;
      case 'create':
        setShowFeed(true); // Show personalized feed on create tab for now
        break;
      default:
        break;
    }
  };

  // Calculate screen positions for horizontal navigation
  const getScreenTransform = (screen: HorizontalScreen) => {
    const screenOrder: HorizontalScreen[] = ['friends', 'main', 'promos'];
    const currentIdx = screenOrder.indexOf(currentScreen);
    const screenIdx = screenOrder.indexOf(screen);
    const offset = (screenIdx - currentIdx) * 100;
    
    // Apply transition animation
    let translateX = offset;
    if (horizontalSwipeDirection === 'left') {
      translateX = offset - 10;
    } else if (horizontalSwipeDirection === 'right') {
      translateX = offset + 10;
    }
    
    return `translateX(${translateX}%)`;
  };

  return (
    <ControlsVisibilityProvider autoHideDelay={3000}>
      <div 
        className="fixed inset-0 bg-background overflow-hidden touch-none"
        {...handlers}
      >
        {/* Horizontal Screen Container */}
        <div className="absolute inset-0 flex">
          {/* Friends Posts Feed (Left) */}
          <div 
            className={cn(
              "absolute inset-0 transition-transform duration-300 ease-out",
              currentScreen === 'friends' ? 'z-10' : 'z-0'
            )}
            style={{ transform: getScreenTransform('friends') }}
          >
            <FriendsPostsFeed 
              isActive={currentScreen === 'friends'} 
              onSwipeRight={() => navigateHorizontal('right')}
            />
          </div>

          {/* Main Media Feed (Center) */}
          <div 
            className={cn(
              "absolute inset-0 transition-transform duration-300 ease-out",
              currentScreen === 'main' ? 'z-10' : 'z-0'
            )}
            style={{ transform: getScreenTransform('main') }}
          >
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
                contentId={currentMedia.id}
                onComplete={handleMediaComplete}
                onSkip={handleSkip}
                isActive={!isTransitioning && currentScreen === 'main'}
              />
            </div>

            {/* Cross Navigation hints - only on main screen */}
            {currentScreen === 'main' && (
              <CrossNavigation onNavigate={handleNavigate} />
            )}

            {/* Floating Controls - only on main screen */}
            {currentScreen === 'main' && (
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
            )}
          </div>

          {/* Promo Videos Feed (Right) */}
          <div 
            className={cn(
              "absolute inset-0 transition-transform duration-300 ease-out",
              currentScreen === 'promos' ? 'z-10' : 'z-0'
            )}
            style={{ transform: getScreenTransform('promos') }}
          >
            <PromoVideosFeed 
              isActive={currentScreen === 'promos'} 
              onSwipeLeft={() => navigateHorizontal('left')}
              onRewardEarned={handleRewardEarned}
            />
          </div>
        </div>

        {/* Screen Indicators */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2">
          {(['friends', 'main', 'promos'] as HorizontalScreen[]).map((screen) => (
            <button
              key={screen}
              onClick={() => {
                if (screen !== currentScreen && !isHorizontalTransitioning) {
                  const direction = (['friends', 'main', 'promos'].indexOf(screen) > ['friends', 'main', 'promos'].indexOf(currentScreen)) ? 'left' : 'right';
                  navigateHorizontal(direction);
                }
              }}
              className={cn(
                "h-1 rounded-full transition-all duration-300",
                currentScreen === screen 
                  ? "w-6 bg-white" 
                  : "w-2 bg-white/40 hover:bg-white/60"
              )}
            />
          ))}
        </div>

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
        />

        {/* Profile Screen */}
        <ProfileScreen
          isOpen={showProfile}
          onClose={() => { setShowProfile(false); setActiveTab('home'); }}
        />

        {/* Discovery Map */}
        <DiscoveryMap
          isOpen={showMap}
          onClose={() => { setShowMap(false); setActiveTab('home'); }}
        />

        {/* Personalized AI Feed */}
        {showFeed && (
          <div className="fixed inset-0 z-40 bg-background">
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between p-4 border-b">
                <h1 className="text-xl font-bold">For You</h1>
                <button 
                  onClick={() => { setShowFeed(false); setActiveTab('home'); }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-hidden pb-20">
                <PersonalizedFeed />
              </div>
            </div>
          </div>
        )}

        {/* Messages Screen */}
        <MessagesScreen
          isOpen={showMessages}
          onClose={() => { setShowMessages(false); setActiveTab('home'); }}
        />

        {/* Bottom Navigation - centered at bottom */}
        <BottomNavigation 
          activeTab={activeTab} 
          onTabChange={handleTabChange} 
        />

        {/* Onboarding Flow for new users */}
        <OnboardingFlow
          isOpen={showOnboarding}
          onClose={closeOnboarding}
          onComplete={completeOnboarding}
        />
      </div>
    </ControlsVisibilityProvider>
  );
};

export default Index;
