import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, MapPin, Clock, Coins, Star, Heart, Share2, 
  Navigation, Phone, Globe, Camera, MessageSquare, CheckCircle2,
  ChevronRight, Users, Award, Flame
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { CategoryIcon, getCategoryInfo } from './PromotionCategories';
import { CheckInButton } from './CheckInButton';
import { CheckInStreak, getStreakBonus } from './CheckInStreak';
import { useFavoriteLocation } from './FavoriteLocations';
import { cn } from '@/lib/utils';

interface Promotion {
  id: string;
  business_name: string;
  description: string | null;
  reward_type: string;
  reward_amount: number;
  required_action: string;
  latitude: number;
  longitude: number;
  address: string | null;
  category: string | null;
  image_url: string | null;
  current_claims: number;
  max_claims: number | null;
  expires_at: string | null;
}

interface Review {
  id: string;
  user_id: string;
  rating: number;
  comment: string | null;
  photos: string[];
  helpful_count: number;
  created_at: string;
  profile?: {
    username: string | null;
    avatar_url: string | null;
  };
}

interface PromotionDetailsProps {
  promotionId?: string;
  onClose?: () => void;
  isModal?: boolean;
}

export function PromotionDetails({ promotionId: propId, onClose, isModal = false }: PromotionDetailsProps) {
  const { id: paramId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { toggleFavorite, isFavorite } = useFavoriteLocation();
  
  const promotionId = propId || paramId;
  
  const [promotion, setPromotion] = useState<Promotion | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [userStreak, setUserStreak] = useState({ current: 0, longest: 0 });
  const [loading, setLoading] = useState(true);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
  const [hasCheckedIn, setHasCheckedIn] = useState(false);

  useEffect(() => {
    if (promotionId) {
      loadPromotion();
      loadReviews();
      loadUserStreak();
      checkUserCheckedIn();
    }
  }, [promotionId, user?.id]);

  const loadPromotion = async () => {
    if (!promotionId) return;
    
    try {
      const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .eq('id', promotionId)
        .single();

      if (error) throw error;
      setPromotion(data);
    } catch (error) {
      console.error('Error loading promotion:', error);
      toast.error('Failed to load promotion');
    } finally {
      setLoading(false);
    }
  };

  const loadReviews = async () => {
    if (!promotionId) return;

    try {
      const { data, error } = await supabase
        .from('promotion_reviews')
        .select('*')
        .eq('promotion_id', promotionId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      // Load profiles for reviews
      const userIds = [...new Set((data || []).map(r => r.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, username, avatar_url')
        .in('user_id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);

      setReviews((data || []).map(r => ({
        ...r,
        profile: profileMap.get(r.user_id) as Review['profile']
      })));
    } catch (error) {
      console.error('Error loading reviews:', error);
    }
  };

  const loadUserStreak = async () => {
    if (!user?.id) return;

    try {
      const { data } = await supabase
        .from('user_levels')
        .select('streak_days, longest_streak')
        .eq('user_id', user.id)
        .single();

      if (data) {
        setUserStreak({ current: data.streak_days, longest: data.longest_streak });
      }
    } catch (error) {
      console.error('Error loading streak:', error);
    }
  };

  const checkUserCheckedIn = async () => {
    if (!user?.id || !promotionId) return;

    try {
      const { data } = await supabase
        .from('promotion_checkins')
        .select('id')
        .eq('user_id', user.id)
        .eq('promotion_id', promotionId)
        .eq('status', 'verified')
        .limit(1);

      setHasCheckedIn((data?.length || 0) > 0);
    } catch (error) {
      console.error('Error checking check-in status:', error);
    }
  };

  const submitReview = async () => {
    if (!user?.id || !promotionId) {
      toast.error('Please sign in to leave a review');
      return;
    }

    if (!hasCheckedIn) {
      toast.error('You need to check in before leaving a review');
      return;
    }

    setSubmittingReview(true);
    try {
      const { error } = await supabase
        .from('promotion_reviews')
        .insert({
          promotion_id: promotionId,
          user_id: user.id,
          rating: newReview.rating,
          comment: newReview.comment || null,
        });

      if (error) throw error;

      toast.success('Review submitted!');
      setNewReview({ rating: 5, comment: '' });
      loadReviews();
    } catch (error: any) {
      console.error('Error submitting review:', error);
      toast.error(error.message || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const openDirections = () => {
    if (!promotion) return;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const url = isIOS
      ? `maps://maps.apple.com/?daddr=${promotion.latitude},${promotion.longitude}`
      : `https://www.google.com/maps/dir/?api=1&destination=${promotion.latitude},${promotion.longitude}`;
    window.open(url, '_blank');
  };

  const sharePromotion = async () => {
    if (!promotion) return;
    
    const shareData = {
      title: promotion.business_name,
      text: `Check out this promotion: ${promotion.reward_amount} ${promotion.reward_type}!`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success('Link copied to clipboard!');
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleBack = () => {
    if (onClose) {
      onClose();
    } else {
      navigate(-1);
    }
  };

  const avgRating = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  const streakBonus = getStreakBonus(userStreak.current);

  if (loading) {
    return (
      <div className={cn('min-h-screen bg-background', isModal && 'rounded-t-3xl')}>
        <div className="p-4 space-y-4">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (!promotion) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Promotion not found</h2>
          <Button onClick={handleBack}>Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('min-h-screen bg-background', isModal && 'rounded-t-3xl overflow-hidden')}>
      {/* Header Image */}
      <div className="relative h-56 bg-gradient-to-br from-primary/20 to-primary/5">
        {promotion.image_url ? (
          <img 
            src={promotion.image_url} 
            alt={promotion.business_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <CategoryIcon category={promotion.category} size="lg" />
          </div>
        )}
        
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
        
        {/* Back button */}
        <button
          onClick={handleBack}
          className="absolute top-4 left-4 w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* Action buttons */}
        <div className="absolute top-4 right-4 flex gap-2">
          <button
            onClick={() => toggleFavorite({
              id: promotion.id,
              business_name: promotion.business_name,
              latitude: promotion.latitude,
              longitude: promotion.longitude,
              address: promotion.address || undefined,
              category: promotion.category || undefined,
            })}
            className={cn(
              'w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center',
              isFavorite(promotion.id) && 'text-red-500'
            )}
          >
            <Heart className={cn('w-5 h-5', isFavorite(promotion.id) && 'fill-current')} />
          </button>
          <button
            onClick={sharePromotion}
            className="w-10 h-10 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center"
          >
            <Share2 className="w-5 h-5" />
          </button>
        </div>

        {/* Reward badge */}
        <div className="absolute bottom-4 right-4 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold flex items-center gap-2">
          <Coins className="w-5 h-5" />
          <span>{promotion.reward_amount} {promotion.reward_type}</span>
          {streakBonus > 0 && (
            <Badge variant="secondary" className="bg-green-500 text-white">
              +{streakBonus}%
            </Badge>
          )}
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-14rem)]">
        <div className="p-4 space-y-6">
          {/* Business Info */}
          <div>
            <div className="flex items-start gap-3 mb-2">
              <CategoryIcon category={promotion.category} size="md" />
              <div className="flex-1">
                <h1 className="text-2xl font-bold">{promotion.business_name}</h1>
                <div className="flex items-center gap-2 text-muted-foreground text-sm mt-1">
                  <MapPin className="w-4 h-4" />
                  <span>{promotion.address || 'Location available'}</span>
                </div>
              </div>
            </div>

            {/* Rating */}
            {reviews.length > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={cn(
                        'w-4 h-4',
                        star <= avgRating ? 'text-yellow-500 fill-yellow-500' : 'text-muted'
                      )}
                    />
                  ))}
                </div>
                <span className="text-sm font-medium">{avgRating.toFixed(1)}</span>
                <span className="text-sm text-muted-foreground">({reviews.length} reviews)</span>
              </div>
            )}
          </div>

          {/* Check-in Streak */}
          {user && (
            <CheckInStreak
              currentStreak={userStreak.current}
              longestStreak={userStreak.longest}
              streakBonus={streakBonus}
            />
          )}

          {/* Required Action */}
          <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              How to earn
            </h3>
            <p className="text-sm text-muted-foreground">{promotion.required_action}</p>
          </div>

          {/* Description */}
          {promotion.description && (
            <div>
              <h3 className="font-semibold mb-2">About</h3>
              <p className="text-sm text-muted-foreground">{promotion.description}</p>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-muted/50 text-center">
              <Users className="w-5 h-5 mx-auto mb-1 text-muted-foreground" />
              <div className="font-bold">{promotion.current_claims}</div>
              <div className="text-xs text-muted-foreground">Claims</div>
            </div>
            <div className="p-3 rounded-xl bg-muted/50 text-center">
              <Star className="w-5 h-5 mx-auto mb-1 text-yellow-500" />
              <div className="font-bold">{avgRating.toFixed(1) || '-'}</div>
              <div className="text-xs text-muted-foreground">Rating</div>
            </div>
            <div className="p-3 rounded-xl bg-muted/50 text-center">
              <Award className="w-5 h-5 mx-auto mb-1 text-primary" />
              <div className="font-bold">{promotion.reward_amount}</div>
              <div className="text-xs text-muted-foreground">Coins</div>
            </div>
          </div>

          {/* Expiration */}
          {promotion.expires_at && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>Expires {format(new Date(promotion.expires_at), 'MMM d, yyyy')}</span>
            </div>
          )}

          {/* Tabs for Reviews */}
          <Tabs defaultValue="reviews" className="mt-6">
            <TabsList className="w-full">
              <TabsTrigger value="reviews" className="flex-1">
                <MessageSquare className="w-4 h-4 mr-2" />
                Reviews ({reviews.length})
              </TabsTrigger>
              <TabsTrigger value="photos" className="flex-1">
                <Camera className="w-4 h-4 mr-2" />
                Photos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="reviews" className="mt-4 space-y-4">
              {/* Write Review */}
              {user && hasCheckedIn && (
                <div className="p-4 rounded-xl border border-border">
                  <h4 className="font-medium mb-3">Write a review</h4>
                  <div className="flex gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setNewReview(prev => ({ ...prev, rating: star }))}
                        className="p-1"
                      >
                        <Star
                          className={cn(
                            'w-6 h-6 transition-colors',
                            star <= newReview.rating 
                              ? 'text-yellow-500 fill-yellow-500' 
                              : 'text-muted hover:text-yellow-500/50'
                          )}
                        />
                      </button>
                    ))}
                  </div>
                  <Textarea
                    placeholder="Share your experience..."
                    value={newReview.comment}
                    onChange={(e) => setNewReview(prev => ({ ...prev, comment: e.target.value }))}
                    className="mb-3"
                  />
                  <Button 
                    onClick={submitReview} 
                    disabled={submittingReview}
                    className="w-full"
                  >
                    {submittingReview ? 'Submitting...' : 'Submit Review'}
                  </Button>
                </div>
              )}

              {/* Reviews List */}
              {reviews.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No reviews yet. Be the first to review!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reviews.map((review) => (
                    <div key={review.id} className="p-4 rounded-xl bg-muted/30">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={review.profile?.avatar_url || undefined} />
                          <AvatarFallback>
                            {review.profile?.username?.[0]?.toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">
                              {review.profile?.username || 'Anonymous'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(review.created_at), 'MMM d, yyyy')}
                            </span>
                          </div>
                          <div className="flex gap-0.5 my-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={cn(
                                  'w-3 h-3',
                                  star <= review.rating 
                                    ? 'text-yellow-500 fill-yellow-500' 
                                    : 'text-muted'
                                )}
                              />
                            ))}
                          </div>
                          {review.comment && (
                            <p className="text-sm text-muted-foreground mt-2">
                              {review.comment}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="photos" className="mt-4">
              <div className="text-center py-8 text-muted-foreground">
                <Camera className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No photos yet</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>

      {/* Fixed Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t border-border">
        <div className="flex gap-3">
          <Button variant="outline" size="lg" onClick={openDirections} className="flex-1">
            <Navigation className="w-5 h-5 mr-2" />
            Directions
          </Button>
          <CheckInButton
            promotion={{
              id: promotion.id,
              business_name: promotion.business_name,
              latitude: promotion.latitude,
              longitude: promotion.longitude,
              reward_amount: promotion.reward_amount,
              reward_type: promotion.reward_type as 'vicoin' | 'icoin' | 'both',
            }}
            className="flex-1"
            onSuccess={() => {
              setHasCheckedIn(true);
              loadUserStreak();
            }}
          />
        </div>
      </div>
    </div>
  );
}
