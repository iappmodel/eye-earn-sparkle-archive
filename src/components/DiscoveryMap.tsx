import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { X, Navigation, RefreshCw, MapPin, Coins, Search, Filter, Heart, ExternalLink, Bell, BellOff, History, Route, Plus, Bookmark, ArrowDownUp, WifiOff } from 'lucide-react';
import { NeuButton } from './NeuButton';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { MapSearchBar } from './MapSearchBar';
import { MapFilterSheet, defaultMapFilters, type MapFilters } from './MapFilterSheet';
import { FavoriteLocations, useFavoriteLocation } from './FavoriteLocations';
import { CategoryIcon, getCategoryInfo } from './PromotionCategories';
import { CheckInButton } from './CheckInButton';
import { CheckInHistory } from './CheckInHistory';
import { RouteBuilder } from './RouteBuilder';
import { PromoCheckInFlow } from './PromoCheckInFlow';
import { useNearbyPromotions } from '@/hooks/useNearbyPromotions';
import { useDiscoveryPromotions } from '@/hooks/useDiscoveryPromotions';
import { usePromoRoute, defaultRouteFilters } from '@/hooks/usePromoRoute';
import type { PromoRoute, RouteStop, TransportMode, RouteFilters } from '@/hooks/usePromoRoute';
import {
  generateLocalPromotions,
  generateGlobalPromotions,
  createMockClientSpot,
  MOCK_CLIENT_SPOT_ID,
  type MockPromotion,
} from '@/constants/mockPromotions';

export interface Promotion extends MockPromotion {
  distance?: number;
}

interface DiscoveryMapProps {
  isOpen: boolean;
  onClose: () => void;
  promoRoute?: ReturnType<typeof import('@/hooks/usePromoRoute').usePromoRoute>;
  onOpenWallet?: () => void;
  /** When 'checkin', map focuses on user + nearby for check-in flow (e.g. opened from remote check-in). */
  initialMode?: 'discover' | 'checkin';
}

// Get gradient color based on reward amount
const getRewardGradient = (amount: number, rewardType: 'vicoin' | 'icoin' | 'both'): string => {
  const normalized = Math.min(amount / 500, 1);
  const hue = 120 - (normalized * 120);
  const saturation = 80 + (normalized * 20);
  
  if (rewardType === 'both') {
    return `linear-gradient(135deg, hsl(${hue}, ${saturation}%, 45%), hsl(270, 80%, 55%))`;
  }
  
  return `linear-gradient(135deg, hsl(${hue}, ${saturation}%, 50%), hsl(${hue - 20}, ${saturation}%, 35%))`;
};

// Get border glow based on coin type
const getCoinGlow = (rewardType: 'vicoin' | 'icoin' | 'both'): string => {
  switch (rewardType) {
    case 'vicoin':
      return '0 0 12px rgba(139, 92, 246, 0.6)';
    case 'icoin':
      return '0 0 12px rgba(59, 130, 246, 0.6)';
    default:
      return '0 0 12px rgba(236, 72, 153, 0.6)';
  }
};

