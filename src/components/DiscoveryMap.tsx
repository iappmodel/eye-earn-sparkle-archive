import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { supabase } from '@/integrations/supabase/client';
import { X, Navigation, Filter, RefreshCw, MapPin, Coins } from 'lucide-react';
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

export const DiscoveryMap: React.FC<DiscoveryMapProps> = ({ isOpen, onClose }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [selectedPromo, setSelectedPromo] = useState<Promotion | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [filter, setFilter] = useState<'all' | 'vicoin' | 'icoin'>('all');
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);

  // Fetch Mapbox token
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (error) throw error;
        setMapboxToken(data?.token);
      } catch (error) {
        console.error('[DiscoveryMap] Token fetch error:', error);
        // Fallback: check if there's an env variable (for development)
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
          // Default to New York if location not available
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
    new mapboxgl.Marker({ color: '#8B5CF6' })
      .setLngLat([userLocation.lng, userLocation.lat])
      .addTo(map.current);

    // Fetch promotions
    fetchPromotions();

    return () => {
      markersRef.current.forEach(marker => marker.remove());
      map.current?.remove();
    };
  }, [isOpen, mapboxToken, userLocation]);

  // Update markers when promotions or filter changes
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Filter promotions
    const filteredPromos = filter === 'all' 
      ? promotions 
      : promotions.filter(p => p.reward_type === filter || p.reward_type === 'both');

    // Add new markers
    filteredPromos.forEach(promo => {
      const el = document.createElement('div');
      el.className = 'promo-marker';
      el.innerHTML = `
        <div class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg cursor-pointer transform transition-transform hover:scale-110 ${
          promo.reward_type === 'vicoin' ? 'bg-primary' : 
          promo.reward_type === 'icoin' ? 'bg-icoin' : 
          'bg-gradient-to-br from-primary to-icoin'
        }">
          ${promo.reward_type === 'vicoin' ? 'V' : promo.reward_type === 'icoin' ? 'I' : '★'}
        </div>
      `;

      el.addEventListener('click', () => setSelectedPromo(promo));

      const marker = new mapboxgl.Marker(el)
        .setLngLat([promo.longitude, promo.latitude])
        .addTo(map.current!);

      markersRef.current.push(marker);
    });
  }, [promotions, filter]);

  const fetchPromotions = async () => {
    if (!userLocation) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-nearby-promotions', {
        body: {
          latitude: userLocation.lat,
          longitude: userLocation.lng,
          radiusKm: 10,
          rewardType: filter === 'all' ? undefined : filter,
        },
      });

      if (error) throw error;
      setPromotions(data?.promotions || []);
    } catch (error) {
      console.error('[DiscoveryMap] Fetch error:', error);
      toast.error('Failed to load nearby promotions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCenterOnUser = () => {
    if (map.current && userLocation) {
      map.current.flyTo({
        center: [userLocation.lng, userLocation.lat],
        zoom: 14,
        pitch: 45,
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 p-4 bg-gradient-to-b from-background to-transparent">
        <div className="flex items-center justify-between mb-4">
          <h1 className="font-display text-xl font-bold">Discovery Map</h1>
          <NeuButton onClick={onClose} size="sm">
            <X className="w-5 h-5" />
          </NeuButton>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {(['all', 'vicoin', 'icoin'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={cn(
                'px-4 py-2 rounded-full text-sm font-medium transition-all',
                filter === type
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background/80 backdrop-blur-sm neu-button'
              )}
            >
              {type === 'all' ? 'All' : type === 'vicoin' ? 'Vicoins' : 'Icoins'}
            </button>
          ))}
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
          onClick={fetchPromotions}
          disabled={isLoading}
          className="w-12 h-12 rounded-full neu-button flex items-center justify-center"
        >
          <RefreshCw className={cn('w-5 h-5', isLoading && 'animate-spin')} />
        </button>
      </div>

      {/* Promotion Count Badge */}
      <div className="absolute left-4 bottom-24 bg-background/90 backdrop-blur-sm rounded-2xl px-4 py-2 neu-card">
        <span className="text-sm font-medium">{promotions.length} promos nearby</span>
      </div>

      {/* Selected Promotion Card */}
      {selectedPromo && (
        <div className="absolute bottom-20 left-4 right-4 z-10">
          <div className="neu-card rounded-3xl p-5 animate-slide-up">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="font-display font-bold text-lg">{selectedPromo.business_name}</h3>
                <p className="text-sm text-muted-foreground">{selectedPromo.description}</p>
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
                  {selectedPromo.reward_amount} {selectedPromo.reward_type === 'vicoin' ? 'V' : selectedPromo.reward_type === 'icoin' ? 'I' : 'V+I'}
                </span>
              </div>
              <span className="text-xs bg-muted px-2 py-1 rounded-full capitalize">
                {selectedPromo.required_action}
              </span>
            </div>

            <div className="flex gap-3">
              <button className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-medium">
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
                className="flex-shrink-0 neu-card rounded-2xl p-3 min-w-[200px] text-left"
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white',
                    promo.reward_type === 'vicoin' ? 'bg-primary' : 'bg-icoin'
                  )}>
                    {promo.reward_type === 'vicoin' ? 'V' : 'I'}
                  </div>
                  <span className="font-medium text-sm truncate">{promo.business_name}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{promo.distance?.toFixed(1)} km</span>
                  <span className="font-semibold text-primary">+{promo.reward_amount}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
