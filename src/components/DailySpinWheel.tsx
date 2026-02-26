import React, { useState, useEffect, useRef } from 'react';
import { Gift, Sparkles, Coins, Zap, Star, Crown, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { toast } from 'sonner';

interface WheelSegment {
  label: string;
  value: number;
  coinType: 'vicoin' | 'icoin';
  color: string;
  icon: React.ReactNode;
  probability: number;
}

interface DailySpinWheelProps {
  className?: string;
  onSpinComplete?: (reward: WheelSegment) => void;
}

const WHEEL_SEGMENTS: WheelSegment[] = [
  { label: '5 Vicoins', value: 5, coinType: 'vicoin', color: 'hsl(var(--primary))', icon: <Coins className="w-4 h-4" />, probability: 25 },
  { label: '10 Icoins', value: 10, coinType: 'icoin', color: 'hsl(var(--icoin))', icon: <Star className="w-4 h-4" />, probability: 20 },
  { label: '15 Vicoins', value: 15, coinType: 'vicoin', color: 'hsl(var(--primary))', icon: <Zap className="w-4 h-4" />, probability: 18 },
  { label: '25 Icoins', value: 25, coinType: 'icoin', color: 'hsl(var(--icoin))', icon: <Flame className="w-4 h-4" />, probability: 15 },
  { label: '50 Vicoins', value: 50, coinType: 'vicoin', color: 'hsl(var(--primary))', icon: <Sparkles className="w-4 h-4" />, probability: 12 },
  { label: '100 Icoins', value: 100, coinType: 'icoin', color: 'hsl(var(--icoin))', icon: <Crown className="w-4 h-4" />, probability: 7 },
  { label: '200 Vicoins', value: 200, coinType: 'vicoin', color: 'hsl(var(--primary))', icon: <Gift className="w-4 h-4" />, probability: 3 },
];

export const DailySpinWheel: React.FC<DailySpinWheelProps> = ({ className, onSpinComplete }) => {
  const { user } = useAuth();
  const haptics = useHapticFeedback();
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [canSpin, setCanSpin] = useState(false);
  const [reward, setReward] = useState<WheelSegment | null>(null);
  const [timeUntilNextSpin, setTimeUntilNextSpin] = useState<string>('');
  const wheelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkSpinEligibility();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [user]);

  const checkSpinEligibility = async () => {
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];
    const contentId = `daily_spin:${today}`;

    // Check whether today's daily spin reward session has already been redeemed.
    const { data } = await supabase
      .from('reward_sessions')
      .select('redeemed_at')
      .eq('user_id', user.id)
      .eq('reward_type', 'daily_spin')
      .eq('content_id', contentId)
      .maybeSingle();

    if (data) {
      setCanSpin(!data.redeemed_at);
    } else {
      setCanSpin(true);
    }
  };

  const updateCountdown = () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const diff = tomorrow.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    setTimeUntilNextSpin(`${hours}h ${minutes}m ${seconds}s`);
  };

  const handleSpin = async () => {
    if (!canSpin || spinning || !user) return;

    setSpinning(true);
    setReward(null);
    haptics.medium();

    const today = new Date().toISOString().split('T')[0];
    const contentId = `daily_spin:${today}`;
    const idempotencyKey = crypto.randomUUID();

    let wonReward: WheelSegment;
    try {
      const { data, error } = await supabase.functions.invoke('issue-reward', {
        headers: { 'idempotency-key': idempotencyKey },
        body: {
          rewardType: 'daily_spin',
          contentId,
        },
      });

      if (error) {
        let message = error.message || 'Failed to claim daily spin reward';
        const errorWithContext = error as { context?: Response };
        if (errorWithContext.context) {
          try {
            const payload = await errorWithContext.context.json() as { error?: string; code?: string };
            if (payload?.error) message = payload.error;
            if (payload?.code === 'reward_already_claimed' || payload?.code === 'daily_type_cap') {
              setCanSpin(false);
            }
          } catch {
            // Keep fallback error message.
          }
        }
        throw new Error(message);
      }

      const result = data as {
        success?: boolean;
        amount?: number;
        coinType?: 'vicoin' | 'icoin';
        error?: string;
        code?: string;
      };

      if (!result?.success || result.amount == null || !result.coinType) {
        if (result?.code === 'reward_already_claimed' || result?.code === 'daily_type_cap') {
          setCanSpin(false);
        }
        throw new Error(result?.error || 'Failed to claim daily spin reward');
      }

      const segment = WHEEL_SEGMENTS.find(
        (s) => s.value === result.amount && s.coinType === result.coinType
      );
      if (!segment) {
        throw new Error('Server returned unsupported spin reward');
      }
      wonReward = segment;
    } catch (error) {
      console.error('Failed to claim daily spin reward:', error);
      setSpinning(false);
      toast.error(error instanceof Error ? error.message : 'Failed to claim daily spin reward');
      // Refresh eligibility in case the reward was actually consumed but response failed.
      checkSpinEligibility();
      return;
    }

    const winningIndex = WHEEL_SEGMENTS.findIndex(
      (s) => s.value === wonReward.value && s.coinType === wonReward.coinType
    );
    const segmentAngle = 360 / WHEEL_SEGMENTS.length;
    const targetAngle = 360 - (winningIndex * segmentAngle) - segmentAngle / 2;
    const spins = 5 + Math.random() * 3; // 5-8 full spins
    const finalRotation = rotation + (spins * 360) + targetAngle;

    setRotation(finalRotation);

    // Wait for animation
    setTimeout(async () => {
      setReward(wonReward);
      setSpinning(false);
      setCanSpin(false);
      haptics.heavy();

      onSpinComplete?.(wonReward);
    }, 5000);
  };

  const segmentAngle = 360 / WHEEL_SEGMENTS.length;

  return (
    <div className={cn('flex flex-col items-center gap-6', className)}>
      {/* Wheel Container */}
      <div className="relative w-72 h-72">
        {/* Pointer */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10">
          <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[20px] border-l-transparent border-r-transparent border-t-primary drop-shadow-lg" />
        </div>

        {/* Wheel */}
        <div
          ref={wheelRef}
          className="w-full h-full rounded-full border-4 border-primary/30 shadow-2xl overflow-hidden transition-transform duration-[5000ms] ease-out"
          style={{ 
            transform: `rotate(${rotation}deg)`,
            background: 'conic-gradient(from 0deg, ' + 
              WHEEL_SEGMENTS.map((s, i) => 
                `${s.color} ${i * segmentAngle}deg ${(i + 1) * segmentAngle}deg`
              ).join(', ') + ')'
          }}
        >
          {/* Segment labels */}
          {WHEEL_SEGMENTS.map((segment, index) => {
            const angle = index * segmentAngle + segmentAngle / 2;
            return (
              <div
                key={index}
                className="absolute w-full h-full flex items-center justify-center"
                style={{ transform: `rotate(${angle}deg)` }}
              >
                <div 
                  className="absolute text-white text-xs font-bold flex flex-col items-center gap-1"
                  style={{ 
                    transform: `translateY(-100px) rotate(${-angle}deg)`,
                    textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                  }}
                >
                  {segment.icon}
                  <span>{segment.value}</span>
                </div>
              </div>
            );
          })}

          {/* Center circle */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-background border-4 border-primary flex items-center justify-center shadow-inner">
            <Gift className="w-6 h-6 text-primary" />
          </div>
        </div>
      </div>

      {/* Result */}
      {reward && (
        <div className="text-center animate-in zoom-in-50 duration-300">
          <p className="text-lg font-bold text-primary">🎉 You won!</p>
          <p className="text-2xl font-display font-bold">
            {reward.label}
          </p>
        </div>
      )}

      {/* Spin Button */}
      <Button
        onClick={handleSpin}
        disabled={!canSpin || spinning || !user}
        size="lg"
        className="w-48 gap-2"
      >
        {spinning ? (
          <>
            <Sparkles className="w-5 h-5 animate-spin" />
            Spinning...
          </>
        ) : canSpin ? (
          <>
            <Gift className="w-5 h-5" />
            Spin Now!
          </>
        ) : (
          <>
            <span>Next spin in</span>
          </>
        )}
      </Button>

      {!canSpin && !spinning && (
        <p className="text-sm text-muted-foreground">
          Next spin available in: <span className="font-mono font-bold">{timeUntilNextSpin}</span>
        </p>
      )}
    </div>
  );
};

export default DailySpinWheel;
