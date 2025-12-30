import React from 'react';
import { useOfflineMode } from '@/hooks/useOfflineMode';
import { WifiOff, Loader2, CloudOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface GlobalNetworkStatusProps {
  className?: string;
}

export const GlobalNetworkStatus: React.FC<GlobalNetworkStatusProps> = ({ className }) => {
  const { isOnline, queuedCount, isSyncing } = useOfflineMode();

  // Only show when offline or syncing
  const shouldShow = !isOnline || isSyncing || queuedCount > 0;

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={cn(
            "fixed top-0 left-0 right-0 z-[100] px-4 py-2",
            "flex items-center justify-center gap-2",
            !isOnline && "bg-destructive text-destructive-foreground",
            isOnline && isSyncing && "bg-primary text-primary-foreground",
            isOnline && !isSyncing && queuedCount > 0 && "bg-amber-500 text-white",
            className
          )}
        >
          {!isOnline && (
            <>
              <WifiOff className="w-4 h-4" />
              <span className="text-sm font-medium">No internet connection</span>
            </>
          )}
          
          {isOnline && isSyncing && (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm font-medium">Syncing changes...</span>
            </>
          )}
          
          {isOnline && !isSyncing && queuedCount > 0 && (
            <>
              <CloudOff className="w-4 h-4" />
              <span className="text-sm font-medium">{queuedCount} changes pending</span>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GlobalNetworkStatus;
