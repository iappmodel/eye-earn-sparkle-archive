import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Crown, TrendingUp, Flame, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';

interface LeaderboardEntry {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  level: number;
  total_xp: number;
  streak_days: number;
  rank: number;
}

interface LeaderboardProps {
  className?: string;
  compact?: boolean;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({ className, compact = false }) => {
  const { user } = useAuth();
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'xp' | 'streak'>('xp');
  const [userRank, setUserRank] = useState<number | null>(null);

  useEffect(() => {
    fetchLeaderboard();
  }, [activeTab]);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      // Fetch user levels with profile data
      const { data: levels, error: levelsError } = await supabase
        .from('user_levels')
        .select('user_id, level, total_xp, streak_days')
        .order(activeTab === 'xp' ? 'total_xp' : 'streak_days', { ascending: false })
        .limit(compact ? 5 : 50);

      if (levelsError) throw levelsError;

      if (!levels || levels.length === 0) {
        setLeaderboard([]);
        setLoading(false);
        return;
      }

      // Fetch profiles for these users
      const userIds = levels.map(l => l.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, username, display_name, avatar_url')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      // Merge data
      const merged = levels.map((level, index) => {
        const profile = profiles?.find(p => p.user_id === level.user_id);
        return {
          user_id: level.user_id,
          username: profile?.username || 'Anonymous',
          display_name: profile?.display_name || profile?.username || 'Anonymous',
          avatar_url: profile?.avatar_url,
          level: level.level,
          total_xp: level.total_xp,
          streak_days: level.streak_days,
          rank: index + 1
        };
      });

      setLeaderboard(merged);

      // Find current user's rank
      if (user) {
        const userEntry = merged.find(e => e.user_id === user.id);
        setUserRank(userEntry?.rank || null);
      }
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-5 h-5 text-yellow-500" />;
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />;
      case 3:
        return <Medal className="w-5 h-5 text-amber-600" />;
      default:
        return <span className="w-5 text-center text-sm font-bold text-muted-foreground">{rank}</span>;
    }
  };

  const getRankBg = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-yellow-500/30';
      case 2:
        return 'bg-gradient-to-r from-gray-400/20 to-gray-500/20 border-gray-400/30';
      case 3:
        return 'bg-gradient-to-r from-amber-600/20 to-orange-600/20 border-amber-600/30';
      default:
        return 'bg-card border-border/50';
    }
  };

  if (loading) {
    return (
      <div className={cn('space-y-3', className)}>
        {[...Array(compact ? 3 : 5)].map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {!compact && (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'xp' | 'streak')}>
          <TabsList className="w-full">
            <TabsTrigger value="xp" className="flex-1 gap-2">
              <TrendingUp className="w-4 h-4" />
              Top XP
            </TabsTrigger>
            <TabsTrigger value="streak" className="flex-1 gap-2">
              <Flame className="w-4 h-4" />
              Top Streaks
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      <div className="space-y-2">
        {leaderboard.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No leaderboard data yet</p>
          </div>
        ) : (
          leaderboard.map((entry) => (
            <div
              key={entry.user_id}
              className={cn(
                'flex items-center gap-3 p-3 rounded-xl border transition-all',
                getRankBg(entry.rank),
                entry.user_id === user?.id && 'ring-2 ring-primary'
              )}
            >
              <div className="w-8 flex justify-center">
                {getRankIcon(entry.rank)}
              </div>
              
              <Avatar className="h-10 w-10">
                <AvatarImage src={entry.avatar_url || undefined} />
                <AvatarFallback>
                  {entry.display_name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">
                  {entry.display_name}
                  {entry.user_id === user?.id && (
                    <span className="text-xs text-primary ml-2">(You)</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  Level {entry.level}
                </p>
              </div>

              <div className="text-right">
                <p className="font-bold text-primary">
                  {activeTab === 'xp' ? (
                    <>{entry.total_xp.toLocaleString()} XP</>
                  ) : (
                    <>{entry.streak_days} days</>
                  )}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {userRank && userRank > (compact ? 5 : 50) && (
        <div className="mt-4 p-3 rounded-xl bg-primary/10 border border-primary/20 text-center">
          <p className="text-sm">
            Your rank: <span className="font-bold text-primary">#{userRank}</span>
          </p>
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
