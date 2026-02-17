import React, { useState, useMemo, useCallback } from 'react';
import {
  Send,
  Coins,
  Sparkles,
  Loader2,
  Check,
  Instagram,
  Youtube,
  Music2,
  Clock,
  TrendingUp,
  Globe,
  Lock,
  Calendar,
  MapPin,
  Link2,
  Eye,
  FileText,
  Hash,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  partialInsertOne,
  partialInsertErrorMessage,
} from '@/integrations/supabase/partialInsert';
import { ShareSheet } from '@/components/ShareSheet';
import {
  CONTENT_STATUS_ACTIVE,
  CONTENT_STATUS_DRAFT,
  CONTENT_STATUS_SCHEDULED,
  type UserContentStatus,
} from '@/constants/contentStatus';
import { format, addMinutes, isBefore, startOfToday } from 'date-fns';
import { rewardsService } from '@/services/rewards.service';

// Limits aligned with common social UX
const TITLE_MAX = 100;
const CAPTION_MAX = 2200;
const TAGS_MAX = 30;
const TAGS_MAX_LENGTH_PER = 50;

export interface PublishToFeedButtonProps {
  /** Required when publishing from imported media (Studio flow) */
  importedMediaId?: string;
  mediaTitle?: string | null;
  mediaDescription?: string | null;
  mediaThumbnail?: string | null;
  platform?: string;
  /** Final media URL after edits (e.g. from Studio); used as media_url when set */
  editedMediaUrl?: string | null;
  onPublishComplete?: (contentId: string) => void;
  className?: string;
  /** When true, show only "Publish" (no draft/schedule) for a compact flow */
  compact?: boolean;
}

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  instagram: <Instagram className="w-4 h-4" />,
  youtube: <Youtube className="w-4 h-4" />,
  tiktok: <Music2 className="w-4 h-4" />,
};

type PublishAction = 'publish_now' | 'save_draft' | 'schedule';

