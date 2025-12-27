import React from 'react';
import { Home, Map, Wallet, MessageCircle, User, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  return (
    <nav className={cn(
      'fixed top-0 left-0 right-0 z-50 px-4 pt-4 pb-2',
      className
    )}>
      <div className="max-w-md mx-auto">
        <div className="neu-card rounded-2xl px-2 py-2 flex items-center justify-around">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                'flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all duration-200',
                item.isCreate 
                  ? 'neu-button w-10 h-10 rounded-full flex items-center justify-center'
                  : activeTab === item.id 
                    ? 'neu-inset' 
                    : 'hover:bg-secondary/50'
              )}
            >
              <span className={cn(
                item.isCreate 
                  ? 'text-primary'
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
      </div>
    </nav>
  );
};
