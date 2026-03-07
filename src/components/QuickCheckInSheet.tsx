/**
 * QuickCheckInSheet – real location check-in: GPS + verify-checkin.
 * If user is within 100m of a promotion, checks in there for full rewards;
 * otherwise performs a standalone check-in (one per 24h, small reward).
 */
import React, { useState, useCallback } from 'react';
import { X, MapPin, CheckCircle2, Loader2, AlertCircle, Coins, Navigation2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { isDemoMode } from '@/lib/appMode';
import { useAuth } from '@/contexts/AuthContext';
import { useCheckInStatus } from '@/hooks/useCheckInStatus';
import { notificationSoundService } from '@/services/notificationSound.service';
import { ConfettiCelebration } from './ConfettiCelebration';

const MAX_CHECKIN_METERS = 100;
const NEARBY_RADIUS_KM = 0.2; // 200m to fetch candidates
const haversineMeters = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

interface QuickCheckInSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenMap?: () => void;
  onSuccess?: () => void;
  /** When true, map was opened with this sheet (e.g. from remote check-in); show contextual copy. */
  mapAlreadyOpen?: boolean;
  /** When true, sheet was opened from remote control / gesture combo. */
  openedFromRemote?: boolean;
}

export const QuickCheckInSheet: React.FC<QuickCheckInSheetProps> = ({
  isOpen,
  onClose,
  onOpenMap,
  onSuccess,
  mapAlreadyOpen = false,
  openedFromRemote = false,
}) => {
  const { user } = useAuth();
  const status = useCheckInStatus(null, { enabled: isOpen && !!user?.id }); // standalone cooldown
  const [phase, setPhase] = useState<'idle' | 'locating' | 'verifying' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [rewardMessage, setRewardMessage] = useState<string>('');
  const [showConfetti, setShowConfetti] = useState(false);

  const performCheckIn = useCallback(async () => {
    if (!user) {
      toast.error('Please sign in to check in');
      return;
    }
    if (!status.canCheckIn) {
      toast.error('You already did a quick check-in today. Try again tomorrow!');
      return;
    }

    setPhase('locating');
    setErrorMessage('');

    if (isDemoMode) {
      setPhase('verifying');
      await new Promise((resolve) => setTimeout(resolve, 550));
      setPhase('success');
      setShowConfetti(true);
      setRewardMessage('You earned 15 vicoin for a simulated quick check-in.');
      notificationSoundService.playReward();
      if (navigator.vibrate) navigator.vibrate([20, 50, 20]);
      onSuccess?.();
      setTimeout(() => setShowConfetti(false), 3000);
      return;
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;
      setPhase('verifying');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      let promotion: {
        id: string;
        business_name: string;
        latitude: number;
        longitude: number;
        reward_amount: number;
        reward_type: string;
      } | null = null;

      const { data: nearbyData } = await supabase.functions.invoke('get-nearby-promotions', {
        body: {
          latitude: userLat,
          longitude: userLng,
          radiusKm: NEARBY_RADIUS_KM,
          sortBy: 'distance',
          limit: 10,
        },
      });

      const promotions = (nearbyData?.promotions ?? []) as Array<{
        id: string;
        business_name: string;
        latitude: number;
        longitude: number;
        reward_amount: number;
        reward_type: string;
        distance?: number;
      }>;
      const withinRange = promotions.find((p) => {
        const distM = p.distance != null ? p.distance * 1000 : haversineMeters(userLat, userLng, p.latitude, p.longitude);
        return distM <= MAX_CHECKIN_METERS;
      });
      if (withinRange) {
        promotion = {
          id: withinRange.id,
          business_name: withinRange.business_name,
          latitude: withinRange.latitude,
          longitude: withinRange.longitude,
          reward_amount: withinRange.reward_amount,
          reward_type: withinRange.reward_type,
        };
      }

      const body = promotion
        ? {
            promotionId: promotion.id,
            userLat,
            userLng,
            maxDistanceMeters: MAX_CHECKIN_METERS,
          }
        : {
            standalone: true,
            userLat,
            userLng,
            maxDistanceMeters: MAX_CHECKIN_METERS,
          };

      const idempotencyKey = crypto.randomUUID();
      const { data, error } = await supabase.functions.invoke('verify-checkin', {
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
        body,
      });

      if (error) throw error;

      if (data.success) {
        setPhase('success');
        setShowConfetti(true);
        const total = data.reward?.total ?? 0;
        const type = data.reward?.type ?? 'vicoin';
        setRewardMessage(promotion
          ? `You earned ${total} ${type} at ${promotion.business_name}!`
          : `You earned ${total} ${type} for checking in!`);
        notificationSoundService.playReward();
        if (navigator.vibrate) navigator.vibrate([20, 50, 20]);
        status.refetch();
        onSuccess?.();
        setTimeout(() => setShowConfetti(false), 3000);
      } else {
        setPhase('error');
        setErrorMessage(data.message || 'Check-in failed');
        toast.error('Check-in failed', { description: data.message });
        if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
      }
    } catch (err: unknown) {
      const e = err as { code?: number; message?: string };
      setPhase('error');
      if (e.code === 1) setErrorMessage('Location permission denied. Enable GPS in settings.');
      else if (e.code === 2) setErrorMessage('Unable to get location. Try again.');
      else if (e.code === 3) setErrorMessage('Location request timed out.');
      else setErrorMessage(e.message || 'Check-in failed');
      toast.error('Check-in failed', { description: errorMessage || 'Please try again' });
      if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
    }
  }, [user, status.canCheckIn, status.refetch, onSuccess]);

  const handleClose = useCallback(() => {
    setPhase('idle');
    setErrorMessage('');
    setRewardMessage('');
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  const isCooldown = !status.canCheckIn && phase !== 'success';

  return (
    <div className="fixed inset-0 z-[180] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="absolute inset-0" onClick={handleClose} aria-hidden />
      <div
        className="relative w-full max-w-md bg-gradient-to-b from-background to-muted/30 rounded-t-3xl overflow-hidden animate-slide-up border-t border-border shadow-2xl"
        role="dialog"
        aria-labelledby="quick-checkin-title"
        aria-describedby="quick-checkin-desc"
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 id="quick-checkin-title" className="text-lg font-bold text-foreground">
            Quick Check-In
          </h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-full hover:bg-muted/50 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        <div id="quick-checkin-desc" className="px-5 pb-8 space-y-4">
          {phase === 'idle' && (
            <>
              {openedFromRemote && (
                <p className="text-xs text-primary font-medium flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  Opened from remote control — check in below or use the map to find nearby spots.
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Check in at your current location. If you’re near a partner store, you’ll earn their reward; otherwise you’ll earn a small bonus for checking in.
              </p>
              {isCooldown ? (
                <div className="rounded-xl bg-muted/50 p-4 text-center">
                  <p className="text-sm text-muted-foreground">You’ve already done a quick check-in today. Come back tomorrow!</p>
                </div>
              ) : (
                <button
                  onClick={performCheckIn}
                  className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all"
                >
                  <MapPin className="w-5 h-5" />
                  Check In Here
                </button>
              )}
            </>
          )}

          {(phase === 'locating' || phase === 'verifying') && (
            <div className="flex flex-col items-center gap-4 py-6">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                {phase === 'locating' ? 'Getting your location...' : 'Verifying check-in...'}
              </p>
            </div>
          )}

          {phase === 'success' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <p className="text-foreground font-medium text-center">You’re checked in!</p>
              {rewardMessage && (
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Coins className="w-4 h-4 text-amber-500" />
                  {rewardMessage}
                </p>
              )}
              <button
                onClick={handleClose}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium"
              >
                Done
              </button>
            </div>
          )}

          {phase === 'error' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-14 h-14 rounded-full bg-destructive/20 flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-destructive" />
              </div>
              <p className="text-sm text-destructive text-center">{errorMessage}</p>
              <button
                onClick={() => { setPhase('idle'); setErrorMessage(''); }}
                className="w-full py-2.5 rounded-xl border border-border font-medium"
              >
                Try Again
              </button>
            </div>
          )}

          {onOpenMap && phase === 'idle' && (
            <button
              onClick={() => { handleClose(); onOpenMap(); }}
              className="w-full py-2.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Navigation2 className="w-4 h-4" />
              {mapAlreadyOpen ? 'Show map (already open below)' : 'View on Map'}
            </button>
          )}
        </div>

        {showConfetti && <ConfettiCelebration isActive={showConfetti} type="coins" />}
      </div>
    </div>
  );
};

export default QuickCheckInSheet;
