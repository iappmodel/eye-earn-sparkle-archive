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

export type TransportMode = 'walking' | 'driving' | 'transit';

export type RouteOptimization = 'more_earnings' | 'faster' | 'effective' | 'balanced';

export interface RouteFilters {
  rewardTypes: ('vicoin' | 'icoin' | 'both')[];
  optimization: RouteOptimization;
  maxStops: number;
  maxDistance: number; // km
  categories: string[];
  minRewardPerStop: number;
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

export function usePromoRoute() {
  const [activeRoute, setActiveRoute] = useState<PromoRoute | null>(null);
  const [savedRoutes, setSavedRoutes] = useState<PromoRoute[]>([]);
  const [isBuilding, setIsBuilding] = useState(false);
  const [watchLater, setWatchLater] = useState<RouteStop[]>([]);

  // Start building a new route
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
    };
    setActiveRoute(newRoute);
    setIsBuilding(true);
    return newRoute;
  }, []);

  // Add a stop to the active route
  const addStop = useCallback((stop: Omit<RouteStop, 'order'>) => {
    setActiveRoute(prev => {
      if (!prev) return prev;
      const newStop: RouteStop = { ...stop, order: prev.stops.length };
      const stops = [...prev.stops, newStop];
      return {
        ...prev,
        stops,
        totalReward: stops.reduce((sum, s) => sum + s.rewardAmount, 0),
      };
    });
  }, []);

  // Remove a stop
  const removeStop = useCallback((stopId: string) => {
    setActiveRoute(prev => {
      if (!prev) return prev;
      const stops = prev.stops
        .filter(s => s.id !== stopId)
        .map((s, i) => ({ ...s, order: i }));
      return {
        ...prev,
        stops,
        totalReward: stops.reduce((sum, s) => sum + s.rewardAmount, 0),
      };
    });
  }, []);

  // Reorder stops
  const reorderStops = useCallback((fromIndex: number, toIndex: number) => {
    setActiveRoute(prev => {
      if (!prev) return prev;
      const stops = [...prev.stops];
      const [moved] = stops.splice(fromIndex, 1);
      stops.splice(toIndex, 0, moved);
      return {
        ...prev,
        stops: stops.map((s, i) => ({ ...s, order: i })),
      };
    });
  }, []);

  // Check if a promotion is already in the active route
  const isInRoute = useCallback((promotionId: string) => {
    return activeRoute?.stops.some(s => s.promotionId === promotionId) ?? false;
  }, [activeRoute]);

  // Set transport mode
  const setTransportMode = useCallback((mode: TransportMode) => {
    setActiveRoute(prev => prev ? { ...prev, transportMode: mode } : prev);
  }, []);

  // Update filters
  const setRouteFilters = useCallback((filters: RouteFilters) => {
    setActiveRoute(prev => prev ? { ...prev, filters } : prev);
  }, []);

  // Toggle commute route
  const toggleCommuteRoute = useCallback(() => {
    setActiveRoute(prev => prev ? { ...prev, isCommuteRoute: !prev.isCommuteRoute } : prev);
  }, []);

  // Rename route
  const renameRoute = useCallback((name: string) => {
    setActiveRoute(prev => prev ? { ...prev, name } : prev);
  }, []);

  // Save route
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

  // Close / finish building
  const finishRoute = useCallback(() => {
    setIsBuilding(false);
  }, []);

  // Discard route
  const discardRoute = useCallback(() => {
    setActiveRoute(null);
    setIsBuilding(false);
  }, []);

  // Load a saved route for editing
  const loadRoute = useCallback((routeId: string) => {
    const route = savedRoutes.find(r => r.id === routeId);
    if (route) {
      setActiveRoute({ ...route });
      setIsBuilding(true);
    }
  }, [savedRoutes]);

  // Delete a saved route
  const deleteSavedRoute = useCallback((routeId: string) => {
    setSavedRoutes(prev => prev.filter(r => r.id !== routeId));
    if (activeRoute?.id === routeId) {
      setActiveRoute(null);
      setIsBuilding(false);
    }
  }, [activeRoute]);

  // Add to watch later
  const addToWatchLater = useCallback((stop: Omit<RouteStop, 'order'>) => {
    setWatchLater(prev => {
      if (prev.some(s => s.promotionId === stop.promotionId)) return prev;
      return [...prev, { ...stop, order: prev.length }];
    });
  }, []);

  // Remove from watch later
  const removeFromWatchLater = useCallback((promotionId: string) => {
    setWatchLater(prev => prev.filter(s => s.promotionId !== promotionId));
  }, []);

  // Check if in watch later
  const isInWatchLater = useCallback((promotionId: string) => {
    return watchLater.some(s => s.promotionId === promotionId);
  }, [watchLater]);

  // Open route in Google Maps
  const openInGoogleMaps = useCallback((userLat?: number, userLng?: number) => {
    if (!activeRoute || activeRoute.stops.length === 0) return;

    const stops = activeRoute.stops;
    const origin = userLat && userLng
      ? `${userLat},${userLng}`
      : `${stops[0].latitude},${stops[0].longitude}`;
    const destination = `${stops[stops.length - 1].latitude},${stops[stops.length - 1].longitude}`;

    const waypoints = stops.length > 2
      ? stops.slice(1, -1).map(s => `${s.latitude},${s.longitude}`).join('|')
      : stops.length === 2 && userLat
        ? `${stops[0].latitude},${stops[0].longitude}`
        : '';

    const travelMode = activeRoute.transportMode === 'walking'
      ? 'walking'
      : activeRoute.transportMode === 'transit'
        ? 'transit'
        : 'driving';

    let url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=${travelMode}`;
    if (waypoints) url += `&waypoints=${encodeURIComponent(waypoints)}`;

    window.open(url, '_blank');
  }, [activeRoute]);

  // Generate a suggested route from nearby promotions
  const suggestRoute = useCallback((
    promotions: Array<{ id: string; business_name: string; latitude: number; longitude: number; address?: string; category?: string; reward_type: 'vicoin' | 'icoin' | 'both'; reward_amount: number; required_action?: string; }>,
    userLat: number,
    userLng: number,
    filters: RouteFilters = defaultRouteFilters,
  ): PromoRoute => {
    let filtered = promotions.filter(p => {
      if (filters.rewardTypes.length > 0 && !filters.rewardTypes.includes(p.reward_type)) return false;
      if (filters.categories.length > 0 && p.category && !filters.categories.includes(p.category)) return false;
      if (p.reward_amount < filters.minRewardPerStop) return false;
      return true;
    });

    // Sort based on optimization
    switch (filters.optimization) {
      case 'more_earnings':
        filtered.sort((a, b) => b.reward_amount - a.reward_amount);
        break;
      case 'faster': {
        // Sort by distance from user
        const dist = (p: { latitude: number; longitude: number }) =>
          Math.sqrt(Math.pow(p.latitude - userLat, 2) + Math.pow(p.longitude - userLng, 2));
        filtered.sort((a, b) => dist(a) - dist(b));
        break;
      }
      case 'effective':
        // Best reward-to-distance ratio
        filtered.sort((a, b) => {
          const distA = Math.sqrt(Math.pow(a.latitude - userLat, 2) + Math.pow(a.longitude - userLng, 2)) || 0.001;
          const distB = Math.sqrt(Math.pow(b.latitude - userLat, 2) + Math.pow(b.longitude - userLng, 2)) || 0.001;
          return (b.reward_amount / distB) - (a.reward_amount / distA);
        });
        break;
      default:
        // Balanced: mix of distance and reward
        filtered.sort((a, b) => {
          const distA = Math.sqrt(Math.pow(a.latitude - userLat, 2) + Math.pow(a.longitude - userLng, 2));
          const distB = Math.sqrt(Math.pow(b.latitude - userLat, 2) + Math.pow(b.longitude - userLng, 2));
          const scoreA = a.reward_amount * 0.6 - distA * 100 * 0.4;
          const scoreB = b.reward_amount * 0.6 - distB * 100 * 0.4;
          return scoreB - scoreA;
        });
    }

    const selected = filtered.slice(0, filters.maxStops);
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
      name: 'Suggested Route',
      stops,
      transportMode: 'walking',
      filters,
      isCommuteRoute: false,
      createdAt: new Date().toISOString(),
      totalReward: stops.reduce((sum, s) => sum + s.rewardAmount, 0),
    };

    setActiveRoute(route);
    setIsBuilding(true);
    return route;
  }, []);

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
  };
}
