import { useState, useEffect } from 'react';
import { applyBeautyToContext, hasActiveBeautyEffects } from '@/utils/beautyProcessor';

/**
 * Produces before/after image URLs for the beauty comparison slider.
 * Use when you have an image URL and beauty values so the comparison panel can show real results.
 */
export function useBeautyComparisonUrls(
  imageUrl: string | null,
  beautyValues: Record<string, number>
): { beforeImageUrl: string | null; afterImageUrl: string | null } {
  const [beforeImageUrl, setBeforeImageUrl] = useState<string | null>(null);
  const [afterImageUrl, setAfterImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!imageUrl) {
      setBeforeImageUrl(null);
      setAfterImageUrl(null);
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      if (cancelled) return;
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setBeforeImageUrl(imageUrl);
        setAfterImageUrl(null);
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      const before = canvas.toDataURL('image/jpeg', 0.92);
      setBeforeImageUrl(before);

      if (hasActiveBeautyEffects(beautyValues)) {
        ctx.drawImage(img, 0, 0, w, h);
        applyBeautyToContext(ctx, w, h, beautyValues, 1);
        const after = canvas.toDataURL('image/jpeg', 0.92);
        setAfterImageUrl(after);
      } else {
        setAfterImageUrl(before);
      }
    };

    img.onerror = () => {
      if (!cancelled) {
        setBeforeImageUrl(null);
        setAfterImageUrl(null);
      }
    };

    img.src = imageUrl;
    return () => {
      cancelled = true;
    };
  }, [imageUrl, beautyValues]);

  return { beforeImageUrl, afterImageUrl };
}
