import React, { useState } from 'react';
import { ArrowLeft, Settings, MapPin, Phone, Globe, Mail, Clock, Star, TrendingUp, DollarSign, Users, BarChart3, Calendar, Edit, Share2, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface BusinessStats {
  followers: number;
  views: number;
  engagement: number;
  revenue: number;
  promotionReach: number;
  avgRating: number;
  totalReviews: number;
}

interface BusinessHours {
  day: string;
  open: string;
  close: string;
  isClosed?: boolean;
}

interface BusinessProfileData {
  id: string;
  name: string;
  username: string;
  avatarUrl?: string;
  coverUrl?: string;
  category: string;
  description: string;
  address: string;
  phone: string;
  website: string;
  email: string;
  hours: BusinessHours[];
  stats: BusinessStats;
  isVerified: boolean;
}

const mockBusinessData: BusinessProfileData = {
  id: '1',
  name: 'Urban Coffee House',
  username: 'urbancoffeehouse',
  avatarUrl: 'https://images.unsplash.com/photo-1559305616-3f99cd43e353?w=200&h=200&fit=crop',
  coverUrl: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1200&h=400&fit=crop',
  category: 'Coffee Shop',
  description: 'Artisanal coffee & fresh pastries in the heart of downtown. Family-owned since 2015.',
  address: '123 Main Street, Downtown',
  phone: '+1 (555) 123-4567',
  website: 'www.urbancoffee.com',
  email: 'hello@urbancoffee.com',
  hours: [
    { day: 'Monday', open: '7:00 AM', close: '8:00 PM' },
    { day: 'Tuesday', open: '7:00 AM', close: '8:00 PM' },
    { day: 'Wednesday', open: '7:00 AM', close: '8:00 PM' },
    { day: 'Thursday', open: '7:00 AM', close: '8:00 PM' },
    { day: 'Friday', open: '7:00 AM', close: '10:00 PM' },
    { day: 'Saturday', open: '8:00 AM', close: '10:00 PM' },
    { day: 'Sunday', open: '8:00 AM', close: '6:00 PM' },
  ],
  stats: {
    followers: 12500,
    views: 45000,
    engagement: 8.5,
    revenue: 15420,
    promotionReach: 28000,
    avgRating: 4.8,
    totalReviews: 342,
  },
  isVerified: true,
};

interface BusinessProfileProps {
  isOpen: boolean;
  onClose: () => void;
  isOwnProfile?: boolean;
}

export const BusinessProfile: React.FC<BusinessProfileProps> = ({ isOpen, onClose, isOwnProfile = false }) => {
  const [business] = useState<BusinessProfileData>(mockBusinessData);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background overflow-y-auto">
      {/* Cover Photo */}
      <div className="relative h-48">
        <img
          src={business.coverUrl}
          alt="Cover"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 to-transparent" />
        
        {/* Header Actions */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={onClose} className="bg-black/30 text-white">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" className="bg-black/30 text-white">
              <Share2 className="w-5 h-5" />
            </Button>
            {isOwnProfile && (
              <Button variant="ghost" size="icon" className="bg-black/30 text-white">
                <Settings className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Profile Info */}
      <div className="relative px-4 pb-4">
        {/* Avatar */}
        <div className="absolute -top-16 left-4">
          <Avatar className="w-32 h-32 border-4 border-background">
            <AvatarImage src={business.avatarUrl} />
            <AvatarFallback className="text-2xl">{business.name.slice(0, 2)}</AvatarFallback>
          </Avatar>
        </div>

        {/* Edit Button */}
        {isOwnProfile && (
          <div className="flex justify-end pt-2">
            <Button variant="outline" size="sm" className="gap-1">
              <Edit className="w-4 h-4" />
              Edit Profile
            </Button>
          </div>
        )}

        {/* Name & Category */}
        <div className="mt-16 space-y-2">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{business.name}</h1>
            {business.isVerified && (
              <Badge variant="default" className="gap-1">
                <Star className="w-3 h-3" fill="currentColor" />
                Verified
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">@{business.username} • {business.category}</p>
          <p className="text-sm">{business.description}</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4 mt-6 p-4 bg-muted/50 rounded-xl">
          <div className="text-center">
            <p className="font-bold text-lg">{formatNumber(business.stats.followers)}</p>
            <p className="text-xs text-muted-foreground">Followers</p>
          </div>
          <div className="text-center">
            <p className="font-bold text-lg">{business.stats.avgRating}</p>
            <p className="text-xs text-muted-foreground">Rating</p>
          </div>
          <div className="text-center">
            <p className="font-bold text-lg">{business.stats.totalReviews}</p>
            <p className="text-xs text-muted-foreground">Reviews</p>
          </div>
          <div className="text-center">
            <p className="font-bold text-lg">{business.stats.engagement}%</p>
            <p className="text-xs text-muted-foreground">Engagement</p>
          </div>
        </div>

        {/* Contact Info */}
        <div className="mt-6 space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            <span>{business.address}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Phone className="w-4 h-4 text-muted-foreground" />
            <span>{business.phone}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Globe className="w-4 h-4 text-muted-foreground" />
            <a href={`https://${business.website}`} className="text-primary">{business.website}</a>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <span>{business.email}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-6">
          <Button className="flex-1">Follow</Button>
          <Button variant="outline" className="flex-1">Message</Button>
          <Button variant="outline" size="icon">
            <QrCode className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue={isOwnProfile ? "analytics" : "about"} className="mt-4">
        <TabsList className="w-full justify-start px-4 bg-transparent">
          <TabsTrigger value="about">About</TabsTrigger>
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="promos">Promos</TabsTrigger>
          {isOwnProfile && <TabsTrigger value="analytics">Analytics</TabsTrigger>}
        </TabsList>

        <TabsContent value="about" className="p-4 space-y-6">
          {/* Business Hours */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Business Hours
            </h3>
            <div className="space-y-2">
              {business.hours.map((h) => (
                <div key={h.day} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{h.day}</span>
                  <span>{h.isClosed ? 'Closed' : `${h.open} - ${h.close}`}</span>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="posts" className="p-4">
          <div className="grid grid-cols-3 gap-1">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="aspect-square bg-muted rounded-lg" />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="promos" className="p-4">
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No active promotions</p>
          </div>
        </TabsContent>

        {isOwnProfile && (
          <TabsContent value="analytics" className="p-4 space-y-6">
            {/* Revenue Card */}
            <div className="bg-gradient-to-r from-primary/20 to-primary/5 p-4 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">This Month's Revenue</span>
                <TrendingUp className="w-4 h-4 text-green-500" />
              </div>
              <p className="text-3xl font-bold">${business.stats.revenue.toLocaleString()}</p>
              <p className="text-sm text-green-500">+12% from last month</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted/50 rounded-xl">
                <Users className="w-5 h-5 text-primary mb-2" />
                <p className="text-2xl font-bold">{formatNumber(business.stats.views)}</p>
                <p className="text-xs text-muted-foreground">Profile Views</p>
              </div>
              <div className="p-4 bg-muted/50 rounded-xl">
                <BarChart3 className="w-5 h-5 text-primary mb-2" />
                <p className="text-2xl font-bold">{formatNumber(business.stats.promotionReach)}</p>
                <p className="text-xs text-muted-foreground">Promo Reach</p>
              </div>
            </div>

            {/* Engagement */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Engagement Rate</span>
                <span className="font-medium">{business.stats.engagement}%</span>
              </div>
              <Progress value={business.stats.engagement * 10} className="h-2" />
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};
