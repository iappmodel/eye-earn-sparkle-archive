import React from 'react';
import { ErrorState } from './ErrorState';
import { EmptyState, EmptyStateType } from './EmptyState';
import { MediaCardSkeleton, ListSkeleton, GridSkeleton, ProfileCardSkeleton, FeedItemSkeleton } from './ContentSkeleton';
import { PullToRefresh } from './PullToRefresh';
import { cn } from '@/lib/utils';

type SkeletonType = 'media' | 'list' | 'grid' | 'profile' | 'feed' | 'custom';

interface DataFetchWrapperProps {
  isLoading: boolean;
  error?: string | null;
  isEmpty?: boolean;
  children: React.ReactNode;
  onRetry?: () => void;
  onRefresh?: () => Promise<void>;
  skeletonType?: SkeletonType;
  skeletonCount?: number;
  customSkeleton?: React.ReactNode;
  emptyType?: EmptyStateType;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: { label: string; onClick: () => void };
  enablePullToRefresh?: boolean;
  className?: string;
}

export const DataFetchWrapper: React.FC<DataFetchWrapperProps> = ({
  isLoading,
  error,
  isEmpty = false,
  children,
  onRetry,
  onRefresh,
  skeletonType = 'list',
  skeletonCount = 3,
  customSkeleton,
  emptyType = 'content',
  emptyTitle,
  emptyDescription,
  emptyAction,
  enablePullToRefresh = false,
  className,
}) => {
  const renderSkeleton = () => {
    if (customSkeleton) return customSkeleton;

    switch (skeletonType) {
      case 'media':
        return <MediaCardSkeleton />;
      case 'grid':
        return <GridSkeleton count={skeletonCount} />;
      case 'profile':
        return <ProfileCardSkeleton />;
      case 'feed':
        return (
          <div className="space-y-4">
            {Array.from({ length: skeletonCount }).map((_, i) => (
              <FeedItemSkeleton key={i} />
            ))}
          </div>
        );
      case 'list':
      default:
        return <ListSkeleton count={skeletonCount} />;
    }
  };

  // Error state
  if (error && !isLoading) {
    return (
      <ErrorState
        type="server"
        title="Failed to load"
        description={error}
        onRetry={onRetry}
        className={className}
      />
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className={cn("animate-fade-in", className)}>
        {renderSkeleton()}
      </div>
    );
  }

  // Empty state
  if (isEmpty) {
    return (
      <EmptyState
        type={emptyType}
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={emptyAction?.label}
        onAction={emptyAction?.onClick}
        className={className}
      />
    );
  }

  // Content with optional pull-to-refresh
  if (enablePullToRefresh && onRefresh) {
    return (
      <PullToRefresh onRefresh={onRefresh} className={cn("h-full", className)}>
        {children}
      </PullToRefresh>
    );
  }

  return <>{children}</>;
};

export default DataFetchWrapper;
