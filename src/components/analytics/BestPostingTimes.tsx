import React, { useState, useEffect } from 'react';
import { Clock, Zap, TrendingUp, Calendar, Sun, Moon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { subDays } from 'date-fns';

interface TimeSlot {
  hour: number;
  label: string;
  engagement: number;
  isOptimal: boolean;
}

interface DayPerformance {
  day: string;
  shortDay: string;
  engagement: number;
  isOptimal: boolean;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/** Below this we show "Not enough data" or error only; no Math.random() or synthetic engagement. */
const MIN_INTERACTIONS_FOR_DATA = 10;

export const BestPostingTimes: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [dayPerformance, setDayPerformance] = useState<DayPerformance[]>([]);
  const [optimalTimes, setOptimalTimes] = useState<string[]>([]);
  const [hasEnoughData, setHasEnoughData] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    loadTimingData();
  }, [user?.id]);

  const loadTimingData = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const startDate = subDays(new Date(), 30);

      // RLS-safe: only interactions on this creator's content
      const { data: interactions, error } = user
        ? await supabase
            .from('content_interactions')
            .select('created_at, liked, shared')
            .eq('content_owner_id', user.id)
            .gte('created_at', startDate.toISOString())
        : { data: null, error: null };

      if (error) throw error;

      const list = interactions ?? [];
      const enough = list.length >= MIN_INTERACTIONS_FOR_DATA;

      if (enough) {
        setHasEnoughData(true);
        const engagementScore = (i: { liked?: boolean | null; shared?: boolean | null }) =>
          (i.liked ? 2 : 0) + (i.shared ? 3 : 0) + 1;

        const byHour = Array.from({ length: 24 }, () => 0);
        const byDay = Array.from({ length: 7 }, () => 0);

        list.forEach((i) => {
          const d = new Date(i.created_at);
          const hour = d.getHours();
          const day = d.getDay();
          byHour[hour] += engagementScore(i);
          byDay[day] += engagementScore(i);
        });

        const maxH = Math.max(1, ...byHour);
        const maxD = Math.max(1, ...byDay);
        const hours: TimeSlot[] = byHour.map((engagement, hour) => {
          const pct = Math.round((engagement / maxH) * 100);
          const label = hour === 0 ? '12AM' : hour < 12 ? `${hour}AM` : hour === 12 ? '12PM' : `${hour - 12}PM`;
          return { hour, label, engagement: pct, isOptimal: pct >= 70 };
        });
        const days: DayPerformance[] = byDay.map((engagement, i) => {
          const pct = Math.round((engagement / maxD) * 100);
          return {
            day: DAY_NAMES[i],
            shortDay: DAY_SHORT[i],
            engagement: pct,
            isOptimal: pct >= 70,
          };
        });

        const optimal = hours
          .filter((h) => h.isOptimal)
          .sort((a, b) => b.engagement - a.engagement)
          .slice(0, 3)
          .map((h) => h.label);

        setTimeSlots(hours);
        setDayPerformance(days);
        setOptimalTimes(optimal.length ? optimal : ['6PM', '7PM', '12PM']);
      } else {
        setHasEnoughData(false);
        setTimeSlots([]);
        setDayPerformance([]);
        setOptimalTimes([]);
      }
    } catch (error) {
      console.error('Error loading timing data:', error);
      setLoadError(true);
      setHasEnoughData(false);
      setTimeSlots([]);
      setDayPerformance([]);
      setOptimalTimes([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-muted rounded-xl animate-pulse" />
        <div className="h-48 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  if (loadError) {
    return (
      <Card className="neu-card border-dashed border-2 border-destructive/30">
        <CardContent className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <Clock className="w-7 h-7 text-destructive" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">Couldn&apos;t load data</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Something went wrong loading your posting times. Try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!hasEnoughData) {
    return (
      <Card className="neu-card border-dashed border-2 border-muted">
        <CardContent className="flex flex-col items-center justify-center py-12 px-4 text-center">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
            <Clock className="w-7 h-7 text-muted-foreground" />
          </div>
          <h3 className="font-semibold text-foreground mb-1">Not enough data</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Post more content and get at least {MIN_INTERACTIONS_FOR_DATA} interactions in the last 30 days to see your best posting times.
          </p>
        </CardContent>
      </Card>
    );
  }

  const maxEngagement = timeSlots.length ? Math.max(...timeSlots.map((t) => t.engagement)) : 0;

  return (
    <div className="space-y-4">
      {/* Optimal Times Summary */}
      <Card className="neu-card bg-gradient-to-br from-primary/10 to-vicoin/10 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Best Times to Post</h3>
              <p className="text-xs text-muted-foreground">Based on your audience engagement</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {optimalTimes.map((time) => (
              <Badge key={time} variant="secondary" className="bg-primary/20 text-primary border-primary/30">
                <Clock className="w-3 h-3 mr-1" />
                {time}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Hourly Engagement */}
      <Card className="neu-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Hourly Engagement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeSlots.filter((_, i) => i % 2 === 0)}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis 
                  dataKey="label" 
                  className="text-xs" 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} 
                  interval={0}
                  angle={-45}
                  textAnchor="end"
                  height={50}
                />
                <YAxis 
                  className="text-xs" 
                  tick={{ fill: 'hsl(var(--muted-foreground))' }} 
                  domain={[0, 100]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`${value}%`, 'Engagement']}
                />
                <Bar dataKey="engagement" radius={[4, 4, 0, 0]}>
                  {timeSlots.filter((_, i) => i % 2 === 0).map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.isOptimal ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'}
                      opacity={entry.isOptimal ? 1 : 0.5}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-4 mt-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Sun className="w-3 h-3" />
              <span>Morning Peak: 7-9 AM</span>
            </div>
            <div className="flex items-center gap-1">
              <Moon className="w-3 h-3" />
              <span>Evening Peak: 6-9 PM</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Day of Week Performance */}
      <Card className="neu-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Best Days to Post
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1">
            {dayPerformance.map((day) => (
              <div
                key={day.day}
                className={`text-center p-2 rounded-lg transition-colors ${
                  day.isOptimal 
                    ? 'bg-primary/20 border border-primary/30' 
                    : 'bg-muted/50'
                }`}
              >
                <p className="text-xs font-medium text-foreground">{day.shortDay}</p>
                <p className={`text-lg font-bold ${day.isOptimal ? 'text-primary' : 'text-muted-foreground'}`}>
                  {day.engagement}
                </p>
                <p className="text-[10px] text-muted-foreground">%</p>
              </div>
            ))}
          </div>
          {dayPerformance.length > 0 && (
            <div className="mt-3 p-3 rounded-lg bg-vicoin/10 border border-vicoin/20">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-vicoin" />
                <p className="text-sm text-foreground">
                  <span className="font-semibold">
                    {dayPerformance
                      .slice()
                      .sort((a, b) => b.engagement - a.engagement)
                      .slice(0, 2)
                      .map((d) => d.day)
                      .join(' & ')}
                  </span>{' '}
                  {dayPerformance.some((d) => d.isOptimal) ? 'have the highest engagement' : '— keep posting to see your best days'}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