export const DiscoveryMap: React.FC<DiscoveryMapProps> = ({ isOpen, onClose, promoRoute: externalPromoRoute, onOpenWallet, initialMode }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const popupsRef = useRef<mapboxgl.Popup[]>([]);
  
  const [selectedPromo, setSelectedPromo] = useState<Promotion | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [filter, setFilter] = useState<'all' | 'vicoin' | 'icoin'>('all');
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [showSearchHere, setShowSearchHere] = useState(false);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [globalPromos] = useState<Promotion[]>(() => generateGlobalPromotions());
  const [localPromos, setLocalPromos] = useState<Promotion[]>([]);
  
  // Enhanced features state — check-in mode defaults to sort by distance
  const [showFilters, setShowFilters] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [mapFilters, setMapFilters] = useState<MapFilters>(defaultMapFilters);
  const [nearbyAlertsEnabled, setNearbyAlertsEnabled] = useState(true);
  const [showRouteBuilder, setShowRouteBuilder] = useState(false);
  const [showCheckInHistory, setShowCheckInHistory] = useState(false);
  const [showCheckInFlow, setShowCheckInFlow] = useState(false);
  const [sortBy, setSortBy] = useState<'distance' | 'reward_desc' | 'reward_asc' | 'expiring_soon'>(
    initialMode === 'checkin' ? 'distance' : 'distance'
  );
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [checkInModeBannerDismissed, setCheckInModeBannerDismissed] = useState(false);

  // Backend promotions with retry, filters, sort - falls back to mock on failure
  const {
    promotions: backendPromos,
    isLoading: backendLoading,
    error: backendError,
    fromBackend,
    refetch: refetchPromotions,
  } = useDiscoveryPromotions({
    latitude: userLocation?.lat ?? 0,
    longitude: userLocation?.lng ?? 0,
    filters: mapFilters,
    rewardFilter: filter,
    sortBy,
    limit: 150,
    enabled: isOpen && !!userLocation,
  });

  useEffect(() => {
    if (!isOpen) return;
    try {
      window.dispatchEvent(new CustomEvent('remoteControlSuspend', { detail: { active: true } }));
    } catch {
      // ignore
    }
    return () => {
      try {
        window.dispatchEvent(new CustomEvent('remoteControlSuspend', { detail: { active: false } }));
      } catch {
        // ignore
      }
    };
  }, [isOpen]);
  
  // Completed check-in stops
  const [completedStops, setCompletedStops] = useState<Set<string>>(new Set());

  // Route system - use external if provided, otherwise local
  const localPromoRoute = usePromoRoute();
  const promoRoute = externalPromoRoute || localPromoRoute;

  // Haversine distance in meters between two lat/lng points
  const haversineMeters = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371000; // Earth radius in meters
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }, []);

  // Determine marker visual state
  const getMarkerStyle = useCallback((
    promo: Promotion,
    isInRoute: boolean,
    isCompleted: boolean,
    isNearby: boolean,
    hasActiveRoute: boolean,
  ) => {
    if (isCompleted) {
      return {
        background: '#22c55e',
        border: '2px solid white',
        glow: '0 0 12px rgba(34, 197, 94, 0.5)',
        opacity: '1',
        badgeHTML: '<div style="position:absolute;top:-4px;right:-4px;width:14px;height:14px;background:#22c55e;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;color:white;border:1px solid white;">✓</div>',
        animClass: '',
      };
    }
    if (isNearby && isInRoute) {
      return {
        background: 'linear-gradient(135deg, #f59e0b, #d97706)',
        border: '2px solid #fbbf24',
        glow: '0 0 14px rgba(245, 158, 11, 0.5)',
        opacity: '1',
        badgeHTML: '',
        animClass: 'promo-marker-nearby-pulse',
      };
    }
    if (isInRoute) {
      return {
        background: getRewardGradient(promo.reward_amount, promo.reward_type),
        border: '2px solid white',
        glow: '0 0 12px rgba(96, 165, 250, 0.5)',
        opacity: '1',
        badgeHTML: '',
        animClass: '',
      };
    }
    // No active route – show original colorful reward gradients
    if (!hasActiveRoute) {
      return {
        background: getRewardGradient(promo.reward_amount, promo.reward_type),
        border: '2px solid rgba(255,255,255,0.2)',
        glow: getCoinGlow(promo.reward_type),
        opacity: '1',
        badgeHTML: '',
        animClass: '',
      };
    }
    // Active route but NOT in it – muted gray
    return {
      background: '#3a3a4a',
      border: '1px solid rgba(255,255,255,0.1)',
      glow: 'none',
      opacity: '0.6',
      badgeHTML: '',
      animClass: '',
    };
  }, []);
  
  // Nearby promotion alerts
  const { nearbyPromotions, isWatching } = useNearbyPromotions(nearbyAlertsEnabled && isOpen);
  const { toggleFavorite, isFavorite } = useFavoriteLocation();

  // Compute displayed promotions: backend + mock spot, or fallback mock when backend fails
  const promotions = useMemo((): Promotion[] => {
    const center = userLocation ?? mapCenter ?? { lat: 40.7128, lng: -74.006 };
    const mockSpot = createMockClientSpot(center.lat, center.lng);

    if (fromBackend && backendPromos.length >= 0) {
      const backendList = backendPromos as Promotion[];
      const filtered = backendList.filter((p) => p.id !== MOCK_CLIENT_SPOT_ID);
      return [mockSpot, ...filtered];
    }

    // Fallback: use local + global mock
    const zoom = 14;
    const allMock = [...localPromos, ...globalPromos];
    const byReward = (p: Promotion) =>
      filter === 'all' || p.reward_type === filter || p.reward_type === 'both';
    const byZoom = (p: Promotion) => {
      const dist = Math.sqrt(
        Math.pow(p.latitude - center.lat, 2) + Math.pow(p.longitude - center.lng, 2)
      );
      if (zoom < 6) return true;
      if (zoom < 10) return dist < 3;
      return dist < 0.5;
    };
    const visible = allMock.filter((p) => byReward(p) && byZoom(p));
    return [mockSpot, ...visible];
  }, [
    fromBackend,
    backendPromos,
    userLocation,
    mapCenter,
    localPromos,
    globalPromos,
    filter,
  ]);

  // Add promotion to route
  const handleAddToRoute = useCallback((promo: Promotion) => {
    if (!promoRoute.isBuilding) {
      promoRoute.startRoute();
    }
    if (promoRoute.isInRoute(promo.id)) {
      toast.info('Already in your route');
      return;
    }
    promoRoute.addStop({
      id: `stop-${promo.id}`,
      promotionId: promo.id,
      businessName: promo.business_name,
      latitude: promo.latitude,
      longitude: promo.longitude,
      address: promo.address,
      category: promo.category,
      rewardType: promo.reward_type,
      rewardAmount: promo.reward_amount,
      requiredAction: promo.required_action,
    });
    toast.success(`Added ${promo.business_name} to route`);
  }, [promoRoute]);

  // Add to watch later
  const handleAddToWatchLater = useCallback((promo: Promotion) => {
    if (promoRoute.isInWatchLater(promo.id)) {
      promoRoute.removeFromWatchLater(promo.id);
      toast.info('Removed from Watch Later');
    } else {
      promoRoute.addToWatchLater({
        id: `wl-${promo.id}`,
        promotionId: promo.id,
        businessName: promo.business_name,
        latitude: promo.latitude,
        longitude: promo.longitude,
        address: promo.address,
        category: promo.category,
        rewardType: promo.reward_type,
        rewardAmount: promo.reward_amount,
        requiredAction: promo.required_action,
      });
      toast.success('Added to Watch Later');
    }
  }, [promoRoute]);

  // Suggest route from current promotions
  const handleSuggestRoute = useCallback((optimization?: string) => {
    if (!userLocation) {
      toast.error('Location needed to suggest routes');
      return;
    }
    const filters = { ...(promoRoute.activeRoute?.filters || defaultRouteFilters) };
    if (optimization) {
      filters.optimization = optimization as any;
    }
    promoRoute.suggestRoute(
      promotions.map(p => ({
        id: p.id,
        business_name: p.business_name,
        latitude: p.latitude,
        longitude: p.longitude,
        address: p.address,
        category: p.category,
        reward_type: p.reward_type,
        reward_amount: p.reward_amount,
        required_action: p.required_action,
      })),
      userLocation.lat,
      userLocation.lng,
      filters,
    );
    toast.success('Route suggested based on nearby promos!');
  }, [promotions, userLocation, promoRoute]);

  // Create popup HTML for a promotion
  const createPopupHTML = useCallback((promo: Promotion): string => {
    const coinIcon = promo.reward_type === 'vicoin' ? 'V' : promo.reward_type === 'icoin' ? 'I' : 'V+I';
    const coinLabel = promo.reward_type === 'vicoin' ? 'Vicoins' : promo.reward_type === 'icoin' ? 'Icoins' : 'Both';
    const bgGradient = getRewardGradient(promo.reward_amount, promo.reward_type);
    const imgBlock =
      promo.image_url &&
      `
        <div style="margin-bottom: 10px; border-radius: 10px; overflow: hidden; height: 72px; background: rgba(255,255,255,0.05);">
          <img src="${promo.image_url}" alt="" style="width:100%;height:100%;object-fit:cover;" loading="lazy" />
        </div>`;
    return `
      <div class="promo-popup" style="
        background: linear-gradient(135deg, rgba(15, 15, 20, 0.95), rgba(25, 25, 35, 0.95));
        backdrop-filter: blur(10px);
        border-radius: 16px;
        padding: 14px;
        min-width: 200px;
        max-width: 260px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), ${getCoinGlow(promo.reward_type)};
        font-family: system-ui, -apple-system, sans-serif;
      ">
        ${imgBlock || ''}
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
          <div style="
            width: 36px;
            height: 36px;
            border-radius: 10px;
            background: ${bgGradient};
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            color: white;
            font-size: 14px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
          ">
            ${coinIcon}
          </div>
          <div style="flex: 1; overflow: hidden;">
            <div style="
              font-weight: 600;
              color: white;
              font-size: 14px;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            ">${promo.business_name}</div>
            <div style="
              font-size: 11px;
              color: rgba(255, 255, 255, 0.6);
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            ">${promo.category || 'Promotion'}</div>
          </div>
        </div>
        
        <div style="
          font-size: 12px;
          color: rgba(255, 255, 255, 0.7);
          margin-bottom: 8px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          line-height: 1.4;
        ">${promo.description || 'Earn rewards at this location!'}</div>
        
        <div style="
          font-size: 11px;
          color: rgba(139, 92, 246, 0.9);
          background: rgba(139, 92, 246, 0.1);
          border: 1px solid rgba(139, 92, 246, 0.2);
          border-radius: 8px;
          padding: 8px 10px;
          margin-bottom: 10px;
          display: flex;
          align-items: center;
          gap: 6px;
        ">
          <span style="font-size: 12px;">📋</span>
          <span style="line-height: 1.3;">${promo.required_action || 'Visit the location to claim'}</span>
        </div>
        
        <div style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-top: 10px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        ">
          <div style="display: flex; align-items: center; gap: 6px;">
            <div style="
              width: 8px;
              height: 8px;
              border-radius: 50%;
              background: ${promo.reward_type === 'vicoin' ? '#8B5CF6' : promo.reward_type === 'icoin' ? '#3B82F6' : 'linear-gradient(135deg, #8B5CF6, #3B82F6)'};
            "></div>
            <span style="font-size: 11px; color: rgba(255, 255, 255, 0.6);">${coinLabel}</span>
          </div>
          <div style="
            font-weight: 700;
            font-size: 15px;
            background: ${bgGradient};
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
          ">+${promo.reward_amount}</div>
        </div>
      </div>
    `;
  }, []);

  // Fetch Mapbox token
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (error) throw error;
        setMapboxToken(data?.token);
      } catch (error) {
        console.error('[DiscoveryMap] Token fetch error:', error);
        const envToken = import.meta.env.VITE_MAPBOX_TOKEN;
        if (envToken) {
          setMapboxToken(envToken);
        }
      }
    };
    
    if (isOpen) {
      fetchToken();
    }
  }, [isOpen]);

  // Get user location and generate local promos
  useEffect(() => {
    if (!isOpen) return;
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(loc);
          setLocalPromos(generateLocalPromotions(loc.lat, loc.lng, 200, 10000));
        },
        (error) => {
          console.error('[DiscoveryMap] Geolocation error:', error);
          const defaultLoc = { lat: 40.7128, lng: -74.0060 };
          setUserLocation(defaultLoc);
          setLocalPromos(generateLocalPromotions(defaultLoc.lat, defaultLoc.lng, 200, 10000));
          toast.info('Using default location - enable GPS for nearby promos');
        }
      );
    } else {
      const defaultLoc = { lat: 40.7128, lng: -74.0060 };
      setUserLocation(defaultLoc);
      setLocalPromos(generateLocalPromotions(defaultLoc.lat, defaultLoc.lng, 200, 10000));
      toast.info('Using default location - enable GPS for nearby promos');
    }
  }, [isOpen]);

  // Initialize map
  useEffect(() => {
    if (!isOpen || !mapContainer.current || !mapboxToken || !userLocation) return;

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [userLocation.lng, userLocation.lat],
      zoom: 14,
      pitch: 45,
    });

    map.current.addControl(
      new mapboxgl.NavigationControl({ visualizePitch: true }),
      'top-right'
    );

    const userMarkerEl = document.createElement('div');
    userMarkerEl.innerHTML = `
      <div style="
        width: 20px;
        height: 20px;
        background: #8B5CF6;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 0 20px rgba(139, 92, 246, 0.6);
        animation: pulse 2s infinite;
      "></div>
    `;
    new mapboxgl.Marker(userMarkerEl)
      .setLngLat([userLocation.lng, userLocation.lat])
      .addTo(map.current);

    map.current.on('moveend', () => {
      if (!map.current) return;
      const center = map.current.getCenter();
      const zoom = map.current.getZoom();
      
      setMapCenter({ lat: center.lat, lng: center.lng });
      
      if (userLocation) {
        const distance = Math.sqrt(
          Math.pow(center.lat - userLocation.lat, 2) + 
          Math.pow(center.lng - userLocation.lng, 2)
        );
        setShowSearchHere(distance > 0.01 || zoom < 10);
      }
    });

    return () => {
      markersRef.current.forEach(marker => marker.remove());
      popupsRef.current.forEach(popup => popup.remove());
      map.current?.remove();
    };
  }, [isOpen, mapboxToken, userLocation]);

  // Toast when backend fails (hook handles retry; we inform user)
  useEffect(() => {
    if (backendError && isOpen) {
      toast.warning('Showing demo spots – real promotions will appear when connected.');
    }
  }, [backendError, isOpen]);

  // Update markers when promotions or filter changes
  useEffect(() => {
    if (!map.current) return;

    markersRef.current.forEach(marker => marker.remove());
    popupsRef.current.forEach(popup => popup.remove());
    markersRef.current = [];
    popupsRef.current = [];

    const filteredPromos = filter === 'all' 
      ? promotions 
      : promotions.filter(p => p.reward_type === filter || p.reward_type === 'both');

    const hasActiveRoute = promoRoute.isBuilding && promoRoute.totalStops > 0;

    filteredPromos.forEach(promo => {
      const isFeaturedMock = promo.id === MOCK_CLIENT_SPOT_ID;
      const coinIcon = promo.reward_type === 'vicoin' ? 'V' : promo.reward_type === 'icoin' ? 'I' : '★';
      const inRoute = promoRoute.isInRoute(promo.id);
      const isCompleted = completedStops.has(promo.id);
      const isNearby = inRoute && !isCompleted && userLocation
        ? haversineMeters(userLocation.lat, userLocation.lng, promo.latitude, promo.longitude) <= 500
        : false;
      
      const style = getMarkerStyle(promo, inRoute, isCompleted, isNearby, hasActiveRoute);
      
      const el = document.createElement('div');
      el.className = 'promo-marker-wrapper';

      if (isFeaturedMock) {
        // Featured mock client spot – larger, pulsing gold ring
        el.innerHTML = `
          <div class="promo-marker" style="
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: linear-gradient(135deg, #f59e0b, #d97706);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 20px;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 0 20px rgba(245, 158, 11, 0.6), 0 0 40px rgba(245, 158, 11, 0.3);
            border: 3px solid #fbbf24;
            position: relative;
            animation: mockSpotPulse 2s ease-in-out infinite;
          ">
            ★
            <span style="
              position: absolute;
              top: -8px;
              right: -8px;
              background: linear-gradient(135deg, #06b6d4, #3b82f6);
              color: white;
              font-size: 8px;
              font-weight: 700;
              padding: 2px 5px;
              border-radius: 999px;
              white-space: nowrap;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            ">DEMO</span>
          </div>
          <style>
            @keyframes mockSpotPulse {
              0%, 100% { transform: scale(1); box-shadow: 0 0 20px rgba(245, 158, 11, 0.6); }
              50% { transform: scale(1.08); box-shadow: 0 0 30px rgba(245, 158, 11, 0.8), 0 0 60px rgba(245, 158, 11, 0.3); }
            }
          </style>
        `;
      } else {
        el.innerHTML = `
          <div class="promo-marker ${style.animClass}" style="
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background: ${style.background};
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 16px;
            cursor: pointer;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3)${style.glow !== 'none' ? ', ' + style.glow : ''};
            border: ${style.border};
            opacity: ${style.opacity};
            position: relative;
          ">
            ${isCompleted ? '✓' : coinIcon}
            ${style.badgeHTML}
          </div>
        `;
      }

      const markerDiv = el.querySelector('.promo-marker') as HTMLElement;
      
      const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 30,
        className: 'promo-popup-container',
        maxWidth: '280px',
      }).setHTML(createPopupHTML(promo));

      el.addEventListener('mouseenter', () => {
        if (markerDiv) {
          markerDiv.style.transform = 'scale(1.2)';
          markerDiv.style.boxShadow = `0 8px 25px rgba(0, 0, 0, 0.4)${style.glow !== 'none' ? ', ' + style.glow : ''}`;
        }
        popup.setLngLat([promo.longitude, promo.latitude]).addTo(map.current!);
      });

      el.addEventListener('mouseleave', () => {
        if (markerDiv) {
          markerDiv.style.transform = 'scale(1)';
          markerDiv.style.boxShadow = `0 4px 15px rgba(0, 0, 0, 0.3)${style.glow !== 'none' ? ', ' + style.glow : ''}`;
        }
        popup.remove();
      });

      el.addEventListener('click', () => {
        setSelectedPromo(promo);
        map.current?.flyTo({
          center: [promo.longitude, promo.latitude],
          zoom: 16,
        });
      });

      const marker = new mapboxgl.Marker(el)
        .setLngLat([promo.longitude, promo.latitude])
        .addTo(map.current!);

      markersRef.current.push(marker);
      popupsRef.current.push(popup);
    });
  }, [promotions, filter, createPopupHTML, promoRoute.activeRoute?.stops, completedStops, userLocation, haversineMeters, getMarkerStyle]);

  const handleSearchHere = () => {
    if (mapCenter) {
      setShowSearchHere(false);
      refetchPromotions(mapCenter, true);
      toast.success('Searching promotions here...');
    }
  };

  const handleCenterOnUser = () => {
    if (map.current && userLocation) {
      map.current.flyTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 14,
        pitch: 45,
      });
      setShowSearchHere(false);
    }
  };

  const handleSearchLocation = (lng: number, lat: number, placeName: string) => {
    if (map.current) {
      map.current.flyTo({
        center: [lng, lat],
        zoom: 14,
        pitch: 45,
      });
      setMapCenter({ lat, lng });
      toast.success(`Moved to ${placeName.split(',')[0]}`);
    }
  };

  const openDirections = (lat: number, lng: number, name: string) => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      window.open(`maps://maps.apple.com/?daddr=${lat},${lng}&q=${encodeURIComponent(name)}`, '_blank');
    } else {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encodeURIComponent(name)}`, '_blank');
    }
  };

  const applyFilters = () => {
    refetchPromotions(undefined, true);
    toast.success('Filters applied');
  };

  const resetFilters = () => {
    setMapFilters(defaultMapFilters);
  };

  const activeFilterCount = 
    (mapFilters.rewardTypes.length < 3 ? 1 : 0) +
    (mapFilters.categories.length > 0 ? 1 : 0) +
    (mapFilters.minReward > 0 ? 1 : 0) +
    (mapFilters.distance !== 10 ? 1 : 0);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Inject custom popup styles */}
      <style>{`
        .mapboxgl-popup-content {
          background: transparent !important;
          padding: 0 !important;
          box-shadow: none !important;
          border-radius: 0 !important;
        }
        .mapboxgl-popup-tip {
          display: none !important;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.8; }
        }
      `}</style>

      {/* Nearby pulse animation for amber markers */}
      <style>{`
        @keyframes nearby-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 4px 15px rgba(0,0,0,0.3), 0 0 14px rgba(245,158,11,0.5); }
          50% { transform: scale(1.08); box-shadow: 0 6px 20px rgba(0,0,0,0.3), 0 0 22px rgba(245,158,11,0.7); }
        }
        .promo-marker-nearby-pulse {
          animation: nearby-pulse 1.5s ease-in-out infinite;
        }
      `}</style>

      {/* Suppress Mapbox control z-index conflicts */}
      <style>{`
        .mapboxgl-ctrl-top-right,
        .mapboxgl-ctrl-top-left,
        .mapboxgl-ctrl-bottom-right,
        .mapboxgl-ctrl-bottom-left {
          z-index: 1 !important;
        }
      `}</style>

      {/* Header */}
      <div 
        className="absolute top-0 left-0 right-0 z-20 p-4 bg-gradient-to-b from-background via-background/90 to-transparent"
        style={{ touchAction: 'auto', pointerEvents: 'auto' }}
      >
        <div className="flex items-center justify-between mb-3">
          <h1 className="font-display text-xl font-bold">iGO</h1>
          <div className="flex gap-1.5 flex-shrink-0">
            {/* Route Builder Toggle */}
            <NeuButton 
              onClick={() => setShowRouteBuilder(true)} 
              size="sm"
              className={cn(
                promoRoute.isBuilding && 'text-green-500 ring-1 ring-green-500/30'
              )}
            >
              <Route className="w-5 h-5" />
              {promoRoute.totalStops > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-green-500 text-white text-xs rounded-full flex items-center justify-center">
                  {promoRoute.totalStops}
                </span>
              )}
            </NeuButton>
            {/* Nearby Alerts Toggle */}
            <NeuButton 
              onClick={() => setNearbyAlertsEnabled(!nearbyAlertsEnabled)} 
              size="sm"
              className={nearbyAlertsEnabled ? 'text-primary' : 'text-muted-foreground'}
            >
              {nearbyAlertsEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
            </NeuButton>
            {/* Check-In History - controlled mode */}
            <NeuButton onClick={() => setShowCheckInHistory(true)} size="sm">
              <History className="w-5 h-5" />
            </NeuButton>
            <NeuButton onClick={() => setShowFavorites(true)} size="sm">
              <Heart className="w-5 h-5" />
            </NeuButton>
            <NeuButton onClick={onClose} size="sm">
              <X className="w-5 h-5" />
            </NeuButton>
          </div>
        </div>

        {/* Search Bar */}
        {mapboxToken && (
          <MapSearchBar
            mapboxToken={mapboxToken}
            onSelectLocation={handleSearchLocation}
            className="mb-3"
          />
        )}

        {/* Filters Row */}
        <div className="flex gap-2 items-center">
          <button
            onClick={() => setShowFilters(true)}
            className={cn(
              'relative px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2',
              'bg-background/80 backdrop-blur-sm neu-button'
            )}
          >
            <Filter className="w-4 h-4" />
            Filters
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setFilter('all')}
            className={cn(
              'px-3 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1.5',
              filter === 'all'
                ? 'bg-gradient-to-r from-primary to-blue-500 text-white shadow-lg'
                : 'bg-background/80 backdrop-blur-sm neu-button'
            )}
          >
            All
          </button>
          <button
            onClick={() => setFilter('vicoin')}
            className={cn(
              'px-3 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1.5',
              filter === 'vicoin'
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
                : 'bg-background/80 backdrop-blur-sm neu-button'
            )}
          >
            <span className="w-4 h-4 rounded-full bg-primary/20 inline-flex items-center justify-center text-[10px] font-bold">V</span>
          </button>
          <button
            onClick={() => setFilter('icoin')}
            className={cn(
              'px-3 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1.5',
              filter === 'icoin'
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                : 'bg-background/80 backdrop-blur-sm neu-button'
            )}
          >
            <span className="w-4 h-4 rounded-full bg-blue-500/20 inline-flex items-center justify-center text-[10px] font-bold">I</span>
          </button>
          {/* Sort */}
          <div className="relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="px-3 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1.5 bg-background/80 backdrop-blur-sm neu-button"
            >
              <ArrowDownUp className="w-4 h-4" />
              Sort
            </button>
            {showSortMenu && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowSortMenu(false)}
                  aria-hidden
                />
                <div className="absolute right-0 top-full mt-1 py-1 rounded-xl bg-background/95 backdrop-blur-lg border border-border shadow-xl z-20 min-w-[160px]">
                  {[
                    { id: 'distance' as const, label: 'Closest first' },
                    { id: 'reward_desc' as const, label: 'Highest rewards' },
                    { id: 'reward_asc' as const, label: 'Lowest rewards' },
                    { id: 'expiring_soon' as const, label: 'Expiring soon' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        setSortBy(opt.id);
                        setShowSortMenu(false);
                      }}
                      className={cn(
                        'w-full px-4 py-2 text-left text-sm',
                        sortBy === opt.id ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/50'
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div ref={mapContainer} className="absolute inset-0 z-0" />

      {/* Loading Overlay */}
      {(!mapboxToken || !userLocation || backendLoading) && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="text-center">
            <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
            <p className="text-muted-foreground">
              {!mapboxToken ? 'Loading map...' : !userLocation ? 'Getting location...' : 'Fetching promos...'}
            </p>
          </div>
        </div>
      )}

      {/* Floating Action Buttons */}
      <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex flex-col gap-3 z-20">
        <button
          onClick={handleCenterOnUser}
          className="w-12 h-12 rounded-full neu-button flex items-center justify-center"
        >
          <Navigation className="w-5 h-5" />
        </button>
        <button
          onClick={() => refetchPromotions(undefined, true)}
          disabled={backendLoading}
          className="w-12 h-12 rounded-full neu-button flex items-center justify-center"
        >
          <RefreshCw className={cn('w-5 h-5', backendLoading && 'animate-spin')} />
        </button>
      </div>

      {/* Search Here Button */}
      {showSearchHere && (
        <div className="absolute top-32 left-1/2 transform -translate-x-1/2 z-20 animate-slide-down">
          <button
            onClick={handleSearchHere}
            disabled={backendLoading}
            className="flex items-center gap-2 px-5 py-3 rounded-full bg-primary text-primary-foreground font-medium shadow-lg shadow-primary/30 hover:scale-105 transition-transform"
          >
            <Search className="w-4 h-4" />
            Search Here
          </button>
        </div>
      )}

      {/* Route Active Banner */}
      {promoRoute.isBuilding && promoRoute.totalStops > 0 && (
        <div className="absolute top-32 left-1/2 transform -translate-x-1/2 z-20">
          <button
            onClick={() => setShowRouteBuilder(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-500 text-white font-medium shadow-lg shadow-green-500/30 hover:scale-105 transition-transform text-sm"
          >
            <Route className="w-4 h-4" />
            {promoRoute.totalStops} stops · {promoRoute.totalReward} coins
          </button>
        </div>
      )}

      {/* Banners: stacked below header (top-44 clears header) so neither is overlooked */}
      <div className="absolute top-44 left-4 right-4 z-20 flex flex-col gap-2 max-h-[40vh] overflow-y-auto">
        {/* Fallback mode banner — prominent when backend failed and map uses mock promotions */}
        {!fromBackend && !backendLoading && (
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-amber-500/70 bg-amber-500/20 backdrop-blur-sm shadow-lg ring-2 ring-amber-500/30 animate-in fade-in slide-in-from-top-2"
            role="alert"
            aria-live="assertive"
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500/40 flex items-center justify-center">
              <WifiOff className="w-5 h-5 text-amber-700 dark:text-amber-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-amber-900 dark:text-amber-100 text-sm">Demo mode</p>
              <p className="text-xs text-amber-800/90 dark:text-amber-200/90 mt-0.5">
                Showing sample spots. Real promotions will appear when connected.
              </p>
            </div>
            <button
              onClick={() => refetchPromotions(undefined, true)}
              disabled={backendLoading}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/50 hover:bg-amber-500/60 text-amber-900 dark:text-amber-100 text-sm font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('w-4 h-4', backendLoading && 'animate-spin')} />
              Retry
            </button>
          </div>
        )}

        {/* Check-in mode banner (when opened from remote check-in) */}
        {initialMode === 'checkin' && !checkInModeBannerDismissed && (
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/90 text-primary-foreground text-sm shadow-lg animate-in fade-in slide-in-from-top-2">
            <MapPin className="w-4 h-4 shrink-0" />
            <span className="flex-1">Check-in mode — use the sheet to verify your location and earn rewards.</span>
            <button
              onClick={() => setCheckInModeBannerDismissed(true)}
              className="p-1 rounded-full hover:bg-white/20"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Promotion Count Badge */}
      <div className={cn(
        'absolute left-4 bottom-24 rounded-2xl px-4 py-3 neu-card',
        fromBackend ? 'bg-background/90 backdrop-blur-sm' : 'bg-amber-500/10 backdrop-blur-sm border border-amber-500/30'
      )}>
        <span className="text-sm font-medium block mb-2">
          {promotions.length} {fromBackend ? 'promos' : 'demo spots'} nearby
        </span>
        {!fromBackend && (
          <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mb-2 flex items-center gap-1.5">
            <WifiOff className="w-3.5 h-3.5" />
            Demo mode
          </p>
        )}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <div className="w-3 h-3 rounded-full bg-gradient-to-br from-green-400 to-green-600" />
          <span>Low</span>
          <div className="w-8 h-1.5 rounded bg-gradient-to-r from-green-400 via-yellow-400 to-red-500 mx-1" />
          <span>High</span>
          <div className="w-3 h-3 rounded-full bg-gradient-to-br from-red-400 to-red-600" />
        </div>
      </div>

      {/* Selected Promotion Card */}
      {selectedPromo && (
        <div className="absolute bottom-20 left-4 right-4 z-20">
          <div className="neu-card rounded-3xl p-5 animate-slide-up border border-border/50 overflow-hidden">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                  style={{ background: getRewardGradient(selectedPromo.reward_amount, selectedPromo.reward_type) }}
                >
                  {selectedPromo.reward_type === 'vicoin' ? 'V' : selectedPromo.reward_type === 'icoin' ? 'I' : '★'}
                </div>
                <div className="flex-1">
                  <h3 className="font-display font-bold text-lg">{selectedPromo.business_name}</h3>
                  <p className="text-sm text-muted-foreground line-clamp-2">{selectedPromo.description}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPromo(null)}
                className="p-1 rounded-full hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <CategoryIcon category={selectedPromo.category} size="sm" />
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span>{selectedPromo.distance?.toFixed(1) || '?'} km</span>
              </div>
              <div className="flex items-center gap-1 text-sm">
                <Coins className="w-4 h-4 text-primary" />
                <span className="font-semibold">
                  {selectedPromo.reward_amount} {selectedPromo.reward_type === 'vicoin' ? 'Vicoins' : selectedPromo.reward_type === 'icoin' ? 'Icoins' : 'V+I'}
                </span>
              </div>
            </div>

            <div className="text-xs text-muted-foreground mb-3 p-2 bg-muted/30 rounded-lg">
              📋 {selectedPromo.required_action}
            </div>

            <div className="flex gap-2 flex-wrap">
              {selectedPromo.id === MOCK_CLIENT_SPOT_ID ? (
                <button
                  onClick={() => setShowCheckInFlow(true)}
                  className="flex-1 min-w-0 py-3 px-4 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
                >
                  <Coins className="w-4 h-4" /> Start Check-In Flow
                </button>
              ) : (
                <CheckInButton
                  promotion={{
                    id: selectedPromo.id,
                    business_name: selectedPromo.business_name,
                    latitude: selectedPromo.latitude,
                    longitude: selectedPromo.longitude,
                    reward_amount: selectedPromo.reward_amount,
                    reward_type: selectedPromo.reward_type,
                  }}
                  className="flex-1 min-w-0"
                  onSuccess={() => {
                    setCompletedStops(prev => new Set([...prev, selectedPromo.id]));
                    setSelectedPromo(null);
                  }}
                />
              )}
              {/* Add to Route button */}
              <button
                onClick={() => handleAddToRoute(selectedPromo)}
                className={cn(
                  "py-3 px-4 rounded-xl neu-button flex items-center gap-1.5 text-sm min-w-0 flex-shrink",
                  promoRoute.isInRoute(selectedPromo.id) && "text-green-500 border-green-500/30"
                )}
              >
                {promoRoute.isInRoute(selectedPromo.id) ? (
                  <>✓ In Route</>
                ) : (
                  <><Plus className="w-4 h-4 flex-shrink-0" /> Route</>
                )}
              </button>
              {/* Watch Later */}
              <button 
                onClick={() => handleAddToWatchLater(selectedPromo)}
                className={cn(
                  "py-3 px-3 rounded-xl neu-button flex-shrink-0",
                  promoRoute.isInWatchLater(selectedPromo.id) && "text-primary"
                )}
              >
                <Bookmark className={cn("w-5 h-5", promoRoute.isInWatchLater(selectedPromo.id) && "fill-current")} />
              </button>
              <button 
                onClick={() => toggleFavorite({
                  id: selectedPromo.id,
                  business_name: selectedPromo.business_name,
                  latitude: selectedPromo.latitude,
                  longitude: selectedPromo.longitude,
                  address: selectedPromo.address,
                  category: selectedPromo.category,
                })}
                className={cn(
                  "py-3 px-3 rounded-xl neu-button flex-shrink-0",
                  isFavorite(selectedPromo.id) && "text-red-500"
                )}
              >
                <Heart className={cn("w-5 h-5", isFavorite(selectedPromo.id) && "fill-current")} />
              </button>
              <button 
                onClick={() => openDirections(selectedPromo.latitude, selectedPromo.longitude, selectedPromo.business_name)}
                className="py-3 px-3 rounded-xl neu-button flex-shrink-0"
              >
                <ExternalLink className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Promo List */}
      {!selectedPromo && promotions.length > 0 && (
        <div className="absolute bottom-20 left-0 right-0 z-20 px-4">
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {promotions.slice(0, 5).map((promo) => (
              <button
                key={promo.id}
                onClick={() => {
                  setSelectedPromo(promo);
                  map.current?.flyTo({
                    center: [promo.longitude, promo.latitude],
                    zoom: 16,
                  });
                }}
                className="flex-shrink-0 neu-card rounded-2xl p-3 min-w-[200px] text-left border border-border/30"
              >
                <div className="flex items-center gap-2 mb-2">
                  <CategoryIcon category={promo.category} size="sm" />
                  <span className="font-medium text-sm truncate flex-1">{promo.business_name}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <div 
                      className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold text-white"
                      style={{ background: getRewardGradient(promo.reward_amount, promo.reward_type) }}
                    >
                      {promo.reward_type === 'vicoin' ? 'V' : promo.reward_type === 'icoin' ? 'I' : '★'}
                    </div>
                    <span>{typeof promo.distance === 'number' ? promo.distance.toFixed(1) : '?'} km</span>
                  </div>
                  <span 
                    className="font-semibold"
                    style={{ color: promo.reward_amount > 100 ? '#ef4444' : promo.reward_amount > 50 ? '#eab308' : '#22c55e' }}
                  >
                    +{promo.reward_amount}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter Sheet */}
      <MapFilterSheet
        open={showFilters}
        onOpenChange={setShowFilters}
        filters={mapFilters}
        onFiltersChange={setMapFilters}
        onApply={applyFilters}
        onReset={resetFilters}
      />

      {/* Favorites Sheet */}
      <FavoriteLocations
        open={showFavorites}
        onOpenChange={setShowFavorites}
        userLocation={userLocation}
        onNavigate={(lat, lng) => {
          if (map.current) {
            map.current.flyTo({
              center: [lng, lat],
              zoom: 16,
              pitch: 45,
            });
          }
        }}
        onOpenPromotionDetails={(promotionId) => {
          const promo = promotions.find((p) => p.id === promotionId);
          if (promo) {
            setSelectedPromo(promo);
            map.current?.flyTo({ center: [promo.longitude, promo.latitude], zoom: 16, pitch: 45 });
            setShowFavorites(false);
          }
        }}
      />

      {/* Check-In History - controlled mode */}
      <CheckInHistory
        open={showCheckInHistory}
        onOpenChange={setShowCheckInHistory}
        onDiscover={() => setShowCheckInHistory(false)}
      />

      {/* Route Builder */}
      <RouteBuilder
        open={showRouteBuilder}
        onOpenChange={setShowRouteBuilder}
        route={promoRoute.activeRoute}
        savedRoutes={promoRoute.savedRoutes}
        watchLater={promoRoute.watchLater}
        onRemoveStop={promoRoute.removeStop}
        onReorderStops={promoRoute.reorderStops}
        onSetTransportMode={promoRoute.setTransportMode}
        onSetFilters={promoRoute.setRouteFilters}
        onRenameRoute={promoRoute.renameRoute}
        onToggleCommute={promoRoute.toggleCommuteRoute}
        onSaveRoute={promoRoute.saveRoute}
        onDiscardRoute={promoRoute.discardRoute}
        onOpenInGoogleMaps={promoRoute.openInGoogleMaps}
        onSuggestRoute={handleSuggestRoute}
        onLoadRoute={promoRoute.loadRoute}
        onDeleteSavedRoute={promoRoute.deleteSavedRoute}
        onRemoveFromWatchLater={promoRoute.removeFromWatchLater}
        userLocation={userLocation}
        mapboxToken={mapboxToken}
        onStartRoute={() => promoRoute.startRoute()}
        onSetOrigin={promoRoute.setOrigin}
        onSetDestination={promoRoute.setDestination}
        onSetSchedule={promoRoute.setSchedule}
        onSetSegmentTransport={promoRoute.setSegmentTransport}
        getSegmentTransport={promoRoute.getSegmentTransport}
        onSuggestFromSaved={() => {
          if (userLocation) {
            promoRoute.suggestFromWatchLater(userLocation.lat, userLocation.lng);
            toast.success('Route built from saved promos!');
          } else { toast.error('Location needed'); }
        }}
        onSuggestByInterests={() => {
          if (userLocation) {
            promoRoute.suggestByInterests(
              promotions.map(p => ({ id: p.id, business_name: p.business_name, latitude: p.latitude, longitude: p.longitude, address: p.address, category: p.category, reward_type: p.reward_type, reward_amount: p.reward_amount, required_action: p.required_action })),
              userLocation.lat, userLocation.lng, ['Food & Drink', 'Shopping', 'Entertainment'],
            );
            toast.success('Route based on your interests!');
          } else { toast.error('Location needed'); }
        }}
        onSuggestSmartRoute={() => {
          if (userLocation) {
            promoRoute.suggestSmartRoute(
              promotions.map(p => ({ id: p.id, business_name: p.business_name, latitude: p.latitude, longitude: p.longitude, address: p.address, category: p.category, reward_type: p.reward_type, reward_amount: p.reward_amount, required_action: p.required_action })),
              userLocation.lat, userLocation.lng,
            );
            toast.success('Smart route generated!');
          } else { toast.error('Location needed'); }
        }}
        onOptimizeOrder={(lat, lng) => promoRoute.optimizeOrder(lat ?? userLocation?.lat, lng ?? userLocation?.lng)}
        onDuplicateRoute={promoRoute.duplicateRoute}
        onOpenSavedRouteInMaps={(routeId) => promoRoute.openSavedRouteInMaps(routeId, userLocation?.lat, userLocation?.lng)}
        routesSyncing={promoRoute.routesSyncing}
        lastRoutesSyncAt={promoRoute.lastRoutesSyncAt}
        activeRouteEstimate={promoRoute.activeRouteEstimate}
        isCloudSynced={promoRoute.isCloudSynced}
        onAddSavedRoute={promoRoute.addSavedRoute}
      />

      {/* Featured Promo Check-In Flow */}
      {selectedPromo && selectedPromo.id === MOCK_CLIENT_SPOT_ID && (
        <PromoCheckInFlow
          isOpen={showCheckInFlow}
          onClose={() => setShowCheckInFlow(false)}
          promotion={selectedPromo}
          onOpenWallet={() => {
            setShowCheckInFlow(false);
            setSelectedPromo(null);
            onOpenWallet?.();
          }}
        />
      )}
    </div>
  );
};
