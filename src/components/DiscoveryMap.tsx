import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { X, Navigation, RefreshCw, MapPin, Coins, Search, Filter, Heart, ExternalLink, Bell, BellOff, History } from 'lucide-react';
import { NeuButton } from './NeuButton';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { MapSearchBar } from './MapSearchBar';
import { MapFilterSheet, defaultMapFilters, type MapFilters } from './MapFilterSheet';
import { FavoriteLocations, useFavoriteLocation } from './FavoriteLocations';
import { CategoryIcon, getCategoryInfo } from './PromotionCategories';
import { CheckInButton } from './CheckInButton';
import { CheckInHistory } from './CheckInHistory';
import { useNearbyPromotions } from '@/hooks/useNearbyPromotions';

interface Promotion {
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
}

interface DiscoveryMapProps {
  isOpen: boolean;
  onClose: () => void;
}

// Generate local pins near a location (within ~10 miles / 16km)
const generateLocalPromotions = (centerLat: number, centerLng: number, count: number, startId: number = 0): Promotion[] => {
  const businesses = ['Coffee House', 'Tech Store', 'Fashion Outlet', 'Restaurant', 'Gym', 'Bookstore', 'Spa', 'Cinema', 'Market', 'Bar', 'Bakery', 'Pharmacy', 'Grocery', 'Pizza Place', 'Sushi Bar', 'Nail Salon', 'Hair Studio', 'Pet Store', 'Electronics', 'Clothing'];
  const categories = ['Food & Drink', 'Shopping', 'Entertainment', 'Health', 'Services'];
  const actionDescriptions = [
    'Visit the store and check-in at the counter',
    'Make any purchase of $10 or more',
    'Scan the QR code at the entrance',
    'Check-in and stay for 15 minutes',
    'Share a photo on social media with our hashtag',
    'Leave a review after your visit',
    'Sign up for our loyalty program',
    'Watch our 30-second promo video',
  ];
  const rewardTypes: ('vicoin' | 'icoin' | 'both')[] = ['vicoin', 'icoin', 'both'];
  const promotions: Promotion[] = [];
  
  // 10 miles ≈ 0.145 degrees latitude, varies for longitude
  const radiusDegrees = 0.145;
  
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * 2 * Math.PI;
    const distance = Math.sqrt(Math.random()) * radiusDegrees; // sqrt for uniform distribution
    const lat = centerLat + distance * Math.cos(angle);
    const lng = centerLng + distance * Math.sin(angle) / Math.cos(centerLat * Math.PI / 180);
    
    const business = businesses[Math.floor(Math.random() * businesses.length)];
    
    promotions.push({
      id: `local-${startId + i}`,
      business_name: `${business} #${Math.floor(Math.random() * 999) + 1}`,
      description: `Exclusive rewards at this ${business.toLowerCase()}!`,
      reward_type: rewardTypes[Math.floor(Math.random() * rewardTypes.length)],
      reward_amount: Math.floor(Math.random() * 450) + 50,
      required_action: actionDescriptions[Math.floor(Math.random() * actionDescriptions.length)],
      latitude: lat,
      longitude: lng,
      address: `${Math.floor(Math.random() * 9999) + 1} ${['Main', 'Oak', 'Maple', 'Cedar', 'Pine', 'Elm', 'Park', 'Lake', 'River', 'Hill'][Math.floor(Math.random() * 10)]} St`,
      category: categories[Math.floor(Math.random() * categories.length)],
    });
  }
  
  return promotions;
};

