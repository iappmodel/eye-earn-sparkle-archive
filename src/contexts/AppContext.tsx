// Global App State Context
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { AppState, TabId } from '@/types/app.types';
import { useAuth } from '@/contexts/AuthContext';
import { useAppRealtime } from '@/hooks/useRealtime';

interface AppContextType {
  state: AppState;
  setActiveTab: (tab: TabId) => void;
  setHasUnreadNotifications: (hasUnread: boolean) => void;
  setPendingRewards: (count: number) => void;
  isOffline: boolean;
}

const initialState: AppState = {
  activeTab: 'home',
  isOnline: true,
  hasUnreadNotifications: false,
  pendingRewards: 0,
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);
  const { user } = useAuth();

  // Initialize real-time subscriptions when user is authenticated
  useAppRealtime();

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setState((s) => ({ ...s, isOnline: true }));
    const handleOffline = () => setState((s) => ({ ...s, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set initial state
    setState((s) => ({ ...s, isOnline: navigator.onLine }));

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const setActiveTab = useCallback((tab: TabId) => {
    setState((s) => ({ ...s, activeTab: tab }));
  }, []);

  const setHasUnreadNotifications = useCallback((hasUnread: boolean) => {
    setState((s) => ({ ...s, hasUnreadNotifications: hasUnread }));
  }, []);

  const setPendingRewards = useCallback((count: number) => {
    setState((s) => ({ ...s, pendingRewards: count }));
  }, []);

  return (
    <AppContext.Provider
      value={{
        state,
        setActiveTab,
        setHasUnreadNotifications,
        setPendingRewards,
        isOffline: !state.isOnline,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
