import React, { useState } from 'react';
import { Flame, Music, Users, TrendingUp, Plus, Play, Clock, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface Challenge {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  participantCount: number;
  videoCount: number;
  hashtag: string;
  soundName?: string;
  soundArtist?: string;
  expiresIn?: string;
  reward?: {
    amount: number;
    type: 'vicoin' | 'icoin';
  };
  isParticipating?: boolean;
  userProgress?: number;
}

const mockChallenges: Challenge[] = [
  {
    id: '1',
    title: 'Dance Challenge',
    description: 'Show off your best dance moves to this trending beat!',
    thumbnailUrl: 'https://images.unsplash.com/photo-1547153760-18fc86324498?w=400&h=600&fit=crop',
    participantCount: 45200,
    videoCount: 128000,
    hashtag: '#DanceChallenge2024',
    soundName: 'Viral Beat',
    soundArtist: 'DJ Producer',
    expiresIn: '2 days',
    reward: { amount: 100, type: 'vicoin' },
  },
  {
    id: '2',
    title: 'Fitness Transformation',
    description: 'Share your fitness journey and inspire others',
    thumbnailUrl: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&h=600&fit=crop',
    participantCount: 23400,
    videoCount: 67000,
    hashtag: '#FitnessJourney',
    expiresIn: '5 days',
    reward: { amount: 50, type: 'icoin' },
    isParticipating: true,
    userProgress: 60,
  },
  {
    id: '3',
    title: 'Cooking Master',
    description: 'Create a dish in under 60 seconds',
    thumbnailUrl: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=600&fit=crop',
    participantCount: 18900,
    videoCount: 45000,
    hashtag: '#QuickRecipe',
    soundName: 'Kitchen Vibes',
    soundArtist: 'Ambient',
  },
  {
    id: '4',
    title: 'Pet Tricks',
    description: 'Teach your pet a cool trick and share it!',
    thumbnailUrl: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=600&fit=crop',
    participantCount: 89000,
    videoCount: 234000,
    hashtag: '#PetTricks',
    reward: { amount: 25, type: 'vicoin' },
  },
];

export const ChallengesFeed: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState<'trending' | 'new' | 'participating'>('trending');

  const handleJoinChallenge = (challenge: Challenge) => {
    toast.success(`Joined ${challenge.title}!`, {
      description: 'Create your video to participate',
    });
  };

  const formatCount = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-500" />
          <h2 className="font-bold text-lg">Challenges</h2>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Button
          variant={selectedTab === 'trending' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedTab('trending')}
          className="gap-1"
        >
          <TrendingUp className="w-4 h-4" />
          Trending
        </Button>
        <Button
          variant={selectedTab === 'new' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedTab('new')}
        >
          New
        </Button>
        <Button
          variant={selectedTab === 'participating' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedTab('participating')}
        >
          Joined
        </Button>
      </div>

      {/* Challenges List */}
      <div className="space-y-4">
        {mockChallenges.map((challenge) => (
          <div
            key={challenge.id}
            className="bg-card rounded-xl overflow-hidden border border-border"
          >
            <div className="flex">
              {/* Thumbnail */}
              <div className="relative w-32 h-40 flex-shrink-0">
                <img
                  src={challenge.thumbnailUrl}
                  alt={challenge.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                  <Play className="w-8 h-8 text-white" fill="white" />
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 p-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm">{challenge.title}</h3>
                    {challenge.reward && (
                      <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                        <Award className="w-3 h-3" />
                        {challenge.reward.amount}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                    {challenge.description}
                  </p>
                  <p className="text-xs text-primary mt-1">{challenge.hashtag}</p>
                </div>

                <div className="space-y-2">
                  {/* Stats */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {formatCount(challenge.participantCount)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Play className="w-3 h-3" />
                      {formatCount(challenge.videoCount)} videos
                    </span>
                    {challenge.expiresIn && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {challenge.expiresIn}
                      </span>
                    )}
                  </div>

                  {/* Sound */}
                  {challenge.soundName && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Music className="w-3 h-3" />
                      <span>{challenge.soundName} - {challenge.soundArtist}</span>
                    </div>
                  )}

                  {/* Progress or Join */}
                  {challenge.isParticipating ? (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span>Your progress</span>
                        <span>{challenge.userProgress}%</span>
                      </div>
                      <Progress value={challenge.userProgress} className="h-1" />
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      className="w-full gap-1"
                      onClick={() => handleJoinChallenge(challenge)}
                    >
                      <Plus className="w-4 h-4" />
                      Join Challenge
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
