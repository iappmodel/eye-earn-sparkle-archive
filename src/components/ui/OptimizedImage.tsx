import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from './skeleton';

interface ImageSize {
  width: number;
  suffix?: string;
}

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  sizes?: string;
  priority?: boolean;
  placeholder?: 'blur' | 'skeleton' | 'none';
  blurDataURL?: string;
  quality?: number;
  onLoadingComplete?: (result: { naturalWidth: number; naturalHeight: number }) => void;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
}

// Generate srcset for responsive images
function generateSrcSet(src: string, widths: number[] = [320, 640, 960, 1280, 1920]): string {
  // For external URLs that support resizing (like Unsplash)
  if (src.includes('unsplash.com')) {
    return widths
      .map(w => {
        const url = new URL(src);
        url.searchParams.set('w', w.toString());
        url.searchParams.set('q', '80');
        url.searchParams.set('fm', 'webp');
        url.searchParams.set('fit', 'crop');
        return `${url.toString()} ${w}w`;
      })
      .join(', ');
  }

  // For Supabase storage URLs
  if (src.includes('supabase.co/storage')) {
    return widths
      .map(w => {
        const url = new URL(src);
        url.searchParams.set('width', w.toString());
        url.searchParams.set('quality', '80');
        return `${url.toString()} ${w}w`;
      })
      .join(', ');
  }

  // For other URLs, return as-is (no srcset)
  return '';
}

// Generate WebP URL when possible
function getOptimizedSrc(src: string, format: 'webp' | 'avif' = 'webp'): string {
  if (src.includes('unsplash.com')) {
    const url = new URL(src);
    url.searchParams.set('fm', format);
    url.searchParams.set('q', '80');
    return url.toString();
  }
  return src;
}

// Default sizes for responsive images
const DEFAULT_SIZES = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw';

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width,
  height,
  sizes = DEFAULT_SIZES,
  priority = false,
  placeholder = 'skeleton',
  blurDataURL,
  quality = 80,
  onLoadingComplete,
  objectFit = 'cover',
  className,
  style,
  ...props
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (priority) return;

    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: '50px', // Start loading 50px before entering viewport
        threshold: 0,
      }
    );

    observer.observe(container);

    return () => observer.disconnect();
  }, [priority]);

  const handleLoad = useCallback(() => {
    setIsLoaded(true);
    if (imgRef.current && onLoadingComplete) {
      onLoadingComplete({
        naturalWidth: imgRef.current.naturalWidth,
        naturalHeight: imgRef.current.naturalHeight,
      });
    }
  }, [onLoadingComplete]);

  const handleError = useCallback(() => {
    setIsError(true);
    console.error(`[OptimizedImage] Failed to load: ${src}`);
  }, [src]);

  const srcSet = generateSrcSet(src);
  const optimizedSrc = getOptimizedSrc(src);

  const containerStyle: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    width: width ? `${width}px` : '100%',
    height: height ? `${height}px` : '100%',
    ...style,
  };

  const imgStyle: React.CSSProperties = {
    objectFit,
    width: '100%',
    height: '100%',
    transition: 'opacity 0.3s ease-in-out',
    opacity: isLoaded ? 1 : 0,
  };

  return (
    <div 
      ref={containerRef} 
      style={containerStyle}
      className={cn('bg-muted', className)}
    >
      {/* Placeholder */}
      {placeholder === 'skeleton' && !isLoaded && !isError && (
        <Skeleton className="absolute inset-0 w-full h-full" />
      )}
      
      {placeholder === 'blur' && blurDataURL && !isLoaded && !isError && (
        <img
          src={blurDataURL}
          alt=""
          className="absolute inset-0 w-full h-full object-cover blur-lg scale-110"
          aria-hidden="true"
        />
      )}

      {/* Error state */}
      {isError && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <span className="text-muted-foreground text-sm">Failed to load</span>
        </div>
      )}

      {/* Actual image */}
      {isInView && !isError && (
        <picture>
          {/* WebP source for modern browsers */}
          {srcSet && (
            <source
              type="image/webp"
              srcSet={srcSet}
              sizes={sizes}
            />
          )}
          
          <img
            ref={imgRef}
            src={optimizedSrc}
            alt={alt}
            width={width}
            height={height}
            sizes={sizes}
            srcSet={srcSet || undefined}
            loading={priority ? 'eager' : 'lazy'}
            decoding={priority ? 'sync' : 'async'}
            fetchPriority={priority ? 'high' : 'auto'}
            onLoad={handleLoad}
            onError={handleError}
            style={imgStyle}
            {...props}
          />
        </picture>
      )}
    </div>
  );
};

// Hook for preloading images
export function useImagePreload(urls: string[]) {
  const [loaded, setLoaded] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Set<string>>(new Set());

  useEffect(() => {
    urls.forEach((url) => {
      if (loaded.has(url) || errors.has(url)) return;

      const img = new Image();
      img.src = getOptimizedSrc(url);

      img.onload = () => {
        setLoaded((prev) => new Set(prev).add(url));
      };

      img.onerror = () => {
        setErrors((prev) => new Set(prev).add(url));
      };
    });
  }, [urls, loaded, errors]);

  return {
    isLoaded: (url: string) => loaded.has(url),
    hasError: (url: string) => errors.has(url),
    allLoaded: urls.every((url) => loaded.has(url)),
    progress: urls.length > 0 ? loaded.size / urls.length : 1,
  };
}
