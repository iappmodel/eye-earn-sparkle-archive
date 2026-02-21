import React, { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { OfflineProvider } from "@/contexts/OfflineContext";
import { LocalizationProvider } from "@/contexts/LocalizationContext";
import { AccessibilityProvider } from "@/contexts/AccessibilityContext";
import { UICustomizationProvider } from "@/contexts/UICustomizationContext";
import { DragContextProvider } from "@/components/DraggableButton";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminRoute from "@/components/AdminRoute";
import { SplashScreen } from "@/components/SplashScreen";
import { RouteFallback } from "@/components/RouteFallback";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { SwipeBackIndicator } from "@/components/SwipeBackIndicator";
import { BreadcrumbNavigation } from "@/components/BreadcrumbNavigation";
import { useSwipeBack } from "@/hooks/useSwipeBack";
import { useAuth } from "@/contexts/AuthContext";
import { getAndClearRedirectPath } from "@/services/auth.service";
import { rewardsService } from "@/services/rewards.service";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Install from "./pages/Install";
import MyPage from "./pages/MyPage";
import NotFound from "./pages/NotFound";
import ProfileByUsername from "./pages/ProfileByUsername";
import SocialConnect from "./pages/SocialConnect";

// Code-split heavy features (studio, create/live, admin, AI tooling lives in Studio/Create)
// Also code-split detail/content routes to avoid loading them until navigated to.
const Content = lazy(() => import("./pages/Content"));
const PromotionDetails = lazy(() => import("./components/PromotionDetails").then((m) => ({ default: m.PromotionDetails })));
import DevRuntimeErrorOverlay from "@/components/DevRuntimeErrorOverlay";
import { VideoMuteProvider } from "@/contexts/VideoMuteContext";
import { GestureTutorialProvider } from "@/contexts/GestureTutorialContext";
import { VisionStreamProvider } from "@/contexts/VisionStreamContext";
import { VisionProvider } from "@/contexts/VisionContext";
import { useGazeBackendBridge } from "@/hooks/useGazeBackendBridge";

// Code-split heavy features (studio, create/live, admin)
const Studio = lazy(() => import("./pages/Studio"));
const Create = lazy(() => import("./pages/Create"));
const Admin = lazy(() => import("./pages/Admin"));

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; message?: string }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: unknown) {
    return { hasError: true, message: error instanceof Error ? error.message : String(error) };
  }

  componentDidCatch(error: unknown) {
    // Also forward to window error handler so DevRuntimeErrorOverlay can pick it up.
    try {
      const err = error instanceof Error ? error : new Error(String(error));
      window.dispatchEvent(new ErrorEvent('error', { error: err, message: err.message }));
    } catch {
      // ignore
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center space-y-3">
            <div className="text-2xl font-bold">Something went wrong</div>
            <div className="text-sm text-muted-foreground">
              {this.state.message || 'A runtime error occurred.'}
            </div>
            <button
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient();

function GazeBackendBridge() {
  useGazeBackendBridge();
  return null;
}

const AppContent = () => {
  const { isSwipingBack, swipeProgress } = useSwipeBack({
    enabled: true,
    threshold: 150,
    edgeWidth: 25,
  });
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  React.useEffect(() => {
    if (loading || !user) return;
    const intended = getAndClearRedirectPath();
    if (intended && intended.startsWith('/') && intended !== '/') navigate(intended);
  }, [loading, user, navigate]);
  // Redirect legacy ?content=id to /content/:id for shared content links
  React.useEffect(() => {
    const contentId = searchParams.get('content');
    if (contentId && location.pathname === '/') {
      navigate(`/content/${contentId}`, { replace: true });
    }
  }, [searchParams, location.pathname, navigate]);

  // Platform rewards VICOIN for simple usage (logged-in session); drip every 5 min, backend caps per day
  React.useEffect(() => {
    if (!user) return;
    const fiveMinMs = 5 * 60 * 1000;
    const tick = () => {
      const now = Date.now();
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const bucket = Math.floor((now - startOfDay.getTime()) / fiveMinMs);
      const today = startOfDay.toISOString().split('T')[0];
      const contentId = `session_usage:${today}:${bucket}`;
      rewardsService.issueReward('session_usage', contentId, {}).catch(() => {});
    };
    const id = setInterval(tick, fiveMinMs);
    return () => clearInterval(id);
  }, [user?.id]);

  return (
    <>
      <SwipeBackIndicator isActive={isSwipingBack} progress={swipeProgress} />
      <BreadcrumbNavigation />
      <OfflineBanner />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
        <Route path="/auth" element={<Navigate to="/" replace />} />
        <Route path="/" element={<Index />} />
        <Route
          path="/create"
          element={
            <ProtectedRoute>
              <Create />
            </ProtectedRoute>
          }
        />
        <Route
          path="/studio"
          element={
            <ProtectedRoute>
              <Studio />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminRoute>
                <Admin />
              </AdminRoute>
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-page"
          element={
            <ProtectedRoute>
              <MyPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/social-connect"
          element={
            <ProtectedRoute>
              <SocialConnect />
            </ProtectedRoute>
          }
        />
        <Route path="/install" element={<Install />} />
        <Route
          path="/promotion/:id"
          element={
            <ProtectedRoute>
              <PromotionDetails />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile/:username"
          element={
            <ProtectedRoute>
              <ProfileByUsername />
            </ProtectedRoute>
          }
        />
        <Route
          path="/content/:id"
          element={
            <ProtectedRoute>
              <Content />
            </ProtectedRoute>
          }
        />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <SplashScreen />
    <LocalizationProvider>
      <AccessibilityProvider>
        <UICustomizationProvider>
          <DragContextProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <AppErrorBoundary>
                  {import.meta.env.DEV && <DevRuntimeErrorOverlay />}
                  <AuthProvider>
                    <OfflineProvider>
                      <VideoMuteProvider>
                        <GestureTutorialProvider>
                          <VisionStreamProvider>
                            <VisionProvider>
                              <GazeBackendBridge />
                              <AppContent />
                            </VisionProvider>
                          </VisionStreamProvider>
                        </GestureTutorialProvider>
                      </VideoMuteProvider>
                    </OfflineProvider>
                  </AuthProvider>
                </AppErrorBoundary>
              </BrowserRouter>
            </TooltipProvider>
          </DragContextProvider>
        </UICustomizationProvider>
      </AccessibilityProvider>
    </LocalizationProvider>
  </QueryClientProvider>
);

export default App;
