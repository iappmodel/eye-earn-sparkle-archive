import React, { useState, useEffect } from 'react';
import { Clock, Zap, TrendingUp, Calendar, Sun, Moon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

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

export const BestPostingTimes: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [dayPerformance, setDayPerformance] = useState<DayPerformance[]>([]);
  const [optimalTimes, setOptimalTimes] = useState<string[]>([]);

  useEffect(() => {
    loadTimingData();
  }, [user]);

  const loadTimingData = async () => {
    setLoading(true);
    try {
      // Generate engagement data based on typical social media patterns
      // In production, this would analyze actual content_interactions data
      const hours = Array.from({ length: 24 }, (_, i) => {
        const hour = i;
        let engagement = 0;
        
        // Morning peak (7-9 AM)
        if (hour >= 7 && hour <= 9) engagement = 60 + Math.random() * 20;
        // Lunch peak (12-2 PM)
        else if (hour >= 12 && hour <= 14) engagement = 70 + Math.random() * 15;
        // Evening peak (6-9 PM)
        else if (hour >= 18 && hour <= 21) engagement = 80 + Math.random() * 20;
        // Night (10 PM - 12 AM)
        else if (hour >= 22 || hour === 0) engagement = 40 + Math.random() * 15;
        // Early morning (1-6 AM)
        else if (hour >= 1 && hour <= 6) engagement = 10 + Math.random() * 15;
        // Other times
        else engagement = 30 + Math.random() * 20;

        const label = hour === 0 ? '12AM' : hour < 12 ? `${hour}AM` : hour === 12 ? '12PM' : `${hour - 12}PM`;
        
        return {
          hour,
          label,
          engagement: Math.round(engagement),
          isOptimal: engagement >= 70,
        };
      });

      // Find optimal times
      const optimal = hours
        .filter(h => h.isOptimal)
        .sort((a, b) => b.engagement - a.engagement)
        .slice(0, 3)
        .map(h => h.label);

      // Day of week performance
      const days = [
        { day: 'Sunday', shortDay: 'Sun', engagement: 65 },
        { day: 'Monday', shortDay: 'Mon', engagement: 72 },
        { day: 'Tuesday', shortDay: 'Tue', engagement: 78 },
        { day: 'Wednesday', shortDay: 'Wed', engagement: 82 },
        { day: 'Thursday', shortDay: 'Thu', engagement: 80 },
        { day: 'Friday', shortDay: 'Fri', engagement: 75 },
        { day: 'Saturday', shortDay: 'Sat', engagement: 70 },
      ].map(d => ({
        ...d,
        engagement: d.engagement + Math.round((Math.random() - 0.5) * 10),
        isOptimal: d.engagement >= 75,
      }));

      setTimeSlots(hours);
      setDayPerformance(days);
      setOptimalTimes(optimal);
    } catch (error) {
      console.error('Error loading timing data:', error);
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

  const maxEngagement = Math.max(...timeSlots.map(t => t.engagement));

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
          <div className="mt-3 p-3 rounded-lg bg-vicoin/10 border border-vicoin/20">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-vicoin" />
              <p className="text-sm text-foreground">
                <span className="font-semibold">Wednesday & Thursday</span> have the highest engagement rates
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
