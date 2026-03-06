import React, { useState, useRef, useCallback } from 'react';
import { Home, Compass, MessageCircle, User, Plus, Camera, FileText, Zap, Settings, Bookmark, Bell, Wallet } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useControlsVisibility } from './FloatingControls';
import { AppLogo } from './AppLogo';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface NavItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  isLogo?: boolean;
  shortcuts?: { label: string; icon: React.ReactNode; action: () => void; badge?: number }[];
}

interface BottomNavigationProps {
  activeTab: string;
  onTabChange: (tab: string, options?: { openNewChat?: boolean }) => void;
  messagesUnreadCount?: number;
  notificationsUnreadCount?: number;
  /** Total count for Bookmarks shortcut badge (saved + watch later + liked, or just saved + watch later) */
  bookmarksCount?: number;
  /** Home long-press "Refresh" calls this for a soft refresh (e.g. refetch feed). If omitted, Refresh does nothing (no full page reload). */
  onHomeRefresh?: () => void | Promise<void>;
  className?: string;
}

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onTabChange,
  messagesUnreadCount = 0,
  notificationsUnreadCount = 0,
  bookmarksCount = 0,
  onHomeRefresh,
  className,
}) => {
  const { isVisible } = useControlsVisibility();
  const navigate = useNavigate();
  const haptic = useHapticFeedback();
  const [activeShortcut, setActiveShortcut] = useState<string | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const longPressTriggered = useRef(false);

  const homeRefreshAction = useCallback(() => {
    if (onHomeRefresh) {
      Promise.resolve(onHomeRefresh()).catch(() => {});
    }
    // No full page reload when onHomeRefresh is not provided (e.g. AppShell)
  }, [onHomeRefresh]);

  const navItems: NavItem[] = [
    { 
      id: 'home', 
      icon: <Home className="w-5 h-5" />, 
      label: 'Home',
      shortcuts: [
        { label: 'Refresh', icon: <Zap className="w-4 h-4" />, action: homeRefreshAction },
        { label: 'Bookmarks', icon: <Bookmark className="w-4 h-4" />, action: () => onTabChange('bookmarks'), badge: bookmarksCount > 0 ? bookmarksCount : undefined },
      ]
    },
    { 
      id: 'discover', 
      icon: <Compass className="w-5 h-5" />, 
      label: 'iGO',
      shortcuts: [
        { label: 'Near Me', icon: <Compass className="w-4 h-4" />, action: () => onTabChange('discover') },
      ]
    },
    { id: 'logo', icon: null, label: '', isLogo: true },
    { 
      id: 'messages', 
      icon: <MessageCircle className="w-5 h-5" />, 
      label: 'Messages',
      shortcuts: [
        { label: 'New Chat', icon: <Plus className="w-4 h-4" />, action: () => onTabChange('messages', { openNewChat: true }) },
        { label: 'Notifications', icon: <Bell className="w-4 h-4" />, action: () => onTabChange('notifications'), badge: notificationsUnreadCount },
      ]
    },
    { 
      id: 'profile', 
      icon: <User className="w-5 h-5" />, 
      label: 'Profile',
      shortcuts: [
        { label: 'Settings', icon: <Settings className="w-4 h-4" />, action: () => navigate('/my-page?tab=settings') },
        { label: 'Wallet', icon: <Wallet className="w-4 h-4" />, action: () => navigate('/my-page?tab=wallet') },
      ]
    },
  ];

  const handleLogoClick = () => {
    haptic.light();
    onTabChange('logo');
  };

  const handleLongPressStart = useCallback((itemId: string) => {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      haptic.medium();
      setActiveShortcut(itemId);
    }, 500);
  }, [haptic]);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleShortcutSelect = useCallback((action: () => void) => {
    haptic.light();
    action();
    setActiveShortcut(null);
  }, [haptic]);

  const handleClick = useCallback((item: NavItem) => {
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    haptic.light();
    onTabChange(item.id);
  }, [onTabChange]);

  return (
    <>
      {/* Shortcut popup overlay */}
      {activeShortcut && (
        <div 
          className="fixed inset-0 z-40"
          onClick={() => setActiveShortcut(null)}
        />
      )}

      <nav className={cn(
        'fixed left-1/2 -translate-x-1/2 z-50 transition-all duration-300',
        'bottom-[max(1.5rem,env(safe-area-inset-bottom,6px))]',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none',
        className
      )}>
        <div className="glass-neon rounded-full px-2 sm:px-3 py-2 flex items-center gap-0.5 sm:gap-1">
          {navItems.map((item) => (
            <React.Fragment key={item.id}>
              {item.isLogo ? (
                <button
                  onClick={handleLogoClick}
                  className={cn(
                    'flex flex-col items-center justify-center px-3 py-2 rounded-full transition-all duration-200',
                    'hover:bg-primary/10'
                  )}
                >
                  <AppLogo size="sm" animated={false} />
                </button>
              ) : (
                <div className="relative">
                  {item.id === 'messages' && messagesUnreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                      {messagesUnreadCount > 99 ? '99+' : messagesUnreadCount}
                    </span>
                  )}
                  <button
                    onClick={() => handleClick(item)}
                    onTouchStart={() => handleLongPressStart(item.id)}
                    onTouchEnd={handleLongPressEnd}
                    onMouseDown={() => handleLongPressStart(item.id)}
                    onMouseUp={handleLongPressEnd}
                    onMouseLeave={handleLongPressEnd}
                    className={cn(
                      'flex flex-col items-center gap-0.5 px-3 py-2.5 rounded-full transition-all duration-200 min-w-[44px] min-h-[44px] justify-center',
                      activeTab === item.id 
                        ? 'bg-primary/20 neon-border' 
                        : 'hover:bg-primary/10'
                    )}
                  >
                    <span className={cn(
                      'transition-all duration-200',
                      activeTab === item.id 
                        ? 'text-primary drop-shadow-[0_0_8px_hsl(270_95%_65%/0.8)]' 
                        : 'text-muted-foreground'
                    )}>
                      {item.icon}
                    </span>
                    <span className={cn(
                      'text-[9px] font-medium transition-colors',
                      activeTab === item.id ? 'text-primary' : 'text-muted-foreground'
                    )}>
                      {item.label}
                    </span>
                  </button>

                  {/* Shortcuts popup */}
                  {activeShortcut === item.id && item.shortcuts && (
                    <div className={cn(
                      'absolute bottom-full left-1/2 -translate-x-1/2 mb-2',
                      'glass-card rounded-xl p-2 min-w-[120px]',
                      'animate-scale-in origin-bottom'
                    )}>
                      {item.shortcuts.map((shortcut, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleShortcutSelect(shortcut.action)}
                          className={cn(
                            'flex items-center gap-2 w-full px-3 py-2 rounded-lg',
                            'text-sm text-foreground hover:bg-primary/10 transition-colors'
                          )}
                        >
                          {shortcut.icon}
                          <span className="flex-1 text-left">{shortcut.label}</span>
                          {shortcut.badge != null && shortcut.badge > 0 && (
                            <span className="min-w-[18px] h-[18px] px-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                              {shortcut.badge > 99 ? '99+' : shortcut.badge}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </nav>
    </>
  );
};
