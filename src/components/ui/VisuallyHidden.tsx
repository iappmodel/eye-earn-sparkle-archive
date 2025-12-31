import React from 'react';

interface VisuallyHiddenProps {
  children: React.ReactNode;
  as?: keyof JSX.IntrinsicElements;
}

/**
 * Visually hides content while keeping it accessible to screen readers
 * Use for providing context that is visually apparent but not to screen readers
 */
export const VisuallyHidden: React.FC<VisuallyHiddenProps> = ({
  children,
  as: Component = 'span',
}) => {
  return (
    <Component className="sr-only">
      {children}
    </Component>
  );
};

/**
 * Announce content to screen readers using ARIA live regions
 */
interface LiveRegionProps {
  children: React.ReactNode;
  mode?: 'polite' | 'assertive' | 'off';
  atomic?: boolean;
  relevant?: 'additions' | 'removals' | 'text' | 'all';
  className?: string;
}

export const LiveRegion: React.FC<LiveRegionProps> = ({
  children,
  mode = 'polite',
  atomic = true,
  relevant = 'additions',
  className = 'sr-only',
}) => {
  return (
    <div
      role="status"
      aria-live={mode}
      aria-atomic={atomic}
      aria-relevant={relevant}
      className={className}
    >
      {children}
    </div>
  );
};

export default VisuallyHidden;
