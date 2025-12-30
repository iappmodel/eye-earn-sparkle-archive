import React from 'react';
import { Bell, Gift, MessageCircle, Sparkles, Trophy, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Notification } from '@/hooks/useNotifications';

interface NotificationToastProps {
  notification: Notification;
  onDismiss: () => void;
  onClick?: () => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({
  notification,
  onDismiss,
  onClick,
}) => {
  const getIcon = () => {
    switch (notification.type) {
      case 'engagement':
        return <MessageCircle className="w-5 h-5" />;
      case 'promotion':
        return <Gift className="w-5 h-5" />;
      default:
        return <Bell className="w-5 h-5" />;
    }
  };

  const getIconBg = () => {
    switch (notification.type) {
      case 'engagement':
        return 'bg-primary/20 text-primary';
      case 'promotion':
        return 'bg-icoin/20 text-icoin';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-4 rounded-2xl neu-card cursor-pointer',
        'animate-slide-in-right hover:scale-[1.02] transition-transform'
      )}
      onClick={onClick}
    >
      <div className={cn('p-2 rounded-xl', getIconBg())}>
        {getIcon()}
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{notification.title}</p>
        {notification.body && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
            {notification.body}
          </p>
        )}
      </div>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        className="p-1 rounded-full hover:bg-muted transition-colors shrink-0"
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </button>
    </div>
  );
};

// Achievement Toast Component
interface AchievementToastProps {
  name: string;
  icon?: string;
  xpReward: number;
  onDismiss: () => void;
}

export const AchievementToast: React.FC<AchievementToastProps> = ({
  name,
  icon,
  xpReward,
  onDismiss,
}) => {
  return (
    <div className="flex items-center gap-3 p-4 rounded-2xl neu-card animate-slide-in-right">
      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-white">
        {icon ? (
          <span className="text-2xl">{icon}</span>
        ) : (
          <Trophy className="w-6 h-6" />
        )}
      </div>
      
      <div className="flex-1">
        <p className="font-medium text-sm gradient-text">Achievement Unlocked!</p>
        <p className="text-xs text-muted-foreground">{name}</p>
        {xpReward > 0 && (
          <div className="flex items-center gap-1 mt-1 text-xs text-primary">
            <Sparkles className="w-3 h-3" />
            <span>+{xpReward} XP</span>
          </div>
        )}
      </div>

      <button
        onClick={onDismiss}
        className="p-1 rounded-full hover:bg-muted transition-colors"
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </button>
    </div>
  );
};

// Reward Toast Component
interface RewardToastProps {
  amount: number;
  type: 'vicoin' | 'icoin';
  reason?: string;
  onDismiss: () => void;
}

export const RewardToast: React.FC<RewardToastProps> = ({
  amount,
  type,
  reason,
  onDismiss,
}) => {
  return (
    <div className="flex items-center gap-3 p-4 rounded-2xl neu-card animate-slide-in-right">
      <div className={cn(
        'w-12 h-12 rounded-xl flex items-center justify-center font-display font-bold text-lg',
        type === 'vicoin' 
          ? 'bg-gradient-to-br from-primary to-primary/60 text-primary-foreground' 
          : 'bg-gradient-to-br from-icoin to-yellow-600 text-white'
      )}>
        {type === 'vicoin' ? 'V' : 'I'}
      </div>
      
      <div className="flex-1">
        <p className={cn(
          'font-display font-bold text-lg',
          type === 'vicoin' ? 'gradient-text' : 'gradient-text-gold'
        )}>
          +{amount} {type === 'vicoin' ? 'Vicoins' : 'Icoins'}
        </p>
        {reason && (
          <p className="text-xs text-muted-foreground">{reason}</p>
        )}
      </div>

      <button
        onClick={onDismiss}
        className="p-1 rounded-full hover:bg-muted transition-colors"
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </button>
    </div>
  );
};
