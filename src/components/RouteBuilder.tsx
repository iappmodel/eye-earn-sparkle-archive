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
  Copy, Play, Cloud, CloudOff, Share2, Upload, Download, ArrowDownUp, Loader2,
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
  onSuggestRoute: (optimization?: string) => void | Promise<void>;
  onLoadRoute: (routeId: string) => void;
  onDeleteSavedRoute: (routeId: string) => void;
  onRemoveFromWatchLater: (promotionId: string) => void;
  onStartRoute?: () => void;
  onSetDestination?: (dest: RouteDestination | null) => void;
  onSetSchedule?: (schedule: RouteSchedule | null) => void;
  onSetSegmentTransport?: (fromIdx: number, toIdx: number, mode: TransportMode) => void;
  onSetOrigin?: (origin: RouteOrigin | null) => void;
  onSuggestFromSaved?: () => void | Promise<void>;
  onSuggestByInterests?: () => void | Promise<void>;
  onSuggestSmartRoute?: () => void | Promise<void>;
  onDuplicateRoute?: (routeId: string) => void;
  onOpenSavedRouteInMaps?: (routeId: string) => void;
  /** Reorder stops by nearest-neighbor to minimize distance */
  onOptimizeOrder?: (userLat?: number, userLng?: number) => void;
  getSegmentTransport?: (fromIdx: number, toIdx: number) => TransportMode;
  userLocation?: { lat: number; lng: number } | null;
  mapboxToken?: string | null;
  /** True while a suggestion (Smart / From Saved / etc.) is loading */
  suggestLoading?: boolean;
  /** True while resolving user location (e.g. when opened from feed) */
  locationLoading?: boolean;
  /** Sync status (when user is logged in) */
  routesSyncing?: boolean;
  lastRoutesSyncAt?: number | null;
  activeRouteEstimate?: { estimatedDistanceKm: number; estimatedTimeMinutes: number };
  isCloudSynced?: boolean;
  /** Add an imported route to saved routes */
  onAddSavedRoute?: (route: PromoRoute) => void;
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
  onDuplicateRoute,
  onOpenSavedRouteInMaps,
  onOptimizeOrder,
  getSegmentTransport,
  userLocation,
  mapboxToken,
  suggestLoading = false,
  locationLoading = false,
  routesSyncing = false,
  lastRoutesSyncAt = null,
  activeRouteEstimate,
  isCloudSynced = false,
  onAddSavedRoute,
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
  const [showImportPaste, setShowImportPaste] = useState(false);
  const [importJson, setImportJson] = useState('');

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

  const handleExportRoute = (r: PromoRoute) => {
    const json = JSON.stringify(r, null, 2);
    navigator.clipboard.writeText(json).then(() => toast.success('Route copied to clipboard'));
  };

  const handleShareRoute = () => {
    if (!route) return;
    const json = JSON.stringify(route, null, 2);
    navigator.clipboard.writeText(json).then(() =>
      toast.success('Route copied. Share this with others to import in Route Builder.')
    );
  };

  const handleCopyShareableLink = () => {
    if (!route) return;
    try {
      const encoded = encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(route)))));
      const url = `${window.location.origin}${window.location.pathname || '/'}?route=${encoded}`;
      navigator.clipboard.writeText(url).then(() =>
        toast.success('Link copied. Anyone who opens it can import this route.')
      );
    } catch {
      toast.error('Could not create share link');
    }
  };

  const handleImportSubmit = () => {
    try {
      const parsed = JSON.parse(importJson) as PromoRoute;
      if (!parsed?.name || !Array.isArray(parsed.stops)) {
        toast.error('Invalid route: needs name and stops array');
        return;
      }
      const routeId = parsed.id && !String(parsed.id).startsWith('route-') ? parsed.id : `route-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const normalized: PromoRoute = {
        ...parsed,
        id: routeId,
        stops: (parsed.stops || []).map((s: RouteStop, i: number) => ({ ...s, order: i })),
        filters: parsed.filters || defaultRouteFilters,
        segmentTransport: parsed.segmentTransport || {},
        totalReward: (parsed.stops || []).reduce((sum: number, st: RouteStop) => sum + (st.rewardAmount ?? 0), 0),
      };
      onAddSavedRoute?.(normalized);
      setImportJson('');
      setShowImportPaste(false);
      toast.success('Route imported');
    } catch {
      toast.error('Invalid JSON');
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
            <SheetDescription className="flex flex-col gap-1">
              <span>
                {route
                  ? `${route.stops.length} stops · ${route.totalReward} coins${route.smartLabel ? ` · ${route.smartLabel}` : ''}`
                  : 'Plan your earning route'}
              </span>
              {locationLoading && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Getting your location…
                </span>
              )}
              {suggestLoading && (
                <span className="flex items-center gap-1.5 text-xs text-primary">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Building route…
                </span>
              )}
              {isCloudSynced && !locationLoading && !suggestLoading && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {routesSyncing ? (
                    <>
                      <Cloud className="w-3.5 h-3.5 animate-pulse" />
                      Syncing…
                    </>
                  ) : lastRoutesSyncAt ? (
                    <>
                      <Cloud className="w-3.5 h-3.5 text-primary" />
                      Synced to cloud
                    </>
                  ) : (
                    <>
                      <CloudOff className="w-3.5 h-3.5" />
                      Local only
                    </>
                  )}
                </span>
              )}
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
                  {route.stops.length >= 2 && onOptimizeOrder && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onOptimizeOrder(userLocation?.lat, userLocation?.lng)}
                      className="gap-2"
                      title="Reorder stops by nearest distance"
                    >
                      <ArrowDownUp className="w-4 h-4" /> Optimize order
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onSuggestRoute()}
                    className="gap-2"
                    disabled={suggestLoading}
                  >
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
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
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
                          {(activeRouteEstimate?.estimatedTimeMinutes ?? route.estimatedTime) != null
                            ? `${activeRouteEstimate?.estimatedTimeMinutes ?? route.estimatedTime}m`
                            : '~'}
                        </div>
                        <div className="text-xs text-muted-foreground">Est. Time</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-primary">
                          {(activeRouteEstimate?.estimatedDistanceKm ?? route.estimatedDistance) != null
                            ? `${activeRouteEstimate?.estimatedDistanceKm ?? route.estimatedDistance} km`
                            : '~'}
                        </div>
                        <div className="text-xs text-muted-foreground">Distance</div>
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
                <div className="text-center py-8 px-4">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted/50 flex items-center justify-center">
                    <MapPin className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="font-semibold text-foreground">No stops yet</p>
                  <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
                    Get a suggested route below, or open the Discovery Map and tap promos to add them.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 gap-2"
                    onClick={() => onSuggestRoute()}
                    disabled={suggestLoading}
                  >
                    {suggestLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Generate Suggested Route
                  </Button>
                </div>
              ) : null}

              {/* ─── Suggestion Cards (when no route is active) ─── */}
              {!route && (
                <div className="space-y-3">
                  {locationLoading && (
                    <div className="flex items-center gap-3 p-4 rounded-2xl border border-border/50 bg-muted/20">
                      <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      <span className="text-sm text-muted-foreground">Getting your location for suggestions…</span>
                    </div>
                  )}
                  {/* Smart Route – primary option */}
                  <button
                    onClick={() => onSuggestSmartRoute?.()}
                    disabled={suggestLoading || locationLoading}
                    className={cn(
                      'w-full rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 p-4 text-left transition-all',
                      suggestLoading || locationLoading ? 'opacity-70 cursor-not-allowed' : 'hover:border-primary/40'
                    )}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        {suggestLoading ? <Loader2 className="w-5 h-5 text-primary animate-spin" /> : <Brain className="w-5 h-5 text-primary" />}
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
                        disabled={suggestLoading || locationLoading}
                        className={cn(
                          'flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border/50 bg-muted/20 transition-all',
                          suggestLoading || locationLoading ? 'opacity-60 cursor-not-allowed' : 'hover:border-primary/50 hover:bg-primary/5'
                        )}
                      >
                        <TrendingUp className="w-5 h-5 text-primary" />
                        <span className="text-xs font-medium">Max Earnings</span>
                      </button>
                      <button
                        onClick={() => onSuggestRoute('faster')}
                        disabled={suggestLoading || locationLoading}
                        className={cn(
                          'flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border/50 bg-muted/20 transition-all',
                          suggestLoading || locationLoading ? 'opacity-60 cursor-not-allowed' : 'hover:border-primary/50 hover:bg-primary/5'
                        )}
                      >
                        <Timer className="w-5 h-5 text-primary" />
                        <span className="text-xs font-medium">Fastest</span>
                      </button>
                      <button
                        onClick={() => onSuggestRoute('effective')}
                        disabled={suggestLoading || locationLoading}
                        className={cn(
                          'flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border/50 bg-muted/20 transition-all',
                          suggestLoading || locationLoading ? 'opacity-60 cursor-not-allowed' : 'hover:border-primary/50 hover:bg-primary/5'
                        )}
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
                        disabled={suggestLoading}
                        className={cn(
                          'flex items-center gap-2 p-3 rounded-xl border border-border/50 bg-card transition-all',
                          suggestLoading ? 'opacity-60 cursor-not-allowed' : 'hover:border-primary/50'
                        )}
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
                      disabled={suggestLoading || locationLoading}
                      className={cn(
                        'flex items-center gap-2 p-3 rounded-xl border border-border/50 bg-card transition-all',
                        suggestLoading || locationLoading ? 'opacity-60 cursor-not-allowed' : 'hover:border-primary/50'
                      )}
                    >
                      <Heart className="w-4 h-4 text-primary" />
                      <div className="text-left">
                        <div className="text-xs font-medium">By Interests</div>
                        <div className="text-[10px] text-muted-foreground">Your favorites</div>
                      </div>
                    </button>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => onStartRoute?.()}
                  >
                    <Route className="w-4 h-4" /> Start New Route Manually
                  </Button>
                </div>
              )}

              {/* Saved Routes Section */}
              {!route && (
                <div className="space-y-3 mt-2">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      onClick={() => setShowSaved(!showSaved)}
                      className="flex-1 flex items-center justify-between text-left"
                    >
                      <span className="text-sm font-semibold flex items-center gap-2">
                        <Save className="w-4 h-4" /> Saved Routes ({savedRoutes.length})
                      </span>
                      {showSaved ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {onAddSavedRoute && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 shrink-0"
                        onClick={() => setShowImportPaste(!showImportPaste)}
                      >
                        <Upload className="w-3.5 h-3.5" /> Import
                      </Button>
                    )}
                  </div>
                  {showImportPaste && onAddSavedRoute && (
                    <div className="p-3 rounded-xl border border-border space-y-2">
                      <p className="text-xs text-muted-foreground">Paste exported route JSON below</p>
                      <textarea
                        value={importJson}
                        onChange={(e) => setImportJson(e.target.value)}
                        placeholder='{"name":"My Route","stops":[...],...}'
                        className="w-full min-h-[80px] rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleImportSubmit} disabled={!importJson.trim()}>
                          Import route
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setShowImportPaste(false); setImportJson(''); }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                  {showSaved && savedRoutes.map((r) => {
                    const TransportIcon = getTransportIcon(r.transportMode);
                    const savedAgo = (() => {
                      const diff = Date.now() - new Date(r.createdAt).getTime();
                      const mins = Math.floor(diff / 60000);
                      if (mins < 60) return `${mins}m ago`;
                      const hrs = Math.floor(mins / 60);
                      if (hrs < 24) return `${hrs}h ago`;
                      const days = Math.floor(hrs / 24);
                      return `${days}d ago`;
                    })();
                    return (
                      <div key={r.id} className="p-3 rounded-xl border border-border/50 bg-card space-y-2">
                        {/* Top row: icon + name + actions */}
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                            <TransportIcon className="w-4.5 h-4.5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{r.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {r.stops.length} stops · {r.totalReward} coins
                              {r.isCommuteRoute && r.schedule ? ` · ${r.schedule.day === 'everyday' ? 'Daily' : r.schedule.day} at ${r.schedule.time}` : r.isCommuteRoute ? ' · Daily' : ''}
                            </div>
                            {r.destination && (
                              <div className="text-xs text-muted-foreground truncate">
                                → {r.destination.address.split(',')[0]}
                              </div>
                            )}
                            <div className="text-[10px] text-muted-foreground/60 mt-0.5">Saved {savedAgo}</div>
                          </div>
                        </div>
                        {/* Action buttons row */}
                        <div className="flex gap-1.5 pt-1 border-t border-border/30">
                          <Button
                            size="sm" variant="default"
                            className="flex-1 gap-1.5 h-8 text-xs"
                            onClick={() => { onLoadRoute(r.id); onOpenInGoogleMaps(userLocation?.lat, userLocation?.lng); }}
                          >
                            <Play className="w-3.5 h-3.5" /> Use
                          </Button>
                          <Button
                            size="sm" variant="outline"
                            className="h-8 px-2.5"
                            title="Open in Google Maps"
                            onClick={() => onOpenSavedRouteInMaps?.(r.id)}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm" variant="outline"
                            className="h-8 px-2.5"
                            title="Export route"
                            onClick={() => { handleExportRoute(r); }}
                          >
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm" variant="outline"
                            className="h-8 px-2.5"
                            title="Duplicate route"
                            onClick={() => { onDuplicateRoute?.(r.id); toast.success('Route duplicated'); }}
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm" variant="ghost"
                            className="h-8 px-2.5"
                            title="Edit route"
                            onClick={() => onLoadRoute(r.id)}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="sm" variant="ghost"
                            className="text-destructive h-8 px-2.5"
                            title="Delete route"
                            onClick={() => { onDeleteSavedRoute(r.id); toast.success('Route deleted'); }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
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
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-background border-t border-border flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={onDiscardRoute} className="gap-1" title="Discard route">
                <Trash2 className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExportRoute(route)} className="gap-1" title="Copy as JSON">
                <Download className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleShareRoute} className="gap-1" title="Copy JSON to share">
                <Share2 className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleCopyShareableLink} className="gap-1" title="Copy shareable link">
                <Copy className="w-4 h-4" />
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
