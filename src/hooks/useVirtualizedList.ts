import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

interface VirtualizedListOptions<T> {
  items: T[];
  itemHeight: number | ((item: T, index: number) => number);
  containerHeight: number;
  overscan?: number;
  getItemKey?: (item: T, index: number) => string | number;
}

interface VirtualizedListResult<T> {
  virtualItems: Array<{
    item: T;
    index: number;
    start: number;
    size: number;
    key: string | number;
  }>;
  totalHeight: number;
  startIndex: number;
  endIndex: number;
  scrollToIndex: (index: number, align?: 'start' | 'center' | 'end') => void;
  containerProps: {
    style: React.CSSProperties;
    onScroll: (e: React.UIEvent<HTMLElement>) => void;
    ref: React.RefObject<HTMLDivElement>;
  };
  innerProps: {
    style: React.CSSProperties;
  };
}

export function useVirtualizedList<T>({
  items,
  itemHeight,
  containerHeight,
  overscan = 3,
  getItemKey,
}: VirtualizedListOptions<T>): VirtualizedListResult<T> {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const measurementCache = useRef<Map<number, number>>(new Map());

  // Calculate item heights and positions
  const { itemHeights, itemOffsets, totalHeight } = useMemo(() => {
    const heights: number[] = [];
    const offsets: number[] = [];
    let currentOffset = 0;

    for (let i = 0; i < items.length; i++) {
      // Check cache first
      let height = measurementCache.current.get(i);
      
      if (height === undefined) {
        height = typeof itemHeight === 'function' 
          ? itemHeight(items[i], i) 
          : itemHeight;
        measurementCache.current.set(i, height);
      }

      heights.push(height);
      offsets.push(currentOffset);
      currentOffset += height;
    }

    return {
      itemHeights: heights,
      itemOffsets: offsets,
      totalHeight: currentOffset,
    };
  }, [items, itemHeight]);

  // Binary search to find start index
  const findStartIndex = useCallback((scrollTop: number): number => {
    let low = 0;
    let high = items.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const offset = itemOffsets[mid];

      if (offset < scrollTop) {
        low = mid + 1;
      } else if (offset > scrollTop) {
        high = mid - 1;
      } else {
        return mid;
      }
    }

    return Math.max(0, high);
  }, [itemOffsets, items.length]);

  // Calculate visible range
  const { startIndex, endIndex } = useMemo(() => {
    if (items.length === 0) {
      return { startIndex: 0, endIndex: 0 };
    }

    const start = findStartIndex(scrollTop);
    const visibleStart = Math.max(0, start - overscan);

    let visibleEnd = start;
    let accumulatedHeight = itemOffsets[start] - scrollTop;

    while (visibleEnd < items.length && accumulatedHeight < containerHeight) {
      accumulatedHeight += itemHeights[visibleEnd];
      visibleEnd++;
    }

    const end = Math.min(items.length - 1, visibleEnd + overscan);

    return { startIndex: visibleStart, endIndex: end };
  }, [scrollTop, containerHeight, items.length, findStartIndex, itemOffsets, itemHeights, overscan]);

  // Generate virtual items
  const virtualItems = useMemo(() => {
    const result = [];

    for (let i = startIndex; i <= endIndex; i++) {
      if (i >= items.length) break;

      result.push({
        item: items[i],
        index: i,
        start: itemOffsets[i],
        size: itemHeights[i],
        key: getItemKey ? getItemKey(items[i], i) : i,
      });
    }

    return result;
  }, [startIndex, endIndex, items, itemOffsets, itemHeights, getItemKey]);

  // Scroll handler
  const handleScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    setScrollTop(target.scrollTop);
  }, []);

  // Scroll to specific index
  const scrollToIndex = useCallback((index: number, align: 'start' | 'center' | 'end' = 'start') => {
    if (!containerRef.current || index < 0 || index >= items.length) return;

    const offset = itemOffsets[index];
    const height = itemHeights[index];

    let scrollTarget = offset;

    if (align === 'center') {
      scrollTarget = offset - (containerHeight - height) / 2;
    } else if (align === 'end') {
      scrollTarget = offset - containerHeight + height;
    }

    containerRef.current.scrollTo({
      top: Math.max(0, scrollTarget),
      behavior: 'smooth',
    });
  }, [items.length, itemOffsets, itemHeights, containerHeight]);

  // Clear cache when items change
  useEffect(() => {
    measurementCache.current.clear();
  }, [items]);

  return {
    virtualItems,
    totalHeight,
    startIndex,
    endIndex,
    scrollToIndex,
    containerProps: {
      style: {
        overflow: 'auto',
        height: containerHeight,
        position: 'relative' as const,
      },
      onScroll: handleScroll,
      ref: containerRef,
    },
    innerProps: {
      style: {
        height: totalHeight,
        width: '100%',
        position: 'relative' as const,
      },
    },
  };
}

// Hook for infinite scroll with virtualization
interface InfiniteScrollOptions<T> extends VirtualizedListOptions<T> {
  loadMore: () => Promise<void>;
  hasMore: boolean;
  isLoading: boolean;
  threshold?: number;
}

export function useInfiniteVirtualizedList<T>({
  loadMore,
  hasMore,
  isLoading,
  threshold = 5,
  ...virtualizedOptions
}: InfiniteScrollOptions<T>) {
  const virtualizedList = useVirtualizedList(virtualizedOptions);
  const loadingRef = useRef(false);

  // Trigger load more when approaching end
  useEffect(() => {
    if (loadingRef.current || isLoading || !hasMore) return;

    const { endIndex } = virtualizedList;
    const itemCount = virtualizedOptions.items.length;

    if (itemCount - endIndex <= threshold) {
      loadingRef.current = true;
      loadMore().finally(() => {
        loadingRef.current = false;
      });
    }
  }, [virtualizedList.endIndex, virtualizedOptions.items.length, loadMore, hasMore, isLoading, threshold]);

  return {
    ...virtualizedList,
    hasMore,
    isLoading,
  };
}
