import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { LocationAutocomplete, type LocationSelection } from './LocationAutocomplete';
import {
  Route, X, GripVertical, Trash2, Car, Footprints, Bus, Bike, PersonStanding,
  Navigation, Sparkles, Save, MapPin, Coins, ExternalLink,
  Filter, Clock, CalendarCheck, ChevronDown, ChevronUp, Edit2,
  Bookmark, Zap, TrendingUp, Timer, Brain, Heart, MapPinned,
} from 'lucide-react';
import { CategoryIcon } from './PromotionCategories';
import { RouteFilterSheet } from './RouteFilterSheet';
import type { PromoRoute, RouteStop, TransportMode, RouteFilters, RouteDestination, RouteSchedule, RouteOrigin } from '@/hooks/usePromoRoute';
import { defaultRouteFilters } from '@/hooks/usePromoRoute';
import { useDragReorder } from '@/hooks/useDragReorder';
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
  onSetDestination?: (dest: RouteDestination | null) => void;
  onSetSchedule?: (schedule: RouteSchedule | null) => void;
  onSetSegmentTransport?: (fromIdx: number, toIdx: number, mode: TransportMode) => void;
  onSetOrigin?: (origin: RouteOrigin | null) => void;
  onSuggestFromSaved?: () => void;
  onSuggestByInterests?: () => void;
  onSuggestSmartRoute?: () => void;
  getSegmentTransport?: (fromIdx: number, toIdx: number) => TransportMode;
  userLocation?: { lat: number; lng: number } | null;
  mapboxToken?: string | null;
}

const TRANSPORT_MODES: { id: TransportMode; label: string; icon: React.ElementType }[] = [
  { id: 'walking', label: 'Walk', icon: Footprints },
  { id: 'driving', label: 'Drive', icon: Car },
  { id: 'transit', label: 'Transit', icon: Bus },
  { id: 'cycling', label: 'Cycle', icon: Bike },
  { id: 'running', label: 'Run', icon: PersonStanding },
];

const DAYS = [
  { id: 'everyday', label: 'Every day' },
  { id: 'mon', label: 'Mon' },
  { id: 'tue', label: 'Tue' },
  { id: 'wed', label: 'Wed' },
  { id: 'thu', label: 'Thu' },
  { id: 'fri', label: 'Fri' },
  { id: 'sat', label: 'Sat' },
  { id: 'sun', label: 'Sun' },
];

const getTransportIcon = (mode: TransportMode) => {
  switch (mode) {
    case 'walking': return Footprints;
    case 'driving': return Car;
    case 'transit': return Bus;
    case 'cycling': return Bike;
    case 'running': return PersonStanding;
    default: return Footprints;
  }
};

