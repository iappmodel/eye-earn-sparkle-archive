/**
 * PromoCheckInFlow – full-featured multi-step check-in experience:
 *   Step 1: QR (show code / scan store's code), location verify, validity countdown
 *   Step 2: Action checklist with watch promo, rating, share, haptics, back nav
 *   Step 3: Reward summary with confetti, share success, reminders, coin breakdown
 *
 * Supports demo (mock) promotions and real UUID promotions with verify-checkin.
 */
import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  X,
  QrCode,
  CheckCircle2,
  Circle,
  ChevronLeft,
  Coins,
  Star,
  ArrowRight,
  PartyPopper,
  ExternalLink,
  MapPin,
  Share2,
  Clock,
  Sparkles,
  Calendar,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { usePromoEarnings } from '@/hooks/usePromoEarnings';
import { useCheckInStatus } from '@/hooks/useCheckInStatus';
import { useAuth } from '@/contexts/AuthContext';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { supabase } from '@/integrations/supabase/client';
import { ConfettiCelebration } from '@/components/ConfettiCelebration';
import { notificationSoundService } from '@/services/notificationSound.service';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(id: string): boolean {
  return UUID_REGEX.test(id);
}

export interface PromoCheckInPromotion {
  id: string;
  business_name: string;
  description: string;
  reward_type: 'vicoin' | 'icoin' | 'both';
  reward_amount: number;
  required_action: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  category?: string;
  image_url?: string | null;
  expires_at?: string | null;
}

interface PromoCheckInFlowProps {
  isOpen: boolean;
  onClose: () => void;
  promotion: PromoCheckInPromotion;
  onOpenWallet?: () => void;
  /** Current check-in streak in days (for bonus display) */
  streakDays?: number;
  /** Called when user wants to share (e.g. open ShareSheet with prefill) */
  onShareSuccess?: (payload: { title: string; text?: string; url?: string }) => void;
}

type Step = 'qr' | 'actions' | 'summary';

