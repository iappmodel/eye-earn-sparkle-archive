import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { Wallet, User, Heart, MessageCircle, Share2, Settings, UserPlus } from 'lucide-react';
import { NeuButton } from './NeuButton';
import { cn } from '@/lib/utils';

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
  const [hideTimer, setHideTimer] = useState<NodeJS.Timeout | null>(null);

  const showControls = useCallback(() => {
    setIsVisible(true);
    if (hideTimer) clearTimeout(hideTimer);
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, autoHideDelay);
    setHideTimer(timer);
  }, [hideTimer, autoHideDelay]);

  useEffect(() => {
    showControls();
    return () => {
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, []);

  return (
    <ControlsVisibilityContext.Provider value={{ isVisible, showControls }}>
      {/* Invisible tap area to show controls */}
      <div 
        className="fixed inset-0 z-30"
        onClick={showControls}
      />
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
  isLiked?: boolean;
  isFollowing?: boolean;
  likeCount?: number;
  commentCount?: number;
  creatorName?: string;
}

export const FloatingControls: React.FC<FloatingControlsProps> = ({
  onWalletClick,
  onProfileClick,
  onLikeClick,
  onCommentClick,
  onShareClick,
  onSettingsClick,
  onFollowClick,
  isLiked = false,
  isFollowing = false,
  likeCount = 0,
  commentCount = 0,
  creatorName,
}) => {
  const { isVisible } = useControlsVisibility();

  // Format large numbers
  const formatCount = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <>
      {/* Right side 3D button stack - thumb zone optimized */}
      <div className={cn(
        'fixed right-4 top-1/2 -translate-y-1/2 z-40',
        'flex flex-col items-center gap-4',
        'transition-all duration-500 ease-out',
        isVisible 
          ? 'opacity-100 translate-x-0' 
          : 'opacity-0 translate-x-12 pointer-events-none'
      )}>
        {/* Like button with count */}
        <div className="flex flex-col items-center gap-1">
          <NeuButton 
            onClick={onLikeClick} 
            variant={isLiked ? 'accent' : 'default'}
            isPressed={isLiked}
            tooltip={isLiked ? 'Unlike' : 'Like this content'}
            size="md"
          >
            <Heart className={cn(
              'transition-all duration-200',
              isLiked && 'fill-current text-primary animate-scale-in'
            )} />
          </NeuButton>
          <span className="text-xs font-medium text-foreground/70">{formatCount(likeCount)}</span>
        </div>

        {/* Comment button with count */}
        <div className="flex flex-col items-center gap-1">
          <NeuButton 
            onClick={onCommentClick}
            tooltip="View comments"
            size="md"
          >
            <MessageCircle />
          </NeuButton>
          <span className="text-xs font-medium text-foreground/70">{formatCount(commentCount)}</span>
        </div>

        {/* Share button */}
        <NeuButton 
          onClick={onShareClick}
          tooltip="Share"
          size="md"
        >
          <Share2 />
        </NeuButton>

        {/* Follow button - only if creator exists */}
        {onFollowClick && (
          <NeuButton 
            onClick={onFollowClick}
            variant={isFollowing ? 'accent' : 'default'}
            isPressed={isFollowing}
            tooltip={isFollowing ? 'Following' : `Follow ${creatorName || 'creator'}`}
            size="md"
          >
            <UserPlus className={cn(
              'transition-all duration-200',
              isFollowing && 'text-primary'
            )} />
          </NeuButton>
        )}

        {/* Separator line */}
        <div className="w-10 h-px bg-gradient-to-r from-transparent via-border to-transparent my-1" />

        {/* Secondary actions - Wallet, Profile, Settings */}
        <NeuButton 
          onClick={onWalletClick} 
          variant="accent"
          tooltip="Your wallet"
          size="md"
        >
          <Wallet />
        </NeuButton>

        <NeuButton 
          onClick={onProfileClick}
          tooltip="Your profile"
          size="md"
        >
          <User />
        </NeuButton>

        <NeuButton 
          onClick={onSettingsClick}
          tooltip="Settings"
          size="md"
        >
          <Settings />
        </NeuButton>
      </div>
    </>
  );
};
