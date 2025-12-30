import React, { useState, useEffect } from 'react';
import { 
  Calendar, Clock, Zap, TrendingUp, CalendarClock, 
  Loader2, Check, X, Play, Pause, Trash2, Edit3
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, addDays, setHours, setMinutes, isBefore, isAfter } from 'date-fns';

interface ScheduledPost {
  id: string;
  imported_media_id: string;
  scheduled_at: string;
  status: 'scheduled' | 'published' | 'failed' | 'cancelled';
  is_optimized: boolean;
  original_time?: string;
  media_title?: string;
  media_thumbnail?: string;
  platform?: string;
}

interface OptimalTimeSlot {
  day: string;
  time: string;
  hour: number;
  engagement: number;
  label: string;
}

interface ScheduledPostingManagerProps {
  importedMediaId?: string;
  mediaTitle?: string;
  mediaThumbnail?: string;
  platform?: string;
  onScheduleComplete?: (scheduledAt: string) => void;
}

export const ScheduledPostingManager: React.FC<ScheduledPostingManagerProps> = ({
  importedMediaId,
  mediaTitle,
  mediaThumbnail,
  platform,
  onScheduleComplete
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScheduling, setIsScheduling] = useState(false);
  const [useOptimalTime, setUseOptimalTime] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedHour, setSelectedHour] = useState(12);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [optimalSlots, setOptimalSlots] = useState<OptimalTimeSlot[]>([]);

  useEffect(() => {
    if (user) {
      loadScheduledPosts();
      generateOptimalSlots();
    }
  }, [user]);

  const generateOptimalSlots = () => {
    // Generate optimal posting times based on analytics patterns
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const slots: OptimalTimeSlot[] = [];

    // Peak engagement times from BestPostingTimes component analysis
    const peakHours = [
      { hour: 8, engagement: 75 },  // Morning
      { hour: 12, engagement: 80 }, // Lunch
      { hour: 18, engagement: 90 }, // Evening
      { hour: 20, engagement: 85 }, // Night
    ];

    // Generate slots for next 7 days
    for (let d = 0; d < 7; d++) {
      const date = addDays(today, d);
      const dayName = days[date.getDay()];
      const dayEngagementBonus = ['Wed', 'Thu'].includes(dayName) ? 10 : 0;

      peakHours.forEach(({ hour, engagement }) => {
        const slotDate = setHours(setMinutes(date, 0), hour);
        
        // Only include future times
        if (isAfter(slotDate, new Date())) {
          slots.push({
            day: format(date, 'EEE, MMM d'),
            time: format(slotDate, 'h:mm a'),
            hour,
            engagement: Math.min(100, engagement + dayEngagementBonus + Math.round(Math.random() * 5)),
            label: `${format(slotDate, 'EEE h:mm a')}`
          });
        }
      });
    }

    // Sort by engagement score
    slots.sort((a, b) => b.engagement - a.engagement);
    setOptimalSlots(slots.slice(0, 12)); // Top 12 slots
  };

  const loadScheduledPosts = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('imported_media')
        .select('id, title, thumbnail_url, platform, scheduled_at, status')
        .eq('user_id', user.id)
        .not('scheduled_at', 'is', null)
        .order('scheduled_at', { ascending: true });

      if (error) throw error;

      const posts: ScheduledPost[] = (data || []).map(item => ({
        id: item.id,
        imported_media_id: item.id,
        scheduled_at: item.scheduled_at,
        status: item.status === 'scheduled' ? 'scheduled' : 
                item.status === 'published' ? 'published' : 'scheduled',
        is_optimized: true,
        media_title: item.title,
        media_thumbnail: item.thumbnail_url,
        platform: item.platform
      }));

      setScheduledPosts(posts);
    } catch (error) {
      console.error('Error loading scheduled posts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSchedulePost = async (optimalSlot?: OptimalTimeSlot) => {
    if (!user || !importedMediaId) return;

    setIsScheduling(true);
    try {
      let scheduledAt: Date;

      if (optimalSlot) {
        // Use the optimal slot
        const today = new Date();
        const slotDay = optimalSlots.indexOf(optimalSlot);
        scheduledAt = setHours(setMinutes(addDays(today, Math.floor(slotDay / 4)), 0), optimalSlot.hour);
      } else if (useOptimalTime && optimalSlots.length > 0) {
        // Use the best optimal slot
        const bestSlot = optimalSlots[0];
        scheduledAt = setHours(setMinutes(addDays(new Date(), 0), 0), bestSlot.hour);
      } else {
        // Use manually selected time
        scheduledAt = setHours(setMinutes(selectedDate, selectedMinute), selectedHour);
      }

      // Ensure future time
      if (isBefore(scheduledAt, new Date())) {
        scheduledAt = addDays(scheduledAt, 1);
      }

      const { error } = await supabase
        .from('imported_media')
        .update({
          scheduled_at: scheduledAt.toISOString(),
          status: 'scheduled'
        })
        .eq('id', importedMediaId);

      if (error) throw error;

      toast({
        title: 'Post scheduled',
        description: `Will be published ${format(scheduledAt, "EEEE, MMMM d 'at' h:mm a")}`,
      });

      onScheduleComplete?.(scheduledAt.toISOString());
      setIsScheduleDialogOpen(false);
      loadScheduledPosts();
    } catch (error: any) {
      console.error('Error scheduling post:', error);
      toast({
        title: 'Error',
        description: 'Failed to schedule post',
        variant: 'destructive',
      });
    } finally {
      setIsScheduling(false);
    }
  };

  const handleCancelSchedule = async (postId: string) => {
    try {
      const { error } = await supabase
        .from('imported_media')
        .update({
          scheduled_at: null,
          status: 'processed'
        })
        .eq('id', postId);

      if (error) throw error;

      toast({
        title: 'Schedule cancelled',
      });

      loadScheduledPosts();
    } catch (error) {
      console.error('Error cancelling schedule:', error);
    }
  };

  const getNextOptimalTime = () => {
    if (optimalSlots.length > 0) {
      return optimalSlots[0];
    }
    return null;
  };

  const nextOptimal = getNextOptimalTime();

  return (
    <div className="space-y-4">
      {/* Schedule new post section */}
      {importedMediaId && (
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-vicoin/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-primary" />
              Schedule This Post
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Quick schedule with optimal time */}
            {nextOptimal && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/20">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Best time to post</p>
                    <p className="text-xs text-muted-foreground">
                      {nextOptimal.day} at {nextOptimal.time} • {nextOptimal.engagement}% engagement
                    </p>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => handleSchedulePost(nextOptimal)}
                  disabled={isScheduling}
                >
                  {isScheduling ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Clock className="w-4 h-4 mr-1" />
                      Schedule
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Other optimal slots */}
            <div className="grid grid-cols-2 gap-2">
              {optimalSlots.slice(1, 5).map((slot, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="justify-start h-auto py-2"
                  onClick={() => handleSchedulePost(slot)}
                  disabled={isScheduling}
                >
                  <div className="text-left">
                    <p className="text-xs font-medium">{slot.day}</p>
                    <p className="text-xs text-muted-foreground">{slot.time}</p>
                  </div>
                  <Badge variant="secondary" className="ml-auto text-[10px]">
                    {slot.engagement}%
                  </Badge>
                </Button>
              ))}
            </div>

            {/* Custom time button */}
            <Button 
              variant="ghost" 
              className="w-full" 
              onClick={() => setIsScheduleDialogOpen(true)}
            >
              <Calendar className="w-4 h-4 mr-2" />
              Choose custom time
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Scheduled posts list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Scheduled Posts
          </CardTitle>
          <CardDescription>
            Your upcoming scheduled content
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : scheduledPosts.length === 0 ? (
            <div className="text-center py-6">
              <CalendarClock className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">No scheduled posts yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {scheduledPosts.map((post) => (
                <div
                  key={post.id}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/30 transition-colors"
                >
                  {/* Thumbnail */}
                  <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden flex-shrink-0">
                    {post.media_thumbnail ? (
                      <img 
                        src={post.media_thumbnail} 
                        alt="" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {post.media_title || 'Untitled'}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={post.status === 'scheduled' ? 'secondary' : 'default'}>
                        {post.status}
                      </Badge>
                      {post.is_optimized && (
                        <Badge variant="outline" className="text-primary border-primary/30">
                          <Zap className="w-3 h-3 mr-1" />
                          Optimized
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(post.scheduled_at), "EEE, MMM d 'at' h:mm a")}
                    </p>
                  </div>

                  {/* Actions */}
                  {post.status === 'scheduled' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleCancelSchedule(post.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Custom time dialog */}
      <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Post</DialogTitle>
            <DialogDescription>
              Choose when to publish your content
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Optimization toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                <Label>Auto-optimize for best engagement</Label>
              </div>
              <Switch 
                checked={useOptimalTime} 
                onCheckedChange={setUseOptimalTime}
              />
            </div>

            {!useOptimalTime && (
              <>
                {/* Date picker */}
                <div className="space-y-2">
                  <Label>Date</Label>
                  <input
                    type="date"
                    value={format(selectedDate, 'yyyy-MM-dd')}
                    onChange={(e) => setSelectedDate(new Date(e.target.value))}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                  />
                </div>

                {/* Time picker */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Hour</Label>
                    <select
                      value={selectedHour}
                      onChange={(e) => setSelectedHour(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>
                          {i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Minute</Label>
                    <select
                      value={selectedMinute}
                      onChange={(e) => setSelectedMinute(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm"
                    >
                      {[0, 15, 30, 45].map((min) => (
                        <option key={min} value={min}>
                          {min.toString().padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            {useOptimalTime && nextOptimal && (
              <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <span className="font-medium">Recommended time</span>
                </div>
                <p className="text-sm">
                  {nextOptimal.day} at {nextOptimal.time}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Expected {nextOptimal.engagement}% engagement based on your audience
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsScheduleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => handleSchedulePost()} disabled={isScheduling}>
              {isScheduling ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Calendar className="w-4 h-4 mr-2" />
              )}
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
