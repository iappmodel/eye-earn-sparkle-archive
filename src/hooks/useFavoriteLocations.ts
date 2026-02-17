import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const FAVORITES_STORAGE_KEY = 'eye-earn-favorite-ids';
const STORAGE_VERSION = 1;

/** Denormalized favorite location with optional promotion details */
export interface FavoriteLocationRow {
  id: string;
  user_id: string;
  promotion_id: string | null;
  business_name: string;
  latitude: number;
  longitude: number;
  address: string | null;
  category: string | null;
  notes: string | null;
  created_at: string;
  promotion?: {
    id: string;
    reward_amount: number;
    reward_type: string;
    description: string | null;
    image_url: string | null;
    expires_at: string | null;
    required_action: string;
  } | null;
}

export interface FavoriteLocation {
  id: string;
  promotionId: string | null;
  businessName: string;
  latitude: number;
  longitude: number;
  address: string | null;
  category: string | null;
  notes: string | null;
  createdAt: string;
  rewardAmount?: number;
  rewardType?: string;
  description?: string | null;
  imageUrl?: string | null;
  expiresAt?: string | null;
  requiredAction?: string;
  distanceKm?: number;
}

export type FavoriteSortOption = 'date_added' | 'distance' | 'reward_desc' | 'expiring_soon';

export interface UseFavoriteLocationsOptions {
  userLat?: number | null;
  userLng?: number | null;
  sortBy?: FavoriteSortOption;
  enabled?: boolean;
}

export interface UseFavoriteLocationsReturn {
  favorites: FavoriteLocation[];
  favoriteIds: Set<string>;
  isLoading: boolean;
  error: string | null;
  toggleFavorite: (promotion: {
    id: string;
    business_name: string;
    latitude: number;
    longitude: number;
    address?: string;
    category?: string;
  }) => Promise<void>;
  isFavorite: (promotionId: string) => boolean;
  removeFavorite: (favoriteId: string) => Promise<void>;
  updateNotes: (favoriteId: string, notes: string | null) => Promise<void>;
  refetch: () => Promise<void>;
}

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

function toFavorite(row: FavoriteLocationRow, userLat?: number, userLng?: number): FavoriteLocation {
  const p = row.promotion;
  let distanceKm: number | undefined;
  if (userLat != null && userLng != null && !isNaN(userLat) && !isNaN(userLng)) {
    distanceKm = haversineKm(userLat, userLng, row.latitude, row.longitude);
  }
  return {
    id: row.id,
    promotionId: row.promotion_id,
    businessName: row.business_name,
    latitude: row.latitude,
    longitude: row.longitude,
    address: row.address,
    category: row.category,
    notes: row.notes,
    createdAt: row.created_at,
    rewardAmount: p?.reward_amount,
    rewardType: p?.reward_type,
    description: p?.description,
    imageUrl: p?.image_url,
    expiresAt: p?.expires_at ?? undefined,
    requiredAction: p?.required_action,
    distanceKm,
  };
}

