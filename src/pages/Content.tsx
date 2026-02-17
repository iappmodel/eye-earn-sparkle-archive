import React, { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Share2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MediaCard } from '@/components/MediaCard';
import { MediaCardSkeleton } from '@/components/ui/ContentSkeleton';
import { ShareSheet } from '@/components/ShareSheet';
import { useContentById } from '@/hooks/useMainFeed';
import { getProfileByUserId } from '@/services/profile.service';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/**
 * Full-page content view at /content/:id for share URLs.
 * Fetches from user_content or promotions and renders a full-screen MediaCard with back, share, and view profile.
 */
export default function Content() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { light } = useHapticFeedback();
  const { item, isLoading, error } = useContentById(id ?? null);
  const [showShare, setShowShare] = useState(false);

  const handleBack = useCallback(() => {
    light();
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  }, [navigate, light]);

  const handleShare = useCallback(() => {
    light();
    setShowShare(true);
  }, [light]);

  const handleViewProfile = useCallback(async () => {
    const creator = item?.creator;
    if (!creator) return;
    light();
    const username =
      creator.username ?? (creator.id ? (await getProfileByUserId(creator.id))?.username : null);
    if (username) navigate(`/profile/${encodeURIComponent(username)}`);
    else toast.error("Creator profile isn't available right now.");
  }, [item?.creator, navigate, light]);

  if (!id?.trim()) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <p className="text-muted-foreground mb-4">Missing content ID</p>
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button variant="outline" onClick={handleBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      </div>
    );
  }

  if (isLoading || !item) {
    return (
      <div className="fixed inset-0 bg-background z-0">
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 safe-area-inset z-10">
          <Button variant="ghost" size="icon" onClick={handleBack} className="text-primary-foreground/90">
            <ArrowLeft className="w-6 h-6" />
          </Button>
        </div>
        <div className="absolute inset-0 flex items-center justify-center pt-14">
          <MediaCardSkeleton />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black z-0">
      <div
        className={cn(
          'absolute top-0 left-0 right-0 flex items-center justify-between p-3 safe-area-inset z-10',
          'bg-gradient-to-b from-black/70 to-transparent'
        )}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
          className="text-white hover:bg-white/20"
        >
          <ArrowLeft className="w-6 h-6" />
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleViewProfile}
            className="text-white hover:bg-white/20"
            title="View profile"
          >
            <User className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleShare}
            className="text-white hover:bg-white/20"
            title="Share"
          >
            <Share2 className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="absolute inset-0">
        <MediaCard
          key={item.id}
          type={item.type}
          src={item.src}
          videoSrc={item.videoSrc}
          duration={item.duration}
          reward={item.reward}
          contentId={item.id}
          isActive
          onComplete={() => {}}
          onSkip={() => {}}
        />
      </div>

      <ShareSheet
        isOpen={showShare}
        onClose={() => setShowShare(false)}
        contentId={item.id}
        title={item.title ?? 'Check out this content!'}
        mediaUrl={item.type === 'image' ? item.src : (item.videoSrc ?? item.src) ?? undefined}
        mediaType={item.type === 'image' ? 'image' : 'video'}
      />
    </div>
  );
}
