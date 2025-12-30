import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Hash, Play, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface TagContent {
  id: string;
  title: string | null;
  thumbnail_url: string | null;
  media_url: string | null;
  views_count: number | null;
  likes_count: number | null;
}

const Hashtag = () => {
  const { tag } = useParams<{ tag: string }>();
  const navigate = useNavigate();
  const [content, setContent] = useState<TagContent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalViews, setTotalViews] = useState(0);

  useEffect(() => {
    const loadTagContent = async () => {
      if (!tag) return;

      setIsLoading(true);
      const { data, error } = await supabase
        .from('user_content')
        .select('id, title, thumbnail_url, media_url, views_count, likes_count')
        .eq('is_public', true)
        .contains('tags', [tag])
        .order('views_count', { ascending: false })
        .limit(50);

      if (!error && data) {
        setContent(data);
        setTotalViews(data.reduce((sum, item) => sum + (item.views_count || 0), 0));
      }
      setIsLoading(false);
    };

    loadTagContent();
  }, [tag]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-4 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold flex items-center gap-1">
              <Hash className="w-5 h-5 text-primary" />
              {tag}
            </h1>
            <p className="text-sm text-muted-foreground">
              {content.length} posts · {formatNumber(totalViews)} views
            </p>
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="p-2">
        {isLoading ? (
          <div className="grid grid-cols-3 gap-1">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="aspect-[9/16] bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : content.length > 0 ? (
          <div className="grid grid-cols-3 gap-1">
            {content.map((item) => (
              <button
                key={item.id}
                onClick={() => navigate(`/v/${item.id}`)}
                className="relative aspect-[9/16] rounded-lg overflow-hidden bg-muted group"
              >
                {item.thumbnail_url || item.media_url ? (
                  <img
                    src={item.thumbnail_url || item.media_url || ''}
                    alt={item.title || ''}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Play className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                  <Eye className="w-3 h-3" />
                  {formatNumber(item.views_count || 0)}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <Hash className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium">No posts yet</p>
            <p className="text-muted-foreground">Be the first to post with #{tag}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Hashtag;
