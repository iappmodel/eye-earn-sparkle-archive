// Main App Shell - Modular Layout Component
import React from 'react';
import { cn } from '@/lib/utils';
import { useApp } from '@/contexts/AppContext';
import { BottomNavigation } from '@/components/BottomNavigation';
import { OfflineBanner } from '@/components/layout/OfflineBanner';

interface AppShellProps {
  children: React.ReactNode;
  hideNavigation?: boolean;
  className?: string;
}

export function AppShell({ children, hideNavigation = false, className }: AppShellProps) {
  const { state, setActiveTab, isOffline } = useApp();

  return (
    <div className={cn('min-h-screen bg-background', className)}>
      {/* Offline Banner */}
      {isOffline && <OfflineBanner />}

      {/* Main Content Area */}
      <main className={cn('flex-1', !hideNavigation && 'pl-16')}>
        {children}
      </main>

      {/* Navigation */}
      {!hideNavigation && (
        <BottomNavigation
          activeTab={state.activeTab}
          onTabChange={(tab) => setActiveTab(tab as any)}
        />
      )}
    </div>
  );
}
