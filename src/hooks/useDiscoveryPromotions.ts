import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isDemoMode } from '@/lib/appMode';
import type { MapFilters } from '@/components/MapFilterSheet';
import { generateLocalPromotions } from '@/constants/mockPromotions';

const MILES_TO_KM = 1.60934;
const RETRY_COUNT = 2;
const RETRY_DELAY_MS = 800;
const CACHE_TTL_MS = 90_000; // 90 seconds

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface DiscoveryPromotion {
  id: string;
  business_name: string;
  description: string;
  reward_type: 'vicoin' | 'icoin' | 'both';
  reward_amount: number;
  required_action: string;
  latitude: number;
  longitude: number;
  address: string;
  category: string;
  distance?: number;
  image_url?: string | null;
  expires_at?: string | null;
}

export interface DiscoveryPromotionsResult {
  promotions: DiscoveryPromotion[];
  fromBackend: boolean;
  total?: number;
  error?: string;
}

export interface UseDiscoveryPromotionsOptions {
  latitude: number;
  longitude: number;
  filters?: MapFilters | null;
  rewardFilter?: 'all' | 'vicoin' | 'icoin';
  sortBy?: 'distance' | 'reward_desc' | 'reward_asc' | 'expiring_soon';
  limit?: number;
  enabled?: boolean;
}

export interface UseDiscoveryPromotionsReturn {
  promotions: DiscoveryPromotion[];
  isLoading: boolean;
  error: string | null;
  fromBackend: boolean;
  lastFetchedAt: number | null;
  total: number;
  refetch: (center?: { lat: number; lng: number }, force?: boolean) => Promise<void>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function useDiscoveryPromotions({
  latitude,
  longitude,
  filters,
  rewardFilter = 'all',
  sortBy = 'distance',
  limit = 150,
  enabled = true,
}: UseDiscoveryPromotionsOptions): UseDiscoveryPromotionsReturn {
  const [promotions, setPromotions] = useState<DiscoveryPromotion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromBackend, setFromBackend] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const cacheKeyRef = useRef<string>('');
  const cacheTimeRef = useRef<number>(0);

  const fetchPromotions = useCallback(
    async (center?: { lat: number; lng: number }, force = false) => {
      if (!enabled) return;

      const lat = center?.lat ?? latitude;
      const lng = center?.lng ?? longitude;

      const radiusKm = filters
        ? Math.min(200, Math.round(filters.distance * MILES_TO_KM * 10) / 10)
        : 16;
      const minReward = filters?.minReward ?? 0;
      const categories = filters?.categories?.length ? filters.categories : undefined;
      const rewardType = rewardFilter === 'all' ? undefined : rewardFilter;

      if (isDemoMode) {
        const mockList = generateLocalPromotions(lat, lng, radiusKm, minReward);
        const withDistance = mockList.map((p) => ({
          ...p,
          distance: Math.round(haversineKm(lat, lng, p.latitude, p.longitude) * 100) / 100,
        }));
        let filtered = withDistance;
        if (rewardFilter !== 'all') {
          filtered = filtered.filter((p) => p.reward_type === rewardFilter || p.reward_type === 'both');
        }
        if (categories?.length) {
          filtered = filtered.filter((p) => p.category && categories.includes(p.category));
        }
        filtered.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
        const limited = filtered.slice(0, limit);
        setPromotions(limited as DiscoveryPromotion[]);
        setTotal(limited.length);
        setFromBackend(false);
        setLastFetchedAt(Date.now());
        setError(null);
        setIsLoading(false);
        return;
      }

      const cacheKey = `${lat.toFixed(4)}_${lng.toFixed(4)}_${radiusKm}_${minReward}_${categories?.join(',') ?? ''}_${rewardType ?? 'all'}_${sortBy}`;
      if (
        !force &&
        cacheKey === cacheKeyRef.current &&
        Date.now() - cacheTimeRef.current < CACHE_TTL_MS
      ) {
        return;
      }

      setIsLoading(true);
      setError(null);

      let lastErr: unknown;
      for (let attempt = 0; attempt <= RETRY_COUNT; attempt++) {
        try {
          const { data, error: fnError } = await supabase.functions.invoke('get-nearby-promotions', {
            body: {
              latitude: lat,
              longitude: lng,
              radiusKm,
              rewardType,
              minReward: minReward > 0 ? minReward : undefined,
              categories,
              sortBy,
              limit,
            },
          });

          if (fnError) throw fnError;

          const list = (data?.promotions ?? []) as DiscoveryPromotion[];
          setPromotions(list);
          setTotal(data?.total ?? list.length);
          setFromBackend(true);
          setLastFetchedAt(Date.now());
          cacheKeyRef.current = cacheKey;
          cacheTimeRef.current = Date.now();
          return;
        } catch (e) {
          lastErr = e;
          if (attempt < RETRY_COUNT) {
            await sleep(RETRY_DELAY_MS * (attempt + 1));
          }
        }
      }

      setError(lastErr instanceof Error ? lastErr.message : 'Failed to load promotions');
      setFromBackend(false);
      // Fallback: show rich mock promotions so the discovery experience still works
      const mockList = generateLocalPromotions(lat, lng, 80, 0);
      const withDistance = mockList.map((p) => ({
        ...p,
        distance: Math.round(haversineKm(lat, lng, p.latitude, p.longitude) * 100) / 100,
      }));
      let filtered = withDistance;
      if (rewardFilter !== 'all') {
        filtered = filtered.filter(
          (p) => p.reward_type === rewardFilter || p.reward_type === 'both'
        );
      }
      if (minReward > 0) {
        filtered = filtered.filter((p) => p.reward_amount >= minReward);
      }
      const categoryList = filters?.categories?.length ? filters.categories : undefined;
      if (categoryList?.length) {
        filtered = filtered.filter((p) => p.category && categoryList.includes(p.category));
      }
      const sortFn = (a: DiscoveryPromotion, b: DiscoveryPromotion) => {
        switch (sortBy) {
          case 'reward_desc':
            return b.reward_amount - a.reward_amount;
          case 'reward_asc':
            return a.reward_amount - b.reward_amount;
          case 'expiring_soon': {
            const expA = a.expires_at ? new Date(a.expires_at).getTime() : Infinity;
            const expB = b.expires_at ? new Date(b.expires_at).getTime() : Infinity;
            return expA - expB;
          }
          default:
            return (a.distance ?? 0) - (b.distance ?? 0);
        }
      };
      filtered.sort(sortFn);
      const limited = filtered.slice(0, limit);
      setPromotions(limited as DiscoveryPromotion[]);
      setTotal(limited.length);
    },
    [
      enabled,
      latitude,
      longitude,
      filters,
      rewardFilter,
      sortBy,
      limit,
    ]
  );

  useEffect(() => {
    if (enabled && latitude != null && longitude != null && !isNaN(latitude) && !isNaN(longitude)) {
      fetchPromotions({ lat: latitude, lng: longitude });
    }
  }, [
    enabled,
    latitude,
    longitude,
    filters?.distance,
    filters?.minReward,
    filters?.categories?.join(','),
    rewardFilter,
    sortBy,
    limit,
    fetchPromotions,
  ]);

  return {
    promotions,
    isLoading,
    error,
    fromBackend,
    lastFetchedAt,
    total,
    refetch: fetchPromotions,
  };
}
