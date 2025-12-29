import React from 'react';
import { Home, Compass, MessageCircle, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useControlsVisibility } from './FloatingControls';
import { AppLogo } from './AppLogo';

interface NavItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  isLogo?: boolean;
}

interface BottomNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  className?: string;
}

const navItems: NavItem[] = [
  { id: 'home', icon: <Home className="w-5 h-5" />, label: 'Home' },
  { id: 'discover', icon: <Compass className="w-5 h-5" />, label: 'Discover' },
  { id: 'logo', icon: null, label: '', isLogo: true },
  { id: 'messages', icon: <MessageCircle className="w-5 h-5" />, label: 'Messages' },
  { id: 'profile', icon: <User className="w-5 h-5" />, label: 'Profile' },
];

export const BottomNavigation: React.FC<BottomNavigationProps> = ({
  activeTab,
  onTabChange,
  className,
}) => {
  const { isVisible } = useControlsVisibility();

  return (
    <nav className={cn(
      'fixed bottom-6 left-1/2 -translate-x-1/2 z-50 transition-all duration-300',
      isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none',
      className
    )}>
      <div className="glass-neon rounded-full px-3 py-2 flex items-center gap-1">
        {navItems.map((item) => (
          <React.Fragment key={item.id}>
            {item.isLogo ? (
              <div className="mx-2 -mt-6 relative">
                <div className="absolute inset-0 -z-10 bg-gradient-to-b from-neon-purple/30 to-transparent blur-xl scale-150" />
                <AppLogo size="lg" animated={true} />
              </div>
            ) : (
              <button
                onClick={() => onTabChange(item.id)}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-3 py-2 rounded-full transition-all duration-200',
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
            )}
          </React.Fragment>
        ))}
      </div>
    </nav>
  );
};
