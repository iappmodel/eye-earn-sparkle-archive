import React from 'react';
import { motion } from 'framer-motion';
import { Crown, Star, Sparkles, TrendingUp, Coins, Heart, MessageCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface Contributor {
  user_id: string;
  username: string;
  avatar_url?: string;
  total_icoin_contributed: number;
  total_vicoin_contributed: number;
  interaction_count: number;
  last_interaction_at?: string;
}

interface TopContributorsPanelProps {
  contributors: Contributor[];
  isCreatorView?: boolean;
  contentTitle?: string;
  onViewProfile?: (userId: string) => void;
}

const getRankIcon = (rank: number) => {
  switch (rank) {
    case 1:
      return <Crown className="w-5 h-5 text-yellow-400" />;
    case 2:
      return <Star className="w-5 h-5 text-gray-300" />;
    case 3:
      return <Sparkles className="w-5 h-5 text-amber-600" />;
    default:
      return <span className="w-5 h-5 flex items-center justify-center text-xs text-muted-foreground">#{rank}</span>;
  }
};

const getRankStyle = (rank: number) => {
  switch (rank) {
    case 1:
      return 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-yellow-500/30';
    case 2:
      return 'bg-gradient-to-r from-gray-300/20 to-gray-400/20 border-gray-300/30';
    case 3:
      return 'bg-gradient-to-r from-amber-600/20 to-orange-700/20 border-amber-600/30';
    default:
      return 'bg-background/50 border-border/50';
  }
};

const ContributorRow: React.FC<{
  contributor: Contributor;
  rank: number;
  onViewProfile?: (userId: string) => void;
}> = ({ contributor, rank, onViewProfile }) => {
  const totalContribution = contributor.total_icoin_contributed + contributor.total_vicoin_contributed;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rank * 0.1 }}
      className={cn(
        "flex items-center gap-3 p-3 rounded-xl border backdrop-blur-sm cursor-pointer",
        "hover:scale-[1.02] transition-all duration-200",
        getRankStyle(rank)
      )}
      onClick={() => onViewProfile?.(contributor.user_id)}
    >
      {/* Rank */}
      <div className="flex-shrink-0">
        {getRankIcon(rank)}
      </div>

      {/* Avatar */}
      <Avatar className="w-10 h-10 border-2 border-white/20">
        <AvatarImage src={contributor.avatar_url} />
        <AvatarFallback className="bg-primary/20 text-primary">
          {contributor.username?.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">
          {contributor.username}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MessageCircle className="w-3 h-3" />
            {contributor.interaction_count}
          </span>
        </div>
      </div>

      {/* Contribution amount */}
      <div className="flex flex-col items-end gap-0.5">
        {contributor.total_icoin_contributed > 0 && (
          <div className="flex items-center gap-1 text-sm">
            <span className="text-blue-400 font-bold">
              {contributor.total_icoin_contributed.toLocaleString()}
            </span>
            <span className="text-[10px] text-blue-400/70">iCoin</span>
          </div>
        )}
        {contributor.total_vicoin_contributed > 0 && (
          <div className="flex items-center gap-1 text-sm">
            <span className="text-purple-400 font-bold">
              {contributor.total_vicoin_contributed.toLocaleString()}
            </span>
            <span className="text-[10px] text-purple-400/70">vCoin</span>
          </div>
        )}
        {totalContribution === 0 && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Heart className="w-3 h-3" />
            <span>Supporter</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export const TopContributorsPanel: React.FC<TopContributorsPanelProps> = ({
  contributors,
  isCreatorView = false,
  contentTitle,
  onViewProfile,
}) => {
  const totalIcoin = contributors.reduce((sum, c) => sum + c.total_icoin_contributed, 0);
  const totalVicoin = contributors.reduce((sum, c) => sum + c.total_vicoin_contributed, 0);
  const totalInteractions = contributors.reduce((sum, c) => sum + c.interaction_count, 0);

  if (contributors.length === 0) {
    return (
      <Card className="bg-background/80 backdrop-blur-sm border-border/50">
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <Coins className="w-12 h-12 text-muted-foreground/50 mb-3" />
          <p className="text-muted-foreground">No contributors yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Be the first to interact with this content!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-background/80 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <TrendingUp className="w-5 h-5 text-primary" />
          Top Contributors
          {contentTitle && (
            <span className="text-sm font-normal text-muted-foreground ml-1">
              • {contentTitle}
            </span>
          )}
        </CardTitle>
        
        {/* Stats summary */}
        <div className="flex items-center gap-4 mt-2 text-sm">
          <div className="flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-blue-400" />
            <span className="text-blue-400 font-semibold">{totalIcoin.toLocaleString()}</span>
            <span className="text-muted-foreground text-xs">iCoin</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Coins className="w-4 h-4 text-purple-400" />
            <span className="text-purple-400 font-semibold">{totalVicoin.toLocaleString()}</span>
            <span className="text-muted-foreground text-xs">vCoin</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MessageCircle className="w-4 h-4 text-muted-foreground" />
            <span className="font-semibold">{totalInteractions}</span>
            <span className="text-muted-foreground text-xs">interactions</span>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <ScrollArea className="max-h-[400px]">
          <div className="space-y-2">
            {contributors.map((contributor, index) => (
              <ContributorRow
                key={contributor.user_id}
                contributor={contributor}
                rank={index + 1}
                onViewProfile={onViewProfile}
              />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

// Sheet trigger button for embedding in media player
export const TopContributorsButton: React.FC<TopContributorsPanelProps> = (props) => {
  const topThree = props.contributors.slice(0, 3);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-2 bg-background/20 backdrop-blur-sm hover:bg-background/40"
        >
          <TrendingUp className="w-4 h-4" />
          <span className="text-xs">Top Contributors</span>
          {topThree.length > 0 && (
            <div className="flex -space-x-2">
              {topThree.map((c, i) => (
                <Avatar key={c.user_id} className="w-5 h-5 border border-background">
                  <AvatarImage src={c.avatar_url} />
                  <AvatarFallback className="text-[8px]">
                    {c.username?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
              ))}
            </div>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[350px] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-yellow-400" />
            Top Contributors
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4">
          <TopContributorsPanel {...props} />
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default TopContributorsPanel;
