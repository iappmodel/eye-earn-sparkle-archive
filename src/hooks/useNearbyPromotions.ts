import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { notificationSoundService } from '@/services/notificationSound.service';

interface NearbyPromotion {
  id: string;
  business_name: string;
  reward_amount: number;
  reward_type: string;
  category: string | null;
  distance: number;
  latitude: number;
  longitude: number;
}

export interface RouteSuggestionCluster {
  promotions: NearbyPromotion[];
  center: { lat: number; lng: number };
}

const HIGH_VALUE_THRESHOLD = 50;
const ALERT_RADIUS_METERS = 500;
const ROUTE_CLUSTER_THRESHOLD = 3; // minimum promos to suggest a route
const CHECK_INTERVAL = 30000;
const COOLDOWN_MINUTES = 30;
const ROUTE_SUGGESTION_COOLDOWN = 10; // minutes

export function useNearbyPromotions(enabled: boolean = true) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [nearbyPromotions, setNearbyPromotions] = useState<NearbyPromotion[]>([]);
  const [isWatching, setIsWatching] = useState(false);
  const [routeSuggestion, setRouteSuggestion] = useState<RouteSuggestionCluster | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const alertedPromotionsRef = useRef<Map<string, number>>(new Map());
  const lastPositionRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastRouteSuggestionRef = useRef<number>(0);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const dismissRouteSuggestion = useCallback(() => {
    setRouteSuggestion(null);
  }, []);

  const checkNearbyPromotions = useCallback(async (latitude: number, longitude: number) => {
    if (!user?.id) return;

    try {
      const { data: promotions, error } = await supabase
        .from('promotions')
        .select('*')
        .eq('is_active', true)
        .gte('reward_amount', HIGH_VALUE_THRESHOLD);

      if (error) throw error;

      const nearby: NearbyPromotion[] = [];
      const now = Date.now();

      for (const promo of promotions || []) {
        const distance = calculateDistance(latitude, longitude, promo.latitude, promo.longitude);
        
        if (distance <= ALERT_RADIUS_METERS) {
          nearby.push({
            id: promo.id,
            business_name: promo.business_name,
            reward_amount: promo.reward_amount,
            reward_type: promo.reward_type,
            category: promo.category,
            distance,
            latitude: promo.latitude,
            longitude: promo.longitude,
          });

          const lastAlerted = alertedPromotionsRef.current.get(promo.id);
          const cooldownMs = COOLDOWN_MINUTES * 60 * 1000;

          if (!lastAlerted || now - lastAlerted > cooldownMs) {
            alertedPromotionsRef.current.set(promo.id, now);
            notificationSoundService.playReward();

            toast({
              title: '💰 High-Value Promotion Nearby!',
              description: `${promo.business_name} is offering ${promo.reward_amount} ${promo.reward_type}! Only ${Math.round(distance)}m away.`,
              duration: 8000,
            });

            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('Promotion Alert! 💰', {
                body: `${promo.business_name}: ${promo.reward_amount} ${promo.reward_type} - ${Math.round(distance)}m away`,
                icon: '/pwa-192x192.png',
                tag: `promo-${promo.id}`,
              });
            }
          }
        }
      }

      setNearbyPromotions(nearby);

      // Route cluster detection
      const routeCooldownMs = ROUTE_SUGGESTION_COOLDOWN * 60 * 1000;
      if (
        nearby.length >= ROUTE_CLUSTER_THRESHOLD &&
        now - lastRouteSuggestionRef.current > routeCooldownMs
      ) {
        lastRouteSuggestionRef.current = now;
        setRouteSuggestion({
          promotions: nearby,
          center: { lat: latitude, lng: longitude },
        });

        // Browser notification for route suggestion
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('🗺️ Route Opportunity!', {
            body: `You're near ${nearby.length} earning spots – start a route?`,
            icon: '/pwa-192x192.png',
            tag: 'route-suggestion',
          });
        }
      }
    } catch (error) {
      console.error('Error checking nearby promotions:', error);
    }
  }, [user?.id, toast]);

  const startWatching = useCallback(() => {
    if (!enabled || !navigator.geolocation || isWatching) return;

    setIsWatching(true);

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        
        if (lastPositionRef.current) {
          const moved = calculateDistance(
            lastPositionRef.current.lat, lastPositionRef.current.lng,
            latitude, longitude,
          );
          if (moved < 50) return;
        }

        lastPositionRef.current = { lat: latitude, lng: longitude };
        checkNearbyPromotions(latitude, longitude);
      },
      (error) => {
        console.error('Geolocation error:', error);
        setIsWatching(false);
      },
      { enableHighAccuracy: true, maximumAge: CHECK_INTERVAL, timeout: 10000 },
    );
  }, [enabled, isWatching, checkNearbyPromotions]);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsWatching(false);
  }, []);

  useEffect(() => {
    if (enabled && user?.id) {
      startWatching();
    }
    return () => stopWatching();
  }, [enabled, user?.id, startWatching, stopWatching]);

  return {
    nearbyPromotions,
    isWatching,
    startWatching,
    stopWatching,
    routeSuggestion,
    dismissRouteSuggestion,
  };
}
