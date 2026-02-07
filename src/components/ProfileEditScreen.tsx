import React, { useState, useRef } from 'react';
import { SwipeDismissOverlay } from './SwipeDismissOverlay';
import { X, Camera, Upload, Instagram, Twitter, Link2, Check, Loader2 } from 'lucide-react';
import { NeuButton } from './NeuButton';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ProfileEditScreenProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SocialLinks {
  instagram?: string;
  twitter?: string;
  tiktok?: string;
  website?: string;
}

export const ProfileEditScreen: React.FC<ProfileEditScreenProps> = ({
  isOpen,
  onClose,
}) => {
  const { profile, user, refreshProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url || '');
  const [coverPhotoUrl, setCoverPhotoUrl] = useState((profile as any)?.cover_photo_url || '');
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(
    (profile as any)?.social_links || {}
  );
  
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // For demo, create a preview URL
    const previewUrl = URL.createObjectURL(file);
    setAvatarUrl(previewUrl);
    toast.success('Avatar updated! (Preview only - storage not configured)');
  };

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // For demo, create a preview URL  
    const previewUrl = URL.createObjectURL(file);
    setCoverPhotoUrl(previewUrl);
    toast.success('Cover photo updated! (Preview only - storage not configured)');
  };

  const handleSave = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName,
          username: username,
          bio: bio,
          avatar_url: avatarUrl,
          cover_photo_url: coverPhotoUrl,
          social_links: JSON.parse(JSON.stringify(socialLinks)),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);

      if (error) throw error;

      // Log the profile update activity
      await supabase.from('account_activity_logs').insert({
        user_id: user.id,
        activity_type: 'profile_update',
        status: 'success',
        details: { updated_fields: ['display_name', 'username', 'bio', 'avatar', 'cover', 'social_links'] }
      });

      await refreshProfile();
      toast.success('Profile updated successfully!');
      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const updateSocialLink = (platform: keyof SocialLinks, value: string) => {
    setSocialLinks(prev => ({ ...prev, [platform]: value }));
  };

  const defaultAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username || 'user'}`;

  return (
    <SwipeDismissOverlay isOpen={isOpen} onClose={onClose}>
      <div className="max-w-md mx-auto h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <NeuButton onClick={onClose} size="sm" disabled={isLoading}>
            <X className="w-5 h-5" />
          </NeuButton>
          <h1 className="font-display text-lg font-bold">Edit Profile</h1>
          <Button 
            onClick={handleSave} 
            disabled={isLoading}
            size="sm"
            className="gap-2"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Save
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto pb-24">
          {/* Cover Photo */}
          <div className="relative h-32 bg-gradient-to-r from-primary/20 to-secondary/20">
            {coverPhotoUrl && (
              <img 
                src={coverPhotoUrl} 
                alt="Cover" 
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            <button 
              onClick={() => coverInputRef.current?.click()}
              className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors"
            >
              <Camera className="w-5 h-5 text-foreground" />
            </button>
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleCoverChange}
            />
          </div>

          {/* Avatar */}
          <div className="px-4 -mt-12 mb-6">
            <div className="relative w-24 h-24">
              <div className="w-24 h-24 rounded-full ring-4 ring-background overflow-hidden shadow-xl bg-secondary">
                <img 
                  src={avatarUrl || defaultAvatar}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              </div>
              <button 
                onClick={() => avatarInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
          </div>

          {/* Form Fields */}
          <div className="px-4 space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">Display Name</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your display name"
                  className="neu-inset"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="username"
                    className="neu-inset pl-8"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell us about yourself..."
                  className="neu-inset resize-none"
                  rows={3}
                  maxLength={160}
                />
                <p className="text-xs text-muted-foreground text-right">{bio.length}/160</p>
              </div>
            </div>

            {/* Social Links */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Social Links</Label>
              
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                    <Instagram className="w-5 h-5 text-white" />
                  </div>
                  <Input
                    value={socialLinks.instagram || ''}
                    onChange={(e) => updateSocialLink('instagram', e.target.value)}
                    placeholder="instagram username"
                    className="flex-1 neu-inset"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center">
                    <Twitter className="w-5 h-5 text-white" />
                  </div>
                  <Input
                    value={socialLinks.twitter || ''}
                    onChange={(e) => updateSocialLink('twitter', e.target.value)}
                    placeholder="twitter/x username"
                    className="flex-1 neu-inset"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 via-black to-pink-500 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">TT</span>
                  </div>
                  <Input
                    value={socialLinks.tiktok || ''}
                    onChange={(e) => updateSocialLink('tiktok', e.target.value)}
                    placeholder="tiktok username"
                    className="flex-1 neu-inset"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                    <Link2 className="w-5 h-5 text-foreground" />
                  </div>
                  <Input
                    value={socialLinks.website || ''}
                    onChange={(e) => updateSocialLink('website', e.target.value)}
                    placeholder="https://yourwebsite.com"
                    className="flex-1 neu-inset"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SwipeDismissOverlay>
  );
};
