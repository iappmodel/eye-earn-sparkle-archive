// Performance monitoring utilities

interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: number;
}

interface WebVitals {
  LCP?: PerformanceMetric; // Largest Contentful Paint
  FID?: PerformanceMetric; // First Input Delay
  CLS?: PerformanceMetric; // Cumulative Layout Shift
  FCP?: PerformanceMetric; // First Contentful Paint
  TTFB?: PerformanceMetric; // Time to First Byte
  INP?: PerformanceMetric; // Interaction to Next Paint
}

// Thresholds based on Web Vitals recommendations
const THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 },
  FID: { good: 100, poor: 300 },
  CLS: { good: 0.1, poor: 0.25 },
  FCP: { good: 1800, poor: 3000 },
  TTFB: { good: 800, poor: 1800 },
  INP: { good: 200, poor: 500 },
};

function getRating(name: keyof typeof THRESHOLDS, value: number): PerformanceMetric['rating'] {
  const threshold = THRESHOLDS[name];
  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
}

class PerformanceMonitor {
  private metrics: WebVitals = {};
  private observers: Array<(metrics: WebVitals) => void> = [];
  private isInitialized = false;

  init() {
    if (this.isInitialized || typeof window === 'undefined') return;
    this.isInitialized = true;

    // Observe LCP
    this.observeLCP();
    
    // Observe FID
    this.observeFID();
    
    // Observe CLS
    this.observeCLS();
    
    // Observe FCP and TTFB from Navigation Timing
    this.observeNavigationTiming();

    // Log metrics in development
    if (import.meta.env.DEV) {
      this.subscribe((metrics) => {
        console.log('[Performance]', metrics);
      });
    }
  }

  private observeLCP() {
    if (!('PerformanceObserver' in window)) return;

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1] as PerformanceEntry & { startTime: number };
        
        this.metrics.LCP = {
          name: 'LCP',
          value: lastEntry.startTime,
          rating: getRating('LCP', lastEntry.startTime),
          timestamp: Date.now(),
        };
        this.notifyObservers();
      });

      observer.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) {
      // LCP not supported
    }
  }

  private observeFID() {
    if (!('PerformanceObserver' in window)) return;

    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const firstEntry = entries[0] as PerformanceEntry & { processingStart: number; startTime: number };
        
        const fid = firstEntry.processingStart - firstEntry.startTime;
        this.metrics.FID = {
          name: 'FID',
          value: fid,
          rating: getRating('FID', fid),
          timestamp: Date.now(),
        };
        this.notifyObservers();
      });

      observer.observe({ type: 'first-input', buffered: true });
    } catch (e) {
      // FID not supported
    }
  }

  private observeCLS() {
    if (!('PerformanceObserver' in window)) return;

    let clsValue = 0;

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const layoutShift = entry as PerformanceEntry & { hadRecentInput: boolean; value: number };
          if (!layoutShift.hadRecentInput) {
            clsValue += layoutShift.value;
          }
        }

        this.metrics.CLS = {
          name: 'CLS',
          value: clsValue,
          rating: getRating('CLS', clsValue),
          timestamp: Date.now(),
        };
        this.notifyObservers();
      });

      observer.observe({ type: 'layout-shift', buffered: true });
    } catch (e) {
      // CLS not supported
    }
  }

  private observeNavigationTiming() {
    if (typeof window === 'undefined' || !window.performance) return;

    // Wait for load to complete
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        
        if (navigation) {
          // TTFB
          const ttfb = navigation.responseStart - navigation.requestStart;
          this.metrics.TTFB = {
            name: 'TTFB',
            value: ttfb,
            rating: getRating('TTFB', ttfb),
            timestamp: Date.now(),
          };

          this.notifyObservers();
        }

        // FCP from paint timing
        const paintEntries = performance.getEntriesByType('paint');
        const fcp = paintEntries.find((entry) => entry.name === 'first-contentful-paint');
        
        if (fcp) {
          this.metrics.FCP = {
            name: 'FCP',
            value: fcp.startTime,
            rating: getRating('FCP', fcp.startTime),
            timestamp: Date.now(),
          };
          this.notifyObservers();
        }
      }, 0);
    });
  }

  subscribe(callback: (metrics: WebVitals) => void) {
    this.observers.push(callback);
    // Immediately call with current metrics
    if (Object.keys(this.metrics).length > 0) {
      callback(this.metrics);
    }
    
    return () => {
      this.observers = this.observers.filter((cb) => cb !== callback);
    };
  }

  private notifyObservers() {
    this.observers.forEach((cb) => cb(this.metrics));
  }

  getMetrics(): WebVitals {
    return { ...this.metrics };
  }

  // Utility to measure custom timings
  mark(name: string) {
    if (typeof performance !== 'undefined') {
      performance.mark(name);
    }
  }

  measure(name: string, startMark: string, endMark?: string) {
    if (typeof performance !== 'undefined') {
      try {
        if (endMark) {
          performance.measure(name, startMark, endMark);
        } else {
          performance.measure(name, startMark);
        }
        const entries = performance.getEntriesByName(name, 'measure');
        return entries[entries.length - 1]?.duration;
      } catch (e) {
        return undefined;
      }
    }
    return undefined;
  }
}

export const performanceMonitor = new PerformanceMonitor();

export default performanceMonitor;
