import React, { useState, useEffect, forwardRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Image, Video, Megaphone, Target, X, MapPin, Hash, Link as LinkIcon, DollarSign, Clapperboard, Wand2, Clock, Calendar, Save, RotateCcw } from 'lucide-react';
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
import { useDraftSave } from '@/hooks/useDraftSave';
import { format, formatDistanceToNow } from 'date-fns';

type ContentType = 'post' | 'story' | 'promotion' | 'campaign';
type MediaType = 'image' | 'video' | 'carousel';

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
}

const contentTypes: { id: ContentType; label: string; icon: React.ReactNode; description: string; color: string }[] = [
  { id: 'post', label: 'Post', icon: <Image className="w-6 h-6" />, description: 'Share photos & videos with your followers', color: 'from-blue-500 to-cyan-500' },
  { id: 'story', label: 'Story', icon: <Video className="w-6 h-6" />, description: '24-hour content that disappears', color: 'from-pink-500 to-rose-500' },
  { id: 'promotion', label: 'Promotion', icon: <Megaphone className="w-6 h-6" />, description: 'Promote your business locally', color: 'from-amber-500 to-orange-500' },
  { id: 'campaign', label: 'Campaign', icon: <Target className="w-6 h-6" />, description: 'Run targeted ad campaigns', color: 'from-purple-500 to-violet-500' },
];

