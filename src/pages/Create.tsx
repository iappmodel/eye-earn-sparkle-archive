import React, { useState, useEffect, forwardRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Image, Video, Megaphone, Target, X, MapPin, Hash, Link as LinkIcon, DollarSign, Clapperboard, Wand2, Clock, Calendar, Save, RotateCcw, Share2, Camera, Upload, Eye, Sparkles, History, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ContentUpload } from '@/components/ContentUpload';
import {
  CONTENT_STATUS_ACTIVE,
  CONTENT_STATUS_SCHEDULED,
  type UserContentStatus,
} from '@/constants/contentStatus';
import { useDraftSave } from '@/hooks/useDraftSave';
import { aiService } from '@/services/ai.service';
import { format, formatDistanceToNow } from 'date-fns';
import { TikTokCamera } from '@/components/TikTokCamera';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

type ContentType = 'post' | 'story' | 'promotion' | 'campaign';
type MediaType = 'image' | 'video' | 'carousel';

const CAPTION_MAX = 2200;
const TITLE_MAX = 100;
const TAG_MAX = 30;
const TAG_MAX_COUNT = 30;

const CTA_OPTIONS = [
  { value: '', label: 'Select CTA...' },
  { value: 'shop_now', label: 'Shop Now' },
  { value: 'learn_more', label: 'Learn More' },
  { value: 'sign_up', label: 'Sign Up' },
  { value: 'book_now', label: 'Book Now' },
  { value: 'contact_us', label: 'Contact Us' },
  { value: 'get_offer', label: 'Get Offer' },
  { value: 'subscribe', label: 'Subscribe' },
  { value: 'download', label: 'Download' },
  { value: 'watch_now', label: 'Watch Now' },
];

interface ContentForm {
  title: string;
  caption: string;
  tags: string[];
  tagInput: string;
  mediaUrl: string | null;
  mediaType: MediaType;
  locationAddress: string;
  callToAction: string;
  externalLink: string;
  budget: string;
  targetAudience: string;
  endDate: string;
  isPublic: boolean;
}

interface FormErrors {
  caption?: string;
  title?: string;
  externalLink?: string;
  budget?: string;
  endDate?: string;
}

const contentTypes: { id: ContentType; label: string; icon: React.ReactNode; description: string; color: string }[] = [
  { id: 'post', label: 'Post', icon: <Image className="w-6 h-6" />, description: 'Share photos & videos with your followers', color: 'from-blue-500 to-cyan-500' },
  { id: 'story', label: 'Story', icon: <Video className="w-6 h-6" />, description: '24-hour content that disappears', color: 'from-pink-500 to-rose-500' },
  { id: 'promotion', label: 'Promotion', icon: <Megaphone className="w-6 h-6" />, description: 'Promote your business locally', color: 'from-amber-500 to-orange-500' },
  { id: 'campaign', label: 'Campaign', icon: <Target className="w-6 h-6" />, description: 'Run targeted ad campaigns', color: 'from-purple-500 to-violet-500' },
];

