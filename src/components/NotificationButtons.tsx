import React from 'react';
import { 
  Bell, 
  Check, 
  Trash2,
  Eye,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NotificationButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

// Notification Item
export const NotificationItem: React.FC<NotificationButtonProps & {
  title: string;
  message: string;
  time: string;
  isRead?: boolean;
  icon?: React.ReactNode;
  onMarkRead?: () => void;
  onDismiss?: () => void;
}> = ({ 
  onClick, 
  title, 
  message, 
  time, 
  isRead = false,
  icon,
  onMarkRead,
  onDismiss,
  className 
}) => {
  return (
    <div className={cn(
      'relative rounded-2xl p-4 transition-all',
      isRead ? 'neu-inset opacity-70' : 'neu-card',
      className
    )}>
      <div className="flex gap-3" onClick={onClick}>
        <div className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
          isRead ? 'bg-muted' : 'neu-inset'
        )}>
          {icon || <Bell className="w-5 h-5 text-primary" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className={cn(
              'font-medium text-sm',
              !isRead && 'text-foreground'
            )}>{title}</span>
            <span className="text-xs text-muted-foreground">{time}</span>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">{message}</p>
        </div>
      </div>
      
      {/* Action buttons on hover/tap */}
      <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!isRead && (
          <button
            onClick={(e) => { e.stopPropagation(); onMarkRead?.(); }}
            className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss?.(); }}
          className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
        >
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>
      
      {/* Unread indicator */}
      {!isRead && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full" />
      )}
    </div>
  );
};

// Mark All as Read
export const MarkAllReadButton: React.FC<NotificationButtonProps> = ({ 
  onClick, 
  disabled, 
  className 
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-xl transition-all',
        'text-sm text-primary hover:bg-primary/10',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <Check className="w-4 h-4" />
      <span>Mark all as read</span>
    </button>
  );
};

// Clear All Notifications
export const ClearAllButton: React.FC<NotificationButtonProps> = ({ 
  onClick, 
  disabled, 
  className 
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center gap-2 px-4 py-2 rounded-xl transition-all',
        'text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <Trash2 className="w-4 h-4" />
      <span>Clear all</span>
    </button>
  );
};

// Notification Bell with Badge
export const NotificationBellButton: React.FC<NotificationButtonProps & {
  unreadCount?: number;
}> = ({ onClick, disabled, unreadCount = 0, className }) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'relative p-2 rounded-xl transition-all hover:bg-secondary',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <Bell className="w-6 h-6" />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-destructive text-destructive-foreground text-xs font-bold rounded-full flex items-center justify-center px-1">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
};
