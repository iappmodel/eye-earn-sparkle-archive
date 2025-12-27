import React from 'react';
import { 
  CheckCircle2, 
  BarChart3, 
  Navigation, 
  QrCode, 
  Banknote, 
  Star,
  Gift,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RewardButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

// Claim Reward Button - Animated, prominent
export const ClaimRewardButton: React.FC<RewardButtonProps & { 
  amount?: number; 
  coinType?: 'vicoin' | 'icoin';
  isCompleted?: boolean;
}> = ({ 
  onClick, 
  disabled, 
  amount = 0, 
  coinType = 'vicoin',
  isCompleted = false,
  className 
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled || isCompleted}
      className={cn(
        'relative overflow-hidden rounded-2xl px-6 py-4 flex items-center justify-center gap-3 transition-all duration-300',
        isCompleted 
          ? 'neu-inset opacity-60'
          : 'neu-button animate-glow hover:scale-[1.02]',
        className
      )}
    >
      {isCompleted ? (
        <>
          <CheckCircle2 className="w-6 h-6 text-primary" />
          <span className="font-display font-bold text-primary">Claimed!</span>
        </>
      ) : (
        <>
          <Sparkles className={cn(
            'w-6 h-6',
            coinType === 'vicoin' ? 'text-primary' : 'text-icoin'
          )} />
          <span className="font-display font-bold">
            Claim {amount} {coinType === 'vicoin' ? 'Vicoins' : 'Icoins'}
          </span>
        </>
      )}
    </button>
  );
};

// View Campaign Button
export const ViewCampaignButton: React.FC<RewardButtonProps> = ({ 
  onClick, 
  disabled, 
  className 
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'neu-button rounded-2xl px-5 py-3 flex items-center gap-3 transition-all hover:scale-[1.02]',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <BarChart3 className="w-5 h-5 text-primary" />
      <span className="text-sm font-medium">View Campaign</span>
    </button>
  );
};

// Visit Business Button
export const VisitBusinessButton: React.FC<RewardButtonProps & { distance?: string }> = ({ 
  onClick, 
  disabled,
  distance,
  className 
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'neu-button rounded-2xl px-5 py-3 flex items-center gap-3 transition-all hover:scale-[1.02]',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <Navigation className="w-5 h-5 text-icoin" />
      <div className="text-left">
        <span className="text-sm font-medium block">Visit Store</span>
        {distance && (
          <span className="text-xs text-muted-foreground">{distance} away</span>
        )}
      </div>
    </button>
  );
};

// Scan QR Button
export const ScanQRButton: React.FC<RewardButtonProps> = ({ 
  onClick, 
  disabled, 
  className 
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'neu-button rounded-2xl px-5 py-3 flex items-center gap-3 transition-all hover:scale-[1.02]',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <QrCode className="w-5 h-5 text-primary" />
      <span className="text-sm font-medium">Scan Receipt / QR</span>
    </button>
  );
};

// Withdraw Button
export const WithdrawButton: React.FC<RewardButtonProps & { 
  available?: boolean;
  minAmount?: number;
}> = ({ 
  onClick, 
  disabled,
  available = true,
  minAmount,
  className 
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled || !available}
      className={cn(
        'neu-button rounded-2xl px-5 py-4 flex items-center gap-3 transition-all',
        available ? 'hover:scale-[1.02]' : 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <Banknote className="w-6 h-6 text-primary" />
      <div className="text-left flex-1">
        <span className="font-medium block">Withdraw</span>
        {!available && minAmount && (
          <span className="text-xs text-muted-foreground">
            Min. {minAmount} iCoins required
          </span>
        )}
      </div>
    </button>
  );
};

// Upgrade Plan Button
export const UpgradePlanButton: React.FC<RewardButtonProps & { planName?: string }> = ({ 
  onClick, 
  disabled,
  planName = 'Premium',
  className 
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'relative overflow-hidden rounded-2xl px-5 py-4 flex items-center gap-3 transition-all hover:scale-[1.02]',
        'bg-gradient-to-r from-icoin/20 to-primary/20 border border-icoin/30',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <Star className="w-6 h-6 text-icoin fill-icoin" />
      <div className="text-left flex-1">
        <span className="font-display font-bold block">Upgrade to {planName}</span>
        <span className="text-xs text-muted-foreground">Unlock all features</span>
      </div>
    </button>
  );
};

// View Rewards Button
export const ViewRewardsButton: React.FC<RewardButtonProps & { count?: number }> = ({ 
  onClick, 
  disabled,
  count = 0,
  className 
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'neu-button rounded-2xl px-5 py-3 flex items-center gap-3 transition-all hover:scale-[1.02]',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <Gift className="w-5 h-5 text-icoin" />
      <span className="text-sm font-medium">View Rewards</span>
      {count > 0 && (
        <span className="ml-auto bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full">
          {count}
        </span>
      )}
    </button>
  );
};
