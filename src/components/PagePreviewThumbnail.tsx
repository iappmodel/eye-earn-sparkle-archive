// Page Preview Thumbnail - Miniature live preview of page content
import React from 'react';
import { cn } from '@/lib/utils';
import { PageSlot } from '@/contexts/UICustomizationContext';
import { 
  Home, Users, Video, Compass, Gift, Heart, Star, 
  MessageCircle, Wallet, Settings, Play, ArrowUp, ArrowDown
} from 'lucide-react';

interface PagePreviewThumbnailProps {
  page: PageSlot;
  isActive?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  onClick?: () => void;
}

const contentIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  main: Home,
  friends: Users,
  promotions: Video,
  discovery: Compass,
  rewards: Gift,
  favorites: Heart,
  following: Star,
  messages: MessageCircle,
  wallet: Wallet,
  settings: Settings,
};

// Mock content for each page type
const mockContent: Record<string, { type: 'feed' | 'grid' | 'list' | 'profile'; items: number }> = {
  main: { type: 'feed', items: 3 },
  friends: { type: 'feed', items: 3 },
  promotions: { type: 'feed', items: 2 },
  discovery: { type: 'grid', items: 6 },
  rewards: { type: 'list', items: 4 },
  favorites: { type: 'grid', items: 4 },
  following: { type: 'list', items: 5 },
  messages: { type: 'list', items: 4 },
  wallet: { type: 'profile', items: 3 },
  settings: { type: 'list', items: 5 },
};

