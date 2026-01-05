import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { OfflineProvider } from "@/contexts/OfflineContext";
import { LocalizationProvider } from "@/contexts/LocalizationContext";
import { AccessibilityProvider } from "@/contexts/AccessibilityContext";
import { UICustomizationProvider } from "@/contexts/UICustomizationContext";
import { DragContextProvider } from "@/components/DraggableButton";
import { DemoModeProvider } from "@/contexts/DemoModeContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { GlobalNetworkStatus } from "@/components/layout/GlobalNetworkStatus";
import { SwipeBackIndicator } from "@/components/SwipeBackIndicator";
import { BreadcrumbNavigation } from "@/components/BreadcrumbNavigation";

import { PageTransition } from "@/components/layout/PageTransition";
import { PageLoader } from "@/components/ui/PageLoader";
import { useSwipeBack } from "@/hooks/useSwipeBack";

// Lazy load all pages for code splitting
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Admin = lazy(() => import("./pages/Admin"));
const Install = lazy(() => import("./pages/Install"));
const Create = lazy(() => import("./pages/Create"));
const Studio = lazy(() => import("./pages/Studio"));
const MyPage = lazy(() => import("./pages/MyPage"));
const Search = lazy(() => import("./pages/Search"));
const Hashtag = lazy(() => import("./pages/Hashtag"));
const UserProfile = lazy(() => import("./pages/UserProfile"));
const VideoDetail = lazy(() => import("./pages/VideoDetail"));
const Drafts = lazy(() => import("./pages/Drafts"));
const Sounds = lazy(() => import("./pages/Sounds"));
const Trending = lazy(() => import("./pages/Trending"));
const Challenges = lazy(() => import("./pages/Challenges"));
const Wallet = lazy(() => import("./pages/Wallet"));
const Earnings = lazy(() => import("./pages/Earnings"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SocialConnect = lazy(() => import("./pages/SocialConnect"));
const PromotionDetails = lazy(() => import("./components/PromotionDetails").then(m => ({ default: m.PromotionDetails })));

const queryClient = new QueryClient();

const AppContent = () => {
  const { isSwipingBack, swipeProgress } = useSwipeBack({
    enabled: true,
    threshold: 150,
    edgeWidth: 25,
  });

  return (
    <>
      <GlobalNetworkStatus />
      
      <SwipeBackIndicator isActive={isSwipingBack} progress={swipeProgress} />
      <BreadcrumbNavigation />
      <OfflineBanner />
      <PageTransition>
        <Suspense fallback={<PageLoader message="Loading page..." />}>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              }
            />
            <Route path="/demo" element={<Index />} />
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
                  <Admin />
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
              path="/drafts"
              element={
                <ProtectedRoute>
                  <Drafts />
                </ProtectedRoute>
              }
            />
            <Route
              path="/search"
              element={
                <ProtectedRoute>
                  <Search />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tag/:tag"
              element={
                <ProtectedRoute>
                  <Hashtag />
                </ProtectedRoute>
              }
            />
            <Route
              path="/u/:userId"
              element={
                <ProtectedRoute>
                  <UserProfile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/v/:videoId"
              element={
                <ProtectedRoute>
                  <VideoDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/promotion/:id"
              element={
                <ProtectedRoute>
                  <PromotionDetails />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sounds"
              element={
                <ProtectedRoute>
                  <Sounds />
                </ProtectedRoute>
              }
            />
            <Route
              path="/trending"
              element={
                <ProtectedRoute>
                  <Trending />
                </ProtectedRoute>
              }
            />
            <Route
              path="/challenges"
              element={
                <ProtectedRoute>
                  <Challenges />
                </ProtectedRoute>
              }
            />
            <Route
              path="/wallet"
              element={
                <ProtectedRoute>
                  <Wallet />
                </ProtectedRoute>
              }
            />
            <Route
              path="/earnings"
              element={
                <ProtectedRoute>
                  <Earnings />
                </ProtectedRoute>
              }
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </PageTransition>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LocalizationProvider>
      <AccessibilityProvider>
        <UICustomizationProvider>
          <DragContextProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <AuthProvider>
                <BrowserRouter>
                  <DemoModeProvider>
                    <OfflineProvider>
                      <AppContent />
                    </OfflineProvider>
                  </DemoModeProvider>
                </BrowserRouter>
              </AuthProvider>
            </TooltipProvider>
          </DragContextProvider>
        </UICustomizationProvider>
      </AccessibilityProvider>
    </LocalizationProvider>
  </QueryClientProvider>
);

export default App;
