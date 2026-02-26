import React, { useState, useCallback } from 'react';
import { MapPin, Check, Loader2, AlertCircle, Navigation2, Flame, ExternalLink, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { ConfettiCelebration } from './ConfettiCelebration';
import { notificationSoundService } from '@/services/notificationSound.service';
import { useCheckInStatus } from '@/hooks/useCheckInStatus';

const haptic = (pattern?: number | number[]) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern ?? [10]);
  }
};

interface CheckInButtonProps {
  promotion: {
    id: string;
    business_name: string;
    latitude: number;
    longitude: number;
    reward_amount: number;
    reward_type: 'vicoin' | 'icoin' | 'both';
    address?: string | null;
  };
  className?: string;
  onSuccess?: () => void;
  /** Show "Open in Maps" link. Default true. */
  showOpenInMaps?: boolean;
}

export const CheckInButton: React.FC<CheckInButtonProps> = ({
  promotion,
  className,
  onSuccess,
  showOpenInMaps = true,
}) => {
  const { user } = useAuth();
  const checkInStatusState = useCheckInStatus(promotion.id, { enabled: !!user?.id });
  const [isLoading, setIsLoading] = useState(false);
  const [checkInStatus, setCheckInStatus] = useState<'idle' | 'locating' | 'verifying' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showConfetti, setShowConfetti] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const [streakInfo, setStreakInfo] = useState<{ current: number; bonus: number; bonusAmount: number } | null>(null);

  const onCheckInSuccess = useCallback(() => {
    checkInStatusState.refetch();
    onSuccess?.();
  }, [checkInStatusState.refetch, onSuccess]);

  const handleOpenInMaps = useCallback(() => {
    const { latitude, longitude } = promotion;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    haptic([5]);
  }, [promotion]);

  const handleCheckIn = async () => {
    if (!user) {
      toast.error('Please sign in to check in');
      haptic([50, 30, 50]);
      return;
    }

    if (!checkInStatusState.canCheckIn && checkInStatus !== 'success') {
      toast.error('You can check in again later', {
        description: checkInStatusState.nextAvailableAt
          ? `Next check-in available ${format(checkInStatusState.nextAvailableAt, 'MMM d, h:mm a')}`
          : undefined,
      });
      haptic([30, 20, 30]);
      return;
    }

    setIsLoading(true);
    setCheckInStatus('locating');
    setErrorMessage('');

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

      setCheckInStatus('verifying');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const idempotencyKey = crypto.randomUUID();
      const { data, error } = await supabase.functions.invoke('verify-checkin', {
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
        body: {
          promotionId: promotion.id,
          userLat,
          userLng,
          maxDistanceMeters: 100,
        },
      });

      if (error) throw error;

      setDistance(data.distance);

      if (data.success) {
        setCheckInStatus('success');
        setShowConfetti(true);
        if (data.streak) {
          setStreakInfo({
            current: data.streak.current,
            bonus: data.streak.bonus,
            bonusAmount: data.streak.bonusAmount,
          });
        }
        notificationSoundService.playReward();
        haptic([20, 50, 20]);
        const bonusText = data.streak?.bonusAmount > 0
          ? ` (+${data.streak.bonusAmount} streak bonus!)`
          : '';
        toast.success('Check-in successful!', {
          description: `You earned ${data.reward?.total || promotion.reward_amount} ${promotion.reward_type}${bonusText}`,
        });
        onCheckInSuccess();
        setTimeout(() => setShowConfetti(false), 3000);
      } else {
        setCheckInStatus('error');
        const msg = data.message || 'Check-in failed';
        setErrorMessage(msg);
        toast.error('Check-in failed', { description: msg });
        haptic([50, 30, 50]);
        if (data.nextCheckInAvailableAt) {
          checkInStatusState.refetch();
        }
      }
    } catch (error: unknown) {
      const err = error as { code?: number; message?: string };
      console.error('Check-in error:', err);
      let msg = 'Check-in failed';
      if (err.code === 1) msg = 'Location permission denied. Please enable GPS.';
      else if (err.code === 2) msg = 'Unable to get location. Please try again.';
      else if (err.code === 3) msg = 'Location request timed out. Please try again.';
      else if (err.message) msg = err.message;
      setErrorMessage(msg);
      setCheckInStatus('error');
      toast.error('Check-in failed', { description: msg });
      haptic([50, 30, 50]);
    } finally {
      setIsLoading(false);
    }
  };

  const getButtonContent = () => {
    switch (checkInStatus) {
      case 'locating':
        return (
          <>
            <Navigation2 className="w-4 h-4 animate-pulse" />
            <span>Getting location...</span>
          </>
        );
      case 'verifying':
        return (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Verifying...</span>
          </>
        );
      case 'success':
        return (
          <>
            <Check className="w-4 h-4" />
            <span>Checked In!</span>
            {streakInfo && streakInfo.current > 1 && (
              <span className="flex items-center gap-1 ml-1 text-orange-300">
                <Flame className="w-3 h-3" />
                {streakInfo.current}
              </span>
            )}
          </>
        );
      case 'error':
        return (
          <>
            <AlertCircle className="w-4 h-4" />
            <span>Try Again</span>
          </>
        );
      default:
        return (
          <>
            <MapPin className="w-4 h-4" />
            <span>Check In</span>
          </>
        );
    }
  };

  const isCooldown = !checkInStatusState.canCheckIn && checkInStatus !== 'success';
  const disabled = isLoading || checkInStatus === 'success' || isCooldown;

  return (
    <div className="space-y-1.5">
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {checkInStatus === 'locating' && 'Getting your location.'}
        {checkInStatus === 'verifying' && 'Verifying check-in.'}
        {checkInStatus === 'success' && 'Check-in successful.'}
        {checkInStatus === 'error' && (errorMessage || 'Check-in failed.')}
      </div>

      <Button
        onClick={handleCheckIn}
        disabled={disabled}
        className={cn(
          'flex items-center gap-2 transition-all',
          checkInStatus === 'success' && 'bg-green-500 hover:bg-green-500',
          checkInStatus === 'error' && 'bg-destructive hover:bg-destructive/90',
          isCooldown && 'opacity-80',
          className
        )}
        aria-busy={isLoading}
        aria-disabled={disabled}
      >
        {getButtonContent()}
      </Button>

      {/* Cooldown: next check-in available */}
      {isCooldown && checkInStatusState.nextAvailableAt && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Next check-in {format(checkInStatusState.nextAvailableAt, 'MMM d, h:mm a')}
        </p>
      )}

      {/* Distance indicator */}
      {distance !== null && checkInStatus !== 'success' && !isCooldown && (
        <p className="text-xs text-muted-foreground">
          You are {distance}m away (within 100m to check in)
        </p>
      )}

      {/* Error message */}
      {errorMessage && checkInStatus === 'error' && (
        <p className="text-xs text-destructive">{errorMessage}</p>
      )}

      {/* Open in Maps */}
      {showOpenInMaps && (checkInStatus === 'success' || checkInStatus === 'idle' || isCooldown) && (
        <button
          type="button"
          onClick={handleOpenInMaps}
          className="text-xs text-primary hover:underline flex items-center gap-1"
        >
          <ExternalLink className="w-3 h-3" />
          Open in Maps
        </button>
      )}

      {showConfetti && <ConfettiCelebration isActive={showConfetti} type="coins" />}
    </div>
  );
};

// Hook to get check-in history for a user
export const useCheckInHistory = (userId?: string) => {
  const [checkins, setCheckins] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const fetchCheckins = async () => {
      const { data, error } = await supabase
        .from('promotion_checkins')
        .select('*')
        .eq('user_id', userId)
        .order('checked_in_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        setCheckins(data);
      }
      setIsLoading(false);
    };

    fetchCheckins();
  }, [userId]);

  return { checkins, isLoading };
};