const Create = forwardRef<HTMLDivElement>((_, ref) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [selectedType, setSelectedType] = useState<ContentType | null>(null);

  // Preselect type when navigating from Creator Tools (e.g. state.preselectedType === 'promotion')
  useEffect(() => {
    const preselected = (location.state as { preselectedType?: ContentType })?.preselectedType;
    if (preselected && ['post', 'story', 'promotion', 'campaign'].includes(preselected)) {
      setSelectedType(preselected);
    }
  }, [location.state]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [enableSchedule, setEnableSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [showDraftRestore, setShowDraftRestore] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [pendingContentType, setPendingContentType] = useState<ContentType | null>(null);
  const [showMediaChoice, setShowMediaChoice] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [suggestingCaption, setSuggestingCaption] = useState(false);
  const importDraftInputRef = React.useRef<HTMLInputElement>(null);

  const handleContentTypeSelect = (typeId: ContentType) => {
    setPendingContentType(typeId);
    setShowMediaChoice(true);
  };

  const handleChooseCamera = () => {
    setShowMediaChoice(false);
    if (pendingContentType) setShowCamera(true);
  };

  const handleChooseUploadOrSkip = () => {
    setShowMediaChoice(false);
    if (pendingContentType) {
      setSelectedType(pendingContentType);
      setPendingContentType(null);
    }
  };

  const handleCameraCapture = async (blob: Blob, type: 'photo' | 'video') => {
    setShowCamera(false);
    if (pendingContentType && user) {
      setSelectedType(pendingContentType);
      try {
        const ext = type === 'photo' ? 'jpg' : 'webm';
        const fileName = `${user.id}/content/${Date.now()}_${type}.${ext}`;
        const file = new File([blob], `capture.${ext}`, {
          type: type === 'photo' ? 'image/jpeg' : 'video/webm',
        });

        const { data, error } = await supabase.storage
          .from('content-uploads')
          .upload(fileName, file, {
            contentType: file.type,
            cacheControl: '3600',
          });

        if (error) throw error;

        const { data: urlData } = supabase.storage
          .from('content-uploads')
          .getPublicUrl(data.path);

        setForm(prev => ({
          ...prev,
          mediaUrl: urlData.publicUrl,
          mediaType: type === 'photo' ? 'image' : 'video',
        }));

        toast.success('Media captured and ready!');
      } catch (err) {
        console.error('Upload error:', err);
        toast.error('Failed to upload captured media');
      }
    }
    setPendingContentType(null);
  };

  const handleCameraClose = () => {
    setShowCamera(false);
    if (pendingContentType) {
      // If they close camera, still go to the form
      setSelectedType(pendingContentType);
    }
    setPendingContentType(null);
  };
  const [form, setForm] = useState<ContentForm>({
    title: '',
    caption: '',
    tags: [],
    tagInput: '',
    mediaUrl: null,
    mediaType: 'image',
    locationAddress: '',
    callToAction: '',
    externalLink: '',
    budget: '',
    targetAudience: '',
    endDate: '',
    isPublic: true,
  });

  // Draft save: single setter updates both form and schedule state for restore
  const setFormData = useCallback((data: Partial<ContentForm & { enableSchedule?: boolean; scheduleDate?: string; scheduleTime?: string }>) => {
    setForm(prev => ({
      ...prev,
      ...data,
      mediaType: (data.mediaType as MediaType) || prev.mediaType,
    }));
    if (data.enableSchedule !== undefined) setEnableSchedule(data.enableSchedule);
    if (data.scheduleDate !== undefined) setScheduleDate(data.scheduleDate);
    if (data.scheduleTime !== undefined) setScheduleTime(data.scheduleTime);
  }, []);

  const { saveDraft, hasDraft, restoreDraft, clearDraft, getDraftTimestamp, getDraftMetadata, listVersions, restoreVersion, lastSavedAt, isSaving, isDirty, exportDraft, importDraft } = useDraftSave(
    user?.id,
    selectedType,
    {
      title: form.title,
      caption: form.caption,
      tags: form.tags,
      mediaUrl: form.mediaUrl,
      mediaType: form.mediaType,
      locationAddress: form.locationAddress,
      callToAction: form.callToAction,
      externalLink: form.externalLink,
      budget: form.budget,
      targetAudience: form.targetAudience,
      endDate: form.endDate,
      isPublic: form.isPublic,
      enableSchedule,
      scheduleDate,
      scheduleTime,
    },
    setFormData
  );

  // Check for existing draft when content type is selected
  useEffect(() => {
    if (selectedType && hasDraft()) {
      setShowDraftRestore(true);
    }
  }, [selectedType, hasDraft]);

  const handleRestoreDraft = () => {
    restoreDraft();
    setShowDraftRestore(false);
    toast.success('Draft restored');
  };

  const handleDiscardDraft = () => {
    clearDraft();
    setShowDraftRestore(false);
  };

  const handleImportDraftFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      if (importDraft(text)) {
        toast.success('Draft imported');
        if (importDraftInputRef.current) importDraftInputRef.current.value = '';
      } else {
        toast.error('Invalid draft file');
      }
    };
    reader.readAsText(file);
  };

  const handleBack = () => {
    if (selectedType) {
      saveDraft();
      setSelectedType(null);
    } else {
      navigate('/');
    }
  };

  const validateForm = useCallback((): boolean => {
    const err: FormErrors = {};
    if (!form.caption.trim() && selectedType !== 'story') {
      err.caption = 'Caption is required';
    }
    if (form.caption.length > CAPTION_MAX) {
      err.caption = `Caption must be ${CAPTION_MAX} characters or less`;
    }
    if ((selectedType === 'promotion' || selectedType === 'campaign') && form.title && form.title.length > TITLE_MAX) {
      err.title = `Title must be ${TITLE_MAX} characters or less`;
    }
    if ((selectedType === 'promotion' || selectedType === 'campaign') && form.externalLink.trim()) {
      try {
        new URL(form.externalLink);
      } catch {
        err.externalLink = 'Please enter a valid URL';
      }
    }
    if ((selectedType === 'promotion' || selectedType === 'campaign') && form.budget.trim()) {
      const n = parseInt(form.budget, 10);
      if (Number.isNaN(n) || n < 0) err.budget = 'Budget must be a positive number';
    }
    if ((selectedType === 'promotion' || selectedType === 'campaign') && form.endDate) {
      const end = new Date(form.endDate);
      if (Number.isNaN(end.getTime()) || end <= new Date()) {
        err.endDate = 'End date must be in the future';
      }
    }
    setFormErrors(err);
    return Object.keys(err).length === 0;
  }, [form, selectedType]);

  const handleAddTag = () => {
    const tag = form.tagInput.trim().slice(0, TAG_MAX);
    if (tag && !form.tags.includes(tag) && form.tags.length < TAG_MAX_COUNT) {
      setForm(prev => ({
        ...prev,
        tags: [...prev.tags, tag],
        tagInput: '',
      }));
    }
  };

  const handleRemoveTag = (tag: string) => {
    setForm(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag),
    }));
  };

  const handleUploadComplete = (url: string | string[], type: MediaType) => {
    const mediaUrl = Array.isArray(url) ? JSON.stringify(url) : url;
    setForm(prev => ({ ...prev, mediaUrl, mediaType: type }));
  };

  const handleSaveDraft = async () => {
    if (!user || !selectedType) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('user_content').insert({
        user_id: user.id,
        content_type: selectedType,
        title: form.title || null,
        caption: form.caption || null,
        tags: form.tags,
        media_url: form.mediaUrl || null,
        media_type: form.mediaType,
        location_address: form.locationAddress || null,
        status: 'draft',
        is_draft: true,
        is_public: form.isPublic ?? true,
        draft_saved_at: new Date().toISOString(),
        call_to_action: (selectedType === 'promotion' || selectedType === 'campaign') ? (form.callToAction || null) : null,
        external_link: (selectedType === 'promotion' || selectedType === 'campaign') ? (form.externalLink || null) : null,
        budget: (selectedType === 'promotion' || selectedType === 'campaign') && form.budget ? parseInt(form.budget, 10) : null,
        target_audience: (selectedType === 'promotion' || selectedType === 'campaign') ? (form.targetAudience || null) : null,
      });

      if (error) throw error;

      clearDraft();
      toast.success('Draft saved to your content');
      navigate('/my-page');
    } catch (error) {
      console.error('Error saving draft:', error);
      toast.error('Failed to save draft');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (fromPreview = false) => {
    if (!user || !selectedType) return;
    if (!fromPreview && !validateForm()) {
      toast.error('Please fix the errors before publishing');
      return;
    }

    setIsSubmitting(true);
    try {
      let expiresAt: string | null = null;
      if (selectedType === 'story') {
        const expires = new Date();
        expires.setHours(expires.getHours() + 24);
        expiresAt = expires.toISOString();
      } else if ((selectedType === 'promotion' || selectedType === 'campaign') && form.endDate) {
        const end = new Date(form.endDate);
        end.setHours(23, 59, 59, 999);
        expiresAt = end.toISOString();
      }

      let scheduledAt: string | null = null;
      let status: UserContentStatus = CONTENT_STATUS_ACTIVE;
      let publishedAt: string | null = new Date().toISOString();

      if (selectedType !== 'story' && enableSchedule && scheduleDate && scheduleTime) {
        scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
        status = CONTENT_STATUS_SCHEDULED;
        publishedAt = null;
      }

      const { error } = await supabase.from('user_content').insert({
        user_id: user.id,
        content_type: selectedType,
        title: form.title || null,
        caption: form.caption || null,
        tags: form.tags,
        media_url: form.mediaUrl || null,
        media_type: form.mediaType,
        location_address: form.locationAddress || null,
        status,
        published_at: publishedAt,
        scheduled_at: scheduledAt,
        expires_at: expiresAt,
        is_draft: false,
        is_public: form.isPublic ?? true,
        call_to_action: (selectedType === 'promotion' || selectedType === 'campaign') ? (form.callToAction || null) : null,
        external_link: (selectedType === 'promotion' || selectedType === 'campaign') ? (form.externalLink || null) : null,
        budget: (selectedType === 'promotion' || selectedType === 'campaign') && form.budget ? parseInt(form.budget, 10) : null,
        target_audience: (selectedType === 'promotion' || selectedType === 'campaign') ? (form.targetAudience || null) : null,
      });

      if (error) throw error;

      clearDraft();
      setShowPreview(false);

      if (status === 'scheduled') {
        toast.success(`${selectedType!.charAt(0).toUpperCase() + selectedType!.slice(1)} scheduled!`, {
          description: `Will be published on ${format(new Date(scheduledAt!), 'MMM d, h:mm a')}`,
        });
      } else {
        toast.success(`${selectedType!.charAt(0).toUpperCase() + selectedType!.slice(1)} published!`, {
          description: 'Earn rewards as people engage with your content.',
        });
      }

      navigate('/');
    } catch (error) {
      console.error('Error creating content:', error);
      toast.error('Failed to create content');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedTypeInfo = contentTypes.find(t => t.id === selectedType);
  const draftTime = getDraftTimestamp();

  return (
    <>
    <div ref={ref} className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-dark border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3 gap-2">
          <button onClick={handleBack} className="p-2 -ml-2 hover:bg-muted/50 rounded-full transition-colors shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0 flex flex-col items-center">
            <h1 className="text-lg font-semibold truncate w-full text-center">
              {selectedType ? `Create ${selectedTypeInfo?.label}` : 'Create'}
            </h1>
            {selectedType && (
              <p className="text-xs text-muted-foreground truncate w-full text-center">
                {isSaving ? (
                  <span className="inline-flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Saving…
                  </span>
                ) : lastSavedAt ? (
                  <span>Saved {formatDistanceToNow(lastSavedAt, { addSuffix: true })}</span>
                ) : isDirty?.() ? (
                  <span>Unsaved changes</span>
                ) : null}
              </p>
            )}
          </div>
          {selectedType && (
            <div className="flex items-center gap-1 shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9" title="Draft options">
                    <History className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  {listVersions?.().length > 0 && (
                    <>
                      <DropdownMenuLabel>Restore previous version</DropdownMenuLabel>
                      {listVersions().map((v) => (
                        <DropdownMenuItem
                          key={v.index}
                          onClick={() => {
                            restoreVersion?.(v.index);
                            toast.success('Version restored. You can edit and save again.');
                          }}
                        >
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="truncate text-sm">{v.preview || 'Untitled'}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(v.savedAt, { addSuffix: true })}
                            </span>
                          </div>
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuLabel className="mt-1">Backup</DropdownMenuLabel>
                    </>
                  )}
                  {(!listVersions || listVersions().length === 0) && (
                    <DropdownMenuLabel>Backup</DropdownMenuLabel>
                  )}
                  <DropdownMenuItem
                    onClick={() => {
                      const json = exportDraft();
                      if (json) {
                        const blob = new Blob([json], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `draft-${selectedType}-${format(new Date(), 'yyyy-MM-dd-HHmm')}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                        toast.success('Draft exported');
                      }
                    }}
                  >
                    Export draft (JSON)
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => importDraftInputRef.current?.click()}
                  >
                    Import draft (JSON)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="ghost" size="sm" onClick={handleSaveDraft} disabled={isSubmitting} title="Save draft to My Content">
                <Save className="w-4 h-4" />
              </Button>
            </div>
          )}
          {!selectedType && <div className="w-9" />}
        </div>
      </header>

      <main className="pb-24">
        {!selectedType ? (
          /* Content Type Selection */
          <div className="p-4 space-y-4">
            <div className="text-center py-6">
              <h2 className="text-2xl font-bold mb-2">What do you want to create?</h2>
              <p className="text-muted-foreground">Choose a content type to get started</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {contentTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => handleContentTypeSelect(type.id)}
                  className={cn(
                    'relative overflow-hidden rounded-2xl p-4 text-left transition-all duration-300',
                    'hover:scale-[1.02] active:scale-[0.98]',
                    'bg-gradient-to-br', type.color,
                    'shadow-lg hover:shadow-xl'
                  )}
                  aria-label={`Create ${type.label}: ${type.description}`}
                >
                  <div className="absolute inset-0 bg-black/20" />
                  <div className="relative z-10 text-white">
                    <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center mb-3">
                      {type.icon}
                    </div>
                    <h3 className="font-bold text-lg mb-1">{type.label}</h3>
                    <p className="text-xs text-white/80 leading-tight">{type.description}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Media choice dialog */}
            <Dialog open={showMediaChoice} onOpenChange={(open) => { if (!open) setPendingContentType(null); setShowMediaChoice(open); }}>
              <DialogContent className="sm:max-w-md" aria-describedby="media-choice-desc">
                <DialogHeader>
                  <DialogTitle>
                    Add media for your {contentTypes.find(t => t.id === pendingContentType)?.label?.toLowerCase()}
                  </DialogTitle>
                  <DialogDescription id="media-choice-desc">
                    Take a photo or video now, or upload from your device later.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <Button onClick={handleChooseCamera} className="h-auto py-4 flex flex-col gap-2">
                    <Camera className="w-8 h-8" />
                    <span>Camera</span>
                  </Button>
                  <Button variant="secondary" onClick={handleChooseUploadOrSkip} className="h-auto py-4 flex flex-col gap-2">
                    <Upload className="w-8 h-8" />
                    <span>Upload or skip</span>
                  </Button>
                </div>
                <DialogFooter className="sm:justify-start">
                  <Button variant="ghost" onClick={() => { setShowMediaChoice(false); setPendingContentType(null); }}>
                    Cancel
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Import from Social Media */}
            <div className="p-4 rounded-2xl bg-muted/50 border border-border">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <Share2 className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold mb-1">Import from Social Media</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Import content from Instagram, TikTok, YouTube, and more
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate('/social-connect')}
                  >
                    <LinkIcon className="w-4 h-4 mr-2" />
                    Import Media
                  </Button>
                </div>
              </div>
            </div>

            {/* Rewards Info */}
            <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <DollarSign className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">Earn While You Create</h3>
                  <p className="text-sm text-muted-foreground">
                    Get rewarded based on views, likes, shares, and comments on your content.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Content Creation Form */
          <div className="p-4 space-y-6">
            {/* Draft Restore Prompt */}
            {showDraftRestore && (
              <Card className="border-primary/50 bg-primary/5">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <RotateCcw className="w-5 h-5 text-primary mt-0.5" />
                      <div>
                        <p className="font-medium">Restore Draft?</p>
                        <p className="text-sm text-muted-foreground">
                          You have an unsaved draft from {draftTime ? formatDistanceToNow(draftTime, { addSuffix: true }) : 'earlier'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={handleDiscardDraft}>
                        Discard
                      </Button>
                      <Button size="sm" onClick={handleRestoreDraft}>
                        Restore
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Content-type hint: Story */}
            {selectedType === 'story' && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-pink-500/10 border border-pink-500/20 text-sm text-pink-200">
                <Clock className="w-4 h-4 shrink-0" />
                <span>Stories disappear after 24 hours. Vertical (9:16) works best.</span>
              </div>
            )}

            {/* Media Upload Area */}
            <ContentUpload
              onUploadComplete={handleUploadComplete}
              mediaType={form.mediaType}
              existingUrl={
                form.mediaUrl?.startsWith('[')
                  ? (() => {
                      try {
                        return JSON.parse(form.mediaUrl!) as string[];
                      } catch {
                        return form.mediaUrl || undefined;
                      }
                    })()
                  : form.mediaUrl || undefined
              }
              onRemove={() => setForm(prev => ({ ...prev, mediaUrl: null }))}
            />

            {/* Media Type Selection */}
            <div className="flex justify-center gap-2">
              {(['image', 'video', 'carousel'] as MediaType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setForm(prev => ({ ...prev, mediaType: type }))}
                  className={cn(
                    'px-4 py-2 rounded-full text-sm font-medium transition-colors',
                    form.mediaType === type
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted hover:bg-muted/80'
                  )}
                >
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </button>
              ))}
            </div>

            {/* Studio Button */}
            <button
              onClick={() => navigate('/studio')}
              className={cn(
                'w-full p-4 rounded-2xl transition-all duration-300',
                'bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20',
                'border border-primary/30 hover:border-primary/50',
                'hover:shadow-lg hover:shadow-primary/20',
                'active:scale-[0.98]'
              )}
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0">
                  <Clapperboard className="w-7 h-7 text-white" />
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-lg">Open Studio</h3>
                    <Wand2 className="w-4 h-4 text-primary animate-pulse" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    AI-powered editing • Filters • Beauty tools • Effects
                  </p>
                </div>
              </div>
            </button>

            {/* Title (for promotions/campaigns) */}
            {(selectedType === 'promotion' || selectedType === 'campaign') && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input
                  placeholder="Give your content a title..."
                  value={form.title}
                  onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                  className="bg-muted/50"
                />
              </div>
            )}

            {/* Caption */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-medium">Caption</label>
                {form.mediaUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    disabled={suggestingCaption}
                    onClick={async () => {
                      setSuggestingCaption(true);
                      try {
                        const result = await aiService.analyzeContent(
                          form.mediaUrl!,
                          form.mediaType === 'video' ? 'video' : 'image'
                        );
                        const newTags = [...new Set([...form.tags, ...result.tags, ...result.suggested_hashtags])].slice(0, TAG_MAX_COUNT);
                        setForm(prev => ({
                          ...prev,
                          caption: result.suggested_caption || prev.caption,
                          tags: newTags,
                        }));
                        if (result.suggested_caption || result.tags.length || result.suggested_hashtags.length) {
                          toast.success('AI suggestions applied', {
                            description: result.suggested_caption ? 'Caption and tags updated.' : 'Tags updated.',
                          });
                        } else {
                          toast.info('No suggestions for this content');
                        }
                      } catch (e) {
                        console.error(e);
                        toast.error('Could not analyze content');
                      } finally {
                        setSuggestingCaption(false);
                      }
                    }}
                  >
                    {suggestingCaption ? (
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3 mr-1" />
                    )}
                    Suggest with AI
                  </Button>
                )}
              </div>
              <Textarea
                placeholder="Write a caption..."
                value={form.caption}
                onChange={(e) => setForm(prev => ({ ...prev, caption: e.target.value }))}
                className="bg-muted/50 min-h-[100px] resize-none"
              />
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Hash className="w-4 h-4" /> Tags
                </label>
                <span className="text-xs text-muted-foreground">{form.tags.length}/{TAG_MAX_COUNT}</span>
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Add a tag..."
                  value={form.tagInput}
                  onChange={(e) => setForm(prev => ({ ...prev, tagInput: e.target.value.slice(0, TAG_MAX) }))}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  className="bg-muted/50"
                />
                <Button variant="secondary" onClick={handleAddTag} disabled={form.tags.length >= TAG_MAX_COUNT || !form.tagInput.trim()}>Add</Button>
              </div>
              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {form.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-sm"
                    >
                      #{tag}
                      <button onClick={() => handleRemoveTag(tag)} className="hover:text-destructive">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Location */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Location
              </label>
              <Input
                placeholder="Add a location..."
                value={form.locationAddress}
                onChange={(e) => setForm(prev => ({ ...prev, locationAddress: e.target.value }))}
                className="bg-muted/50"
              />
            </div>

            {/* Scheduling (not for stories) */}
            {selectedType !== 'story' && (
              <Card>
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-primary" />
                      <div>
                        <p className="font-medium">Schedule</p>
                        <p className="text-sm text-muted-foreground">Publish at a specific time</p>
                      </div>
                    </div>
                    <Switch checked={enableSchedule} onCheckedChange={setEnableSchedule} />
                  </div>

                  {enableSchedule && (
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Date</Label>
                        <Input
                          type="date"
                          value={scheduleDate}
                          onChange={(e) => setScheduleDate(e.target.value)}
                          min={format(new Date(), 'yyyy-MM-dd')}
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
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Promotion/Campaign specific fields */}
            {(selectedType === 'promotion' || selectedType === 'campaign') && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <LinkIcon className="w-4 h-4" /> Call to Action
                  </label>
                  <Input
                    placeholder="e.g., Shop Now, Learn More..."
                    value={form.callToAction}
                    onChange={(e) => setForm(prev => ({ ...prev, callToAction: e.target.value }))}
                    className="bg-muted/50"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">External Link</label>
                  <Input
                    placeholder="https://..."
                    type="url"
                    value={form.externalLink}
                    onChange={(e) => setForm(prev => ({ ...prev, externalLink: e.target.value }))}
                    className="bg-muted/50"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="w-4 h-4" /> Budget (coins)
                  </label>
                  <Input
                    placeholder="Enter budget..."
                    type="number"
                    value={form.budget}
                    onChange={(e) => setForm(prev => ({ ...prev, budget: e.target.value }))}
                    className="bg-muted/50"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Target Audience</label>
                  <Input
                    placeholder="e.g., Local, Age 18-35..."
                    value={form.targetAudience}
                    onChange={(e) => setForm(prev => ({ ...prev, targetAudience: e.target.value }))}
                    className="bg-muted/50"
                  />
                </div>
              </>
            )}

            {/* Rewards Preview */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20">
              <h4 className="font-medium text-green-400 mb-2">💰 Potential Rewards</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Views: 1-5 ViCoins per 100 views</li>
                <li>• Likes: 2 ViCoins per like</li>
                <li>• Shares: 5 ViCoins per share</li>
                <li>• Comments: 3 ViCoins per comment</li>
              </ul>
            </div>
          </div>
        )}
      </main>

      {/* Submit / Preview bar */}
      {selectedType && (
        <div className="fixed bottom-0 left-0 right-0 p-4 glass-dark border-t border-border/50 flex flex-col gap-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                if (validateForm()) setShowPreview(true);
                else toast.error('Please fix the errors before previewing');
              }}
              disabled={isSubmitting}
            >
              <Eye className="w-4 h-4 mr-2" />
              Preview
            </Button>
            <Button
              onClick={() => handleSubmit(false)}
              disabled={isSubmitting || (selectedType !== 'story' && !form.caption.trim())}
              className="flex-[2] h-12 text-base font-semibold"
            >
              {isSubmitting ? 'Publishing...' : enableSchedule ? `Schedule ${selectedTypeInfo?.label}` : `Publish ${selectedTypeInfo?.label}`}
            </Button>
          </div>
        </div>
      )}

      {/* Preview dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto" aria-describedby="preview-desc">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              Preview
            </DialogTitle>
            <DialogDescription id="preview-desc">
              Here’s how your {selectedTypeInfo?.label?.toLowerCase()} will look.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {form.mediaUrl && (
              <div className="rounded-xl overflow-hidden bg-muted border border-border">
                {form.mediaType === 'video' ? (
                  <video src={form.mediaUrl} className="w-full aspect-video object-cover" controls />
                ) : (
                  <img src={form.mediaUrl} alt="Preview" className="w-full aspect-video object-cover" />
                )}
              </div>
            )}
            {(selectedType === 'promotion' || selectedType === 'campaign') && form.title && (
              <p className="font-semibold text-lg">{form.title}</p>
            )}
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{form.caption || '(No caption)'}</p>
            {form.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {form.tags.map((t) => (
                  <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">#{t}</span>
                ))}
              </div>
            )}
            {form.locationAddress && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="w-3 h-3" /> {form.locationAddress}
              </p>
            )}
            {(selectedType === 'promotion' || selectedType === 'campaign') && (form.callToAction || form.externalLink) && (
              <p className="text-xs">
                CTA: {CTA_OPTIONS.find(o => o.value === form.callToAction)?.label || form.callToAction}
                {form.externalLink && ` · ${form.externalLink}`}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Type: {selectedTypeInfo?.label} · {form.isPublic ? 'Public' : 'Not public'}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>Edit</Button>
            <Button onClick={() => handleSubmit(true)} disabled={isSubmitting}>
              {isSubmitting ? 'Publishing...' : 'Publish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

    <input
      ref={importDraftInputRef}
      type="file"
      accept=".json,application/json"
      className="hidden"
      onChange={handleImportDraftFile}
    />

    {/* TikTok-Style Camera */}
    <TikTokCamera
      isOpen={showCamera}
      onClose={handleCameraClose}
      onCapture={handleCameraCapture}
      contentType={pendingContentType || undefined}
    />
    </>
  );
});

Create.displayName = 'Create';

export default Create;
