import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  Route, X, GripVertical, Trash2, Car, Footprints, Bus,
  Navigation, Sparkles, Save, MapPin, Coins, ExternalLink,
  Filter, Clock, CalendarCheck, ChevronDown, ChevronUp, Edit2,
  Bookmark, Zap, TrendingUp, Timer,
} from 'lucide-react';
import { CategoryIcon } from './PromotionCategories';
import { RouteFilterSheet } from './RouteFilterSheet';
import type { PromoRoute, RouteStop, TransportMode, RouteFilters } from '@/hooks/usePromoRoute';
import { defaultRouteFilters } from '@/hooks/usePromoRoute';
import { toast } from 'sonner';

interface RouteBuilderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  route: PromoRoute | null;
  savedRoutes: PromoRoute[];
  watchLater: RouteStop[];
  onRemoveStop: (stopId: string) => void;
  onReorderStops: (fromIndex: number, toIndex: number) => void;
  onSetTransportMode: (mode: TransportMode) => void;
  onSetFilters: (filters: RouteFilters) => void;
  onRenameRoute: (name: string) => void;
  onToggleCommute: () => void;
  onSaveRoute: () => PromoRoute | null;
  onDiscardRoute: () => void;
  onOpenInGoogleMaps: (userLat?: number, userLng?: number) => void;
  onSuggestRoute: (optimization?: string) => void;
  onLoadRoute: (routeId: string) => void;
  onDeleteSavedRoute: (routeId: string) => void;
  onRemoveFromWatchLater: (promotionId: string) => void;
  onStartRoute?: () => void;
  userLocation?: { lat: number; lng: number } | null;
}

const TRANSPORT_MODES: { id: TransportMode; label: string; icon: React.ElementType }[] = [
  { id: 'walking', label: 'Walk', icon: Footprints },
  { id: 'driving', label: 'Drive', icon: Car },
  { id: 'transit', label: 'Transit', icon: Bus },
];