export function useFavoriteLocations({
  userLat,
  userLng,
  sortBy = 'date_added',
  enabled = true,
}: UseFavoriteLocationsOptions = {}): UseFavoriteLocationsReturn {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteLocation[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFavorites = useCallback(async () => {
    if (!user || !enabled) {
      setFavorites([]);
      setFavoriteIds(new Set());
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('favorite_locations')
        .select(
          `
          id,
          user_id,
          promotion_id,
          business_name,
          latitude,
          longitude,
          address,
          category,
          notes,
          created_at,
          promotions (
            id,
            reward_amount,
            reward_type,
            description,
            image_url,
            expires_at,
            required_action
          )
        `
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const rows = (data || []) as FavoriteLocationRow[];
      const list = rows.map((r) => toFavorite(r, userLat ?? undefined, userLng ?? undefined));

      // Sort
      const sorted = [...list].sort((a, b) => {
        switch (sortBy) {
          case 'distance':
            if (a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm;
            if (a.distanceKm != null) return -1;
            if (b.distanceKm != null) return 1;
            return 0;
          case 'reward_desc':
            return (b.rewardAmount ?? 0) - (a.rewardAmount ?? 0);
          case 'expiring_soon': {
            const aExp = a.expiresAt ? new Date(a.expiresAt).getTime() : Infinity;
            const bExp = b.expiresAt ? new Date(b.expiresAt).getTime() : Infinity;
            return aExp - bExp;
          }
          case 'date_added':
          default:
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        }
      });

      setFavorites(sorted);
      setFavoriteIds(
        new Set(rows.map((r) => r.promotion_id).filter((id): id is string => !!id))
      );
    } catch (err) {
      console.error('[useFavoriteLocations] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load favorites');
      setFavorites([]);
      setFavoriteIds(new Set());
      toast.error('Failed to load favorites');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, enabled, sortBy, userLat, userLng]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  // Real-time subscription for cross-tab / multi-device sync
  useEffect(() => {
    if (!user?.id || !enabled) return;

    const channel = supabase
      .channel('favorite_locations_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'favorite_locations',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchFavorites();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, enabled, fetchFavorites]);

  const toggleFavorite = useCallback(
    async (promotion: {
      id: string;
      business_name: string;
      latitude: number;
      longitude: number;
      address?: string;
      category?: string;
    }) => {
      if (!user) {
        toast.error('Please sign in to save favorites');
        return;
      }

      const currentlyFavorite = favoriteIds.has(promotion.id);

      if (currentlyFavorite) {
        const { error: delError } = await supabase
          .from('favorite_locations')
          .delete()
          .eq('user_id', user.id)
          .eq('promotion_id', promotion.id);

        if (delError) {
          toast.error('Failed to remove from favorites');
          return;
        }
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          next.delete(promotion.id);
          return next;
        });
        setFavorites((prev) => prev.filter((f) => f.promotionId !== promotion.id));
        toast.success('Removed from favorites');
      } else {
        const { error: insertError } = await supabase.from('favorite_locations').insert({
          user_id: user.id,
          promotion_id: promotion.id,
          business_name: promotion.business_name,
          latitude: promotion.latitude,
          longitude: promotion.longitude,
          address: promotion.address || null,
          category: promotion.category || null,
        });

        if (insertError) {
          toast.error('Failed to add to favorites');
          return;
        }
        setFavoriteIds((prev) => new Set([...prev, promotion.id]));
        toast.success('Added to favorites');
        await fetchFavorites();
      }
    },
    [user, favoriteIds, fetchFavorites]
  );

  const removeFavorite = useCallback(
    async (favoriteId: string) => {
      if (!user) return;

      const fav = favorites.find((f) => f.id === favoriteId);
      const promoId = fav?.promotionId;

      const { error: delError } = await supabase
        .from('favorite_locations')
        .delete()
        .eq('id', favoriteId)
        .eq('user_id', user.id);

      if (delError) {
        toast.error('Failed to remove');
        return;
      }
      if (promoId) {
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          next.delete(promoId);
          return next;
        });
      }
      setFavorites((prev) => prev.filter((f) => f.id !== favoriteId));
      toast.success('Removed from favorites');
    },
    [user, favorites]
  );

  const updateNotes = useCallback(
    async (favoriteId: string, notes: string | null) => {
      if (!user) return;

      const { error: updateError } = await supabase
        .from('favorite_locations')
        .update({ notes })
        .eq('id', favoriteId)
        .eq('user_id', user.id);

      if (updateError) {
        toast.error('Failed to update notes');
        return;
      }
      setFavorites((prev) =>
        prev.map((f) => (f.id === favoriteId ? { ...f, notes } : f))
      );
    },
    [user]
  );

  const isFavorite = useCallback(
    (promotionId: string) => favoriteIds.has(promotionId),
    [favoriteIds]
  );

  return {
    favorites,
    favoriteIds,
    isLoading,
    error,
    toggleFavorite,
    isFavorite,
    removeFavorite,
    updateNotes,
    refetch: fetchFavorites,
  };
}
