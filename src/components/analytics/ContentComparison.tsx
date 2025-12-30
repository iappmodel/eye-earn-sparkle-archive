import React, { useState, useEffect } from 'react';
import { BarChart3, Eye, Heart, Share2, MessageCircle, TrendingUp, Check, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { format } from 'date-fns';

interface ContentItem {
  id: string;
  title: string;
  thumbnail_url: string | null;
  content_type: string;
  views_count: number;
  likes_count: number;
  shares_count: number;
  comments_count: number;
  created_at: string;
  selected?: boolean;
}

export const ContentComparison: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [selectedContent, setSelectedContent] = useState<string[]>([]);
  const [showSelector, setShowSelector] = useState(false);

  useEffect(() => {
    loadContent();
  }, [user]);

  const loadContent = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('user_content')
        .select('id, title, thumbnail_url, content_type, views_count, likes_count, shares_count, comments_count, created_at')
        .eq('user_id', user.id)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      setContent(data || []);
      // Auto-select first 2 items for comparison
      if (data && data.length >= 2) {
        setSelectedContent([data[0].id, data[1].id]);
      }
    } catch (error) {
      console.error('Error loading content:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedContent(prev => {
      if (prev.includes(id)) {
        return prev.filter(i => i !== id);
      }
      if (prev.length >= 4) {
        return [...prev.slice(1), id];
      }
      return [...prev, id];
    });
  };

  const getComparisonData = () => {
    return selectedContent.map(id => {
      const item = content.find(c => c.id === id);
      if (!item) return null;
      return {
        name: item.title?.substring(0, 15) || `Post ${format(new Date(item.created_at), 'MM/dd')}`,
        views: item.views_count || 0,
        likes: item.likes_count || 0,
        shares: item.shares_count || 0,
        comments: item.comments_count || 0,
        engagement: item.views_count > 0 
          ? Math.round(((item.likes_count || 0) + (item.shares_count || 0) + (item.comments_count || 0)) / item.views_count * 100) 
          : 0,
      };
    }).filter(Boolean);
  };

  const getWinner = (metric: 'views' | 'likes' | 'shares' | 'engagement') => {
    const data = getComparisonData();
    if (data.length < 2) return null;
    const max = Math.max(...data.map(d => d?.[metric] || 0));
    return data.find(d => d?.[metric] === max)?.name;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-muted rounded-xl animate-pulse" />
        <div className="h-48 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  if (content.length === 0) {
    return (
      <Card className="neu-card">
        <CardContent className="p-6 text-center">
          <BarChart3 className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold text-foreground mb-2">No Content to Compare</h3>
          <p className="text-sm text-muted-foreground">
            Publish some content first to see performance comparisons
          </p>
        </CardContent>
      </Card>
    );
  }

  const comparisonData = getComparisonData();
  const selectedItems = content.filter(c => selectedContent.includes(c.id));

  return (
    <div className="space-y-4">
      {/* Selected Content Preview */}
      <Card className="neu-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Comparing {selectedContent.length} Posts
            </CardTitle>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setShowSelector(!showSelector)}
              className="text-xs h-7"
            >
              {showSelector ? 'Done' : 'Select Posts'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {showSelector ? (
            <ScrollArea className="h-48">
              <div className="space-y-2">
                {content.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => toggleSelection(item.id)}
                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                      selectedContent.includes(item.id) 
                        ? 'bg-primary/10 border border-primary/30' 
                        : 'bg-muted/50 hover:bg-muted'
                    }`}
                  >
                    <Checkbox checked={selectedContent.includes(item.id)} />
                    <div className="w-10 h-10 rounded bg-muted overflow-hidden">
                      {item.thumbnail_url ? (
                        <img src={item.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <BarChart3 className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {item.title || 'Untitled'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(item.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {item.content_type}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {selectedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex-shrink-0 w-20 text-center"
                >
                  <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden mx-auto mb-1">
                    {item.thumbnail_url ? (
                      <img src={item.thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BarChart3 className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {item.title || 'Untitled'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comparison Chart */}
      {selectedContent.length >= 2 && (
        <>
          <Card className="neu-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Performance Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                    <XAxis type="number" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis 
                      type="category" 
                      dataKey="name" 
                      className="text-xs" 
                      tick={{ fill: 'hsl(var(--muted-foreground))' }} 
                      width={80}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                    <Bar dataKey="views" fill="hsl(217, 91%, 60%)" name="Views" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="likes" fill="hsl(0, 84%, 60%)" name="Likes" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="shares" fill="hsl(142, 71%, 45%)" name="Shares" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Winner Summary */}
          <Card className="neu-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Performance Leaders
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-500/10">
                  <Eye className="w-4 h-4 text-blue-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Most Views</p>
                    <p className="text-sm font-medium text-foreground truncate">
                      {getWinner('views') || '-'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-red-500/10">
                  <Heart className="w-4 h-4 text-red-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Most Likes</p>
                    <p className="text-sm font-medium text-foreground truncate">
                      {getWinner('likes') || '-'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-green-500/10">
                  <Share2 className="w-4 h-4 text-green-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Most Shares</p>
                    <p className="text-sm font-medium text-foreground truncate">
                      {getWinner('shares') || '-'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-purple-500/10">
                  <TrendingUp className="w-4 h-4 text-purple-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">Best Engagement</p>
                    <p className="text-sm font-medium text-foreground truncate">
                      {getWinner('engagement') || '-'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
