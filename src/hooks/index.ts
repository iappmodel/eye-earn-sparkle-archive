// Common hooks exports for cleaner imports

// Core Data Hooks
export { useDataQuery, usePaginatedQuery } from './useDataQuery';
export { useAppError } from './useAppError';
export { usePerformance } from './usePerformance';

// UI & Interaction Hooks
export { useHapticFeedback } from './useHapticFeedback';
export { useFocusTrap, useFocusOnMount } from './useFocusTrap';
export { useToast } from './use-toast';
export { useToastNotification } from './useToastNotification';
export { useIsMobile } from './use-mobile';

// Navigation Hooks
export { useSwipeBack } from './useSwipeBack';
export { useSwipeNavigation } from './useSwipeNavigation';
export { usePageNavigation } from './usePageNavigation';
export { useDeepLink } from './useDeepLink';

// Feature Hooks
export { useContentFeed } from './useContentFeed';
export { useContentLikes } from './useContentLikes';
export { useContentUpload } from './useContentUpload';
export { useComments } from './useComments';
export { useFollow } from './useFollow';
export { useNotifications } from './useNotifications';
export { useRecentSearches } from './useRecentSearches';
export { useTasks } from './useTasks';

// Media Hooks
export { useVideoStreaming } from './useVideoStreaming';
export { useVoiceRecorder } from './useVoiceRecorder';
export { useStudioMedia } from './useStudioMedia';

// Eye/Gesture Control Hooks
export { useBlinkDetection } from './useBlinkDetection';
export { useBlinkRemoteControl } from './useBlinkRemoteControl';
export { useEyeTracking } from './useEyeTracking';
export { useGazeDirection } from './useGazeDirection';
export { useGestureCombos } from './useGestureCombos';

// Security & Rate Limiting
export { useRateLimiter, useDebounce, useThrottle, RATE_LIMIT_CONFIGS } from './useRateLimiter';
export { useSessionSecurity } from './useSessionSecurity';
export { useBiometricAuth } from './useBiometricAuth';
export { useSanitizedInput, useSanitizedForm } from './useSanitizedInput';

// Network & Offline
export { useOfflineMode } from './useOfflineMode';
export { useNetworkRetry } from './useNetworkRetry';

// Monetization
export { useSubscription } from './useSubscription';
export { useReferral } from './useReferral';

// Layout & Customization
export { useLayoutHistory } from './useLayoutHistory';
export { useVirtualizedList } from './useVirtualizedList';
export { useTimedInteractions } from './useTimedInteractions';

// Auth & User
export { useAdmin } from './useAdmin';
export { useUserRole } from './useUserRole';
export { useUserContent } from './useUserContent';
export { useOnboarding } from './useOnboarding';

// Utilities
export { useDraftSave } from './useDraftSave';
export { useDailyReminder } from './useDailyReminder';
export { useAppRealtime } from './useRealtime';
export { useTypingIndicator } from './useTypingIndicator';
export { usePushNotifications } from './usePushNotifications';
export { useImportedMediaRealtime } from './useImportedMediaRealtime';
export { useNearbyPromotions } from './useNearbyPromotions';
export { useVoiceFeedback } from './useVoiceFeedback';
