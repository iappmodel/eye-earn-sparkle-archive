import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2, Trash2, BarChart3, Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ContentUpload } from './ContentUpload';
import { ContentAnalytics } from './ContentAnalytics';
import { format } from 'date-fns';

interface ContentEditorProps {
  contentId?: string;
  onClose?: () => void;
}

interface ContentData {
  id: string;
  title: string | null;
  caption: string | null;
  tags: string[];
  media_url: string | null;
  media_type: string | null;
  location_address: string | null;
  status: string;
  scheduled_at: string | null;
  call_to_action: string | null;
  external_link: string | null;
  content_type: string;
}

export const ContentEditor: React.FC<ContentEditorProps> = ({ contentId, onClose }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(!!contentId);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [enableSchedule, setEnableSchedule] = useState(false);
  const [content, setContent] = useState<ContentData>({
    id: '',
    title: '',
    caption: '',
    tags: [],
    media_url: null,
    media_type: 'image',
    location_address: '',
    status: 'draft',
    scheduled_at: null,
    call_to_action: '',
    external_link: '',
    content_type: 'post',
  });
  const [tagInput, setTagInput] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  useEffect(() => {
    if (contentId) {
      loadContent();
    }
  }, [contentId]);

  const loadContent = async () => {
    try {
      const { data, error } = await supabase
        .from('user_content')
        .select('*')
        .eq('id', contentId)
        .single();

      if (error) throw error;

      setContent(data as ContentData);
      
      if (data.scheduled_at) {
        setEnableSchedule(true);
        const date = new Date(data.scheduled_at);
        setScheduleDate(format(date, 'yyyy-MM-dd'));
        setScheduleTime(format(date, 'HH:mm'));
      }
    } catch (error) {
      console.error('Error loading content:', error);
      toast({ title: 'Failed to load content', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      let scheduledAt: string | null = null;
      let status = content.status;

      if (enableSchedule && scheduleDate && scheduleTime) {
        scheduledAt = new Date(`${scheduleDate}T${scheduleTime}`).toISOString();
        status = 'scheduled';
      }

      const updateData = {
        title: content.title || null,
        caption: content.caption,
        tags: content.tags,
        media_url: content.media_url,
        media_type: content.media_type,
        location_address: content.location_address || null,
        status,
        scheduled_at: scheduledAt,
        call_to_action: content.call_to_action || null,
        external_link: content.external_link || null,
        draft_saved_at: new Date().toISOString(),
      };

      if (contentId) {
        const { error } = await supabase
          .from('user_content')
          .update(updateData)
          .eq('id', contentId);

        if (error) throw error;
        toast({ title: 'Content updated' });
      } else {
        const { error } = await supabase
          .from('user_content')
          .insert({
            ...updateData,
            user_id: user.id,
            content_type: content.content_type,
            is_draft: status === 'draft',
          });

        if (error) throw error;
        toast({ title: 'Content saved' });
      }

      onClose?.();
    } catch (error) {
      console.error('Error saving content:', error);
      toast({ title: 'Failed to save', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!user || !contentId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_content')
        .update({
          status: 'active',
          published_at: new Date().toISOString(),
          is_draft: false,
          scheduled_at: null,
        })
        .eq('id', contentId);

      if (error) throw error;
      toast({ title: 'Content published!' });
      onClose?.();
    } catch (error) {
      console.error('Error publishing:', error);
      toast({ title: 'Failed to publish', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!contentId) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from('user_content')
        .delete()
        .eq('id', contentId);

      if (error) throw error;
      toast({ title: 'Content deleted' });
      onClose?.();
      navigate('/');
    } catch (error) {
      console.error('Error deleting:', error);
      toast({ title: 'Failed to delete', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  const handleAddTag = () => {
    if (tagInput.trim() && !content.tags.includes(tagInput.trim())) {
      setContent(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()],
      }));
      setTagInput('');
    }
  };

  const handleUploadComplete = (url: string, type: 'image' | 'video') => {
    setContent(prev => ({ ...prev, media_url: url, media_type: type }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h2 className="text-lg font-semibold">
            {contentId ? 'Edit Content' : 'New Content'}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {contentId && (
            <Sheet open={showAnalytics} onOpenChange={setShowAnalytics}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                  <BarChart3 className="w-4 h-4" />
                </Button>
              </SheetTrigger>
              <SheetContent className="overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Analytics</SheetTitle>
                </SheetHeader>
                <div className="mt-4">
                  <ContentAnalytics contentId={contentId} />
                </div>
              </SheetContent>
            </Sheet>
          )}
          {contentId && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="icon" className="text-destructive">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Content?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your content
                    and all associated analytics data.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={deleting}
                  >
                    {deleting ? 'Deleting...' : 'Delete'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Media Upload */}
      <ContentUpload
        onUploadComplete={handleUploadComplete}
        mediaType={content.media_type as 'image' | 'video' | 'carousel'}
        existingUrl={content.media_url || undefined}
        onRemove={() => setContent(prev => ({ ...prev, media_url: null }))}
      />

      {/* Title */}
      <div className="space-y-2">
        <Label>Title (optional)</Label>
        <Input
          placeholder="Give your content a title..."
          value={content.title || ''}
          onChange={(e) => setContent(prev => ({ ...prev, title: e.target.value }))}
        />
      </div>

      {/* Caption */}
      <div className="space-y-2">
        <Label>Caption</Label>
        <Textarea
          placeholder="Write a caption..."
          value={content.caption || ''}
          onChange={(e) => setContent(prev => ({ ...prev, caption: e.target.value }))}
          className="min-h-[100px]"
        />
      </div>

      {/* Tags */}
      <div className="space-y-2">
        <Label>Tags</Label>
        <div className="flex gap-2">
          <Input
            placeholder="Add tag..."
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
          />
          <Button variant="secondary" onClick={handleAddTag}>Add</Button>
        </div>
        {content.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {content.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-sm cursor-pointer"
                onClick={() => setContent(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }))}
              >
                #{tag} ×
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Location */}
      <div className="space-y-2">
        <Label>Location</Label>
        <Input
          placeholder="Add location..."
          value={content.location_address || ''}
          onChange={(e) => setContent(prev => ({ ...prev, location_address: e.target.value }))}
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

      {/* Status indicator */}
      {content.status && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>Status: <span className="capitalize font-medium text-foreground">{content.status}</span></span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <Button variant="outline" className="flex-1" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Save Draft
        </Button>
        <Button className="flex-1" onClick={enableSchedule ? handleSave : handlePublish} disabled={saving}>
          {saving ? 'Saving...' : enableSchedule ? 'Schedule' : 'Publish Now'}
        </Button>
      </div>
    </div>
  );
};
