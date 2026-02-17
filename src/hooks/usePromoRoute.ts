import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchUserRoutes,
  saveRouteToServer,
  deleteRouteFromServer,
  fetchWatchLater,
  syncWatchLaterToServer,
  addWatchLaterOnServer,
  removeWatchLaterOnServer,
} from '@/services/route.service';

export interface RouteStop {
  id: string;
  promotionId: string;
  businessName: string;
  latitude: number;
  longitude: number;
  address?: string;
  category?: string;
  rewardType: 'vicoin' | 'icoin' | 'both';
  rewardAmount: number;
  requiredAction?: string;
  order: number;
  /** Added from feed content (has associated video/promo) */
  fromFeed?: boolean;
  contentId?: string;
}

export type TransportMode = 'walking' | 'driving' | 'transit' | 'cycling' | 'running';

export type RouteOptimization = 'more_earnings' | 'faster' | 'effective' | 'balanced';

export interface RouteFilters {
  rewardTypes: ('vicoin' | 'icoin' | 'both')[];
  optimization: RouteOptimization;
  maxStops: number;
  maxDistance: number; // km
  categories: string[];
  minRewardPerStop: number;
}

export interface RouteDestination {
  address: string;
  latitude: number;
  longitude: number;
}

export interface RouteSchedule {
  day: string; // 'mon' | 'tue' | ... | 'sun' | 'everyday'
  time: string; // HH:mm format
}

export interface RouteOrigin {
  address: string;
  latitude: number;
  longitude: number;
}

export interface PromoRoute {
  id: string;
  name: string;
  stops: RouteStop[];
  transportMode: TransportMode;
  filters: RouteFilters;
  isCommuteRoute: boolean;
  createdAt: string;
  totalReward: number;
  estimatedTime?: number; // minutes
  estimatedDistance?: number; // km
  destination?: RouteDestination | null;
  schedule?: RouteSchedule | null;
  /** Per-segment transport override keyed by "fromIndex-toIndex" */
  segmentTransport?: Record<string, TransportMode>;
  /** Label explaining why this route was suggested */
  smartLabel?: string;
  /** Custom starting location (defaults to user GPS if null) */
  origin?: RouteOrigin | null;
}

export const defaultRouteFilters: RouteFilters = {
  rewardTypes: ['vicoin', 'icoin', 'both'],
  optimization: 'balanced',
  maxStops: 10,
  maxDistance: 20,
  categories: [],
  minRewardPerStop: 0,
};