export const RouteBuilder: React.FC<RouteBuilderProps> = ({
  open,
  onOpenChange,
  route,
  savedRoutes,
  watchLater,
  onRemoveStop,
  onReorderStops,
  onSetTransportMode,
  onSetFilters,
  onRenameRoute,
  onToggleCommute,
  onSaveRoute,
  onDiscardRoute,
  onOpenInGoogleMaps,
  onSuggestRoute,
  onLoadRoute,
  onDeleteSavedRoute,
  onRemoveFromWatchLater,
  onStartRoute,
  userLocation,
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [showWatchLater, setShowWatchLater] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');

  const handleSave = () => {
    const saved = onSaveRoute();
    if (saved) {
      toast.success('Route saved!');
    } else {
      toast.error('Add at least one stop to save');
    }
  };

  const handleOpenMaps = () => {
    onOpenInGoogleMaps(userLocation?.lat, userLocation?.lng);
  };

  const handleStartEdit = () => {
    setEditName(route?.name || '');
    setIsEditing(true);
  };

  const handleFinishEdit = () => {
    if (editName.trim()) {
      onRenameRoute(editName.trim());
    }
    setIsEditing(false);
  };

  const moveStop = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex >= 0 && newIndex < (route?.stops.length ?? 0)) {
      onReorderStops(index, newIndex);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[90vh] rounded-t-3xl">
          <SheetHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Route className="w-5 h-5 text-primary" />
              <SheetTitle className="flex-1">
                {route ? (
                  isEditing ? (
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={handleFinishEdit}
                      onKeyDown={(e) => e.key === 'Enter' && handleFinishEdit()}
                      autoFocus
                      className="h-8 text-lg font-semibold"
                    />
                  ) : (
                    <button onClick={handleStartEdit} className="flex items-center gap-2 hover:text-primary transition-colors">
                      {route.name}
                      <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  )
                ) : 'Route Planner'}
              </SheetTitle>
            </div>
            <SheetDescription>
              {route
                ? `${route.stops.length} stops · ${route.totalReward} coins`
                : 'Plan your earning route'}
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="h-[calc(100%-8rem)] pb-4">
            <div className="space-y-4 pr-2">
              {/* Transport Mode Selector */}
              {route && (
                <div className="flex gap-2">
                  {TRANSPORT_MODES.map((mode) => {
                    const Icon = mode.icon;
                    return (
                      <button
                        key={mode.id}
                        onClick={() => onSetTransportMode(mode.id)}
                        className={cn(
                          'flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all',
                          route.transportMode === mode.id
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/50'
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-sm font-medium">{mode.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Quick Actions */}
              {route && (
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFilters(true)}
                    className="gap-2"
                  >
                    <Filter className="w-4 h-4" />
                    Filters
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onToggleCommute}
                    className={cn('gap-2', route.isCommuteRoute && 'border-primary text-primary bg-primary/5')}
                  >
                    <CalendarCheck className="w-4 h-4" />
                    {route.isCommuteRoute ? 'Daily Commute ✓' : 'Set as Commute'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSuggestRoute()}
                    className="gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    Re-suggest
                  </Button>
                </div>
              )}

              {/* Stops List */}
              {route && route.stops.length > 0 ? (
                <div className="space-y-1">
                  {/* Start: User Location */}
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                      <Navigation className="w-4 h-4 text-primary-foreground" />
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium">Your Location</div>
                      <div className="text-xs text-muted-foreground">Starting point</div>
                    </div>
                  </div>

                  {/* Connection line */}
                  <div className="flex justify-center">
                    <div className="w-0.5 h-4 bg-border" />
                  </div>

                  {/* Route Stops */}
                  {route.stops.map((stop, index) => (
                    <React.Fragment key={stop.id}>
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-card border border-border/50 group">
                        <div className="flex flex-col gap-0.5">
                          <button
                            onClick={() => moveStop(index, 'up')}
                            disabled={index === 0}
                            className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => moveStop(index, 'down')}
                            disabled={index === route.stops.length - 1}
                            className="p-0.5 rounded hover:bg-muted disabled:opacity-30"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold shrink-0">
                          {index + 1}
                        </div>

                        <CategoryIcon category={stop.category || ''} size="sm" />

                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{stop.businessName}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {stop.address || 'Location available'}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Coins className="w-3 h-3" />
                            +{stop.rewardAmount}
                          </Badge>
                          <button
                            onClick={() => onRemoveStop(stop.id)}
                            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {index < route.stops.length - 1 && (
                        <div className="flex justify-center">
                          <div className="w-0.5 h-3 bg-border" />
                        </div>
                      )}
                    </React.Fragment>
                  ))}

                  {/* Route Summary */}
                  <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-primary/10 to-blue-500/10 border border-primary/20">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <div className="text-lg font-bold text-primary">{route.stops.length}</div>
                        <div className="text-xs text-muted-foreground">Stops</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-primary">{route.totalReward}</div>
                        <div className="text-xs text-muted-foreground">Total Coins</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-primary">
                          {route.estimatedTime ? `${route.estimatedTime}m` : '~'}
                        </div>
                        <div className="text-xs text-muted-foreground">Est. Time</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : route ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">No stops yet</p>
                  <p className="text-sm mt-1">Tap promotions on the map to add them</p>
                  <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={() => onSuggestRoute()}>
                    <Sparkles className="w-4 h-4" />
                    Generate Suggested Route
                  </Button>
                </div>
              ) : null}

              {/* Platform Suggested Route Card - when no route is active */}
              {!route && (
                <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">Platform Suggested Route</h3>
                      <p className="text-xs text-muted-foreground">We'll find the best earning route near you</p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => onSuggestRoute('more_earnings')}
                      className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border/50 bg-card hover:border-primary/50 hover:bg-primary/5 transition-all"
                    >
                      <TrendingUp className="w-5 h-5 text-primary" />
                      <span className="text-xs font-medium">Max Earnings</span>
                    </button>
                    <button
                      onClick={() => onSuggestRoute('faster')}
                      className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border/50 bg-card hover:border-primary/50 hover:bg-primary/5 transition-all"
                    >
                      <Timer className="w-5 h-5 text-primary" />
                      <span className="text-xs font-medium">Fastest</span>
                    </button>
                    <button
                      onClick={() => onSuggestRoute('effective')}
                      className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border/50 bg-card hover:border-primary/50 hover:bg-primary/5 transition-all"
                    >
                      <Zap className="w-5 h-5 text-primary" />
                      <span className="text-xs font-medium">Most Effective</span>
                    </button>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => onStartRoute?.()}
                  >
                    <Route className="w-4 h-4" />
                    Start New Route Manually
                  </Button>
                </div>
              )}

              {/* Saved Routes Section */}
              {!route && (
                <div className="space-y-3 mt-2">
                  <button
                    onClick={() => setShowSaved(!showSaved)}
                    className="flex items-center justify-between w-full text-left"
                  >
                    <span className="text-sm font-semibold flex items-center gap-2">
                      <Save className="w-4 h-4" />
                      Saved Routes ({savedRoutes.length})
                    </span>
                    {showSaved ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {showSaved && savedRoutes.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card"
                    >
                      <Route className="w-5 h-5 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{r.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.stops.length} stops · {r.totalReward} coins
                          {r.isCommuteRoute && ' · Daily'}
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => { onLoadRoute(r.id); }}>
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDeleteSavedRoute(r.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {showSaved && savedRoutes.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-3">No saved routes yet</p>
                  )}
                </div>
              )}

              {/* Watch Later Section */}
              <div className="space-y-3 mt-2">
                <button
                  onClick={() => setShowWatchLater(!showWatchLater)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <span className="text-sm font-semibold flex items-center gap-2">
                    <Bookmark className="w-4 h-4" />
                    Watch Later ({watchLater.length})
                  </span>
                  {showWatchLater ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showWatchLater && watchLater.map((item) => (
                  <div
                    key={item.promotionId}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card"
                  >
                    <CategoryIcon category={item.category || ''} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.businessName}</div>
                      <div className="text-xs text-muted-foreground">
                        +{item.rewardAmount} {item.rewardType}
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => onRemoveFromWatchLater(item.promotionId)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                {showWatchLater && watchLater.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-3">No items saved</p>
                )}
              </div>
            </div>
          </ScrollArea>

          {/* Bottom Actions */}
          {route && (
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t border-border flex gap-2">
              <Button variant="outline" size="sm" onClick={onDiscardRoute} className="gap-1">
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleSave} className="gap-1 flex-1">
                <Save className="w-4 h-4" />
                Save
              </Button>
              <Button
                size="sm"
                onClick={handleOpenMaps}
                disabled={route.stops.length === 0}
                className="gap-1 flex-1"
              >
                <ExternalLink className="w-4 h-4" />
                Open in Maps
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Route Filters */}
      <RouteFilterSheet
        open={showFilters}
        onOpenChange={setShowFilters}
        filters={route?.filters || defaultRouteFilters}
        onFiltersChange={onSetFilters}
        onApply={() => toast.success('Route filters applied')}
        onReset={() => onSetFilters(defaultRouteFilters)}
      />
    </>
  );
};
