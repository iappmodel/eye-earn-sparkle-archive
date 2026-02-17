import { supabase } from '@/integrations/supabase/client';
import type { PromoRoute, RouteStop, RouteFilters, RouteDestination, RouteSchedule, RouteOrigin } from '@/hooks/usePromoRoute';

/** DB row: promo_routes */
interface PromoRouteRow {
  id: string;
  user_id: string;
  name: string;
  transport_mode: string;
  filters: Record<string, unknown>;
  is_commute_route: boolean;
  origin: RouteOrigin | null;
  destination: RouteDestination | null;
  schedule: RouteSchedule | null;
  segment_transport: Record<string, string>;
  smart_label: string | null;
  total_reward: number;
  estimated_time: number | null;
  estimated_distance: number | null;
  created_at: string;
  updated_at: string;
}

/** DB row: promo_route_stops */
interface PromoRouteStopRow {
  id: string;
  route_id: string;
  promotion_id: string;
  business_name: string;
  latitude: number;
  longitude: number;
  address: string | null;
  category: string | null;
  reward_type: string;
  reward_amount: number;
  required_action: string | null;
  order: number;
  from_feed: boolean | null;
  content_id: string | null;
}

/** DB row: promo_watch_later payload matches RouteStop (without order) */
interface PromoWatchLaterRow {
  id: string;
  user_id: string;
  promotion_id: string;
  payload: Record<string, unknown>;
  created_at: string;
}

function stopRowToRouteStop(row: PromoRouteStopRow): RouteStop {
  return {
    id: row.id,
    promotionId: row.promotion_id,
    businessName: row.business_name,
    latitude: row.latitude,
    longitude: row.longitude,
    address: row.address ?? undefined,
    category: row.category ?? undefined,
    rewardType: row.reward_type as RouteStop['rewardType'],
    rewardAmount: row.reward_amount,
    requiredAction: row.required_action ?? undefined,
    order: row.order,
    fromFeed: row.from_feed ?? undefined,
    contentId: row.content_id ?? undefined,
  };
}

function routeStopToPayload(stop: RouteStop): Record<string, unknown> {
  return {
    promotionId: stop.promotionId,
    businessName: stop.businessName,
    latitude: stop.latitude,
    longitude: stop.longitude,
    address: stop.address,
    category: stop.category,
    rewardType: stop.rewardType,
    rewardAmount: stop.rewardAmount,
    requiredAction: stop.requiredAction,
    fromFeed: stop.fromFeed,
    contentId: stop.contentId,
  };
}

function payloadToRouteStop(payload: Record<string, unknown>, order: number): RouteStop {
  return {
    id: `stop-${(payload.promotionId as string) ?? ''}-${order}`,
    promotionId: (payload.promotionId as string) ?? '',
    businessName: (payload.businessName as string) ?? '',
    latitude: (payload.latitude as number) ?? 0,
    longitude: (payload.longitude as number) ?? 0,
    address: (payload.address as string) ?? undefined,
    category: (payload.category as string) ?? undefined,
    rewardType: (payload.rewardType as RouteStop['rewardType']) ?? 'vicoin',
    rewardAmount: (payload.rewardAmount as number) ?? 0,
    requiredAction: (payload.requiredAction as string) ?? undefined,
    order,
    fromFeed: (payload.fromFeed as boolean) ?? undefined,
    contentId: (payload.contentId as string) ?? undefined,
  };
}

function routeRowToPromoRoute(row: PromoRouteRow, stops: RouteStop[]): PromoRoute {
  return {
    id: row.id,
    name: row.name,
    stops,
    transportMode: row.transport_mode as PromoRoute['transportMode'],
    filters: (row.filters as RouteFilters) ?? {},
    isCommuteRoute: row.is_commute_route,
    createdAt: row.created_at,
    totalReward: row.total_reward,
    estimatedTime: row.estimated_time ?? undefined,
    estimatedDistance: row.estimated_distance ?? undefined,
    destination: row.destination ?? undefined,
    schedule: row.schedule ?? undefined,
    segmentTransport: row.segment_transport ?? {},
    smartLabel: row.smart_label ?? undefined,
    origin: row.origin ?? undefined,
  };
}

function promoRouteToRow(route: PromoRoute, userId: string): Omit<PromoRouteRow, 'created_at' | 'updated_at'> {
  return {
    id: route.id,
    user_id: userId,
    name: route.name,
    transport_mode: route.transportMode,
    filters: route.filters as Record<string, unknown>,
    is_commute_route: route.isCommuteRoute,
    origin: route.origin ?? null,
    destination: route.destination ?? null,
    schedule: route.schedule ?? null,
    segment_transport: route.segmentTransport ?? {},
    smart_label: route.smartLabel ?? null,
    total_reward: route.totalReward,
    estimated_time: route.estimatedTime ?? null,
    estimated_distance: route.estimatedDistance ?? null,
  };
}

/**
 * Fetch all saved routes for a user from Supabase (with stops).
 */
