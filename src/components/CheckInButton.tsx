import React, { useState, useEffect } from 'react';
import { MapPin, Check, Loader2, AlertCircle, Navigation2, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ConfettiCelebration } from './ConfettiCelebration';
import { notificationSoundService } from '@/services/notificationSound.service';

interface CheckInButtonProps {
  promotion: {
    id: string;
    business_name: string;
    latitude: number;
    longitude: number;
    reward_amount: number;
    reward_type: 'vicoin' | 'icoin' | 'both';
  };
  className?: string;
  onSuccess?: () => void;
}

export const CheckInButton: React.FC<CheckInButtonProps> = ({
  promotion,
  className,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [checkInStatus, setCheckInStatus] = useState<'idle' | 'locating' | 'verifying' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showConfetti, setShowConfetti] = useState(false);
  const [distance, setDistance] = useState<number | null>(null);
  const [streakInfo, setStreakInfo] = useState<{ current: number; bonus: number; bonusAmount: number } | null>(null);

  const handleCheckIn = async () => {
    if (!user) {
      toast.error('Please sign in to check in');
      return;
    }

    setIsLoading(true);
    setCheckInStatus('locating');
    setErrorMessage('');

    try {
      // Get user's current location
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

      // Get session for auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      // Call edge function to verify check-in
      const { data, error } = await supabase.functions.invoke('verify-checkin', {
        body: {
          promotionId: promotion.id,
          businessName: promotion.business_name,
          promotionLat: promotion.latitude,
          promotionLng: promotion.longitude,
          userLat,
          userLng,
          rewardAmount: promotion.reward_amount,
          rewardType: promotion.reward_type === 'both' ? 'vicoin' : promotion.reward_type,
          maxDistanceMeters: 100,
        },
      });

      if (error) throw error;

      setDistance(data.distance);

      if (data.success) {
        setCheckInStatus('success');
        setShowConfetti(true);
        
        // Store streak info for display
        if (data.streak) {
          setStreakInfo({
            current: data.streak.current,
            bonus: data.streak.bonus,
            bonusAmount: data.streak.bonusAmount,
          });
        }

        // Play reward sound
        notificationSoundService.playReward();

        const bonusText = data.streak?.bonusAmount > 0 
          ? ` (+${data.streak.bonusAmount} streak bonus!)` 
          : '';
        
        toast.success('Check-in successful!', {
          description: `You earned ${data.reward?.total || promotion.reward_amount} ${promotion.reward_type}${bonusText}`,
        });
        onSuccess?.();

        // Hide confetti after 3 seconds
        setTimeout(() => setShowConfetti(false), 3000);
      } else {
        setCheckInStatus('error');
        setErrorMessage(data.message || 'Check-in failed');
        toast.error('Check-in failed', { description: data.message });
      }

    } catch (error: any) {
      console.error('Check-in error:', error);
      setCheckInStatus('error');
      
      if (error.code === 1) {
        setErrorMessage('Location permission denied. Please enable GPS.');
      } else if (error.code === 2) {
        setErrorMessage('Unable to get location. Please try again.');
      } else if (error.code === 3) {
        setErrorMessage('Location request timed out. Please try again.');
      } else {
        setErrorMessage(error.message || 'Check-in failed');
      }
      
      toast.error('Check-in failed', { description: errorMessage || 'Please try again' });
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

  return (
    <>
      <Button
        onClick={handleCheckIn}
        disabled={isLoading || checkInStatus === 'success'}
        className={cn(
          'flex items-center gap-2 transition-all',
          checkInStatus === 'success' && 'bg-green-500 hover:bg-green-500',
          checkInStatus === 'error' && 'bg-destructive hover:bg-destructive/90',
          className
        )}
      >
        {getButtonContent()}
      </Button>

      {/* Distance indicator */}
      {distance !== null && checkInStatus !== 'success' && (
        <p className="text-xs text-muted-foreground mt-1">
          You are {distance}m away (need to be within 100m)
        </p>
      )}

      {/* Error message */}
      {errorMessage && checkInStatus === 'error' && (
        <p className="text-xs text-destructive mt-1">{errorMessage}</p>
      )}

      {/* Confetti celebration */}
      {showConfetti && <ConfettiCelebration isActive={showConfetti} type="coins" />}
    </>
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
