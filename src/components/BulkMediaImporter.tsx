import React, { useState } from 'react';
import { 
  Link, Download, Loader2, ListPlus, Trash2, 
  Instagram, Youtube, Music2, ExternalLink, Check, X, AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface BulkImportItem {
  id: string;
  url: string;
  platform: string;
  status: 'pending' | 'importing' | 'success' | 'failed';
  error?: string;
  mediaId?: string;
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
    patterns: [/youtube\.com\/watch\?v=[\w-]+/i, /youtu\.be\/[\w-]+/i, /youtube\.com\/shorts\/[\w-]+/i, /youtube\.com\/playlist\?list=[\w-]+/i],
    icon: <Youtube className="w-4 h-4" />,
    color: 'bg-red-600'
  },
];

interface BulkMediaImporterProps {
  onImportComplete?: (count: number) => void;
}

export const BulkMediaImporter: React.FC<BulkMediaImporterProps> = ({ onImportComplete }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [linksInput, setLinksInput] = useState('');
  const [importItems, setImportItems] = useState<BulkImportItem[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const detectPlatform = (url: string): string => {
    for (const { platform, patterns } of PLATFORM_PATTERNS) {
      if (patterns.some(p => p.test(url))) {
        return platform;
      }
    }
    return 'other';
  };

  const getPlatformIcon = (platform: string) => {
    const found = PLATFORM_PATTERNS.find(p => p.platform === platform);
    return found?.icon || <Link className="w-4 h-4" />;
  };

  const getPlatformColor = (platform: string) => {
    const found = PLATFORM_PATTERNS.find(p => p.platform === platform);
    return found?.color || 'bg-muted';
  };

  const parseLinks = () => {
    const lines = linksInput.split('\n').filter(line => line.trim());
    const urls: string[] = [];
    
    lines.forEach(line => {
      // Extract URLs from each line
      const urlRegex = /(https?:\/\/[^\s]+)/gi;
      const matches = line.match(urlRegex);
      if (matches) {
        matches.forEach(url => {
          // Validate it's a proper URL
          try {
            new URL(url.trim());
            urls.push(url.trim());
          } catch {
            // Invalid URL, skip
          }
        });
      }
    });

    const items: BulkImportItem[] = urls.map((url, index) => ({
      id: `${Date.now()}-${index}`,
      url,
      platform: detectPlatform(url),
      status: 'pending'
    }));

    setImportItems(items);
    toast({
      title: 'Links parsed',
      description: `Found ${items.length} valid media links`,
    });
  };

  const removeItem = (id: string) => {
    setImportItems(prev => prev.filter(item => item.id !== id));
  };

  const clearAll = () => {
    setImportItems([]);
    setLinksInput('');
    setProgress(0);
  };

  const importAll = async () => {
    if (!user || importItems.length === 0) return;

    setIsImporting(true);
    setProgress(0);
    let successCount = 0;

    for (let i = 0; i < importItems.length; i++) {
      const item = importItems[i];
      
      // Update status to importing
      setImportItems(prev => prev.map(p => 
        p.id === item.id ? { ...p, status: 'importing' } : p
      ));

      try {
        const mediaType = item.url.includes('shorts') || item.url.includes('reel') ? 'short' : 'video';

        const { data, error } = await supabase
          .from('imported_media')
          .insert({
            user_id: user.id,
            platform: item.platform,
            original_url: item.url,
            media_type: mediaType,
            status: 'pending',
          })
          .select()
          .single();

        if (error) throw error;

        // Trigger metadata extraction in background
        supabase.functions.invoke('extract-media-metadata', {
          body: { url: item.url, mediaId: data.id }
        }).catch(console.error);

        setImportItems(prev => prev.map(p => 
          p.id === item.id ? { ...p, status: 'success', mediaId: data.id } : p
        ));
        successCount++;
      } catch (error: any) {
        setImportItems(prev => prev.map(p => 
          p.id === item.id ? { ...p, status: 'failed', error: error.message } : p
        ));
      }

      setProgress(Math.round(((i + 1) / importItems.length) * 100));
      
      // Small delay between imports to avoid rate limiting
      if (i < importItems.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    setIsImporting(false);
    
    toast({
      title: 'Bulk import complete',
      description: `Successfully imported ${successCount} of ${importItems.length} items`,
    });

    onImportComplete?.(successCount);
  };

  const pendingCount = importItems.filter(i => i.status === 'pending').length;
  const successCount = importItems.filter(i => i.status === 'success').length;
  const failedCount = importItems.filter(i => i.status === 'failed').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ListPlus className="w-5 h-5 text-primary" />
          Bulk Import
        </CardTitle>
        <CardDescription>
          Import multiple media links at once. Paste links from profiles, playlists, or copy multiple URLs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input area */}
        <div className="space-y-2">
          <Textarea
            placeholder="Paste multiple links here, one per line...&#10;&#10;Examples:&#10;https://www.youtube.com/watch?v=xyz123&#10;https://www.instagram.com/reel/abc456&#10;https://www.tiktok.com/@user/video/789"
            value={linksInput}
            onChange={(e) => setLinksInput(e.target.value)}
            className="min-h-[120px] font-mono text-sm"
            disabled={isImporting}
          />
          <div className="flex gap-2">
            <Button 
              onClick={parseLinks} 
              disabled={!linksInput.trim() || isImporting}
              variant="secondary"
            >
              <Link className="w-4 h-4 mr-2" />
              Parse Links
            </Button>
            {importItems.length > 0 && (
              <Button 
                onClick={clearAll} 
                variant="ghost"
                disabled={isImporting}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All
              </Button>
            )}
          </div>
        </div>

        {/* Parsed items list */}
        {importItems.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{importItems.length} items</span>
                {successCount > 0 && (
                  <Badge variant="default" className="bg-green-500">{successCount} imported</Badge>
                )}
                {failedCount > 0 && (
                  <Badge variant="destructive">{failedCount} failed</Badge>
                )}
              </div>
              <Button 
                onClick={importAll} 
                disabled={pendingCount === 0 || isImporting}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Import All ({pendingCount})
                  </>
                )}
              </Button>
            </div>

            {isImporting && (
              <Progress value={progress} className="h-2" />
            )}

            <div className="max-h-[300px] overflow-y-auto space-y-2">
              {importItems.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border transition-colors',
                    item.status === 'success' && 'bg-green-500/10 border-green-500/30',
                    item.status === 'failed' && 'bg-destructive/10 border-destructive/30',
                    item.status === 'importing' && 'bg-primary/10 border-primary/30',
                    item.status === 'pending' && 'bg-muted/50 border-border'
                  )}
                >
                  <div className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center text-white',
                    getPlatformColor(item.platform)
                  )}>
                    {getPlatformIcon(item.platform)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{item.url}</p>
                    {item.error && (
                      <p className="text-xs text-destructive mt-0.5">{item.error}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {item.status === 'pending' && (
                      <Badge variant="secondary">Pending</Badge>
                    )}
                    {item.status === 'importing' && (
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    )}
                    {item.status === 'success' && (
                      <Check className="w-4 h-4 text-green-500" />
                    )}
                    {item.status === 'failed' && (
                      <AlertCircle className="w-4 h-4 text-destructive" />
                    )}
                    
                    {!isImporting && item.status === 'pending' && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="w-8 h-8"
                        onClick={() => removeItem(item.id)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tips */}
        <div className="p-3 rounded-lg bg-muted/50 space-y-1">
          <p className="text-xs text-muted-foreground">
            <strong>Tips:</strong>
          </p>
          <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
            <li>Paste links from YouTube playlists, Instagram profiles, or TikTok collections</li>
            <li>Each link should be on a separate line</li>
            <li>Metadata will be extracted automatically after import</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};
