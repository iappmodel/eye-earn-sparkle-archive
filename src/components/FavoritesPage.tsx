import React, { useState, useEffect } from 'react';
import { Map, Heart, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FavoriteLocations } from './FavoriteLocations';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface FavoritesPageProps {
  /** Callback when user wants to open the Discovery Map (e.g. to add more favorites) */
  onOpenMap?: () => void;
  /** Whether this page is currently active (for performance) */
  isActive?: boolean;
  className?: string;
}

export const FavoritesPage: React.FC<FavoritesPageProps> = ({
  onOpenMap,
  isActive = true,
  className,
}) => {
  const { user } = useAuth();
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!isActive || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) =>
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, maximumAge: 60000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [isActive]);

  if (!user) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center min-h-[60vh] px-6 text-center',
          className
        )}
      >
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <LogIn className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Sign in to save favorites</h2>
        <p className="text-muted-foreground text-sm max-w-xs">
          Create an account or sign in to save your favorite promotion locations
          and access them anytime.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full overflow-hidden', className)}>
      <div className="flex-shrink-0 px-4 pt-2 pb-4 flex items-center justify-between gap-2">
        {onOpenMap && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenMap}
            className="gap-2"
          >
            <Map className="w-4 h-4" />
            Open Map
          </Button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-4 pb-8">
        <FavoriteLocations
          open={true}
          onOpenChange={() => {}}
          embedded
          userLocation={userLocation}
          onNavigate={() => {
            onOpenMap?.();
          }}
          onOpenPromotionDetails={() => {
            onOpenMap?.();
          }}
        />
      </div>
    </div>
  );
};
