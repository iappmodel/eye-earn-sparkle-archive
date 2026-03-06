/**
 * useRouteBuilderFromFeed – geolocation, Mapbox token, and nearby promotions
 * for the Route Builder when opened from the feed (no map).
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getMapboxEnvToken } from '@/lib/demoRuntime';

export interface NearbyPromoForRoute {
  id: string;
  business_name: string;
  latitude: number;
  longitude: number;
  address?: string;
  category?: string;
  reward_type: 'vicoin' | 'icoin' | 'both';
  reward_amount: number;
  required_action?: string;
}

const DEFAULT_CENTER = { lat: 40.7128, lng: -74.006 }; // NYC fallback

export function useRouteBuilderFromFeed(open: boolean) {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const requestedRef = useRef(false);

  // Request real user location when Route Builder opens (never use default coords for API calls)
  useEffect(() => {
    if (!open) return;
    if (requestedRef.current) return;
    if (!navigator.geolocation) {
      setLocationError('Location not available');
      setLocationLoading(false);
      return;
    }
    requestedRef.current = true;
    setLocationLoading(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationLoading(false);
      },
      () => {
        setUserLocation(null);
        setLocationError('Enable location for nearby promotions');
        setLocationLoading(false);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  }, [open]);

  // Reset when sheet closes so we re-request next time
  useEffect(() => {
    if (!open) requestedRef.current = false;
  }, [open]);

  // Mapbox token (env or edge function)
  useEffect(() => {
    const envToken = getMapboxEnvToken();
    if (envToken) {
      setMapboxToken(envToken);
      return;
    }
    let cancelled = false;
    supabase.functions
      .invoke('get-mapbox-token')
      .then(({ data }) => {
        if (!cancelled && data?.token) setMapboxToken(data.token);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const fetchNearbyPromotions = useCallback(
    async (opts?: { radiusKm?: number; limit?: number; minReward?: number }) => {
      // Only call API with real user location; never send default/fake coords
      if (!userLocation) return [];
      const radiusKm = opts?.radiusKm ?? 16;
      const limit = opts?.limit ?? 100;
      const minReward = opts?.minReward ?? 0;

      const { data, error } = await supabase.functions.invoke('get-nearby-promotions', {
        body: {
          latitude: userLocation.lat,
          longitude: userLocation.lng,
          radiusKm,
          limit,
          minReward,
          sortBy: 'distance',
        },
      });

      if (error) {
        console.warn('[useRouteBuilderFromFeed] get-nearby-promotions error:', error);
        return [];
      }
      const promotions = (data?.promotions ?? []) as Array<{
        id: string;
        business_name: string;
        latitude: number;
        longitude: number;
        address?: string;
        category?: string;
        reward_type: string;
        reward_amount: number;
        required_action?: string;
      }>;
      return promotions.map((p): NearbyPromoForRoute => ({
        id: p.id,
        business_name: p.business_name,
        latitude: p.latitude,
        longitude: p.longitude,
        address: p.address,
        category: p.category ?? undefined,
        reward_type: (p.reward_type === 'both' ? 'both' : p.reward_type === 'icoin' ? 'icoin' : 'vicoin') as 'vicoin' | 'icoin' | 'both',
        reward_amount: p.reward_amount,
        required_action: p.required_action,
      }));
    },
    [userLocation?.lat, userLocation?.lng]
  );

  return {
    userLocation,
    mapboxToken,
    locationLoading,
    locationError,
    fetchNearbyPromotions,
    defaultCenter: DEFAULT_CENTER,
  };
}
