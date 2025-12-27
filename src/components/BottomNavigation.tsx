import React from 'react';
import { Home, Map, MessageCircle, User, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useControlsVisibility } from './FloatingControls';

interface NavItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  isCreate?: boolean;
}

interface BottomNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  className?: string;
}

const navItems: NavItem[] = [
  { id: 'home', icon: <Home className="w-5 h-5" />, label: 'Home' },
  { id: 'map', icon: <Map className="w-5 h-5" />, label: 'Map' },
  { id: 'create', icon: <Plus className="w-6 h-6" />, label: 'Create', isCreate: true },
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
      <div className="neu-card rounded-full px-3 py-2 flex items-center gap-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id)}
            className={cn(
              'flex flex-col items-center gap-0.5 px-3 py-2 rounded-full transition-all duration-200',
              item.isCreate 
                ? 'neu-button w-12 h-12 rounded-full flex items-center justify-center mx-1 bg-primary text-primary-foreground'
                : activeTab === item.id 
                  ? 'neu-inset' 
                  : 'hover:bg-secondary/50'
            )}
          >
            <span className={cn(
              item.isCreate 
                ? 'text-primary-foreground'
                : activeTab === item.id 
                  ? 'text-primary' 
                  : 'text-muted-foreground'
            )}>
              {item.icon}
            </span>
            {!item.isCreate && (
              <span className={cn(
                'text-[9px] font-medium',
                activeTab === item.id ? 'text-primary' : 'text-muted-foreground'
              )}>
                {item.label}
              </span>
            )}
          </button>
        ))}
      </div>
    </nav>
  );
};
