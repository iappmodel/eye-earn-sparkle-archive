import React, { useState } from 'react';
import { 
  Send, Coins, Sparkles, Loader2, Check, 
  Instagram, Youtube, Music2, Clock, TrendingUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface PublishToFeedButtonProps {
  importedMediaId: string;
  mediaTitle?: string | null;
  mediaDescription?: string | null;
  mediaThumbnail?: string | null;
  platform?: string;
  editedMediaUrl?: string | null;
  onPublishComplete?: (contentId: string) => void;
  className?: string;
}

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  instagram: <Instagram className="w-4 h-4" />,
  youtube: <Youtube className="w-4 h-4" />,
  tiktok: <Music2 className="w-4 h-4" />,
};

export const PublishToFeedButton: React.FC<PublishToFeedButtonProps> = ({
  importedMediaId,
  mediaTitle,
  mediaDescription,
  mediaThumbnail,
  platform,
  editedMediaUrl,
  onPublishComplete,
  className
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [title, setTitle] = useState(mediaTitle || '');
  const [caption, setCaption] = useState(mediaDescription || '');
  const [tags, setTags] = useState('');
  const [enableEarnings, setEnableEarnings] = useState(true);
  const [scheduleForLater, setScheduleForLater] = useState(false);

  const handlePublish = async () => {
    if (!user) return;

    setIsPublishing(true);
    try {
      // Create native content from imported media
      const { data: content, error: contentError } = await supabase
        .from('user_content')
        .insert({
          user_id: user.id,
          content_type: 'video',
          media_type: 'video',
          title: title || 'Untitled',
          caption: caption,
          media_url: editedMediaUrl || mediaThumbnail,
          thumbnail_url: mediaThumbnail,
          tags: tags.split(',').map(t => t.trim()).filter(Boolean),
          status: 'published',
          is_public: true,
          is_draft: false,
          published_at: new Date().toISOString(),
          reward_type: enableEarnings ? 'both' : null,
        })
        .select()
        .single();

      if (contentError) throw contentError;

      // Update imported media to mark as published
      const { error: updateError } = await supabase
        .from('imported_media')
        .update({
          status: 'published',
          published_content_id: content.id,
        })
        .eq('id', importedMediaId);

      if (updateError) throw updateError;

      // If earnings enabled, initialize reward tracking
      if (enableEarnings) {
        toast({
          title: 'Published with earnings enabled!',
          description: 'You can now earn iCoins and viCoins when users watch your content.',
        });
      } else {
        toast({
          title: 'Published successfully!',
          description: 'Your content is now live on the feed.',
        });
      }

      setIsDialogOpen(false);
      onPublishComplete?.(content.id);
    } catch (error: any) {
      console.error('Error publishing:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to publish content',
        variant: 'destructive',
      });
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <>
      <Button
        onClick={() => setIsDialogOpen(true)}
        className={cn(
          'bg-gradient-to-r from-primary to-vicoin hover:opacity-90',
          className
        )}
      >
        <Send className="w-4 h-4 mr-2" />
        Publish to Feed
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" />
              Publish to Feed
            </DialogTitle>
            <DialogDescription>
              Share your edited content with your audience and start earning
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Preview */}
            <div className="flex items-start gap-4 p-3 rounded-lg bg-muted/50">
              {mediaThumbnail ? (
                <img 
                  src={mediaThumbnail} 
                  alt="" 
                  className="w-20 h-20 rounded-lg object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {platform && PLATFORM_ICONS[platform] && (
                    <Badge variant="secondary" className="text-xs">
                      {PLATFORM_ICONS[platform]}
                      <span className="ml-1 capitalize">{platform}</span>
                    </Badge>
                  )}
                  {editedMediaUrl && (
                    <Badge variant="outline" className="text-xs text-primary border-primary/30">
                      Edited
                    </Badge>
                  )}
                </div>
                <p className="text-sm font-medium truncate">{mediaTitle || 'Untitled'}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Imported media</p>
              </div>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                placeholder="Give your post a catchy title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Caption */}
            <div className="space-y-2">
              <Label>Caption</Label>
              <Textarea
                placeholder="Write a caption for your post..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="min-h-[80px]"
              />
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label>Tags (comma separated)</Label>
              <Input
                placeholder="entertainment, funny, viral"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </div>

            {/* Earnings toggle */}
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
                    <p className="text-xs text-muted-foreground">Per qualified view</p>
                  </div>
                  <div className="text-center p-2 rounded bg-background/50">
                    <p className="text-lg font-bold text-icoin">iCoin</p>
                    <p className="text-xs text-muted-foreground">Attention rewards</p>
                  </div>
                </div>
              )}
            </div>

            {/* Quick tip */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
              <TrendingUp className="w-4 h-4 text-primary mt-0.5" />
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Tip:</span> Posts with 
                catchy titles and relevant tags get 40% more engagement
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handlePublish} 
              disabled={isPublishing}
              className="bg-gradient-to-r from-primary to-vicoin"
            >
              {isPublishing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Publish Now
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
