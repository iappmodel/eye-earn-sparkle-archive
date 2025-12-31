import { useEffect } from 'react';

interface SEOHeadProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'video.other' | 'profile';
  keywords?: string[];
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
  noindex?: boolean;
}

const DEFAULT_TITLE = 'iView - Short Video Platform';
const DEFAULT_DESCRIPTION = 'Discover, create, and share amazing short videos. Earn rewards for your attention and creativity.';
const DEFAULT_IMAGE = '/pwa-512x512.png';

export function SEOHead({
  title,
  description = DEFAULT_DESCRIPTION,
  image = DEFAULT_IMAGE,
  url,
  type = 'website',
  keywords = [],
  author,
  publishedTime,
  modifiedTime,
  noindex = false,
}: SEOHeadProps) {
  const fullTitle = title ? `${title} | iView` : DEFAULT_TITLE;
  const canonicalUrl = url || window.location.href;
  const imageUrl = image.startsWith('http') ? image : `${window.location.origin}${image}`;

  useEffect(() => {
    // Update document title
    document.title = fullTitle;

    // Helper to update or create meta tags
    const setMeta = (name: string, content: string, isProperty = false) => {
      const attr = isProperty ? 'property' : 'name';
      let element = document.querySelector(`meta[${attr}="${name}"]`);
      
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attr, name);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    // Basic meta tags
    setMeta('description', description);
    if (keywords.length > 0) {
      setMeta('keywords', keywords.join(', '));
    }
    if (author) {
      setMeta('author', author);
    }
    
    // Robots
    if (noindex) {
      setMeta('robots', 'noindex, nofollow');
    } else {
      setMeta('robots', 'index, follow');
    }

    // Open Graph
    setMeta('og:title', fullTitle, true);
    setMeta('og:description', description, true);
    setMeta('og:image', imageUrl, true);
    setMeta('og:url', canonicalUrl, true);
    setMeta('og:type', type, true);
    setMeta('og:site_name', 'iView', true);

    // Twitter Card
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', fullTitle);
    setMeta('twitter:description', description);
    setMeta('twitter:image', imageUrl);

    // Article-specific meta
    if (type === 'article' || type === 'video.other') {
      if (publishedTime) {
        setMeta('article:published_time', publishedTime, true);
      }
      if (modifiedTime) {
        setMeta('article:modified_time', modifiedTime, true);
      }
      if (author) {
        setMeta('article:author', author, true);
      }
    }

    // Canonical URL
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', canonicalUrl);

    // Cleanup on unmount - reset to defaults
    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [fullTitle, description, imageUrl, canonicalUrl, type, keywords, author, publishedTime, modifiedTime, noindex]);

  return null;
}

// Pre-configured SEO for common pages
export const PageSEO = {
  Home: () => (
    <SEOHead
      title="Home"
      description="Discover trending short videos, earn rewards, and connect with creators on iView."
      keywords={['short videos', 'viral content', 'earn rewards', 'creators']}
    />
  ),
  
  Search: () => (
    <SEOHead
      title="Search"
      description="Search for videos, creators, sounds, and hashtags on iView."
      keywords={['search', 'discover', 'find creators', 'trending']}
    />
  ),
  
  Trending: () => (
    <SEOHead
      title="Trending"
      description="Explore the hottest trending videos and sounds on iView."
      keywords={['trending', 'viral', 'popular', 'hot videos']}
    />
  ),
  
  Wallet: () => (
    <SEOHead
      title="Wallet"
      description="Manage your iCoins and viCoins, track earnings, and request payouts."
      keywords={['wallet', 'earnings', 'coins', 'rewards']}
      noindex
    />
  ),
  
  Profile: ({ username, displayName }: { username?: string; displayName?: string }) => (
    <SEOHead
      title={displayName || username || 'Profile'}
      description={`Watch videos from ${displayName || username || 'this creator'} on iView.`}
      type="profile"
    />
  ),
  
  Video: ({ title, creator, thumbnail }: { title?: string; creator?: string; thumbnail?: string }) => (
    <SEOHead
      title={title || 'Video'}
      description={creator ? `Watch this video by ${creator} on iView.` : 'Watch this video on iView.'}
      type="video.other"
      image={thumbnail}
    />
  ),
};

export default SEOHead;