// QR validity duration in seconds
const QR_VALIDITY_SECONDS = 10 * 60; // 10 minutes
// Watch promo duration for demo
const WATCH_PROMO_SECONDS = 30;
// Max distance in meters to consider "at venue" for verify-checkin
const MAX_CHECKIN_DISTANCE_METERS = 150;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PromoCheckInFlow: React.FC<PromoCheckInFlowProps> = ({
  isOpen,
  onClose,
  promotion,
  onOpenWallet,
  streakDays = 0,
  onShareSuccess,
}) => {
  const { user } = useAuth();
  const { success: hapticSuccess } = useHapticFeedback();
  const [step, setStep] = useState<Step>('qr');
  const [animateReward, setAnimateReward] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'getting' | 'verified' | 'too_far' | 'error'>('idle');
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [checkInRecorded, setCheckInRecorded] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef<number>(0);

  const isDemo = !isUuid(promotion.id);
  const hasLocation = promotion.latitude != null && promotion.longitude != null && !isNaN(promotion.latitude) && !isNaN(promotion.longitude);

  const earnings = usePromoEarnings({ promotionId: promotion.id, streakDays });
  const checkInStatus = useCheckInStatus(isUuid(promotion.id) ? promotion.id : null, { enabled: isOpen && !!user?.id });

  // Reset when opening
  useEffect(() => {
    if (isOpen) {
      setStep('qr');
      setAnimateReward(false);
      setShowConfetti(false);
      setLocationStatus('idle');
      setDistanceMeters(null);
      setCheckInRecorded(false);
    }
  }, [isOpen, promotion.id]);

  // QR payload with expiry
  const qrPayload = useMemo(() => {
    const nonce = Math.random().toString(36).slice(2, 10);
    const expiresAt = Date.now() + QR_VALIDITY_SECONDS * 1000;
    return JSON.stringify({
      promotionId: promotion.id,
      userId: user?.id ?? 'guest',
      timestamp: Date.now(),
      nonce,
      expiresAt,
    });
  }, [promotion.id, user?.id, isOpen]);

  const qrCodeUrl = useMemo(() => {
    const encoded = encodeURIComponent(qrPayload);
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encoded}&bgcolor=1a1a2e&color=00e5ff&format=svg`;
  }, [qrPayload]);

  // Record check-in in DB when we have UUID and optional coords (best-effort)
  const recordCheckIn = useCallback(
    async (userLat: number, userLng: number) => {
      if (!user || !isUuid(promotion.id)) return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const idempotencyKey = crypto.randomUUID();
        const { data, error } = await supabase.functions.invoke('verify-checkin', {
          headers: {
            'Idempotency-Key': idempotencyKey,
          },
          body: {
            promotionId: promotion.id,
            userLat,
            userLng,
            maxDistanceMeters: MAX_CHECKIN_DISTANCE_METERS,
          },
        });

        if (!error && data?.success) {
          setCheckInRecorded(true);
          if (data.streak?.bonusAmount > 0) {
            toast.success('Check-in recorded!', { description: `Streak bonus: +${data.streak.bonusAmount} coins` });
          }
        }
      } catch {
        // ignore
      }
    },
    [user, promotion.id, promotion.business_name, promotion.latitude, promotion.longitude, promotion.reward_amount, promotion.reward_type],
  );

  const handleVerifyLocation = useCallback(async () => {
    if (!hasLocation) return;
    setLocationStatus('getting');
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        });
      });
      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;

      const R = 6371000;
      const dLat = ((promotion.latitude! - userLat) * Math.PI) / 180;
      const dLon = ((promotion.longitude! - userLng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((userLat * Math.PI) / 180) *
          Math.cos((promotion.latitude! * Math.PI) / 180) *
          Math.sin(dLon / 2) ** 2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = Math.round(R * c);
      setDistanceMeters(distance);

      if (distance <= MAX_CHECKIN_DISTANCE_METERS) {
        setLocationStatus('verified');
        if (isUuid(promotion.id)) {
          await recordCheckIn(userLat, userLng);
        }
        hapticSuccess();
        toast.success("You're here! Check-in verified.");
      } else {
        setLocationStatus('too_far');
        toast.error('Too far from venue', {
          description: `You're ${(distance / 1000).toFixed(2)} km away. Get closer to check in.`,
        });
      }
    } catch {
      setLocationStatus('error');
      toast.error('Could not get location');
    }
  }, [hasLocation, promotion.latitude, promotion.longitude, promotion.id, recordCheckIn, hapticSuccess, checkInStatus.canCheckIn, checkInStatus.nextAvailableAt]);

  const handleSimulateScan = useCallback(async () => {
    if (hasLocation && user && (isUuid(promotion.id) || isDemo)) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 });
        }).catch(() => null);
        if (position && isUuid(promotion.id) && !checkInRecorded) {
          await recordCheckIn(position.coords.latitude, position.coords.longitude);
        }
      } catch {
        // ignore
      }
    }
    const checkinResult = await earnings.completeAction('checkin');
    const qrResult = await earnings.completeAction('qr_scan');
    hapticSuccess();
    notificationSoundService.playReward?.();
    if (checkinResult.rewarded || qrResult.rewarded) {
      toast.success('QR scanned! Verified reward applied.');
    } else {
      toast.success('QR scanned! Check-in confirmed.', {
        description: 'Some promo actions are recorded, but rewards are only granted for server-verified actions.',
      });
    }
    setStep('actions');
  }, [earnings, hasLocation, user, promotion.id, isDemo, checkInRecorded, recordCheckIn, hapticSuccess]);

  const handleCompleteAction = useCallback(
    async (actionId: string) => {
      const result = await earnings.completeAction(actionId);
      hapticSuccess();
      notificationSoundService.playReward?.();
      if (result.rewarded) {
        toast.success('Action completed! Reward granted.');
      } else if (result.rewardErrorCode === 'action_not_supported') {
        toast.success('Action completed.', {
          description: 'Reward for this action is pending verified backend integration.',
        });
      } else if (result.rewardErrorCode === 'action_not_found' || result.rewardErrorCode === 'requirement_not_met') {
        toast.success('Action recorded.', {
          description: 'Reward will be granted after the action is verified by the backend.',
        });
      } else if (result.rewardError) {
        toast.success('Action completed.', {
          description: 'Reward could not be verified right now. Try again later.',
        });
      } else {
        toast.success('Action completed!');
      }
    },
    [earnings, hapticSuccess],
  );

  const handleFinish = useCallback(() => {
    setStep('summary');
    setTimeout(() => {
      setAnimateReward(true);
      setShowConfetti(true);
    }, 200);
    setTimeout(() => setShowConfetti(false), 3500);
  }, []);

  const handleViewWallet = useCallback(() => {
    onClose();
    onOpenWallet?.();
  }, [onClose, onOpenWallet]);

  const handleBack = useCallback(() => {
    if (step === 'actions') setStep('qr');
    else if (step === 'summary') setStep('actions');
  }, [step]);

  const handleStepIndicatorClick = useCallback(
    (s: Step) => {
      const order: Step[] = ['qr', 'actions', 'summary'];
      const currentIdx = order.indexOf(step);
      const targetIdx = order.indexOf(s);
      if (targetIdx < currentIdx) setStep(s);
    },
    [step],
  );

  // Swipe down to close
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const dy = e.changedTouches[0].clientY - touchStartY.current;
      if (dy > 80) onClose();
    },
    [onClose],
  );

  if (!isOpen) return null;

  const progressPct = earnings.totalPossible
    ? Math.round((earnings.totalEarned / earnings.totalPossible) * 100)
    : 0;
  const steps: Step[] = ['qr', 'actions', 'summary'];

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <div
        ref={sheetRef}
        role="dialog"
        aria-labelledby="promo-checkin-title"
        aria-describedby="promo-checkin-desc"
        className="relative w-full max-w-md bg-gradient-to-b from-[#1a1a2e] to-[#0d0d1a] rounded-t-3xl overflow-hidden animate-slide-up max-h-[92vh] flex flex-col touch-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {showConfetti && <ConfettiCelebration isActive={showConfetti} type="coins" duration={3000} onComplete={() => setShowConfetti(false)} />}

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            {promotion.image_url ? (
              <img src={promotion.image_url} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0">
                <Coins className="w-5 h-5 text-white" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 id="promo-checkin-title" className="text-white font-bold text-base leading-tight truncate">
                  {promotion.business_name}
                </h2>
                {isDemo && (
                  <span className="flex-shrink-0 px-1.5 py-0.5 rounded bg-amber-500/30 text-amber-300 text-[10px] font-medium">
                    Demo
                  </span>
                )}
              </div>
              <p id="promo-checkin-desc" className="text-white/50 text-xs">
                Check-in & Earn
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition flex-shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4 text-white/70" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-1 px-5 pb-4 flex-shrink-0">
          {steps.map((s, i) => {
            const currentIdx = steps.indexOf(step);
            const idx = steps.indexOf(s);
            const isPast = idx < currentIdx;
            const isCurrent = step === s;
            return (
              <button
                type="button"
                key={s}
                onClick={() => handleStepIndicatorClick(s)}
                disabled={idx > currentIdx}
                className={cn(
                  'h-1.5 flex-1 rounded-full transition-all',
                  isCurrent && 'bg-cyan-400',
                  isPast && !isCurrent && 'bg-cyan-400/60',
                  !isCurrent && !isPast && 'bg-white/10',
                  idx <= currentIdx && 'cursor-pointer hover:opacity-90',
                )}
                aria-label={s === 'qr' ? 'Step 1: QR' : s === 'actions' ? 'Step 2: Actions' : 'Step 3: Summary'}
                aria-current={isCurrent ? 'step' : undefined}
              />
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 pb-6" aria-live="polite">
          {step === 'qr' && (
            <QRStep
              qrCodeUrl={qrCodeUrl}
              validitySeconds={QR_VALIDITY_SECONDS}
              onSimulateScan={handleSimulateScan}
              onVerifyLocation={hasLocation ? handleVerifyLocation : undefined}
              locationStatus={locationStatus}
              distanceMeters={distanceMeters}
              isDemo={isDemo}
              address={promotion.address}
              canCheckInToday={checkInStatus.canCheckIn}
              nextCheckInAt={checkInStatus.nextAvailableAt}
            />
          )}

          {step === 'actions' && (
            <ActionsStep
              actions={earnings.actions}
              totalEarned={earnings.totalEarned}
              totalPossible={earnings.totalPossible}
              progressPct={progressPct}
              streakBonus={earnings.streakBonus}
              streakDays={streakDays}
              onComplete={handleCompleteAction}
              onFinish={handleFinish}
              onBack={handleBack}
              businessName={promotion.business_name}
              onShareRequest={onShareSuccess}
            />
          )}

          {step === 'summary' && (
            <SummaryStep
              actions={earnings.actions}
              totalEarned={earnings.totalEarned}
              streakBonus={earnings.streakBonus}
              streakDays={streakDays}
              animateReward={animateReward}
              onViewWallet={handleViewWallet}
              onClose={onClose}
              onBack={handleBack}
              onShareSuccess={onShareSuccess}
              businessName={promotion.business_name}
              rewardType={promotion.reward_type}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Step 1 – QR Code with validity and optional location verify */
function QRStep({
  qrCodeUrl,
  validitySeconds,
  onSimulateScan,
  onVerifyLocation,
  locationStatus,
  distanceMeters,
  isDemo,
  address,
  canCheckInToday = true,
  nextCheckInAt = null,
}: {
  qrCodeUrl: string;
  validitySeconds: number;
  onSimulateScan: () => void;
  onVerifyLocation?: () => void;
  locationStatus: 'idle' | 'getting' | 'verified' | 'too_far' | 'error';
  distanceMeters: number | null;
  isDemo: boolean;
  address?: string;
  canCheckInToday?: boolean;
  nextCheckInAt?: Date | null;
}) {
  const [secondsLeft, setSecondsLeft] = useState(validitySeconds);

  useEffect(() => {
    setSecondsLeft(validitySeconds);
    const t = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [validitySeconds, qrCodeUrl]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="text-center">
        <h3 className="text-white font-semibold text-lg mb-1">Scan to Check In</h3>
        <p className="text-white/50 text-sm">
          Show this code to the cashier, or scan the store&rsquo;s QR at the counter
        </p>
      </div>

      {/* Validity countdown */}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
        <Clock className="w-3.5 h-3.5 text-cyan-400" />
        <span className="text-cyan-300 text-xs font-medium">
          Valid for {mins}:{secs.toString().padStart(2, '0')}
        </span>
      </div>

      <div className="relative p-4 rounded-2xl bg-white/5 border border-white/10 ring-2 ring-cyan-500/20">
        <img src={qrCodeUrl} alt="Check-in QR Code" className="w-52 h-52 rounded-lg" loading="eager" />
        <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-cyan-500 flex items-center justify-center shadow-lg">
          <QrCode className="w-4 h-4 text-white" />
        </div>
      </div>

      {/* Verify location */}
      {onVerifyLocation && (
        <div className="w-full space-y-2">
          {!canCheckInToday && nextCheckInAt && (
            <p className="text-white/50 text-xs text-center">
              Next check-in available {nextCheckInAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </p>
          )}
          <button
            type="button"
            onClick={onVerifyLocation}
            disabled={locationStatus === 'getting' || locationStatus === 'verified' || !canCheckInToday}
            className={cn(
              'w-full py-2.5 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 transition',
              locationStatus === 'verified'
                ? 'bg-green-500/20 border-green-500/40 text-green-300'
                : 'bg-white/5 border-white/10 text-white hover:bg-white/10 active:scale-[0.98]',
            )}
          >
            {locationStatus === 'getting' && <Loader2 className="w-4 h-4 animate-spin" />}
            {locationStatus === 'verified' && <CheckCircle2 className="w-4 h-4" />}
            {locationStatus === 'too_far' && <AlertCircle className="w-4 h-4" />}
            {locationStatus !== 'getting' && (
              <>
                <MapPin className="w-4 h-4" />
                {locationStatus === 'idle' || locationStatus === 'error'
                  ? "Verify I'm here"
                  : locationStatus === 'verified'
                    ? "You're here!"
                    : locationStatus === 'too_far'
                      ? `${(distanceMeters ?? 0) / 1000} km away`
                      : 'Retry location'}
              </>
            )}
          </button>
          {address && (
            <p className="text-white/40 text-xs text-center truncate px-2">{address}</p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={onSimulateScan}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition"
      >
        <CheckCircle2 className="w-4 h-4" />
        {isDemo ? "I'm ready – Simulate Scan (Demo)" : 'I scanned their code / Showed my code'}
      </button>

      <p className="text-white/30 text-xs text-center">
        In production the cashier scans your code, or you scan theirs with your camera.
      </p>
    </div>
  );
}

/** Step 2 – Action checklist with watch promo, rating, share */
function ActionsStep({
  actions,
  totalEarned,
  totalPossible,
  progressPct,
  streakBonus,
  streakDays,
  onComplete,
  onFinish,
  onBack,
  businessName,
  onShareRequest,
}: {
  actions: ReturnType<typeof usePromoEarnings>['actions'];
  totalEarned: number;
  totalPossible: number;
  progressPct: number;
  streakBonus: number;
  streakDays: number;
  onComplete: (id: string) => void;
  onFinish: () => void;
  onBack: () => void;
  businessName: string;
  onShareRequest?: (payload: { title: string; text?: string; url?: string }) => void;
}) {
  const watchAction = actions.find((a) => a.id === 'watch_promo');
  const reviewAction = actions.find((a) => a.id === 'leave_review');
  const shareAction = actions.find((a) => a.id === 'share_social');
  const [watchProgress, setWatchProgress] = useState(0);
  const [watchRunning, setWatchRunning] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingHover, setRatingHover] = useState(0);

  useEffect(() => {
    if (!watchRunning || watchProgress >= WATCH_PROMO_SECONDS) {
      if (watchRunning && watchProgress >= WATCH_PROMO_SECONDS && watchAction && !watchAction.completed) {
        onComplete('watch_promo');
      }
      setWatchRunning(false);
      return;
    }
    const t = setInterval(() => setWatchProgress((p) => Math.min(p + 1, WATCH_PROMO_SECONDS)), 1000);
    return () => clearInterval(t);
  }, [watchRunning, watchProgress, watchAction, onComplete]);

  const startWatching = () => setWatchRunning(true);
  const displayRating = ratingHover || rating;
  const handleSetRating = (v: number) => {
    setRating(v);
    if (reviewAction && !reviewAction.completed && v >= 1) {
      onComplete('leave_review');
    }
  };
  const handleShare = () => {
    if (shareAction && !shareAction.completed) onComplete('share_social');
    onShareRequest?.({
      title: `${businessName} on iView`,
      text: `Check out ${businessName} – earn rewards when you visit!`,
    });
    toast.success('Share opened');
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition"
          aria-label="Back to QR step"
        >
          <ChevronLeft className="w-4 h-4 text-white/70" />
        </button>
        <div className="flex-1 text-center">
          <h3 className="text-white font-semibold text-lg">Complete Actions</h3>
          <p className="text-white/50 text-sm">Earn rewards by completing each task</p>
        </div>
        <div className="w-8" />
      </div>

      <div className="bg-white/5 rounded-xl p-3 border border-white/10">
        <div className="flex justify-between items-center mb-2">
          <span className="text-white/70 text-xs font-medium">Progress</span>
          <span className="text-cyan-400 text-xs font-bold">
            {totalEarned} / {totalPossible} coins
          </span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-green-400 rounded-full transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {actions.map((action) => {
          const isWatch = action.id === 'watch_promo';
          const isReview = action.id === 'leave_review';
          const isShare = action.id === 'share_social';

          return (
            <div
              key={action.id}
              className={cn(
                'rounded-xl border transition',
                action.completed ? 'bg-green-500/10 border-green-500/20' : 'bg-white/5 border-white/10',
              )}
            >
              {isWatch && watchAction ? (
                <div className="p-3">
                  <div className="flex items-center gap-3 mb-2">
                    {action.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                    ) : (
                      <Circle className="w-5 h-5 text-white/30 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className={cn('text-sm font-medium block', action.completed ? 'text-green-300' : 'text-white')}>
                        {action.label}
                      </span>
                      <span className="text-white/40 text-xs block">{action.description}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Coins className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-amber-300 text-xs font-bold">+{action.coinReward}</span>
                    </div>
                  </div>
                  {!action.completed && (
                    <div className="mt-2">
                      {!watchRunning ? (
                        <button
                          type="button"
                          onClick={startWatching}
                          className="w-full py-2 rounded-lg bg-cyan-500/20 text-cyan-300 text-sm font-medium flex items-center justify-center gap-2"
                        >
                          <Sparkles className="w-4 h-4" />
                          Watch 30s promo
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-cyan-500 rounded-full transition-all"
                              style={{ width: `${(watchProgress / WATCH_PROMO_SECONDS) * 100}%` }}
                            />
                          </div>
                          <span className="text-white/70 text-xs w-8">{WATCH_PROMO_SECONDS - watchProgress}s</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : isReview && reviewAction ? (
                <div className="p-3">
                  <div className="flex items-center gap-3 mb-2">
                    {action.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                    ) : (
                      <Circle className="w-5 h-5 text-white/30 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className={cn('text-sm font-medium block', action.completed ? 'text-green-300' : 'text-white')}>
                        {action.label}
                      </span>
                      <span className="text-white/40 text-xs block">{action.description}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Coins className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-amber-300 text-xs font-bold">+{action.coinReward}</span>
                    </div>
                  </div>
                  {!action.completed && (
                    <div className="flex gap-1 mt-2" onMouseLeave={() => setRatingHover(0)}>
                      {[1, 2, 3, 4, 5].map((v) => (
                        <button
                          type="button"
                          key={v}
                          onClick={() => handleSetRating(v)}
                          onMouseEnter={() => setRatingHover(v)}
                          className="p-1 rounded hover:bg-white/10 transition"
                          aria-label={`Rate ${v} star${v > 1 ? 's' : ''}`}
                        >
                          <Star
                            className={cn(
                              'w-7 h-7 transition-colors',
                              (displayRating >= v ? 'text-amber-400 fill-amber-400' : 'text-white/30'),
                            )}
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : isShare && shareAction ? (
                <div className="p-3">
                  <div className="flex items-center gap-3">
                    {action.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                    ) : (
                      <Circle className="w-5 h-5 text-white/30 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className={cn('text-sm font-medium block', action.completed ? 'text-green-300' : 'text-white')}>
                        {action.label}
                      </span>
                      <span className="text-white/40 text-xs block">{action.description}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Coins className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-amber-300 text-xs font-bold">+{action.coinReward}</span>
                      {!action.completed && (
                        <button
                          type="button"
                          onClick={handleShare}
                          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition"
                          aria-label="Share"
                        >
                          <Share2 className="w-4 h-4 text-white/70" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={action.completed}
                  onClick={() => onComplete(action.id)}
                  className="flex items-center gap-3 p-3 w-full text-left transition active:scale-[0.99]"
                >
                  {action.completed ? (
                    <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                  ) : (
                    <Circle className="w-5 h-5 text-white/30 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className={cn('text-sm font-medium block', action.completed ? 'text-green-300' : 'text-white')}>
                      {action.label}
                    </span>
                    <span className="text-white/40 text-xs block truncate">{action.description}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Coins className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-amber-300 text-xs font-bold">+{action.coinReward}</span>
                  </div>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {streakBonus > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <Star className="w-4 h-4 text-amber-400" />
          <span className="text-amber-300 text-xs font-medium">
            {streakDays} day streak: +{streakBonus} bonus coins!
          </span>
        </div>
      )}

      <button
        type="button"
        onClick={onFinish}
        className="w-full py-3 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition mt-1"
      >
        Finish & Collect Rewards
        <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
}

/** Step 3 – Reward summary with confetti, share, reminders */
function SummaryStep({
  actions,
  totalEarned,
  streakBonus,
  streakDays,
  animateReward,
  onViewWallet,
  onClose,
  onBack,
  onShareSuccess,
  businessName,
  rewardType,
}: {
  actions: ReturnType<typeof usePromoEarnings>['actions'];
  totalEarned: number;
  streakBonus: number;
  streakDays: number;
  animateReward: boolean;
  onViewWallet: () => void;
  onClose: () => void;
  onBack: () => void;
  onShareSuccess?: (payload: { title: string; text?: string; url?: string }) => void;
  businessName: string;
  rewardType: 'vicoin' | 'icoin' | 'both';
}) {
  const grandTotal = totalEarned + streakBonus;

  const handleShareSuccess = () => {
    onShareSuccess?.({
      title: `I earned ${grandTotal} coins at ${businessName}!`,
      text: `Just earned ${grandTotal} coins at ${businessName} with iView – check-in and earn rewards too!`,
    });
    toast.success('Share opened');
  };

  const handleRemindReturn = () => {
    toast.success('Reminder set', { description: "We'll nudge you to return within 7 days for a bonus." });
  };

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition"
          aria-label="Back to actions"
        >
          <ChevronLeft className="w-4 h-4 text-white/70" />
        </button>
        <div className="flex-1 text-center">
          <div
            className={cn(
              'w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center transition-all duration-700 mx-auto',
              animateReward ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
            )}
          >
            <PartyPopper className="w-10 h-10 text-white" />
          </div>
        </div>
        <div className="w-8" />
      </div>

      <div className="text-center">
        <h3 className="text-white font-bold text-xl mb-1">Congratulations!</h3>
        <p className="text-white/50 text-sm">You earned rewards from this visit</p>
      </div>

      <div
        className={cn(
          'flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30 transition-all duration-700 delay-200',
          animateReward ? 'scale-100 opacity-100' : 'scale-75 opacity-0',
        )}
      >
        <Coins className="w-6 h-6 text-amber-400" />
        <span className="text-amber-300 font-bold text-2xl">{grandTotal}</span>
        <span className="text-amber-300/70 text-sm">coins earned</span>
      </div>

      {/* Breakdown by type when both */}
      {rewardType === 'both' && (
        <div className="w-full flex gap-2">
          <div className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-center">
            <span className="text-cyan-400 text-xs font-medium">vicoin</span>
            <div className="text-white font-bold">
              {actions.filter((a) => a.completed && (a.coinType === 'vicoin' || a.coinType === 'both')).reduce((s, a) => s + a.coinReward, 0)}
            </div>
          </div>
          <div className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-center">
            <span className="text-emerald-400 text-xs font-medium">icoin</span>
            <div className="text-white font-bold">
              {actions.filter((a) => a.completed && (a.coinType === 'icoin' || a.coinType === 'both')).reduce((s, a) => s + a.coinReward, 0)}
            </div>
          </div>
        </div>
      )}

      <div className="w-full flex flex-col gap-1.5">
        {actions
          .filter((a) => a.completed)
          .map((a) => (
            <div key={a.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5">
              <span className="text-white/70 text-xs">{a.label}</span>
              <span className="text-green-400 text-xs font-bold">+{a.coinReward}</span>
            </div>
          ))}
        {streakBonus > 0 && (
          <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-amber-500/10">
            <span className="text-amber-300 text-xs">Streak Bonus ({streakDays} days)</span>
            <span className="text-amber-300 text-xs font-bold">+{streakBonus}</span>
          </div>
        )}
      </div>

      <div className="w-full flex flex-col gap-2 mt-2">
        <button
          type="button"
          onClick={onViewWallet}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition"
        >
          <ExternalLink className="w-4 h-4" />
          View in Wallet
        </button>
        {onShareSuccess && (
          <button
            type="button"
            onClick={handleShareSuccess}
            className="w-full py-2.5 rounded-xl bg-white/10 border border-white/10 text-white/90 text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition"
          >
            <Share2 className="w-4 h-4" />
            Share my success
          </button>
        )}
        <button
          type="button"
          onClick={handleRemindReturn}
          className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition"
        >
          <Calendar className="w-4 h-4" />
          Remind me to return in 7 days
        </button>
        <button type="button" onClick={onClose} className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 text-sm active:scale-[0.97] transition">
          Done
        </button>
      </div>
    </div>
  );
}

export default PromoCheckInFlow;