export const PublishToFeedButton: React.FC<PublishToFeedButtonProps> = ({
  importedMediaId,
  mediaTitle,
  mediaDescription,
  mediaThumbnail,
  platform,
  editedMediaUrl,
  onPublishComplete,
  className,
  compact = false,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [title, setTitle] = useState(mediaTitle || '');
  const [caption, setCaption] = useState(mediaDescription || '');
  const [tags, setTags] = useState('');
  const [enableEarnings, setEnableEarnings] = useState(true);
  const [isPublic, setIsPublic] = useState(true);
  const [action, setAction] = useState<PublishAction>('publish_now');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [locationAddress, setLocationAddress] = useState('');
  const [callToAction, setCallToAction] = useState('');
  const [externalLink, setExternalLink] = useState('');
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [publishedContentId, setPublishedContentId] = useState<string | null>(null);

  const mediaUrl = editedMediaUrl || mediaThumbnail || null;
  const thumbnailUrl = mediaThumbnail || null;

  const tagList = useMemo(
    () =>
      tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    [tags],
  );
  const titleLen = title.length;
  const captionLen = caption.length;
  const titleOver = titleLen > TITLE_MAX;
  const captionOver = captionLen > CAPTION_MAX;
  const tagsOver = tagList.length > TAGS_MAX;
  const tagsLengthOver = tagList.some((t) => t.length > TAGS_MAX_LENGTH_PER);

  const scheduleDateTime = useMemo(() => {
    if (!scheduleDate || !scheduleTime) return null;
    try {
      const [h, m] = scheduleTime.split(':').map(Number);
      const d = new Date(scheduleDate);
      d.setHours(h, m, 0, 0);
      return d;
    } catch {
      return null;
    }
  }, [scheduleDate, scheduleTime]);

  const scheduleInPast = scheduleDateTime ? isBefore(scheduleDateTime, new Date()) : false;
  const canSchedule = action === 'schedule' && scheduleDateTime && !scheduleInPast;
  const canPublish =
    (action === 'publish_now' || action === 'save_draft' || canSchedule) &&
    !titleOver &&
    !captionOver &&
    !tagsOver &&
    !tagsLengthOver &&
    (action !== 'schedule' || (scheduleDate && scheduleTime));

  const defaultScheduleMin = useMemo(() => {
    const now = new Date();
    const in30 = addMinutes(now, 30);
    return {
      date: format(in30, 'yyyy-MM-dd'),
      time: format(in30, 'HH:mm'),
    };
  }, []);

  const openDialog = useCallback(() => {
    if (!scheduleDate && !scheduleTime) {
      setScheduleDate(defaultScheduleMin.date);
      setScheduleTime(defaultScheduleMin.time);
    }
    setIsDialogOpen(true);
  }, [defaultScheduleMin.date, defaultScheduleMin.time]);

  const handlePublish = async () => {
    if (!user) return;
    if (!canPublish && action === 'schedule') {
      toast({
        title: 'Invalid schedule',
        description: 'Choose a future date and time.',
        variant: 'destructive',
      });
      return;
    }

    setIsPublishing(true);
    try {
      const isDraft = action === 'save_draft';
      const isScheduled = action === 'schedule' && canSchedule && scheduleDateTime;
      const status: UserContentStatus = isDraft
        ? CONTENT_STATUS_DRAFT
        : isScheduled
          ? CONTENT_STATUS_SCHEDULED
          : CONTENT_STATUS_ACTIVE;
      const publishedAt = status === CONTENT_STATUS_ACTIVE ? new Date().toISOString() : null;
      const scheduledAt = isScheduled ? scheduleDateTime!.toISOString() : null;

      const payload = {
        user_id: user.id,
        content_type: 'post' as const,
        media_type: 'video' as const,
        title: title || 'Untitled',
        caption: caption || null,
        media_url: mediaUrl,
        thumbnail_url: thumbnailUrl,
        tags: tagList.length ? tagList : null,
        status,
        is_public: isPublic,
        is_draft: isDraft,
        published_at: publishedAt,
        scheduled_at: scheduledAt,
        reward_type: enableEarnings ? 'both' : null,
        location_address: locationAddress || null,
        call_to_action: callToAction || null,
        external_link: externalLink || null,
      };

      const result = await partialInsertOne('user_content', payload, {
        returning: '*',
      });

      const content = result.data;
      if (result.error || !content) {
        const msg = result.error
          ? partialInsertErrorMessage(result.normalizedError)
          : 'Failed to create content';
        throw new Error(msg);
      }

      if (importedMediaId) {
        const { error: updateError } = await supabase
          .from('imported_media')
          .update({
            status: status === CONTENT_STATUS_ACTIVE ? 'published' : 'processed',
            published_content_id: content.id,
            ...(status === CONTENT_STATUS_SCHEDULED && scheduledAt
              ? { scheduled_at: scheduledAt }
              : {}),
          })
          .eq('id', importedMediaId);

        if (updateError) throw updateError;
      }

      if (status === CONTENT_STATUS_ACTIVE) {
        setPublishedContentId(content.id);
        setShowShareSheet(true);
        // Platform rewards VICOIN for posting (beneficial engagement)
        rewardsService.issueReward('post', content.id, {}).catch(() => {});
        toast({
          title: enableEarnings ? 'Published with earnings enabled!' : 'Published!',
          description: enableEarnings
            ? 'You can earn iCoins and viCoins when users watch your content.'
            : 'Your content is now live on the feed.',
        });
      } else if (status === CONTENT_STATUS_SCHEDULED) {
        toast({
          title: 'Scheduled',
          description: `Your post will go live on ${format(scheduleDateTime!, 'MMM d, yyyy')} at ${format(scheduleDateTime!, 'h:mm a')}.`,
        });
      } else {
        toast({
          title: 'Draft saved',
          description: 'You can edit and publish it from Content Manager.',
        });
      }

      setIsDialogOpen(false);
      onPublishComplete?.(content.id);
    } catch (error: unknown) {
      console.error('Error publishing:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to publish',
        variant: 'destructive',
      });
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <>
      <Button
        onClick={openDialog}
        className={cn(
          'bg-gradient-to-r from-primary to-vicoin hover:opacity-90',
          className,
        )}
      >
        <Send className="w-4 h-4 mr-2" />
        Publish to Feed
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" />
              Publish to Feed
            </DialogTitle>
            <DialogDescription>
              Share with your audience and optionally earn when they watch
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Preview */}
            <div className="flex items-start gap-4 p-3 rounded-lg bg-muted/50">
              {thumbnailUrl ? (
                <img
                  src={thumbnailUrl}
                  alt=""
                  className="w-20 h-20 rounded-lg object-cover shrink-0"
                />
              ) : (
                <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Sparkles className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  {platform && PLATFORM_ICONS[platform] && (
                    <Badge variant="secondary" className="text-xs">
                      {PLATFORM_ICONS[platform]}
                      <span className="ml-1 capitalize">{platform}</span>
                    </Badge>
                  )}
                  {editedMediaUrl && (
                    <Badge
                      variant="outline"
                      className="text-xs text-primary border-primary/30"
                    >
                      Edited
                    </Badge>
                  )}
                </div>
                <p className="text-sm font-medium truncate">
                  {mediaTitle || title || 'Untitled'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {caption ? `${caption.slice(0, 60)}${caption.length > 60 ? '…' : ''}` : 'Add a caption'}
                </p>
              </div>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5" /> Title
                </span>
                <span
                  className={cn(
                    'text-xs tabular-nums',
                    titleOver ? 'text-destructive' : 'text-muted-foreground',
                  )}
                >
                  {titleLen}/{TITLE_MAX}
                </span>
              </Label>
              <Input
                placeholder="Give your post a catchy title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={TITLE_MAX + 1}
                className={titleOver ? 'border-destructive' : ''}
              />
            </div>

            {/* Caption */}
            <div className="space-y-2">
              <Label className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5" /> Caption
                </span>
                <span
                  className={cn(
                    'text-xs tabular-nums',
                    captionOver ? 'text-destructive' : 'text-muted-foreground',
                  )}
                >
                  {captionLen}/{CAPTION_MAX}
                </span>
              </Label>
              <Textarea
                placeholder="Write a caption..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className={cn(
                  'min-h-[80px] resize-y',
                  captionOver ? 'border-destructive' : '',
                )}
                maxLength={CAPTION_MAX + 1}
              />
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Hash className="w-3.5 h-3.5" /> Tags (comma separated)
                </span>
                <span
                  className={cn(
                    'text-xs tabular-nums',
                    tagsOver || tagsLengthOver ? 'text-destructive' : 'text-muted-foreground',
                  )}
                >
                  {tagList.length}/{TAGS_MAX}
                </span>
              </Label>
              <Input
                placeholder="entertainment, funny, viral"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className={tagsOver || tagsLengthOver ? 'border-destructive' : ''}
              />
              {(tagsOver || tagsLengthOver) && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {tagsOver
                    ? `Max ${TAGS_MAX} tags.`
                    : `Each tag max ${TAGS_MAX_LENGTH_PER} characters.`}
                </p>
              )}
            </div>

            {!compact && (
              <>
                {/* Publish action: Now / Draft / Schedule */}
                <div className="space-y-2">
                  <Label>When to publish</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      type="button"
                      variant={action === 'publish_now' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setAction('publish_now')}
                      className={action === 'publish_now' ? 'bg-primary' : ''}
                    >
                      <Send className="w-3.5 h-3.5 mr-1" />
                      Now
                    </Button>
                    <Button
                      type="button"
                      variant={action === 'save_draft' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setAction('save_draft')}
                      className={action === 'save_draft' ? 'bg-primary' : ''}
                    >
                      <FileText className="w-3.5 h-3.5 mr-1" />
                      Draft
                    </Button>
                    <Button
                      type="button"
                      variant={action === 'schedule' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setAction('schedule')}
                      className={action === 'schedule' ? 'bg-primary' : ''}
                    >
                      <Calendar className="w-3.5 h-3.5 mr-1" />
                      Schedule
                    </Button>
                  </div>
                </div>

                {action === 'schedule' && (
                  <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="space-y-1">
                      <Label className="text-xs">Date</Label>
                      <Input
                        type="date"
                        value={scheduleDate}
                        onChange={(e) => setScheduleDate(e.target.value)}
                        min={format(startOfToday(), 'yyyy-MM-dd')}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Time</Label>
                      <Input
                        type="time"
                        value={scheduleTime}
                        onChange={(e) => setScheduleTime(e.target.value)}
                      />
                    </div>
                    {scheduleInPast && (
                      <p className="col-span-2 text-xs text-destructive flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Choose a future date and time.
                      </p>
                    )}
                  </div>
                )}

                {/* Visibility */}
                <div className="flex items-center justify-between p-3 rounded-lg border border-border/50">
                  <div className="flex items-center gap-3">
                    {isPublic ? (
                      <Globe className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <Lock className="w-5 h-5 text-muted-foreground" />
                    )}
                    <div>
                      <p className="font-medium">
                        {isPublic ? 'Public' : 'Only you'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {isPublic
                          ? 'Visible on the main feed'
                          : 'Only visible in your content list'}
                      </p>
                    </div>
                  </div>
                  <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                </div>

                {/* Optional: Location */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5" /> Location (optional)
                  </Label>
                  <Input
                    placeholder="City or place"
                    value={locationAddress}
                    onChange={(e) => setLocationAddress(e.target.value)}
                  />
                </div>

                {/* Optional: CTA / Link */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-muted-foreground">
                    <Link2 className="w-3.5 h-3.5" /> Link (optional)
                  </Label>
                  <Input
                    placeholder="Button text (e.g. Shop now)"
                    value={callToAction}
                    onChange={(e) => setCallToAction(e.target.value)}
                    className="mb-2"
                  />
                  <Input
                    placeholder="https://..."
                    value={externalLink}
                    onChange={(e) => setExternalLink(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Earnings */}
            <div className="p-4 rounded-lg bg-gradient-to-br from-vicoin/10 to-icoin/10 border border-vicoin/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-vicoin/20 flex items-center justify-center">
                    <Coins className="w-5 h-5 text-vicoin" />
                  </div>
                  <div>
                    <p className="font-medium">Enable Earnings</p>
                    <p className="text-xs text-muted-foreground">
                      Earn iCoins & viCoins when users watch
                    </p>
                  </div>
                </div>
                <Switch
                  checked={enableEarnings}
                  onCheckedChange={setEnableEarnings}
                />
              </div>
              {enableEarnings && (
                <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-2 gap-3">
                  <div className="text-center p-2 rounded bg-background/50">
                    <p className="text-lg font-bold text-vicoin">viCoin</p>
                    <p className="text-xs text-muted-foreground">
                      Per qualified view
                    </p>
                  </div>
                  <div className="text-center p-2 rounded bg-background/50">
                    <p className="text-lg font-bold text-icoin">iCoin</p>
                    <p className="text-xs text-muted-foreground">
                      Attention rewards
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Tip */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
              <TrendingUp className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Tip:</span> Posts
                with catchy titles and relevant tags get more engagement.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isPublishing}
            >
              Cancel
            </Button>
            <Button
              onClick={handlePublish}
              disabled={isPublishing || !canPublish}
              className="bg-gradient-to-r from-primary to-vicoin"
            >
              {isPublishing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {action === 'save_draft'
                    ? 'Saving...'
                    : action === 'schedule'
                      ? 'Scheduling...'
                      : 'Publishing...'}
                </>
              ) : (
                <>
                  {action === 'save_draft' ? (
                    <>
                      <FileText className="w-4 h-4 mr-2" />
                      Save draft
                    </>
                  ) : action === 'schedule' ? (
                    <>
                      <Calendar className="w-4 h-4 mr-2" />
                      Schedule
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Publish now
                    </>
                  )}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ShareSheet
        isOpen={showShareSheet}
        onClose={() => {
          setShowShareSheet(false);
          setPublishedContentId(null);
        }}
        contentId={publishedContentId ?? undefined}
        title={title || 'Check out my post!'}
        description={caption || undefined}
        mediaUrl={mediaUrl ?? undefined}
        mediaType="video"
      />
    </>
  );
};
