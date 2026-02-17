import React, { useState, useRef, useEffect, useCallback } from 'react';
import { SwipeDismissOverlay } from './SwipeDismissOverlay';
import {
  X,
  Camera,
  Instagram,
  Twitter,
  Link2,
  Check,
  Loader2,
  Trash2,
  Youtube,
  Linkedin,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { NeuButton } from './NeuButton';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { useLocalization } from '@/contexts/LocalizationContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  uploadAvatar,
  uploadCover,
  updateProfile,
  isUsernameAvailable,
  logProfileUpdate,
  type ProfileSocialLinks,
  isValidUsername,
} from '@/services/profile.service';

const MAX_AVATAR_SIZE_MB = 2;
const MAX_COVER_SIZE_MB = 4;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const USERNAME_DEBOUNCE_MS = 500;

interface ProfileEditScreenProps {
  isOpen: boolean;
  onClose: () => void;
}

const SOCIAL_PLATFORMS: {
  key: keyof ProfileSocialLinks;
  icon: React.ReactNode;
  placeholder: string;
  colorClass: string;
}[] = [
  {
    key: 'instagram',
    icon: <Instagram className="w-5 h-5 text-white" />,
    placeholder: 'username',
    colorClass: 'from-purple-500 to-pink-500',
  },
  {
    key: 'twitter',
    icon: <Twitter className="w-5 h-5 text-white" />,
    placeholder: 'username',
    colorClass: 'bg-black',
  },
  {
    key: 'tiktok',
    icon: <span className="text-white font-bold text-sm">TT</span>,
    placeholder: 'username',
    colorClass: 'from-cyan-400 via-black to-pink-500',
  },
  {
    key: 'youtube',
    icon: <Youtube className="w-5 h-5 text-white" />,
    placeholder: '@channel or channel ID',
    colorClass: 'from-red-600 to-red-700',
  },
  {
    key: 'linkedin',
    icon: <Linkedin className="w-5 h-5 text-white" />,
    placeholder: 'profile URL or username',
    colorClass: 'from-blue-600 to-blue-700',
  },
  {
    key: 'website',
    icon: <Link2 className="w-5 h-5 text-foreground" />,
    placeholder: 'https://yourwebsite.com',
    colorClass: 'bg-secondary',
  },
];

