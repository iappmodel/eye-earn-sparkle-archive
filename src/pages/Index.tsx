import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { MediaCard } from '@/components/MediaCard';
import { FloatingControls, ControlsVisibilityProvider, DoubleTapGestureDetector, QuickVisibilityToggle } from '@/components/FloatingControls';
import { CoinSlideAnimation } from '@/components/CoinSlideAnimation';
import { WalletScreen } from '@/components/WalletScreen';
import { ProfileScreen } from '@/components/ProfileScreen';
import { DiscoveryMap } from '@/components/DiscoveryMap';
import { PersonalizedFeed } from '@/components/PersonalizedFeed';
import { UnifiedContentFeed } from '@/components/UnifiedContentFeed';
import { MessagesScreen } from '@/components/MessagesScreen';
import { CrossNavigation } from '@/components/CrossNavigation';
import { BottomNavigation } from '@/components/BottomNavigation';
import { OnboardingFlow } from '@/components/onboarding';
import { FriendsPostsFeed } from '@/components/FriendsPostsFeed';
import { PromoVideosFeed } from '@/components/PromoVideosFeed';
import { ThemePresetsSheet } from '@/components/ThemePresetsSheet';
import { GestureTutorial, useGestureTutorial } from '@/components/GestureTutorial';
import { AttentionAchievementsPanel, AchievementUnlockNotification, useAttentionAchievements } from '@/components/AttentionAchievements';
import { useMediaSettings } from '@/components/MediaSettings';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ConfettiCelebration, useCelebration } from '@/components/ConfettiCelebration';
import { MediaCardSkeleton } from '@/components/ui/ContentSkeleton';
import { PullToRefresh } from '@/components/ui/PullToRefresh';
import { CommentsPanel } from '@/components/CommentsPanel';
import { ShareSheet } from '@/components/ShareSheet';
import { NetworkStatusIndicator } from '@/components/NetworkStatusIndicator';

import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import { useOnboarding } from '@/hooks/useOnboarding';
import { usePageNavigation } from '@/hooks/usePageNavigation';
import { useContentFeed } from '@/hooks/useContentFeed';
import { useContentLikes } from '@/hooks/useContentLikes';
import { useUICustomization } from '@/contexts/UICustomizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { rewardsService } from '@/services/rewards.service';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
type HorizontalScreen = 'friends' | 'main' | 'promos';