export async function fetchUserRoutes(userId: string): Promise<PromoRoute[]> {
  const { data: routes, error: routesError } = await supabase
    .from('promo_routes')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (routesError) throw routesError;
  if (!routes?.length) return [];

  const routeIds = routes.map((r: PromoRouteRow) => r.id);
  const { data: stops, error: stopsError } = await supabase
    .from('promo_route_stops')
    .select('*')
    .in('route_id', routeIds)
    .order('order', { ascending: true });

  if (stopsError) throw stopsError;
  const stopsByRoute = new Map<string, RouteStop[]>();
  for (const s of stops || []) {
    const row = s as unknown as PromoRouteStopRow;
    const list = stopsByRoute.get(row.route_id) ?? [];
    list.push(stopRowToRouteStop(row));
    stopsByRoute.set(row.route_id, list);
  }

  return (routes as PromoRouteRow[]).map((r) =>
    routeRowToPromoRoute(r, stopsByRoute.get(r.id) ?? []),
  );
}

/**
 * Save a route to Supabase (upsert route + replace stops).
 * Returns the saved route with server id and timestamps.
 */
export async function saveRouteToServer(userId: string, route: PromoRoute): Promise<PromoRoute> {
  const isExisting = route.id.startsWith('route-') === false; // uuid-like from server
  const row = promoRouteToRow(route, userId);

  if (isExisting) {
    const { id: _id, ...updatePayload } = row;
    const { error: updateError } = await supabase.from('promo_routes').update(updatePayload).eq('id', route.id).eq('user_id', userId);
    if (updateError) throw updateError;
    const { error: deleteError } = await supabase.from('promo_route_stops').delete().eq('route_id', route.id);
    if (deleteError) throw deleteError;
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from('promo_routes')
      .insert({ ...row, id: undefined })
      .select('id, created_at, updated_at')
      .single();
    if (insertError) throw insertError;
    row.id = inserted.id;
    route.id = inserted.id;
    route.createdAt = inserted.created_at;
  }

  if (route.stops.length > 0) {
    const stopRows = route.stops.map((s, i) => ({
      route_id: row.id,
      promotion_id: s.promotionId,
      business_name: s.businessName,
      latitude: s.latitude,
      longitude: s.longitude,
      address: s.address ?? null,
      category: s.category ?? null,
      reward_type: s.rewardType,
      reward_amount: s.rewardAmount,
      required_action: s.requiredAction ?? null,
      order: i,
      from_feed: s.fromFeed ?? null,
      content_id: s.contentId ?? null,
    }));
    const { error: stopsError } = await supabase.from('promo_route_stops').insert(stopRows);
    if (stopsError) throw stopsError;
  }

  const saved: PromoRoute = {
    ...route,
    id: row.id,
    createdAt: (route as { createdAt?: string }).createdAt ?? route.createdAt,
  };
  return saved;
}

/**
 * Delete a route from Supabase (stops are CASCADE deleted).
 */
export async function deleteRouteFromServer(userId: string, routeId: string): Promise<void> {
  const { error } = await supabase.from('promo_routes').delete().eq('id', routeId).eq('user_id', userId);
  if (error) throw error;
}

/**
 * Fetch watch-later list for user.
 */
export async function fetchWatchLater(userId: string): Promise<RouteStop[]> {
  const { data, error } = await supabase
    .from('promo_watch_later')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row: PromoWatchLaterRow, i: number) =>
    payloadToRouteStop(row.payload as Record<string, unknown>, i),
  );
}

/**
 * Replace full watch-later list on server (upsert by promotion_id).
 */
export async function syncWatchLaterToServer(userId: string, items: RouteStop[]): Promise<void> {
  const { error: deleteError } = await supabase.from('promo_watch_later').delete().eq('user_id', userId);
  if (deleteError) throw deleteError;
  if (items.length === 0) return;

  const rows = items.map((s) => ({
    user_id: userId,
    promotion_id: s.promotionId,
    payload: routeStopToPayload(s),
  }));
  const { error: insertError } = await supabase.from('promo_watch_later').upsert(rows, {
    onConflict: 'user_id,promotion_id',
    ignoreDuplicates: false,
  });
  if (insertError) throw insertError;
}

/**
 * Add one item to watch later on server.
 */
export async function addWatchLaterOnServer(userId: string, stop: Omit<RouteStop, 'order'>): Promise<void> {
  const payload = routeStopToPayload({ ...stop, order: 0 });
  const { error } = await supabase.from('promo_watch_later').upsert(
    { user_id: userId, promotion_id: stop.promotionId, payload },
    { onConflict: 'user_id,promotion_id' },
  );
  if (error) throw error;
}

/**
 * Remove one item from watch later on server.
 */
export async function removeWatchLaterOnServer(userId: string, promotionId: string): Promise<void> {
  const { error } = await supabase
    .from('promo_watch_later')
    .delete()
    .eq('user_id', userId)
    .eq('promotion_id', promotionId);
  if (error) throw error;
}
