// Friends Posts Feed Component - Left swipe screen
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Heart, MessageCircle, Share2, User, Play, Pause, Volume2, VolumeX, Bookmark, UserPlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Neu3DButton, VideoTheme } from '@/components/ui/Neu3DButton';
import { GlassText } from '@/components/ui/GlassText';

interface FriendPost {
  id: string;
  userId: string;
  username: string;
  avatar: string;
  videoUrl: string;
  thumbnail: string;
  caption: string;
  likes: number;
  comments: number;
  duration: number;
  isLiked: boolean;
  isSaved: boolean;
  theme: VideoTheme;
}

const mockFriendsPosts: FriendPost[] = [
  {
    id: 'fp1',
    userId: 'u1',
    username: 'sarah_adventures',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
    videoUrl: 'https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?w=1080&h=1920&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1682687220742-aba13b6e50ba?w=1080&h=1920&fit=crop',
    caption: 'Amazing sunset views today! 🌅 #travel #adventure',
    likes: 234,
    comments: 18,
    duration: 12,
    isLiked: false,
    isSaved: false,
    theme: 'rose',
  },
  {
    id: 'fp2',
    userId: 'u2',
    username: 'mike_fitness',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
    videoUrl: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=1080&h=1920&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=1080&h=1920&fit=crop',
    caption: 'Morning workout routine 💪 Who else is up early?',
    likes: 567,
    comments: 42,
    duration: 15,
    isLiked: true,
    isSaved: false,
    theme: 'emerald',
  },
  {
    id: 'fp3',
    userId: 'u3',
    username: 'foodie_emma',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop',
    videoUrl: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1080&h=1920&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=1080&h=1920&fit=crop',
    caption: 'Made this homemade pizza from scratch 🍕✨',
    likes: 892,
    comments: 67,
    duration: 10,
    isLiked: false,
    isSaved: true,
    theme: 'gold',
  },
  {
    id: 'fp4',
    userId: 'u4',
    username: 'travel_alex',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop',
    videoUrl: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1080&h=1920&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1080&h=1920&fit=crop',
    caption: 'Lake views in Switzerland 🇨🇭 Absolutely breathtaking!',
    likes: 1200,
    comments: 89,
    duration: 8,
    isLiked: false,
    isSaved: false,
    theme: 'cyan',
  },
];

// Theme-specific gradient overlays
const themeOverlays: Record<VideoTheme, string> = {
  purple: 'from-[hsl(270,95%,5%,0.3)] via-transparent to-[hsl(270,95%,5%,0.7)]',
  magenta: 'from-[hsl(320,90%,5%,0.3)] via-transparent to-[hsl(320,90%,5%,0.7)]',
  cyan: 'from-[hsl(185,100%,5%,0.3)] via-transparent to-[hsl(185,100%,5%,0.7)]',
  gold: 'from-[hsl(45,100%,5%,0.3)] via-transparent to-[hsl(45,100%,5%,0.7)]',
  emerald: 'from-[hsl(160,84%,5%,0.3)] via-transparent to-[hsl(160,84%,5%,0.7)]',
  rose: 'from-[hsl(350,89%,5%,0.3)] via-transparent to-[hsl(350,89%,5%,0.7)]',
};

const themeProgressBars: Record<VideoTheme, string> = {
  purple: 'bg-[hsl(270,95%,65%)]',
  magenta: 'bg-[hsl(320,90%,60%)]',
  cyan: 'bg-[hsl(185,100%,50%)]',
  gold: 'bg-[hsl(45,100%,55%)]',
  emerald: 'bg-[hsl(160,84%,39%)]',
  rose: 'bg-[hsl(350,89%,60%)]',
};

interface FriendsPostsFeedProps {
  isActive: boolean;
  onSwipeRight?: () => void;
}

