import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings, Grid3X3, Video, Camera, Crown, Heart, Eye, Play, ImageIcon, BarChart3 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import { cn } from '@/lib/utils';
import { AppLogo } from '@/components/AppLogo';
import { VerificationBadge } from '@/components/VerificationBadge';
import { SettingsScreen } from '@/components/SettingsScreen';
import { CreatorDashboard } from '@/components/analytics';

type ContentTab = 'grid' | 'videos' | 'promotions' | 'rewards' | 'analytics';

// Mock user content data
const mockContent = [
  { id: '1', type: 'image', thumbnail: 'https://images.unsplash.com/photo-1614850715649-1d0106293bd1?w=300&h=300&fit=crop', likes: 234, views: 1200 },
  { id: '2', type: 'video', thumbnail: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=300&h=300&fit=crop', likes: 567, views: 3400 },
  { id: '3', type: 'image', thumbnail: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=300&h=300&fit=crop', likes: 189, views: 890 },
  { id: '4', type: 'image', thumbnail: 'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=300&h=300&fit=crop', likes: 445, views: 2100 },
  { id: '5', type: 'video', thumbnail: 'https://images.unsplash.com/photo-1682687220063-4742bd7fd538?w=300&h=300&fit=crop', likes: 678, views: 4500 },
  { id: '6', type: 'image', thumbnail: 'https://images.unsplash.com/photo-1682687221038-404670f09439?w=300&h=300&fit=crop', likes: 312, views: 1800 },
  { id: '7', type: 'image', thumbnail: 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=300&h=300&fit=crop', likes: 523, views: 2900 },
  { id: '8', type: 'video', thumbnail: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=300&h=300&fit=crop', likes: 891, views: 5600 },
  { id: '9', type: 'image', thumbnail: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=300&h=300&fit=crop', likes: 267, views: 1400 },
];

const MyPage: React.FC = () => {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const { tier, tierName } = useSubscription();
  const [activeTab, setActiveTab] = useState<ContentTab>('grid');
  const [showSettings, setShowSettings] = useState(false);

  const displayName = profile?.display_name || profile?.username || 'User';
  const username = profile?.username || user?.email?.split('@')[0] || 'user';
  const avatarUrl = profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
  const isVerified = profile?.is_verified || false;
  const isPremium = tier !== 'free';

  const tabs = [
    { id: 'grid' as const, icon: Grid3X3, label: 'Posts' },
    { id: 'videos' as const, icon: Video, label: 'Videos' },
    { id: 'analytics' as const, icon: BarChart3, label: 'Analytics' },
    { id: 'rewards' as const, icon: Crown, label: 'Rewards' },
  ];

  const filteredContent = mockContent.filter(item => {
    if (activeTab === 'grid') return true;
    if (activeTab === 'videos') return item.type === 'video';
    return true;
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <h1 className="font-display text-lg font-semibold">My Page</h1>
          <button
            onClick={() => setShowSettings(true)}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-secondary transition-colors"
          >
            <Settings className="w-5 h-5 text-foreground" />
          </button>
        </div>
      </div>

      {/* Profile Header */}
      <div className="relative">
        {/* Background gradient */}
        <div className="absolute inset-0 h-32 bg-gradient-to-b from-primary/20 via-primary/10 to-transparent" />
        
        <div className="relative px-4 pt-4 pb-6">
          {/* Avatar & Info Card */}
          <div className="flex flex-col items-center">
            {/* Avatar */}
            <div className="relative mb-4">
              <div className="w-24 h-24 rounded-full ring-4 ring-background overflow-hidden shadow-xl">
                <img 
                  src={avatarUrl} 
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              </div>
              {isVerified && (
                <div className="absolute -bottom-1 -right-1">
                  <VerificationBadge type="verified" size="lg" />
                </div>
              )}
            </div>

            {/* Name & Username */}
            <h2 className="font-display text-xl font-bold text-foreground mb-1">
              {displayName}
            </h2>
            <p className="text-muted-foreground text-sm mb-3">@{username}</p>

            {/* Premium Badge */}
            {isPremium && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-icoin/20 to-primary/20 border border-icoin/30 mb-4">
                <Crown className="w-4 h-4 text-icoin" />
                <span className="text-sm font-medium text-icoin">{tierName} Member</span>
              </div>
            )}

            {/* Stats Row */}
            <div className="flex items-center gap-6 mt-2">
              <div className="text-center">
                <p className="text-lg font-bold text-foreground">{profile?.followers_count || 0}</p>
                <p className="text-xs text-muted-foreground">Followers</p>
              </div>
              <div className="w-px h-8 bg-border" />
              <div className="text-center">
                <p className="text-lg font-bold text-foreground">{profile?.following_count || 0}</p>
                <p className="text-xs text-muted-foreground">Following</p>
              </div>
              <div className="w-px h-8 bg-border" />
              <div className="text-center">
                <p className="text-lg font-bold text-foreground">{profile?.total_likes || 0}</p>
                <p className="text-xs text-muted-foreground">Likes</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content Tabs */}
      <div className="sticky top-14 z-30 bg-background border-b border-border/50">
        <div className="flex justify-around px-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex flex-col items-center gap-1 py-3 px-4 border-b-2 transition-all',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <tab.icon className="w-5 h-5" />
              <span className="text-xs font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content Grid */}
      <div className="p-2 pb-24">
        {activeTab === 'rewards' ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Crown className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Your Rewards</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Track all your earned rewards here
            </p>
            <div className="grid grid-cols-2 gap-4 w-full max-w-xs">
              <div className="neu-card rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-vicoin">{profile?.vicoin_balance || 0}</p>
                <p className="text-xs text-muted-foreground">ViCoins</p>
              </div>
              <div className="neu-card rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-icoin">{profile?.icoin_balance || 0}</p>
                <p className="text-xs text-muted-foreground">iCoins</p>
              </div>
            </div>
          </div>
        ) : activeTab === 'analytics' ? (
          <CreatorDashboard />
        ) : filteredContent.length > 0 ? (
          <div className="grid grid-cols-3 gap-1">
            {filteredContent.map((item) => (
              <div key={item.id} className="relative aspect-square group cursor-pointer overflow-hidden rounded-sm">
                <img
                  src={item.thumbnail}
                  alt=""
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                {item.type === 'video' && (
                  <div className="absolute top-2 right-2">
                    <Play className="w-4 h-4 text-white drop-shadow-lg" fill="white" />
                  </div>
                )}
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                  <div className="flex items-center gap-1 text-white">
                    <Heart className="w-4 h-4" fill="white" />
                    <span className="text-sm font-medium">{item.likes}</span>
                  </div>
                  <div className="flex items-center gap-1 text-white">
                    <Eye className="w-4 h-4" />
                    <span className="text-sm font-medium">{item.views}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <ImageIcon className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No Content Yet</h3>
            <p className="text-muted-foreground text-sm">
              Start creating to see your content here
            </p>
          </div>
        )}
      </div>

      {/* Floating Logo Button - Right Bottom */}
      <button
        onClick={() => navigate('/')}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full glass-neon flex items-center justify-center shadow-xl hover:scale-110 transition-transform"
      >
        <AppLogo size="md" animated={false} />
      </button>

      {/* Settings Screen */}
      <SettingsScreen
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
};

export default MyPage;
