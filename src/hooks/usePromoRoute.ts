import { useState, useCallback, useMemo } from 'react';

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

// Haversine for distance sorting
const haversine = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export function usePromoRoute() {
  const [activeRoute, setActiveRoute] = useState<PromoRoute | null>(null);
  const [savedRoutes, setSavedRoutes] = useState<PromoRoute[]>([]);
  const [isBuilding, setIsBuilding] = useState(false);
  const [watchLater, setWatchLater] = useState<RouteStop[]>([]);

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
    setSavedRoutes(prev => {
      const existing = prev.findIndex(r => r.id === activeRoute.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = activeRoute;
        return updated;
      }
      return [...prev, activeRoute];
    });
    return activeRoute;
  }, [activeRoute]);

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

  const deleteSavedRoute = useCallback(
    (routeId: string) => {
      setSavedRoutes(prev => prev.filter(r => r.id !== routeId));
      if (activeRoute?.id === routeId) {
        setActiveRoute(null);
        setIsBuilding(false);
      }
    },
    [activeRoute],
  );

  // ─── Watch Later ────────────────────────────────────────────────

  const addToWatchLater = useCallback((stop: Omit<RouteStop, 'order'>) => {
    setWatchLater(prev => {
      if (prev.some(s => s.promotionId === stop.promotionId)) return prev;
      return [...prev, { ...stop, order: prev.length }];
    });
  }, []);

  const removeFromWatchLater = useCallback((promotionId: string) => {
    setWatchLater(prev => prev.filter(s => s.promotionId !== promotionId));
  }, []);

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

  return {
    activeRoute,
    savedRoutes,
    isBuilding,
    watchLater,
    totalStops,
    totalReward,
    startRoute,
    addStop,
    removeStop,
    reorderStops,
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
    deleteSavedRoute,
    addToWatchLater,
    removeFromWatchLater,
    isInWatchLater,
    openInGoogleMaps,
    suggestRoute,
    suggestFromWatchLater,
    suggestByInterests,
    suggestSmartRoute,
  };
}
