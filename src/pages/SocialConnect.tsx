import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Link2, Download, Settings, Film } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LinkedSocialAccounts, { LinkedAccount } from '@/components/LinkedSocialAccounts';
import MediaLinkImporter from '@/components/MediaLinkImporter';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const SocialConnect: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);

  const handleEditInStudio = (media: any) => {
    toast({
      title: 'Opening Studio',
      description: 'Redirecting to Studio to edit your media...',
    });
    // Navigate to studio with the media URL
    navigate('/studio', { state: { importedMedia: media } });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Sign in required</h2>
          <p className="text-muted-foreground mb-4">
            Please sign in to connect your social accounts
          </p>
          <Button onClick={() => navigate('/auth')}>Sign In</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex items-center h-14 px-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="ml-3 text-lg font-semibold">Social Connections</h1>
        </div>
      </header>

      <main className="container px-4 py-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">Connect Your Social Media</h2>
          <p className="text-muted-foreground">
            Link your accounts and import content from Instagram, TikTok, YouTube, and more
          </p>
        </div>

        <Tabs defaultValue="accounts" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="accounts" className="flex items-center gap-2">
              <Link2 className="w-4 h-4" />
              <span className="hidden sm:inline">Accounts</span>
            </TabsTrigger>
            <TabsTrigger value="import" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Import</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="accounts" className="space-y-6">
            <LinkedSocialAccounts onAccountsChange={setLinkedAccounts} />
            
            {/* Quick tips */}
            <div className="p-4 rounded-lg bg-muted/50 space-y-3">
              <h4 className="font-medium">How it works</h4>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-medium shrink-0 mt-0.5">1</span>
                  Link your social media accounts by entering your username or profile URL
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-medium shrink-0 mt-0.5">2</span>
                  Import media by pasting links to your posts, reels, or videos
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-medium shrink-0 mt-0.5">3</span>
                  Edit imported media in the Studio and share on your feed to earn rewards
                </li>
              </ul>
            </div>
          </TabsContent>

          <TabsContent value="import">
            <MediaLinkImporter onEditInStudio={handleEditInStudio} />
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <div className="p-4 rounded-lg border border-border space-y-4">
              <h4 className="font-medium">Import Settings</h4>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Auto-generate thumbnails</p>
                    <p className="text-xs text-muted-foreground">Create preview images for imported videos</p>
                  </div>
                  <Button variant="outline" size="sm" disabled>Coming Soon</Button>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Download to device</p>
                    <p className="text-xs text-muted-foreground">Save imported media locally</p>
                  </div>
                  <Button variant="outline" size="sm" disabled>Coming Soon</Button>
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Cross-post to all platforms</p>
                    <p className="text-xs text-muted-foreground">Share content across linked accounts</p>
                  </div>
                  <Button variant="outline" size="sm" disabled>Coming Soon</Button>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-start gap-3">
                <Film className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <h4 className="font-medium">Pro Tip: Use the Studio</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    After importing media, use our Studio to add effects, filters, captions, and more before sharing on your feed.
                  </p>
                  <Button 
                    variant="link" 
                    size="sm" 
                    className="p-0 h-auto mt-2"
                    onClick={() => navigate('/studio')}
                  >
                    Go to Studio →
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default SocialConnect;
