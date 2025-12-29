import React, { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { X, Navigation, RefreshCw, MapPin, Coins, Search } from 'lucide-react';
import { NeuButton } from './NeuButton';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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

// Generate global mock promotions for demo
const generateGlobalPromotions = (count: number): Promotion[] => {
  const cities = [
    { name: 'New York', lat: 40.7128, lng: -74.006 },
    { name: 'Los Angeles', lat: 34.0522, lng: -118.2437 },
    { name: 'Chicago', lat: 41.8781, lng: -87.6298 },
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
  ];

  const businesses = ['Coffee House', 'Tech Store', 'Fashion Outlet', 'Restaurant', 'Gym', 'Bookstore', 'Spa', 'Cinema', 'Market', 'Bar'];
  const categories = ['Food & Drink', 'Shopping', 'Entertainment', 'Health', 'Services'];
  const actions = ['visit', 'purchase', 'scan', 'checkin'];

  const promotions: Promotion[] = [];

  for (let i = 0; i < count; i++) {
    const city = cities[Math.floor(Math.random() * cities.length)];
    const business = businesses[Math.floor(Math.random() * businesses.length)];
    const rewardTypes: ('vicoin' | 'icoin' | 'both')[] = ['vicoin', 'icoin', 'both'];
    
    promotions.push({
      id: `global-${i}`,
      business_name: `${business} ${city.name}`,
      description: `Earn rewards at ${business} in ${city.name}!`,
      reward_type: rewardTypes[Math.floor(Math.random() * rewardTypes.length)],
      reward_amount: Math.floor(Math.random() * 450) + 50,
      required_action: actions[Math.floor(Math.random() * actions.length)],
      latitude: city.lat + (Math.random() - 0.5) * 2,
      longitude: city.lng + (Math.random() - 0.5) * 2,
      address: `${Math.floor(Math.random() * 999) + 1} Main St, ${city.name}`,
      category: categories[Math.floor(Math.random() * categories.length)],
    });
  }

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
  const [globalPromos] = useState<Promotion[]>(() => generateGlobalPromotions(500));

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
          margin-bottom: 10px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          line-height: 1.4;
        ">${promo.description || 'Earn rewards at this location!'}</div>
        
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

  // Get user location
  useEffect(() => {
    if (isOpen && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error('[DiscoveryMap] Geolocation error:', error);
          setUserLocation({ lat: 40.7128, lng: -74.0060 });
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
      
      // Combine with global promos for demo
      const dbPromos = data?.promotions || [];
      const zoom = map.current?.getZoom() || 14;
      
      if (zoom < 8) {
        // Show global promos when zoomed out
        const visibleGlobalPromos = globalPromos.filter(p => {
          if (filter === 'all') return true;
          return p.reward_type === filter || p.reward_type === 'both';
        });
        setPromotions([...dbPromos, ...visibleGlobalPromos]);
      } else {
        // Filter global promos by distance when zoomed in
        const nearbyGlobalPromos = globalPromos.filter(p => {
          const distance = Math.sqrt(
            Math.pow(p.latitude - center.lat, 2) + 
            Math.pow(p.longitude - center.lng, 2)
          );
          const inRange = distance < (zoom < 10 ? 5 : 1);
          if (filter === 'all') return inRange;
          return inRange && (p.reward_type === filter || p.reward_type === 'both');
        });
        setPromotions([...dbPromos, ...nearbyGlobalPromos]);
      }
      
      toast.success(`Found ${promotions.length} promotions`);
    } catch (error) {
      console.error('[DiscoveryMap] Fetch error:', error);
      // Fallback to global promos only
      const zoom = map.current?.getZoom() || 14;
      const visiblePromos = globalPromos.filter(p => {
        if (filter !== 'all' && p.reward_type !== filter && p.reward_type !== 'both') return false;
        if (zoom >= 8) {
          const distance = Math.sqrt(
            Math.pow(p.latitude - center.lat, 2) + 
            Math.pow(p.longitude - center.lng, 2)
          );
          return distance < (zoom < 10 ? 5 : 1);
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
      <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-background to-transparent">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-display text-xl font-bold">Discovery Map</h1>
          <NeuButton onClick={onClose} size="sm">
            <X className="w-5 h-5" />
          </NeuButton>
        </div>

        {/* Filters with coin icons */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2',
              filter === 'all'
                ? 'bg-gradient-to-r from-primary to-blue-500 text-white shadow-lg'
                : 'bg-background/80 backdrop-blur-sm neu-button'
            )}
          >
            <span className="flex items-center gap-0.5">
              <span className="w-4 h-4 rounded-full bg-primary inline-flex items-center justify-center text-[10px] font-bold text-white">V</span>
              <span className="w-4 h-4 rounded-full bg-blue-500 inline-flex items-center justify-center text-[10px] font-bold text-white">I</span>
            </span>
            All
          </button>
          <button
            onClick={() => setFilter('vicoin')}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2',
              filter === 'vicoin'
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
                : 'bg-background/80 backdrop-blur-sm neu-button'
            )}
          >
            <span className="w-5 h-5 rounded-full bg-primary/20 inline-flex items-center justify-center text-xs font-bold">V</span>
            Vicoins
          </button>
          <button
            onClick={() => setFilter('icoin')}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2',
              filter === 'icoin'
                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30'
                : 'bg-background/80 backdrop-blur-sm neu-button'
            )}
          >
            <span className="w-5 h-5 rounded-full bg-blue-500/20 inline-flex items-center justify-center text-xs font-bold">I</span>
            Icoins
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

            <div className="flex items-center gap-4 mb-4">
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
              <span className="text-xs bg-muted px-2 py-1 rounded-full capitalize">
                {selectedPromo.required_action}
              </span>
            </div>

            <div className="flex gap-3">
              <button 
                className="flex-1 py-3 rounded-xl text-white font-medium"
                style={{ background: getRewardGradient(selectedPromo.reward_amount, selectedPromo.reward_type) }}
              >
                Claim Reward
              </button>
              <button className="py-3 px-4 rounded-xl neu-button">
                <Navigation className="w-5 h-5" />
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
                <div className="flex items-center gap-2 mb-1">
                  <div 
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: getRewardGradient(promo.reward_amount, promo.reward_type) }}
                  >
                    {promo.reward_type === 'vicoin' ? 'V' : promo.reward_type === 'icoin' ? 'I' : '★'}
                  </div>
                  <span className="font-medium text-sm truncate">{promo.business_name}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{promo.distance?.toFixed(1)} km</span>
                  <span 
                    className="font-semibold"
                    style={{ color: promo.reward_amount > 100 ? '#ef4444' : promo.reward_amount > 50 ? '#eab308' : '#22c55e' }}
                  >
                    +{promo.reward_amount} {promo.reward_type === 'vicoin' ? 'V' : 'I'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};