import React, { useState, useEffect } from 'react';
import { 
  Bell, Clock, Calendar, Zap, Check, Plus, Trash2, 
  Send, ChevronRight, AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { format, addDays, setHours, setMinutes } from 'date-fns';

interface ScheduledNotification {
  id: string;
  type: 'post_reminder' | 'engagement_alert' | 'weekly_summary';
  time: string;
  days: string[];
  enabled: boolean;
  message: string;
}

interface OptimalTime {
  hour: number;
  label: string;
  engagement: number;
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const OPTIMAL_TIMES: OptimalTime[] = [
  { hour: 8, label: '8:00 AM', engagement: 78 },
  { hour: 12, label: '12:00 PM', engagement: 85 },
  { hour: 18, label: '6:00 PM', engagement: 92 },
  { hour: 20, label: '8:00 PM', engagement: 88 },
];

export const SmartPostScheduler: React.FC = () => {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<ScheduledNotification[]>([
    {
      id: '1',
      type: 'post_reminder',
      time: '18:00',
      days: ['Mon', 'Wed', 'Fri'],
      enabled: true,
      message: "It's prime time! Your audience is most active now.",
    },
    {
      id: '2',
      type: 'weekly_summary',
      time: '09:00',
      days: ['Mon'],
      enabled: true,
      message: 'Weekly analytics summary ready to view.',
    },
  ]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newNotification, setNewNotification] = useState({
    type: 'post_reminder',
    time: '18:00',
    days: ['Mon', 'Wed', 'Fri'],
  });

  const toggleNotification = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, enabled: !n.enabled } : n))
    );
    toast({
      title: 'Notification Updated',
      description: 'Your notification schedule has been updated.',
    });
  };

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    toast({
      title: 'Notification Deleted',
      description: 'The scheduled notification has been removed.',
    });
  };

  const addNotification = () => {
    const messages: Record<string, string> = {
      post_reminder: "It's prime time! Your audience is most active now.",
      engagement_alert: 'Your recent post is getting great engagement!',
      weekly_summary: 'Your weekly analytics summary is ready.',
    };

    const notification: ScheduledNotification = {
      id: Date.now().toString(),
      type: newNotification.type as ScheduledNotification['type'],
      time: newNotification.time,
      days: newNotification.days,
      enabled: true,
      message: messages[newNotification.type],
    };

    setNotifications(prev => [...prev, notification]);
    setShowAddForm(false);
    toast({
      title: 'Notification Scheduled',
      description: 'You will receive reminders at optimal times.',
    });
  };

  const toggleDay = (day: string) => {
    setNewNotification(prev => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter(d => d !== day)
        : [...prev.days, day],
    }));
  };

  const getNextScheduledTime = (notification: ScheduledNotification) => {
    const now = new Date();
    const [hours, minutes] = notification.time.split(':').map(Number);
    const todayIndex = now.getDay();
    const todayDay = DAYS_OF_WEEK[todayIndex];

    // Find next scheduled day
    for (let i = 0; i < 7; i++) {
      const dayIndex = (todayIndex + i) % 7;
      const day = DAYS_OF_WEEK[dayIndex];
      if (notification.days.includes(day)) {
        const scheduledDate = addDays(now, i);
        const scheduledTime = setMinutes(setHours(scheduledDate, hours), minutes);
        if (scheduledTime > now) {
          return format(scheduledTime, "EEE 'at' h:mm a");
        }
      }
    }
    return 'Not scheduled';
  };

  const getTypeIcon = (type: ScheduledNotification['type']) => {
    switch (type) {
      case 'post_reminder':
        return <Send className="w-4 h-4" />;
      case 'engagement_alert':
        return <Zap className="w-4 h-4" />;
      case 'weekly_summary':
        return <Calendar className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: ScheduledNotification['type']) => {
    switch (type) {
      case 'post_reminder':
        return 'Post Reminder';
      case 'engagement_alert':
        return 'Engagement Alert';
      case 'weekly_summary':
        return 'Weekly Summary';
    }
  };

  return (
    <div className="space-y-4">
      {/* Optimal Times Card */}
      <Card className="neu-card bg-gradient-to-br from-primary/10 to-vicoin/10 border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Recommended Posting Times
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">
            Based on your audience's activity patterns
          </p>
          <div className="flex flex-wrap gap-2">
            {OPTIMAL_TIMES.map((time) => (
              <div
                key={time.hour}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background/50 border border-border/50"
              >
                <Clock className="w-3 h-3 text-primary" />
                <span className="text-sm font-medium text-foreground">{time.label}</span>
                <Badge variant="secondary" className="text-xs bg-green-500/20 text-green-500">
                  {time.engagement}% engagement
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Scheduled Notifications */}
      <Card className="neu-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              Scheduled Reminders
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddForm(!showAddForm)}
              className="h-7 text-xs"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Add Form */}
          {showAddForm && (
            <div className="p-3 rounded-lg bg-muted/50 border border-border space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={newNotification.type}
                    onValueChange={(v) => setNewNotification(prev => ({ ...prev, type: v }))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="post_reminder">Post Reminder</SelectItem>
                      <SelectItem value="engagement_alert">Engagement Alert</SelectItem>
                      <SelectItem value="weekly_summary">Weekly Summary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Time</Label>
                  <Select
                    value={newNotification.time}
                    onValueChange={(v) => setNewNotification(prev => ({ ...prev, time: v }))}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPTIMAL_TIMES.map((t) => (
                        <SelectItem key={t.hour} value={`${t.hour}:00`}>
                          {t.label} ({t.engagement}% eng.)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Days</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {DAYS_OF_WEEK.map((day) => (
                    <button
                      key={day}
                      onClick={() => toggleDay(day)}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        newNotification.days.includes(day)
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={addNotification} className="flex-1 h-8 text-xs">
                  <Check className="w-3 h-3 mr-1" />
                  Schedule
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddForm(false)}
                  className="h-8 text-xs"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Notification List */}
          {notifications.length === 0 ? (
            <div className="text-center py-6">
              <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No scheduled notifications</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  notification.enabled
                    ? 'bg-card border-border'
                    : 'bg-muted/30 border-border/50 opacity-60'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    notification.enabled ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {getTypeIcon(notification.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {getTypeLabel(notification.type)}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {notification.time}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {notification.days.join(', ')} • Next: {getNextScheduledTime(notification)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={notification.enabled}
                    onCheckedChange={() => toggleNotification(notification.id)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => deleteNotification(notification.id)}
                  >
                    <Trash2 className="w-3 h-3 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Quick Tips */}
      <Card className="neu-card">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-vicoin shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-foreground mb-1">Posting Tip</h4>
              <p className="text-xs text-muted-foreground">
                Posts published between 6-8 PM on weekdays get 40% more engagement. 
                Enable reminders to never miss the optimal window!
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
