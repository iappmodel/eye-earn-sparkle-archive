import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { MediaCard } from '@/components/MediaCard';
import { FloatingControls, ControlsVisibilityProvider, DoubleTapGestureDetector, useControlsVisibility, AccessibleShowControlsButton } from '@/components/FloatingControls';
import { CoinSlideAnimation } from '@/components/CoinSlideAnimation';
import { WalletScreen, type WalletTourCommand } from '@/components/WalletScreen';
import { ProfileScreen } from '@/components/ProfileScreen';
import { DiscoveryMap } from '@/components/DiscoveryMap';
import { PersonalizedFeed } from '@/components/PersonalizedFeed';
import { FavoritesPage } from '@/components/FavoritesPage';
import { FavoritesVideosFeed } from '@/components/FavoritesVideosFeed';
import { UnifiedContentFeed } from '@/components/UnifiedContentFeed';
import { MessagesScreen } from '@/components/MessagesScreen';
import { CrossNavigation } from '@/components/CrossNavigation';
import { BottomNavigation } from '@/components/BottomNavigation';
import { CreatorToolsSheet } from '@/components/CreatorToolsSheet';
import { OnboardingFlow } from '@/components/onboarding';
import { FriendsPostsFeed } from '@/components/FriendsPostsFeed';
import { PromoVideosFeed } from '@/components/PromoVideosFeed';
import { ThemePresetsSheet } from '@/components/ThemePresetsSheet';
import { RouteBuilder } from '@/components/RouteBuilder';
import { GestureTutorial } from '@/components/GestureTutorial';
import { useGestureTutorial } from '@/contexts/GestureTutorialContext';
import { AttentionAchievementsPanel, AchievementUnlockNotification, useAttentionAchievements } from '@/components/AttentionAchievements';
import { useMediaSettings } from '@/components/MediaSettings';
import { ConfettiCelebration, useCelebration } from '@/components/ConfettiCelebration';
import { MediaCardSkeleton } from '@/components/ui/ContentSkeleton';
import { PullToRefresh } from '@/components/ui/PullToRefresh';
import { Button } from '@/components/ui/button';
import { CommentsPanel } from '@/components/CommentsPanel';
import { ShareSheet } from '@/components/ShareSheet';
import { NetworkStatusIndicator } from '@/components/NetworkStatusIndicator';
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation';
import { useOnboarding } from '@/hooks/useOnboarding';
import { usePageNavigation } from '@/hooks/usePageNavigation';
import { useUICustomization } from '@/contexts/UICustomizationContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLocalization } from '@/contexts/LocalizationContext';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { rewardsService } from '@/services/rewards.service';
import { sendTip, isValidTipTarget, isCreatorIdValidForTip, isSelfTip, TIP_AMOUNT_MIN, TIP_AMOUNT_MAX } from '@/services/tip.service';
import { getProfileByUserId } from '@/services/profile.service';
import { supabase } from '@/integrations/supabase/client';
import { usePromoRoute, defaultRouteFilters } from '@/hooks/usePromoRoute';
import { useNearbyPromotions } from '@/hooks/useNearbyPromotions';
import { useRouteBuilderFromFeed } from '@/hooks/useRouteBuilderFromFeed';
import { useSavedVideos } from '@/hooks/useSavedVideos';
import { useFeedInteraction } from '@/hooks/useFeedInteraction';
import { useMainFeed } from '@/hooks/useMainFeed';
import { useMessagesUnread } from '@/hooks/useMessagesUnread';
import { useNotifications } from '@/hooks/useNotifications';
import { useFollow } from '@/hooks/useFollow';
import { useVideoMute } from '@/contexts/VideoMuteContext';
import { SavedVideosGallery } from '@/components/SavedVideosGallery';
import { BookmarksScreen } from '@/components/BookmarksScreen';
import { PromoCheckInFlow } from '@/components/PromoCheckInFlow';
import { QuickCheckInSheet } from '@/components/QuickCheckInSheet';
import { NotificationCenter } from '@/components/NotificationCenter';
import { NotificationPreferences } from '@/components/NotificationPreferences';
import { ContentReportFlow } from '@/components/ContentReportFlow';
import { TipSheet } from '@/components/TipSheet';
import { HeroEntry } from '@/components/demo/HeroEntry';
import { DemoScenarioSelector, type DemoScenarioId } from '@/components/demo/DemoScenarioSelector';
import { DemoControlsSheet, type DemoControlsState } from '@/components/demo/DemoControlsSheet';
import { GuidedInvestorTour, type GuidedTourAction } from '@/components/demo/GuidedInvestorTour';
import { isDemoMode } from '@/lib/appMode';
import {
  DEMO_STATE_EVENT,
  DEMO_SCENARIO_SEEN_KEY,
  DEMO_CONTROLS_KEY,
  DEMO_BALANCES_KEY,
  defaultDemoBalances,
  pushDemoTransaction,
  setDemoTransactionStatus,
  type DemoBalances,
} from '@/lib/demoState';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Route as RouteIcon, Bookmark, Settings2 } from 'lucide-react';

// Auto-hide wrapper for the network status indicator
const NetworkStatusAutoHide: React.FC = () => {
  const { isVisible } = useControlsVisibility();
  return (
    <div className={cn(
      'fixed top-2 left-4 z-50 transition-all duration-500',
      isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
    )}>
      <NetworkStatusIndicator variant="badge" />
    </div>
  );
};

// Auto-hide wrapper for screen page indicators
const ScreenIndicatorsAutoHide: React.FC<{
  leftPages: unknown[];
  rightPages: unknown[];
  isAtCenter: boolean;
}> = ({ leftPages, rightPages, isAtCenter }) => {
  const { isVisible } = useControlsVisibility();
  return (
    <div className={cn(
      'absolute top-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 transition-all duration-500',
      isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4 pointer-events-none'
    )}>
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
  );
};

type FeedType = 'friends' | 'explore' | 'saved' | 'promotions';

const defaultDemoControls: DemoControlsState = {
  forceLandscapePlayback: false,
  rewardMode: 'auto',
  verificationDelayMs: 2000,
  checkoutOutcome: 'completed',
  simulateVisionInput: isDemoMode,
  simulateMapFallback: isDemoMode,
};

const getStoredDemoControls = (): DemoControlsState => {
  try {
    const raw = localStorage.getItem(DEMO_CONTROLS_KEY);
    if (!raw) return defaultDemoControls;
    const parsed = JSON.parse(raw) as Partial<DemoControlsState>;
    return {
      forceLandscapePlayback: parsed.forceLandscapePlayback ?? defaultDemoControls.forceLandscapePlayback,
      rewardMode: parsed.rewardMode ?? defaultDemoControls.rewardMode,
      verificationDelayMs: parsed.verificationDelayMs ?? defaultDemoControls.verificationDelayMs,
      checkoutOutcome: parsed.checkoutOutcome ?? defaultDemoControls.checkoutOutcome,
      simulateVisionInput: parsed.simulateVisionInput ?? defaultDemoControls.simulateVisionInput,
      simulateMapFallback: parsed.simulateMapFallback ?? defaultDemoControls.simulateMapFallback,
    };
  } catch {
    return defaultDemoControls;
  }
};

const getStoredDemoBalances = (): DemoBalances => {
  try {
    const raw = localStorage.getItem(DEMO_BALANCES_KEY);
    if (!raw) return defaultDemoBalances;
    const parsed = JSON.parse(raw) as Partial<DemoBalances>;
    return {
      vicoins: Number.isFinite(parsed.vicoins) ? Math.max(0, Number(parsed.vicoins)) : defaultDemoBalances.vicoins,
      icoins: Number.isFinite(parsed.icoins) ? Math.max(0, Number(parsed.icoins)) : defaultDemoBalances.icoins,
    };
  } catch {
    return defaultDemoBalances;
  }
};

