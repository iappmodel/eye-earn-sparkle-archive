import React, { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react';
import { User, MessageCircle, Share2, Settings, Heart, Eye, EyeOff, Radio, Cog, ChevronDown, Trophy, Wallet, Bookmark, Check } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { NeuButton } from './NeuButton';
import { MorphingLikeButton } from './MorphingLikeButton';
import { LongPressButtonWrapper } from './LongPressButtonWrapper';
import { BlinkRemoteControl } from './BlinkRemoteControl';
import { TargetOverlay } from './TargetOverlay';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
// Context for sharing visibility state across components
interface ControlsVisibilityContextType {
  isVisible: boolean;
  showControls: () => void;
}

const ControlsVisibilityContext = createContext<ControlsVisibilityContextType | null>(null);

export const useControlsVisibility = () => {
  const context = useContext(ControlsVisibilityContext);
  if (!context) {
    return { isVisible: true, showControls: () => {} };
  }
  return context;
};

// Storage keys for preferences
const AUTO_HIDE_STORAGE_KEY = 'visuai-buttons-auto-hide';
const AUTO_HIDE_DELAY_STORAGE_KEY = 'visuai-buttons-auto-hide-delay';
const BUTTONS_HIDDEN_STORAGE_KEY = 'visuai-buttons-hidden';

// Available delay options in milliseconds (0 = never)
export const AUTO_HIDE_DELAY_OPTIONS = [
  { value: 500, label: '0.5s' },
  { value: 1000, label: '1s' },
  { value: 1500, label: '1.5s' },
  { value: 2000, label: '2s' },
  { value: 2500, label: '2.5s' },
  { value: 3000, label: '3s' },
  { value: 5000, label: '5s' },
  { value: 10000, label: '10s' },
  { value: 0, label: 'Never' },
];

export const getAutoHideEnabled = (): boolean => {
  try {
    const saved = localStorage.getItem(AUTO_HIDE_STORAGE_KEY);
    return saved === null ? true : saved === 'true';
  } catch {
    return true;
  }
};

export const setAutoHideEnabled = (enabled: boolean) => {
  try {
    localStorage.setItem(AUTO_HIDE_STORAGE_KEY, String(enabled));
  } catch (e) {
    console.error('Failed to save auto-hide preference:', e);
  }
};

export const getAutoHideDelay = (): number => {
  try {
    const saved = localStorage.getItem(AUTO_HIDE_DELAY_STORAGE_KEY);
    return saved ? parseInt(saved, 10) : 3000;
  } catch {
    return 3000;
  }
};

export const setAutoHideDelay = (delay: number) => {
  try {
    localStorage.setItem(AUTO_HIDE_DELAY_STORAGE_KEY, String(delay));
  } catch (e) {
    console.error('Failed to save auto-hide delay:', e);
  }
};

export const getButtonsHidden = (): boolean => {
  try {
    const saved = localStorage.getItem(BUTTONS_HIDDEN_STORAGE_KEY);
    return saved === 'true';
  } catch {
    return false;
  }
};

export const setButtonsHidden = (hidden: boolean) => {
  try {
    localStorage.setItem(BUTTONS_HIDDEN_STORAGE_KEY, String(hidden));
  } catch (e) {
    console.error('Failed to save buttons hidden state:', e);
  }
};

interface ControlsVisibilityProviderProps {
  children: React.ReactNode;
}

export const ControlsVisibilityProvider: React.FC<ControlsVisibilityProviderProps> = ({
  children,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [autoHideEnabled, setAutoHideEnabledState] = useState(() => getAutoHideEnabled());
  const [autoHideDelay, setAutoHideDelayState] = useState(() => getAutoHideDelay());
  const [buttonsHidden, setButtonsHiddenState] = useState(() => getButtonsHidden());
  const hideTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen for storage changes to sync preferences
  useEffect(() => {
    const handleStorage = () => {
      setAutoHideEnabledState(getAutoHideEnabled());
      setAutoHideDelayState(getAutoHideDelay());
      setButtonsHiddenState(getButtonsHidden());
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const showControls = useCallback(() => {
    if (buttonsHidden) return;
    
    setIsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    
    if (autoHideEnabled && autoHideDelay > 0) {
      hideTimerRef.current = setTimeout(() => {
        setIsVisible(false);
      }, autoHideDelay);
    }
  }, [autoHideDelay, autoHideEnabled, buttonsHidden]);

  useEffect(() => {
    if (buttonsHidden) {
      setIsVisible(false);
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    } else if (!autoHideEnabled || autoHideDelay === 0) {
      setIsVisible(true);
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
    }
  }, [autoHideEnabled, autoHideDelay, buttonsHidden]);

  useEffect(() => {
    if (!buttonsHidden) {
      showControls();
    }

    const onUserActivity = () => {
      if (!buttonsHidden) {
        showControls();
      }
    };

    window.addEventListener('pointerdown', onUserActivity, { passive: true });
    window.addEventListener('keydown', onUserActivity);

    return () => {
      window.removeEventListener('pointerdown', onUserActivity);
      window.removeEventListener('keydown', onUserActivity);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [showControls, buttonsHidden]);

  const finalVisible = buttonsHidden ? false : (autoHideEnabled && autoHideDelay > 0 ? isVisible : true);

  return (
    <ControlsVisibilityContext.Provider value={{ isVisible: finalVisible, showControls }}>
      {children}
    </ControlsVisibilityContext.Provider>
  );
};

interface CreatorInfo {
  id: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
  postsCount?: number;
  followersCount?: number;
  followingCount?: number;
  isVerified?: boolean;
}

interface FloatingControlsProps {
  onWalletClick: () => void;
  onProfileClick: () => void;
  onLikeClick: () => void;
  onCommentClick: () => void;
  onShareClick: () => void;
  onSettingsClick: () => void;
  onFollowClick?: () => void;
  onTip?: (coinType: 'vicoin' | 'icoin', amount: number) => void;
  onSaveClick?: () => void;
  onReportClick?: () => void;
  onMuteClick?: () => void;
  onAchievementsClick?: () => void;
  onSaveVideo?: () => void;
  onSaveLongPress?: () => void;
  onComboAction?: (action: string) => void;
  isLiked?: boolean;
  isFollowing?: boolean;
  isSaved?: boolean;
  isVideoSaved?: boolean;
  likeCount?: number;
  commentCount?: number;
  creatorName?: string;
  showAchievements?: boolean;
  achievementsCount?: number;
  /** Info about the content creator being viewed */
  creatorInfo?: CreatorInfo;
  onViewCreatorProfile?: () => void;
}

// Profile Preview Sheet Component
interface ProfilePreviewSheetProps {
  onFullProfileClick: () => void;
  onAchievementsClick?: () => void;
  onWalletClick?: () => void;
  creatorInfo?: CreatorInfo;
}

const ProfilePreviewSheet: React.FC<ProfilePreviewSheetProps> = ({ 
  onFullProfileClick,
  onAchievementsClick,
  onWalletClick,
  creatorInfo,
}) => {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const { light } = useHapticFeedback();
  
  const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    setIsDragging(true);
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    startYRef.current = clientY;
  };
  
  const handleDragMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const delta = startYRef.current - clientY;
    setDragY(Math.max(-100, Math.min(100, delta)));
  };
  
  const handleDragEnd = () => {
    if (dragY < -50) {
      // Dragged down - close sheet (handled by Sheet component)
    } else if (dragY > 50) {
      // Dragged up - open full profile
      onFullProfileClick();
    }
    setIsDragging(false);
    setDragY(0);
  };

  const displayName = creatorInfo?.displayName || creatorInfo?.username || 'Creator';
  const avatarUrl = creatorInfo?.avatarUrl;

  return (
    <div 
      className="h-full flex flex-col"
      onTouchStart={handleDragStart}
      onTouchMove={handleDragMove}
      onTouchEnd={handleDragEnd}
      onMouseDown={handleDragStart}
      onMouseMove={handleDragMove}
      onMouseUp={handleDragEnd}
      onMouseLeave={handleDragEnd}
    >
      {/* Drag indicator */}
      <div className="flex justify-center py-3">
        <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full" />
      </div>
      
      {/* Swipe hint */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground mb-4">
        <ChevronDown className="w-4 h-4 animate-bounce" />
        <span>Swipe up to view full profile</span>
      </div>
      
      {/* Profile preview content */}
      <div className="flex-1 px-4 space-y-4 overflow-y-auto">
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <img 
              src={avatarUrl} 
              alt={displayName}
              className="w-16 h-16 rounded-full object-cover border-2 border-primary/30"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center">
              <User className="w-8 h-8 text-foreground/70" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-foreground">{displayName}</h3>
              {creatorInfo?.isVerified && (
                <span className="w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-primary-foreground" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                  </svg>
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {creatorInfo?.username ? `@${creatorInfo.username}` : 'View creator profile'}
            </p>
          </div>
        </div>
        
        {/* Quick stats preview */}
        <div className="grid grid-cols-3 gap-4 py-4 border-t border-border/50">
          <div className="text-center">
            <div className="text-lg font-bold text-foreground">{creatorInfo?.postsCount ?? 0}</div>
            <div className="text-xs text-muted-foreground">Posts</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-foreground">{creatorInfo?.followersCount ?? 0}</div>
            <div className="text-xs text-muted-foreground">Followers</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-foreground">{creatorInfo?.followingCount ?? 0}</div>
            <div className="text-xs text-muted-foreground">Following</div>
          </div>
        </div>
        
        {/* Quick Actions - Achievements & Wallet */}
        <div className="grid grid-cols-2 gap-3 py-2">
          <button 
            onClick={() => {
              light();
              onAchievementsClick?.();
            }}
            className="flex items-center justify-center gap-2 py-3 bg-amber-500/10 hover:bg-amber-500/20 rounded-xl text-amber-500 font-medium transition-colors border border-amber-500/20"
          >
            <Trophy className="w-4 h-4" />
            <span>Achievements</span>
          </button>
          <button 
            onClick={() => {
              light();
              onWalletClick?.();
            }}
            className="flex items-center justify-center gap-2 py-3 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-xl text-emerald-500 font-medium transition-colors border border-emerald-500/20"
          >
            <Wallet className="w-4 h-4" />
            <span>Wallet</span>
          </button>
        </div>
        
        {/* View full profile button */}
        <button 
          onClick={onFullProfileClick}
          className="w-full py-3 bg-primary/20 hover:bg-primary/30 rounded-xl text-primary font-medium transition-colors"
        >
          View Full Profile
        </button>
      </div>
    </div>
  );
};

// Visibility Toggle Button
const VisibilityToggleButton: React.FC = () => {
  const [isHidden, setIsHidden] = useState(() => getButtonsHidden());
  const [isAnimating, setIsAnimating] = useState(false);
  const { medium } = useHapticFeedback();
  
  useEffect(() => {
    const handleStorage = () => setIsHidden(getButtonsHidden());
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);
  
  const toggleVisibility = () => {
    medium();
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);
    
    const newValue = !isHidden;
    setIsHidden(newValue);
    setButtonsHidden(newValue);
    window.dispatchEvent(new Event('storage'));
  };

  return (
    <>
      <div className="w-6 h-px bg-white/20 my-0.5" />
      <LongPressButtonWrapper buttonId="visibility-toggle" buttonLabel="Visibility Toggle" showAutoHideSettings={true}>
        <NeuButton 
          onClick={toggleVisibility}
          variant={isHidden ? 'accent' : 'default'}
          tooltip={isHidden ? 'Show buttons' : 'Hide buttons'}
        >
          <span className={cn('transition-all duration-300', isAnimating && 'rotate-180 scale-110')}>
            {isHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </span>
        </NeuButton>
      </LongPressButtonWrapper>
    </>
  );
};

export const FloatingControls: React.FC<FloatingControlsProps> = ({
  onWalletClick,
  onProfileClick,
  onLikeClick,
  onCommentClick,
  onShareClick,
  onSettingsClick,
  onTip,
  onAchievementsClick,
  onSaveVideo,
  onSaveLongPress,
  onComboAction,
  isLiked = false,
  likeCount = 0,
  isVideoSaved = false,
  creatorInfo,
  onViewCreatorProfile,
}) => {
  const { isVisible } = useControlsVisibility();
  const { medium } = useHapticFeedback();
  const [remoteControlEnabled, setRemoteControlEnabled] = useState(false);
  const [showRemoteSettings, setShowRemoteSettings] = useState(false);
  const [profileSheetOpen, setProfileSheetOpen] = useState(false);
  const saveLongPressTimer = useRef<NodeJS.Timeout | null>(null);
  const didLongPress = useRef(false);
  const touchFired = useRef(false);
  
  const handleFullProfileClick = () => {
    setProfileSheetOpen(false);
    if (onViewCreatorProfile) {
      onViewCreatorProfile();
    } else {
      onProfileClick();
    }
  };
  
  const handleRemoteControlToggle = () => {
    medium();
    setRemoteControlEnabled(!remoteControlEnabled);
  };

  const startSaveTimer = useCallback(() => {
    if (saveLongPressTimer.current) clearTimeout(saveLongPressTimer.current);
    didLongPress.current = false;
    saveLongPressTimer.current = setTimeout(() => {
      saveLongPressTimer.current = null;
      didLongPress.current = true;
      medium();
      onSaveLongPress?.();
    }, 1000);
  }, [medium, onSaveLongPress]);

  const clearSaveTimer = useCallback(() => {
    if (saveLongPressTimer.current) {
      clearTimeout(saveLongPressTimer.current);
      saveLongPressTimer.current = null;
    }
  }, []);

  const handleSaveTouchStart = useCallback(() => {
    touchFired.current = true;
    startSaveTimer();
  }, [startSaveTimer]);

  const handleSaveTouchEnd = useCallback(() => {
    clearSaveTimer();
    setTimeout(() => { touchFired.current = false; }, 0);
  }, [clearSaveTimer]);

  const handleSaveMouseDown = useCallback(() => {
    if (touchFired.current) return;
    startSaveTimer();
  }, [startSaveTimer]);

  const handleSaveMouseUp = useCallback(() => {
    if (touchFired.current) return;
    clearSaveTimer();
  }, [clearSaveTimer]);

  const handleSaveClick = useCallback(() => {
    if (didLongPress.current) {
      didLongPress.current = false;
      return;
    }
    onSaveVideo?.();
  }, [onSaveVideo]);

  useEffect(() => {
    return () => {
      if (saveLongPressTimer.current) clearTimeout(saveLongPressTimer.current);
    };
  }, []);

  return (
    <>
      {/* Right side button stack - thumb zone optimized, bottom to top order */}
      <div 
        className={cn(
          'fixed right-3 z-40',
          'flex flex-col-reverse items-center gap-1.5',
          'transition-all duration-500 ease-out',
          isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12 pointer-events-none'
        )}
        style={{ bottom: 'calc(100px + env(safe-area-inset-bottom, 0px))' }}
      >
        {/* 1st from bottom: Like (Heart) with MorphingLikeButton */}
        <LongPressButtonWrapper buttonId="like-button" buttonLabel="Like">
          <MorphingLikeButton
            isLiked={isLiked}
            likeCount={likeCount}
            onLike={onLikeClick}
            onTip={onTip}
          />
        </LongPressButtonWrapper>

        {/* 2nd from bottom: V button (vCoin) - handled by MorphingLikeButton */}
        {/* 3rd from bottom: I button (iCoin) - handled by MorphingLikeButton */}
        {/* Note: V and I buttons are part of MorphingLikeButton's stacked design */}

        {/* 4th from bottom: Messages */}
        <LongPressButtonWrapper buttonId="messages-button" buttonLabel="Messages">
          <NeuButton onClick={onCommentClick} tooltip="Messages">
            <MessageCircle className="w-4 h-4" />
          </NeuButton>
        </LongPressButtonWrapper>

        {/* 5th from bottom: Settings */}
        <LongPressButtonWrapper buttonId="settings-button" buttonLabel="Settings">
          <NeuButton onClick={onSettingsClick} tooltip="Settings">
            <Settings className="w-4 h-4" />
          </NeuButton>
        </LongPressButtonWrapper>

        {/* 6th from bottom: Save / Watch Later (tap=save, long-press=gallery) */}
        <div
          onTouchStart={handleSaveTouchStart}
          onTouchEnd={handleSaveTouchEnd}
          onTouchCancel={clearSaveTimer}
          onMouseDown={handleSaveMouseDown}
          onMouseUp={handleSaveMouseUp}
          onMouseLeave={handleSaveMouseUp}
        >
          <NeuButton
            onClick={handleSaveClick}
            variant={isVideoSaved ? 'accent' : 'default'}
            tooltip={isVideoSaved ? 'Saved' : 'Save'}
          >
            <Bookmark className={cn('w-4 h-4', isVideoSaved && 'fill-current text-primary')} />
          </NeuButton>
        </div>

        {/* 7th from bottom: Share */}
        <LongPressButtonWrapper buttonId="share-button" buttonLabel="Share">
          <NeuButton onClick={onShareClick} tooltip="Share">
            <Share2 className="w-4 h-4" />
          </NeuButton>
        </LongPressButtonWrapper>

        {/* 7th from bottom: Profile Preview Sheet */}
        <Sheet open={profileSheetOpen} onOpenChange={setProfileSheetOpen}>
          <SheetTrigger asChild>
            <div>
              <LongPressButtonWrapper buttonId="profile-preview-button" buttonLabel="Profile Preview">
                <NeuButton tooltip="Profile Preview">
                  <User className="w-4 h-4" />
                </NeuButton>
              </LongPressButtonWrapper>
            </div>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[25vh] rounded-t-3xl pb-[env(safe-area-inset-bottom,0px)]">
            <ProfilePreviewSheet 
              onFullProfileClick={handleFullProfileClick}
              onAchievementsClick={() => {
                setProfileSheetOpen(false);
                onAchievementsClick?.();
              }}
              onWalletClick={() => {
                setProfileSheetOpen(false);
                onWalletClick?.();
              }}
              creatorInfo={creatorInfo}
            />
          </SheetContent>
        </Sheet>

        {/* 8th from bottom: Remote Control with settings engine icon */}
        <div className="relative">
          <LongPressButtonWrapper buttonId="remote-control-button" buttonLabel="Remote Control">
            <NeuButton 
              onClick={handleRemoteControlToggle}
              variant={remoteControlEnabled ? 'accent' : 'default'}
              tooltip="Remote Control"
            >
              <Radio className={cn("w-4 h-4 transition-all", remoteControlEnabled && "animate-pulse")} />
            </NeuButton>
          </LongPressButtonWrapper>
          
          {/* Engine settings icon - appears after clicking */}
          {remoteControlEnabled && (
            <button
              onClick={() => setShowRemoteSettings(true)}
              className="absolute -top-2 -right-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center shadow-lg animate-fade-in hover:scale-110 transition-transform"
            >
              <Cog className="w-3 h-3 text-primary-foreground" />
            </button>
          )}
        </div>

        {/* Visibility Toggle */}
        <VisibilityToggleButton />
      </div>
      
      {/* Remote Control Component */}
      <BlinkRemoteControl
        enabled={remoteControlEnabled}
        onToggle={setRemoteControlEnabled}
        onNavigate={(action, direction) => {
          console.log('[FloatingControls] Remote Control navigation:', action, direction);
          window.dispatchEvent(new CustomEvent('gazeNavigate', { detail: { action, direction } }));
        }}
        onComboAction={(action, combo) => {
          console.log('[FloatingControls] Combo action:', action, combo.name);
          onComboAction?.(action);
        }}
        showSettings={showRemoteSettings}
        onCloseSettings={() => setShowRemoteSettings(false)}
        className="left-4 top-20"
      />

      {/* Target Overlay - rendered when remote control is active */}
      <TargetOverlay
        enabled={remoteControlEnabled}
        onTargetAction={(command) => {
          console.log('[FloatingControls] Target action:', command);
          onComboAction?.(command);
        }}
      />
    </>
  );
};

// Quick toggle button component
export const QuickVisibilityToggle: React.FC = () => {
  const [isHidden, setIsHidden] = useState(() => getButtonsHidden());
  const [isAnimating, setIsAnimating] = useState(false);
  
  const toggleVisibility = () => {
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);
    
    const newValue = !isHidden;
    setIsHidden(newValue);
    setButtonsHidden(newValue);
    window.dispatchEvent(new Event('storage'));
  };

  return (
    <button
      onClick={toggleVisibility}
      className={cn(
        'fixed left-3 top-[50%] -translate-y-1/2 z-50',
        'w-8 h-8 rounded-full',
        'flex items-center justify-center',
        'transition-all duration-300',
        'backdrop-blur-md border',
        'active:scale-90',
        isAnimating && 'scale-110',
        isHidden 
          ? 'bg-primary/20 border-primary/40 text-primary shadow-[0_0_20px_hsl(var(--primary)/0.4)]'
          : 'bg-muted/30 border-border/40 text-muted-foreground hover:bg-muted/50'
      )}
      title={isHidden ? 'Show buttons (or double-tap screen)' : 'Hide buttons (or double-tap screen)'}
    >
      <span className={cn('transition-all duration-300', isAnimating && 'rotate-180 scale-110')}>
        {isHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
      </span>
    </button>
  );
};

// Multi-tap gesture detector
interface GestureDetectorProps {
  children: React.ReactNode;
  onTripleTap?: () => void;
}

export const DoubleTapGestureDetector: React.FC<GestureDetectorProps> = ({ children, onTripleTap }) => {
  const tapTimesRef = useRef<number[]>([]);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const handleTap = useCallback((e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('a') ||
      target.closest('input') ||
      target.closest('[role="button"]') ||
      target.closest('[data-draggable]')
    ) {
      return;
    }
    
    const now = Date.now();
    tapTimesRef.current = tapTimesRef.current.filter(t => now - t < 500);
    tapTimesRef.current.push(now);
    
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
    }
    
    tapTimeoutRef.current = setTimeout(() => {
      const recentTaps = tapTimesRef.current.filter(t => now - t < 500);
      
      if (recentTaps.length >= 3) {
        onTripleTap?.();
        tapTimesRef.current = [];
      } else if (recentTaps.length === 2) {
        const currentHidden = getButtonsHidden();
        setButtonsHidden(!currentHidden);
        window.dispatchEvent(new Event('storage'));
        tapTimesRef.current = [];
      }
    }, 100);
    
    e.preventDefault();
  }, [onTripleTap]);

  return (
    <div onPointerDown={handleTap} className="contents">
      {children}
    </div>
  );
};
