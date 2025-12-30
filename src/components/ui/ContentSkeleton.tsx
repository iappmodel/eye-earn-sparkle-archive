import React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className }) => (
  <div className={cn(
    "animate-pulse bg-gradient-to-r from-muted via-muted/50 to-muted bg-[length:200%_100%] animate-shimmer rounded-lg",
    className
  )} />
);

export const MediaCardSkeleton: React.FC = () => (
  <div className="relative w-full h-full bg-background overflow-hidden">
    {/* Background shimmer */}
    <Skeleton className="absolute inset-0 rounded-none" />
    
    {/* Top left label */}
    <div className="absolute top-4 left-4 z-10">
      <Skeleton className="w-20 h-6 rounded-full" />
    </div>
    
    {/* Center play button skeleton */}
    <div className="absolute inset-0 flex items-center justify-center">
      <Skeleton className="w-24 h-24 rounded-full" />
    </div>
    
    {/* Bottom gradient placeholder */}
    <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-background/90 to-transparent" />
    
    {/* Progress bar skeleton */}
    <div className="absolute bottom-0 left-0 right-0 h-1">
      <Skeleton className="h-full w-1/3 rounded-none" />
    </div>
  </div>
);

export const ProfileCardSkeleton: React.FC = () => (
  <div className="flex flex-col items-center p-6 space-y-4">
    {/* Avatar */}
    <Skeleton className="w-24 h-24 rounded-full" />
    
    {/* Name */}
    <Skeleton className="w-32 h-6" />
    
    {/* Username */}
    <Skeleton className="w-24 h-4" />
    
    {/* Stats */}
    <div className="flex gap-6">
      <div className="flex flex-col items-center gap-1">
        <Skeleton className="w-12 h-5" />
        <Skeleton className="w-16 h-3" />
      </div>
      <div className="flex flex-col items-center gap-1">
        <Skeleton className="w-12 h-5" />
        <Skeleton className="w-16 h-3" />
      </div>
      <div className="flex flex-col items-center gap-1">
        <Skeleton className="w-12 h-5" />
        <Skeleton className="w-16 h-3" />
      </div>
    </div>
  </div>
);

export const FeedItemSkeleton: React.FC = () => (
  <div className="p-4 space-y-3">
    <div className="flex items-center gap-3">
      <Skeleton className="w-10 h-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="w-32 h-4" />
        <Skeleton className="w-20 h-3" />
      </div>
    </div>
    <Skeleton className="w-full h-48 rounded-xl" />
    <div className="flex gap-4">
      <Skeleton className="w-16 h-6" />
      <Skeleton className="w-16 h-6" />
      <Skeleton className="w-16 h-6" />
    </div>
  </div>
);

export const TransactionSkeleton: React.FC = () => (
  <div className="flex items-center gap-4 p-4 neu-inset rounded-2xl">
    <Skeleton className="w-10 h-10 rounded-full" />
    <div className="flex-1 space-y-2">
      <Skeleton className="w-3/4 h-4" />
      <Skeleton className="w-1/4 h-3" />
    </div>
    <Skeleton className="w-16 h-5" />
  </div>
);

export const GridSkeleton: React.FC<{ count?: number }> = ({ count = 9 }) => (
  <div className="grid grid-cols-3 gap-1">
    {Array.from({ length: count }).map((_, i) => (
      <Skeleton key={i} className="aspect-square" />
    ))}
  </div>
);

export const ListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <div className="space-y-3">
    {Array.from({ length: count }).map((_, i) => (
      <TransactionSkeleton key={i} />
    ))}
  </div>
);

export const MenuItemSkeleton: React.FC = () => (
  <div className="flex items-center gap-4 p-4 rounded-xl">
    <Skeleton className="w-12 h-12 rounded-xl" />
    <div className="flex-1 space-y-2">
      <Skeleton className="w-32 h-4" />
      <Skeleton className="w-48 h-3" />
    </div>
    <Skeleton className="w-6 h-6 rounded" />
  </div>
);
