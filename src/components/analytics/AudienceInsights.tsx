import React, { useState, useEffect } from 'react';
import { Users, MapPin, Smartphone, Globe, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface DemographicData {
  ageGroups: { name: string; value: number; color: string }[];
  locations: { name: string; value: number }[];
  devices: { name: string; value: number; color: string }[];
  genderSplit: { name: string; value: number; color: string }[];
}

export const AudienceInsights: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DemographicData>({
    ageGroups: [],
    locations: [],
    devices: [],
    genderSplit: [],
  });

  useEffect(() => {
    loadAudienceData();
  }, [user]);

  const loadAudienceData = async () => {
    setLoading(true);
    try {
      // In a real app, this would come from analytics data
      // For now, we'll generate sample demographic data
      const ageGroups = [
        { name: '18-24', value: 35, color: 'hsl(var(--primary))' },
        { name: '25-34', value: 40, color: 'hsl(var(--vicoin))' },
        { name: '35-44', value: 15, color: 'hsl(var(--icoin))' },
        { name: '45+', value: 10, color: 'hsl(var(--muted-foreground))' },
      ];

      const locations = [
        { name: 'United States', value: 45 },
        { name: 'United Kingdom', value: 15 },
        { name: 'Canada', value: 12 },
        { name: 'Australia', value: 8 },
        { name: 'Germany', value: 6 },
        { name: 'Other', value: 14 },
      ];

      const devices = [
        { name: 'Mobile', value: 68, color: 'hsl(var(--primary))' },
        { name: 'Desktop', value: 24, color: 'hsl(var(--vicoin))' },
        { name: 'Tablet', value: 8, color: 'hsl(var(--icoin))' },
      ];

      const genderSplit = [
        { name: 'Male', value: 48, color: 'hsl(217, 91%, 60%)' },
        { name: 'Female', value: 46, color: 'hsl(330, 81%, 60%)' },
        { name: 'Other', value: 6, color: 'hsl(var(--muted-foreground))' },
      ];

      setData({ ageGroups, locations, devices, genderSplit });
    } catch (error) {
      console.error('Error loading audience data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-40 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Age Distribution */}
      <Card className="neu-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Age Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.ageGroups}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={60}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {data.ageGroups.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [`${value}%`, 'Percentage']}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend
                  formatter={(value) => <span className="text-xs text-foreground">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Top Locations */}
      <Card className="neu-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary" />
            Top Locations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.locations.slice(0, 5).map((location, index) => (
            <div key={location.name} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Globe className="w-3 h-3 text-muted-foreground" />
                  <span className="text-foreground">{location.name}</span>
                </div>
                <span className="text-muted-foreground">{location.value}%</span>
              </div>
              <Progress value={location.value} className="h-1.5" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Device Breakdown */}
      <Card className="neu-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Smartphone className="w-4 h-4 text-primary" />
            Device Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            {data.devices.map((device) => (
              <div key={device.name} className="flex-1 text-center">
                <div 
                  className="w-12 h-12 mx-auto rounded-full flex items-center justify-center mb-2"
                  style={{ backgroundColor: `${device.color}20` }}
                >
                  <Smartphone className="w-5 h-5" style={{ color: device.color }} />
                </div>
                <p className="text-lg font-bold text-foreground">{device.value}%</p>
                <p className="text-xs text-muted-foreground">{device.name}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Gender Split */}
      <Card className="neu-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            Gender Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {data.genderSplit.map((item) => (
              <div 
                key={item.name}
                className="flex-1 rounded-lg p-3 text-center"
                style={{ backgroundColor: `${item.color}15` }}
              >
                <p className="text-lg font-bold" style={{ color: item.color }}>{item.value}%</p>
                <p className="text-xs text-muted-foreground">{item.name}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