const Create = forwardRef<HTMLDivElement>((_, ref) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedType, setSelectedType] = useState<ContentType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [enableSchedule, setEnableSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [showDraftRestore, setShowDraftRestore] = useState(false);
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
  });

  // Draft save hook
  const setFormData = useCallback((data: Partial<ContentForm>) => {
    setForm(prev => ({ 
      ...prev, 
      ...data,
      mediaType: (data.mediaType as MediaType) || prev.mediaType,
    }));
  }, []);

  const { saveDraft, hasDraft, restoreDraft, clearDraft, getDraftTimestamp } = useDraftSave(
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
    },
    useCallback((data) => {
      setForm(prev => ({ 
        ...prev, 
        ...data,
        mediaType: (data.mediaType as MediaType) || prev.mediaType,
      }));
    }, [])
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

  const handleBack = () => {
    if (selectedType) {
      saveDraft();
      setSelectedType(null);
    } else {
      navigate('/');
    }
  };

  const handleAddTag = () => {
    if (form.tagInput.trim() && !form.tags.includes(form.tagInput.trim())) {
      setForm(prev => ({
        ...prev,
        tags: [...prev.tags, prev.tagInput.trim()],
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

  const handleUploadComplete = (url: string, type: 'image' | 'video') => {
    setForm(prev => ({ ...prev, mediaUrl: url, mediaType: type }));
  };

  const handleSaveDraft = async () => {
    if (!user || !selectedType) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('user_content').insert({
        user_id: user.id,
        content_type: selectedType,
        title: form.title || null,
        caption: form.caption,
        tags: form.tags,
        media_url: form.mediaUrl || null,
        media_type: form.mediaType,
        location_address: form.locationAddress || null,
        status: 'draft',
        is_draft: true,
        draft_saved_at: new Date().toISOString(),
        call_to_action: (selectedType === 'promotion' || selectedType === 'campaign') ? (form.callToAction || null) : null,
        external_link: (selectedType === 'promotion' || selectedType === 'campaign') ? (form.externalLink || null) : null,
        budget: (selectedType === 'promotion' || selectedType === 'campaign') && form.budget ? parseInt(form.budget) : null,
        target_audience: (selectedType === 'promotion' || selectedType === 'campaign') ? (form.targetAudience || null) : null,
      });

      if (error) throw error;

      clearDraft();
      toast.success('Draft saved to your content');
      navigate('/mypage');
    } catch (error) {
      console.error('Error saving draft:', error);
      toast.error('Failed to save draft');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || !selectedType) return;

    setIsSubmitting(true);
    try {
      // Build expires_at for stories
      let expiresAt: string | null = null;
      if (selectedType === 'story') {
        const expires = new Date();
        expires.setHours(expires.getHours() + 24);
        expiresAt = expires.toISOString();
      }

      // Build scheduled_at if scheduling enabled
      let scheduledAt: string | null = null;
      let status: 'active' | 'scheduled' = 'active';
      let publishedAt: string | null = new Date().toISOString();

      if (enableSchedule && scheduleDate && scheduleTime) {
        scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
        status = 'scheduled';
        publishedAt = null;
      }

      const { error } = await supabase.from('user_content').insert({
        user_id: user.id,
        content_type: selectedType,
        title: form.title || null,
        caption: form.caption,
        tags: form.tags,
        media_url: form.mediaUrl || null,
        media_type: form.mediaType,
        location_address: form.locationAddress || null,
        status,
        published_at: publishedAt,
        scheduled_at: scheduledAt,
        expires_at: expiresAt,
        is_draft: false,
        call_to_action: (selectedType === 'promotion' || selectedType === 'campaign') ? (form.callToAction || null) : null,
        external_link: (selectedType === 'promotion' || selectedType === 'campaign') ? (form.externalLink || null) : null,
        budget: (selectedType === 'promotion' || selectedType === 'campaign') && form.budget ? parseInt(form.budget) : null,
        target_audience: (selectedType === 'promotion' || selectedType === 'campaign') ? (form.targetAudience || null) : null,
      });

      if (error) throw error;

      clearDraft();
      
      if (status === 'scheduled') {
        toast.success(`${selectedType.charAt(0).toUpperCase() + selectedType.slice(1)} scheduled!`, {
          description: `Will be published on ${format(new Date(scheduledAt!), 'MMM d, h:mm a')}`,
        });
      } else {
        toast.success(`${selectedType.charAt(0).toUpperCase() + selectedType.slice(1)} published!`, {
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
    <div ref={ref} className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-dark border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={handleBack} className="p-2 -ml-2 hover:bg-muted/50 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">
            {selectedType ? `Create ${selectedTypeInfo?.label}` : 'Create'}
          </h1>
          {selectedType && (
            <Button variant="ghost" size="sm" onClick={handleSaveDraft} disabled={isSubmitting}>
              <Save className="w-4 h-4" />
            </Button>
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
                  onClick={() => setSelectedType(type.id)}
                  className={cn(
                    'relative overflow-hidden rounded-2xl p-4 text-left transition-all duration-300',
                    'hover:scale-[1.02] active:scale-[0.98]',
                    'bg-gradient-to-br', type.color,
                    'shadow-lg hover:shadow-xl'
                  )}
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

            {/* Rewards Info */}
            <div className="mt-8 p-4 rounded-2xl bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20">
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

            {/* Media Upload Area - Now with real functionality */}
            <ContentUpload
              onUploadComplete={handleUploadComplete}
              mediaType={form.mediaType}
              existingUrl={form.mediaUrl || undefined}
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
              <label className="text-sm font-medium">Caption</label>
              <Textarea
                placeholder="Write a caption..."
                value={form.caption}
                onChange={(e) => setForm(prev => ({ ...prev, caption: e.target.value }))}
                className="bg-muted/50 min-h-[100px] resize-none"
              />
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Hash className="w-4 h-4" /> Tags
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="Add a tag..."
                  value={form.tagInput}
                  onChange={(e) => setForm(prev => ({ ...prev, tagInput: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  className="bg-muted/50"
                />
                <Button variant="secondary" onClick={handleAddTag}>Add</Button>
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

            {/* Scheduling */}
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-primary" />
                    <div>
                      <p className="font-medium">Schedule Post</p>
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

      {/* Submit Button */}
      {selectedType && (
        <div className="fixed bottom-0 left-0 right-0 p-4 glass-dark border-t border-border/50">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !form.caption.trim()}
            className="w-full h-12 text-base font-semibold"
          >
            {isSubmitting ? 'Publishing...' : enableSchedule ? `Schedule ${selectedTypeInfo?.label}` : `Publish ${selectedTypeInfo?.label}`}
          </Button>
        </div>
      )}
    </div>
  );
});

Create.displayName = 'Create';

export default Create;
