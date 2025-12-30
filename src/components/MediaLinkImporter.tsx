import React, { useState, useEffect } from 'react';
import { 
  Link, Download, Play, Image, Video, ExternalLink, 
  Check, AlertCircle, Loader2, Trash2, Edit3, Share2,
  Instagram, Youtube, Facebook, Music2, Camera, Tv2, Twitter
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface ImportedMedia {
  id: string;
  user_id: string;
  platform: string;
  original_url: string;
  media_type: string;
  title: string | null;
  description: string | null;
  thumbnail_url: string | null;
  duration: number | null;
  original_views: number | null;
  original_likes: number | null;
  imported_at: string;
  status: string;
  local_media_url: string | null;
  edited_media_url: string | null;
}

const PLATFORM_PATTERNS: { platform: string; patterns: RegExp[]; icon: React.ReactNode; color: string }[] = [
  { 
    platform: 'instagram', 
    patterns: [/instagram\.com\/(p|reel|tv)\/[\w-]+/i, /instagr\.am\/[\w-]+/i],
    icon: <Instagram className="w-4 h-4" />,
    color: 'bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400'
  },
  { 
    platform: 'tiktok', 
    patterns: [/tiktok\.com\/@[\w.-]+\/video\/\d+/i, /vm\.tiktok\.com\/[\w]+/i],
    icon: <Music2 className="w-4 h-4" />,
    color: 'bg-black'
  },
  { 
    platform: 'youtube', 
    patterns: [/youtube\.com\/watch\?v=[\w-]+/i, /youtu\.be\/[\w-]+/i, /youtube\.com\/shorts\/[\w-]+/i],
    icon: <Youtube className="w-4 h-4" />,
    color: 'bg-red-600'
  },
  { 
    platform: 'facebook', 
    patterns: [/facebook\.com\/[\w.]+\/videos\/\d+/i, /fb\.watch\/[\w]+/i],
    icon: <Facebook className="w-4 h-4" />,
    color: 'bg-blue-600'
  },
  { 
    platform: 'twitch', 
    patterns: [/twitch\.tv\/videos\/\d+/i, /clips\.twitch\.tv\/[\w-]+/i],
    icon: <Tv2 className="w-4 h-4" />,
    color: 'bg-purple-600'
  },
  { 
    platform: 'twitter', 
    patterns: [/twitter\.com\/[\w]+\/status\/\d+/i, /x\.com\/[\w]+\/status\/\d+/i],
    icon: <Twitter className="w-4 h-4" />,
    color: 'bg-black'
  },
];

interface MediaLinkImporterProps {
  onImportComplete?: (media: ImportedMedia) => void;
  onEditInStudio?: (media: ImportedMedia) => void;
}

export const MediaLinkImporter: React.FC<MediaLinkImporterProps> = ({ 
  onImportComplete,
  onEditInStudio 
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [importedMedia, setImportedMedia] = useState<ImportedMedia[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [linkInput, setLinkInput] = useState('');
  const [titleInput, setTitleInput] = useState('');
  const [descriptionInput, setDescriptionInput] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [detectedPlatform, setDetectedPlatform] = useState<string | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<ImportedMedia | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchImportedMedia();
    }
  }, [user]);

  useEffect(() => {
    // Detect platform from link
    if (linkInput) {
      for (const { platform, patterns } of PLATFORM_PATTERNS) {
        if (patterns.some(p => p.test(linkInput))) {
          setDetectedPlatform(platform);
          return;
        }
      }
    }
    setDetectedPlatform(null);
  }, [linkInput]);

  const fetchImportedMedia = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('imported_media')
        .select('*')
        .eq('user_id', user.id)
        .order('imported_at', { ascending: false });

      if (error) throw error;
      setImportedMedia((data || []) as ImportedMedia[]);
    } catch (error) {
      console.error('Error fetching imported media:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportLink = async () => {
    if (!user || !linkInput.trim()) return;

    // Validate URL
    try {
      new URL(linkInput);
    } catch {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid URL',
        variant: 'destructive',
      });
      return;
    }

    setIsImporting(true);
    try {
      const platform = detectedPlatform || 'other';
      const mediaType = linkInput.includes('shorts') || linkInput.includes('reel') ? 'short' : 'video';

      const { data, error } = await supabase
        .from('imported_media')
        .insert({
          user_id: user.id,
          platform,
          original_url: linkInput,
          media_type: mediaType,
          title: titleInput || null,
          description: descriptionInput || null,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Media imported',
        description: 'Your media link has been saved and is ready to share',
      });

      const newMedia = data as ImportedMedia;
      setImportedMedia(prev => [newMedia, ...prev]);
      onImportComplete?.(newMedia);
      
      // Reset form
      setLinkInput('');
      setTitleInput('');
      setDescriptionInput('');
    } catch (error: any) {
      console.error('Error importing media:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to import media',
        variant: 'destructive',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleDeleteMedia = async (mediaId: string) => {
    try {
      const { error } = await supabase
        .from('imported_media')
        .delete()
        .eq('id', mediaId);

      if (error) throw error;

      toast({
        title: 'Media deleted',
        description: 'The imported media has been removed',
      });

      setImportedMedia(prev => prev.filter(m => m.id !== mediaId));
      setIsDetailDialogOpen(false);
    } catch (error: any) {
      console.error('Error deleting media:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete media',
        variant: 'destructive',
      });
    }
  };

  const getPlatformInfo = (platformId: string) => {
    return PLATFORM_PATTERNS.find(p => p.platform === platformId);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'processed':
        return <Badge variant="default" className="bg-green-500">Ready</Badge>;
      case 'published':
        return <Badge variant="default" className="bg-primary">Published</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Import Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="w-5 h-5 text-primary" />
            Import Media from Link
          </CardTitle>
          <CardDescription>
            Paste a link from Instagram, TikTok, YouTube, or other platforms to import media
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  placeholder="Paste your media link here..."
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  className="pr-12"
                />
                {detectedPlatform && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {(() => {
                      const platform = getPlatformInfo(detectedPlatform);
                      if (!platform) return null;
                      return (
                        <div className={cn('w-6 h-6 rounded flex items-center justify-center text-white', platform.color)}>
                          {platform.icon}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
            {detectedPlatform && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Check className="w-3 h-3 text-green-500" />
                Detected: {detectedPlatform.charAt(0).toUpperCase() + detectedPlatform.slice(1)}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Input
                placeholder="Title (optional)"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Input
                placeholder="Description (optional)"
                value={descriptionInput}
                onChange={(e) => setDescriptionInput(e.target.value)}
              />
            </div>
          </div>

          <Button 
            onClick={handleImportLink} 
            disabled={!linkInput.trim() || isImporting}
            className="w-full sm:w-auto"
          >
            {isImporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Import Media
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Imported Media Library */}
      <Card>
        <CardHeader>
          <CardTitle>Imported Media Library</CardTitle>
          <CardDescription>
            Your imported media ready to edit and share
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : importedMedia.length === 0 ? (
            <div className="text-center py-8">
              <Video className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-medium mb-1">No imported media yet</h3>
              <p className="text-sm text-muted-foreground">
                Paste a link above to import your first media
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {importedMedia.map(media => {
                const platform = getPlatformInfo(media.platform);
                
                return (
                  <div 
                    key={media.id}
                    className="group relative rounded-lg border border-border overflow-hidden hover:border-primary/50 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedMedia(media);
                      setIsDetailDialogOpen(true);
                    }}
                  >
                    {/* Thumbnail */}
                    <div className="aspect-video bg-muted flex items-center justify-center">
                      {media.thumbnail_url ? (
                        <img 
                          src={media.thumbnail_url} 
                          alt={media.title || 'Media thumbnail'}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Video className="w-12 h-12 text-muted-foreground" />
                      )}
                      
                      {/* Platform badge */}
                      {platform && (
                        <div className={cn(
                          'absolute top-2 left-2 w-7 h-7 rounded-lg flex items-center justify-center text-white shadow-lg',
                          platform.color
                        )}>
                          {platform.icon}
                        </div>
                      )}
                      
                      {/* Play overlay */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                        <Play className="w-10 h-10 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    
                    {/* Info */}
                    <div className="p-3">
                      <h4 className="font-medium text-sm truncate">
                        {media.title || 'Untitled Media'}
                      </h4>
                      <div className="flex items-center justify-between mt-2">
                        {getStatusBadge(media.status)}
                        <span className="text-xs text-muted-foreground">
                          {new Date(media.imported_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Media Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedMedia?.title || 'Media Details'}</DialogTitle>
            <DialogDescription>
              View and manage your imported media
            </DialogDescription>
          </DialogHeader>
          
          {selectedMedia && (
            <div className="space-y-4">
              {/* Thumbnail */}
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                {selectedMedia.thumbnail_url ? (
                  <img 
                    src={selectedMedia.thumbnail_url} 
                    alt={selectedMedia.title || 'Media'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Video className="w-16 h-16 text-muted-foreground" />
                )}
              </div>

              {/* Details */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Platform</span>
                  <span className="font-medium capitalize">{selectedMedia.platform}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  {getStatusBadge(selectedMedia.status)}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Imported</span>
                  <span className="text-sm">{new Date(selectedMedia.imported_at).toLocaleString()}</span>
                </div>
              </div>

              {selectedMedia.description && (
                <p className="text-sm text-muted-foreground">{selectedMedia.description}</p>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(selectedMedia.original_url, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View Original
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onEditInStudio?.(selectedMedia);
                    setIsDetailDialogOpen(false);
                  }}
                >
                  <Edit3 className="w-4 h-4 mr-2" />
                  Edit in Studio
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Share to Feed
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteMedia(selectedMedia.id)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MediaLinkImporter;
