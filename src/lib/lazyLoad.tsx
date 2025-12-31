import React, { Suspense, ComponentType, ReactNode } from 'react';
import { PageLoader } from '@/components/ui/PageLoader';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorState } from '@/components/ui/ErrorState';

interface LazyLoadOptions {
  fallback?: ReactNode;
  errorFallback?: ReactNode;
  minDelay?: number;
}

/**
 * Enhanced lazy loading with error boundary and minimum delay to prevent flash
 */
export function lazyLoad<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
  options: LazyLoadOptions = {}
): React.LazyExoticComponent<T> {
  const { minDelay = 0 } = options;

  if (minDelay > 0) {
    return React.lazy(() => 
      Promise.all([
        factory(),
        new Promise((resolve) => setTimeout(resolve, minDelay)),
      ]).then(([module]) => module)
    );
  }

  return React.lazy(factory);
}

interface LazyWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
  errorFallback?: ReactNode;
}

/**
 * Wrapper component for lazy-loaded components with Suspense and ErrorBoundary
 */
export function LazyWrapper({ 
  children, 
  fallback = <PageLoader message="Loading..." />,
  errorFallback = <ErrorState description="Failed to load component" onRetry={() => window.location.reload()} />,
}: LazyWrapperProps) {
  return (
    <ErrorBoundary fallback={errorFallback}>
      <Suspense fallback={fallback}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

/**
 * Higher-order component that wraps a lazy component with Suspense and ErrorBoundary
 */
export function withLazyLoad(
  LazyComponent: React.LazyExoticComponent<ComponentType<unknown>>,
  options: LazyLoadOptions = {}
) {
  const { 
    fallback = <PageLoader message="Loading..." />,
    errorFallback = <ErrorState description="Failed to load" onRetry={() => window.location.reload()} />,
  } = options;

  return function WrappedComponent(props: Record<string, unknown>) {
    return (
      <ErrorBoundary fallback={errorFallback}>
        <Suspense fallback={fallback}>
          <LazyComponent {...props} />
        </Suspense>
      </ErrorBoundary>
    );
  };
}

/**
 * Preload a lazy component (useful for prefetching on hover)
 */
export function preloadComponent(factory: () => Promise<{ default: ComponentType<unknown> }>) {
  factory();
}

export default { lazyLoad, LazyWrapper, withLazyLoad, preloadComponent };