function normalizeSocialLink(
  platform: keyof ProfileSocialLinks,
  value: string
): string {
  const v = value.trim();
  if (!v) return '';
  if (platform === 'website') {
    if (!/^https?:\/\//i.test(v)) return `https://${v}`;
    return v;
  }
  return v.replace(/^@/, '');
}

export const ProfileEditScreen: React.FC<ProfileEditScreenProps> = ({
  isOpen,
  onClose,
}) => {
  const { profile, user, refreshProfile } = useAuth();
  const { t } = useLocalization();
  const [isLoading, setIsLoading] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [coverPhotoUrl, setCoverPhotoUrl] = useState('');
  const [socialLinks, setSocialLinks] = useState<ProfileSocialLinks>({});
  const [phoneNumber, setPhoneNumber] = useState('');
  const [showContributorBadges, setShowContributorBadges] = useState(true);
  const [showTimedInteractions, setShowTimedInteractions] = useState(true);

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [usernameCheckStatus, setUsernameCheckStatus] = useState<
    'idle' | 'checking' | 'available' | 'taken' | 'invalid'
  >('idle');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const initialValuesRef = useRef<{
    displayName: string;
    username: string;
    bio: string;
    avatarUrl: string;
    coverPhotoUrl: string;
    socialLinks: ProfileSocialLinks;
  } | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const usernameDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  const defaultAvatar = `https://api.dicebear.com/7.x/avataaars/svg?seed=${username || user?.id || 'user'}`;

  const syncFromProfile = useCallback(() => {
    if (!profile) return;
    const cover = (profile as { cover_photo_url?: string })?.cover_photo_url || '';
    const links = (profile as { social_links?: ProfileSocialLinks })?.social_links || {};
    setDisplayName(profile.display_name || '');
    setUsername(profile.username || '');
    setBio(profile.bio || '');
    setAvatarUrl(profile.avatar_url || '');
    setCoverPhotoUrl(cover);
    setSocialLinks(links);
    setPhoneNumber(profile.phone_number || '');
    setShowContributorBadges(
      (profile as { show_contributor_badges?: boolean })?.show_contributor_badges ?? true
    );
    setShowTimedInteractions(
      (profile as { show_timed_interactions?: boolean })?.show_timed_interactions ?? true
    );
    setUsernameCheckStatus('idle');
    setFieldErrors({});
    initialValuesRef.current = {
      displayName: profile.display_name || '',
      username: profile.username || '',
      bio: profile.bio || '',
      avatarUrl: profile.avatar_url || '',
      coverPhotoUrl: cover,
      socialLinks: links,
    };
  }, [profile]);

  useEffect(() => {
    if (isOpen) syncFromProfile();
  }, [isOpen, syncFromProfile]);

  useEffect(() => {
    if (!username.trim()) {
      setUsernameCheckStatus('idle');
      return;
    }
    if (username.length < 3) {
      setUsernameCheckStatus('invalid');
      return;
    }
    if (!isValidUsername(username)) {
      setUsernameCheckStatus('invalid');
      return;
    }
    setUsernameCheckStatus('checking');
    usernameDebounceRef.current = setTimeout(async () => {
      const result = await isUsernameAvailable(username, user?.id);
      setUsernameCheckStatus(result.available ? 'available' : 'taken');
    }, USERNAME_DEBOUNCE_MS);
    return () => {
      if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);
    };
  }, [username, user?.id]);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!displayName.trim()) {
      errors.displayName = t('profileEdit.errors.displayNameRequired');
    }
    if (!username.trim()) {
      errors.username = t('profileEdit.errors.usernameRequired');
    } else if (!isValidUsername(username)) {
      errors.username = t('profileEdit.errors.usernameInvalid');
    } else if (usernameCheckStatus === 'taken') {
      errors.username = t('profileEdit.errors.usernameTaken');
    }
    if (bio.length > 500) {
      errors.bio = t('profileEdit.errors.bioTooLong');
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error(t('profileEdit.errors.invalidImageType'));
      return;
    }
    if (file.size > MAX_AVATAR_SIZE_MB * 1024 * 1024) {
      toast.error(t('profileEdit.errors.avatarTooLarge', {
        max: String(MAX_AVATAR_SIZE_MB),
      }));
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setAvatarUrl(previewUrl);
    setAvatarUploading(true);
    const result = await uploadAvatar(user.id, file);
    URL.revokeObjectURL(previewUrl);
    setAvatarUploading(false);
    if ('error' in result) {
      toast.error(result.error);
      setAvatarUrl(profile?.avatar_url || '');
    } else {
      setAvatarUrl(result.url);
      toast.success(t('profileEdit.avatarUpdated'));
    }
    e.target.value = '';
  };

  const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error(t('profileEdit.errors.invalidImageType'));
      return;
    }
    if (file.size > MAX_COVER_SIZE_MB * 1024 * 1024) {
      toast.error(t('profileEdit.errors.coverTooLarge', {
        max: String(MAX_COVER_SIZE_MB),
      }));
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setCoverPhotoUrl(previewUrl);
    setCoverUploading(true);
    const result = await uploadCover(user.id, file);
    URL.revokeObjectURL(previewUrl);
    setCoverUploading(false);
    if ('error' in result) {
      toast.error(result.error);
      setCoverPhotoUrl(
        (profile as { cover_photo_url?: string })?.cover_photo_url || ''
      );
    } else {
      setCoverPhotoUrl(result.url);
      toast.success(t('profileEdit.coverUpdated'));
    }
    e.target.value = '';
  };

  const handleRemoveAvatar = () => {
    setAvatarUrl('');
    toast.info(t('profileEdit.avatarRemoved'));
  };

  const handleRemoveCover = () => {
    setCoverPhotoUrl('');
    toast.info(t('profileEdit.coverRemoved'));
  };

  const updateSocialLink = (platform: keyof ProfileSocialLinks, value: string) => {
    setSocialLinks((prev) => ({
      ...prev,
      [platform]: normalizeSocialLink(platform, value) || undefined,
    }));
  };

  const handleSave = async () => {
    if (!user) return;
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const links: ProfileSocialLinks = {};
      for (const [k, v] of Object.entries(socialLinks)) {
        if (v && String(v).trim()) links[k as keyof ProfileSocialLinks] = String(v).trim();
      }

      const result = await updateProfile(user.id, {
        display_name: displayName.trim() || null,
        username: username.trim().toLowerCase() || null,
        bio: bio.trim() || null,
        avatar_url: avatarUrl || null,
        cover_photo_url: coverPhotoUrl || null,
        social_links: Object.keys(links).length ? links : null,
        show_contributor_badges: showContributorBadges,
        show_timed_interactions: showTimedInteractions,
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      const updatedFields = [
        'display_name',
        'username',
        'bio',
        'avatar',
        'cover',
        'social_links',
      ];
      await logProfileUpdate(user.id, updatedFields);
      await refreshProfile();
      toast.success(t('profileEdit.saveSuccess'));
      onClose();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(msg || t('profileEdit.saveError'));
    } finally {
      setIsLoading(false);
    }
  };

  const isDirty = (() => {
    const init = initialValuesRef.current;
    if (!init) return false;
    const linksChanged =
      JSON.stringify(socialLinks) !== JSON.stringify(init.socialLinks);
    return (
      displayName !== init.displayName ||
      username !== init.username ||
      bio !== init.bio ||
      avatarUrl !== init.avatarUrl ||
      coverPhotoUrl !== init.coverPhotoUrl ||
      linksChanged
    );
  })();

  const handleClose = () => {
    if (isDirty) {
      setShowDiscardConfirm(true);
    } else {
      setFieldErrors({});
      onClose();
    }
  };

  const handleDiscardConfirm = () => {
    setShowDiscardConfirm(false);
    setFieldErrors({});
    onClose();
  };

  const isUploading = avatarUploading || coverUploading;

  return (
    <>
    <SwipeDismissOverlay isOpen={isOpen} onClose={handleClose}>
      <div className="max-w-md mx-auto h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50 shrink-0">
          <NeuButton
            onClick={handleClose}
            size="sm"
            disabled={isLoading}
            aria-label={t('common.close')}
          >
            <X className="w-5 h-5" />
          </NeuButton>
          <h1 className="font-display text-lg font-bold">
            {t('profile.editProfile')}
          </h1>
          <Button
            onClick={handleSave}
            disabled={isLoading || isUploading}
            size="sm"
            className="gap-2"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
            ) : (
              <Check className="w-4 h-4" aria-hidden />
            )}
            {t('common.save')}
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto pb-24">
          {/* Cover Photo */}
          <div className="relative h-36 bg-gradient-to-r from-primary/20 to-secondary/20">
            {coverPhotoUrl ? (
              <img
                src={coverPhotoUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : null}
            <div className="absolute inset-0 bg-black/20" aria-hidden />
            <div className="absolute bottom-2 right-2 flex gap-2">
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                disabled={coverUploading}
                className="w-10 h-10 rounded-full bg-background/90 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors disabled:opacity-60"
                aria-label={t('profileEdit.changeCover')}
              >
                {coverUploading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-foreground" />
                ) : (
                  <Camera className="w-5 h-5 text-foreground" />
                )}
              </button>
              {coverPhotoUrl && (
                <button
                  type="button"
                  onClick={handleRemoveCover}
                  disabled={coverUploading}
                  className="w-10 h-10 rounded-full bg-destructive/90 text-destructive-foreground flex items-center justify-center hover:bg-destructive transition-colors disabled:opacity-60"
                  aria-label={t('profileEdit.removeCover')}
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
            <input
              ref={coverInputRef}
              type="file"
              accept={ALLOWED_IMAGE_TYPES.join(',')}
              className="hidden"
              onChange={handleCoverChange}
            />
          </div>

          {/* Avatar */}
          <div className="px-4 -mt-14 mb-6">
            <div className="relative w-28 h-28">
              <div className="w-28 h-28 rounded-full ring-4 ring-background overflow-hidden shadow-xl bg-secondary">
                <img
                  src={avatarUrl || defaultAvatar}
                  alt=""
                  className="w-full h-full object-cover"
                />
                {avatarUploading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-white" />
                  </div>
                )}
              </div>
              <div className="absolute -bottom-1 -right-1 flex gap-1">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
                  aria-label={t('profileEdit.changeAvatar')}
                >
                  <Camera className="w-4 h-4" />
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    disabled={avatarUploading}
                    className="w-9 h-9 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-lg hover:bg-destructive/90 transition-colors disabled:opacity-60"
                    aria-label={t('profileEdit.removeAvatar')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <input
                ref={avatarInputRef}
                type="file"
                accept={ALLOWED_IMAGE_TYPES.join(',')}
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
                <Label htmlFor="displayName">{t('profileEdit.displayName')}</Label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t('profileEdit.displayNamePlaceholder')}
                  className={cn(
                    'neu-inset',
                    fieldErrors.displayName && 'border-destructive'
                  )}
                  maxLength={50}
                  aria-invalid={!!fieldErrors.displayName}
                  aria-describedby={
                    fieldErrors.displayName ? 'displayName-error' : undefined
                  }
                />
                {fieldErrors.displayName && (
                  <p
                    id="displayName-error"
                    className="text-xs text-destructive"
                    role="alert"
                  >
                    {fieldErrors.displayName}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">{t('profileEdit.username')}</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    @
                  </span>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) =>
                      setUsername(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9_]/g, '')
                      )
                    }
                    placeholder={t('profileEdit.usernamePlaceholder')}
                    className={cn(
                      'neu-inset pl-8',
                      fieldErrors.username && 'border-destructive'
                    )}
                    maxLength={30}
                    aria-invalid={!!fieldErrors.username}
                    aria-describedby={
                      fieldErrors.username ? 'username-error' : undefined
                    }
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2">
                    {usernameCheckStatus === 'checking' && (
                      <Loader2
                        className="w-4 h-4 animate-spin text-muted-foreground"
                        aria-hidden
                      />
                    )}
                    {usernameCheckStatus === 'available' && (
                      <Check
                        className="w-4 h-4 text-green-600"
                        aria-label={t('profileEdit.usernameAvailable')}
                      />
                    )}
                    {usernameCheckStatus === 'taken' && (
                      <span
                        className="text-xs text-destructive"
                        aria-label={t('profileEdit.usernameTaken')}
                      >
                        ✕
                      </span>
                    )}
                  </span>
                </div>
                {fieldErrors.username && (
                  <p
                    id="username-error"
                    className="text-xs text-destructive"
                    role="alert"
                  >
                    {fieldErrors.username}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {t('profileEdit.usernameHint')}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">{t('profileEdit.bio')}</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder={t('profileEdit.bioPlaceholder')}
                  className={cn(
                    'neu-inset resize-none',
                    fieldErrors.bio && 'border-destructive'
                  )}
                  rows={4}
                  maxLength={500}
                  aria-invalid={!!fieldErrors.bio}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {bio.length}/500
                </p>
                {fieldErrors.bio && (
                  <p className="text-xs text-destructive" role="alert">
                    {fieldErrors.bio}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">{t('profileEdit.phone')}</Label>
                <Input
                  id="phone"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder={t('profileEdit.phonePlaceholder')}
                  className="neu-inset"
                  type="tel"
                  disabled
                  aria-describedby="phone-hint"
                />
                <p id="phone-hint" className="text-xs text-muted-foreground">
                  {t('profileEdit.phoneHint')}
                </p>
              </div>
            </div>

            {/* Social Links */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">
                {t('profileEdit.socialLinks')}
              </Label>
              <div className="space-y-3">
                {SOCIAL_PLATFORMS.map(({ key, icon, placeholder, colorClass }) => (
                  <div key={key} className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
                        colorClass.startsWith('from')
                          ? `bg-gradient-to-br ${colorClass}`
                          : colorClass
                      )}
                    >
                      {icon}
                    </div>
                    <Input
                      value={socialLinks[key] || ''}
                      onChange={(e) =>
                        updateSocialLink(key, e.target.value)
                      }
                      placeholder={placeholder}
                      className="flex-1 neu-inset"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Profile Preferences */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">
                {t('profileEdit.preferences')}
              </Label>
              <div className="space-y-3 rounded-xl border border-border/50 p-4 bg-muted/30">
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <span className="text-sm">
                    {t('profileEdit.showContributorBadges')}
                  </span>
                  <input
                    type="checkbox"
                    checked={showContributorBadges}
                    onChange={(e) =>
                      setShowContributorBadges(e.target.checked)
                    }
                    className="rounded border-border"
                  />
                </label>
                <label className="flex items-center justify-between gap-3 cursor-pointer">
                  <span className="text-sm">
                    {t('profileEdit.showTimedInteractions')}
                  </span>
                  <input
                    type="checkbox"
                    checked={showTimedInteractions}
                    onChange={(e) =>
                      setShowTimedInteractions(e.target.checked)
                    }
                    className="rounded border-border"
                  />
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SwipeDismissOverlay>

    <AlertDialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('profileEditConfirm.discardTitle')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('profileEditConfirm.discardDescription')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDiscardConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {t('profileEditConfirm.discard')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
};
