import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, TrendingUp, Calendar, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { EnhancedEarningAnalytics } from '@/components/analytics/EnhancedEarningAnalytics';
import { EarningBreakdownChart } from '@/components/EarningBreakdownChart';
import { EarningGoals } from '@/components/EarningGoals';

const Earnings = () => {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState('7d');
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                Earnings
              </h1>
              <p className="text-sm text-muted-foreground">Track your income</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[120px]">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24h</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="1y">Last year</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon">
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full">
            <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
            <TabsTrigger value="breakdown" className="flex-1">Breakdown</TabsTrigger>
            <TabsTrigger value="goals" className="flex-1">Goals</TabsTrigger>
            <TabsTrigger value="content" className="flex-1">Content</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <ScrollArea className="h-[calc(100vh-140px)]">
        <div className="p-4">
          <TabsContent value="overview" className="mt-0 space-y-6">
            <EnhancedEarningAnalytics />
          </TabsContent>

          <TabsContent value="breakdown" className="mt-0">
            <EarningBreakdownChart />
          </TabsContent>

          <TabsContent value="goals" className="mt-0">
            <EarningGoals />
          </TabsContent>

          <TabsContent value="content" className="mt-0">
            <div className="text-center py-12">
              <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Select a video from your profile to see detailed analytics</p>
              <Button variant="outline" className="mt-4" onClick={() => navigate('/my-page')}>
                View My Content
              </Button>
            </div>
          </TabsContent>
        </div>
      </ScrollArea>
    </div>
  );
};

export default Earnings;
