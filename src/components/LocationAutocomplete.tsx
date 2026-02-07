import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MapPin, X, Clock, Loader2, Navigation } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface GeocodingResult {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
  place_type: string[];
}

export interface LocationSelection {
  address: string;
  latitude: number;
  longitude: number;
}

interface LocationAutocompleteProps {
  mapboxToken: string;
  placeholder?: string;
  value?: string;
  proximity?: { lat: number; lng: number } | null;
  onSelect: (location: LocationSelection) => void;
  onClear?: () => void;
  /** Show a "Use Current Location" option */
  showCurrentLocation?: boolean;
  onUseCurrentLocation?: () => void;
  className?: string;
  storageKey?: string;
  autoFocus?: boolean;
}

export const LocationAutocomplete: React.FC<LocationAutocompleteProps> = ({
  mapboxToken,
  placeholder = 'Search for a location...',
  value = '',
  proximity,
  onSelect,
  onClear,
  showCurrentLocation,
  onUseCurrentLocation,
  className,
  storageKey = 'route-recent-locations',
  autoFocus = false,
}) => {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [recentSearches, setRecentSearches] = useState<LocationSelection[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  // Load recent searches
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setRecentSearches(JSON.parse(saved));
    } catch { /* ignore */ }
  }, [storageKey]);

  // Sync external value
  useEffect(() => {
    setQuery(value);
  }, [value]);

  const saveRecent = useCallback((loc: LocationSelection) => {
    const updated = [loc, ...recentSearches.filter(s => s.address !== loc.address).slice(0, 4)];
    setRecentSearches(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
  }, [recentSearches, storageKey]);

  const searchLocations = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim() || !mapboxToken) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    try {
      let url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?access_token=${mapboxToken}&types=place,poi,address&limit=5`;
      if (proximity) {
        url += `&proximity=${proximity.lng},${proximity.lat}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      setResults(data.features || []);
    } catch (err) {
      console.error('Geocoding error:', err);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [mapboxToken, proximity]);

  const handleInputChange = (val: string) => {
    setQuery(val);
    setShowDropdown(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchLocations(val), 300);
  };

  const handleSelectResult = (result: GeocodingResult) => {
    const [lng, lat] = result.center;
    const loc: LocationSelection = {
      address: result.place_name,
      latitude: lat,
      longitude: lng,
    };
    setQuery(result.place_name.split(',')[0]);
    setShowDropdown(false);
    setResults([]);
    saveRecent(loc);
    onSelect(loc);
  };

  const handleSelectRecent = (loc: LocationSelection) => {
    setQuery(loc.address.split(',')[0]);
    setShowDropdown(false);
    onSelect(loc);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    onClear?.();
    inputRef.current?.focus();
  };

  const hasDropdownContent = results.length > 0 || (query === '' && (recentSearches.length > 0 || showCurrentLocation));

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => setShowDropdown(true)}
          autoFocus={autoFocus}
          className="pl-10 pr-10 h-9 text-sm"
        />
        {isLoading ? (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
        ) : query ? (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 hover:bg-muted rounded-full"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        ) : null}
      </div>

      {/* Dropdown */}
      {showDropdown && hasDropdownContent && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-xl shadow-xl overflow-hidden z-[60] max-h-64 overflow-y-auto">
          {/* Current Location option */}
          {showCurrentLocation && onUseCurrentLocation && (
            <button
              onClick={() => {
                onUseCurrentLocation();
                setShowDropdown(false);
              }}
              className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left border-b border-border/50"
            >
              <Navigation className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm font-medium text-primary">Use Current Location</span>
            </button>
          )}

          {/* Search results */}
          {results.length > 0 && (
            <div className="py-1">
              {results.map((result) => (
                <button
                  key={result.id}
                  onClick={() => handleSelectResult(result)}
                  className="w-full px-4 py-2.5 flex items-start gap-3 hover:bg-muted/50 transition-colors text-left"
                >
                  <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {result.place_name.split(',')[0]}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {result.place_name.split(',').slice(1).join(',').trim()}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Recent searches (only when query is empty) */}
          {!isLoading && results.length === 0 && query === '' && recentSearches.length > 0 && (
            <div className="py-1">
              <p className="px-4 py-1.5 text-xs text-muted-foreground font-medium">Recent</p>
              {recentSearches.map((search, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectRecent(search)}
                  className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
                >
                  <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm truncate">{search.address.split(',')[0]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Click outside to close */}
      {showDropdown && (
        <div
          className="fixed inset-0 z-[55]"
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
};
