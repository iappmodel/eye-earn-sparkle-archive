import React, { useState } from 'react';
import { 
  MessageCircle, 
  Share2, 
  Bookmark, 
  Flag, 
  UserPlus, 
  MoreHorizontal,
  Volume2,
  VolumeX,
  Play,
  Pause,
  X,
  Trophy
} from 'lucide-react';
import { NeuButton } from './NeuButton';
import { MorphingLikeButton } from './MorphingLikeButton';
import { cn } from '@/lib/utils';

interface MediaInteractionButtonsProps {
  // State props
  isLiked?: boolean;
  isSaved?: boolean;
  isFollowing?: boolean;
  isMuted?: boolean;
  isPlaying?: boolean;
  isFullscreen?: boolean;
  
  // Counts
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  
  // Callbacks
  onLike?: () => void;
  onTip?: (coinType: 'vicoin' | 'icoin', amount: number) => void;
  onComment?: () => void;
  onShare?: () => void;
  onSave?: () => void;
  onReport?: () => void;
  onFollow?: () => void;
  onMore?: () => void;
  onToggleMute?: () => void;
  onTogglePlay?: () => void;
  onExitFullscreen?: () => void;
  onAchievements?: () => void;
  
  // Display options
  showVolumeControl?: boolean;
  showPlayControl?: boolean;
  showFullscreenExit?: boolean;
  showAchievements?: boolean;
  achievementsCount?: number;
  variant?: 'sidebar' | 'overlay';
  className?: string;
}

export const MediaInteractionButtons: React.FC<MediaInteractionButtonsProps> = ({
  isLiked = false,
  isSaved = false,
  isFollowing = false,
  isMuted = false,
  isPlaying = true,
  isFullscreen = false,
  likeCount = 0,
  commentCount = 0,
  shareCount = 0,
  onLike,
  onTip,
  onComment,
  onShare,
  onSave,
  onReport,
  onFollow,
  onMore,
  onToggleMute,
  onTogglePlay,
  onExitFullscreen,
  onAchievements,
  showVolumeControl = true,
  showPlayControl = false,
  showFullscreenExit = false,
  showAchievements = false,
  achievementsCount = 0,
  variant = 'sidebar',
  className,
}) => {
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const formatCount = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  if (variant === 'overlay') {
    return (
      <div className={cn('flex items-center gap-4', className)}>
        {/* Play/Pause */}
        {showPlayControl && (
          <button
            onClick={onTogglePlay}
            className="w-16 h-16 rounded-full bg-background/30 backdrop-blur-md flex items-center justify-center"
          >
            {isPlaying ? (
              <Pause className="w-8 h-8 text-foreground fill-current" />
            ) : (
              <Play className="w-8 h-8 text-foreground fill-current ml-1" />
            )}
          </button>
        )}
        
        {/* Volume */}
        {showVolumeControl && (
          <button
            onClick={onToggleMute}
            className="w-10 h-10 rounded-full bg-background/30 backdrop-blur-md flex items-center justify-center"
          >
            {isMuted ? (
              <VolumeX className="w-5 h-5 text-foreground" />
            ) : (
              <Volume2 className="w-5 h-5 text-foreground" />
            )}
          </button>
        )}

        {/* Exit Fullscreen */}
        {showFullscreenExit && (
          <button
            onClick={onExitFullscreen}
            className="w-10 h-10 rounded-full bg-background/30 backdrop-blur-md flex items-center justify-center"
          >
            <X className="w-5 h-5 text-foreground" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Like with Morphing Tip Feature */}
      <MorphingLikeButton
        isLiked={isLiked}
        likeCount={likeCount}
        onLike={onLike}
        onTip={onTip}
      />

      {/* Comment */}
      <div className="flex flex-col items-center gap-1">
        <NeuButton onClick={onComment}>
          <MessageCircle className="w-6 h-6" />
        </NeuButton>
        <span className="text-xs text-muted-foreground">{formatCount(commentCount)}</span>
      </div>

      {/* Share */}
      <div className="flex flex-col items-center gap-1">
        <NeuButton onClick={onShare}>
          <Share2 className="w-6 h-6" />
        </NeuButton>
        {shareCount > 0 && (
          <span className="text-xs text-muted-foreground">{formatCount(shareCount)}</span>
        )}
      </div>

      {/* Save/Bookmark */}
      <NeuButton 
        onClick={onSave}
        variant={isSaved ? 'accent' : 'default'}
        isPressed={isSaved}
      >
        <Bookmark className={cn('w-6 h-6', isSaved && 'fill-current')} />
      </NeuButton>

      {/* Achievements */}
      {showAchievements && (
        <div className="relative">
          <NeuButton onClick={onAchievements}>
            <Trophy className="w-6 h-6 text-amber-500" />
          </NeuButton>
          {achievementsCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-[8px] font-bold text-black flex items-center justify-center">
              {achievementsCount}
            </span>
          )}
        </div>
      )}

      {/* Follow */}
      <NeuButton 
        onClick={onFollow}
        variant={isFollowing ? 'accent' : 'default'}
        isPressed={isFollowing}
      >
        <UserPlus className={cn('w-6 h-6', isFollowing && 'text-primary')} />
      </NeuButton>

      {/* More Options */}
      <div className="relative">
        <NeuButton onClick={() => setShowMoreMenu(!showMoreMenu)}>
          <MoreHorizontal className="w-6 h-6" />
        </NeuButton>
        
        {showMoreMenu && (
          <div className="absolute right-full mr-2 top-0 neu-card rounded-2xl p-2 min-w-[140px] animate-scale-in">
            <button 
              onClick={() => { onReport?.(); setShowMoreMenu(false); }}
              className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-secondary/50 text-left"
            >
              <Flag className="w-4 h-4 text-destructive" />
              <span className="text-sm">Report</span>
            </button>
            <button 
              onClick={() => { onMore?.(); setShowMoreMenu(false); }}
              className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-secondary/50 text-left"
            >
              <MoreHorizontal className="w-4 h-4" />
              <span className="text-sm">View Info</span>
            </button>
          </div>
        )}
      </div>

      {/* Volume Control */}
      {showVolumeControl && (
        <NeuButton onClick={onToggleMute}>
          {isMuted ? (
            <VolumeX className="w-6 h-6" />
          ) : (
            <Volume2 className="w-6 h-6" />
          )}
        </NeuButton>
      )}
    </div>
  );
};