const Index = () => {
  const { profile, refreshProfile } = useAuth();
  const { showOnboarding, closeOnboarding, completeOnboarding, openOnboarding } = useOnboarding();
  const { pageLayout, getPagesByDirection } = useUICustomization();
  const { showTutorial, completeTutorial } = useGestureTutorial();
  const { isActive: showCelebration, type: celebrationType, celebrate, stopCelebration } = useCelebration();
  const { light, medium } = useHapticFeedback();
  const { eyeTrackingEnabled } = useMediaSettings();
  const { stats: achievementStats, unlockedAchievements, newlyUnlocked, dismissNotification } = useAttentionAchievements();
  const [showAchievementsPanel, setShowAchievementsPanel] = useState(false);
  
  // Real content from database
  const { content: feedContent, isLoading, refresh: refreshFeed } = useContentFeed();
  
  // Page navigation from configured layout
  const {
    currentPage,
    currentState,
    transition,
    transitionState,
    canNavigate,
    navigate: pageNavigate,
    getTransitionClasses,
    getTransitionStyles,
  } = usePageNavigation();
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showCoinSlide, setShowCoinSlide] = useState(false);
  const [coinSlideType, setCoinSlideType] = useState<'vicoin' | 'icoin'>('vicoin');
  const [showWallet, setShowWallet] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showFeed, setShowFeed] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [showThemePresets, setShowThemePresets] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'up' | 'down' | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [useUnifiedFeed, setUseUnifiedFeed] = useState(false);

  // Safety: if a transition ever gets stuck (can appear as a blank, non-interactive screen),
  // force the container back to a visible, interactive state.
  const [forceVisible, setForceVisible] = useState(false);
  useEffect(() => {
    if (transitionState === 'idle') {
      setForceVisible(false);
      return;
    }

    const maxMs = Math.max(transition?.duration ?? 300, 300) * 4;
    const t = window.setTimeout(() => setForceVisible(true), maxMs);
    return () => window.clearTimeout(t);
  }, [transitionState, transition?.duration]);

  const safeTransitionStyles: React.CSSProperties = forceVisible
    ? { opacity: 1, transform: 'none', visibility: 'visible' }
    : getTransitionStyles();

  const safeTransitionClasses = cn('absolute inset-0', !forceVisible && getTransitionClasses());
  
  // Active direction for CrossNavigation indicator
  const [activeDirection, setActiveDirection] = useState<'up' | 'down' | 'left' | 'right' | null>(null);
  
  const vicoins = profile?.vicoin_balance || 0;
  const icoins = profile?.icoin_balance || 0;
  
  // Current media from real feed - with safety check
  const currentMedia = useMemo(() => {
    if (!feedContent || feedContent.length === 0) return null;
    return feedContent[currentIndex] || feedContent[0];
  }, [feedContent, currentIndex]);
  
  const isPromoContent = currentMedia?.type === 'promo' && !!currentMedia?.reward;
  
  // Like/Save persistence - only when we have current media
  const { isLiked, isSaved, likesCount, toggleLike, toggleSave } = useContentLikes(currentMedia?.id || null);
  
  // Pull to refresh handler
  const handleRefresh = useCallback(async () => {
    await Promise.all([refreshProfile(), refreshFeed()]);
    toast.success('Feed refreshed!');
  }, [refreshProfile]);

  
  
  // Map content type to component rendering
  const renderPageContent = useCallback((contentType: string, isActive: boolean) => {
    switch (contentType) {
      case 'friends':
        return <FriendsPostsFeed isActive={isActive} onSwipeRight={() => pageNavigate('right')} />;
      case 'promotions':
        return (
          <PromoVideosFeed 
            isActive={isActive} 
            onSwipeLeft={() => pageNavigate('left')}
            onRewardEarned={(amount, type) => {
              setCoinSlideType(type);
              setShowCoinSlide(true);
            }}
          />
        );
      case 'discovery':
        return <DiscoveryMap isOpen={true} onClose={() => pageNavigate('down')} />;
      case 'rewards':
      case 'wallet':
        return <WalletScreen isOpen={true} onClose={() => pageNavigate('up')} vicoins={vicoins} icoins={icoins} />;
      case 'messages':
        return <MessagesScreen isOpen={true} onClose={() => {}} />;
      case 'favorites':
      case 'following':
        return useUnifiedFeed ? <UnifiedContentFeed /> : <PersonalizedFeed />;
      default:
        return null;
    }
  }, [pageNavigate, vicoins, icoins]);

  // Apply page theme when current page changes
  useEffect(() => {
    if (currentPage?.customColors) {
      const { primary, accent, glow } = currentPage.customColors;
      document.documentElement.style.setProperty('--page-primary', primary || '');
      document.documentElement.style.setProperty('--page-accent', accent || '');
      document.documentElement.style.setProperty('--page-glow', glow || '');
    } else {
      document.documentElement.style.removeProperty('--page-primary');
      document.documentElement.style.removeProperty('--page-accent');
      document.documentElement.style.removeProperty('--page-glow');
    }
  }, [currentPage]);

  // Determine current screen type for backward compatibility
  const currentScreenType = useMemo(() => {
    if (!currentPage) return 'main';
    if (currentState.direction === 'center') return 'main';
    if (currentPage.contentType === 'friends') return 'friends';
    if (currentPage.contentType === 'promotions') return 'promos';
    return currentPage.contentType;
  }, [currentPage, currentState.direction]);

  // Handle promo completion - use rewards service for secure backend validation
  const handleMediaComplete = useCallback(async (attentionValidated: boolean = true, attentionScore?: number) => {
    // Only give rewards if attention was validated for promo content and we have current media
    if (!currentMedia) return;
    
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

  // Navigate with swipe animation (vertical) - for main feed content
  const navigateToMedia = useCallback((direction: 'up' | 'down') => {
    if (isTransitioning || currentState.direction !== 'center' || feedContent.length === 0) return;
    
    setIsTransitioning(true);
    setSwipeDirection(direction);

    setTimeout(() => {
      if (direction === 'up') {
        setCurrentIndex(prev => (prev + 1) % feedContent.length);
      } else {
        setCurrentIndex(prev => (prev - 1 + feedContent.length) % feedContent.length);
      }
      setSwipeDirection(null);
      setIsTransitioning(false);
    }, 300);
  }, [isTransitioning, currentState.direction, feedContent.length]);

  // Skip to next media
  const handleSkip = useCallback(() => {
    navigateToMedia('up');
  }, [navigateToMedia]);

  const handleNavigate = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    // Set active direction to trigger the brief indicator display
    setActiveDirection(direction);
    
    // Use page navigation for horizontal, media navigation for vertical on center
    if (direction === 'up' || direction === 'down') {
      if (currentState.direction === 'center') {
        navigateToMedia(direction);
      } else {
        pageNavigate(direction);
      }
    } else {
      pageNavigate(direction);
    }
  }, [navigateToMedia, pageNavigate, currentState.direction]);

  // Swipe gesture handling
  const { handlers } = useSwipeNavigation({
    threshold: 80,
    onSwipeUp: () => handleNavigate('up'),
    onSwipeDown: () => handleNavigate('down'),
    onSwipeLeft: () => handleNavigate('left'),
    onSwipeRight: () => handleNavigate('right'),
  });

  const handleLike = useCallback(() => {
    toggleLike();
    if (!isLiked && navigator.vibrate) navigator.vibrate(10);
  }, [toggleLike, isLiked]);

  const handleSave = useCallback(() => {
    toggleSave();
  }, [toggleSave]);

  const handleTip = useCallback(async (coinType: 'vicoin' | 'icoin', amount: number) => {
    if (!profile) {
      toast.error('Please log in to tip');
      return;
    }
    
    if (!currentMedia) {
      toast.error('No content selected');
      return;
    }

    // Check balance before attempting tip
    const balance = coinType === 'vicoin' ? (profile.vicoin_balance ?? 0) : (profile.icoin_balance ?? 0);
    if (balance < amount) {
      toast.error(`Insufficient ${coinType === 'vicoin' ? 'Vicoin' : 'Icoin'} balance`, {
        description: `You have ${balance} ${coinType === 'vicoin' ? 'Vicoins' : 'Icoins'}, but need ${amount}`,
      });
      return;
    }

    // Use the real creator ID from the content
    const creatorId = currentMedia?.creator?.id;
    if (!creatorId || creatorId === 'system') {
      toast.error('Cannot tip this content');
      return;
    }
    
    try {
      const { data, error } = await supabase.functions.invoke('tip-creator', {
        body: {
          contentId: currentMedia.id,
          creatorId,
          amount,
          coinType,
        },
      });

      // Handle edge function errors - parse the error context for details
      if (error) {
        console.error('[Index] Tip error:', error);
        // Try to extract error details from the error context
        let errorMessage = 'Failed to send tip';
        try {
          const context = error.context;
          if (context && typeof context === 'object') {
            const body = await context.json?.();
            if (body?.error) {
              errorMessage = body.error;
              if (body.current_balance !== undefined) {
                errorMessage += ` (Balance: ${body.current_balance})`;
              }
            }
          }
        } catch {
          // Use default error message
        }
        toast.error(errorMessage);
        return;
      }

      if (data?.success) {
        toast.success(`Tipped ${amount} ${coinType === 'vicoin' ? 'Vicoins' : 'Icoins'}!`, {
          description: 'Thank you for supporting the creator',
        });
        
        // Refresh profile to update balance
        await refreshProfile();
        
        // Haptic feedback
        if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
      } else {
        // Handle non-success response in data
        const errorMsg = data?.error || 'Failed to send tip';
        toast.error(errorMsg);
      }
    } catch (err) {
      console.error('[Index] Tip failed:', err);
      toast.error('Failed to send tip');
    }
  }, [profile, currentMedia, refreshProfile]);

  const handleComment = () => {
    setShowComments(true);
  };

  const handleShare = () => {
    setShowShare(true);
  };

  const handleSettings = () => {
    setShowThemePresets(true);
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
      case 'discover':
        setShowMap(true);
        break;
      case 'create':
        setShowFeed(true); // Show personalized feed on create tab for now
        break;
      default:
        break;
    }
  };

  // Get configured pages for each direction
  const leftPages = getPagesByDirection('left');
  const rightPages = getPagesByDirection('right');
  const isAtCenter = currentState.direction === 'center';

  return (
    <ControlsVisibilityProvider>
      <DoubleTapGestureDetector onTripleTap={handleSettings}>
        <div 
          className="fixed inset-0 bg-background overflow-hidden"
          {...handlers}
        >

          {/* Dynamic Page Container with transitions */}
          <div className={safeTransitionClasses} style={safeTransitionStyles}>
          {/* Render based on current page content type */}
          {isAtCenter ? (
            // Main Media Feed (Center)
            <div className="absolute inset-0">
              {/* Show loading skeleton or empty state when no content */}
              {isLoading ? (
                <MediaCardSkeleton />
              ) : !currentMedia ? (
                <div className="absolute inset-0 flex items-center justify-center bg-background">
                  <div className="text-center p-8">
                    <p className="text-muted-foreground mb-4">No content available</p>
                    <Button onClick={handleRefresh} variant="secondary">
                      Refresh Feed
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className={cn(
                    'absolute inset-0 transition-transform duration-300 ease-out',
                    swipeDirection === 'up' && 'animate-swipe-exit-up',
                    swipeDirection === 'down' && 'animate-swipe-exit-down'
                  )}>
                    <MediaCard
                      key={currentMedia.id}
                      type={currentMedia.type}
                      src={currentMedia.src}
                      videoSrc={currentMedia.videoSrc}
                      duration={currentMedia.duration}
                      reward={currentMedia.reward}
                      contentId={currentMedia.id}
                      onComplete={handleMediaComplete}
                      onSkip={handleSkip}
                      isActive={!isTransitioning && isAtCenter}
                    />
                  </div>

                  {/* Cross Navigation hints */}
                  <CrossNavigation onNavigate={handleNavigate} activeDirection={activeDirection} />

                  {/* Feed toggle */}
                  <div className="absolute top-16 left-4 z-20 flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-full px-3 py-1.5 border border-border/50">
                    <Label htmlFor="unified-feed" className="text-xs font-medium cursor-pointer">
                      Unified Feed
                    </Label>
                    <Switch
                      id="unified-feed"
                      checked={useUnifiedFeed}
                      onCheckedChange={setUseUnifiedFeed}
                      className="scale-75"
                    />
                  </div>

                  {/* Floating Controls */}
                  <FloatingControls
                    onWalletClick={() => setShowWallet(true)}
                    onProfileClick={() => setShowProfile(true)}
                    onLikeClick={handleLike}
                    onTip={handleTip}
                    onCommentClick={handleComment}
                    onShareClick={handleShare}
                    onSettingsClick={handleSettings}
                    onAchievementsClick={() => setShowAchievementsPanel(true)}
                    isLiked={isLiked}
                    likeCount={1234}
                    commentCount={89}
                    showAchievements={isPromoContent && eyeTrackingEnabled}
                    achievementsCount={unlockedAchievements.size}
                    creatorInfo={currentMedia?.creator}
                    onViewCreatorProfile={() => {
                      if (currentMedia?.creator) {
                        toast.info(`Viewing ${currentMedia.creator.displayName}'s profile`);
                      }
                    }}
                  />

                  {/* Achievements panel */}
                  <AttentionAchievementsPanel
                    isVisible={showAchievementsPanel}
                    onClose={() => setShowAchievementsPanel(false)}
                    stats={achievementStats}
                    unlockedAchievements={unlockedAchievements}
                  />

                  {/* Achievement unlock notification */}
                  <AchievementUnlockNotification
                    achievement={newlyUnlocked}
                    onDismiss={dismissNotification}
                  />
                </>
              )}
            </div>
          ) : currentPage ? (
            // Dynamic page content based on configured layout
            <div className="absolute inset-0">
              {renderPageContent(currentPage.contentType, true)}
            </div>
          ) : null}
        </div>

        {/* Always-available sidebar visibility toggle (fail-open UI control) */}
        <QuickVisibilityToggle />

        {/* Screen Indicators - show configured pages */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2">
          {leftPages.length > 0 && (
            <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
          )}
          <div className={cn(
            "h-1 rounded-full transition-all duration-300",
            isAtCenter ? "w-6 bg-white" : "w-2 bg-white/40"
          )} />
          {rightPages.length > 0 && (
            <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
          )}
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

        {/* Onboarding Flow - TEMPORARILY DISABLED */}
        {/* <OnboardingFlow
          isOpen={showOnboarding}
          onClose={closeOnboarding}
          onComplete={completeOnboarding}
        /> */}

        {/* Theme Presets Bottom Sheet - TEMPORARILY DISABLED */}
        {/* <ThemePresetsSheet
          isOpen={showThemePresets}
          onClose={() => setShowThemePresets(false)}
        /> */}

        {/* Comments Panel - TEMPORARILY DISABLED */}
        {/* {currentMedia && (
          <CommentsPanel
            isOpen={showComments}
            onClose={() => setShowComments(false)}
            contentId={currentMedia.id}
          />
        )} */}

        {/* Share Sheet - TEMPORARILY DISABLED */}
        {/* {currentMedia && (
          <ShareSheet
            isOpen={showShare}
            onClose={() => setShowShare(false)}
            title={currentMedia.title || 'Check out this content!'}
            url={`${window.location.origin}/content/${currentMedia.id}`}
          />
        )} */}

        {/* Network Status Indicator */}
        <div className="fixed top-4 right-4 z-50">
          <NetworkStatusIndicator variant="badge" />
        </div>

        {/* Gesture Tutorial - TEMPORARILY DISABLED */}
        {/* {showTutorial && (
          <GestureTutorial
            onComplete={completeTutorial}
            onSkip={completeTutorial}
          />
        )} */}

        {/* Confetti Celebration */}
        <ConfettiCelebration
          isActive={showCelebration}
          type={celebrationType}
          onComplete={stopCelebration}
        />
        </div>
      </DoubleTapGestureDetector>
    </ControlsVisibilityProvider>
  );
};

export default Index;
