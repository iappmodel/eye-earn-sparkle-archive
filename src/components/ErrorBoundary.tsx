import React, { Component, ReactNode } from 'react';
import { errorTrackingService } from '@/services/errorTracking.service';
import { attemptChunkRecovery, isChunkLoadError } from '@/lib/chunkRecovery';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  componentName?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    errorTrackingService.captureError(error, {
      component: this.props.componentName || 'ErrorBoundary',
      metadata: {
        componentStack: errorInfo.componentStack,
      },
    });

    // If a lazy-loaded route chunk fails (stale cache / transient network), recover via hard reload.
    if (isChunkLoadError(error)) {
      void attemptChunkRecovery();
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const chunkError = isChunkLoadError(this.state.error);

      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <h2 className="text-lg font-semibold text-destructive mb-2">Something went wrong</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => {
              if (chunkError) {
                void attemptChunkRecovery({ force: true });
                return;
              }
              this.setState({ hasError: false, error: null });
            }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
          >
            {chunkError ? 'Reload app' : 'Try Again'}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

