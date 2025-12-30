import React, { useState, useEffect } from 'react';
import { 
  Link2, Plus, Trash2, ExternalLink, Check, AlertCircle, 
  Instagram, Youtube, Facebook, Music2, Camera, Tv2, Twitter, Video
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface LinkedAccount {
  id: string;
  user_id: string;
  platform: string;
  username: string | null;
  profile_url: string | null;
  display_name: string | null;
  avatar_url: string | null;
  followers_count: number | null;
  is_verified: boolean;
  linked_at: string;
}

const SOCIAL_PLATFORMS = [
  { id: 'instagram', name: 'Instagram', icon: Instagram, color: 'bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400', urlPattern: 'instagram.com' },
  { id: 'tiktok', name: 'TikTok', icon: Music2, color: 'bg-black', urlPattern: 'tiktok.com' },
  { id: 'youtube', name: 'YouTube', icon: Youtube, color: 'bg-red-600', urlPattern: 'youtube.com' },
  { id: 'snapchat', name: 'Snapchat', icon: Camera, color: 'bg-yellow-400', urlPattern: 'snapchat.com' },
  { id: 'facebook', name: 'Facebook', icon: Facebook, color: 'bg-blue-600', urlPattern: 'facebook.com' },
  { id: 'twitch', name: 'Twitch', icon: Tv2, color: 'bg-purple-600', urlPattern: 'twitch.tv' },
  { id: 'twitter', name: 'X (Twitter)', icon: Twitter, color: 'bg-black', urlPattern: 'twitter.com|x.com' },
  { id: 'vimeo', name: 'Vimeo', icon: Video, color: 'bg-blue-500', urlPattern: 'vimeo.com' },
];

interface LinkedSocialAccountsProps {
  onAccountsChange?: (accounts: LinkedAccount[]) => void;
}

export const LinkedSocialAccounts: React.FC<LinkedSocialAccountsProps> = ({ onAccountsChange }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [username, setUsername] = useState('');
  const [profileUrl, setProfileUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      fetchAccounts();
    }
  }, [user]);

  const fetchAccounts = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('linked_social_accounts')
        .select('*')
        .eq('user_id', user.id)
        .order('linked_at', { ascending: false });

      if (error) throw error;
      
      const typedData = (data || []) as LinkedAccount[];
      setAccounts(typedData);
      onAccountsChange?.(typedData);
    } catch (error) {
      console.error('Error fetching linked accounts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load linked accounts',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLinkAccount = async () => {
    if (!user || !selectedPlatform) return;
    
    setIsSubmitting(true);
    try {
      // Check if already linked
      const existing = accounts.find(a => a.platform === selectedPlatform);
      if (existing) {
        toast({
          title: 'Already linked',
          description: `You already have a ${SOCIAL_PLATFORMS.find(p => p.id === selectedPlatform)?.name} account linked`,
          variant: 'destructive',
        });
        return;
      }

      const { data, error } = await supabase
        .from('linked_social_accounts')
        .insert({
          user_id: user.id,
          platform: selectedPlatform,
          username: username || null,
          profile_url: profileUrl || null,
          display_name: username || null,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Account linked',
        description: `Successfully linked your ${SOCIAL_PLATFORMS.find(p => p.id === selectedPlatform)?.name} account`,
      });

      setAccounts(prev => [data as LinkedAccount, ...prev]);
      onAccountsChange?.([data as LinkedAccount, ...accounts]);
      setIsLinkDialogOpen(false);
      resetForm();
    } catch (error: any) {
      console.error('Error linking account:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to link account',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnlinkAccount = async (accountId: string) => {
    try {
      const { error } = await supabase
        .from('linked_social_accounts')
        .delete()
        .eq('id', accountId);

      if (error) throw error;

      toast({
        title: 'Account unlinked',
        description: 'Successfully removed the linked account',
      });

      const updated = accounts.filter(a => a.id !== accountId);
      setAccounts(updated);
      onAccountsChange?.(updated);
    } catch (error: any) {
      console.error('Error unlinking account:', error);
      toast({
        title: 'Error',
        description: 'Failed to unlink account',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setSelectedPlatform('');
    setUsername('');
    setProfileUrl('');
  };

  const getPlatformInfo = (platformId: string) => {
    return SOCIAL_PLATFORMS.find(p => p.id === platformId);
  };

  const getAvailablePlatforms = () => {
    const linkedPlatformIds = accounts.map(a => a.platform);
    return SOCIAL_PLATFORMS.filter(p => !linkedPlatformIds.includes(p.id));
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-primary" />
              Linked Social Accounts
            </CardTitle>
            <CardDescription>
              Connect your social media accounts to import and share content
            </CardDescription>
          </div>
          <Dialog open={isLinkDialogOpen} onOpenChange={setIsLinkDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={getAvailablePlatforms().length === 0}>
                <Plus className="w-4 h-4 mr-2" />
                Link Account
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Link Social Account</DialogTitle>
                <DialogDescription>
                  Connect your social media account to import content
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Platform</Label>
                  <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a platform" />
                    </SelectTrigger>
                    <SelectContent>
                      {getAvailablePlatforms().map(platform => (
                        <SelectItem key={platform.id} value={platform.id}>
                          <div className="flex items-center gap-2">
                            <div className={cn('w-5 h-5 rounded flex items-center justify-center', platform.color)}>
                              <platform.icon className="w-3 h-3 text-white" />
                            </div>
                            {platform.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Username/Handle</Label>
                  <Input
                    placeholder="@username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Profile URL (optional)</Label>
                  <Input
                    placeholder="https://..."
                    value={profileUrl}
                    onChange={(e) => setProfileUrl(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsLinkDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleLinkAccount} 
                  disabled={!selectedPlatform || isSubmitting}
                >
                  {isSubmitting ? 'Linking...' : 'Link Account'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      
      <CardContent>
        {accounts.length === 0 ? (
          <div className="text-center py-8">
            <Link2 className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-medium mb-1">No accounts linked</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Link your social media accounts to import and share content
            </p>
            <Button variant="outline" onClick={() => setIsLinkDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Link Your First Account
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map(account => {
              const platform = getPlatformInfo(account.platform);
              if (!platform) return null;
              
              return (
                <div 
                  key={account.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', platform.color)}>
                      <platform.icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{platform.name}</span>
                        {account.is_verified && (
                          <Badge variant="secondary" className="text-xs">
                            <Check className="w-3 h-3 mr-1" />
                            Verified
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {account.username ? `@${account.username}` : 'No username set'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {account.profile_url && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => window.open(account.profile_url!, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleUnlinkAccount(account.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export { SOCIAL_PLATFORMS };
export default LinkedSocialAccounts;