export const FriendsPostsFeed: React.FC<FriendsPostsFeedProps> = ({ isActive, onSwipeRight }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [posts, setPosts] = useState(mockFriendsPosts);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  const currentPost = posts[currentIndex];
  const currentTheme = currentPost.theme;

  // Simulate video playback progress
  useEffect(() => {
    if (isActive && isPlaying && currentPost) {
      const duration = currentPost.duration * 1000;
      const startTime = Date.now();
      
      progressInterval.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const newProgress = Math.min((elapsed / duration) * 100, 100);
        setProgress(newProgress);
        
        if (newProgress >= 100) {
          clearInterval(progressInterval.current!);
          setTimeout(() => {
            setCurrentIndex((prev) => (prev + 1) % posts.length);
            setProgress(0);
          }, 300);
        }
      }, 50);

      return () => {
        if (progressInterval.current) {
          clearInterval(progressInterval.current);
        }
      };
    }
  }, [isActive, isPlaying, currentIndex, currentPost, posts.length]);

  // Reset progress when changing posts
  useEffect(() => {
    setProgress(0);
  }, [currentIndex]);

  const handleLike = useCallback(() => {
    setPosts((prev) =>
      prev.map((post, idx) =>
        idx === currentIndex
          ? { ...post, isLiked: !post.isLiked, likes: post.isLiked ? post.likes - 1 : post.likes + 1 }
          : post
      )
    );
    if (navigator.vibrate) navigator.vibrate(10);
  }, [currentIndex]);

  const handleSave = useCallback(() => {
    setPosts((prev) =>
      prev.map((post, idx) =>
        idx === currentIndex
          ? { ...post, isSaved: !post.isSaved }
          : post
      )
    );
    if (navigator.vibrate) navigator.vibrate(10);
  }, [currentIndex]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const navigateVertical = (direction: 'up' | 'down') => {
    if (direction === 'up') {
      setCurrentIndex((prev) => (prev + 1) % posts.length);
    } else {
      setCurrentIndex((prev) => (prev - 1 + posts.length) % posts.length);
    }
    setProgress(0);
  };

  const formatCount = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <div className="h-full w-full bg-background relative overflow-hidden">
      {/* Video/Image Background */}
      <div className="absolute inset-0">
        <img
          src={currentPost.thumbnail}
          alt={currentPost.caption}
          className="w-full h-full object-cover"
        />
        <div className={cn(
          'absolute inset-0 bg-gradient-to-b',
          themeOverlays[currentTheme]
        )} />
      </div>

      {/* Progress Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 px-2 pt-2">
        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-100 ease-linear',
              themeProgressBars[currentTheme],
              'shadow-[0_0_10px_currentColor]'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Header - User Info */}
      <div className="absolute top-8 left-0 right-0 z-10 px-4">
        <div className="flex items-center gap-3 glass-neon rounded-2xl p-3">
          <div className={cn(
            'w-11 h-11 rounded-full overflow-hidden border-2',
            'border-white/30 shadow-[0_0_15px_hsl(var(--primary)/0.3)]'
          )}>
            <img src={currentPost.avatar} alt={currentPost.username} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1">
            <GlassText theme={currentTheme} variant="3d" size="md" as="p">
              {currentPost.username}
            </GlassText>
            <p className="text-white/60 text-xs font-medium">Following</p>
          </div>
          <button className={cn(
            'px-4 py-2 rounded-xl font-display font-semibold text-sm',
            'glass-neon border border-white/20',
            'hover:border-white/40 transition-all'
          )}>
            <GlassText theme={currentTheme} variant="glow" size="sm">
              Follow
            </GlassText>
          </button>
        </div>
      </div>

      {/* Center play/pause overlay */}
      <button
        onClick={handlePlayPause}
        className="absolute inset-0 z-10 flex items-center justify-center"
      >
        {!isPlaying && (
          <div className={cn(
            'w-20 h-20 rounded-full flex items-center justify-center',
            'glass-neon backdrop-blur-xl',
            'shadow-[0_0_40px_hsl(var(--primary)/0.4)]',
            'animate-pulse-3d'
          )}>
            <Play className="w-10 h-10 text-white ml-1 drop-shadow-lg" fill="white" />
          </div>
        )}
      </button>

      {/* Left Side Controls - Video controls */}
      <div className="absolute left-4 bottom-36 z-20 flex flex-col items-center gap-4">
        <Neu3DButton 
          onClick={handlePlayPause}
          theme={currentTheme}
          variant="glass"
        >
          {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
        </Neu3DButton>

        <Neu3DButton 
          onClick={() => setIsMuted(!isMuted)}
          theme={currentTheme}
          variant="glass"
        >
          {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
        </Neu3DButton>
      </div>

      {/* Right Side Actions - Social buttons */}
      <div className="absolute right-4 bottom-36 z-20 flex flex-col items-center gap-4">
        <Neu3DButton 
          onClick={handleLike}
          theme={currentPost.isLiked ? 'rose' : currentTheme}
          variant={currentPost.isLiked ? 'neon' : 'glass'}
          isPressed={currentPost.isLiked}
          count={formatCount(currentPost.likes)}
        >
          <Heart className={cn('w-6 h-6', currentPost.isLiked && 'fill-current')} />
        </Neu3DButton>

        <Neu3DButton 
          theme={currentTheme}
          variant="glass"
          count={formatCount(currentPost.comments)}
        >
          <MessageCircle className="w-6 h-6" />
        </Neu3DButton>

        <Neu3DButton 
          theme={currentTheme}
          variant="glass"
          label="Share"
        >
          <Share2 className="w-6 h-6" />
        </Neu3DButton>

        <Neu3DButton 
          onClick={handleSave}
          theme={currentPost.isSaved ? 'gold' : currentTheme}
          variant={currentPost.isSaved ? 'neon' : 'glass'}
          isPressed={currentPost.isSaved}
        >
          <Bookmark className={cn('w-6 h-6', currentPost.isSaved && 'fill-current')} />
        </Neu3DButton>
      </div>

      {/* Bottom Caption */}
      <div className="absolute bottom-20 left-0 right-20 z-10 px-4">
        <p className="text-white text-sm leading-relaxed font-medium drop-shadow-lg">
          {currentPost.caption}
        </p>
      </div>

      {/* Swipe hint */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
        <p className="text-white/40 text-xs font-medium">Swipe right for main feed →</p>
      </div>

      {/* Vertical navigation touch areas */}
      <div
        className="absolute top-0 left-0 right-0 h-1/3 z-5"
        onClick={() => navigateVertical('down')}
      />
      <div
        className="absolute bottom-0 left-0 right-0 h-1/3 z-5"
        onClick={() => navigateVertical('up')}
      />
    </div>
  );
};
