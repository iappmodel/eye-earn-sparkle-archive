import React, { createContext, useContext, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface DemoModeContextType {
  isDemo: boolean;
  /**
   * Gates an action that requires authentication.
   * In demo mode, shows a toast and redirects to auth.
   * Returns true if the action should proceed, false if gated.
   */
  gateAction: (actionName?: string) => boolean;
  exitDemo: () => void;
  goToAuth: () => void;
}

const DemoModeContext = createContext<DemoModeContextType | undefined>(undefined);

export const DemoModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const isDemo = location.pathname === '/demo';

  const goToAuth = () => {
    navigate('/auth?next=/demo');
  };

  const exitDemo = () => {
    navigate('/auth');
  };

  const gateAction = (actionName?: string): boolean => {
    if (!isDemo) return true; // Not in demo, allow action
    
    const action = actionName || 'This action';
    toast.info(`${action} requires sign in`, {
      description: 'Create an account to unlock all features',
      action: {
        label: 'Sign In',
        onClick: goToAuth,
      },
    });
    return false;
  };

  const value = useMemo(() => ({
    isDemo,
    gateAction,
    exitDemo,
    goToAuth,
  }), [isDemo]);

  return (
    <DemoModeContext.Provider value={value}>
      {children}
    </DemoModeContext.Provider>
  );
};

export const useDemoMode = (): DemoModeContextType => {
  const context = useContext(DemoModeContext);
  if (!context) {
    // Return a safe default when used outside provider
    return {
      isDemo: false,
      gateAction: () => true,
      exitDemo: () => {},
      goToAuth: () => {},
    };
  }
  return context;
};