export const PagePreviewThumbnail: React.FC<PagePreviewThumbnailProps> = ({
  page,
  isActive = false,
  size = 'md',
  showLabel = true,
  onClick,
}) => {
  const Icon = contentIcons[page.contentType] || Home;
  const content = mockContent[page.contentType] || { type: 'feed', items: 3 };
  
  const primaryColor = page.customColors?.primary || '270 95% 65%';
  const accentColor = page.customColors?.accent || '320 90% 60%';
  
  const sizeClasses = {
    sm: 'w-12 h-20',
    md: 'w-16 h-28',
    lg: 'w-20 h-36',
  };
  
  const renderFeedContent = () => (
    <div className="space-y-1 w-full px-1">
      {Array.from({ length: content.items }).map((_, i) => (
        <div 
          key={i}
          className="rounded-sm bg-foreground/10 relative overflow-hidden"
          style={{ 
            height: size === 'sm' ? '4px' : size === 'md' ? '6px' : '8px',
            animationDelay: `${i * 0.1}s`
          }}
        >
          <div 
            className="absolute inset-y-0 left-0 bg-gradient-to-r opacity-60"
            style={{
              width: `${30 + Math.random() * 50}%`,
              background: `linear-gradient(90deg, hsl(${primaryColor} / 0.4), hsl(${accentColor} / 0.3))`
            }}
          />
        </div>
      ))}
      {/* Play button indicator for video feeds */}
      {(page.contentType === 'main' || page.contentType === 'promotions' || page.contentType === 'friends') && (
        <div className="flex justify-center mt-1">
          <div 
            className="w-3 h-3 rounded-full flex items-center justify-center"
            style={{ background: `hsl(${primaryColor} / 0.3)` }}
          >
            <Play className="w-1.5 h-1.5 text-foreground/70" />
          </div>
        </div>
      )}
    </div>
  );
  
  const renderGridContent = () => (
    <div 
      className="grid gap-0.5 w-full px-1"
      style={{ gridTemplateColumns: `repeat(${content.items > 4 ? 3 : 2}, 1fr)` }}
    >
      {Array.from({ length: content.items }).map((_, i) => (
        <div 
          key={i}
          className="aspect-square rounded-sm"
          style={{ 
            background: `linear-gradient(135deg, hsl(${primaryColor} / ${0.2 + i * 0.1}), hsl(${accentColor} / ${0.1 + i * 0.05}))`
          }}
        />
      ))}
    </div>
  );
  
  const renderListContent = () => (
    <div className="space-y-0.5 w-full px-1">
      {Array.from({ length: content.items }).map((_, i) => (
        <div 
          key={i}
          className="flex items-center gap-0.5"
        >
          <div 
            className="w-2 h-2 rounded-full shrink-0"
            style={{ background: `hsl(${primaryColor} / ${0.3 + i * 0.1})` }}
          />
          <div 
            className="h-1 rounded-full flex-1"
            style={{ 
              width: `${40 + Math.random() * 40}%`,
              background: `hsl(${accentColor} / 0.2)`
            }}
          />
        </div>
      ))}
    </div>
  );
  
  const renderProfileContent = () => (
    <div className="flex flex-col items-center w-full px-1 space-y-1">
      <div 
        className="w-4 h-4 rounded-full"
        style={{ background: `linear-gradient(135deg, hsl(${primaryColor}), hsl(${accentColor}))` }}
      />
      <div className="w-full space-y-0.5">
        {Array.from({ length: content.items }).map((_, i) => (
          <div 
            key={i}
            className="h-1 rounded-full mx-auto"
            style={{ 
              width: `${50 + Math.random() * 30}%`,
              background: `hsl(${accentColor} / ${0.2 + i * 0.1})`
            }}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div 
      onClick={onClick}
      className={cn(
        'relative rounded-lg overflow-hidden border transition-all duration-300',
        'flex flex-col',
        sizeClasses[size],
        isActive 
          ? 'border-primary shadow-[0_0_15px_hsl(var(--primary)/0.4)] scale-105' 
          : 'border-border/50 hover:border-primary/50',
        onClick && 'cursor-pointer hover:scale-102'
      )}
      style={{
        background: `linear-gradient(180deg, hsl(${primaryColor} / 0.1), transparent)`
      }}
    >
      {/* Status bar mock */}
      <div 
        className="h-1 w-full flex items-center justify-center gap-0.5"
        style={{ background: `hsl(${primaryColor} / 0.1)` }}
      >
        <div className="w-2 h-0.5 rounded-full bg-foreground/20" />
      </div>
      
      {/* Header with icon */}
      <div 
        className="flex items-center justify-center py-1"
        style={{ background: `linear-gradient(180deg, hsl(${primaryColor} / 0.15), transparent)` }}
      >
        <Icon 
          className={cn(
            'text-foreground/60',
            size === 'sm' ? 'w-2 h-2' : size === 'md' ? 'w-3 h-3' : 'w-4 h-4'
          )} 
        />
      </div>
      
      {/* Content area */}
      <div className="flex-1 flex items-center justify-center py-1">
        {content.type === 'feed' && renderFeedContent()}
        {content.type === 'grid' && renderGridContent()}
        {content.type === 'list' && renderListContent()}
        {content.type === 'profile' && renderProfileContent()}
      </div>
      
      {/* Navigation indicators */}
      <div className="flex justify-center pb-1 gap-1">
        {[0, 1, 2].map((_, i) => (
          <div 
            key={i}
            className={cn(
              'rounded-full transition-all',
              i === 1 ? 'w-1.5 h-0.5' : 'w-0.5 h-0.5'
            )}
            style={{ 
              background: i === 1 
                ? `hsl(${primaryColor})` 
                : `hsl(${primaryColor} / 0.3)` 
            }}
          />
        ))}
      </div>
      
      {/* Direction indicator */}
      {page.direction !== 'center' && (
        <div 
          className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full flex items-center justify-center"
          style={{ background: `hsl(${accentColor} / 0.3)` }}
        >
          {page.direction === 'up' && <ArrowUp className="w-1 h-1" />}
          {page.direction === 'down' && <ArrowDown className="w-1 h-1" />}
        </div>
      )}
      
      {/* Label */}
      {showLabel && size !== 'sm' && (
        <div 
          className="absolute bottom-0 left-0 right-0 text-center text-[6px] font-medium truncate px-0.5 py-0.5"
          style={{ 
            background: `linear-gradient(0deg, hsl(${primaryColor} / 0.2), transparent)`,
            color: 'hsl(var(--foreground) / 0.7)'
          }}
        >
          {page.label}
        </div>
      )}
    </div>
  );
};

export default PagePreviewThumbnail;
