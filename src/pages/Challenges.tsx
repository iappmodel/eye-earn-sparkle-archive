import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, Clock, Users, Flame, Star, ChevronRight, Play, Gift } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface Challenge {
  id: string;
  title: string;
  description: string;
  hashtag: string;
  thumbnailUrl: string;
  participantCount: number;
  prizePool: number;
  prizeType: 'icoin' | 'vicoin';
  endsAt: Date;
  difficulty: 'easy' | 'medium' | 'hard';
  category: 'active' | 'upcoming' | 'completed';
  progress?: number;
  joined?: boolean;
}

const mockChallenges: Challenge[] = [
  {
    id: '1',
    title: 'Dance Like Nobody\'s Watching',
    description: 'Show off your best dance moves! Get creative and have fun.',
    hashtag: 'DanceChallenge2024',
    thumbnailUrl: 'https://images.unsplash.com/photo-1547153760-18fc86324498?w=400&h=600&fit=crop',
    participantCount: 12500,
    prizePool: 50000,
    prizeType: 'icoin',
    endsAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    difficulty: 'easy',
    category: 'active',
    progress: 45,
    joined: true,
  },
  {
    id: '2',
    title: 'Cooking in 60 Seconds',
    description: 'Make a complete dish in under 60 seconds. Time-lapse allowed!',
    hashtag: 'QuickCooking',
    thumbnailUrl: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=600&fit=crop',
    participantCount: 8200,
    prizePool: 30000,
    prizeType: 'icoin',
    endsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    difficulty: 'medium',
    category: 'active',
  },
  {
    id: '3',
    title: 'Pet Tricks Showdown',
    description: 'Train your pet to do an amazing trick and capture it on video.',
    hashtag: 'PetTricks',
    thumbnailUrl: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=600&fit=crop',
    participantCount: 5600,
    prizePool: 25000,
    prizeType: 'vicoin',
    endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    difficulty: 'hard',
    category: 'active',
  },
  {
    id: '4',
    title: 'Sunset Photography',
    description: 'Capture the most beautiful sunset in your area.',
    hashtag: 'SunsetVibes',
    thumbnailUrl: 'https://images.unsplash.com/photo-1495616811223-4d98c6e9c869?w=400&h=600&fit=crop',
    participantCount: 0,
    prizePool: 40000,
    prizeType: 'icoin',
    endsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    difficulty: 'easy',
    category: 'upcoming',
  },
  {
    id: '5',
    title: 'Lip Sync Battle',
    description: 'Best lip sync performance wins!',
    hashtag: 'LipSyncKing',
    thumbnailUrl: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=400&h=600&fit=crop',
    participantCount: 15000,
    prizePool: 75000,
    prizeType: 'icoin',
    endsAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    difficulty: 'medium',
    category: 'completed',
  },
];

const Challenges = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'active' | 'upcoming' | 'completed'>('active');

  const filteredChallenges = mockChallenges.filter(c => c.category === activeTab);

  const formatTimeRemaining = (date: Date) => {
    const diff = date.getTime() - Date.now();
    if (diff <= 0) return 'Ended';
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    if (days > 0) return `${days}d ${hours}h left`;
    return `${hours}h left`;
  };

  const formatCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const getDifficultyColor = (difficulty: Challenge['difficulty']) => {
    switch (difficulty) {
      case 'easy': return 'bg-green-500/10 text-green-500';
      case 'medium': return 'bg-yellow-500/10 text-yellow-500';
      case 'hard': return 'bg-red-500/10 text-red-500';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Challenges
            </h1>
            <p className="text-sm text-muted-foreground">Compete and win rewards</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="w-full">
            <TabsTrigger value="active" className="flex-1">
              <Flame className="w-4 h-4 mr-1.5 text-orange-500" />
              Active
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="flex-1">
              <Clock className="w-4 h-4 mr-1.5" />
              Upcoming
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex-1">
              <Star className="w-4 h-4 mr-1.5" />
              Past
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <ScrollArea className="h-[calc(100vh-140px)]">
        <div className="p-4 space-y-4">
          {filteredChallenges.length === 0 ? (
            <div className="text-center py-12">
              <Trophy className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No challenges in this category</p>
            </div>
          ) : (
            filteredChallenges.map(challenge => (
              <div
                key={challenge.id}
                className="rounded-2xl overflow-hidden bg-card border border-border"
              >
                {/* Banner Image */}
                <div className="relative h-40">
                  <img
                    src={challenge.thumbnailUrl}
                    alt={challenge.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  
                  {/* Badges */}
                  <div className="absolute top-3 left-3 flex gap-2">
                    <Badge className={getDifficultyColor(challenge.difficulty)}>
                      {challenge.difficulty}
                    </Badge>
                    {challenge.joined && (
                      <Badge className="bg-primary text-primary-foreground">Joined</Badge>
                    )}
                  </div>

                  {/* Prize Pool */}
                  <div className="absolute top-3 right-3 bg-black/60 backdrop-blur rounded-lg px-3 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <Gift className="w-4 h-4 text-yellow-500" />
                      <span className="font-bold text-white">
                        {formatCount(challenge.prizePool)} {challenge.prizeType}
                      </span>
                    </div>
                  </div>

                  {/* Title */}
                  <div className="absolute bottom-3 left-3 right-3">
                    <h3 className="text-lg font-bold text-white">{challenge.title}</h3>
                    <p className="text-white/80 text-sm">#{challenge.hashtag}</p>
                  </div>
                </div>

                {/* Content */}
                <div className="p-4">
                  <p className="text-sm text-muted-foreground mb-3">{challenge.description}</p>
                  
                  <div className="flex items-center justify-between text-sm mb-3">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Users className="w-4 h-4" />
                      {formatCount(challenge.participantCount)} participants
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="w-4 h-4" />
                      {formatTimeRemaining(challenge.endsAt)}
                    </div>
                  </div>

                  {/* Progress (if joined) */}
                  {challenge.joined && challenge.progress !== undefined && (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Your progress</span>
                        <span className="font-medium">{challenge.progress}%</span>
                      </div>
                      <Progress value={challenge.progress} className="h-2" />
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      variant={challenge.joined ? 'outline' : 'default'}
                      onClick={() => navigate(`/tag/${challenge.hashtag}`)}
                    >
                      {challenge.joined ? 'View Entries' : 'Join Challenge'}
                    </Button>
                    {challenge.category === 'active' && (
                      <Button
                        size="icon"
                        onClick={() => navigate('/create', { state: { hashtag: challenge.hashtag } })}
                      >
                        <Play className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default Challenges;
