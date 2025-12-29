import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Image, Video, Megaphone, Target, Upload, X, MapPin, Hash, Link as LinkIcon, DollarSign } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type ContentType = 'post' | 'story' | 'promotion' | 'campaign';
type MediaType = 'image' | 'video' | 'carousel';

interface ContentForm {
  title: string;
  caption: string;
  tags: string[];
  tagInput: string;
  mediaUrl: string;
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

export default function Create() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedType, setSelectedType] = useState<ContentType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<ContentForm>({
    title: '',
    caption: '',
    tags: [],
    tagInput: '',
    mediaUrl: '',
    mediaType: 'image',
    locationAddress: '',
    callToAction: '',
    externalLink: '',
    budget: '',
    targetAudience: '',
  });

  const handleBack = () => {
    if (selectedType) {
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

      const { error } = await supabase.from('user_content').insert({
        user_id: user.id,
        content_type: selectedType,
        title: form.title || null,
        caption: form.caption,
        tags: form.tags,
        media_url: form.mediaUrl || null,
        media_type: form.mediaType,
        location_address: form.locationAddress || null,
        status: 'active' as const,
        published_at: new Date().toISOString(),
        expires_at: expiresAt,
        call_to_action: (selectedType === 'promotion' || selectedType === 'campaign') ? (form.callToAction || null) : null,
        external_link: (selectedType === 'promotion' || selectedType === 'campaign') ? (form.externalLink || null) : null,
        budget: (selectedType === 'promotion' || selectedType === 'campaign') && form.budget ? parseInt(form.budget) : null,
        target_audience: (selectedType === 'promotion' || selectedType === 'campaign') ? (form.targetAudience || null) : null,
      });

      if (error) throw error;

      toast.success(`${selectedType.charAt(0).toUpperCase() + selectedType.slice(1)} created!`, {
        description: 'Earn rewards as people engage with your content.',
      });

      navigate('/');
    } catch (error) {
      console.error('Error creating content:', error);
      toast.error('Failed to create content');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedTypeInfo = contentTypes.find(t => t.id === selectedType);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-dark border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3">
          <button onClick={handleBack} className="p-2 -ml-2 hover:bg-muted/50 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-semibold">
            {selectedType ? `Create ${selectedTypeInfo?.label}` : 'Create'}
          </h1>
          <div className="w-9" />
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
            {/* Media Upload Area */}
            <div className="aspect-[4/3] rounded-2xl border-2 border-dashed border-border hover:border-primary/50 transition-colors bg-muted/30 flex flex-col items-center justify-center gap-4 cursor-pointer">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-medium">Tap to upload media</p>
                <p className="text-sm text-muted-foreground">Photos, videos, or carousel</p>
              </div>
              <div className="flex gap-2">
                {(['image', 'video', 'carousel'] as MediaType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => setForm(prev => ({ ...prev, mediaType: type }))}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                      form.mediaType === type
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                    )}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>

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
            {isSubmitting ? 'Publishing...' : `Publish ${selectedTypeInfo?.label}`}
          </Button>
        </div>
      )}
    </div>
  );
}