const SEGMENT_MODES: TransportMode[] = ['walking', 'driving', 'transit', 'cycling', 'running'];

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
  onSetDestination,
  onSetSchedule,
  onSetSegmentTransport,
  onSetOrigin,
  onSuggestFromSaved,
  onSuggestByInterests,
  onSuggestSmartRoute,
  getSegmentTransport,
  userLocation,
  mapboxToken,
}) => {
  const [showFilters, setShowFilters] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [showWatchLater, setShowWatchLater] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [showOriginEdit, setShowOriginEdit] = useState(false);
  const [showDestination, setShowDestination] = useState(false);
  const [scheduleDay, setScheduleDay] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  const { getDragHandlers, getItemStyle, isDragging } = useDragReorder(
    route?.stops.length ?? 0,
    onReorderStops,
  );

  const handleSave = () => {
    const saved = onSaveRoute();
    if (saved) toast.success('Route saved!');
    else toast.error('Add at least one stop to save');
  };

  const handleOpenMaps = () => onOpenInGoogleMaps(userLocation?.lat, userLocation?.lng);

  const handleStartEdit = () => {
    setEditName(route?.name || '');
    setIsEditing(true);
  };

  const handleFinishEdit = () => {
    if (editName.trim()) onRenameRoute(editName.trim());
    setIsEditing(false);
  };

  const handleOriginSelect = (loc: LocationSelection) => {
    onSetOrigin?.({ address: loc.address, latitude: loc.latitude, longitude: loc.longitude });
    setShowOriginEdit(false);
    toast.success('Starting location set');
  };

  const handleUseCurrentLocation = () => {
    onSetOrigin?.(null);
    setShowOriginEdit(false);
    toast.success('Using current GPS location');
  };

  const handleDestinationSelect = (loc: LocationSelection) => {
    onSetDestination?.({ address: loc.address, latitude: loc.latitude, longitude: loc.longitude });
    setShowDestination(false);
    toast.success('Destination set – suggestions will route toward it');
  };

  const handleSetSchedule = () => {
    if (!scheduleDay && !scheduleTime) {
      onSetSchedule?.(null);
      return;
    }
    onSetSchedule?.({ day: scheduleDay || 'everyday', time: scheduleTime || '09:00' });
    toast.success('Schedule saved');
  };

  const cycleSegmentTransport = (fromIdx: number, toIdx: number) => {
    const current = getSegmentTransport?.(fromIdx, toIdx) || route?.transportMode || 'walking';
    const idx = SEGMENT_MODES.indexOf(current);
    const next = SEGMENT_MODES[(idx + 1) % SEGMENT_MODES.length];
    onSetSegmentTransport?.(fromIdx, toIdx, next);
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
                ? `${route.stops.length} stops · ${route.totalReward} coins${route.smartLabel ? ` · ${route.smartLabel}` : ''}`
                : 'Plan your earning route'}
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="h-[calc(100%-8rem)] pb-4">
            <div className="space-y-4 pr-2">
              {/* Transport Mode Selector (5 modes) */}
              {route && (
                <div className="flex gap-1.5">
                  {TRANSPORT_MODES.map((mode) => {
                    const Icon = mode.icon;
                    return (
                      <button
                        key={mode.id}
                        onClick={() => onSetTransportMode(mode.id)}
                        className={cn(
                          'flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 transition-all',
                          route.transportMode === mode.id
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/50'
                        )}
                      >
                        <Icon className="w-4 h-4" />
                        <span className="text-[10px] font-medium">{mode.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Quick Actions */}
              {route && (
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => setShowFilters(true)} className="gap-2">
                    <Filter className="w-4 h-4" /> Filters
                  </Button>
                  <Button
                    variant="outline" size="sm" onClick={onToggleCommute}
                    className={cn('gap-2', route.isCommuteRoute && 'border-primary text-primary bg-primary/5')}
                  >
                    <CalendarCheck className="w-4 h-4" />
                    {route.isCommuteRoute ? 'Commute ✓' : 'Commute'}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => onSuggestRoute()} className="gap-2">
                    <Sparkles className="w-4 h-4" /> Re-suggest
                  </Button>
                </div>
              )}

              {/* Destination & Schedule Section */}
              {route && (
                <div className="space-y-2">
                  {/* Origin – editable with autocomplete */}
                  {showOriginEdit && mapboxToken ? (
                    <div className="space-y-2 p-3 rounded-xl bg-primary/5 border border-primary/20">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Starting Point</span>
                        <button onClick={() => setShowOriginEdit(false)} className="p-1 hover:bg-muted rounded-full">
                          <X className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      </div>
                      <LocationAutocomplete
                        mapboxToken={mapboxToken}
                        placeholder="Search starting address..."
                        value={route.origin?.address?.split(',')[0] || ''}
                        proximity={userLocation}
                        onSelect={handleOriginSelect}
                        showCurrentLocation
                        onUseCurrentLocation={handleUseCurrentLocation}
                        storageKey="route-origin-recent"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowOriginEdit(true)}
                      className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20 w-full text-left hover:border-primary/40 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                        <Navigation className="w-4 h-4 text-primary-foreground" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium">
                          {route.origin?.address?.split(',')[0] || 'Your Location'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {route.origin ? 'Tap to change' : 'Tap to set custom start'}
                        </div>
                      </div>
                      <Edit2 className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  )}

                  {/* Destination – autocomplete */}
                  {showDestination && mapboxToken ? (
                    <div className="space-y-2 p-3 rounded-xl border border-dashed border-border">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">Destination</span>
                        <button onClick={() => { setShowDestination(false); }} className="p-1 hover:bg-muted rounded-full">
                          <X className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      </div>
                      <LocationAutocomplete
                        mapboxToken={mapboxToken}
                        placeholder="Where are you heading?"
                        value={route.destination?.address?.split(',')[0] || ''}
                        proximity={userLocation}
                        onSelect={handleDestinationSelect}
                        onClear={() => onSetDestination?.(null)}
                        storageKey="route-dest-recent"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowDestination(true)}
                      className="flex items-center gap-3 p-3 rounded-xl border border-dashed border-border hover:border-primary/50 transition-colors w-full"
                    >
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <MapPinned className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="text-sm font-medium">
                          {route.destination?.address?.split(',')[0] || 'Set Destination'}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {route.destination ? 'Tap to change' : 'Route suggestions will head this way'}
                        </div>
                      </div>
                    </button>
                  )}

                  {/* Schedule Picker */}
                  {route.isCommuteRoute && (
                    <div className="p-3 rounded-xl border border-border/50 bg-card space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Clock className="w-4 h-4 text-muted-foreground" />
                        Schedule
                      </div>
                      <div className="flex gap-1 flex-wrap">
                        {DAYS.map(d => (
                          <button
                            key={d.id}
                            onClick={() => { setScheduleDay(d.id); handleSetSchedule(); }}
                            className={cn(
                              'px-2.5 py-1 rounded-full text-xs font-medium transition-all border',
                              (route.schedule?.day === d.id || scheduleDay === d.id)
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border bg-muted/30 text-muted-foreground'
                            )}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                      <Input
                        type="time"
                        value={route.schedule?.time || scheduleTime || '09:00'}
                        onChange={e => { setScheduleTime(e.target.value); handleSetSchedule(); }}
                        className="h-8 w-32"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Connection line before stops */}
              {route && route.stops.length > 0 && (
                <div className="flex justify-center">
                  <div className="w-0.5 h-4 bg-border" />
                </div>
              )}

              {/* Stops List with Drag & Drop */}
              {route && route.stops.length > 0 ? (
                <div className="space-y-0 relative">
                  {route.stops.map((stop, index) => (
                    <React.Fragment key={stop.id}>
                      <div
                        className={cn(
                          'flex items-center gap-2 p-3 rounded-xl bg-card border border-border/50 group relative',
                          isDragging && 'select-none'
                        )}
                        style={getItemStyle(index)}
                      >
                        {/* Drag Handle */}
                        <div
                          className="cursor-grab active:cursor-grabbing touch-none p-1 -ml-1"
                          {...getDragHandlers(index)}
                        >
                          <GripVertical className="w-4 h-4 text-muted-foreground" />
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

                      {/* Segment Transport Selector */}
                      {index < route.stops.length - 1 && (
                        <div className="flex justify-center py-0.5">
                          <button
                            onClick={() => cycleSegmentTransport(index, index + 1)}
                            className="flex items-center gap-1 px-2 py-1 rounded-full border border-border/50 bg-muted/30 hover:bg-primary/10 hover:border-primary/30 transition-all"
                            title="Tap to change transport for this segment"
                          >
                            {(() => {
                              const mode = getSegmentTransport?.(index, index + 1) || route.transportMode;
                              const Icon = getTransportIcon(mode);
                              return (
                                <>
                                  <Icon className="w-3 h-3 text-muted-foreground" />
                                  <div className="w-0.5 h-3 bg-border" />
                                </>
                              );
                            })()}
                          </button>
                        </div>
                      )}
                    </React.Fragment>
                  ))}

                  {/* Destination marker at end */}
                  {route.destination && (
                    <>
                      <div className="flex justify-center py-0.5">
                        <div className="w-0.5 h-3 bg-border" />
                      </div>
                      <div className="flex items-center gap-3 p-3 rounded-xl bg-accent/10 border border-accent/20">
                        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
                          <MapPinned className="w-4 h-4 text-accent-foreground" />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium">{route.destination.address}</div>
                          <div className="text-xs text-muted-foreground">Destination</div>
                        </div>
                      </div>
                    </>
                  )}

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
                    {route.smartLabel && (
                      <div className="mt-2 pt-2 border-t border-primary/10 text-center">
                        <span className="text-xs text-muted-foreground">✨ {route.smartLabel}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : route ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">No stops yet</p>
                  <p className="text-sm mt-1">Tap promotions on the map to add them</p>
                  <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={() => onSuggestRoute()}>
                    <Sparkles className="w-4 h-4" /> Generate Suggested Route
                  </Button>
                </div>
              ) : null}

              {/* ─── Suggestion Cards (when no route is active) ─── */}
              {!route && (
                <div className="space-y-3">
                  {/* Smart Route – primary option */}
                  <button
                    onClick={() => onSuggestSmartRoute?.()}
                    className="w-full rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 p-4 text-left hover:border-primary/40 transition-all"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Brain className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm">Smart Route</h3>
                        <p className="text-xs text-muted-foreground">AI-designed route based on your behavior</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Considers time of day, your interests, saved promos, and lifestyle patterns
                    </p>
                  </button>

                  {/* Platform Suggested Route */}
                  <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm">Platform Suggested</h3>
                        <p className="text-xs text-muted-foreground">Choose an optimization strategy</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => onSuggestRoute('more_earnings')}
                        className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border/50 bg-muted/20 hover:border-primary/50 hover:bg-primary/5 transition-all"
                      >
                        <TrendingUp className="w-5 h-5 text-primary" />
                        <span className="text-xs font-medium">Max Earnings</span>
                      </button>
                      <button
                        onClick={() => onSuggestRoute('faster')}
                        className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border/50 bg-muted/20 hover:border-primary/50 hover:bg-primary/5 transition-all"
                      >
                        <Timer className="w-5 h-5 text-primary" />
                        <span className="text-xs font-medium">Fastest</span>
                      </button>
                      <button
                        onClick={() => onSuggestRoute('effective')}
                        className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border/50 bg-muted/20 hover:border-primary/50 hover:bg-primary/5 transition-all"
                      >
                        <Zap className="w-5 h-5 text-primary" />
                        <span className="text-xs font-medium">Most Effective</span>
                      </button>
                    </div>
                  </div>

                  {/* Build from Saved / Interests */}
                  <div className="grid grid-cols-2 gap-2">
                    {watchLater.length > 0 && (
                      <button
                        onClick={() => onSuggestFromSaved?.()}
                        className="flex items-center gap-2 p-3 rounded-xl border border-border/50 bg-card hover:border-primary/50 transition-all"
                      >
                        <Bookmark className="w-4 h-4 text-primary" />
                        <div className="text-left">
                          <div className="text-xs font-medium">From Saved</div>
                          <div className="text-[10px] text-muted-foreground">{watchLater.length} items</div>
                        </div>
                      </button>
                    )}
                    <button
                      onClick={() => onSuggestByInterests?.()}
                      className="flex items-center gap-2 p-3 rounded-xl border border-border/50 bg-card hover:border-primary/50 transition-all"
                    >
                      <Heart className="w-4 h-4 text-primary" />
                      <div className="text-left">
                        <div className="text-xs font-medium">By Interests</div>
                        <div className="text-[10px] text-muted-foreground">Your favorites</div>
                      </div>
                    </button>
                  </div>

                  <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => onStartRoute?.()}>
                    <Route className="w-4 h-4" /> Start New Route Manually
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
                      <Save className="w-4 h-4" /> Saved Routes ({savedRoutes.length})
                    </span>
                    {showSaved ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {showSaved && savedRoutes.map((r) => (
                    <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card">
                      <Route className="w-5 h-5 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{r.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.stops.length} stops · {r.totalReward} coins{r.isCommuteRoute && ' · Daily'}
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => onLoadRoute(r.id)}>
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
                    <Bookmark className="w-4 h-4" /> Watch Later ({watchLater.length})
                  </span>
                  {showWatchLater ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showWatchLater && watchLater.map((item) => (
                  <div key={item.promotionId} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card">
                    <CategoryIcon category={item.category || ''} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{item.businessName}</div>
                      <div className="text-xs text-muted-foreground">+{item.rewardAmount} {item.rewardType}</div>
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
                <Save className="w-4 h-4" /> Save
              </Button>
              <Button size="sm" onClick={handleOpenMaps} disabled={route.stops.length === 0} className="gap-1 flex-1">
                <ExternalLink className="w-4 h-4" /> Open in Maps
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
