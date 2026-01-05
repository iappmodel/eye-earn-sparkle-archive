import React from 'react';
import { 
  Inbox, 
  Search, 
  Image, 
  Video, 
  MessageCircle, 
  Bell, 
  Heart, 
  Bookmark,
  Wallet,
  Users,
  Trophy,
  MapPin,
  Sparkles,
  Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

type EmptyStateType = 
  | 'content' 
  | 'search' 
  | 'images' 
  | 'videos' 
  | 'messages' 
  | 'notifications'
  | 'favorites'
  | 'saved'
  | 'wallet'
  | 'followers'
  | 'achievements'
  | 'locations'
  | 'generic';

interface EmptyStateProps {
  type?: EmptyStateType;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

const emptyStateConfig: Record<EmptyStateType, { icon: React.ReactNode; title: string; description: string; color: string }> = {
  content: {
    icon: <Sparkles className="w-12 h-12" />,
    title: "No Content Yet",
    description: "Start creating to share your amazing content with the world!",
    color: "text-primary",
  },
  search: {
    icon: <Search className="w-12 h-12" />,
    title: "No Results Found",
    description: "Try adjusting your search terms or filters to find what you're looking for.",
    color: "text-muted-foreground",
  },
  images: {
    icon: <Image className="w-12 h-12" />,
    title: "No Images Yet",
    description: "Upload your first image to get started!",
    color: "text-blue-500",
  },
  videos: {
    icon: <Video className="w-12 h-12" />,
    title: "No Videos Yet",
    description: "Record or upload a video to share with your audience.",
    color: "text-rose-500",
  },
  messages: {
    icon: <MessageCircle className="w-12 h-12" />,
    title: "No Messages",
    description: "Start a conversation with someone to see your messages here.",
    color: "text-green-500",
  },
  notifications: {
    icon: <Bell className="w-12 h-12" />,
    title: "All Caught Up!",
    description: "You don't have any new notifications right now.",
    color: "text-amber-500",
  },
  favorites: {
    icon: <Heart className="w-12 h-12" />,
    title: "No Favorites Yet",
    description: "Like content to add it to your favorites!",
    color: "text-rose-500",
  },
  saved: {
    icon: <Bookmark className="w-12 h-12" />,
    title: "Nothing Saved",
    description: "Save content to access it later.",
    color: "text-violet-500",
  },
  wallet: {
    icon: <Wallet className="w-12 h-12" />,
    title: "No Transactions",
    description: "Start watching content to earn rewards!",
    color: "text-icoin",
  },
  followers: {
    icon: <Users className="w-12 h-12" />,
    title: "No Followers Yet",
    description: "Share great content to attract followers.",
    color: "text-cyan-500",
  },
  achievements: {
    icon: <Trophy className="w-12 h-12" />,
    title: "No Achievements Yet",
    description: "Complete tasks and challenges to earn achievements!",
    color: "text-icoin",
  },
  locations: {
    icon: <MapPin className="w-12 h-12" />,
    title: "No Nearby Locations",
    description: "There are no promotions in your area right now.",
    color: "text-emerald-500",
  },
  generic: {
    icon: <Inbox className="w-12 h-12" />,
    title: "Nothing Here",
    description: "Check back later for updates.",
    color: "text-muted-foreground",
  },
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  type = 'generic',
  title,
  description,
  actionLabel,
  onAction,
  className,
}) => {
  const config = emptyStateConfig[type];
  
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-12 px-6 text-center animate-fade-in",
      className
    )}>
      {/* Animated icon container */}
      <div className={cn(
        "relative mb-6",
        "before:absolute before:inset-0 before:rounded-full before:bg-gradient-to-br before:from-primary/10 before:to-accent/10 before:blur-xl before:animate-pulse"
      )}>
        <div className={cn(
          "relative w-24 h-24 rounded-full flex items-center justify-center",
          "bg-gradient-to-br from-muted/80 to-muted/40",
          "border border-border/50",
          "animate-float-3d"
        )}>
          <span className={config.color}>
            {config.icon}
          </span>
        </div>
      </div>
      
      {/* Title */}
      <h3 className="text-xl font-display font-bold text-foreground mb-2">
        {title || config.title}
      </h3>
      
      {/* Description */}
      <p className="text-muted-foreground text-sm max-w-[280px] mb-6">
        {description || config.description}
      </p>
      
      {/* Action button */}
      {actionLabel && onAction && (
        <Button 
          onClick={onAction}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
