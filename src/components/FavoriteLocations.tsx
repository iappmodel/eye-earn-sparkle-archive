import React, { useState, useEffect } from 'react';
import { Heart, MapPin, Trash2, Navigation, Star } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface FavoriteLocation {
  id: string;
  business_name: string;
  latitude: number;
  longitude: number;
  address: string | null;
  category: string | null;
  notes: string | null;
  created_at: string;
}

interface FavoriteLocationsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (lat: number, lng: number, name: string) => void;
}

export const FavoriteLocations: React.FC<FavoriteLocationsProps> = ({
  open,
  onOpenChange,
  onNavigate,
}) => {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<FavoriteLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchFavorites = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('favorite_locations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFavorites(data || []);
    } catch (error) {
      console.error('Error fetching favorites:', error);
      toast.error('Failed to load favorites');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open && user) {
      fetchFavorites();
    }
  }, [open, user]);

  const removeFavorite = async (id: string) => {
    try {
      const { error } = await supabase
        .from('favorite_locations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setFavorites(prev => prev.filter(f => f.id !== id));
      toast.success('Removed from favorites');
    } catch (error) {
      console.error('Error removing favorite:', error);
      toast.error('Failed to remove');
    }
  };

  const handleNavigate = (fav: FavoriteLocation) => {
    onNavigate(fav.latitude, fav.longitude, fav.business_name);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] rounded-t-3xl">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-primary fill-primary" />
            Favorite Locations
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-3 overflow-y-auto pb-8">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-20 bg-muted/50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : favorites.length === 0 ? (
            <div className="text-center py-12">
              <Star className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground">No favorite locations yet</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Tap the heart icon on any promotion to save it
              </p>
            </div>
          ) : (
            favorites.map((fav) => (
              <div
                key={fav.id}
                className="p-4 rounded-xl bg-muted/30 border border-border/50"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{fav.business_name}</h4>
                    {fav.address && (
                      <p className="text-xs text-muted-foreground truncate">{fav.address}</p>
                    )}
                    {fav.category && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full">
                        {fav.category}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={() => handleNavigate(fav)}
                    >
                      <Navigation className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      onClick={() => removeFavorite(fav.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

// Hook to manage favorites
export const useFavoriteLocation = () => {
  const { user } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;

    const fetchFavoriteIds = async () => {
      const { data } = await supabase
        .from('favorite_locations')
        .select('promotion_id')
        .eq('user_id', user.id);

      if (data) {
        setFavoriteIds(new Set(data.map(f => f.promotion_id).filter(Boolean) as string[]));
      }
    };

    fetchFavoriteIds();
  }, [user]);

  const toggleFavorite = async (promotion: {
    id: string;
    business_name: string;
    latitude: number;
    longitude: number;
    address?: string;
    category?: string;
  }) => {
    if (!user) {
      toast.error('Please sign in to save favorites');
      return;
    }

    const isFavorite = favoriteIds.has(promotion.id);

    if (isFavorite) {
      const { error } = await supabase
        .from('favorite_locations')
        .delete()
        .eq('user_id', user.id)
        .eq('promotion_id', promotion.id);

      if (!error) {
        setFavoriteIds(prev => {
          const next = new Set(prev);
          next.delete(promotion.id);
          return next;
        });
        toast.success('Removed from favorites');
      }
    } else {
      const { error } = await supabase
        .from('favorite_locations')
        .insert({
          user_id: user.id,
          promotion_id: promotion.id,
          business_name: promotion.business_name,
          latitude: promotion.latitude,
          longitude: promotion.longitude,
          address: promotion.address || null,
          category: promotion.category || null,
        });

      if (!error) {
        setFavoriteIds(prev => new Set([...prev, promotion.id]));
        toast.success('Added to favorites');
      }
    }
  };

  const isFavorite = (promotionId: string) => favoriteIds.has(promotionId);

  return { toggleFavorite, isFavorite };
};
