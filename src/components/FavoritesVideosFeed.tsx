/**
 * Explore feed – 10 NATURE mockup videos. Infinite loop.
 */
import React, { useState, useRef, useEffect } from 'react';
import { Play } from 'lucide-react';
import { EXPLORE_VIDEOS } from '@/lib/mockupVideos';
import { cn } from '@/lib/utils';

const NATURE_TITLES = [
  'Forest Trail',
  'Ocean Waves',
  'Mountain Peak',
  'Desert Sunset',
  'River Flow',
  'Aurora Borealis',
  'Tropical Rainforest',
  'Alpine Meadow',
  'Coastal Cliffs',
  'Starry Night',
];

const LEN = EXPLORE_VIDEOS.length;

export const FavoritesVideosFeed: React.FC<{
  isActive?: boolean;
  className?: string;
}> = ({ isActive = true, className }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const touchStartY = useRef(0);
  const touchEndY = useRef(0);

  const currentVideo = EXPLORE_VIDEOS[currentIndex % LEN];
  const currentTitle = NATURE_TITLES[currentIndex % LEN] ?? `Nature #${(currentIndex % LEN) + 1}`;

  const goNext = () => {
    setCurrentIndex((i) => (i + 1) % LEN);
  };

  const goPrev = () => {
    setCurrentIndex((i) => (i - 1 + LEN) % LEN);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = () => {
    const diff = touchStartY.current - touchEndY.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) goNext();
      else goPrev();
    }
    touchStartY.current = 0;
    touchEndY.current = 0;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (Math.abs(e.deltaY) > 30) {
      if (e.deltaY > 0) goNext();
      else goPrev();
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isActive) return;
    if (isPlaying) video.play().catch(() => {});
    else video.pause();
  }, [currentIndex, isPlaying, isActive]);

  return (
    <div
      className={cn('flex flex-col h-full overflow-hidden', className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
    >
      <div className="flex-shrink-0 px-4 py-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Explore</h2>
        <span className="text-sm text-muted-foreground">
          {(currentIndex % LEN) + 1} / {LEN}
        </span>
      </div>
      <div className="flex-1 relative min-h-0">
        <div className="absolute inset-0 flex flex-col">
          <div className="flex-1 relative bg-black rounded-xl overflow-hidden">
            <video
              ref={videoRef}
              src={currentVideo}
              className="w-full h-full object-cover"
              muted={false}
              playsInline
              loop={false}
              onEnded={goNext}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-4">
              <p className="text-white font-medium drop-shadow-lg">{currentTitle}</p>
            </div>
            <button
              onClick={() => setIsPlaying((p) => !p)}
              className="absolute inset-0 flex items-center justify-center"
            >
              {!isPlaying && (
                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center backdrop-blur">
                  <Play className="w-8 h-8 text-white ml-1" fill="white" />
                </div>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
