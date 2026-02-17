import React, { useState, useCallback, useEffect } from 'react';
import { Coins, User, Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { isSelfTip, TIP_AMOUNT_MIN, TIP_AMOUNT_MAX } from '@/services/tip.service';

export interface TipSheetCreatorInfo {
  id: string;
  username?: string;
  displayName?: string;
  avatarUrl?: string;
}

const PRESET_AMOUNTS = [10, 25, 50, 100, 250, 500] as const;

export interface TipSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Creator to tip; if missing, sheet shows empty state */
  creatorInfo?: TipSheetCreatorInfo | null;
  /** Content ID for the tip (required to send tip) */
  contentId?: string | null;
  /** True when creator.id is a UUID (real backend user). Non-UUID creators cannot receive tips. */
  creatorIdValidForTip?: boolean;
  /** Current auth user id (user.id from AuthContext). Used for self-tip check; must match feed creator id type (user_id). */
  currentUserId?: string | null;
  vicoinBalance: number;
  icoinBalance: number;
  onTip: (coinType: 'vicoin' | 'icoin', amount: number) => void | Promise<boolean | void>;
  /** Optional: called when sheet opens from remote control for accessibility */
  source?: 'gesture' | 'button' | 'remote';
}

export const TipSheet: React.FC<TipSheetProps> = ({
  open,
  onOpenChange,
  creatorInfo,
  contentId,
  creatorIdValidForTip = true,
  currentUserId,
  vicoinBalance,
  icoinBalance,
  onTip,
  source = 'button',
}) => {
  const haptic = useHapticFeedback();
  const [coinType, setCoinType] = useState<'vicoin' | 'icoin'>('vicoin');
  const [amount, setAmount] = useState(50);
  const [customAmount, setCustomAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const balance = coinType === 'vicoin' ? vicoinBalance : icoinBalance;
  const effectiveAmount = customAmount.trim()
    ? Math.min(TIP_AMOUNT_MAX, Math.max(TIP_AMOUNT_MIN, parseInt(customAmount, 10) || TIP_AMOUNT_MIN))
    : amount;
  const isSelf = isSelfTip(currentUserId ?? undefined, creatorInfo?.id ?? '');
  const canTip =
    !!creatorIdValidForTip &&
    !!creatorInfo?.id &&
    !!contentId &&
    !isSelf &&
    balance >= effectiveAmount &&
    effectiveAmount >= TIP_AMOUNT_MIN;
  const isEmpty = !creatorInfo || !contentId;
  const isNonUuidCreator = !!creatorInfo && !!contentId && !creatorIdValidForTip;

  // Reset state when sheet opens/closes
  useEffect(() => {
    if (open) {
      setAmount(50);
      setCustomAmount('');
      setSuccess(false);
      setCoinType('vicoin');
    }
  }, [open]);

  const handlePreset = useCallback((value: number) => {
    haptic.light();
    setAmount(value);
    setCustomAmount('');
  }, [haptic]);

  const handleCoinToggle = useCallback((type: 'vicoin' | 'icoin') => {
    haptic.light();
    setCoinType(type);
  }, [haptic]);

  const handleConfirm = useCallback(async () => {
    if (!canTip) return;
    haptic.medium();
    setIsSubmitting(true);
    try {
      const result = await Promise.resolve(onTip(coinType, effectiveAmount));
      if (result !== false) {
        setSuccess(true);
        haptic.success();
        setTimeout(() => onOpenChange(false), 1500);
      } else {
        haptic.medium();
      }
    } catch (e) {
      haptic.medium();
    } finally {
      setIsSubmitting(false);
    }
  }, [canTip, coinType, effectiveAmount, onTip, onOpenChange, haptic]);

  const handleClose = useCallback(() => {
    haptic.light();
    onOpenChange(false);
  }, [onOpenChange, haptic]);

  const displayName = creatorInfo?.displayName || creatorInfo?.username || 'Creator';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl pb-[env(safe-area-inset-bottom,0px)] max-h-[90vh] flex flex-col"
        onPointerDownOutside={handleClose}
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Tip creator</SheetTitle>
          <SheetDescription>
            {isEmpty
              ? 'Select a video to tip its creator.'
              : `Send ${coinType === 'vicoin' ? 'Vicoins' : 'Icoins'} to ${displayName}.`}
          </SheetDescription>
        </SheetHeader>

        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full" />
        </div>

        {success ? (
          <div
            className="flex-1 flex flex-col items-center justify-center gap-4 py-8"
            role="status"
            aria-live="polite"
            aria-label="Tip sent successfully"
          >
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
              <Check className="w-8 h-8 text-primary" />
            </div>
            <p className="text-lg font-semibold text-foreground">Thank you for supporting the creator!</p>
            <p className="text-sm text-muted-foreground">
              Your tip was sent successfully{creatorInfo?.displayName || creatorInfo?.username ? ` to ${displayName}` : ''}.
            </p>
          </div>
        ) : isEmpty ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-8 px-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Coins className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold text-foreground text-center">Tip a creator</p>
            <p className="text-sm text-muted-foreground text-center max-w-[280px]">
              Select a video in the feed, then use the tip gesture or the heart button to send a tip to that creator.
            </p>
            <Button variant="outline" onClick={handleClose} className="mt-2">
              Close
            </Button>
          </div>
        ) : isSelf ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-8 px-4">
            <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center">
              <User className="w-8 h-8 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-lg font-semibold text-foreground text-center">You can&apos;t tip yourself</p>
            <p className="text-sm text-muted-foreground text-center max-w-[280px]">
              Try tipping another creator whose content you enjoy!
            </p>
            <Button variant="outline" onClick={handleClose} className="mt-2">
              Close
            </Button>
          </div>
        ) : isNonUuidCreator ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 py-8 px-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Coins className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-semibold text-foreground text-center">Tipping not available</p>
            <p className="text-sm text-muted-foreground text-center max-w-[280px]">
              This creator cannot receive tips yet. Tips are only available for verified creators.
            </p>
            <Button variant="outline" onClick={handleClose} className="mt-2">
              Close
            </Button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-6">
            {/* Creator row */}
            <div className="flex items-center gap-3 pt-2">
              {creatorInfo.avatarUrl ? (
                <img
                  src={creatorInfo.avatarUrl}
                  alt={displayName}
                  className="w-12 h-12 rounded-full object-cover border-2 border-border"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
                  <User className="w-6 h-6 text-foreground/70" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate">{displayName}</p>
                {creatorInfo.username && (
                  <p className="text-xs text-muted-foreground">@{creatorInfo.username}</p>
                )}
              </div>
              {source === 'remote' && (
                <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Gesture
                </span>
              )}
            </div>

            {/* Coin type */}
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Choose currency</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleCoinToggle('vicoin')}
                  className={cn(
                    'rounded-xl py-3 px-4 border-2 transition-all flex flex-col items-center gap-1',
                    coinType === 'vicoin'
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/50'
                  )}
                  data-button-id="tip-sheet-vicoin"
                >
                  <span className="font-display font-bold text-lg">V</span>
                  <span className="text-xs">Vicoin</span>
                  <span className="text-xs opacity-80">Balance: {vicoinBalance}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleCoinToggle('icoin')}
                  className={cn(
                    'rounded-xl py-3 px-4 border-2 transition-all flex flex-col items-center gap-1',
                    coinType === 'icoin'
                      ? 'border-icoin bg-icoin/10 text-icoin'
                      : 'border-border bg-muted/30 text-muted-foreground hover:border-icoin/50'
                  )}
                  data-button-id="tip-sheet-icoin"
                >
                  <span className="font-display font-bold text-lg text-icoin">I</span>
                  <span className="text-xs">Icoin</span>
                  <span className="text-xs opacity-80">Balance: {icoinBalance}</span>
                </button>
              </div>
            </div>

            {/* Preset amounts */}
            <div>
              <p className="text-sm font-medium text-foreground mb-2">Amount</p>
              <div className="flex flex-wrap gap-2">
                {PRESET_AMOUNTS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handlePreset(value)}
                    className={cn(
                      'min-w-[4rem] py-2.5 px-3 rounded-xl border-2 text-sm font-medium transition-all',
                      amount === value && !customAmount.trim()
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-muted/30 hover:border-primary/50'
                    )}
                    data-button-id={`tip-preset-${value}`}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <label className="text-sm text-muted-foreground whitespace-nowrap">Custom:</label>
                <input
                  type="number"
                  min={TIP_AMOUNT_MIN}
                  max={TIP_AMOUNT_MAX}
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value.replace(/\D/g, '').slice(0, 5))}
                  placeholder={`${TIP_AMOUNT_MIN}-${TIP_AMOUNT_MAX}`}
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  aria-label={`Custom tip amount, ${TIP_AMOUNT_MIN} to ${TIP_AMOUNT_MAX}`}
                />
              </div>
            </div>

            {/* Summary & Confirm */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">You&apos;re sending</span>
                <span className={cn('font-bold', coinType === 'vicoin' ? 'text-primary' : 'text-icoin')}>
                  {effectiveAmount} {coinType === 'vicoin' ? 'Vicoins' : 'Icoins'}
                </span>
              </div>
              {balance < effectiveAmount && (
                <p className="text-xs text-destructive">Insufficient balance (you have {balance})</p>
              )}
              <Button
                className="w-full py-6 text-base font-semibold"
                disabled={!canTip || isSubmitting}
                onClick={handleConfirm}
                data-button-id="tip-sheet-confirm"
              >
                {isSubmitting ? 'Sending…' : `Send ${effectiveAmount} ${coinType === 'vicoin' ? 'Vicoins' : 'Icoins'}`}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};
