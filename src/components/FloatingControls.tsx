import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { Wallet, User, Heart, MessageCircle, Share2, Settings } from 'lucide-react';
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
  isLiked?: boolean;
  likeCount?: number;
  commentCount?: number;
}

export const FloatingControls: React.FC<FloatingControlsProps> = ({
  onWalletClick,
  onProfileClick,
  onLikeClick,
  onCommentClick,
  onShareClick,
  onSettingsClick,
  isLiked = false,
  likeCount = 0,
  commentCount = 0,
}) => {
  const { isVisible } = useControlsVisibility();

  return (
    <>
      {/* Right side controls - Likes, Comments, Share + Wallet, Profile, Settings below */}
      <div className={cn(
        'fixed right-4 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-3 transition-all duration-300',
        isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8 pointer-events-none'
      )}>
        {/* Media interaction buttons */}
        <div className="flex flex-col items-center gap-1">
          <NeuButton 
            onClick={onLikeClick} 
            variant={isLiked ? 'accent' : 'default'}
            isPressed={isLiked}
          >
            <Heart className={cn('w-6 h-6', isLiked && 'fill-current')} />
          </NeuButton>
          <span className="text-xs text-muted-foreground">{likeCount}</span>
        </div>

        <div className="flex flex-col items-center gap-1">
          <NeuButton onClick={onCommentClick}>
            <MessageCircle className="w-6 h-6" />
          </NeuButton>
          <span className="text-xs text-muted-foreground">{commentCount}</span>
        </div>

        <NeuButton onClick={onShareClick}>
          <Share2 className="w-6 h-6" />
        </NeuButton>

        {/* Separator */}
        <div className="w-8 h-px bg-border/50 my-1 self-center" />

        {/* Wallet, Profile, Settings - underneath */}
        <NeuButton onClick={onWalletClick} variant="accent">
          <Wallet className="w-6 h-6" />
        </NeuButton>

        <NeuButton onClick={onProfileClick}>
          <User className="w-6 h-6" />
        </NeuButton>

        <NeuButton onClick={onSettingsClick}>
          <Settings className="w-6 h-6" />
        </NeuButton>
      </div>
    </>
  );
};
