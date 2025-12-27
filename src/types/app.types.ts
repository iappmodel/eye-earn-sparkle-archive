// Core App Types for i_app Architecture

// User & Profile Types
export interface UserProfile {
  id: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  phone_number: string | null;
  phone_verified: boolean;
  vicoin_balance: number;
  icoin_balance: number;
  total_views: number;
  total_likes: number;
  followers_count: number;
  following_count: number;
  is_verified: boolean;
  kyc_status: 'pending' | 'submitted' | 'verified' | 'rejected';
  created_at: string;
  updated_at: string;
}

// Content Types
export interface MediaContent {
  id: string;
  user_id: string;
  type: 'video' | 'image' | 'reel';
  url: string;
  thumbnail_url?: string;
  caption?: string;
  tags: string[];
  views_count: number;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  is_sponsored: boolean;
  campaign_id?: string;
  created_at: string;
}

// Reward & Campaign Types
export interface Campaign {
  id: string;
  business_id: string;
  title: string;
  description: string;
  reward_type: 'vicoin' | 'icoin' | 'discount' | 'product';
  reward_amount: number;
  required_action: 'view' | 'like' | 'share' | 'visit' | 'purchase';
  target_views: number;
  current_views: number;
  budget: number;
  spent: number;
  status: 'active' | 'paused' | 'completed' | 'expired';
  start_date: string;
  end_date: string;
  location?: GeoLocation;
  created_at: string;
}

export interface Reward {
  id: string;
  user_id: string;
  campaign_id: string;
  type: 'vicoin' | 'icoin' | 'discount' | 'product';
  amount: number;
  status: 'pending' | 'claimed' | 'expired';
  earned_at: string;
  claimed_at?: string;
  expires_at: string;
}

// Transaction Types
export interface Transaction {
  id: string;
  user_id: string;
  type: 'earn' | 'spend' | 'withdraw' | 'transfer' | 'bonus';
  coin_type: 'vicoin' | 'icoin';
  amount: number;
  description: string;
  reference_id?: string;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
}

// Location Types
export interface GeoLocation {
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  country?: string;
}

export interface NearbyBusiness {
  id: string;
  name: string;
  category: string;
  location: GeoLocation;
  distance: number;
  rating: number;
  active_campaigns: number;
  logo_url?: string;
}

// Gamification Types
export interface Challenge {
  id: string;
  title: string;
  description: string;
  type: 'daily' | 'weekly' | 'special';
  reward_amount: number;
  reward_type: 'vicoin' | 'icoin';
  target_progress: number;
  user_progress: number;
  status: 'active' | 'completed' | 'expired';
  expires_at: string;
}

export interface UserLevel {
  level: number;
  title: string;
  xp_current: number;
  xp_next_level: number;
  benefits: string[];
}

// Notification Types
export interface Notification {
  id: string;
  user_id: string;
  type: 'reward' | 'follow' | 'like' | 'comment' | 'campaign' | 'system';
  title: string;
  message: string;
  data?: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

// AI Types
export interface AIFeedPreference {
  categories: string[];
  engagement_weight: number;
  discovery_weight: number;
  reward_priority: boolean;
}

export interface AISuggestion {
  id: string;
  type: 'content' | 'campaign' | 'action';
  title: string;
  description: string;
  confidence: number;
  data: Record<string, unknown>;
}

// App State Types
export type TabId = 'home' | 'map' | 'create' | 'messages' | 'profile';

export interface AppState {
  activeTab: TabId;
  isOnline: boolean;
  hasUnreadNotifications: boolean;
  pendingRewards: number;
}
