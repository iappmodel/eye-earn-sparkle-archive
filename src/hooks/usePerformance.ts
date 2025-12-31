import { useEffect, useState, useCallback } from 'react';
import { performanceMonitor } from '@/lib/performance';

interface WebVitals {
  LCP?: { value: number; rating: string };
  FID?: { value: number; rating: string };
  CLS?: { value: number; rating: string };
  FCP?: { value: number; rating: string };
  TTFB?: { value: number; rating: string };
}

export function usePerformance() {
  const [metrics, setMetrics] = useState<WebVitals>({});
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!isInitialized) {
      performanceMonitor.init();
      setIsInitialized(true);
    }

    const unsubscribe = performanceMonitor.subscribe((newMetrics) => {
      setMetrics(newMetrics);
    });

    return unsubscribe;
  }, [isInitialized]);

  const mark = useCallback((name: string) => {
    performanceMonitor.mark(name);
  }, []);

  const measure = useCallback((name: string, startMark: string, endMark?: string) => {
    return performanceMonitor.measure(name, startMark, endMark);
  }, []);

  const measureRender = useCallback((componentName: string) => {
    const startMark = `${componentName}-render-start`;
    const endMark = `${componentName}-render-end`;
    
    return {
      start: () => performanceMonitor.mark(startMark),
      end: () => {
        performanceMonitor.mark(endMark);
        return performanceMonitor.measure(`${componentName}-render`, startMark, endMark);
      },
    };
  }, []);

  return {
    metrics,
    mark,
    measure,
    measureRender,
    getMetrics: performanceMonitor.getMetrics.bind(performanceMonitor),
  };
}

export default usePerformance;
