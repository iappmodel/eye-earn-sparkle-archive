import React from 'react';
import { cn } from '@/lib/utils';

interface SkipLinkProps {
  href?: string;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Accessible skip link component for keyboard navigation
 * Allows users to skip to main content
 */
export const SkipLink: React.FC<SkipLinkProps> = ({
  href = '#main-content',
  children = 'Skip to main content',
  className,
}) => {
  return (
    <a
      href={href}
      className={cn(
        'skip-link',
        'sr-only focus:not-sr-only',
        'fixed top-4 left-4 z-[100]',
        'bg-primary text-primary-foreground',
        'px-4 py-2 rounded-md',
        'font-medium text-sm',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        'transition-transform',
        className
      )}
    >
      {children}
    </a>
  );
};

/**
 * Landmark region wrapper with proper ARIA roles
 */
interface LandmarkProps {
  children: React.ReactNode;
  as?: 'main' | 'nav' | 'aside' | 'section' | 'article' | 'header' | 'footer';
  label?: string;
  id?: string;
  className?: string;
}

export const Landmark: React.FC<LandmarkProps> = ({
  children,
  as: Component = 'section',
  label,
  id,
  className,
}) => {
  return (
    <Component
      id={id}
      aria-label={label}
      className={className}
    >
      {children}
    </Component>
  );
};

export default SkipLink;
