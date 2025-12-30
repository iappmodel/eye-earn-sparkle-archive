import React, { useState, useCallback } from 'react';
import { Plus, X, Camera, Video, Image, Megaphone, MessageCircle, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface FABAction {
  id: string;
  icon: React.ReactNode;
  label: string;
  color: string;
  onClick: () => void;
}

interface FloatingActionMenuProps {
  className?: string;
  onSettingsClick?: () => void;
}

export const FloatingActionMenu: React.FC<FloatingActionMenuProps> = ({ 
  className,
  onSettingsClick,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const { medium, light } = useHapticFeedback();

  const actions: FABAction[] = [
    {
      id: 'create',
      icon: <Camera className="w-5 h-5" />,
      label: 'Create Post',
      color: 'from-blue-500 to-cyan-500',
      onClick: () => navigate('/create'),
    },
    {
      id: 'video',
      icon: <Video className="w-5 h-5" />,
      label: 'Record Video',
      color: 'from-rose-500 to-pink-500',
      onClick: () => navigate('/studio'),
    },
    {
      id: 'story',
      icon: <Image className="w-5 h-5" />,
      label: 'Add Story',
      color: 'from-amber-500 to-orange-500',
      onClick: () => navigate('/create'),
    },
    {
      id: 'promo',
      icon: <Megaphone className="w-5 h-5" />,
      label: 'Promotion',
      color: 'from-purple-500 to-violet-500',
      onClick: () => navigate('/create'),
    },
    {
      id: 'message',
      icon: <MessageCircle className="w-5 h-5" />,
      label: 'Message',
      color: 'from-green-500 to-emerald-500',
      onClick: () => {},
    },
  ];

  const toggleMenu = useCallback(() => {
    medium();
    setIsOpen(prev => !prev);
  }, [medium]);

  const handleActionClick = useCallback((action: FABAction) => {
    light();
    setIsOpen(false);
    action.onClick();
  }, [light]);

  return (
    <div className={cn("fixed bottom-24 right-6 z-40", className)}>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-background/60 backdrop-blur-sm z-[-1] animate-fade-in"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Action buttons */}
      <div className="flex flex-col-reverse items-center gap-3 mb-3">
        {actions.map((action, index) => (
          <div
            key={action.id}
            className={cn(
              "flex items-center gap-3 transition-all duration-300",
              isOpen 
                ? "opacity-100 translate-y-0" 
                : "opacity-0 translate-y-4 pointer-events-none"
            )}
            style={{ 
              transitionDelay: isOpen ? `${index * 50}ms` : '0ms',
            }}
          >
            {/* Label */}
            <span className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium",
              "bg-background/90 backdrop-blur-sm border border-border/50",
              "shadow-lg whitespace-nowrap"
            )}>
              {action.label}
            </span>
            
            {/* Button */}
            <button
              onClick={() => handleActionClick(action)}
              className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center",
                "text-white shadow-lg",
                "bg-gradient-to-br",
                action.color,
                "hover:scale-110 active:scale-95 transition-transform"
              )}
            >
              {action.icon}
            </button>
          </div>
        ))}
      </div>

      {/* Main FAB button */}
      <button
        onClick={toggleMenu}
        className={cn(
          "w-14 h-14 rounded-full flex items-center justify-center",
          "bg-gradient-to-br from-primary to-accent",
          "text-primary-foreground shadow-xl",
          "hover:shadow-2xl hover:shadow-primary/30",
          "transition-all duration-300",
          isOpen && "rotate-45"
        )}
      >
        {isOpen ? <X className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
      </button>

      {/* Settings quick access when open */}
      {isOpen && onSettingsClick && (
        <button
          onClick={() => {
            light();
            setIsOpen(false);
            onSettingsClick();
          }}
          className={cn(
            "absolute -left-16 bottom-2 w-10 h-10 rounded-full",
            "bg-muted/80 backdrop-blur-sm border border-border/50",
            "flex items-center justify-center",
            "hover:bg-muted transition-colors",
            "animate-fade-in"
          )}
        >
          <Settings className="w-5 h-5 text-muted-foreground" />
        </button>
      )}
    </div>
  );
};