// Generate global mock promotions for demo - creates clusters around major cities
const generateGlobalPromotions = (): Promotion[] => {
  const cities = [
    { name: 'New York', lat: 40.7128, lng: -74.006 },
    { name: 'Los Angeles', lat: 34.0522, lng: -118.2437 },
    { name: 'Chicago', lat: 41.8781, lng: -87.6298 },
    { name: 'Houston', lat: 29.7604, lng: -95.3698 },
    { name: 'Phoenix', lat: 33.4484, lng: -112.074 },
    { name: 'Philadelphia', lat: 39.9526, lng: -75.1652 },
    { name: 'San Antonio', lat: 29.4241, lng: -98.4936 },
    { name: 'San Diego', lat: 32.7157, lng: -117.1611 },
    { name: 'Dallas', lat: 32.7767, lng: -96.797 },
    { name: 'San Jose', lat: 37.3382, lng: -121.8863 },
    { name: 'Austin', lat: 30.2672, lng: -97.7431 },
    { name: 'Jacksonville', lat: 30.3322, lng: -81.6557 },
    { name: 'London', lat: 51.5074, lng: -0.1278 },
    { name: 'Paris', lat: 48.8566, lng: 2.3522 },
    { name: 'Tokyo', lat: 35.6762, lng: 139.6503 },
    { name: 'Sydney', lat: -33.8688, lng: 151.2093 },
    { name: 'Dubai', lat: 25.2048, lng: 55.2708 },
    { name: 'Singapore', lat: 1.3521, lng: 103.8198 },
    { name: 'Mumbai', lat: 19.076, lng: 72.8777 },
    { name: 'São Paulo', lat: -23.5505, lng: -46.6333 },
    { name: 'Mexico City', lat: 19.4326, lng: -99.1332 },
    { name: 'Berlin', lat: 52.52, lng: 13.405 },
    { name: 'Moscow', lat: 55.7558, lng: 37.6173 },
    { name: 'Seoul', lat: 37.5665, lng: 126.978 },
    { name: 'Bangkok', lat: 13.7563, lng: 100.5018 },
    { name: 'Cairo', lat: 30.0444, lng: 31.2357 },
    { name: 'Lagos', lat: 6.5244, lng: 3.3792 },
    { name: 'Buenos Aires', lat: -34.6037, lng: -58.3816 },
    { name: 'Toronto', lat: 43.6532, lng: -79.3832 },
    { name: 'Madrid', lat: 40.4168, lng: -3.7038 },
    { name: 'Rome', lat: 41.9028, lng: 12.4964 },
    { name: 'Istanbul', lat: 41.0082, lng: 28.9784 },
    { name: 'Beijing', lat: 39.9042, lng: 116.4074 },
    { name: 'Shanghai', lat: 31.2304, lng: 121.4737 },
    { name: 'Hong Kong', lat: 22.3193, lng: 114.1694 },
    { name: 'Taipei', lat: 25.033, lng: 121.5654 },
    { name: 'Jakarta', lat: -6.2088, lng: 106.8456 },
    { name: 'Manila', lat: 14.5995, lng: 120.9842 },
    { name: 'Johannesburg', lat: -26.2041, lng: 28.0473 },
    { name: 'Cape Town', lat: -33.9249, lng: 18.4241 },
  ];
  
  let promotions: Promotion[] = [];
  let idCounter = 0;
  
  // Generate 50 pins per city (hundreds within 10-mile radius each)
  cities.forEach((city) => {
    const cityPromos = generateLocalPromotions(city.lat, city.lng, 50, idCounter);
    promotions = [...promotions, ...cityPromos];
    idCounter += 50;
  });
  
  return promotions;
};

// Get gradient color based on reward amount (green = low, red = high)
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

