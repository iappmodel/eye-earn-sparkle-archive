import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { Wallet, User, MessageCircle, Share2, Settings, UserPlus, Heart, Bookmark, Flag, VolumeX, Coins } from 'lucide-react';
import { NeuButton } from './NeuButton';
import { MorphingLikeButton } from './MorphingLikeButton';
import { cn } from '@/lib/utils';
import { useUICustomization, ButtonAction, ButtonPosition } from '@/contexts/UICustomizationContext';

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

interface ControlsVisibilityProviderProps {
  children: React.ReactNode;
  autoHideDelay?: number;
}

export const ControlsVisibilityProvider: React.FC<ControlsVisibilityProviderProps> = ({
  children,
  autoHideDelay = 3000,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const hideTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const showControls = useCallback(() => {
    setIsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setIsVisible(false);
    }, autoHideDelay);
  }, [autoHideDelay]);

  useEffect(() => {
    showControls();

    // Don't use a full-screen overlay (it blocks clicks). Instead, listen globally.
    const onUserActivity = () => showControls();

    window.addEventListener('pointerdown', onUserActivity, { passive: true });
    window.addEventListener('keydown', onUserActivity);

    return () => {
      window.removeEventListener('pointerdown', onUserActivity);
      window.removeEventListener('keydown', onUserActivity);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [showControls]);

  return (
    <ControlsVisibilityContext.Provider value={{ isVisible, showControls }}>
      {children}
    </ControlsVisibilityContext.Provider>
  );
};

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
  isLiked?: boolean;
  isFollowing?: boolean;
  isSaved?: boolean;
  likeCount?: number;
  commentCount?: number;
  creatorName?: string;
}

// Icon mapping for button actions
const actionIcons: Record<ButtonAction, React.ReactNode> = {
  like: <Heart />,
  comment: <MessageCircle />,
  share: <Share2 />,
  follow: <UserPlus />,
  wallet: <Wallet />,
  profile: <User />,
  settings: <Settings />,
  tip: <Coins />,
  save: <Bookmark />,
  report: <Flag />,
  mute: <VolumeX />,
  none: null,
};

export const FloatingControls: React.FC<FloatingControlsProps> = ({
  onWalletClick,
  onProfileClick,
  onLikeClick,
  onCommentClick,
  onShareClick,
  onSettingsClick,
  onFollowClick,
  onTip,
  onSaveClick,
  onReportClick,
  onMuteClick,
  isLiked = false,
  isFollowing = false,
  isSaved = false,
  likeCount = 0,
  commentCount = 0,
  creatorName,
}) => {
  const { isVisible } = useControlsVisibility();
  const { getVisibleButtons, advancedSettings } = useUICustomization();
  
  const visibleButtons = getVisibleButtons();

  // Format large numbers
  const formatCount = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  // Action handlers mapping
  const actionHandlers: Record<ButtonAction, (() => void) | undefined> = {
    like: onLikeClick,
    comment: onCommentClick,
    share: onShareClick,
    follow: onFollowClick,
    wallet: onWalletClick,
    profile: onProfileClick,
    settings: onSettingsClick,
    tip: () => onTip?.('vicoin', 10),
    save: onSaveClick,
    report: onReportClick,
    mute: onMuteClick,
    none: undefined,
  };

  // Get button state (pressed/variant) based on action
  const getButtonState = (action: ButtonAction): { variant?: 'default' | 'accent' | 'gold'; isPressed?: boolean } => {
    switch (action) {
      case 'like':
        return { variant: isLiked ? 'accent' : 'default', isPressed: isLiked };
      case 'follow':
        return { variant: isFollowing ? 'accent' : 'default', isPressed: isFollowing };
      case 'save':
        return { variant: isSaved ? 'gold' : 'default', isPressed: isSaved };
      case 'wallet':
        return { variant: 'accent' };
      default:
        return {};
    }
  };

  // Get tooltip for action
  const getTooltip = (action: ButtonAction): string => {
    const tooltips: Record<ButtonAction, string> = {
      like: isLiked ? 'Unlike' : 'Like',
      comment: 'View comments',
      share: 'Share',
      follow: isFollowing ? 'Following' : `Follow ${creatorName || 'creator'}`,
      wallet: 'Your wallet',
      profile: 'Your profile',
      settings: 'Settings',
      tip: 'Send tip',
      save: isSaved ? 'Unsave' : 'Save',
      report: 'Report',
      mute: 'Mute',
      none: '',
    };
    return tooltips[action];
  };

  // Get count for action (if applicable)
  const getCount = (action: ButtonAction): number | null => {
    switch (action) {
      case 'like':
        return likeCount;
      case 'comment':
        return commentCount;
      default:
        return null;
    }
  };

  // Render a button based on its configuration
  const renderButton = (button: ButtonPosition) => {
    const { id, action, size } = button;
    const handler = actionHandlers[action];
    const icon = actionIcons[action];
    const state = getButtonState(action);
    const tooltip = getTooltip(action);
    const count = getCount(action);

    if (action === 'none' || !icon) return null;
    if (!handler) return null;

    // Special rendering for like button with morphing behavior
    if (action === 'like') {
      return (
        <MorphingLikeButton
          key={id}
          isLiked={isLiked}
          likeCount={likeCount}
          onLike={onLikeClick}
          onTip={onTip}
        />
      );
    }

    const buttonElement = (
      <NeuButton 
        key={id}
        onClick={handler}
        variant={state.variant}
        isPressed={state.isPressed}
        tooltip={tooltip}
        size={size}
      >
        {icon}
      </NeuButton>
    );

    // Wrap with count if applicable
    if (count !== null) {
      return (
        <div key={id} className="flex flex-col items-center gap-1">
          {buttonElement}
          <span 
            className="text-xs font-medium text-foreground/70"
            style={{ fontSize: `${Math.max(10, advancedSettings.fontSize - 2)}px` }}
          >
            {formatCount(count)}
          </span>
        </div>
      );
    }

    return buttonElement;
  };

  // Split buttons into primary and secondary groups
  const primaryActions: ButtonAction[] = ['like', 'comment', 'share', 'follow'];
  const secondaryActions: ButtonAction[] = ['wallet', 'profile', 'settings', 'tip', 'save', 'report', 'mute'];

  const primaryButtons = visibleButtons.filter(b => primaryActions.includes(b.action));
  const secondaryButtons = visibleButtons.filter(b => secondaryActions.includes(b.action));

  return (
    <>
      {/* Right side 3D button stack - thumb zone optimized */}
      <div 
        className={cn(
          'fixed right-4 top-1/2 -translate-y-1/2 z-40',
          'flex flex-col items-center',
          'transition-all duration-500 ease-out',
          isVisible 
            ? 'opacity-100 translate-x-0' 
            : 'opacity-0 translate-x-12 pointer-events-none'
        )}
        style={{ gap: `${advancedSettings.buttonSpacing}px` }}
      >
        {/* Primary action buttons */}
        {primaryButtons.map(renderButton)}

        {/* Separator - only show if we have both groups */}
        {primaryButtons.length > 0 && secondaryButtons.length > 0 && (
          <div className="w-10 h-px bg-gradient-to-r from-transparent via-border to-transparent my-1" />
        )}

        {/* Secondary action buttons */}
        {secondaryButtons.map(renderButton)}
      </div>
    </>
  );
};