const Index = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t, locale, setLocale } = useLocalization();
  const { user, profile, refreshProfile, refreshSubscription } = useAuth();
  const messagesUnreadCount = useMessagesUnread(user?.id);
  const { unreadCount: notificationsUnreadCount } = useNotifications();
  const subscriptionSuccessHandled = useRef(false);
  const {
    showOnboarding,
    closeOnboarding,
    completeOnboarding,
    openOnboarding,
    phase: onboardingPhase,
    completeProductTour,
    skipProductTour,
    progress: onboardingProgress,
    markStepComplete: markOnboardingStepComplete,
    progressPercentage: onboardingProgressPercentage,
  } = useOnboarding();
  const { pageLayout, getPagesByDirection, resetPageLayout } = useUICustomization();
  const { showTutorial, completeTutorial, skipTutorial } = useGestureTutorial();
  const { isActive: showCelebration, type: celebrationType, celebrate, stopCelebration } = useCelebration();
  const { light, medium } = useHapticFeedback();
  const { eyeTrackingEnabled } = useMediaSettings();
  const { isMuted, toggleMute } = useVideoMute();
  const { stats: achievementStats, unlockedAchievements, unlockedAt: achievementUnlockedAt, newlyUnlocked, dismissNotification } = useAttentionAchievements();
  const [isLoading, setIsLoading] = useState(true);
  const [showAchievementsPanel, setShowAchievementsPanel] = useState(false);
  
  // Page navigation from configured layout
  const {
    currentPage,
    currentState,
    transition,
    transitionState,
    canNavigate,
    navigate: pageNavigate,
    navigateToPage,
    getTransitionClasses,
    getTransitionStyles,
  } = usePageNavigation();
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showCoinSlide, setShowCoinSlide] = useState(false);
  const [coinSlideType, setCoinSlideType] = useState<'vicoin' | 'icoin'>('vicoin');
  const [coinSlideAmount, setCoinSlideAmount] = useState<number | null>(null);
  const [isClaimingReward, setIsClaimingReward] = useState(false);
  const [showWallet, setShowWallet] = useState(false);
  const [walletInitialTab, setWalletInitialTab] = useState<'overview' | 'transactions' | 'subscription' | 'payout' | 'checkout' | undefined>();
  const [showProfile, setShowProfile] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [showFeed, setShowFeed] = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [messagesOpenNewChat, setMessagesOpenNewChat] = useState(false);
  const [showThemePresets, setShowThemePresets] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [shareContext, setShareContext] = useState<{ contentId?: string; title: string; description?: string; mediaUrl?: string; mediaType?: 'image' | 'video' } | null>(null);
  const [swipeDirection, setSwipeDirection] = useState<'up' | 'down' | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [showRouteBuilderFromFeed, setShowRouteBuilderFromFeed] = useState(false);
  const [showSavedGallery, setShowSavedGallery] = useState(false);
  const [showCheckInFlow, setShowCheckInFlow] = useState(false);
  const [showQuickCheckIn, setShowQuickCheckIn] = useState(false);
  /** When true, map was opened for remote check-in flow (focus user + nearby for check-in). */
  const [mapOpenForCheckIn, setMapOpenForCheckIn] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showNotificationPrefs, setShowNotificationPrefs] = useState(false);
  const [showReportContent, setShowReportContent] = useState(false);
  const [showTipSheet, setShowTipSheet] = useState(false);
  const [tipSheetSource, setTipSheetSource] = useState<'button' | 'gesture' | 'remote'>('button');
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showCreatorTools, setShowCreatorTools] = useState(false);
  const demoModeEnabled = isDemoMode;
  const [showHeroEntry, setShowHeroEntry] = useState(() => isDemoMode);
  const [showScenarioSelector, setShowScenarioSelector] = useState(false);
  const [showDemoControls, setShowDemoControls] = useState(false);
  const [demoControls, setDemoControls] = useState<DemoControlsState>(() => getStoredDemoControls());
  const [demoBalances, setDemoBalances] = useState<DemoBalances>(() => getStoredDemoBalances());
  const [showGuidedTour, setShowGuidedTour] = useState(false);
  const [guidedScenarioId, setGuidedScenarioId] = useState<DemoScenarioId | null>(null);
  const [walletTourCommand, setWalletTourCommand] = useState<WalletTourCommand | null>(null);
  const walletCommandSeqRef = useRef(0);
  const [isLandscapeViewport, setIsLandscapeViewport] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(orientation: landscape)').matches;
  });

  // Route system - lifted to app level for sharing between feed and map
  const promoRoute = usePromoRoute();
  const routeBuilderFeed = useRouteBuilderFromFeed(showRouteBuilderFromFeed);
  const [routeSuggestLoading, setRouteSuggestLoading] = useState(false);
  const savedVideos = useSavedVideos();
  const contentLikes = useFeedInteraction();
  const mainFeed = useMainFeed();

  useEffect(() => {
    try {
      localStorage.setItem(DEMO_CONTROLS_KEY, JSON.stringify(demoControls));
    } catch {
      // ignore persistence errors in private mode
    }
  }, [demoControls]);

  useEffect(() => {
    try {
      localStorage.setItem(DEMO_BALANCES_KEY, JSON.stringify(demoBalances));
    } catch {
      // ignore persistence errors in private mode
    }
  }, [demoBalances]);

  useEffect(() => {
    if (!demoModeEnabled || typeof window === 'undefined') return;
    const syncBalances = () => {
      setDemoBalances(getStoredDemoBalances());
    };
    window.addEventListener(DEMO_STATE_EVENT, syncBalances as EventListener);
    window.addEventListener('storage', syncBalances);
    return () => {
      window.removeEventListener(DEMO_STATE_EVENT, syncBalances as EventListener);
      window.removeEventListener('storage', syncBalances);
    };
  }, [demoModeEnabled]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateOrientation = () => {
      setIsLandscapeViewport(window.matchMedia('(orientation: landscape)').matches);
    };
    updateOrientation();
    window.addEventListener('resize', updateOrientation);
    window.addEventListener('orientationchange', updateOrientation);
    return () => {
      window.removeEventListener('resize', updateOrientation);
      window.removeEventListener('orientationchange', updateOrientation);
    };
  }, []);

  // Nearby promotions with route suggestion detection
  const { routeSuggestion, dismissRouteSuggestion } = useNearbyPromotions(true);
  
  // Show route suggestion toast when cluster detected
  const { suggestRoute } = promoRoute;
  useEffect(() => {
    if (routeSuggestion && routeSuggestion.promotions.length >= 3) {
      toast(`🗺️ You're near ${routeSuggestion.promotions.length} earning spots!`, {
        description: 'Tap to build a route and maximize your earnings',
        action: {
          label: 'Build Route',
          onClick: () => {
            // Auto-suggest a route from nearby promos
            const promos = routeSuggestion.promotions.map(p => ({
              id: p.id,
              business_name: p.business_name,
              latitude: p.latitude,
              longitude: p.longitude,
              category: p.category || undefined,
              reward_type: p.reward_type as 'vicoin' | 'icoin' | 'both',
              reward_amount: p.reward_amount,
            }));
            suggestRoute(
              promos,
              routeSuggestion.center.lat,
              routeSuggestion.center.lng,
              defaultRouteFilters,
            );
            setShowRouteBuilderFromFeed(true);
          },
        },
        duration: 10000,
      });
      dismissRouteSuggestion();
    }
  }, [routeSuggestion, dismissRouteSuggestion, suggestRoute]);
  
  // Active direction for CrossNavigation indicator
  const [activeDirection, setActiveDirection] = useState<'up' | 'down' | 'left' | 'right' | null>(null);

  const vicoins = demoModeEnabled ? demoBalances.vicoins : (profile?.vicoin_balance ?? 0);
  const icoins = demoModeEnabled ? demoBalances.icoins : (profile?.icoin_balance ?? 0);
  
  // Check if current media is promo content
  const feedItems = mainFeed.items;
  const safeIndex = Math.min(currentIndex, Math.max(0, feedItems.length - 1));
  const currentMedia = useMemo(() => feedItems[safeIndex] ?? null, [feedItems, safeIndex]);
  const isPromoContent = currentMedia?.type === 'promo' && !!currentMedia?.reward;
  const follow = useFollow({
    creatorId: currentMedia?.creator?.id ?? null,
    skipFetch: currentMedia?.isShellCreator === true, // shell mode: no DB lookup for fallback creators
  });

  const focusFirstPromo = useCallback(() => {
    const promoIndex = feedItems.findIndex((item) => item.type === 'promo' && item.reward);
    if (promoIndex >= 0) {
      setCurrentIndex(promoIndex);
      return true;
    }
    return false;
  }, [feedItems]);

  const handleStartScenario = useCallback((scenarioId: DemoScenarioId) => {
    const scenarioSeed: Record<DemoScenarioId, DemoBalances> = {
      'us-earner': { vicoins: 4200, icoins: 76 },
      'brazil-shopper': { vicoins: 3600, icoins: 64 },
      'wallet-explorer': { vicoins: 8200, icoins: 145 },
    };
    setDemoBalances(scenarioSeed[scenarioId]);
    setShowScenarioSelector(false);
    setShowDemoControls(false);
    closeOnboarding();
    setActiveTab('home');
    try {
      localStorage.setItem(DEMO_SCENARIO_SEEN_KEY, 'true');
    } catch {
      // ignore
    }

    if (scenarioId === 'us-earner') {
      setLocale('en');
      focusFirstPromo();
      setGuidedScenarioId(scenarioId);
      setShowGuidedTour(true);
      toast.info('US Earner loaded', {
        description: 'Watch a promo, then open Wallet to convert and withdraw.',
      });
      return;
    }

    if (scenarioId === 'brazil-shopper') {
      setLocale('pt');
      focusFirstPromo();
      setGuidedScenarioId(scenarioId);
      setShowGuidedTour(true);
      toast.info('Brazil Shopper loaded', {
        description: 'Watch a promo, then open Wallet and use Pay (Pix path).',
      });
      return;
    }

    setLocale('en');
    setShowWallet(true);
    setWalletInitialTab('overview');
    setGuidedScenarioId(scenarioId);
    setShowGuidedTour(true);
    toast.info('Wallet Explorer loaded', {
      description: 'Review pending/completed states and run checkout demos.',
    });
  }, [closeOnboarding, focusFirstPromo, setLocale]);

  const issueWalletTourCommand = useCallback(
    (action: WalletTourCommand['action'], scenarioId?: string) => {
      walletCommandSeqRef.current += 1;
      setWalletTourCommand({
        id: `wallet-tour-${walletCommandSeqRef.current}`,
        action,
        scenarioId,
      });
    },
    []
  );

  const applyDemoBalanceDelta = useCallback((coinType: 'vicoin' | 'icoin', delta: number) => {
    setDemoBalances((prev) => {
      const nextValue = Math.max(
        0,
        Math.round((((coinType === 'vicoin' ? prev.vicoins : prev.icoins) + delta) * 100)) / 100
      );
      if (coinType === 'vicoin') {
        return { ...prev, vicoins: nextValue };
      }
      return { ...prev, icoins: nextValue };
    });
  }, []);

  const queueDemoReward = useCallback(
    (params: { rewardType: 'vicoin' | 'icoin'; rewardAmount: number; campaignName?: string; referenceId?: string | null }) => {
      const { rewardType, rewardAmount, campaignName, referenceId } = params;
      setCoinSlideType(rewardType);
      setCoinSlideAmount(rewardAmount);
      setShowCoinSlide(true);

      const tx = pushDemoTransaction({
        type: 'earned',
        amount: rewardAmount,
        coinType: rewardType,
        description: campaignName ? `Promo Reward · ${campaignName}` : 'Promo Reward',
        status: 'verification_required',
        statusReason: 'verification',
        statusDetail: 'Reward pending verification checks.',
        nextStep: 'This reward will settle automatically.',
        etaLabel: '2-5 sec',
        referenceId: referenceId ?? null,
      });

      toast.success('Reward added as pending', {
        description: campaignName
          ? `${campaignName} is now awaiting verification.`
          : 'Verification in progress.',
      });

      const delayMs = demoControls.verificationDelayMs >= 2000
        ? Math.min(5000, demoControls.verificationDelayMs)
        : 2000 + Math.floor(Math.random() * 3000);

      window.setTimeout(() => {
        const settled = setDemoTransactionStatus(tx.id, 'completed', {
          statusDetail: 'Verification completed.',
          nextStep: undefined,
          etaLabel: 'Completed',
        });
        if (!settled) return;
        applyDemoBalanceDelta(rewardType, rewardAmount);
        toast.success('Reward completed', {
          description: `+${rewardAmount} ${rewardType === 'vicoin' ? 'Vicoins' : 'Icoins'} available in wallet.`,
        });
      }, delayMs);
    },
    [applyDemoBalanceDelta, demoControls.verificationDelayMs]
  );

  const simulateDemoReward = useCallback(() => {
    const rewardType = currentMedia?.reward?.type ?? 'icoin';
    const rewardAmount = currentMedia?.reward?.amount ?? 1;
    queueDemoReward({
      rewardType,
      rewardAmount,
      campaignName: currentMedia?.title ?? 'Promo Campaign',
      referenceId: currentMedia?.id ?? null,
    });
  }, [currentMedia?.id, currentMedia?.reward?.amount, currentMedia?.reward?.type, currentMedia?.title, queueDemoReward]);

  const handleGuidedTourAction = useCallback(
    (action: GuidedTourAction) => {
      if (action.type === 'simulate_reward') {
        simulateDemoReward();
        return;
      }
      if (action.type === 'open_wallet_overview') {
        setShowWallet(true);
        setWalletInitialTab('overview');
        issueWalletTourCommand('open_overview');
        return;
      }
      if (action.type === 'open_wallet_payout') {
        setShowWallet(true);
        setWalletInitialTab('payout');
        issueWalletTourCommand('open_payout');
        return;
      }
      if (action.type === 'open_wallet_checkout') {
        setShowWallet(true);
        setWalletInitialTab('overview');
        issueWalletTourCommand('open_checkout', action.scenarioId);
      }
    },
    [issueWalletTourCommand, simulateDemoReward]
  );

  const handleResetLayout = useCallback(() => {
    if (typeof window === 'undefined') return;
    const keysToReset = Object.keys(window.localStorage).filter((key) => key.startsWith('visuai-'));
    for (const key of keysToReset) {
      window.localStorage.removeItem(key);
    }
    window.dispatchEvent(new Event('storage'));
    toast.success('Control layout reset', {
      description: 'Floating controls were restored to defaults.',
    });
  }, []);

  // Clamp index when feed length changes
  useEffect(() => {
    if (feedItems.length > 0 && currentIndex >= feedItems.length) {
      setCurrentIndex(Math.max(0, feedItems.length - 1));
    }
  }, [feedItems.length, currentIndex]);

  // Initial load: wait for feed or timeout
  useEffect(() => {
    if (!mainFeed.isLoading) {
      const timer = setTimeout(() => setIsLoading(false), 300);
      return () => clearTimeout(timer);
    }
  }, [mainFeed.isLoading]);

  // Handle shared route link (?route=base64EncodedJson) — import and clear URL
  useEffect(() => {
    const encoded = searchParams.get('route');
    if (!encoded) return;
    try {
      const json = decodeURIComponent(escape(atob(encoded)));
      const parsed = JSON.parse(json) as import('@/hooks/usePromoRoute').PromoRoute;
      if (parsed?.name && Array.isArray(parsed.stops)) {
        promoRoute.addSavedRoute(parsed);
        toast.success('Route imported from link');
        setShowRouteBuilderFromFeed(true);
      }
    } catch {
      toast.error('Invalid route link');
    }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('route');
      return next;
    }, { replace: true });
  }, [searchParams, setSearchParams, promoRoute]);

  // Redirect legacy share links (?content=id) to path /content/:id
  useEffect(() => {
    const contentId = searchParams.get('content');
    if (!contentId?.trim()) return;
    navigate(`/content/${encodeURIComponent(contentId.trim())}`, { replace: true });
  }, [searchParams, navigate]);

  // Handle return from Stripe checkout (?subscription=success | subscription=canceled)
  useEffect(() => {
    const sub = searchParams.get('subscription');
    if (!sub || !user) return;
    if (sub === 'canceled') {
      toast.info('Checkout was canceled. You can subscribe anytime from Wallet → Plans.');
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('subscription');
        next.delete('tab');
        return next;
      }, { replace: true });
      return;
    }
    if (sub !== 'success' || subscriptionSuccessHandled.current) return;
    subscriptionSuccessHandled.current = true;
    refreshSubscription().then(() => {
      toast.success(t('premium.welcomePremium'), {
        description: t('premium.welcomePremiumDescription'),
      });
      const tab = searchParams.get('tab');
      if (tab === 'subscription') {
        setWalletInitialTab('subscription');
        setShowWallet(true);
      }
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('subscription');
        next.delete('tab');
        return next;
      }, { replace: true });
    });
  }, [searchParams, user, refreshSubscription, setSearchParams, t]);

  // Surface main feed load/refresh errors
  useEffect(() => {
    if (mainFeed.error) {
      toast.error('Could not load feed', { description: mainFeed.error });
    }
  }, [mainFeed.error]);

  // Pull to refresh handler
  const handleRefresh = useCallback(async () => {
    const [_, feedResult] = await Promise.all([refreshProfile(), mainFeed.refresh()]);
    if (feedResult && 'error' in feedResult && feedResult.error) {
      toast.error('Could not refresh feed', { description: feedResult.error });
    } else {
      toast.success('Feed refreshed!');
    }
  }, [refreshProfile, mainFeed.refresh]);


  // Map content type to component rendering
  const renderPageContent = useCallback((contentType: string, isActive: boolean) => {
    switch (contentType) {
      case 'friends':
        return (
          <FriendsPostsFeed
            isActive={isActive}
            onSwipeRight={() => pageNavigate('right')}
            onSwipeLeft={() => pageNavigate('left')}
            onFindPeople={() => {
              const discoveryPage = getPagesByDirection('up').find((p) => p.contentType === 'discovery')
                ?? getPagesByDirection('right').find((p) => p.contentType === 'discovery');
              if (discoveryPage) navigateToPage(discoveryPage.id);
              else pageNavigate('up');
            }}
          />
        );
      case 'promotions':
        return (
          <PromoVideosFeed 
            isActive={isActive} 
            onSwipeLeft={() => pageNavigate('left')}
            onSwipeRight={() => pageNavigate('right')}
            onRewardEarned={(amount, type) => {
              setCoinSlideType(type);
              setShowCoinSlide(true);
            }}
          />
        );
      case 'discovery':
        return <DiscoveryMap isOpen={true} onClose={() => pageNavigate('down')} promoRoute={promoRoute} onOpenWallet={() => setShowWallet(true)} />;
      case 'rewards':
      case 'wallet':
        return <WalletScreen isOpen={true} onClose={() => pageNavigate('up')} vicoins={vicoins} icoins={icoins} />;
      case 'messages':
        return <MessagesScreen isOpen={true} onClose={() => {}} />;
      case 'explore':
        return <FavoritesVideosFeed isActive={isActive} />;
      case 'favorites':
        return (
          <FavoritesPage
            isActive={isActive}
            onOpenMap={() => {
              const discoveryPage = getPagesByDirection('up').find((p) => p.contentType === 'discovery')
                ?? getPagesByDirection('right').find((p) => p.contentType === 'discovery');
              if (discoveryPage) navigateToPage(discoveryPage.id);
              else pageNavigate('up');
            }}
          />
        );
      case 'following':
        return <PersonalizedFeed />;
      default:
        return null;
    }
  }, [pageNavigate, navigateToPage, getPagesByDirection, vicoins, icoins]);

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
    if (!currentPage) return 'saved';
    if (currentPage.contentType === 'friends') return 'friends';
    if (currentPage.contentType === 'explore') return 'explore';
    if (currentPage.contentType === 'saved' || currentPage.contentType === 'main') return 'saved';
    if (currentPage.contentType === 'promotions') return 'promos';
    return currentPage.contentType;
  }, [currentPage]);

  // Content types that use the main feed (saved/main or fallback for unknown)
  const MAIN_FEED_TYPES = useMemo(() => new Set(['friends', 'promotions', 'discovery', 'rewards', 'wallet', 'messages', 'explore', 'favorites', 'following']), []);
  const isMainFeedPage = currentPage?.contentType === 'saved' || currentPage?.contentType === 'main' || (currentPage && !MAIN_FEED_TYPES.has(currentPage.contentType));

  // Advance to next video in Saved feed (infinite loop)
  const advanceSavedVideo = useCallback(() => {
    if (!isMainFeedPage) return;
    const len = Math.max(1, feedItems.length);
    setCurrentIndex(prev => (prev + 1) % len);
  }, [isMainFeedPage, feedItems.length]);

  // Handle promo completion - use rewards service for secure backend validation
  const handleMediaComplete = useCallback(async (
    attentionValidated: boolean = true,
    _attentionScore?: number,
    _watchDuration?: number,
    attentionSessionId?: string
  ) => {
    if (!currentMedia?.reward) {
      advanceSavedVideo();
      return;
    }

    const effectiveAttentionValidated =
      demoControls.rewardMode === 'always_pass'
        ? true
        : demoControls.rewardMode === 'always_fail'
          ? false
          : attentionValidated;

    if (!effectiveAttentionValidated) {
      toast.info('No reward earned. Full watch required for this campaign.');
      return;
    }

    const shouldUseSimulatedReward = demoModeEnabled || !profile || !attentionSessionId;
    if (shouldUseSimulatedReward) {
      setIsClaimingReward(true);
      const rewardType = currentMedia.reward.type;
      const rewardAmount = currentMedia.reward.amount;
      queueDemoReward({
        rewardType,
        rewardAmount,
        campaignName: currentMedia.title ?? 'Promo Campaign',
        referenceId: currentMedia.id,
      });
      if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
      setIsClaimingReward(false);
      advanceSavedVideo();
      return;
    }

    setIsClaimingReward(true);
    try {
      const result = await rewardsService.issueReward('promo_view', currentMedia.id, {
        attentionSessionId,
      });

      if (result.success && result.amount) {
        setCoinSlideType(result.coinType || currentMedia.reward.type);
        setCoinSlideAmount(result.amount);
        setShowCoinSlide(true);

        await refreshProfile();
        const coinLabel = result.coinType === 'vicoin' ? 'Vicoins' : 'Icoins';
        toast.success(`+${result.amount} ${coinLabel}!`, {
          description: result.dailyRemaining?.promo_views != null && result.dailyRemaining.promo_views < 5
            ? `${result.dailyRemaining.promo_views} rewards left today`
            : undefined,
        });

        if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
      } else if (result.error) {
        if (result.error.includes('already claimed') || result.error.includes('Reward already')) {
          console.log('[Index] Content already rewarded');
        } else if (result.error.includes('limit') || result.error.includes('Daily')) {
          toast.info('Daily limit reached', {
            description: 'Come back tomorrow for more rewards!',
          });
        } else if (result.error.includes('Watch more')) {
          toast.warning('Keep watching', {
            description: result.error,
          });
        } else if (result.code === 'invalid_session' || result.error?.includes('session')) {
          toast.error('Session expired', { description: 'Please watch the video again to claim.' });
        } else {
          console.error('[Index] Reward error:', result.error);
          toast.error('Could not claim reward', { description: result.error });
        }
      }
    } finally {
      setIsClaimingReward(false);
      advanceSavedVideo();
    }
  }, [currentMedia, demoControls.rewardMode, demoModeEnabled, profile, queueDemoReward, refreshProfile, advanceSavedVideo]);

  const handleRewardEarned = useCallback((amount: number, type: 'vicoin' | 'icoin') => {
    setCoinSlideType(type);
    setCoinSlideAmount(amount);
    setShowCoinSlide(true);
    if (demoModeEnabled) {
      setDemoBalances((prev) => ({
        ...prev,
        [type === 'vicoin' ? 'vicoins' : 'icoins']:
          prev[type === 'vicoin' ? 'vicoins' : 'icoins'] + amount,
      }));
    }
  }, [demoModeEnabled]);

  const handleCoinSlideComplete = useCallback(() => {
    setShowCoinSlide(false);
    setCoinSlideAmount(null);
  }, []);

  // Advance to next/prev video within Saved feed (infinite loop)
  const navigateToMedia = useCallback((direction: 'up' | 'down') => {
    if (isTransitioning || !isMainFeedPage) return;
    
    setIsTransitioning(true);
    setSwipeDirection(direction);

    setTimeout(() => {
      const len = Math.max(1, feedItems.length);
      if (direction === 'up') {
        setCurrentIndex(prev => (prev + 1) % len);
      } else {
        setCurrentIndex(prev => (prev - 1 + len) % len);
      }
      setSwipeDirection(null);
      setIsTransitioning(false);
    }, 300);
  }, [isTransitioning, isMainFeedPage, feedItems.length]);

  // Skip to next media
  const handleSkip = useCallback(() => {
    navigateToMedia('up');
  }, [navigateToMedia]);

  const isSavedSwipePage = currentPage?.contentType === 'saved' || currentPage?.contentType === 'main';

  const handleNavigate = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    setActiveDirection(direction);
    if (direction === 'up' || direction === 'down') {
      // Vertical gestures scroll videos; category switching is horizontal.
      // Saved feed is controlled here, while other feeds handle their own up/down.
      if (isSavedSwipePage) {
        navigateToMedia(direction);
      }
      return;
    }
    pageNavigate(direction);
  }, [isSavedSwipePage, navigateToMedia, pageNavigate]);

  // Listen for gazeNavigate events from the remote control system
  useEffect(() => {
    const handleGazeNavigate = (e: Event) => {
      const { action } = (e as CustomEvent).detail;
      switch (action) {
        case 'nextVideo': navigateToMedia('up'); break;
        case 'prevVideo': navigateToMedia('down'); break;
        case 'friendsFeed': pageNavigate('left'); break;
        case 'promoFeed': pageNavigate('right'); break;
      }
    };
    window.addEventListener('gazeNavigate', handleGazeNavigate);
    return () => window.removeEventListener('gazeNavigate', handleGazeNavigate);
  }, [navigateToMedia, pageNavigate]);

  // Swipe gesture handling
  const { handlers } = useSwipeNavigation({
    threshold: 80,
    onSwipeUp: () => handleNavigate('up'),
    onSwipeDown: () => handleNavigate('down'),
    onSwipeLeft: () => handleNavigate('left'),
    onSwipeRight: () => handleNavigate('right'),
  });

  // Main feed Like: persisted via content_likes (useFeedInteraction) + track-interaction for personalization
  const handleLike = useCallback(async () => {
    const contentId = currentMedia?.id;
    if (!contentId) return;
    const result = await contentLikes.handleLike(contentId, currentMedia?.type === 'image' ? { contentType: 'image' } : undefined);
    if (navigator.vibrate) navigator.vibrate(10);
    if (!result.success) {
      toast.error('Could not update like', { description: 'Please try again or check your connection.' });
      return;
    }
    if (result.liked) {
      toast.success('Liked!', { description: 'Synced across your feeds and devices' });
    } else {
      toast('Unliked', { description: 'Removed from favorites' });
    }
  }, [currentMedia?.id, currentMedia?.type, contentLikes]);

  const handleTip = useCallback(async (coinType: 'vicoin' | 'icoin', amount: number): Promise<boolean> => {
    if (!user) {
      toast.error('Please log in to tip');
      return false;
    }
    if (!profile) {
      toast.error('Please wait', { description: 'Your profile is loading. Try again in a moment.' });
      return false;
    }
    if (!currentMedia?.id) {
      toast.error('Cannot tip: no content selected');
      return false;
    }

    const creatorId = currentMedia.creator?.id;
    if (!creatorId) {
      toast.error('Tipping not available', { description: 'This content has no creator to tip.' });
      return false;
    }
    if (!isCreatorIdValidForTip(creatorId)) {
      toast.info('Tipping not available', {
        description: 'This creator cannot receive tips yet.',
      });
      return false;
    }
    if (!isValidTipTarget(currentMedia.id, creatorId)) {
      toast.info('Tipping not available', {
        description: 'This content cannot receive tips yet.',
      });
      return false;
    }

    // Self-tip: feed creator.id is creator's auth user_id; compare to current user.id (not profile.id)
    if (isSelfTip(user.id, creatorId)) {
      toast.info("You can't tip yourself", { description: 'Try tipping other creators!' });
      return false;
    }

    const clampedAmount = Math.min(TIP_AMOUNT_MAX, Math.max(TIP_AMOUNT_MIN, Math.floor(amount)));
    const balance = coinType === 'vicoin' ? (profile.vicoin_balance ?? 0) : (profile.icoin_balance ?? 0);
    if (balance < clampedAmount) {
      toast.error(`Insufficient ${coinType === 'vicoin' ? 'Vicoin' : 'Icoin'} balance`, {
        description: `You have ${balance} ${coinType === 'vicoin' ? 'Vicoins' : 'Icoins'}, but need ${clampedAmount}`,
      });
      return false;
    }

    const result = await sendTip({
      contentId: currentMedia.id,
      creatorId,
      amount: clampedAmount,
      coinType,
    });

    if (result.success) {
      toast.success(`Tipped ${clampedAmount} ${coinType === 'vicoin' ? 'Vicoins' : 'Icoins'}!`, {
        description: 'Thank you for supporting the creator',
      });
      await refreshProfile();
      if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
      celebrate('achievement');
      return true;
    }
    toast.error(result.error || 'Failed to send tip');
    return false;
  }, [user, profile, currentMedia, refreshProfile, celebrate]);

  const handleComment = () => {
    setShowComments(true);
  };

  // Share uses real content location when available (promo address/coords); never random coords
  const handleShare = useCallback(() => {
    if (currentMedia?.id) {
      const isImage = currentMedia.type === 'image';
      const mediaUrl = isImage ? currentMedia.src : (currentMedia.videoSrc ?? currentMedia.src);
      const loc = currentMedia.promoLocation;
      const hasCoords = loc && loc.latitude != null && loc.longitude != null;
      const locationLine = loc?.address
        ? ` at ${loc.address}`
        : hasCoords
          ? ` at ${Number(loc.latitude).toFixed(4)}, ${Number(loc.longitude).toFixed(4)}`
          : '';
      const description =
        locationLine &&
        (currentMedia.title
          ? `${currentMedia.title}${locationLine}`
          : loc?.businessName
            ? `${loc.businessName}${locationLine}`
            : `Check out this promo${locationLine}`);
      setShareContext({
        contentId: currentMedia.id,
        title: currentMedia.title || loc?.businessName || 'Check out this content!',
        description: description || undefined,
        mediaUrl: mediaUrl || undefined,
        mediaType: isImage ? 'image' : 'video',
      });
    } else {
      setShareContext(null);
    }
    setShowShare(true);
  }, [
    currentMedia?.id,
    currentMedia?.title,
    currentMedia?.type,
    currentMedia?.src,
    currentMedia?.videoSrc,
    currentMedia?.promoLocation,
  ]);

  const handleShareSuccess = useCallback((payload: { title: string; text?: string; url?: string }) => {
    setShareContext({ title: payload.title, description: payload.text });
    setShowShare(true);
  }, []);

  const handleSettings = () => {
    setShowThemePresets(true);
  };

  // Handle saving video for watch later
  const handleSaveVideo = useCallback(() => {
    if (!currentMedia) return;
    const wasSaved = savedVideos.toggleSave({
      id: `saved-${currentMedia.id}`,
      contentId: currentMedia.id,
      title: currentMedia.title || 'Untitled',
      thumbnail: currentMedia.src,
      type: currentMedia.type as 'promo' | 'video' | 'image',
      videoSrc: currentMedia.videoSrc,
      src: currentMedia.src,
      creator: currentMedia.creator,
      reward: currentMedia.reward,
      duration: currentMedia.duration,
      requiresPhysicalAction: currentMedia.type === 'promo',
      promoLocation: currentMedia.promoLocation ? {
        promotionId: currentMedia.promoLocation.promotionId,
        businessName: currentMedia.promoLocation.businessName,
        latitude: currentMedia.promoLocation.latitude,
        longitude: currentMedia.promoLocation.longitude,
        address: currentMedia.promoLocation.address,
        category: currentMedia.promoLocation.category,
        rewardType: currentMedia.promoLocation.rewardType,
        rewardAmount: currentMedia.promoLocation.rewardAmount,
        requiredAction: currentMedia.promoLocation.requiredAction,
      } : undefined,
    });
    toast.success(wasSaved ? 'Saved for later' : 'Removed from saved');
  }, [currentMedia, savedVideos]);

  // Only open Tip Sheet for tippable (UUID) creators; hide tip entry for mock/fallback creators
  const currentCreatorTippable = !!(
    currentMedia?.creator?.id && isCreatorIdValidForTip(currentMedia.creator.id)
  );

  // Open Tip Sheet when openTipPanel is dispatched (e.g. from MorphingLikeButton long-press or other triggers)
  useEffect(() => {
    const handler = () => {
      if (!currentCreatorTippable) return;
      setTipSheetSource('button');
      setShowTipSheet(true);
    };
    window.addEventListener('openTipPanel', handler);
    return () => window.removeEventListener('openTipPanel', handler);
  }, [currentCreatorTippable]);

  // Prime like counts from feed (user_content.likes_count synced by triggers) + fetch live counts for promos
  useEffect(() => {
    const withLikes = feedItems.filter((i) => i.likes != null && i.likes > 0);
    if (withLikes.length > 0) {
      const prime: Record<string, number> = {};
      for (const i of withLikes) prime[i.id] = i.likes!;
      contentLikes.setLikeCountsFromFeed(prime);
    }
    const windowSize = 5;
    const start = Math.max(0, safeIndex - 2);
    const end = Math.min(feedItems.length, start + windowSize);
    const ids = feedItems.slice(start, end).map((i) => i.id);
    if (ids.length > 0) contentLikes.fetchLikeCounts(ids);
  }, [feedItems, safeIndex, contentLikes.fetchLikeCounts, contentLikes.setLikeCountsFromFeed]);

  const handleSaveLongPress = useCallback(() => {
    setShowSavedGallery(true);
  }, []);

  // Follow creator – persisted when creator.id is UUID (backend); shell mode only for fallback/mock (isShellCreator)
  const handleFollow = useCallback(() => {
    const creatorId = currentMedia?.creator?.id;
    if (!creatorId) return;
    follow.toggleFollow(creatorId);
  }, [currentMedia?.creator?.id, follow]);

  // Check-in from remote control or UI: open map + check-in flow for full experience
  const handleCheckIn = useCallback((fromRemoteControl?: boolean) => {
    light();
    if (currentMedia?.type === 'promo' && currentMedia?.reward && currentMedia?.creator) {
      setShowCheckInFlow(true);
      if (fromRemoteControl) {
        toast.info('Check-in opened', { description: 'Complete the promo check-in steps to earn rewards.' });
      }
    } else {
      // Non-promo: open map (so user sees nearby spots) and Quick Check-In sheet for real check-in
      if (fromRemoteControl) {
        setMapOpenForCheckIn(true);
        setShowMap(true);
        setShowQuickCheckIn(true);
        toast.info('Check-in opened', { description: 'Map and check-in sheet opened. Tap "Check In Here" to verify your location.' });
      } else {
        setShowQuickCheckIn(true);
      }
    }
  }, [currentMedia, light]);

  // Handle adding a saved video to route from the gallery – use real user/content location
  const handleAddSavedToRoute = useCallback(async (video: import('@/hooks/useSavedVideos').SavedVideo) => {
    if (!promoRoute.isBuilding) {
      promoRoute.startRoute('Saved Route');
    }
    if (promoRoute.isInRoute(video.contentId)) {
      toast.info('Already in your route');
      return;
    }
    let latitude: number;
    let longitude: number;
    let businessName: string;
    let category: string;
    let rewardType: 'vicoin' | 'icoin' | 'both';
    let rewardAmount: number;
    let requiredAction: string | undefined;
    let address: string | undefined;

    if (video.promoLocation) {
      ({ latitude, longitude, businessName, address, category, rewardType, rewardAmount, requiredAction } = {
        ...video.promoLocation,
        category: video.promoLocation.category ?? 'Promotion',
        rewardType: video.promoLocation.rewardType,
        rewardAmount: video.promoLocation.rewardAmount,
      });
    } else {
      // Fetch promotion from DB by contentId (promos use promotion id as contentId)
      try {
        const { data: promo } = await supabase
          .from('promotions')
          .select('latitude, longitude, business_name, category, reward_type, reward_amount, required_action, address')
          .eq('id', video.contentId)
          .maybeSingle();
        if (promo?.latitude != null && promo?.longitude != null) {
          latitude = promo.latitude;
          longitude = promo.longitude;
          businessName = promo.business_name || video.creator?.displayName || video.title || 'Promo';
          category = promo.category ?? 'Promotion';
          rewardType = (promo.reward_type === 'both' ? 'both' : promo.reward_type === 'icoin' ? 'icoin' : 'vicoin') as 'vicoin' | 'icoin' | 'both';
          rewardAmount = promo.reward_amount ?? video.reward?.amount ?? 0;
          requiredAction = promo.required_action ?? undefined;
          address = promo.address ?? undefined;
        } else {
          throw new Error('No location');
        }
      } catch {
        // Fallback: use user's real location or fixed default (no random coordinates)
        const coords = await new Promise<{ lat: number; lng: number }>((resolve) => {
          if (!navigator.geolocation) {
            resolve({ lat: 40.7128, lng: -74.006 });
            return;
          }
          navigator.geolocation.getCurrentPosition(
            (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => resolve({ lat: 40.7128, lng: -74.006 }),
            { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
          );
        });
        latitude = coords.lat;
        longitude = coords.lng;
        businessName = video.creator?.displayName || video.title || 'Promo';
        category = 'Promotion';
        rewardType = (video.reward?.type as 'vicoin' | 'icoin' | 'both') || 'vicoin';
        rewardAmount = video.reward?.amount ?? 0;
        requiredAction = undefined;
        address = undefined;
      }
    }

    promoRoute.addStop({
      id: `stop-${video.contentId}`,
      promotionId: video.promoLocation?.promotionId ?? video.contentId,
      businessName,
      latitude,
      longitude,
      address,
      category,
      rewardType,
      rewardAmount,
      requiredAction,
      fromFeed: true,
      contentId: video.contentId,
    });
    savedVideos.markAddedToRoute(video.contentId);
    toast.success('Added to route!');
  }, [promoRoute, savedVideos]);

  const handleBuildRouteFromWatchLater = useCallback(() => {
    setShowBookmarks(false);
    setShowRouteBuilderFromFeed(true);
    if (promoRoute.watchLater.length === 0) return;
    const lat = routeBuilderFeed.userLocation?.lat ?? routeBuilderFeed.defaultCenter.lat;
    const lng = routeBuilderFeed.userLocation?.lng ?? routeBuilderFeed.defaultCenter.lng;
    promoRoute.suggestFromWatchLater(lat, lng, promoRoute.activeRoute?.filters ?? defaultRouteFilters);
    toast.success('Route built from your saved promos');
  }, [promoRoute, routeBuilderFeed]);

  const handleTabChange = (tab: string, options?: { openNewChat?: boolean }) => {
    setActiveTab(tab);
    // Close all modals first
    setShowProfile(false);
    setShowMap(false);
    setShowFeed(false);
    setShowMessages(false);
    setMessagesOpenNewChat(false);
    setShowNotifications(false);
    setShowNotificationPrefs(false);
    setShowBookmarks(false);
    setShowCreatorTools(false);

    switch (tab) {
      case 'profile':
        setShowProfile(true);
        break;
      case 'messages':
        setShowMessages(true);
        setMessagesOpenNewChat(options?.openNewChat ?? false);
        break;
      case 'notifications':
        setShowNotifications(true);
        break;
      case 'discover':
        setShowMap(true);
        break;
      case 'bookmarks':
        setShowBookmarks(true);
        break;
      case 'create':
        setShowFeed(true); // Show personalized feed on create tab for now
        break;
      case 'logo':
        setShowCreatorTools(true);
        break;
      default:
        break;
    }
  };

  // Get configured pages for each direction
  const centerPages = getPagesByDirection('center');
  const leftPages = getPagesByDirection('left');
  const rightPages = getPagesByDirection('right');
  const isAtCenter = currentState.direction === 'center';
  const isSavedFeed = currentPage?.contentType === 'saved' || currentPage?.contentType === 'main';
  const showMainFeed = isMainFeedPage || (isAtCenter && !currentPage); // includes saved/main + unknown types + no page (prevents black screen)

  return (
    <ControlsVisibilityProvider>
      <DoubleTapGestureDetector onTripleTap={handleSettings} onDoubleTap={isAtCenter ? handleLike : undefined}>
        <div 
          className="fixed inset-0 bg-background overflow-hidden touch-none"
          {...handlers}
        >
        {demoModeEnabled && !showScenarioSelector && (
          <div className="fixed top-3 left-3 z-[95] flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowScenarioSelector(true)}
              className="min-h-[44px] rounded-full border-sky-400/40 bg-slate-900/70 px-3 py-1.5 text-xs font-medium text-sky-100 backdrop-blur-md hover:bg-slate-900/80"
            >
              Demo Mode
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setShowDemoControls(true)}
              className="h-10 w-10 rounded-full border-white/20 bg-slate-900/70 text-slate-100 backdrop-blur-md hover:bg-slate-900/80"
              aria-label="Open demo controls"
            >
              <Settings2 className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Dynamic Page Container with transitions */}
        <div className={cn("absolute inset-0", getTransitionClasses())} style={getTransitionStyles()}>
          {/* Render based on current page content type */}
          {isAtCenter && showMainFeed ? (
            // Saved Feed (Main Feed) – MediaCard with infinite video loop
            <div className="absolute inset-0">
              {currentMedia ? (
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
                      preferLandscapePlayback={demoControls.forceLandscapePlayback}
                      isLandscapeViewport={isLandscapeViewport}
                      onComplete={handleMediaComplete}
                      onSkip={handleSkip}
                      onEarlyExit={() => {
                        toast.info('No reward earned', {
                          description: 'Full watch required for this campaign.',
                        });
                      }}
                      isActive={!isTransitioning && isAtCenter}
                    />
                  </div>
              ) : (
                <MediaCardSkeleton />
              )}

              {/* Always show controls & nav when on main feed (even during skeleton/loading) */}
              {/* Edge preview peeks for cross-navigation discoverability */}
              <div className="pointer-events-none absolute inset-0 z-20">
                <div className="absolute left-0 top-1/2 -translate-y-1/2 h-28 w-2 rounded-r-full bg-white/25 blur-[0.5px]" />
                <div className="absolute right-0 top-1/2 -translate-y-1/2 h-28 w-2 rounded-l-full bg-white/25 blur-[0.5px]" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-2 rounded-b-full bg-white/18" />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-20 h-2 rounded-t-full bg-white/18" />
              </div>

              <CrossNavigation
                onNavigate={handleNavigate}
                activeDirection={activeDirection}
                labels={{ up: 'Next', down: 'Prev', left: 'Prev', right: 'Next' }}
              />

              <FloatingControls
                onWalletClick={() => setShowWallet(true)}
                onProfileClick={() => setShowProfile(true)}
                onLikeClick={handleLike}
                onTip={handleTip}
                tipEnabled={currentCreatorTippable}
                onCommentClick={handleComment}
                onShareClick={handleShare}
                onSettingsClick={handleSettings}
                onFollowClick={handleFollow}
                onAchievementsClick={() => setShowAchievementsPanel(true)}
                achievementsCount={unlockedAchievements.size}
                onSaveVideo={handleSaveVideo}
                onSaveLongPress={handleSaveLongPress}
                onComboAction={(action) => {
                  switch (action) {
                    case 'like':
                      light();
                      handleLike();
                      break;
                    case 'comment':
                      light();
                      handleComment();
                      break;
                    case 'share':
                      light();
                      handleShare();
                      break;
                    case 'save':
                      light();
                      handleSaveVideo();
                      break;
                    case 'nextVideo':
                      light();
                      navigateToMedia('up');
                      break;
                    case 'prevVideo':
                      light();
                      navigateToMedia('down');
                      break;
                    case 'friendsFeed':
                      light();
                      navigateToPage('friends');
                      break;
                    case 'promoFeed':
                      light();
                      navigateToPage('promotions');
                      break;
                    case 'openSettings':
                      light();
                      handleSettings();
                      break;
                    case 'toggleMute':
                      light();
                      toggleMute();
                      toast.info(isMuted ? 'Sound on' : 'Muted');
                      break;
                    case 'follow':
                      handleFollow();
                      break;
                    case 'openWallet':
                      light();
                      setShowWallet(true);
                      break;
                    case 'openProfile':
                      light();
                      setShowProfile(true);
                      break;
                    case 'openMap':
                      light();
                      setShowMap(true);
                      break;
                    case 'openMessages':
                      light();
                      setShowMessages(true);
                      break;
                    case 'openAchievements':
                      light();
                      setShowAchievementsPanel(true);
                      break;
                    case 'openRouteBuilder':
                      light();
                      setShowRouteBuilderFromFeed(true);
                      break;
                    case 'openSavedVideos':
                      light();
                      setShowSavedGallery(true);
                      break;
                    case 'checkIn':
                      handleCheckIn(true);
                      break;
                    case 'tipCreator':
                      light();
                      if (currentCreatorTippable) {
                        setTipSheetSource('remote');
                        setShowTipSheet(true);
                        toast.success('Tip creator', { description: 'Choose amount and confirm below.' });
                      } else {
                        toast.info('Tipping not available', {
                          description: 'This creator cannot receive tips yet.',
                        });
                      }
                      break;
                    case 'toggleRemoteControl':
                      medium();
                      window.dispatchEvent(new CustomEvent('toggleRemoteControl'));
                      toast.info('Remote control toggled');
                      break;
                    case 'report':
                      light();
                      setShowReportContent(true);
                      break;
                    case 'viewCreatorProfile':
                      light();
                      (async () => {
                        const creator = currentMedia?.creator;
                        if (!creator) {
                          toast.error('Creator info not available');
                          return;
                        }
                        const username = creator.username ?? (creator.id ? (await getProfileByUserId(creator.id))?.username : null);
                        if (username) navigate(`/profile/${encodeURIComponent(username)}`);
                        else toast.error("Creator profile isn't available right now.");
                      })();
                      break;
                    case 'none':
                      break;
                  }
                }}
                isLiked={contentLikes.isLiked(currentMedia?.id ?? '')}
                isFollowing={currentMedia?.creator ? follow.isFollowing : false}
                likeCount={contentLikes.getLikeCount(currentMedia?.id ?? '', currentMedia?.likes ?? 0)}
                isVideoSaved={savedVideos.isSaved(currentMedia?.id ?? '')}
                creatorInfo={currentMedia?.creator}
                onViewCreatorProfile={async () => {
                  const creator = currentMedia?.creator;
                  if (!creator) {
                    toast.error('Creator info not available');
                    return;
                  }
                  const username = creator.username ?? (creator.id ? (await getProfileByUserId(creator.id))?.username : null);
                  if (username) {
                    light();
                    navigate(`/profile/${encodeURIComponent(username)}`);
                  } else {
                    toast.error("Creator profile isn't available right now.");
                  }
                }}
                onMessageCreator={() => {
                  setShowMessages(true);
                  setMessagesOpenNewChat(true);
                }}
              />

              <AttentionAchievementsPanel
                isVisible={showAchievementsPanel}
                onClose={() => setShowAchievementsPanel(false)}
                stats={achievementStats}
                unlockedAchievements={unlockedAchievements}
                unlockedAt={achievementUnlockedAt}
              />

              <AchievementUnlockNotification
                achievement={newlyUnlocked}
                onDismiss={dismissNotification}
                onLegendaryCelebrate={() => celebrate('achievement')}
              />
            </div>
          ) : currentPage ? (
            // Dynamic page content (center or side pages) – always show FloatingControls for wallet/profile/settings
            <div className="absolute inset-0">
              {(() => {
                const content = renderPageContent(currentPage.contentType, true);
                return content ?? (
                  <div className="h-full flex flex-col items-center justify-center gap-4 p-6 bg-background">
                    <p className="text-muted-foreground text-sm">Unknown page type: {currentPage.contentType}</p>
                    <Button variant="outline" onClick={() => { resetPageLayout(); window.location.reload(); }}>
                      Reset layout
                    </Button>
                  </div>
                );
              })()}
              {/* Floating controls on feed pages (Friends, Explore, Promotions) – wallet, profile, settings */}
              {['friends', 'explore', 'promotions', 'favorites'].includes(currentPage.contentType) && (
              <FloatingControls
                onWalletClick={() => setShowWallet(true)}
                onProfileClick={() => setShowProfile(true)}
                onLikeClick={() => {}}
                onCommentClick={() => {}}
                onShareClick={() => {}}
                onSettingsClick={handleSettings}
                onFollowClick={handleFollow}
                tipEnabled={currentCreatorTippable}
                onComboAction={(action) => {
                  switch (action) {
                    case 'friendsFeed':
                      light();
                      navigateToPage('friends');
                      break;
                    case 'promoFeed':
                      light();
                      navigateToPage('promotions');
                      break;
                    case 'openSettings':
                      handleSettings();
                      break;
                    case 'openWallet':
                      setShowWallet(true);
                      break;
                    case 'openProfile':
                      setShowProfile(true);
                      break;
                    case 'openMap':
                      setShowMap(true);
                      break;
                    case 'openAchievements':
                      setShowAchievementsPanel(true);
                      break;
                    default:
                      break;
                  }
                }}
                achievementsCount={unlockedAchievements.size}
                onAchievementsClick={() => setShowAchievementsPanel(true)}
              />
              )}
            </div>
          ) : (
            // Fallback when no page configured – show main feed + controls to prevent black screen
            <div className="absolute inset-0">
              {currentMedia ? (
                <MediaCard
                  key={currentMedia.id}
                  type={currentMedia.type}
                  src={currentMedia.src}
                  videoSrc={currentMedia.videoSrc}
                  duration={currentMedia.duration}
                  reward={currentMedia.reward}
                  contentId={currentMedia.id}
                  preferLandscapePlayback={demoControls.forceLandscapePlayback}
                  isLandscapeViewport={isLandscapeViewport}
                  onComplete={handleMediaComplete}
                  onSkip={handleSkip}
                  onEarlyExit={() => toast.info('No reward earned', { description: 'Full watch required.' })}
                  isActive={isAtCenter}
                />
              ) : (
                <MediaCardSkeleton />
              )}
              <CrossNavigation onNavigate={handleNavigate} activeDirection={activeDirection} labels={{ up: 'Next', down: 'Prev', left: 'Prev', right: 'Next' }} />
              <FloatingControls
                onWalletClick={() => setShowWallet(true)}
                onProfileClick={() => setShowProfile(true)}
                onLikeClick={handleLike}
                onTip={handleTip}
                tipEnabled={currentCreatorTippable}
                onCommentClick={handleComment}
                onShareClick={handleShare}
                onSettingsClick={handleSettings}
                onFollowClick={handleFollow}
                onAchievementsClick={() => setShowAchievementsPanel(true)}
                achievementsCount={unlockedAchievements.size}
                onSaveVideo={handleSaveVideo}
                onSaveLongPress={handleSaveLongPress}
                onComboAction={(a) => {
                  if (a === 'openSettings') handleSettings();
                  else if (a === 'openWallet') setShowWallet(true);
                  else if (a === 'openProfile') setShowProfile(true);
                  else if (a === 'nextVideo') navigateToMedia('up');
                  else if (a === 'prevVideo') navigateToMedia('down');
                }}
                isLiked={contentLikes.isLiked(currentMedia?.id ?? '')}
                isFollowing={currentMedia?.creator ? follow.isFollowing : false}
                likeCount={contentLikes.getLikeCount(currentMedia?.id ?? '', currentMedia?.likes ?? 0)}
                isVideoSaved={savedVideos.isSaved(currentMedia?.id ?? '')}
                creatorInfo={currentMedia?.creator}
                onViewCreatorProfile={() => currentMedia?.creator && navigate(`/profile/${currentMedia.creator.username ?? currentMedia.creator.id}`)}
                onMessageCreator={() => setShowMessages(true)}
              />
            </div>
          )}
        </div>

        {/* Always show "Reveal controls" button when hidden – works on all feeds */}
        <AccessibleShowControlsButton />

        {/* Screen Indicators - hidden with controls */}
        <ScreenIndicatorsAutoHide leftPages={leftPages} rightPages={rightPages} isAtCenter={isAtCenter} />

        {/* Coin slide animation on reward */}
        <CoinSlideAnimation
          type={coinSlideType}
          amount={coinSlideAmount ?? 0}
          isAnimating={showCoinSlide}
          onComplete={handleCoinSlideComplete}
        />

        {/* Wallet Screen */}
        <WalletScreen
          isOpen={showWallet}
          onClose={() => { setShowWallet(false); setWalletInitialTab(undefined); }}
          vicoins={vicoins}
          icoins={icoins}
          initialTab={walletInitialTab}
          demoCheckoutOutcome={demoControls.checkoutOutcome}
          tourCommand={walletTourCommand}
          onTourCommandHandled={(id) => {
            setWalletTourCommand((prev) => (prev?.id === id ? null : prev));
          }}
          onDiscover={() => {
            setShowWallet(false);
            setShowMap(true);
          }}
        />

        {/* Profile Screen */}
        <ProfileScreen
          isOpen={showProfile}
          onClose={() => { setShowProfile(false); setActiveTab('home'); }}
        />

        {/* Discovery Map */}
        <DiscoveryMap
          isOpen={showMap}
          onClose={() => { setShowMap(false); setMapOpenForCheckIn(false); setActiveTab('home'); }}
          promoRoute={promoRoute}
          onOpenWallet={() => setShowWallet(true)}
          initialMode={mapOpenForCheckIn ? 'checkin' : undefined}
        />

        {/* Personalized AI Feed */}
        {showFeed && (
          <div className="fixed inset-0 z-40 bg-background">
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between p-4 border-b">
                <h1 className="text-xl font-bold">For You</h1>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => { setShowFeed(false); setActiveTab('home'); }}
                  className="h-8 w-8 rounded-full p-0 text-muted-foreground hover:text-foreground"
                >
                  ✕
                </Button>
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
          onClose={() => { setShowMessages(false); setMessagesOpenNewChat(false); setActiveTab('home'); }}
          openNewChat={messagesOpenNewChat}
        />

        {/* Notifications overlay (from tab or Messages long-press) */}
        <NotificationCenter
          isOpen={showNotifications}
          onClose={() => { setShowNotifications(false); setActiveTab('home'); }}
          onOpenPreferences={() => { setShowNotifications(false); setShowNotificationPrefs(true); }}
          onNavigate={() => setShowNotifications(false)}
        />
        <NotificationPreferences
          isOpen={showNotificationPrefs}
          onClose={() => setShowNotificationPrefs(false)}
        />

        {/* Creator Tools – I button → Create, Promote, Studio, Analytics */}
        <CreatorToolsSheet
          isOpen={showCreatorTools}
          onClose={() => { setShowCreatorTools(false); setActiveTab('home'); }}
        />

        {/* Bookmarks hub – Home long-press → Bookmarks */}
        <BookmarksScreen
          isOpen={showBookmarks}
          onClose={() => { setShowBookmarks(false); setActiveTab('home'); }}
          savedVideos={savedVideos.savedVideos}
          onUnsave={savedVideos.unsaveVideo}
          onUnsaveMany={savedVideos.unsaveVideos}
          onAddToRoute={handleAddSavedToRoute}
          savedSyncing={savedVideos.syncing}
          onSavedRefresh={savedVideos.refreshFromServer}
          exportSavedAsJson={savedVideos.exportAsJson}
          importSavedFromJson={savedVideos.importFromJson}
          watchLater={promoRoute.watchLater}
          onRemoveFromWatchLater={promoRoute.removeFromWatchLater}
          onBuildRouteFromWatchLater={handleBuildRouteFromWatchLater}
          onOpenMap={() => { setShowMap(true); setMapOpenForCheckIn(false); }}
          likedCount={contentLikes.count}
          onOpenFeed={() => {}}
        />

        {/* Add to route / Save for later - when viewing a promo with location */}
        {isAtCenter && currentMedia?.promoLocation && (
          <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-40 flex items-center gap-2">
            {promoRoute.isInRoute(currentMedia.promoLocation.promotionId) ? (
              <Button
                type="button"
                onClick={() => setShowRouteBuilderFromFeed(true)}
                className="h-auto rounded-full bg-green-500/90 px-4 py-2.5 text-sm font-medium text-white shadow-lg hover:bg-green-500"
              >
                <RouteIcon className="w-4 h-4" /> In route · Tap to open
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => {
                  if (!promoRoute.isBuilding) promoRoute.startRoute('Feed Route');
                  promoRoute.addStop({
                    id: `stop-${currentMedia.promoLocation!.promotionId}`,
                    promotionId: currentMedia.promoLocation!.promotionId,
                    businessName: currentMedia.promoLocation!.businessName,
                    latitude: currentMedia.promoLocation!.latitude,
                    longitude: currentMedia.promoLocation!.longitude,
                    address: currentMedia.promoLocation!.address,
                    category: currentMedia.promoLocation!.category,
                    rewardType: currentMedia.promoLocation!.rewardType,
                    rewardAmount: currentMedia.promoLocation!.rewardAmount,
                    requiredAction: currentMedia.promoLocation!.requiredAction,
                    fromFeed: true,
                    contentId: currentMedia.id,
                  });
                  setShowRouteBuilderFromFeed(true);
                  toast.success('Added to route');
                }}
                className="h-auto rounded-full bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-lg transition-transform hover:scale-105"
              >
                <RouteIcon className="w-4 h-4" /> Add to route
              </Button>
            )}
            {promoRoute.isInWatchLater(currentMedia.promoLocation.promotionId) ? (
              <span className="px-3 py-2.5 rounded-full bg-muted text-muted-foreground text-sm">Saved</span>
            ) : (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  promoRoute.addToWatchLater({
                    id: `stop-${currentMedia.promoLocation!.promotionId}`,
                    promotionId: currentMedia.promoLocation!.promotionId,
                    businessName: currentMedia.promoLocation!.businessName,
                    latitude: currentMedia.promoLocation!.latitude,
                    longitude: currentMedia.promoLocation!.longitude,
                    address: currentMedia.promoLocation!.address,
                    category: currentMedia.promoLocation!.category,
                    rewardType: currentMedia.promoLocation!.rewardType,
                    rewardAmount: currentMedia.promoLocation!.rewardAmount,
                    requiredAction: currentMedia.promoLocation!.requiredAction,
                  });
                  toast.success('Saved for later');
                }}
                className="h-auto rounded-full border border-border bg-muted/80 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <Bookmark className="w-4 h-4" /> Save for later
              </Button>
            )}
          </div>
        )}

        {/* Floating Route Banner - visible on feed when building a route */}
        {isAtCenter && promoRoute.isBuilding && promoRoute.totalStops > 0 && !currentMedia?.promoLocation && (
          <div className="fixed bottom-20 left-1/2 transform -translate-x-1/2 z-40">
            <Button
              type="button"
              onClick={() => setShowRouteBuilderFromFeed(true)}
              className="h-auto animate-slide-up rounded-full bg-green-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg shadow-green-500/30 transition-transform hover:scale-105"
            >
              <RouteIcon className="w-4 h-4" />
              {promoRoute.totalStops} stops · {promoRoute.totalReward} coins
            </Button>
          </div>
        )}
        {isAtCenter && promoRoute.isBuilding && promoRoute.totalStops > 0 && currentMedia?.promoLocation && (
          <div className="fixed bottom-[4.25rem] left-1/2 transform -translate-x-1/2 z-40">
            <Button
              type="button"
              onClick={() => setShowRouteBuilderFromFeed(true)}
              className="h-auto rounded-full bg-green-500 px-4 py-2 text-xs font-medium text-white shadow-lg"
            >
              <RouteIcon className="w-3.5 h-3.5" />
              {promoRoute.totalStops} stops · {promoRoute.totalReward} coins
            </Button>
          </div>
        )}

        {/* Route Builder from Feed */}
        <RouteBuilder
          open={showRouteBuilderFromFeed}
          onOpenChange={setShowRouteBuilderFromFeed}
          route={promoRoute.activeRoute}
          savedRoutes={promoRoute.savedRoutes}
          watchLater={promoRoute.watchLater}
          onRemoveStop={promoRoute.removeStop}
          onReorderStops={promoRoute.reorderStops}
          onSetTransportMode={promoRoute.setTransportMode}
          onSetFilters={promoRoute.setRouteFilters}
          onRenameRoute={promoRoute.renameRoute}
          onToggleCommute={promoRoute.toggleCommuteRoute}
          onSaveRoute={promoRoute.saveRoute}
          onDiscardRoute={promoRoute.discardRoute}
          onOpenInGoogleMaps={promoRoute.openInGoogleMaps}
          onSuggestRoute={async (optimization) => {
            setRouteSuggestLoading(true);
            try {
              const promos = await routeBuilderFeed.fetchNearbyPromotions();
              const lat = routeBuilderFeed.userLocation?.lat ?? routeBuilderFeed.defaultCenter.lat;
              const lng = routeBuilderFeed.userLocation?.lng ?? routeBuilderFeed.defaultCenter.lng;
              const filters = { ...defaultRouteFilters, optimization: (optimization as import('@/hooks/usePromoRoute').RouteOptimization) || 'balanced' };
              promoRoute.suggestRoute(promos, lat, lng, filters);
              toast.success('Route suggested from nearby promotions');
            } catch {
              toast.error('Could not load nearby promotions. Try opening the map.');
            } finally {
              setRouteSuggestLoading(false);
            }
          }}
          onLoadRoute={promoRoute.loadRoute}
          onDeleteSavedRoute={promoRoute.deleteSavedRoute}
          onRemoveFromWatchLater={promoRoute.removeFromWatchLater}
          onSetDestination={promoRoute.setDestination}
          onSetSchedule={promoRoute.setSchedule}
          onSetSegmentTransport={promoRoute.setSegmentTransport}
          getSegmentTransport={promoRoute.getSegmentTransport}
          onSuggestFromSaved={async () => {
            if (promoRoute.watchLater.length === 0) {
              toast.info('Save promos to Watch Later first, then suggest a route from them');
              return;
            }
            setRouteSuggestLoading(true);
            try {
              const lat = routeBuilderFeed.userLocation?.lat ?? routeBuilderFeed.defaultCenter.lat;
              const lng = routeBuilderFeed.userLocation?.lng ?? routeBuilderFeed.defaultCenter.lng;
              promoRoute.suggestFromWatchLater(lat, lng, promoRoute.activeRoute?.filters ?? defaultRouteFilters);
              toast.success('Route built from your saved promos');
            } finally {
              setRouteSuggestLoading(false);
            }
          }}
          onSuggestByInterests={async () => {
            setRouteSuggestLoading(true);
            try {
              const promos = await routeBuilderFeed.fetchNearbyPromotions();
              const lat = routeBuilderFeed.userLocation?.lat ?? routeBuilderFeed.defaultCenter.lat;
              const lng = routeBuilderFeed.userLocation?.lng ?? routeBuilderFeed.defaultCenter.lng;
              const categories = [...new Set(promoRoute.watchLater.map((w) => w.category).filter(Boolean))] as string[];
              promoRoute.suggestByInterests(promos, lat, lng, categories, promoRoute.activeRoute?.filters ?? defaultRouteFilters);
              toast.success('Route suggested by your interests');
            } catch {
              toast.error('Could not load nearby promotions.');
            } finally {
              setRouteSuggestLoading(false);
            }
          }}
          onSuggestSmartRoute={async () => {
            setRouteSuggestLoading(true);
            try {
              const promos = await routeBuilderFeed.fetchNearbyPromotions();
              const lat = routeBuilderFeed.userLocation?.lat ?? routeBuilderFeed.defaultCenter.lat;
              const lng = routeBuilderFeed.userLocation?.lng ?? routeBuilderFeed.defaultCenter.lng;
              promoRoute.suggestSmartRoute(promos, lat, lng);
              toast.success('Smart route generated');
            } catch {
              toast.error('Could not generate smart route. Try opening the map.');
            } finally {
              setRouteSuggestLoading(false);
            }
          }}
          onStartRoute={() => promoRoute.startRoute('Feed Route')}
          onDuplicateRoute={promoRoute.duplicateRoute}
          onOpenSavedRouteInMaps={(routeId) => promoRoute.openSavedRouteInMaps(routeId)}
          onOptimizeOrder={promoRoute.optimizeOrder}
          userLocation={routeBuilderFeed.userLocation ? { lat: routeBuilderFeed.userLocation.lat, lng: routeBuilderFeed.userLocation.lng } : undefined}
          mapboxToken={routeBuilderFeed.mapboxToken}
          suggestLoading={routeSuggestLoading}
          locationLoading={routeBuilderFeed.locationLoading}
          routesSyncing={promoRoute.routesSyncing}
          lastRoutesSyncAt={promoRoute.lastRoutesSyncAt}
          activeRouteEstimate={promoRoute.activeRouteEstimate}
          isCloudSynced={promoRoute.isCloudSynced}
          onAddSavedRoute={promoRoute.addSavedRoute}
        />

        {/* Bottom Navigation - centered at bottom */}
        <BottomNavigation 
          activeTab={activeTab} 
          onTabChange={handleTabChange}
          messagesUnreadCount={messagesUnreadCount}
          notificationsUnreadCount={notificationsUnreadCount}
          bookmarksCount={savedVideos.savedVideos.length + promoRoute.watchLater.length + contentLikes.count}
          onHomeRefresh={handleRefresh}
          className={cn(isLandscapeViewport && 'scale-90')}
        />

        {/* Onboarding: product tour + KYC for new or unverified users */}
        <OnboardingFlow
          isOpen={showOnboarding}
          onClose={closeOnboarding}
          onComplete={completeOnboarding}
          phase={onboardingPhase}
          onCompleteProductTour={completeProductTour}
          onSkipProductTour={skipProductTour}
          progress={onboardingProgress}
          markStepComplete={markOnboardingStepComplete}
          progressPercentage={onboardingProgressPercentage}
          onVerified={() => celebrate('achievement')}
        />

        {/* Theme Presets Bottom Sheet */}
        <ThemePresetsSheet
          isOpen={showThemePresets}
          onClose={() => setShowThemePresets(false)}
        />

        {/* Saved Videos Gallery */}
        <SavedVideosGallery
          isOpen={showSavedGallery}
          onClose={() => setShowSavedGallery(false)}
          savedVideos={savedVideos.savedVideos}
          onUnsave={savedVideos.unsaveVideo}
          onUnsaveMany={savedVideos.unsaveVideos}
          onAddToRoute={handleAddSavedToRoute}
          syncing={savedVideos.syncing}
          onRefresh={savedVideos.refreshFromServer}
          exportAsJson={savedVideos.exportAsJson}
          importFromJson={savedVideos.importFromJson}
        />

        {/* Comments Panel */}
        <CommentsPanel
          isOpen={showComments}
          onClose={() => setShowComments(false)}
          contentId={currentMedia?.id ?? ''}
          contentType={currentMedia?.type === 'promo' ? 'promotion' : 'user_content'}
        />

        {/* Promo Check-In Flow – when viewing promo content and check-in combo/action triggered */}
        {currentMedia?.type === 'promo' && currentMedia?.reward && (
          <PromoCheckInFlow
            isOpen={showCheckInFlow}
            onClose={() => setShowCheckInFlow(false)}
            promotion={{
              id: currentMedia.id,
              business_name: currentMedia.creator?.displayName ?? currentMedia.title ?? 'Promotion',
              description: currentMedia.title ?? 'Watch and earn rewards',
              reward_type: currentMedia.reward.type,
              reward_amount: currentMedia.reward.amount,
              required_action: 'watch',
            }}
            onOpenWallet={() => setShowWallet(true)}
            onShareSuccess={handleShareSuccess}
          />
        )}

        {/* Quick Check-In Sheet – for non-promo or quick location check-in */}
        <QuickCheckInSheet
          isOpen={showQuickCheckIn}
          onClose={() => setShowQuickCheckIn(false)}
          onOpenMap={() => { setShowMap(true); setMapOpenForCheckIn(false); }}
          mapAlreadyOpen={showMap && mapOpenForCheckIn}
          openedFromRemote={mapOpenForCheckIn}
        />

        {/* Share Sheet - per-item deep link when shareContext is set */}
        <ShareSheet
          isOpen={showShare}
          onClose={() => {
            setShowShare(false);
            setShareContext(null);
          }}
          contentId={shareContext?.contentId ?? undefined}
          title={shareContext?.title ?? 'Check out this content!'}
          description={shareContext?.description ?? ''}
          url={shareContext?.contentId ? undefined : window.location.href}
          mediaUrl={shareContext?.mediaUrl ?? undefined}
          mediaType={shareContext?.mediaType}
        />

        {/* Report content (from feed long-press / report action) */}
        <ContentReportFlow
          isOpen={showReportContent}
          onClose={() => setShowReportContent(false)}
          contentId={currentMedia?.id ?? ''}
          contentType={currentMedia?.type === 'promo' ? 'video' : currentMedia?.type ?? 'video'}
        />

        {/* Tip creator sheet – opened from remote control (tipCreator combo) or openTipPanel event */}
        <TipSheet
          open={showTipSheet}
          onOpenChange={setShowTipSheet}
          creatorInfo={currentMedia?.creator ?? undefined}
          contentId={currentMedia?.id ?? undefined}
          creatorIdValidForTip={currentCreatorTippable}
          currentUserId={user?.id ?? undefined}
          vicoinBalance={vicoins}
          icoinBalance={icoins}
          onTip={handleTip}
          source={tipSheetSource}
        />

        {/* Network Status Indicator - hidden with controls */}
        <NetworkStatusAutoHide />

        {/* Gesture Tutorial for new users */}
        {showTutorial && (
          <GestureTutorial
            onComplete={completeTutorial}
            onSkip={skipTutorial}
          />
        )}

        {/* Confetti Celebration */}
        <ConfettiCelebration
          isActive={showCelebration}
          type={celebrationType}
          onComplete={stopCelebration}
        />

        {demoModeEnabled && showHeroEntry && (
          <HeroEntry
            onEnterDemo={() => {
              setShowHeroEntry(false);
              setShowScenarioSelector(true);
            }}
            onInvestorWalkthrough={() => {
              setShowHeroEntry(false);
              setShowScenarioSelector(true);
            }}
            onOpenPresenterPanel={() => setShowDemoControls(true)}
          />
        )}

        <DemoScenarioSelector
          isOpen={showScenarioSelector}
          onOpenDemoControls={() => setShowDemoControls(true)}
          onStartScenario={handleStartScenario}
          onBack={() => {
            setShowScenarioSelector(false);
            setShowHeroEntry(true);
          }}
        />

        <DemoControlsSheet
          isOpen={showDemoControls}
          locale={locale === 'pt' ? 'pt' : 'en'}
          controls={demoControls}
          onClose={() => setShowDemoControls(false)}
          onControlsChange={setDemoControls}
          onLocaleChange={(nextLocale) => setLocale(nextLocale)}
          onResetLayout={handleResetLayout}
          onRestartDemo={() => {
            setShowHeroEntry(true);
            setShowScenarioSelector(false);
            setShowWallet(false);
            setShowProfile(false);
            setShowDemoControls(false);
          }}
        />

        <GuidedInvestorTour
          isOpen={showGuidedTour}
          scenarioId={guidedScenarioId}
          onAction={handleGuidedTourAction}
          onClose={() => setShowGuidedTour(false)}
        />
        </div>
      </DoubleTapGestureDetector>
    </ControlsVisibilityProvider>
  );
};

export default Index;
