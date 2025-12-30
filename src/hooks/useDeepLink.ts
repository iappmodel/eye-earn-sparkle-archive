import { useEffect, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

interface DeepLinkConfig {
  onContentOpen?: (contentId: string) => void;
  onProfileOpen?: (userId: string) => void;
  onPromoOpen?: (promoId: string) => void;
}

export const useDeepLink = (config?: DeepLinkConfig) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Handle deep link parameters on mount
  useEffect(() => {
    const contentId = searchParams.get('content');
    const userId = searchParams.get('user');
    const promoId = searchParams.get('promo');
    const tab = searchParams.get('tab');

    if (contentId && config?.onContentOpen) {
      config.onContentOpen(contentId);
    }

    if (userId && config?.onProfileOpen) {
      config.onProfileOpen(userId);
    }

    if (promoId && config?.onPromoOpen) {
      config.onPromoOpen(promoId);
    }
  }, [searchParams, config]);

  // Generate shareable URL for content
  const generateContentLink = useCallback((contentId: string): string => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/?content=${contentId}`;
  }, []);

  // Generate shareable URL for user profile
  const generateProfileLink = useCallback((userId: string): string => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/?user=${userId}`;
  }, []);

  // Generate shareable URL for promotion
  const generatePromoLink = useCallback((promoId: string): string => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/?promo=${promoId}`;
  }, []);

  // Share content with native share API
  const shareContent = useCallback(async (
    contentId: string,
    title: string = 'Check this out!',
    text: string = 'I found something interesting'
  ) => {
    const url = generateContentLink(contentId);

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return true;
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Share failed:', error);
        }
      }
    }

    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard!');
      return true;
    } catch (error) {
      toast.error('Failed to copy link');
      return false;
    }
  }, [generateContentLink]);

  // Share profile
  const shareProfile = useCallback(async (
    userId: string,
    displayName: string = 'User'
  ) => {
    const url = generateProfileLink(userId);

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Check out ${displayName}'s profile`,
          text: `Follow ${displayName} for great content!`,
          url,
        });
        return true;
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Share failed:', error);
        }
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      toast.success('Profile link copied!');
      return true;
    } catch (error) {
      toast.error('Failed to copy link');
      return false;
    }
  }, [generateProfileLink]);

  return {
    generateContentLink,
    generateProfileLink,
    generatePromoLink,
    shareContent,
    shareProfile,
  };
};
