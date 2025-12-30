import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, MessageCircle, Coins, Crown, Star, Sparkles } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

interface TimedInteraction {
  id: string;
  user_id: string;
  interaction_type: 'comment' | 'like' | 'reward';
  timestamp_seconds: number;
  message?: string;
  coin_type?: string;
  amount?: number;
  user?: {
    username: string;
    avatar_url?: string;
  };
}

interface Contributor {
  user_id: string;
  username: string;
  avatar_url?: string;
  total_icoin_contributed: number;
  total_vicoin_contributed: number;
  rank: number;
}

interface TimedInteractionsOverlayProps {
  currentTime: number;
  duration: number;
  interactions: TimedInteraction[];
  topContributors: Contributor[];
  showInteractions?: boolean;
  showContributorBadges?: boolean;
  onInteractionClick?: (interaction: TimedInteraction) => void;
}

// Floating contributor badge component
const ContributorBadge: React.FC<{
  contributor: Contributor;
  index: number;
}> = ({ contributor, index }) => {
  const totalContribution = contributor.total_icoin_contributed + contributor.total_vicoin_contributed;
  
  const getBadgeStyle = () => {
    if (index === 0) return 'bg-gradient-to-r from-yellow-400 to-amber-500 text-black';
    if (index === 1) return 'bg-gradient-to-r from-gray-300 to-gray-400 text-black';
    if (index === 2) return 'bg-gradient-to-r from-amber-600 to-orange-700 text-white';
    return 'bg-background/80 text-foreground';
  };

  const getIcon = () => {
    if (index === 0) return <Crown className="w-3 h-3" />;
    if (index === 1) return <Star className="w-3 h-3" />;
    if (index === 2) return <Sparkles className="w-3 h-3" />;
    return null;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ 
        opacity: 1, 
        scale: 1, 
        y: [0, -5, 0],
      }}
      transition={{ 
        duration: 0.5,
        y: { repeat: Infinity, duration: 2 + index * 0.5, ease: "easeInOut" }
      }}
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded-full backdrop-blur-sm shadow-lg",
        getBadgeStyle()
      )}
    >
      {getIcon()}
      <Avatar className="w-5 h-5 border border-white/30">
        <AvatarImage src={contributor.avatar_url} />
        <AvatarFallback className="text-[10px]">
          {contributor.username?.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="text-xs font-medium">{contributor.username}</span>
      <span className="text-[10px] opacity-80">{totalContribution.toLocaleString()}</span>
    </motion.div>
  );
};

// Timed interaction bubble
const InteractionBubble: React.FC<{
  interaction: TimedInteraction;
  onClick?: () => void;
}> = ({ interaction, onClick }) => {
  const getInteractionIcon = () => {
    switch (interaction.interaction_type) {
      case 'like':
        return <Heart className="w-3 h-3 fill-red-500 text-red-500" />;
      case 'comment':
        return <MessageCircle className="w-3 h-3 text-blue-400" />;
      case 'reward':
        return <Coins className="w-3 h-3 text-yellow-400" />;
    }
  };

  const getInteractionStyle = () => {
    switch (interaction.interaction_type) {
      case 'like':
        return 'border-red-500/30 bg-red-500/10';
      case 'comment':
        return 'border-blue-400/30 bg-blue-400/10';
      case 'reward':
        return 'border-yellow-400/30 bg-yellow-400/10';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: -20 }}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md border cursor-pointer",
        "hover:scale-105 transition-transform",
        getInteractionStyle()
      )}
    >
      <Avatar className="w-5 h-5">
        <AvatarImage src={interaction.user?.avatar_url} />
        <AvatarFallback className="text-[10px] bg-muted">
          {interaction.user?.username?.charAt(0).toUpperCase() || '?'}
        </AvatarFallback>
      </Avatar>
      {getInteractionIcon()}
      {interaction.message && (
        <span className="text-xs text-foreground max-w-[150px] truncate">
          {interaction.message}
        </span>
      )}
      {interaction.amount && (
        <span className="text-xs font-bold text-yellow-400">
          +{interaction.amount}
        </span>
      )}
    </motion.div>
  );
};

export const TimedInteractionsOverlay: React.FC<TimedInteractionsOverlayProps> = ({
  currentTime,
  duration,
  interactions,
  topContributors,
  showInteractions = true,
  showContributorBadges = true,
  onInteractionClick,
}) => {
  // Get interactions visible at current time (within 2 second window)
  const visibleInteractions = useMemo(() => {
    if (!showInteractions) return [];
    return interactions.filter(
      (i) => Math.abs(i.timestamp_seconds - currentTime) < 2
    ).slice(0, 5); // Limit to 5 visible at once
  }, [interactions, currentTime, showInteractions]);

  // Calculate interaction density for highlight indicators
  const interactionDensity = useMemo(() => {
    if (!duration || interactions.length === 0) return [];
    
    const segments = 20;
    const segmentDuration = duration / segments;
    const density: { position: number; count: number; hasReward: boolean }[] = [];
    
    for (let i = 0; i < segments; i++) {
      const segmentStart = i * segmentDuration;
      const segmentEnd = (i + 1) * segmentDuration;
      const segmentInteractions = interactions.filter(
        (int) => int.timestamp_seconds >= segmentStart && int.timestamp_seconds < segmentEnd
      );
      
      if (segmentInteractions.length > 0) {
        density.push({
          position: (i / segments) * 100,
          count: segmentInteractions.length,
          hasReward: segmentInteractions.some(int => int.interaction_type === 'reward'),
        });
      }
    }
    
    return density;
  }, [interactions, duration]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Top contributors floating badges */}
      {showContributorBadges && topContributors.length > 0 && (
        <div className="absolute top-4 right-4 flex flex-col gap-2 pointer-events-auto">
          {topContributors.slice(0, 3).map((contributor, index) => (
            <ContributorBadge
              key={contributor.user_id}
              contributor={contributor}
              index={index}
            />
          ))}
        </div>
      )}

      {/* Timed interactions bubbles */}
      <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-2 pointer-events-auto">
        <AnimatePresence mode="popLayout">
          {visibleInteractions.map((interaction) => (
            <InteractionBubble
              key={interaction.id}
              interaction={interaction}
              onClick={() => onInteractionClick?.(interaction)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Highlight density indicator on progress bar area */}
      {showInteractions && (
        <div className="absolute bottom-16 left-0 right-0 h-1 mx-4">
          {interactionDensity.map((segment, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              className={cn(
                "absolute w-1.5 h-1.5 rounded-full -top-0.5",
                segment.hasReward ? "bg-yellow-400" : "bg-primary/60"
              )}
              style={{ 
                left: `${segment.position}%`,
                boxShadow: segment.hasReward ? '0 0 8px rgba(250, 204, 21, 0.6)' : undefined
              }}
              title={`${segment.count} interactions`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TimedInteractionsOverlay;
