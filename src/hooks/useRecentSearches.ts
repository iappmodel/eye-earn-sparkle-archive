import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'recent_searches';
const MAX_SEARCHES = 10;

export interface RecentSearch {
  query: string;
  timestamp: number;
  type?: 'user' | 'content' | 'tag' | 'location';
}

export const useRecentSearches = () => {
  const [searches, setSearches] = useState<RecentSearch[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setSearches(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load recent searches:', error);
    }
  }, []);

  // Save to localStorage when searches change
  const saveSearches = useCallback((newSearches: RecentSearch[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSearches));
      setSearches(newSearches);
    } catch (error) {
      console.error('Failed to save recent searches:', error);
    }
  }, []);

  const addSearch = useCallback((query: string, type?: RecentSearch['type']) => {
    if (!query.trim()) return;

    setSearches(prev => {
      // Remove duplicate if exists
      const filtered = prev.filter(s => s.query.toLowerCase() !== query.toLowerCase());
      
      // Add new search at the beginning
      const newSearches: RecentSearch[] = [
        { query: query.trim(), timestamp: Date.now(), type },
        ...filtered,
      ].slice(0, MAX_SEARCHES);

      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSearches));
      return newSearches;
    });
  }, []);

  const removeSearch = useCallback((query: string) => {
    setSearches(prev => {
      const newSearches = prev.filter(s => s.query !== query);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newSearches));
      return newSearches;
    });
  }, []);

  const clearSearches = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setSearches([]);
  }, []);

  return {
    searches,
    addSearch,
    removeSearch,
    clearSearches,
  };
};
