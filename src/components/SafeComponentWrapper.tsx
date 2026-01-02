import React, { Component, ReactNode } from 'react';

interface SafeComponentWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
  componentName?: string;
  onError?: (error: Error) => void;
}

interface SafeComponentWrapperState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Lightweight error boundary for individual components.
 * Prevents a single component crash from taking down the entire page.
 */
export class SafeComponentWrapper extends Component<SafeComponentWrapperProps, SafeComponentWrapperState> {
  constructor(props: SafeComponentWrapperProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): Partial<SafeComponentWrapperState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error(`[SafeComponentWrapper] ${this.props.componentName || 'Component'} crashed:`, error, errorInfo);
    this.props.onError?.(error);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      // Silent fail - render nothing instead of crashing
      return null;
    }

    return this.props.children;
  }
}

/**
 * HOC to wrap any component with error boundary
 */
export function withSafeRender<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName?: string
): React.FC<P> {
  const SafeComponent: React.FC<P> = (props) => (
    <SafeComponentWrapper componentName={componentName || WrappedComponent.displayName || 'Unknown'}>
      <WrappedComponent {...props} />
    </SafeComponentWrapper>
  );
  SafeComponent.displayName = `Safe(${componentName || WrappedComponent.displayName || 'Component'})`;
  return SafeComponent;
}
