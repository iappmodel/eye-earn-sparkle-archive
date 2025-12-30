import React, { useState, useRef, useEffect } from 'react';
import { Search, X, MapPin, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface SearchResult {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
  place_type: string[];
}

interface MapSearchBarProps {
  mapboxToken: string;
  onSelectLocation: (lng: number, lat: number, placeName: string) => void;
  className?: string;
}

export const MapSearchBar: React.FC<MapSearchBarProps> = ({
  mapboxToken,
  onSelectLocation,
  className,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [recentSearches, setRecentSearches] = useState<{ name: string; lng: number; lat: number }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('map-recent-searches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse recent searches');
      }
    }
  }, []);

  const saveRecentSearch = (name: string, lng: number, lat: number) => {
    const newSearches = [
      { name, lng, lat },
      ...recentSearches.filter(s => s.name !== name).slice(0, 4),
    ];
    setRecentSearches(newSearches);
    localStorage.setItem('map-recent-searches', JSON.stringify(newSearches));
  };

  const searchLocations = async (searchQuery: string) => {
    if (!searchQuery.trim() || !mapboxToken) {
      setResults([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?access_token=${mapboxToken}&types=place,poi,address&limit=5`
      );
      const data = await response.json();
      setResults(data.features || []);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (value: string) => {
    setQuery(value);
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      searchLocations(value);
    }, 300);
  };

  const handleSelectResult = (result: SearchResult) => {
    const [lng, lat] = result.center;
    onSelectLocation(lng, lat, result.place_name);
    saveRecentSearch(result.place_name, lng, lat);
    setQuery(result.place_name.split(',')[0]);
    setShowResults(false);
    setResults([]);
  };

  const handleSelectRecent = (search: { name: string; lng: number; lat: number }) => {
    onSelectLocation(search.lng, search.lat, search.name);
    setQuery(search.name.split(',')[0]);
    setShowResults(false);
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    inputRef.current?.focus();
  };

  return (
    <div className={cn('relative', className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search locations or businesses..."
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setShowResults(true)}
          className="pl-10 pr-10 bg-background/95 backdrop-blur-lg border-border/50"
        />
        {query && (
          <button
            onClick={clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-full"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Results Dropdown */}
      {showResults && (results.length > 0 || recentSearches.length > 0) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-background/95 backdrop-blur-lg border border-border rounded-xl shadow-xl overflow-hidden z-50">
          {isLoading && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Searching...
            </div>
          )}

          {!isLoading && results.length > 0 && (
            <div className="py-2">
              {results.map((result) => (
                <button
                  key={result.id}
                  onClick={() => handleSelectResult(result)}
                  className="w-full px-4 py-3 flex items-start gap-3 hover:bg-muted/50 transition-colors text-left"
                >
                  <MapPin className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{result.place_name.split(',')[0]}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {result.place_name.split(',').slice(1).join(',').trim()}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {!isLoading && results.length === 0 && query === '' && recentSearches.length > 0 && (
            <div className="py-2">
              <p className="px-4 py-2 text-xs text-muted-foreground font-medium">Recent Searches</p>
              {recentSearches.map((search, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectRecent(search)}
                  className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
                >
                  <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{search.name.split(',')[0]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Click outside to close */}
      {showResults && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowResults(false)}
        />
      )}
    </div>
  );
};