export const DiscoveryMap: React.FC<DiscoveryMapProps> = ({ isOpen, onClose }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const popupsRef = useRef<mapboxgl.Popup[]>([]);
  
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [selectedPromo, setSelectedPromo] = useState<Promotion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [filter, setFilter] = useState<'all' | 'vicoin' | 'icoin'>('all');
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [showSearchHere, setShowSearchHere] = useState(false);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [globalPromos] = useState<Promotion[]>(() => generateGlobalPromotions());
  const [localPromos, setLocalPromos] = useState<Promotion[]>([]);
  
  // New state for enhanced features
  const [showFilters, setShowFilters] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const [mapFilters, setMapFilters] = useState<MapFilters>(defaultMapFilters);
  const [nearbyAlertsEnabled, setNearbyAlertsEnabled] = useState(true);
  
  // Nearby promotion alerts
  const { nearbyPromotions, isWatching } = useNearbyPromotions(nearbyAlertsEnabled && isOpen);
  const { toggleFavorite, isFavorite } = useFavoriteLocation();
  // Create popup HTML for a promotion
  const createPopupHTML = useCallback((promo: Promotion): string => {
    const coinIcon = promo.reward_type === 'vicoin' ? 'V' : promo.reward_type === 'icoin' ? 'I' : 'V+I';
    const coinLabel = promo.reward_type === 'vicoin' ? 'Vicoins' : promo.reward_type === 'icoin' ? 'Icoins' : 'Both';
    const bgGradient = getRewardGradient(promo.reward_amount, promo.reward_type);
    
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
    if (isOpen && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(loc);
          // Generate 200 local pins within 10 miles of user
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

    // Add navigation controls
    map.current.addControl(
      new mapboxgl.NavigationControl({ visualizePitch: true }),
      'top-right'
    );

    // Add user location marker
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

    // Track map movement for "Search Here" button
    map.current.on('moveend', () => {
      if (!map.current) return;
      const center = map.current.getCenter();
      const zoom = map.current.getZoom();
      
      setMapCenter({ lat: center.lat, lng: center.lng });
      
      // Show "Search Here" if map moved significantly
      if (userLocation) {
        const distance = Math.sqrt(
          Math.pow(center.lat - userLocation.lat, 2) + 
          Math.pow(center.lng - userLocation.lng, 2)
        );
        setShowSearchHere(distance > 0.01 || zoom < 10);
      }
    });

    // Fetch promotions
    fetchPromotions();

    return () => {
      markersRef.current.forEach(marker => marker.remove());
      popupsRef.current.forEach(popup => popup.remove());
      map.current?.remove();
    };
  }, [isOpen, mapboxToken, userLocation]);

  // Update markers when promotions or filter changes
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers and popups
    markersRef.current.forEach(marker => marker.remove());
    popupsRef.current.forEach(popup => popup.remove());
    markersRef.current = [];
    popupsRef.current = [];

    // Filter promotions based on selected filter
    const filteredPromos = filter === 'all' 
      ? promotions 
      : promotions.filter(p => p.reward_type === filter || p.reward_type === 'both');

    // Add new markers with gradient colors
    filteredPromos.forEach(promo => {
      const gradient = getRewardGradient(promo.reward_amount, promo.reward_type);
      const glow = getCoinGlow(promo.reward_type);
      const coinIcon = promo.reward_type === 'vicoin' ? 'V' : promo.reward_type === 'icoin' ? 'I' : '★';
      
      // Create marker element
      const el = document.createElement('div');
      el.className = 'promo-marker-wrapper';
      el.innerHTML = `
        <div class="promo-marker" style="
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: ${gradient};
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3), ${glow};
          border: 2px solid rgba(255, 255, 255, 0.2);
        ">
          ${coinIcon}
        </div>
      `;

      // Add hover effects
      const markerDiv = el.querySelector('.promo-marker') as HTMLElement;
      
      // Create popup for this marker
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
          markerDiv.style.boxShadow = `0 8px 25px rgba(0, 0, 0, 0.4), ${glow}`;
        }
        popup.setLngLat([promo.longitude, promo.latitude]).addTo(map.current!);
      });

      el.addEventListener('mouseleave', () => {
        if (markerDiv) {
          markerDiv.style.transform = 'scale(1)';
          markerDiv.style.boxShadow = `0 4px 15px rgba(0, 0, 0, 0.3), ${glow}`;
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
  }, [promotions, filter, createPopupHTML]);

  const fetchPromotions = async (searchCenter?: { lat: number; lng: number }) => {
    const center = searchCenter || userLocation;
    if (!center) return;
    
    setIsLoading(true);
    setShowSearchHere(false);
    
    try {
      const { data, error } = await supabase.functions.invoke('get-nearby-promotions', {
        body: {
          latitude: center.lat,
          longitude: center.lng,
          radiusKm: 10,
          rewardType: filter === 'all' ? undefined : filter,
        },
      });

      if (error) throw error;
      
      // Combine DB promos with local + global mock promos
      const dbPromos = data?.promotions || [];
      const zoom = map.current?.getZoom() || 14;
      const allMockPromos = [...localPromos, ...globalPromos];
      
      if (zoom < 6) {
        // Show all global promos when zoomed out far
        const visiblePromos = allMockPromos.filter(p => {
          if (filter === 'all') return true;
          return p.reward_type === filter || p.reward_type === 'both';
        });
        setPromotions([...dbPromos, ...visiblePromos]);
      } else if (zoom < 10) {
        // Show promos within a wider range
        const visiblePromos = allMockPromos.filter(p => {
          const distance = Math.sqrt(
            Math.pow(p.latitude - center.lat, 2) + 
            Math.pow(p.longitude - center.lng, 2)
          );
          const inRange = distance < 3;
          if (filter === 'all') return inRange;
          return inRange && (p.reward_type === filter || p.reward_type === 'both');
        });
        setPromotions([...dbPromos, ...visiblePromos]);
      } else {
        // Show nearby promos when zoomed in
        const nearbyPromos = allMockPromos.filter(p => {
          const distance = Math.sqrt(
            Math.pow(p.latitude - center.lat, 2) + 
            Math.pow(p.longitude - center.lng, 2)
          );
          const inRange = distance < 0.5;
          if (filter === 'all') return inRange;
          return inRange && (p.reward_type === filter || p.reward_type === 'both');
        });
        setPromotions([...dbPromos, ...nearbyPromos]);
      }
      
      toast.success(`Found ${dbPromos.length + allMockPromos.length} promotions nearby`);
    } catch (error) {
      console.error('[DiscoveryMap] Fetch error:', error);
      // Fallback to mock promos only
      const zoom = map.current?.getZoom() || 14;
      const allMockPromos = [...localPromos, ...globalPromos];
      const visiblePromos = allMockPromos.filter(p => {
        if (filter !== 'all' && p.reward_type !== filter && p.reward_type !== 'both') return false;
        if (zoom >= 6) {
          const distance = Math.sqrt(
            Math.pow(p.latitude - center.lat, 2) + 
            Math.pow(p.longitude - center.lng, 2)
          );
          return distance < (zoom < 10 ? 3 : 0.5);
        }
        return true;
      });
      setPromotions(visiblePromos);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchHere = () => {
    if (mapCenter) {
      fetchPromotions(mapCenter);
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

  // Navigate to searched location
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

  // Open directions in external map app
  const openDirections = (lat: number, lng: number, name: string) => {
    // Check if on iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    if (isIOS) {
      // Try Apple Maps first
      window.open(`maps://maps.apple.com/?daddr=${lat},${lng}&q=${encodeURIComponent(name)}`, '_blank');
    } else {
      // Use Google Maps for Android/web
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encodeURIComponent(name)}`, '_blank');
    }
  };

  // Apply filters
  const applyFilters = () => {
    fetchPromotions();
    toast.success('Filters applied');
  };

  // Reset filters
  const resetFilters = () => {
    setMapFilters(defaultMapFilters);
  };

  // Count active filters
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

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-background via-background/90 to-transparent">
        <div className="flex items-center justify-between mb-3">
          <h1 className="font-display text-xl font-bold">Discovery Map</h1>
          <div className="flex gap-2">
            {/* Nearby Alerts Toggle */}
            <NeuButton 
              onClick={() => setNearbyAlertsEnabled(!nearbyAlertsEnabled)} 
              size="sm"
              className={nearbyAlertsEnabled ? 'text-primary' : 'text-muted-foreground'}
            >
              {nearbyAlertsEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
            </NeuButton>
            {/* Check-in History */}
            <CheckInHistory
              trigger={
                <NeuButton size="sm">
                  <History className="w-5 h-5" />
                </NeuButton>
              }
            />
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
        </div>
      </div>

      {/* Map Container */}
      <div ref={mapContainer} className="absolute inset-0" />

      {/* Loading Overlay */}
      {(!mapboxToken || !userLocation || isLoading) && (
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
      <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex flex-col gap-3">
        <button
          onClick={handleCenterOnUser}
          className="w-12 h-12 rounded-full neu-button flex items-center justify-center"
        >
          <Navigation className="w-5 h-5" />
        </button>
        <button
          onClick={() => fetchPromotions()}
          disabled={isLoading}
          className="w-12 h-12 rounded-full neu-button flex items-center justify-center"
        >
          <RefreshCw className={cn('w-5 h-5', isLoading && 'animate-spin')} />
        </button>
      </div>

      {/* Search Here Button */}
      {showSearchHere && (
        <div className="absolute top-32 left-1/2 transform -translate-x-1/2 z-20 animate-slide-down">
          <button
            onClick={handleSearchHere}
            disabled={isLoading}
            className="flex items-center gap-2 px-5 py-3 rounded-full bg-primary text-primary-foreground font-medium shadow-lg shadow-primary/30 hover:scale-105 transition-transform"
          >
            <Search className="w-4 h-4" />
            Search Here
          </button>
        </div>
      )}

      {/* Promotion Count Badge with Legend */}
      <div className="absolute left-4 bottom-24 bg-background/90 backdrop-blur-sm rounded-2xl px-4 py-3 neu-card">
        <span className="text-sm font-medium block mb-2">{promotions.length} promos nearby</span>
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
        <div className="absolute bottom-20 left-4 right-4 z-10">
          <div className="neu-card rounded-3xl p-5 animate-slide-up border border-border/50">
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

            <div className="flex gap-3">
              <CheckInButton
                promotion={{
                  id: selectedPromo.id,
                  business_name: selectedPromo.business_name,
                  latitude: selectedPromo.latitude,
                  longitude: selectedPromo.longitude,
                  reward_amount: selectedPromo.reward_amount,
                  reward_type: selectedPromo.reward_type,
                }}
                className="flex-1"
                onSuccess={() => setSelectedPromo(null)}
              />
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
                  "py-3 px-4 rounded-xl neu-button",
                  isFavorite(selectedPromo.id) && "text-red-500"
                )}
              >
                <Heart className={cn("w-5 h-5", isFavorite(selectedPromo.id) && "fill-current")} />
              </button>
              <button 
                onClick={() => openDirections(selectedPromo.latitude, selectedPromo.longitude, selectedPromo.business_name)}
                className="py-3 px-4 rounded-xl neu-button"
              >
                <ExternalLink className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Promo List */}
      {!selectedPromo && promotions.length > 0 && (
        <div className="absolute bottom-20 left-0 right-0 z-10 px-4">
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
                    <span>{promo.distance?.toFixed(1)} km</span>
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
        onNavigate={(lat, lng, name) => {
          if (map.current) {
            map.current.flyTo({
              center: [lng, lat],
              zoom: 16,
              pitch: 45,
            });
          }
        }}
      />
    </div>
  );
};