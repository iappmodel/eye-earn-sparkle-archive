// Friends Posts Feed Component - Left swipe screen
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Heart, MessageCircle, Share2, User, Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

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
  },
  {
    id: 'fp4',
    userId: 'u4',
    username: 'travel_alex',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop',
    videoUrl: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1080&h=1920&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1080&h=1920&fit=crop',
    caption: 'Lake views in Switzerland 🇨🇭 Absolutely breathtaking!',
    likes: 1.2,
    comments: 89,
    duration: 8,
    isLiked: false,
  },
];

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
          // Auto-advance to next video
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

  return (
    <div className="h-full w-full bg-background relative">
      {/* Video/Image Background */}
      <div className="absolute inset-0">
        <img
          src={currentPost.thumbnail}
          alt={currentPost.caption}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/60" />
      </div>

      {/* Progress Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 px-2 pt-2">
        <div className="h-1 bg-white/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-white transition-all duration-100 ease-linear rounded-full"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Header - User Info */}
      <div className="absolute top-6 left-0 right-0 z-10 px-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/50">
            <img src={currentPost.avatar} alt={currentPost.username} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1">
            <p className="text-white font-semibold text-sm">{currentPost.username}</p>
            <p className="text-white/70 text-xs">Following</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="bg-white/10 border-white/30 text-white hover:bg-white/20 backdrop-blur-sm"
          >
            Follow
          </Button>
        </div>
      </div>

      {/* Center play/pause overlay */}
      <button
        onClick={handlePlayPause}
        className="absolute inset-0 z-10 flex items-center justify-center"
      >
        {!isPlaying && (
          <div className="w-20 h-20 rounded-full bg-black/40 flex items-center justify-center backdrop-blur-sm">
            <Play className="w-10 h-10 text-white ml-1" fill="white" />
          </div>
        )}
      </button>

      {/* Left Side Controls */}
      <div className="absolute left-4 bottom-32 z-20 flex flex-col items-center gap-4">
        <button onClick={handlePlayPause} className="flex flex-col items-center gap-1">
          <div className="w-12 h-12 rounded-full bg-black/30 flex items-center justify-center backdrop-blur-sm">
            {isPlaying ? (
              <Pause className="w-7 h-7 text-white" />
            ) : (
              <Play className="w-7 h-7 text-white ml-0.5" />
            )}
          </div>
        </button>

        <button onClick={() => setIsMuted(!isMuted)} className="flex flex-col items-center gap-1">
          <div className="w-12 h-12 rounded-full bg-black/30 flex items-center justify-center backdrop-blur-sm">
            {isMuted ? (
              <VolumeX className="w-7 h-7 text-white" />
            ) : (
              <Volume2 className="w-7 h-7 text-white" />
            )}
          </div>
        </button>
      </div>

      {/* Right Side Actions */}
      <div className="absolute right-4 bottom-32 z-20 flex flex-col items-center gap-6">
        <button onClick={handleLike} className="flex flex-col items-center gap-1">
          <div
            className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-sm',
              currentPost.isLiked ? 'bg-red-500/20' : 'bg-black/30'
            )}
          >
            <Heart
              className={cn('w-7 h-7', currentPost.isLiked ? 'text-red-500 fill-red-500' : 'text-white')}
            />
          </div>
          <span className="text-white text-xs font-medium">{currentPost.likes}</span>
        </button>

        <button className="flex flex-col items-center gap-1">
          <div className="w-12 h-12 rounded-full bg-black/30 flex items-center justify-center backdrop-blur-sm">
            <MessageCircle className="w-7 h-7 text-white" />
          </div>
          <span className="text-white text-xs font-medium">{currentPost.comments}</span>
        </button>

        <button className="flex flex-col items-center gap-1">
          <div className="w-12 h-12 rounded-full bg-black/30 flex items-center justify-center backdrop-blur-sm">
            <Share2 className="w-7 h-7 text-white" />
          </div>
          <span className="text-white text-xs font-medium">Share</span>
        </button>
      </div>

      {/* Bottom Caption */}
      <div className="absolute bottom-20 left-0 right-20 z-10 px-4">
        <p className="text-white text-sm leading-relaxed">{currentPost.caption}</p>
      </div>

      {/* Swipe hint */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
        <p className="text-white/50 text-xs">Swipe right for main feed →</p>
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
