import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const DemoBanner: React.FC = () => {
  const navigate = useNavigate();

  const handleSignIn = () => {
    navigate('/auth?next=/');
  };

  const handleExit = () => {
    navigate('/auth');
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-primary/90 backdrop-blur-sm text-primary-foreground px-4 py-2 flex items-center justify-between gap-2 safe-area-top">
      <span className="text-sm font-medium truncate">
        Demo Mode — actions require sign in
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <Button 
          size="sm" 
          variant="secondary"
          onClick={handleSignIn}
          className="h-7 text-xs"
        >
          <LogIn className="w-3 h-3 mr-1" />
          Sign In
        </Button>
        <Button 
          size="sm" 
          variant="ghost"
          onClick={handleExit}
          className="h-7 w-7 p-0 text-primary-foreground hover:bg-primary-foreground/20"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

export default DemoBanner;
