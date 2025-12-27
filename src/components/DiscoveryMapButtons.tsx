import React from 'react';
import { 
  Search, 
  Store, 
  Navigation, 
  ScanLine,
  Filter,
  MapPin
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { NeuButton } from './NeuButton';

interface MapButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

// Search Nearby Offers
export const SearchNearbyButton: React.FC<MapButtonProps> = ({ 
  onClick, 
  disabled, 
  className 
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'neu-button rounded-full px-5 py-3 flex items-center gap-3 transition-all hover:scale-[1.02]',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <Search className="w-5 h-5 text-primary" />
      <span className="text-sm font-medium">Search Nearby</span>
    </button>
  );
};

// Filter Button
export const FilterOffersButton: React.FC<MapButtonProps & { 
  activeFilters?: number 
}> = ({ onClick, disabled, activeFilters = 0, className }) => {
  return (
    <NeuButton
      onClick={onClick}
      className={cn(
        'relative',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <Filter className="w-5 h-5" />
      {activeFilters > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
          {activeFilters}
        </span>
      )}
    </NeuButton>
  );
};

// View Store Profile
export const ViewStoreButton: React.FC<MapButtonProps & { 
  storeName?: string;
  distance?: string;
  reward?: number;
}> = ({ 
  onClick, 
  disabled, 
  storeName = 'Store',
  distance,
  reward,
  className 
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'neu-card rounded-2xl p-4 w-full flex items-center gap-4 transition-all hover:scale-[1.01]',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <div className="w-12 h-12 rounded-xl neu-inset flex items-center justify-center">
        <Store className="w-6 h-6 text-primary" />
      </div>
      <div className="flex-1 text-left">
        <span className="font-medium block">{storeName}</span>
        {distance && (
          <span className="text-xs text-muted-foreground">{distance} away</span>
        )}
      </div>
      {reward && (
        <span className="bg-primary/20 text-primary text-sm font-medium px-3 py-1 rounded-full">
          +{reward}
        </span>
      )}
    </button>
  );
};

// Navigate/Directions
export const NavigateButton: React.FC<MapButtonProps & { 
  destination?: string 
}> = ({ onClick, disabled, destination, className }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'neu-button rounded-2xl px-5 py-3 flex items-center gap-3 transition-all hover:scale-[1.02]',
        'bg-gradient-to-r from-primary/10 to-transparent border border-primary/20',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <Navigation className="w-5 h-5 text-primary" />
      <div className="text-left">
        <span className="text-sm font-medium block">Get Directions</span>
        {destination && (
          <span className="text-xs text-muted-foreground">{destination}</span>
        )}
      </div>
    </button>
  );
};

// Scan In-Store Promo
export const ScanInStoreButton: React.FC<MapButtonProps> = ({ 
  onClick, 
  disabled, 
  className 
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'neu-button rounded-2xl px-5 py-4 flex items-center justify-center gap-3 transition-all hover:scale-[1.02]',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <ScanLine className="w-6 h-6 text-icoin" />
      <span className="font-medium">Scan In-Store</span>
    </button>
  );
};

// Current Location Button
export const CurrentLocationButton: React.FC<MapButtonProps> = ({ 
  onClick, 
  disabled, 
  className 
}) => {
  return (
    <NeuButton
      onClick={onClick}
      className={cn(
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      variant="accent"
    >
      <MapPin className="w-5 h-5" />
    </NeuButton>
  );
};
