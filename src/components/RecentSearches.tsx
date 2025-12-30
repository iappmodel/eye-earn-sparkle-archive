import React from 'react';
import { Clock, X, Search, Trash2, User, Hash, MapPin, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useRecentSearches, RecentSearch } from '@/hooks/useRecentSearches';
import { formatDistanceToNow } from 'date-fns';

interface RecentSearchesProps {
  onSelect: (query: string) => void;
  className?: string;
}

const typeIcons: Record<string, React.ReactNode> = {
  user: <User className="w-3.5 h-3.5" />,
  content: <FileText className="w-3.5 h-3.5" />,
  tag: <Hash className="w-3.5 h-3.5" />,
  location: <MapPin className="w-3.5 h-3.5" />,
};

export const RecentSearches: React.FC<RecentSearchesProps> = ({
  onSelect,
  className,
}) => {
  const { searches, removeSearch, clearSearches } = useRecentSearches();

  if (searches.length === 0) {
    return (
      <div className={cn('p-4 text-center text-muted-foreground', className)}>
        <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No recent searches</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between px-2">
        <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
          <Clock className="w-4 h-4" />
          Recent Searches
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={clearSearches}
          className="h-7 text-xs text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="w-3.5 h-3.5 mr-1" />
          Clear all
        </Button>
      </div>

      <div className="space-y-1">
        {searches.map((search) => (
          <div
            key={`${search.query}-${search.timestamp}`}
            className={cn(
              'group flex items-center gap-3 px-3 py-2 rounded-lg',
              'hover:bg-muted/50 cursor-pointer transition-colors'
            )}
            onClick={() => onSelect(search.query)}
          >
            <div className="text-muted-foreground">
              {search.type ? typeIcons[search.type] : <Search className="w-3.5 h-3.5" />}
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{search.query}</p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(search.timestamp, { addSuffix: true })}
              </p>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity',
                'hover:bg-destructive/10 hover:text-destructive'
              )}
              onClick={(e) => {
                e.stopPropagation();
                removeSearch(search.query);
              }}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};