const generateRouteId = () => `route-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const SAVED_ROUTES_KEY = 'promo-saved-routes';
const WATCH_LATER_KEY = 'promo-watch-later';

function readFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeToStorage<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage full or unavailable – silently ignore
  }
}

// Haversine for distance sorting (km)
const haversine = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Approximate speed km/h by transport mode
const SPEED_KMH: Record<TransportMode, number> = {
  walking: 5,
  running: 10,
  cycling: 15,
  transit: 25,
  driving: 40,
};

/** Compute estimated distance (km) and time (minutes) for a route. */
export function computeRouteEstimate(route: PromoRoute | null): { estimatedDistanceKm: number; estimatedTimeMinutes: number } {
  if (!route || route.stops.length === 0) return { estimatedDistanceKm: 0, estimatedTimeMinutes: 0 };
  let totalKm = 0;
  const stops = route.stops;
  const origin = route.origin ?? null;
  const dest = route.destination ?? null;
  if (origin && stops.length > 0)
    totalKm += haversine(origin.latitude, origin.longitude, stops[0].latitude, stops[0].longitude);
  for (let i = 0; i < stops.length - 1; i++)
    totalKm += haversine(stops[i].latitude, stops[i].longitude, stops[i + 1].latitude, stops[i + 1].longitude);
  if (dest && stops.length > 0)
    totalKm += haversine(stops[stops.length - 1].latitude, stops[stops.length - 1].longitude, dest.latitude, dest.longitude);
  const speed = SPEED_KMH[route.transportMode] ?? 5;
  const estimatedTimeMinutes = Math.round((totalKm / speed) * 60);
  return { estimatedDistanceKm: Math.round(totalKm * 10) / 10, estimatedTimeMinutes };
}

export function usePromoRoute() {
  const { user } = useAuth();
  const [activeRoute, setActiveRoute] = useState<PromoRoute | null>(null);
  const [savedRoutes, setSavedRoutes] = useState<PromoRoute[]>(() => readFromStorage<PromoRoute[]>(SAVED_ROUTES_KEY, []));
  const [isBuilding, setIsBuilding] = useState(false);
  const [watchLater, setWatchLater] = useState<RouteStop[]>(() => readFromStorage<RouteStop[]>(WATCH_LATER_KEY, []));
  const [routesSyncing, setRoutesSyncing] = useState(false);
  const [watchLaterSyncing, setWatchLaterSyncing] = useState(false);
  const [lastRoutesSyncAt, setLastRoutesSyncAt] = useState<number | null>(null);
  const initialFetchDone = useRef(false);

  // Persist to localStorage (backup / offline)
  useEffect(() => { writeToStorage(SAVED_ROUTES_KEY, savedRoutes); }, [savedRoutes]);
  useEffect(() => { writeToStorage(WATCH_LATER_KEY, watchLater); }, [watchLater]);

  // Sync from Supabase when user is present
  useEffect(() => {
    if (!user?.id) {
      initialFetchDone.current = false;
      return;
    }
    let cancelled = false;
    const sync = async () => {
      setRoutesSyncing(true);
      setWatchLaterSyncing(true);
      try {
        const [routes, wl] = await Promise.all([fetchUserRoutes(user.id), fetchWatchLater(user.id)]);
        if (!cancelled) {
          setSavedRoutes(routes);
          setWatchLater(wl);
          setLastRoutesSyncAt(Date.now());
        }
      } catch (e) {
        if (!cancelled) console.error('Route sync failed:', e);
      } finally {
        if (!cancelled) {
          setRoutesSyncing(false);
          setWatchLaterSyncing(false);
          initialFetchDone.current = true;
        }
      }
    };
    sync();
    return () => { cancelled = true; };
  }, [user?.id]);

  // ─── Basic Route Operations ─────────────────────────────────────

  const startRoute = useCallback((name?: string) => {
    const newRoute: PromoRoute = {
      id: generateRouteId(),
      name: name || 'My Route',
      stops: [],
      transportMode: 'walking',
      filters: { ...defaultRouteFilters },
      isCommuteRoute: false,
      createdAt: new Date().toISOString(),
      totalReward: 0,
      destination: null,
      schedule: null,
      segmentTransport: {},
      origin: null,
    };
    setActiveRoute(newRoute);
    setIsBuilding(true);
    return newRoute;
  }, []);

  const setOrigin = useCallback((origin: RouteOrigin | null) => {
    setActiveRoute(prev => (prev ? { ...prev, origin } : prev));
  }, []);

  const addStop = useCallback((stop: Omit<RouteStop, 'order'>) => {
    setActiveRoute(prev => {
      if (!prev) return prev;
      const newStop: RouteStop = { ...stop, order: prev.stops.length };
      const stops = [...prev.stops, newStop];
      return { ...prev, stops, totalReward: stops.reduce((s, st) => s + st.rewardAmount, 0) };
    });
  }, []);

  const removeStop = useCallback((stopId: string) => {
    setActiveRoute(prev => {
      if (!prev) return prev;
      const stops = prev.stops.filter(s => s.id !== stopId).map((s, i) => ({ ...s, order: i }));
      return { ...prev, stops, totalReward: stops.reduce((s, st) => s + st.rewardAmount, 0) };
    });
  }, []);

  const reorderStops = useCallback((fromIndex: number, toIndex: number) => {
    setActiveRoute(prev => {
      if (!prev) return prev;
      const stops = [...prev.stops];
      const [moved] = stops.splice(fromIndex, 1);
      stops.splice(toIndex, 0, moved);
      return { ...prev, stops: stops.map((s, i) => ({ ...s, order: i })) };
    });
  }, []);

  /** Reorder stops by nearest-neighbor from start (origin or first stop) to minimize travel. */
  const optimizeOrder = useCallback((userLat?: number, userLng?: number) => {
    setActiveRoute(prev => {
      if (!prev || prev.stops.length < 2) return prev;
      const startLat = prev.origin?.latitude ?? userLat ?? prev.stops[0].latitude;
      const startLng = prev.origin?.longitude ?? userLng ?? prev.stops[0].longitude;
      const remaining = [...prev.stops];
      const ordered: RouteStop[] = [];
      let currentLat = startLat;
      let currentLng = startLng;
      while (remaining.length > 0) {
        let bestIdx = 0;
        let bestDist = haversine(currentLat, currentLng, remaining[0].latitude, remaining[0].longitude);
        for (let i = 1; i < remaining.length; i++) {
          const d = haversine(currentLat, currentLng, remaining[i].latitude, remaining[i].longitude);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
          }
        }
        const [next] = remaining.splice(bestIdx, 1);
        ordered.push(next);
        currentLat = next.latitude;
        currentLng = next.longitude;
      }
      return {
        ...prev,
        stops: ordered.map((s, i) => ({ ...s, order: i })),
      };
    });
  }, []);

  const isInRoute = useCallback(
    (promotionId: string) => activeRoute?.stops.some(s => s.promotionId === promotionId) ?? false,
    [activeRoute],
  );

  const setTransportMode = useCallback((mode: TransportMode) => {
    setActiveRoute(prev => (prev ? { ...prev, transportMode: mode } : prev));
  }, []);

  const setRouteFilters = useCallback((filters: RouteFilters) => {
    setActiveRoute(prev => (prev ? { ...prev, filters } : prev));
  }, []);

  const toggleCommuteRoute = useCallback(() => {
    setActiveRoute(prev => (prev ? { ...prev, isCommuteRoute: !prev.isCommuteRoute } : prev));
  }, []);

  const renameRoute = useCallback((name: string) => {
    setActiveRoute(prev => (prev ? { ...prev, name } : prev));
  }, []);

  // ─── Destination & Schedule ─────────────────────────────────────

  const setDestination = useCallback((dest: RouteDestination | null) => {
    setActiveRoute(prev => (prev ? { ...prev, destination: dest } : prev));
  }, []);

  const setSchedule = useCallback((schedule: RouteSchedule | null) => {
    setActiveRoute(prev => (prev ? { ...prev, schedule } : prev));
  }, []);

  // ─── Per-Segment Transport ──────────────────────────────────────

  const setSegmentTransport = useCallback((fromIdx: number, toIdx: number, mode: TransportMode) => {
    setActiveRoute(prev => {
      if (!prev) return prev;
      const key = `${fromIdx}-${toIdx}`;
      return { ...prev, segmentTransport: { ...(prev.segmentTransport || {}), [key]: mode } };
    });
  }, []);

  const getSegmentTransport = useCallback(
    (fromIdx: number, toIdx: number): TransportMode => {
      const key = `${fromIdx}-${toIdx}`;
      return activeRoute?.segmentTransport?.[key] || activeRoute?.transportMode || 'walking';
    },
    [activeRoute],
  );

  // ─── Persistence ────────────────────────────────────────────────

  const saveRoute = useCallback(() => {
    if (!activeRoute || activeRoute.stops.length === 0) return null;
    const { estimatedDistanceKm, estimatedTimeMinutes } = computeRouteEstimate(activeRoute);
    const withEstimate: PromoRoute = { ...activeRoute, estimatedTime: estimatedTimeMinutes, estimatedDistance: estimatedDistanceKm };

    setSavedRoutes(prev => {
      const existing = prev.findIndex(r => r.id === activeRoute.id);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = withEstimate;
        return next;
      }
      return [...prev, withEstimate];
    });
    setActiveRoute(withEstimate);

    if (user?.id) {
      setRoutesSyncing(true);
      saveRouteToServer(user.id, withEstimate)
        .then((saved) => {
          setSavedRoutes(prev => {
            const idx = prev.findIndex(r => r.id === saved.id || r.id === activeRoute.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = saved;
              return next;
            }
            return [...prev, saved];
          });
          setActiveRoute(prev => (prev && (prev.id === activeRoute.id || prev.id === saved.id)) ? saved : prev);
        })
        .catch((e) => console.error('Save route to server failed:', e))
        .finally(() => setRoutesSyncing(false));
    }
    return withEstimate;
  }, [activeRoute, user?.id]);

  const finishRoute = useCallback(() => setIsBuilding(false), []);

  const discardRoute = useCallback(() => {
    setActiveRoute(null);
    setIsBuilding(false);
  }, []);

  const loadRoute = useCallback(
    (routeId: string) => {
      const route = savedRoutes.find(r => r.id === routeId);
      if (route) {
        setActiveRoute({ ...route });
        setIsBuilding(true);
      }
    },
    [savedRoutes],
  );

  /** Add an external route (e.g. imported) to saved routes and optionally sync to server. */
  const addSavedRoute = useCallback(
    (route: PromoRoute) => {
      const withId = route.id.startsWith('route-') ? route : { ...route, id: generateRouteId() };
      setSavedRoutes(prev => [...prev, withId]);
      if (user?.id) {
        setRoutesSyncing(true);
        saveRouteToServer(user.id, withId)
          .then((saved) => {
            setSavedRoutes(prev => {
              const idx = prev.findIndex(r => r.id === withId.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = saved;
                return next;
              }
              return [...prev, saved];
            });
          })
          .catch((e) => console.error('Sync imported route failed:', e))
          .finally(() => setRoutesSyncing(false));
      }
    },
    [user?.id],
  );

  const deleteSavedRoute = useCallback(
    (routeId: string) => {
      setSavedRoutes(prev => prev.filter(r => r.id !== routeId));
      if (activeRoute?.id === routeId) {
        setActiveRoute(null);
        setIsBuilding(false);
      }
      if (user?.id && !routeId.startsWith('route-')) {
        deleteRouteFromServer(user.id, routeId).catch((e) => console.error('Delete route on server failed:', e));
      }
    },
    [activeRoute, user?.id],
  );

  // ─── Duplicate Route ─────────────────────────────────────────────

  const duplicateRoute = useCallback(
    (routeId: string) => {
      const route = savedRoutes.find(r => r.id === routeId);
      if (!route) return null;
      const copy: PromoRoute = {
        ...route,
        id: generateRouteId(),
        name: `${route.name} (Copy)`,
        createdAt: new Date().toISOString(),
      };
      setSavedRoutes(prev => [...prev, copy]);
      return copy;
    },
    [savedRoutes],
  );

  // ─── Open saved route directly in Google Maps ──────────────────

  const openSavedRouteInMaps = useCallback(
    (routeId: string, userLat?: number, userLng?: number) => {
      const route = savedRoutes.find(r => r.id === routeId);
      if (!route || route.stops.length === 0) return;
      const stops = route.stops;
      const origin = route.origin
        ? `${route.origin.latitude},${route.origin.longitude}`
        : userLat && userLng
          ? `${userLat},${userLng}`
          : `${stops[0].latitude},${stops[0].longitude}`;
      const dest = route.destination
        ? `${route.destination.latitude},${route.destination.longitude}`
        : `${stops[stops.length - 1].latitude},${stops[stops.length - 1].longitude}`;
      const waypoints =
        stops.length > 2
          ? stops.slice(1, -1).map(s => `${s.latitude},${s.longitude}`).join('|')
          : stops.length === 2 && (route.origin || userLat)
            ? `${stops[0].latitude},${stops[0].longitude}`
            : '';
      const travelMode =
        route.transportMode === 'walking' || route.transportMode === 'running'
          ? 'walking'
          : route.transportMode === 'transit'
            ? 'transit'
            : route.transportMode === 'cycling'
              ? 'bicycling'
              : 'driving';
      let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=${travelMode}`;
      if (waypoints) url += `&waypoints=${encodeURIComponent(waypoints)}`;
      window.open(url, '_blank');
    },
    [savedRoutes],
  );

  // ─── Watch Later ────────────────────────────────────────────────

  const addToWatchLater = useCallback((stop: Omit<RouteStop, 'order'>) => {
    setWatchLater(prev => {
      if (prev.some(s => s.promotionId === stop.promotionId)) return prev;
      const next = [...prev, { ...stop, order: prev.length }];
      if (user?.id) {
        addWatchLaterOnServer(user.id, stop).catch((e) => console.error('Add watch later failed:', e));
      }
      return next;
    });
  }, [user?.id]);

  const removeFromWatchLater = useCallback((promotionId: string) => {
    setWatchLater(prev => prev.filter(s => s.promotionId !== promotionId));
    if (user?.id) {
      removeWatchLaterOnServer(user.id, promotionId).catch((e) => console.error('Remove watch later failed:', e));
    }
  }, [user?.id]);

  const isInWatchLater = useCallback(
    (promotionId: string) => watchLater.some(s => s.promotionId === promotionId),
    [watchLater],
  );

  // ─── Google Maps ────────────────────────────────────────────────

  const openInGoogleMaps = useCallback(
    (userLat?: number, userLng?: number) => {
      if (!activeRoute || activeRoute.stops.length === 0) return;
      const stops = activeRoute.stops;
      // Use custom origin if set, otherwise GPS, otherwise first stop
      const origin = activeRoute.origin
        ? `${activeRoute.origin.latitude},${activeRoute.origin.longitude}`
        : userLat && userLng
          ? `${userLat},${userLng}`
          : `${stops[0].latitude},${stops[0].longitude}`;
      const dest = activeRoute.destination
        ? `${activeRoute.destination.latitude},${activeRoute.destination.longitude}`
        : `${stops[stops.length - 1].latitude},${stops[stops.length - 1].longitude}`;
      const waypoints =
        stops.length > 2
          ? stops.slice(1, -1).map(s => `${s.latitude},${s.longitude}`).join('|')
          : stops.length === 2 && (activeRoute.origin || userLat)
            ? `${stops[0].latitude},${stops[0].longitude}`
            : '';
      const travelMode =
        activeRoute.transportMode === 'walking' || activeRoute.transportMode === 'running'
          ? 'walking'
          : activeRoute.transportMode === 'transit'
            ? 'transit'
            : activeRoute.transportMode === 'cycling'
              ? 'bicycling'
              : 'driving';
      let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=${travelMode}`;
      if (waypoints) url += `&waypoints=${encodeURIComponent(waypoints)}`;
      window.open(url, '_blank');
    },
    [activeRoute],
  );

  // ─── Suggestion Helpers ─────────────────────────────────────────

  type PromotionInput = {
    id: string;
    business_name: string;
    latitude: number;
    longitude: number;
    address?: string;
    category?: string;
    reward_type: 'vicoin' | 'icoin' | 'both';
    reward_amount: number;
    required_action?: string;
  };

  const applyFilterAndSort = useCallback(
    (promos: PromotionInput[], userLat: number, userLng: number, filters: RouteFilters) => {
      let filtered = promos.filter(p => {
        if (filters.rewardTypes.length > 0 && !filters.rewardTypes.includes(p.reward_type)) return false;
        if (filters.categories.length > 0 && p.category && !filters.categories.includes(p.category))
          return false;
        if (p.reward_amount < filters.minRewardPerStop) return false;
        return true;
      });

      const dist = (p: { latitude: number; longitude: number }) => haversine(userLat, userLng, p.latitude, p.longitude);

      switch (filters.optimization) {
        case 'more_earnings':
          filtered.sort((a, b) => b.reward_amount - a.reward_amount);
          break;
        case 'faster':
          filtered.sort((a, b) => dist(a) - dist(b));
          break;
        case 'effective':
          filtered.sort((a, b) => {
            const dA = dist(a) || 0.001;
            const dB = dist(b) || 0.001;
            return b.reward_amount / dB - a.reward_amount / dA;
          });
          break;
        default:
          filtered.sort((a, b) => {
            const dA = dist(a);
            const dB = dist(b);
            return b.reward_amount * 0.6 - dB * 0.4 - (a.reward_amount * 0.6 - dA * 0.4);
          });
      }

      return filtered.slice(0, filters.maxStops);
    },
    [],
  );

  const buildRouteFromStops = useCallback(
    (selected: PromotionInput[], name: string, filters: RouteFilters, label?: string): PromoRoute => {
      const stops: RouteStop[] = selected.map((p, i) => ({
        id: `stop-${p.id}`,
        promotionId: p.id,
        businessName: p.business_name,
        latitude: p.latitude,
        longitude: p.longitude,
        address: p.address,
        category: p.category,
        rewardType: p.reward_type,
        rewardAmount: p.reward_amount,
        requiredAction: p.required_action,
        order: i,
      }));
      const route: PromoRoute = {
        id: generateRouteId(),
        name,
        stops,
        transportMode: 'walking',
        filters,
        isCommuteRoute: false,
        createdAt: new Date().toISOString(),
        totalReward: stops.reduce((s, st) => s + st.rewardAmount, 0),
        destination: null,
        schedule: null,
        segmentTransport: {},
        smartLabel: label,
        origin: null,
      };
      setActiveRoute(route);
      setIsBuilding(true);
      return route;
    },
    [],
  );

  // ─── suggestRoute (standard) ────────────────────────────────────

  const suggestRoute = useCallback(
    (promos: PromotionInput[], userLat: number, userLng: number, filters: RouteFilters = defaultRouteFilters) => {
      const selected = applyFilterAndSort(promos, userLat, userLng, filters);
      return buildRouteFromStops(selected, 'Suggested Route', filters);
    },
    [applyFilterAndSort, buildRouteFromStops],
  );

  // ─── suggestFromWatchLater ──────────────────────────────────────

  const suggestFromWatchLater = useCallback(
    (userLat: number, userLng: number, filters: RouteFilters = defaultRouteFilters) => {
      const promos: PromotionInput[] = watchLater.map(w => ({
        id: w.promotionId,
        business_name: w.businessName,
        latitude: w.latitude,
        longitude: w.longitude,
        address: w.address,
        category: w.category,
        reward_type: w.rewardType,
        reward_amount: w.rewardAmount,
        required_action: w.requiredAction,
      }));
      const selected = applyFilterAndSort(promos, userLat, userLng, filters);
      return buildRouteFromStops(selected, 'Saved Promos Route', filters, 'Built from your saved promos');
    },
    [watchLater, applyFilterAndSort, buildRouteFromStops],
  );

  // ─── suggestByInterests ─────────────────────────────────────────

  const suggestByInterests = useCallback(
    (
      promos: PromotionInput[],
      userLat: number,
      userLng: number,
      interestCategories: string[],
      filters: RouteFilters = defaultRouteFilters,
    ) => {
      // Weight promos that match user interests higher
      const weighted = promos.map(p => ({
        ...p,
        reward_amount: interestCategories.includes(p.category || '')
          ? p.reward_amount * 1.5 // boost interest-matched promos
          : p.reward_amount,
      }));
      const selected = applyFilterAndSort(weighted, userLat, userLng, filters);
      // Restore original amounts
      const restored = selected.map(s => {
        const orig = promos.find(p => p.id === s.id);
        return orig ? { ...s, reward_amount: orig.reward_amount } : s;
      });
      return buildRouteFromStops(
        restored,
        'Interests Route',
        filters,
        `Based on: ${interestCategories.slice(0, 3).join(', ')}`,
      );
    },
    [applyFilterAndSort, buildRouteFromStops],
  );

  // ─── suggestSmartRoute ──────────────────────────────────────────

  const suggestSmartRoute = useCallback(
    (promos: PromotionInput[], userLat: number, userLng: number) => {
      const now = new Date();
      const hour = now.getHours();
      const day = now.getDay(); // 0=Sun
      const isWeekend = day === 0 || day === 6;
      const isMorning = hour >= 6 && hour < 11;
      const isEvening = hour >= 17 && hour < 22;
      const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day];

      // Determine best optimization
      let optimization: RouteOptimization = 'balanced';
      let label = '';
      let maxStops = 8;

      if (!isWeekend && isMorning) {
        optimization = 'faster';
        maxStops = 5;
        label = `Quick ${dayName} morning commute route`;
      } else if (!isWeekend && isEvening) {
        optimization = 'effective';
        maxStops = 6;
        label = `Efficient ${dayName} evening route`;
      } else if (isWeekend) {
        optimization = 'more_earnings';
        maxStops = 10;
        label = `${dayName} exploration – maximize earnings`;
      } else {
        optimization = 'balanced';
        maxStops = 7;
        label = `Balanced ${dayName} route`;
      }

      // Factor in watch later preferences for category boost
      const wlCategories = watchLater.map(w => w.category).filter(Boolean) as string[];
      const uniqueCats = [...new Set(wlCategories)];

      const filters: RouteFilters = {
        ...defaultRouteFilters,
        optimization,
        maxStops,
        categories: uniqueCats.length > 0 ? uniqueCats : [],
      };

      // If user has WL items, blend them in
      const wlPromos: PromotionInput[] = watchLater.map(w => ({
        id: w.promotionId,
        business_name: w.businessName,
        latitude: w.latitude,
        longitude: w.longitude,
        address: w.address,
        category: w.category,
        reward_type: w.rewardType,
        reward_amount: w.rewardAmount,
        required_action: w.requiredAction,
      }));

      const combinedPromos = [...wlPromos, ...promos];
      // Deduplicate
      const seen = new Set<string>();
      const deduped = combinedPromos.filter(p => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });

      const selected = applyFilterAndSort(deduped, userLat, userLng, filters);
      return buildRouteFromStops(selected, 'Smart Route', filters, label);
    },
    [watchLater, applyFilterAndSort, buildRouteFromStops],
  );

  // ─── Derived state ──────────────────────────────────────────────

  const totalStops = activeRoute?.stops.length ?? 0;
  const totalReward = activeRoute?.totalReward ?? 0;
  const activeRouteEstimate = useMemo(() => computeRouteEstimate(activeRoute), [activeRoute]);

  return {
    activeRoute,
    savedRoutes,
    isBuilding,
    watchLater,
    totalStops,
    totalReward,
    routesSyncing,
    lastRoutesSyncAt,
    activeRouteEstimate,
    isCloudSynced: !!user?.id,
    startRoute,
    addStop,
    removeStop,
    reorderStops,
    optimizeOrder,
    isInRoute,
    setTransportMode,
    setRouteFilters,
    toggleCommuteRoute,
    renameRoute,
    setOrigin,
    setDestination,
    setSchedule,
    setSegmentTransport,
    getSegmentTransport,
    saveRoute,
    finishRoute,
    discardRoute,
    loadRoute,
    addSavedRoute,
    deleteSavedRoute,
    addToWatchLater,
    removeFromWatchLater,
    isInWatchLater,
    openInGoogleMaps,
    duplicateRoute,
    openSavedRouteInMaps,
    suggestRoute,
    suggestFromWatchLater,
    suggestByInterests,
    suggestSmartRoute,
  };
}
