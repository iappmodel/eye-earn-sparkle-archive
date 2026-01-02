import React, { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Heart, Send, MoreHorizontal } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface StoryItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  duration?: number;
  createdAt: string;
}

interface Story {
  id: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  items: StoryItem[];
  hasUnviewed: boolean;
}

interface StoryViewerProps {
  story: Story;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
  hasNext: boolean;
  hasPrev: boolean;
}

export const StoryViewer: React.FC<StoryViewerProps> = ({
  story,
  onClose,
  onNext,
  onPrev,
  hasNext,
  hasPrev,
}) => {
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [reply, setReply] = useState('');

  const currentItem = story.items[currentItemIndex];
  const duration = currentItem.duration || 5000;

  const goToNextItem = useCallback(() => {
    if (currentItemIndex < story.items.length - 1) {
      setCurrentItemIndex(prev => prev + 1);
      setProgress(0);
    } else if (hasNext) {
      onNext();
      setCurrentItemIndex(0);
      setProgress(0);
    } else {
      onClose();
    }
  }, [currentItemIndex, story.items.length, hasNext, onNext, onClose]);

  const goToPrevItem = useCallback(() => {
    if (currentItemIndex > 0) {
      setCurrentItemIndex(prev => prev - 1);
      setProgress(0);
    } else if (hasPrev) {
      onPrev();
      setCurrentItemIndex(0);
      setProgress(0);
    }
  }, [currentItemIndex, hasPrev, onPrev]);

  // Progress timer
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          goToNextItem();
          return 0;
        }
        return prev + (100 / (duration / 100));
      });
    }, 100);

    return () => clearInterval(interval);
  }, [duration, isPaused, goToNextItem]);

  // Reset on story change
  useEffect(() => {
    setCurrentItemIndex(0);
    setProgress(0);
  }, [story.id]);

  const handleTouchStart = () => setIsPaused(true);
  const handleTouchEnd = () => setIsPaused(false);

  const handleTap = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const third = rect.width / 3;

    if (x < third) {
      goToPrevItem();
    } else if (x > third * 2) {
      goToNextItem();
    }
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-md max-h-[25vh] overflow-hidden rounded-2xl border border-border/50 bg-background shadow-xl">
      <div className="absolute top-2 left-2 right-2 flex gap-1 z-10">
        {story.items.map((_, index) => (
          <div key={index} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-100"
              style={{
                width: index < currentItemIndex ? '100%' : index === currentItemIndex ? `${progress}%` : '0%'
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="absolute top-6 left-0 right-0 flex items-center justify-between px-4 z-10">
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10 border-2 border-white">
            <AvatarImage src={story.avatarUrl} />
            <AvatarFallback>{story.username.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-white font-semibold text-sm">{story.username}</p>
            <p className="text-white/60 text-xs">
              {formatDistanceToNow(new Date(currentItem.createdAt), { addSuffix: true })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="text-white">
            <MoreHorizontal className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-white">
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        onClick={handleTap}
        onMouseDown={handleTouchStart}
        onMouseUp={handleTouchEnd}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {currentItem.type === 'image' ? (
          <img
            src={currentItem.url}
            alt="Story"
            className="w-full h-full object-cover"
          />
        ) : (
          <video
            src={currentItem.url}
            className="w-full h-full object-cover"
            autoPlay
            muted
            playsInline
          />
        )}
      </div>

      {/* Navigation Arrows */}
      {hasPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); goToPrevItem(); }}
          className="absolute left-2 top-1/2 -translate-y-1/2 p-2 text-white/60 hover:text-white z-10"
        >
          <ChevronLeft className="w-8 h-8" />
        </button>
      )}
      {hasNext && (
        <button
          onClick={(e) => { e.stopPropagation(); goToNextItem(); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-white/60 hover:text-white z-10"
        >
          <ChevronRight className="w-8 h-8" />
        </button>
      )}

      {/* Reply Bar */}
      <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3 z-10">
        <Input
          placeholder="Send a reply..."
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/50"
        />
        <Button variant="ghost" size="icon" className="text-white">
          <Heart className="w-6 h-6" />
        </Button>
        <Button variant="ghost" size="icon" className="text-white">
          <Send className="w-6 h-6" />
        </Button>
      </div>
    </div>
  );
};
