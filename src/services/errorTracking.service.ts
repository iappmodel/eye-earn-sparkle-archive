import { supabase } from "@/integrations/supabase/client";

interface ErrorLogPayload {
  error_type: string;
  error_message: string;
  stack_trace?: string;
  component?: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

class ErrorTrackingService {
  private appVersion: string = '1.0.0';
  private userId: string | null = null;
  private isInitialized: boolean = false;
  private errorQueue: ErrorLogPayload[] = [];
  private flushInterval: number | null = null;

  /**
   * Initialize the error tracking service
   */
  init(options?: { appVersion?: string; userId?: string }): void {
    if (this.isInitialized) return;

    this.appVersion = options?.appVersion || '1.0.0';
    this.userId = options?.userId || null;

    // Set up global error handlers
    this.setupGlobalHandlers();

    // Flush errors periodically
    this.flushInterval = window.setInterval(() => this.flushQueue(), 30000);

    this.isInitialized = true;
    console.log('[ErrorTracking] Initialized');
  }

  /**
   * Set the current user ID
   */
  setUserId(userId: string | null): void {
    this.userId = userId;
  }

  /**
   * Set up global error handlers
   */
  private setupGlobalHandlers(): void {
    // Catch unhandled errors
    window.onerror = (message, source, lineno, colno, error) => {
      this.captureError(error || new Error(String(message)), {
        component: 'global',
        metadata: { source, lineno, colno },
      });
      return false;
    };

    // Catch unhandled promise rejections
    window.onunhandledrejection = (event) => {
      this.captureError(event.reason, {
        component: 'unhandledrejection',
      });
    };
  }

  /**
   * Capture an error and queue it for logging
   */
  captureError(
    error: Error | string,
    context?: {
      component?: string;
      metadata?: Record<string, unknown>;
    }
  ): void {
    const errorObj = typeof error === 'string' ? new Error(error) : error;

    const payload: ErrorLogPayload = {
      error_type: errorObj.name || 'Error',
      error_message: errorObj.message || String(error),
      stack_trace: errorObj.stack,
      component: context?.component,
      url: window.location.href,
      metadata: context?.metadata,
    };

    this.errorQueue.push(payload);
    console.error('[ErrorTracking] Captured:', payload.error_message);

    // Immediately flush critical errors
    if (this.errorQueue.length >= 5) {
      this.flushQueue();
    }
  }

  /**
   * Capture a message as an info-level log
   */
  captureMessage(message: string, metadata?: Record<string, unknown>): void {
    this.captureError(new Error(message), {
      component: 'message',
      metadata: { ...metadata, level: 'info' },
    });
  }

  /**
   * Flush the error queue to the database
   */
  private async flushQueue(): Promise<void> {
    if (this.errorQueue.length === 0) return;

    const errors = [...this.errorQueue];
    this.errorQueue = [];

    try {
      const logs = errors.map((error) => ({
        user_id: this.userId,
        error_type: error.error_type,
        error_message: error.error_message,
        stack_trace: error.stack_trace,
        component: error.component,
        user_agent: navigator.userAgent,
        url: error.url,
        metadata: error.metadata ? JSON.parse(JSON.stringify(error.metadata)) : {},
        app_version: this.appVersion,
      }));

      const { error } = await supabase.from('error_logs').insert(logs);

      if (error) {
        console.error('[ErrorTracking] Failed to flush errors:', error);
        // Re-queue errors on failure
        this.errorQueue = [...errors, ...this.errorQueue];
      } else {
        console.log(`[ErrorTracking] Flushed ${logs.length} errors`);
      }
    } catch (err) {
      console.error('[ErrorTracking] Flush error:', err);
      this.errorQueue = [...errors, ...this.errorQueue];
    }
  }

  /**
   * Create an error boundary handler for React components
   */
  createErrorBoundaryHandler(componentName: string) {
    return (error: Error, errorInfo: { componentStack: string }) => {
      this.captureError(error, {
        component: componentName,
        metadata: {
          componentStack: errorInfo.componentStack,
        },
      });
    };
  }

  /**
   * Cleanup the service
   */
  destroy(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flushQueue();
    this.isInitialized = false;
  }
}

export const errorTrackingService = new ErrorTrackingService();
