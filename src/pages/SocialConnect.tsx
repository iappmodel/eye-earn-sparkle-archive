import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Link2, Download, Settings, Film, CalendarClock, ListPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import LinkedSocialAccounts, { LinkedAccount } from '@/components/LinkedSocialAccounts';
import MediaLinkImporter from '@/components/MediaLinkImporter';
import { BulkMediaImporter } from '@/components/BulkMediaImporter';
import { ScheduleShell } from '@/components/ScheduleShell';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

type SocialConnectTab = 'accounts' | 'import' | 'schedule' | 'settings';
type SocialConnectSettingsState = {
  autoGenerateThumbnails: boolean;
  preferLocalDownloads: boolean;
};

const SOCIAL_CONNECT_SETTINGS_KEY = 'social_connect_settings_v1';

function loadSocialConnectSettings(): SocialConnectSettingsState {
  if (typeof window === 'undefined') {
    return { autoGenerateThumbnails: true, preferLocalDownloads: false };
  }
  try {
    const raw = window.localStorage.getItem(SOCIAL_CONNECT_SETTINGS_KEY);
    if (!raw) return { autoGenerateThumbnails: true, preferLocalDownloads: false };
    const parsed = JSON.parse(raw) as Partial<SocialConnectSettingsState>;
    return {
      autoGenerateThumbnails: parsed.autoGenerateThumbnails ?? true,
      preferLocalDownloads: parsed.preferLocalDownloads ?? false,
    };
  } catch {
    return { autoGenerateThumbnails: true, preferLocalDownloads: false };
  }
}

const SocialConnect: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<SocialConnectTab>('accounts');
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>([]);
  const [importSettings, setImportSettings] = useState<SocialConnectSettingsState>(() => loadSocialConnectSettings());

  const updateImportSetting = (key: keyof SocialConnectSettingsState, value: boolean) => {
    setImportSettings((prev) => {
      const next = { ...prev, [key]: value };
      try {
        window.localStorage.setItem(SOCIAL_CONNECT_SETTINGS_KEY, JSON.stringify(next));
      } catch {
        // ignore storage failures; UI state still updates
      }
      return next;
    });
    toast({
      title: 'Import setting updated',
      description:
        key === 'autoGenerateThumbnails'
          ? `Auto-generate thumbnails ${value ? 'enabled' : 'disabled'}.`
          : `Local download preference ${value ? 'enabled' : 'disabled'}.`,
    });
  };

  const handleEditInStudio = (media: unknown) => {
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

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as SocialConnectTab)} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="accounts" className="flex items-center gap-2">
              <Link2 className="w-4 h-4" />
              <span className="hidden sm:inline">Accounts</span>
            </TabsTrigger>
            <TabsTrigger value="import" className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Import</span>
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4" />
              <span className="hidden sm:inline">Schedule</span>
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

          <TabsContent value="import" className="space-y-6">
            <MediaLinkImporter onEditInStudio={handleEditInStudio} />
            <BulkMediaImporter />
          </TabsContent>

          <TabsContent value="schedule">
            <ScheduleShell />
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
                  <Switch
                    checked={importSettings.autoGenerateThumbnails}
                    onCheckedChange={(checked) => updateImportSetting('autoGenerateThumbnails', checked)}
                    aria-label="Toggle auto-generate thumbnails"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Prefer local downloads</p>
                    <p className="text-xs text-muted-foreground">When supported, save imported media to device first</p>
                  </div>
                  <Switch
                    checked={importSettings.preferLocalDownloads}
                    onCheckedChange={(checked) => updateImportSetting('preferLocalDownloads', checked)}
                    aria-label="Toggle local download preference"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Cross-post workflow</p>
                    <p className="text-xs text-muted-foreground">Open the scheduler to queue platform-specific publishing steps</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setActiveTab('schedule');
                      toast({
                        title: 'Scheduler opened',
                        description: 'Use the Schedule tab to plan per-platform publishing.',
                      });
                    }}
                    className="gap-1"
                  >
                    <ListPlus className="w-4 h-4" />
                    Open Schedule
                  </Button>
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
